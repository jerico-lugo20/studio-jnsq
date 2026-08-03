// CRM CRUD via Netlify Blobs
// Stores: crm-contacts, crm-activities, crm-config
//
// CONTACTS:
// GET  ?action=list-contacts&stage=xxx&market=xxx&limit=N
// GET  ?action=get-contact&id=xxx
// GET  ?action=search-contacts&q=xxx
// POST action=create-contact
// POST action=update-contact
// POST action=import-csv (bulk import)
// DELETE ?action=delete-contact&id=xxx
//
// PIPELINE:
// GET  ?action=pipeline-view — contacts grouped by stage
// POST action=move-stage — move contact to new pipeline stage
//
// ACTIVITIES:
// GET  ?action=list-activities&contactId=xxx&limit=N
// POST action=log-activity
//
// EMAIL:
// GET  ?action=list-senders
// POST action=add-sender
// POST action=remove-sender
// POST action=draft-email — create email draft linked to contact
// POST action=send-email — mark email as sent (actual sending via agent)
//
// CONFIG:
// GET  ?action=get-config
// POST action=update-config
//
// LINKEDIN:
// GET  ?action=linkedin-metrics — all LinkedIn dashboard data
// POST action=save-linkedin-metrics — save metrics snapshot
// POST action=save-linkedin-activity — add activity item
// POST action=save-linkedin-intel — save posting intel
// POST action=save-linkedin-engagement — save engagement queue item
// POST action=save-linkedin-posts — save top posts data
//
// STATS:
// GET  ?action=crm-stats
//
// EDITORIAL PIPELINE:
// GET  ?action=list-editorial
// POST action=save-editorial (save full editorial items array)
// POST action=add-editorial (add single item)
// POST action=update-editorial (update single item by index)

var { getStore } = require("@netlify/blobs");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

var PIPELINE_STAGES = ["new", "researched", "contacted", "proposal", "negotiation", "closed-won", "closed-lost"];
var STAGE_LABELS = {
  "new": "New",
  "researched": "Researched",
  "contacted": "Contacted",
  "proposal": "Proposal",
  "negotiation": "Negotiation",
  "closed-won": "Closed Won",
  "closed-lost": "Closed Lost"
};

exports.handler = async function(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  var contactsStore = getStore({ name: "crm-contacts", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  var activitiesStore = getStore({ name: "crm-activities", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  var configStore = getStore({ name: "crm-config", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  var editorialStore = getStore({ name: "editorial-pipeline", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  var mediaStore = getStore({ name: "media-signals", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  var params = event.queryStringParameters || {};
  var action = params.action;

  // === Helper: get or create index ===
  async function getIndex() {
    try {
      var idx = await contactsStore.get("_index", { type: "json" });
      return idx || [];
    } catch (e) { return []; }
  }

  async function saveIndex(idx) {
    await contactsStore.setJSON("_index", idx);
  }

  // === Helper: get config ===
  async function getConfig() {
    try {
      var cfg = await configStore.get("main", { type: "json" });
      return cfg || { senders: [], reviewMode: { press: true, pipeline: true }, pipelineStages: PIPELINE_STAGES };
    } catch (e) {
      return { senders: [], reviewMode: { press: true, pipeline: true }, pipelineStages: PIPELINE_STAGES };
    }
  }

  // =====================
  // POST ACTIONS
  // =====================
  if (event.httpMethod === "POST") {
    var body;
    try { body = JSON.parse(event.body); } catch (e) { body = {}; }
    action = body.action || action;

    // --- Create Contact ---
    if (action === "create-contact") {
      var id = body.id || generateId();
      var contact = {
        id: id,
        name: body.name || "",
        position: body.position || "",
        email: body.email || "",
        phone: body.phone || "",
        linkedin: body.linkedin || "",
        company: body.company || "",
        industry: body.industry || "",
        website: body.website || "",
        market: body.market || "",
        source: body.source || "manual",
        diagnosticType: body.diagnosticType || "",
        diagnosticScore: body.diagnosticScore || body.score || null,
        score: body.score || body.diagnosticScore || null,
        diagnosticData: body.diagnosticData || {},
        stage: body.stage || "new",
        priority: body.priority || "medium",
        assignedTo: body.assignedTo || "",
        notes: body.notes || "",
        tags: body.tags || [],
        dossier: body.dossier || "",
        emailHistory: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await contactsStore.setJSON(id, contact);

      // Update index
      var idx = await getIndex();
      idx = idx.filter(function(c) { return c.id !== id; });
      idx.push({
        id: contact.id,
        name: contact.name,
        position: contact.position,
        email: contact.email,
        phone: contact.phone,
        linkedin: contact.linkedin,
        company: contact.company,
        industry: contact.industry,
        market: contact.market,
        source: contact.source,
        stage: contact.stage,
        priority: contact.priority,
        diagnosticType: contact.diagnosticType,
        diagnosticScore: contact.diagnosticScore,
        score: contact.score,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt
      });
      await saveIndex(idx);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, id: id }) };
    }

    // --- Update Contact ---
    if (action === "update-contact") {
      var existing;
      try { existing = await contactsStore.get(body.id, { type: "json" }); } catch (e) { existing = null; }
      if (!existing) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Contact not found" }) };

      var fields = ["name", "position", "email", "phone", "linkedin", "company", "industry", "website", "market", "source",
                     "diagnosticType", "diagnosticScore", "score", "diagnosticData", "stage", "priority",
                     "assignedTo", "notes", "tags", "dossier"];
      for (var f = 0; f < fields.length; f++) {
        if (body[fields[f]] !== undefined) existing[fields[f]] = body[fields[f]];
      }
      existing.updatedAt = new Date().toISOString();
      await contactsStore.setJSON(body.id, existing);

      // Update index
      var idx2 = await getIndex();
      idx2 = idx2.map(function(c) {
        if (c.id === body.id) {
          return {
            id: existing.id, name: existing.name, email: existing.email,
            company: existing.company, industry: existing.industry, market: existing.market,
            source: existing.source, stage: existing.stage, priority: existing.priority,
            diagnosticType: existing.diagnosticType, diagnosticScore: existing.diagnosticScore,
            createdAt: existing.createdAt, updatedAt: existing.updatedAt
          };
        }
        return c;
      });
      await saveIndex(idx2);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // --- Move Pipeline Stage ---
    if (action === "move-stage") {
      var contact;
      try { contact = await contactsStore.get(body.id, { type: "json" }); } catch (e) { contact = null; }
      if (!contact) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Contact not found" }) };

      var oldStage = contact.stage;
      contact.stage = body.stage;
      contact.updatedAt = new Date().toISOString();
      await contactsStore.setJSON(body.id, contact);

      // Update index
      var idx3 = await getIndex();
      idx3 = idx3.map(function(c) { if (c.id === body.id) { c.stage = body.stage; c.updatedAt = contact.updatedAt; } return c; });
      await saveIndex(idx3);

      // Log activity
      var moveActivity = {
        id: generateId(),
        contactId: body.id,
        type: "stage-change",
        description: "Moved from " + STAGE_LABELS[oldStage] + " to " + STAGE_LABELS[body.stage],
        agent: body.agent || "manual",
        createdAt: new Date().toISOString()
      };
      await activitiesStore.setJSON(moveActivity.id, moveActivity);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, from: oldStage, to: body.stage }) };
    }

    // --- Log Activity ---
    if (action === "log-activity") {
      var activityId = generateId();
      var activity = {
        id: activityId,
        contactId: body.contactId || "",
        type: body.type || "note",
        description: body.description || "",
        agent: body.agent || "manual",
        data: body.data || {},
        createdAt: new Date().toISOString()
      };
      await activitiesStore.setJSON(activityId, activity);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, id: activityId }) };
    }

    // --- Draft Email ---
    if (action === "draft-email") {
      var draftId = generateId();
      var draft = {
        id: draftId,
        contactId: body.contactId || "",
        sender: body.sender || "jerico.lugo20@gmail.com",
        to: body.to || "",
        cc: body.cc || "",
        bcc: body.bcc || "",
        subject: body.subject || "",
        body: body.emailBody || "",
        status: "draft",
        scheduledAt: body.scheduledAt || null,
        agent: body.agent || "pipeline",
        source: body.source || "manual",
        createdAt: new Date().toISOString()
      };
      await activitiesStore.setJSON("email_" + draftId, draft);

      // Log activity
      var emailAct = {
        id: generateId(),
        contactId: body.contactId,
        type: "email-draft",
        description: "Email draft created: " + body.subject,
        agent: body.agent || "pipeline",
        data: { draftId: draftId },
        createdAt: new Date().toISOString()
      };
      await activitiesStore.setJSON(emailAct.id, emailAct);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, draftId: draftId }) };
    }

    // --- Send Email (mark as sent) ---
    if (action === "send-email") {
      var draft2;
      try { draft2 = await activitiesStore.get("email_" + body.draftId, { type: "json" }); } catch (e) { draft2 = null; }
      if (!draft2) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Draft not found" }) };

      draft2.status = "sent";
      draft2.sentAt = new Date().toISOString();
      draft2.sender = body.sender || draft2.sender;
      await activitiesStore.setJSON("email_" + body.draftId, draft2);

      // Add to contact's email history
      if (draft2.contactId) {
        var cont;
        try { cont = await contactsStore.get(draft2.contactId, { type: "json" }); } catch (e) { cont = null; }
        if (cont) {
          if (!cont.emailHistory) cont.emailHistory = [];
          cont.emailHistory.push({
            draftId: body.draftId,
            subject: draft2.subject,
            sender: draft2.sender,
            sentAt: draft2.sentAt
          });
          cont.updatedAt = new Date().toISOString();
          await contactsStore.setJSON(draft2.contactId, cont);
        }
      }

      // Log activity
      var sendAct = {
        id: generateId(),
        contactId: draft2.contactId,
        type: "email-sent",
        description: "Email sent: " + draft2.subject + " (from " + draft2.sender + ")",
        agent: "manual",
        data: { draftId: body.draftId },
        createdAt: new Date().toISOString()
      };
      await activitiesStore.setJSON(sendAct.id, sendAct);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // --- Update Draft ---
    if (action === "update-draft") {
      var existDraft;
      try { existDraft = await activitiesStore.get("email_" + body.draftId, { type: "json" }); } catch (e) { existDraft = null; }
      if (!existDraft) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Draft not found" }) };

      if (body.to !== undefined) existDraft.to = body.to;
      if (body.cc !== undefined) existDraft.cc = body.cc;
      if (body.bcc !== undefined) existDraft.bcc = body.bcc;
      if (body.subject !== undefined) existDraft.subject = body.subject;
      if (body.emailBody !== undefined) existDraft.body = body.emailBody;
      if (body.scheduledAt !== undefined) existDraft.scheduledAt = body.scheduledAt;
      if (body.contactId !== undefined) existDraft.contactId = body.contactId;
      existDraft.updatedAt = new Date().toISOString();
      await activitiesStore.setJSON("email_" + body.draftId, existDraft);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // --- Delete Draft ---
    if (action === "delete-draft") {
      try { await activitiesStore.delete("email_" + body.draftId); } catch (e) {}
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // --- LinkedIn: Save Metrics Snapshot ---
    if (action === "save-linkedin-metrics") {
      var linkedinStore = getStore({ name: "linkedin-metrics", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      await linkedinStore.setJSON("current-metrics", body.metrics || body);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // --- LinkedIn: Save Activity ---
    if (action === "save-linkedin-activity") {
      var linkedinStore2 = getStore({ name: "linkedin-metrics", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      var existing = [];
      try { existing = await linkedinStore2.get("activities", { type: "json" }) || []; } catch (e) {}
      var newItems = body.activities || (body.activity ? [body.activity] : []);
      existing = newItems.concat(existing).slice(0, 50);
      await linkedinStore2.setJSON("activities", existing);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // --- LinkedIn: Save Intel ---
    if (action === "save-linkedin-intel") {
      var linkedinStore3 = getStore({ name: "linkedin-metrics", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      await linkedinStore3.setJSON("intel", body.intel || []);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // --- LinkedIn: Save Engagement Queue ---
    if (action === "save-linkedin-engagement") {
      var linkedinStore4 = getStore({ name: "linkedin-metrics", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      var eq = [];
      try { eq = await linkedinStore4.get("engagement-queue", { type: "json" }) || []; } catch (e) {}
      var newComments = body.comments || (body.comment ? [body.comment] : []);
      eq = newComments.concat(eq).slice(0, 30);
      await linkedinStore4.setJSON("engagement-queue", eq);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // --- LinkedIn: Save Top Posts ---
    if (action === "save-linkedin-posts") {
      var linkedinStore5 = getStore({ name: "linkedin-metrics", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      await linkedinStore5.setJSON("top-posts", body.posts || []);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // --- LinkedIn: Save Daily Snapshot (date-keyed for trend tracking) ---
    if (action === "save-linkedin-snapshot") {
      var linkedinStore6 = getStore({ name: "linkedin-metrics", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      var snapDate = body.date || new Date().toISOString().slice(0, 10);
      var snapshot = {
        date: snapDate,
        followers: body.followers || 0,
        impressions: body.impressions || 0,
        engagementRate: body.engagementRate || 0,
        profileViews: body.profileViews || 0,
        reactions: body.reactions || 0,
        comments: body.comments || 0,
        reposts: body.reposts || 0,
        postsPublished: body.postsPublished || 0,
        draftsGenerated: body.draftsGenerated || 0,
        notes: body.notes || '',
        savedAt: new Date().toISOString()
      };
      await linkedinStore6.setJSON("snapshot_" + snapDate, snapshot);
      // Also update current-metrics with latest
      await linkedinStore6.setJSON("current-metrics", {
        followers: snapshot.followers,
        followersChange: body.followersChange || null,
        engagementRate: snapshot.engagementRate,
        engagementChange: body.engagementChange || null,
        impressions7d: snapshot.impressions,
        impressionsChange: body.impressionsChange || null,
        profileViews7d: snapshot.profileViews,
        profileViewsChange: body.profileViewsChange || null
      });
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // --- LinkedIn: Get Snapshots (for trend/history) ---
    // Handled in GET section below

    // --- Add Sender ---
    if (action === "add-sender") {
      var cfg = await getConfig();
      var exists = cfg.senders.some(function(s) { return s.email === body.email; });
      if (!exists) {
        cfg.senders.push({
          email: body.email,
          label: body.label || body.email,
          addedAt: new Date().toISOString()
        });
        await configStore.setJSON("main", cfg);
      }
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, senders: cfg.senders }) };
    }

    // --- Remove Sender ---
    if (action === "remove-sender") {
      var cfg2 = await getConfig();
      cfg2.senders = cfg2.senders.filter(function(s) { return s.email !== body.email; });
      await configStore.setJSON("main", cfg2);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, senders: cfg2.senders }) };
    }

    // --- Update Config ---
    if (action === "update-config") {
      var cfg3 = await getConfig();
      if (body.reviewMode !== undefined) cfg3.reviewMode = body.reviewMode;
      if (body.pipelineStages !== undefined) cfg3.pipelineStages = body.pipelineStages;
      if (body.defaultSender !== undefined) cfg3.defaultSender = body.defaultSender;
      if (body.autoExecuteRisk !== undefined) cfg3.autoExecuteRisk = body.autoExecuteRisk;
      await configStore.setJSON("main", cfg3);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, config: cfg3 }) };
    }

    // --- Save Media Signals ---
    if (action === "save-signals") {
      var signalItems = body.signals || [];
      // Prepend to existing, keep last 50
      var existing = [];
      try { existing = await mediaStore.get("latest", { type: "json" }) || []; } catch(e) {}
      var merged = signalItems.concat(existing).slice(0, 50);
      await mediaStore.setJSON("latest", merged);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, count: merged.length }) };
    }

    // --- Save Editorial Pipeline (full replace) ---
    if (action === "save-editorial") {
      var editItems = body.items || [];
      await editorialStore.setJSON("items", editItems);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, count: editItems.length }) };
    }

    // --- Add Editorial Item ---
    if (action === "add-editorial") {
      var existingItems = [];
      try { existingItems = await editorialStore.get("items", { type: "json" }) || []; } catch(e) {}
      var newItem = {
        id: generateId(),
        topic: body.topic || "",
        type: body.type || "Blog",
        source: body.source || "Agent",
        priority: body.priority || "Sales",
        status: body.status || "Idea",
        notes: body.notes || "",
        agent: body.agent || "",
        createdAt: new Date().toISOString()
      };
      existingItems.push(newItem);
      await editorialStore.setJSON("items", existingItems);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, item: newItem }) };
    }

    // --- Update Editorial Item ---
    if (action === "update-editorial") {
      var edItems = [];
      try { edItems = await editorialStore.get("items", { type: "json" }) || []; } catch(e) {}
      var targetId = body.id;
      var targetIdx = body.index;
      for (var ei = 0; ei < edItems.length; ei++) {
        if ((targetId && edItems[ei].id === targetId) || (targetIdx !== undefined && ei === targetIdx)) {
          if (body.status) edItems[ei].status = body.status;
          if (body.topic) edItems[ei].topic = body.topic;
          if (body.notes) edItems[ei].notes = body.notes;
          if (body.type) edItems[ei].type = body.type;
          edItems[ei].updatedAt = new Date().toISOString();
          break;
        }
      }
      await editorialStore.setJSON("items", edItems);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, items: edItems }) };
    }

    // --- Delete Contact(s) — supports single id or array of ids ---
    if (action === "delete-contact") {
      var delIds = body.ids || (body.id ? [body.id] : []);
      if (delIds.length === 0) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "ID(s) required" }) };
      for (var di = 0; di < delIds.length; di++) {
        try { await contactsStore.delete(delIds[di]); } catch (e) {}
      }
      var idx10 = await getIndex();
      idx10 = idx10.filter(function(c) { return delIds.indexOf(c.id) === -1; });
      await saveIndex(idx10);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, deleted: delIds.length }) };
    }

    // --- Import CSV ---
    if (action === "import-csv") {
      var rows = body.contacts || [];
      var imported = 0;
      var idx4 = await getIndex();
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var cid = generateId();
        var newContact = {
          id: cid,
          name: row.name || "",
          position: row.position || "",
          email: row.email || "",
          phone: row.phone || row["phone number"] || "",
          linkedin: row.linkedin || "",
          company: row.company || "",
          industry: row.industry || "",
          website: row.website || "",
          market: row.market || body.market || "",
          source: row.source || body.source || "csv-import",
          diagnosticType: row.diagnosticType || row.diagnostictype || "",
          diagnosticScore: row.diagnosticScore || row.diagnosticscore || row.score || null,
          score: row.score || row.diagnosticScore || row.diagnosticscore || null,
          diagnosticData: {},
          stage: row.stage || "new",
          priority: row.priority || "medium",
          assignedTo: "",
          notes: row.notes || "",
          tags: row.tags || (body.tags || []),
          dossier: "",
          emailHistory: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await contactsStore.setJSON(cid, newContact);
        idx4.push({
          id: cid, name: newContact.name, position: newContact.position, email: newContact.email,
          phone: newContact.phone, linkedin: newContact.linkedin,
          company: newContact.company, industry: newContact.industry, market: newContact.market,
          source: newContact.source, stage: newContact.stage, priority: newContact.priority,
          diagnosticType: newContact.diagnosticType, diagnosticScore: newContact.diagnosticScore,
          score: newContact.score,
          createdAt: newContact.createdAt, updatedAt: newContact.updatedAt
        });
        imported++;
      }
      await saveIndex(idx4);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, imported: imported }) };
    }

    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Unknown action" }) };
  }

  // =====================
  // GET ACTIONS
  // =====================
  if (event.httpMethod === "GET") {

    // --- List Contacts ---
    if (action === "list-contacts") {
      var idx5 = await getIndex();
      if (params.stage) idx5 = idx5.filter(function(c) { return c.stage === params.stage; });
      if (params.market) idx5 = idx5.filter(function(c) { return c.market === params.market; });
      if (params.source) idx5 = idx5.filter(function(c) { return c.source === params.source; });
      if (params.priority) idx5 = idx5.filter(function(c) { return c.priority === params.priority; });
      idx5.sort(function(a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
      var lim = parseInt(params.limit) || 100;
      idx5 = idx5.slice(0, lim);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ contacts: idx5, count: idx5.length }) };
    }

    // --- Get Contact ---
    if (action === "get-contact") {
      try {
        var c2 = await contactsStore.get(params.id, { type: "json" });
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(c2) };
      } catch (e) {
        return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Not found" }) };
      }
    }

    // --- Search Contacts ---
    if (action === "search-contacts") {
      var q = (params.q || "").toLowerCase();
      var idx6 = await getIndex();
      var results = idx6.filter(function(c) {
        return (c.name || "").toLowerCase().indexOf(q) >= 0 ||
               (c.email || "").toLowerCase().indexOf(q) >= 0 ||
               (c.company || "").toLowerCase().indexOf(q) >= 0 ||
               (c.industry || "").toLowerCase().indexOf(q) >= 0;
      });
      results.sort(function(a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ contacts: results, count: results.length }) };
    }

    // --- Pipeline View ---
    if (action === "pipeline-view") {
      var idx7 = await getIndex();
      var pipeline = {};
      PIPELINE_STAGES.forEach(function(s) { pipeline[s] = { label: STAGE_LABELS[s], contacts: [] }; });
      idx7.forEach(function(c) {
        var stage = c.stage || "new";
        if (!pipeline[stage]) pipeline[stage] = { label: stage, contacts: [] };
        pipeline[stage].contacts.push(c);
      });
      // Sort each stage by priority then date
      var priorityOrder = { high: 0, medium: 1, low: 2 };
      Object.keys(pipeline).forEach(function(s) {
        pipeline[s].contacts.sort(function(a, b) {
          var pa = priorityOrder[a.priority] || 1;
          var pb = priorityOrder[b.priority] || 1;
          if (pa !== pb) return pa - pb;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
        pipeline[s].count = pipeline[s].contacts.length;
      });
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(pipeline) };
    }

    // --- List Activities ---
    if (action === "list-activities") {
      var activities = [];
      try {
        var allKeys = await activitiesStore.list();
        var aKeys = allKeys.blobs ? allKeys.blobs.filter(function(b) { return !b.key.startsWith("email_"); }) : [];
        if (params.contactId) {
          // Get activities for specific contact
          for (var ai = Math.max(0, aKeys.length - 200); ai < aKeys.length; ai++) {
            try {
              var act = await activitiesStore.get(aKeys[ai].key, { type: "json" });
              if (act && act.contactId === params.contactId) activities.push(act);
            } catch (e) {}
          }
        } else {
          // Get recent activities
          var recentKeys = aKeys.slice(-(parseInt(params.limit) || 50));
          for (var aj = 0; aj < recentKeys.length; aj++) {
            try {
              var act2 = await activitiesStore.get(recentKeys[aj].key, { type: "json" });
              if (act2) activities.push(act2);
            } catch (e) {}
          }
        }
      } catch (e) {}
      activities.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(activities) };
    }

    // --- List Senders ---
    if (action === "list-senders") {
      var cfg4 = await getConfig();
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ senders: cfg4.senders }) };
    }

    // --- Get Config ---
    if (action === "get-config") {
      var cfg5 = await getConfig();
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(cfg5) };
    }

    // --- CRM Stats ---
    if (action === "crm-stats") {
      var idx8 = await getIndex();
      var stats = {
        total: idx8.length,
        byStage: {},
        byMarket: {},
        bySource: {},
        byPriority: {},
        recentlyAdded: 0,
        recentlyContacted: 0
      };
      var weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      idx8.forEach(function(c) {
        stats.byStage[c.stage] = (stats.byStage[c.stage] || 0) + 1;
        if (c.market) stats.byMarket[c.market] = (stats.byMarket[c.market] || 0) + 1;
        stats.bySource[c.source] = (stats.bySource[c.source] || 0) + 1;
        stats.byPriority[c.priority] = (stats.byPriority[c.priority] || 0) + 1;
        if (c.createdAt > weekAgo) stats.recentlyAdded++;
        if (c.stage === "contacted" && c.updatedAt > weekAgo) stats.recentlyContacted++;
      });
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(stats) };
    }

    // --- List Media Signals ---
    if (action === "list-signals") {
      try {
        var signals = await mediaStore.get("latest", { type: "json" });
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ signals: signals || [] }) };
      } catch (e) {
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ signals: [] }) };
      }
    }

    // --- List Editorial Pipeline ---
    if (action === "list-editorial") {
      try {
        var editorial = await editorialStore.get("items", { type: "json" });
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ items: editorial || [] }) };
      } catch (e) {
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ items: [] }) };
      }
    }

    // --- List Email Drafts ---
    if (action === "list-drafts") {
      var drafts = [];
      try {
        var draftKeys = await activitiesStore.list();
        var emailKeys = draftKeys.blobs ? draftKeys.blobs.filter(function(b) { return b.key.startsWith("email_"); }) : [];
        var statusFilter = params.status || "";
        var draftLimit = parseInt(params.limit) || 50;
        var recentDraftKeys = emailKeys.slice(-draftLimit);
        for (var di = 0; di < recentDraftKeys.length; di++) {
          try {
            var d = await activitiesStore.get(recentDraftKeys[di].key, { type: "json" });
            if (d && (!statusFilter || d.status === statusFilter)) drafts.push(d);
          } catch (e) {}
        }
      } catch (e) {}
      drafts.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(drafts) };
    }

    // LinkedIn metrics — aggregated dashboard data
    if (action === "linkedin-metrics") {
      var linkedinStore = getStore({ name: "linkedin-metrics", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      var result = { metrics: {}, activities: [], intel: [], engagementQueue: [], topPosts: [], snapshots: [] };
      try {
        var metricsData = await linkedinStore.get("current-metrics", { type: "json" });
        if (metricsData) result.metrics = metricsData;
      } catch (e) {}
      try {
        var actData = await linkedinStore.get("activities", { type: "json" });
        if (actData) result.activities = actData;
      } catch (e) {}
      try {
        var intelData = await linkedinStore.get("intel", { type: "json" });
        if (intelData) result.intel = intelData;
      } catch (e) {}
      try {
        var eqData = await linkedinStore.get("engagement-queue", { type: "json" });
        if (eqData) result.engagementQueue = eqData;
      } catch (e) {}
      try {
        var postsData = await linkedinStore.get("top-posts", { type: "json" });
        if (postsData) result.topPosts = postsData;
      } catch (e) {}
      // Load daily snapshots for trend data
      try {
        var snapKeys = await linkedinStore.list({ prefix: "snapshot_" });
        var snapBlobs = snapKeys.blobs ? snapKeys.blobs.map(function(b) { return b.key; }).sort() : [];
        // Get last 90 days of snapshots
        var recentSnaps = snapBlobs.slice(-90);
        for (var si = 0; si < recentSnaps.length; si++) {
          try {
            var snap = await linkedinStore.get(recentSnaps[si], { type: "json" });
            if (snap) result.snapshots.push(snap);
          } catch (e) {}
        }
      } catch (e) {}
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(result) };
    }

    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Unknown action" }) };
  }

  // DELETE
  if (event.httpMethod === "DELETE") {
    if (action === "delete-contact") {
      var delId = params.id;
      if (!delId) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "ID required" }) };
      await contactsStore.delete(delId);
      var idx9 = await getIndex();
      idx9 = idx9.filter(function(c) { return c.id !== delId; });
      await saveIndex(idx9);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Unknown action" }) };
  }

  return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
};

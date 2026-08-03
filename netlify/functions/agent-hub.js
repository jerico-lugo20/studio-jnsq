// Agent Hub CRUD via Netlify Blobs
// Stores: agent-briefs (daily reports from agents), agent-leads (diagnostic leads), agent-actions (approved/denied items)
//
// GET ?action=list-briefs&agent=xxx&limit=N — list briefs for an agent
// GET ?action=get-brief&id=xxx — get single brief
// GET ?action=list-leads&status=xxx&limit=N — list leads (optional status filter)
// GET ?action=get-lead&id=xxx — get single lead
// GET ?action=dashboard — get today's briefs for all agents + pending actions
// GET ?action=stats — get counts for leads, briefs, actions
// GET ?action=execution-manifest — list approved+claimed items (for watcher)
// GET ?action=watcher-status — last heartbeat timestamp + version
// POST action=submit-brief — agent submits daily brief
// POST action=submit-lead — create lead from diagnostic completion
// POST action=approve-item — approve an action item
// POST action=deny-item — deny an action item
// POST action=execute-item — mark item executed (called by watcher / cowork)
// POST action=fail-item — mark item as failed (called by watcher on error)
// POST action=claim-item — watcher claims an approved item (status=claimed)
// POST action=heartbeat — watcher pings status (writes _heartbeat blob)
// POST action=update-lead — update lead status/notes
// POST action=delete-lead — permanently remove a lead by id
//
// ── Item action contract (set by agents on each item) ────────────────────────
// item.contract = {
//   kind: 'auto' | 'manual',     // auto = watcher dispatches; manual = needs human
//   skill: 'seo-ops' | null,     // optional cowork skill name to load
//   prompt: '...',               // self-contained instructions for Claude
//   workingDir: '/abs/path',     // cwd for the claude session
//   timeout: 900,                // seconds (default 15min)
//   autoDeploy: false,           // run deploy after?
//   tags: ['site-fix', 'seo']    // free-form tags for the queue view
// }

var { getStore } = require("@netlify/blobs");
var https = require("https");

function httpPostInternal(path, payload) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(payload);
    var options = { hostname: 'studiojnsq.com', path: path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpGetInternal(path) {
  return new Promise(function(resolve, reject) {
    https.get('https://studiojnsq.com' + path, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    }).on('error', reject);
  });
}

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

exports.handler = async function(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  var briefsStore = getStore({ name: "agent-briefs", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  var leadsStore = getStore({ name: "agent-leads", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  var actionsStore = getStore({ name: "agent-actions", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  var params = event.queryStringParameters || {};
  var action = params.action;

  // POST actions
  if (event.httpMethod === "POST") {
    var body;
    try { body = JSON.parse(event.body); } catch (e) { body = {}; }
    action = body.action || action;

    // Agent submits daily brief
    if (action === "submit-brief") {
      var briefId = body.agent + "_" + (body.date || todayKey());
      var brief = {
        id: briefId,
        agent: body.agent,
        date: body.date || todayKey(),
        title: body.title || "",
        summary: body.summary || "",
        items: body.items || [],
        metrics: body.metrics || {},
        createdAt: new Date().toISOString()
      };
      // Each item: { id, type, title, description, priority, status: "pending"|"approved"|"denied", data: {} }
      // Auto-approve rules:
      // NEVER auto-approve: outreach drafts (press/pipeline agents), blog drafts (growth agent), any "action" type from press/pipeline/growth
      // ONLY auto-approve: insights and low-priority items from rank/dev agents
      var agentName = body.agent || "";
      var highRiskAgents = ["press", "pipeline", "growth"];
      brief.items = brief.items.map(function(item) {
        if (!item.id) item.id = generateId();
        if (!item.status) {
          var isHighRiskAgent = highRiskAgents.indexOf(agentName) !== -1;
          var isActionItem = item.type === "action";
          if (isHighRiskAgent || isActionItem) {
            // All outreach, blog, and action items require manual approval
            item.status = "pending";
          } else if (item.priority === "low" || (item.type === "insight" && item.priority !== "high")) {
            // Auto-approve low-priority items and non-high insights from safe agents
            item.status = "approved";
            item.autoApproved = true;
            item.approvedAt = new Date().toISOString();
            item.approvalNote = "Auto-approved (low-risk)";
          } else {
            item.status = "pending";
          }
        }
        return item;
      });
      await briefsStore.setJSON(briefId, brief);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, briefId: briefId }) };
    }

    // Create lead from diagnostic
    if (action === "submit-lead") {
      var leadId = generateId();
      var lead = {
        id: leadId,
        source: body.source || "diagnostic",
        diagnosticType: body.diagnosticType || "",
        score: body.score || null,
        name: body.name || "",
        email: body.email || "",
        company: body.company || "",
        industry: body.industry || "",
        answers: body.answers || {},
        status: "new",
        notes: "",
        assignedAgent: "pipeline",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await leadsStore.setJSON(leadId, lead);

      // Update lead count in a stats key
      var stats;
      try { stats = await leadsStore.get("_stats", { type: "json" }); } catch (e) { stats = null; }
      if (!stats) stats = { totalLeads: 0, newLeads: 0 };
      stats.totalLeads = (stats.totalLeads || 0) + 1;
      stats.newLeads = (stats.newLeads || 0) + 1;
      await leadsStore.setJSON("_stats", stats);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, leadId: leadId }) };
    }

    // Approve action item — marks as approved for executor task pickup
    if (action === "approve-item") {
      var briefData;
      try { briefData = await briefsStore.get(body.briefId, { type: "json" }); } catch (e) { briefData = null; }
      if (!briefData) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Brief not found" }) };

      briefData.items = briefData.items.map(function(item) {
        if (item.id === body.itemId) {
          item.status = "approved";
          item.approvedAt = new Date().toISOString();
        }
        return item;
      });
      await briefsStore.setJSON(body.briefId, briefData);

      // Log the action
      var actionLog = {
        id: generateId(),
        briefId: body.briefId,
        itemId: body.itemId,
        action: "approved",
        agent: briefData.agent,
        timestamp: new Date().toISOString()
      };
      await actionsStore.setJSON(actionLog.id, actionLog);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // Mark item as executed (called by executor scheduled task after completing work)
    if (action === "execute-item") {
      var briefData3;
      try { briefData3 = await briefsStore.get(body.briefId, { type: "json" }); } catch (e) { briefData3 = null; }
      if (!briefData3) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Brief not found" }) };

      briefData3.items = briefData3.items.map(function(item) {
        if (item.id === body.itemId) {
          item.status = "executed";
          item.executedAt = new Date().toISOString();
          item.executionResult = body.executionResult || { action: "completed", details: "Executed by agent." };
        }
        return item;
      });
      await briefsStore.setJSON(body.briefId, briefData3);

      var actionLog3 = {
        id: generateId(),
        briefId: body.briefId,
        itemId: body.itemId,
        action: "executed",
        agent: briefData3.agent,
        executionResult: body.executionResult || {},
        timestamp: new Date().toISOString()
      };
      await actionsStore.setJSON(actionLog3.id, actionLog3);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // Deny action item
    if (action === "deny-item") {
      var briefData2;
      try { briefData2 = await briefsStore.get(body.briefId, { type: "json" }); } catch (e) { briefData2 = null; }
      if (!briefData2) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Brief not found" }) };

      briefData2.items = briefData2.items.map(function(item) {
        if (item.id === body.itemId) {
          item.status = "denied";
          item.deniedAt = new Date().toISOString();
          item.denyReason = body.reason || "";
        }
        return item;
      });
      await briefsStore.setJSON(body.briefId, briefData2);

      var actionLog2 = {
        id: generateId(),
        briefId: body.briefId,
        itemId: body.itemId,
        action: "denied",
        agent: briefData2.agent,
        reason: body.reason || "",
        timestamp: new Date().toISOString()
      };
      await actionsStore.setJSON(actionLog2.id, actionLog2);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // Update item description/data (for editing drafts)
    if (action === "update-item") {
      var briefDataU;
      try { briefDataU = await briefsStore.get(body.briefId, { type: "json" }); } catch (e) { briefDataU = null; }
      if (!briefDataU) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Brief not found" }) };

      briefDataU.items = briefDataU.items.map(function(item) {
        if (item.id === body.itemId) {
          if (body.description !== undefined) item.description = body.description;
          if (body.title !== undefined) item.title = body.title;
          if (body.data) {
            item.data = item.data || {};
            Object.keys(body.data).forEach(function(k) { item.data[k] = body.data[k]; });
          }
          item.editedAt = new Date().toISOString();
        }
        return item;
      });
      await briefsStore.setJSON(body.briefId, briefDataU);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // Update lead
    if (action === "update-lead") {
      var existingLead;
      try { existingLead = await leadsStore.get(body.leadId, { type: "json" }); } catch (e) { existingLead = null; }
      if (!existingLead) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Lead not found" }) };

      if (body.status) existingLead.status = body.status;
      if (body.notes !== undefined) existingLead.notes = body.notes;
      if (body.assignedAgent) existingLead.assignedAgent = body.assignedAgent;
      existingLead.updatedAt = new Date().toISOString();
      await leadsStore.setJSON(body.leadId, existingLead);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // Delete lead permanently (used for cleaning probes/test data and admin-driven removal)
    if (action === "delete-lead") {
      if (!body.leadId) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "leadId required" }) };

      var leadToDelete;
      try { leadToDelete = await leadsStore.get(body.leadId, { type: "json" }); } catch (e) { leadToDelete = null; }
      if (!leadToDelete) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Lead not found" }) };

      try { await leadsStore.delete(body.leadId); } catch (e) {
        return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Failed to delete lead", detail: e.message }) };
      }

      // Decrement counts in _stats so the dashboard stays honest
      var delStats;
      try { delStats = await leadsStore.get("_stats", { type: "json" }); } catch (e) { delStats = null; }
      if (delStats) {
        delStats.totalLeads = Math.max(0, (delStats.totalLeads || 0) - 1);
        if (leadToDelete.status === "new") delStats.newLeads = Math.max(0, (delStats.newLeads || 0) - 1);
        await leadsStore.setJSON("_stats", delStats);
      }

      // Audit log
      var delLog = {
        id: generateId(),
        leadId: body.leadId,
        leadName: leadToDelete.name || "",
        leadSource: leadToDelete.source || "",
        action: "lead-deleted",
        reason: body.reason || "",
        timestamp: new Date().toISOString()
      };
      await actionsStore.setJSON(delLog.id, delLog);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, deletedLeadId: body.leadId }) };
    }

    // Watcher claims an approved item — flips status to 'claimed'
    // Prevents another watcher (or duplicate poll) from picking it up.
    if (action === "claim-item") {
      var briefDataC;
      try { briefDataC = await briefsStore.get(body.briefId, { type: "json" }); } catch (e) { briefDataC = null; }
      if (!briefDataC) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Brief not found" }) };

      var claimed = false;
      briefDataC.items = briefDataC.items.map(function(item) {
        if (item.id === body.itemId && item.status === "approved") {
          item.status = "claimed";
          item.claimedAt = new Date().toISOString();
          item.claimedBy = body.claimedBy || "watcher";
          claimed = true;
        }
        return item;
      });

      if (!claimed) {
        return { statusCode: 409, headers: corsHeaders(), body: JSON.stringify({ ok: false, reason: "not approved or already claimed" }) };
      }
      await briefsStore.setJSON(body.briefId, briefDataC);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // Watcher reports failure on an item it tried to execute
    if (action === "fail-item") {
      var briefDataF;
      try { briefDataF = await briefsStore.get(body.briefId, { type: "json" }); } catch (e) { briefDataF = null; }
      if (!briefDataF) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Brief not found" }) };

      briefDataF.items = briefDataF.items.map(function(item) {
        if (item.id === body.itemId) {
          item.status = "failed";
          item.failedAt = new Date().toISOString();
          item.failureReason = body.reason || "Unknown error";
          item.failureLog = (body.log || "").slice(0, 4000);
        }
        return item;
      });
      await briefsStore.setJSON(body.briefId, briefDataF);

      var actionLogF = {
        id: generateId(),
        briefId: body.briefId,
        itemId: body.itemId,
        action: "failed",
        agent: briefDataF.agent,
        reason: body.reason || "",
        timestamp: new Date().toISOString()
      };
      await actionsStore.setJSON(actionLogF.id, actionLogF);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true }) };
    }

    // Watcher heartbeat — proves the cowork loop is alive.
    // Writes _heartbeat blob in agent-actions store with timestamp + version + active job (if any).
    if (action === "heartbeat") {
      var hb = {
        timestamp: new Date().toISOString(),
        version: body.version || "0.0.0",
        host: body.host || "unknown",
        activeJob: body.activeJob || null,
        recentJobs: body.recentJobs || [],
        watcherId: body.watcherId || "default"
      };
      await actionsStore.setJSON("_heartbeat", hb);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, serverTime: hb.timestamp }) };
    }

    // Sweep all briefs and auto-approve low-risk pending items
    if (action === "migrate-low-risk") {
      var allKeys = await briefsStore.list();
      var keys2 = allKeys.blobs ? allKeys.blobs : [];
      var updated = 0;
      for (var mi = 0; mi < keys2.length; mi++) {
        try {
          var mbr = await briefsStore.get(keys2[mi].key, { type: "json" });
          var changed = false;
          mbr.items = mbr.items.map(function(item) {
            if (item.status === "pending" && (item.priority === "low" || item.type === "insight")) {
              item.status = "approved";
              item.autoApproved = true;
              item.approvedAt = new Date().toISOString();
              item.approvalNote = "Auto-approved (low-risk)";
              changed = true;
              updated++;
            }
            return item;
          });
          if (changed) await briefsStore.setJSON(keys2[mi].key, mbr);
        } catch (e) {}
      }
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, updatedItems: updated }) };
    }

    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Unknown action" }) };
  }

  // GET actions
  if (event.httpMethod === "GET") {

    // Dashboard: today's briefs for all agents (falls back to most recent if today's not found)
    if (action === "dashboard") {
      var agents = ["rank", "growth", "pipeline", "press", "dev"];
      var today = todayKey();
      var dashboard = {};
      for (var i = 0; i < agents.length; i++) {
        var key = agents[i] + "_" + today;
        try {
          var b = await briefsStore.get(key, { type: "json" });
          dashboard[agents[i]] = b;
        } catch (e) {
          dashboard[agents[i]] = null;
        }
        // Fallback: if no brief for today, find the most recent one for this agent
        if (!dashboard[agents[i]]) {
          try {
            var allKeys = await briefsStore.list({ prefix: agents[i] + "_" });
            var agentKeys = allKeys.blobs ? allKeys.blobs.map(function(bl) { return bl.key; }).sort() : [];
            if (agentKeys.length > 0) {
              var latestKey = agentKeys[agentKeys.length - 1];
              var latestBrief = await briefsStore.get(latestKey, { type: "json" });
              dashboard[agents[i]] = latestBrief;
            }
          } catch (e2) {}
        }
      }

      // Get recent leads
      var leadsList = [];
      try {
        var allLeadKeys = await leadsStore.list();
        var leadKeys = allLeadKeys.blobs ? allLeadKeys.blobs.filter(function(b) { return b.key !== "_stats"; }) : [];
        // Get last 20 leads
        var recentKeys = leadKeys.slice(-20);
        for (var j = 0; j < recentKeys.length; j++) {
          try {
            var l = await leadsStore.get(recentKeys[j].key, { type: "json" });
            leadsList.push(l);
          } catch (e) {}
        }
      } catch (e) {}

      // Get stats
      var dashStats;
      try { dashStats = await leadsStore.get("_stats", { type: "json" }); } catch (e) { dashStats = { totalLeads: 0, newLeads: 0 }; }

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ agents: dashboard, leads: leadsList, stats: dashStats })
      };
    }

    // List briefs for an agent
    if (action === "list-briefs") {
      var agentFilter = params.agent || "";
      var limit = parseInt(params.limit) || 30;
      var allBriefs = [];
      try {
        var briefKeys = await briefsStore.list();
        var keys = briefKeys.blobs ? briefKeys.blobs : [];
        if (agentFilter) {
          keys = keys.filter(function(b) { return b.key.startsWith(agentFilter + "_"); });
        }
        keys = keys.slice(-limit);
        for (var k = 0; k < keys.length; k++) {
          try {
            var br = await briefsStore.get(keys[k].key, { type: "json" });
            allBriefs.push(br);
          } catch (e) {}
        }
      } catch (e) {}
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(allBriefs) };
    }

    // Get single brief
    if (action === "get-brief") {
      try {
        var brief3 = await briefsStore.get(params.id, { type: "json" });
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(brief3) };
      } catch (e) {
        return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Not found" }) };
      }
    }

    // List leads
    if (action === "list-leads") {
      var statusFilter = params.status || "";
      var leadLimit = parseInt(params.limit) || 50;
      var leads = [];
      try {
        var lk = await leadsStore.list();
        var lkeys = lk.blobs ? lk.blobs.filter(function(b) { return b.key !== "_stats"; }) : [];
        lkeys = lkeys.slice(-leadLimit);
        for (var m = 0; m < lkeys.length; m++) {
          try {
            var ld = await leadsStore.get(lkeys[m].key, { type: "json" });
            if (!statusFilter || ld.status === statusFilter) {
              leads.push(ld);
            }
          } catch (e) {}
        }
      } catch (e) {}
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(leads) };
    }

    // Get single lead
    if (action === "get-lead") {
      try {
        var lead2 = await leadsStore.get(params.id, { type: "json" });
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(lead2) };
      } catch (e) {
        return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Not found" }) };
      }
    }

    // Stats
    if (action === "stats") {
      var s;
      try { s = await leadsStore.get("_stats", { type: "json" }); } catch (e) { s = { totalLeads: 0, newLeads: 0 }; }

      // Count briefs per agent
      var briefCounts = {};
      try {
        var bk = await briefsStore.list();
        var bkeys = bk.blobs ? bk.blobs : [];
        bkeys.forEach(function(b) {
          var agent = b.key.split("_")[0];
          briefCounts[agent] = (briefCounts[agent] || 0) + 1;
        });
      } catch (e) {}

      // Count actions
      var actionCount = 0;
      try {
        var ak = await actionsStore.list();
        actionCount = ak.blobs ? ak.blobs.length : 0;
      } catch (e) {}

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ leads: s, briefs: briefCounts, totalActions: actionCount })
      };
    }

    // Execution manifest: returns all approved items across recent briefs for the watcher.
    // Includes the action contract so the watcher knows how to dispatch each item.
    if (action === "execution-manifest") {
      var manifestAgents = ["rank", "growth", "pipeline", "press", "dev"];
      var statusFilterEM = params.status || "approved"; // 'approved' (default) or 'claimed' for resuming
      var manifest = [];
      for (var m = 0; m < manifestAgents.length; m++) {
        try {
          var allAgentKeys = await briefsStore.list({ prefix: manifestAgents[m] + "_" });
          // Look at last 7 briefs per agent so older approved items aren't lost if a brief rolls over
          var sortedKeys = allAgentKeys.blobs ? allAgentKeys.blobs.map(function(bl) { return bl.key; }).sort() : [];
          var recentKeys = sortedKeys.slice(-7);
          for (var rk = 0; rk < recentKeys.length; rk++) {
            var briefKeyM = recentKeys[rk];
            var briefContent = await briefsStore.get(briefKeyM, { type: "json" });
            if (!briefContent || !briefContent.items) continue;
            var matching = briefContent.items.filter(function(item) { return item.status === statusFilterEM; });
            matching.forEach(function(item) {
              manifest.push({
                agent: manifestAgents[m],
                briefId: briefKeyM,
                itemId: item.id,
                title: item.title,
                description: item.description,
                type: item.type,
                priority: item.priority,
                approvedAt: item.approvedAt || null,
                claimedAt: item.claimedAt || null,
                contract: item.contract || null
              });
            });
          }
        } catch (e) {}
      }
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ manifest: manifest, count: manifest.length, timestamp: new Date().toISOString() })
      };
    }

    // Watcher status — last heartbeat (used by admin to show 'connected' indicator)
    if (action === "watcher-status") {
      var hbData;
      try { hbData = await actionsStore.get("_heartbeat", { type: "json" }); } catch (e) { hbData = null; }
      if (!hbData) {
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ connected: false, lastSeen: null }) };
      }
      var lastSeenMs = new Date(hbData.timestamp).getTime();
      var ageSec = Math.round((Date.now() - lastSeenMs) / 1000);
      var connected = ageSec < 90; // tolerate up to 90s gap (poll is 30s)
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({
          connected: connected,
          lastSeen: hbData.timestamp,
          ageSeconds: ageSec,
          version: hbData.version,
          host: hbData.host,
          activeJob: hbData.activeJob,
          recentJobs: hbData.recentJobs || [],
          lastError: hbData.lastError || null,
          uptimeSec: hbData.uptimeSec || null
        })
      };
    }

    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Unknown action" }) };
  }

  return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
};

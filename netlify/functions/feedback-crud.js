// Feedback system CRUD via Netlify Blobs
// Two stores: feedback-forms (configs), feedback-responses (submissions)
//
// GET ?action=list-forms — list all feedback form configs
// GET ?action=get-form&id=xxx — get single form config
// GET ?action=list-responses&formId=xxx — list responses for a form
// GET ?action=get-response&id=xxx — get single response
// POST action=create-form — create/update a feedback form config
// POST action=submit-response — submit a feedback response (public endpoint)
// POST action=delete-form — delete a form config
// POST action=delete-response — delete a response

var { getStore } = require("@netlify/blobs");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };
}

exports.handler = async function(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  var formsStore = getStore({ name: "feedback-forms", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  var responsesStore = getStore({ name: "feedback-responses", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  var caseStudiesStore = getStore({ name: "case-studies", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  try {
    // ===== GET =====
    if (event.httpMethod === "GET") {
      var action = event.queryStringParameters && event.queryStringParameters.action;

      // List all feedback forms
      if (action === "list-forms") {
        var index = [];
        try {
          var existing = await formsStore.get("_index", { type: "json" });
          if (existing) index = existing;
        } catch (e) { /* no index yet */ }
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(index) };
      }

      // Get single form config (by id OR by customSlug)
      if (action === "get-form") {
        var formId = event.queryStringParameters.id;
        var slug = event.queryStringParameters.slug;
        if (!formId && !slug) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing id or slug" }) };

        // Slug lookup: scan the index for a matching customSlug, then fetch by id
        if (!formId && slug) {
          var slugIndex = [];
          try {
            var existing = await formsStore.get("_index", { type: "json" });
            if (existing) slugIndex = existing;
          } catch (e) {}
          var match = slugIndex.find(function(f) { return f.customSlug && f.customSlug.toLowerCase() === slug.toLowerCase(); });
          if (!match) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "No form for slug '" + slug + "'" }) };
          formId = match.id;
        }

        var form = await formsStore.get(formId, { type: "json" });
        if (!form) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Form not found" }) };
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(form) };
      }

      // List responses for a form
      if (action === "list-responses") {
        var formId = event.queryStringParameters.formId;
        if (!formId) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing formId" }) };

        // Get responses index for this form
        var respIndex = [];
        try {
          var existing = await responsesStore.get("_index_" + formId, { type: "json" });
          if (existing) respIndex = existing;
        } catch (e) { /* no responses yet */ }
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(respIndex) };
      }

      // Get single response
      if (action === "get-response") {
        var respId = event.queryStringParameters.id;
        if (!respId) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing id" }) };
        var resp = await responsesStore.get(respId, { type: "json" });
        if (!resp) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Response not found" }) };
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(resp) };
      }

      // List case studies (drafts promoted from responses)
      if (action === "list-case-studies") {
        var csIndex = [];
        try {
          var existingCs = await caseStudiesStore.get("_index", { type: "json" });
          if (existingCs) csIndex = existingCs;
        } catch (e) {}
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(csIndex) };
      }

      // Get single case study
      if (action === "get-case-study") {
        var csId = event.queryStringParameters.id;
        if (!csId) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing id" }) };
        var cs = await caseStudiesStore.get(csId, { type: "json" });
        if (!cs) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Case study not found" }) };
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(cs) };
      }

      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Invalid action" }) };
    }

    // ===== POST =====
    if (event.httpMethod === "POST") {
      var data = JSON.parse(event.body);
      var action = data.action;

      // Create or update a feedback form config
      if (action === "create-form") {
        var formId = data.id || ("fb_" + Date.now().toString(36));
        var customSlug = (data.customSlug || "").toString().toLowerCase().replace(/[^a-z0-9-]/g, "").trim();

        // Validate slug uniqueness — if slug provided, ensure no other form has it
        if (customSlug) {
          var existingIdx = [];
          try {
            var ex0 = await formsStore.get("_index", { type: "json" });
            if (ex0) existingIdx = ex0;
          } catch (e) {}
          var conflict = existingIdx.find(function(f) {
            return f.customSlug && f.customSlug.toLowerCase() === customSlug && f.id !== formId;
          });
          if (conflict) {
            return {
              statusCode: 409,
              headers: corsHeaders(),
              body: JSON.stringify({ success: false, error: "Slug '" + customSlug + "' is already used by another form (" + (conflict.clientName || conflict.id) + ")." })
            };
          }
        }

        // formType — defaults to 'engagement' for backward compatibility with legacy forms
        var formType = (data.formType === "advisory") ? "advisory" : "engagement";
        // Advisory forms don't carry a promo — force off server-side regardless of what client sent.
        var givePromo = (formType === "engagement") && (data.givePromo === true || data.givePromo === "yes");
        var diagnosticType = (data.diagnosticType || "").toString().toUpperCase();
        if (diagnosticType !== "MAD" && diagnosticType !== "RVF") diagnosticType = "";
        var clientType = (data.clientType === "recurring") ? "recurring" : "new";

        // Advisory engagement types — whitelist to keep values consistent.
        // Accept the new multi-select array; fall back to legacy singular for backward-compat.
        var advisoryEngagementTypes = ["informal_mad_audit", "informal_rvf_audit", "brand_review", "positioning_consultation", "strategic_advice", "founder_coaching", "workshop_teach", "other"];
        var engagementTypes = [];
        if (formType === "advisory") {
          var rawTypes = Array.isArray(data.engagementTypes) ? data.engagementTypes : (data.engagementType ? [data.engagementType] : []);
          engagementTypes = rawTypes.filter(function(t) { return advisoryEngagementTypes.indexOf(t) !== -1; });
          // Dedupe while preserving order
          engagementTypes = engagementTypes.filter(function(t, i) { return engagementTypes.indexOf(t) === i; });
        }
        var engagementType = engagementTypes[0] || ""; // legacy single-value mirror
        var advisoryRelationships = ["friend", "peer", "mentor_mentee", "colleague", "referral", "other"];
        var relationship = (formType === "advisory" && advisoryRelationships.indexOf(data.relationship) !== -1) ? data.relationship : "";

        var formConfig = {
          id: formId,
          formType: formType,
          clientName: data.clientName || "",
          company: data.company || "",
          serviceAvailed: (formType === "engagement") ? (data.serviceAvailed || "") : "",
          engagementType: engagementType, // legacy single-value mirror for older readers
          engagementTypes: engagementTypes, // canonical multi-select array
          engagementContext: (formType === "advisory") ? (data.engagementContext || "") : "",
          relationship: relationship,
          industry: data.industry || "",
          logoUrl: data.logoUrl || "",
          primaryColor: data.primaryColor || "#1A2632",
          accentColor: data.accentColor || "#FDD500",
          useJNSQBranding: data.useJNSQBranding || false,
          givePromo: givePromo,
          diagnosticType: diagnosticType,
          promoCode: givePromo ? (data.promoCode || "") : "",
          promoMessage: data.promoMessage || "",
          clientType: clientType,
          customSlug: customSlug,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          responseCount: data.responseCount || 0
        };

        await formsStore.setJSON(formId, formConfig);

        // Update index
        var index = [];
        try {
          var existing = await formsStore.get("_index", { type: "json" });
          if (existing) index = existing;
        } catch (e) {}

        // Remove old entry if updating
        index = index.filter(function(f) { return f.id !== formId; });
        index.unshift({
          id: formId,
          formType: formConfig.formType,
          clientName: formConfig.clientName,
          company: formConfig.company,
          serviceAvailed: formConfig.serviceAvailed,
          engagementType: formConfig.engagementType,
          engagementTypes: formConfig.engagementTypes,
          useJNSQBranding: formConfig.useJNSQBranding,
          givePromo: formConfig.givePromo,
          diagnosticType: formConfig.diagnosticType,
          clientType: formConfig.clientType,
          customSlug: formConfig.customSlug,
          createdAt: formConfig.createdAt,
          updatedAt: formConfig.updatedAt,
          responseCount: formConfig.responseCount
        });

        await formsStore.setJSON("_index", index);

        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, form: formConfig }) };
      }

      // Submit a feedback response (public — no auth required)
      if (action === "submit-response") {
        var formId = data.formId;
        if (!formId) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing formId" }) };

        // formType defaults to 'engagement' for backward compatibility
        // with legacy client submissions that don't send it.
        var responseFormType = (data.formType === "advisory") ? "advisory" : "engagement";

        var responseId = formId + "_" + Date.now().toString(36);
        var response;
        if (responseFormType === "advisory") {
          response = {
            id: responseId,
            formId: formId,
            formType: "advisory",
            submittedAt: new Date().toISOString(),
            respondent: data.respondent || {},
            engagement: data.engagement || {},
            impact: data.impact || {},
            consent: data.consent || {},
            additionalComments: data.additionalComments || ""
          };
        } else {
          response = {
            id: responseId,
            formId: formId,
            formType: "engagement",
            submittedAt: new Date().toISOString(),
            ratings: data.ratings || {},
            answers: data.answers || {},
            referral: data.referral || {},
            consent: data.consent || {},
            respondent: data.respondent || {}
          };
        }

        await responsesStore.setJSON(responseId, response);

        // Update responses index for this form
        var respIndex = [];
        try {
          var existing = await responsesStore.get("_index_" + formId, { type: "json" });
          if (existing) respIndex = existing;
        } catch (e) {}

        respIndex.unshift({
          id: responseId,
          formId: formId,
          formType: responseFormType,
          submittedAt: response.submittedAt,
          respondentName: (response.respondent && response.respondent.name) || "Anonymous",
          overallRating: (response.ratings && response.ratings.overall) || null
        });

        await responsesStore.setJSON("_index_" + formId, respIndex);

        // Increment response count on form config
        try {
          var formConfig = await formsStore.get(formId, { type: "json" });
          if (formConfig) {
            formConfig.responseCount = (formConfig.responseCount || 0) + 1;
            formConfig.updatedAt = new Date().toISOString();
            await formsStore.setJSON(formId, formConfig);

            // Update form index too
            var formIndex = [];
            try {
              var idx = await formsStore.get("_index", { type: "json" });
              if (idx) formIndex = idx;
            } catch (e) {}
            formIndex = formIndex.map(function(f) {
              if (f.id === formId) {
                f.responseCount = formConfig.responseCount;
                f.updatedAt = formConfig.updatedAt;
              }
              return f;
            });
            await formsStore.setJSON("_index", formIndex);
          }
        } catch (e) { /* form config update failed, response still saved */ }

        // Auto-create CRM lead from referral data (if referral has name + email or company)
        // Advisory forms don't collect a referral block — skip this branch for them.
        var ref = (responseFormType === "engagement") ? (data.referral || {}) : {};
        if (ref.name && (ref.email || ref.company) && ref.introPreference !== 'not_now') {
          try {
            var https = require("https");
            var crmPayload = JSON.stringify({
              action: "create-contact",
              name: ref.name,
              email: ref.email || "",
              company: ref.company || "",
              industry: "",
              market: "",
              source: "referral",
              stage: "new",
              priority: ref.introPreference === "yes" ? "high" : "medium",
              notes: "Referral from feedback form (" + formId + "). Referred by: " + (data.respondent ? data.respondent.name || "Anonymous" : "Anonymous") + ". Position: " + (ref.position || "N/A") + ". Description: " + (ref.description || "N/A") + ". Intro preference: " + (ref.introPreference || "N/A") + ". Phone: " + (ref.phone || "N/A") + "."
            });
            var crmReq = https.request({
              hostname: "studiojnsq.com",
              path: "/.netlify/functions/crm-crud",
              method: "POST",
              headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(crmPayload) }
            }, function() {});
            crmReq.on("error", function() {});
            crmReq.write(crmPayload);
            crmReq.end();
          } catch (e) { /* CRM auto-create failed silently, feedback response still saved */ }
        }

        // Get promo code + diagnostic type from form config (engagement only — advisory has none).
        var promoCode = "";
        var diagnosticType = "";
        if (responseFormType === "engagement") {
          try {
            var fc = await formsStore.get(formId, { type: "json" });
            if (fc && fc.promoCode) promoCode = fc.promoCode;
            if (fc && fc.diagnosticType) diagnosticType = fc.diagnosticType;
          } catch (e) {}
        }

        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, responseId: responseId, formType: responseFormType, promoCode: promoCode, diagnosticType: diagnosticType }) };
      }

      // ── Generate auto-inferences from a response ──────────────────────────
      // The rule the case study must obey: results can only be measured against
      // the service that was AGREED. So inferences pit feedback against
      // serviceAvailed, score patterns, and word-level signals.
      function generateInferences(resp, form) {
        var ratingsObj = resp.ratings || {};
        var ratingKeys = ['strategic', 'content', 'responsive', 'value', 'overall'];
        var ratingLabels = {
          strategic: 'Strategic Value',
          content: 'Content Quality',
          responsive: 'Responsiveness',
          value: 'Value for Investment',
          overall: 'Overall Experience'
        };
        var nums = ratingKeys.map(function(k) { return parseFloat(ratingsObj[k]); }).filter(function(v) { return !isNaN(v); });
        var avg = nums.length ? (nums.reduce(function(a, b) { return a + b; }, 0) / nums.length) : null;

        // Strongest dimension + lift edge (renamed from "weakest" — JNSQ-native, forward-looking).
        // Only meaningful when there's a genuine gap. If all ratings tie, return a "uniform" signal instead.
        var sorted = ratingKeys
          .map(function(k) { return { key: k, label: ratingLabels[k], val: parseFloat(ratingsObj[k]) }; })
          .filter(function(x) { return !isNaN(x.val); })
          .sort(function(a, b) { return b.val - a.val; });

        var standout = null;        // strongest dimension (only when there's spread)
        var liftEdge = null;        // lowest dimension (only when there's spread)
        var uniform = false;        // true when all rated dimensions are tied
        var uniformValue = null;    // the shared value if uniform
        if (sorted.length === 1) {
          standout = sorted[0];
        } else if (sorted.length > 1) {
          var top = sorted[0].val;
          var bottom = sorted[sorted.length - 1].val;
          if (top === bottom) {
            uniform = true;
            uniformValue = top;
          } else {
            standout = sorted[0];
            liftEdge = sorted[sorted.length - 1];
          }
        }

        var serviceAvailed = (form && form.serviceAvailed) || "the agreed engagement";
        var clientType = form && form.clientType === "recurring" ? "recurring" : "first-time";

        var bullets = [];

        // 1. Score-pattern inference
        if (avg !== null) {
          var avgFmt = avg.toFixed(1);
          if (avg >= 4.5) {
            bullets.push("Average score of " + avgFmt + "/5 across all five dimensions indicates uniformly strong execution. The engagement (" + serviceAvailed + ") delivered without dropping a facet — this is the rare consistent-five pattern, not a single-dimension outlier.");
          } else if (avg >= 3.5) {
            bullets.push("Average score of " + avgFmt + "/5 indicates the engagement (" + serviceAvailed + ") delivered solid baseline value. Strength was concentrated in some dimensions, not uniform across all five — review the gap pattern below.");
          } else {
            bullets.push("Average score of " + avgFmt + "/5 indicates structural gaps in how this engagement (" + serviceAvailed + ") landed. Treat the case study draft cautiously and review what to highlight versus what to learn from.");
          }
        }

        // 2. Standout vs lift edge — only narrate when there's a real gap.
        if (uniform) {
          bullets.push("Uniform ratings (all " + uniformValue + "/5 across the five dimensions). There is no single standout or lift edge to lean on — the case study should lead with the engagement type itself and what made the work consistent across every dimension, not pick one to highlight.");
        } else if (standout && liftEdge) {
          var spread = standout.val - liftEdge.val;
          if (spread >= 2) {
            bullets.push("Significant spread: " + standout.label + " rated " + standout.val + " but " + liftEdge.label + " only " + liftEdge.val + " (gap of " + spread + " points). The story is not 'we did everything well' — it's 'we delivered hard on " + standout.label.toLowerCase() + " while " + liftEdge.label.toLowerCase() + " did not match'. Lead with the strength but acknowledge the lift edge honestly.");
          } else if (spread === 1) {
            bullets.push("Narrow spread: " + standout.label + " (" + standout.val + ") slightly outperformed " + liftEdge.label + " (" + liftEdge.val + "). The engagement was largely consistent — lead with the strength, the gap is small.");
          }
        }

        // 3. Service-vs-result framing — what the agreed service implies vs what feedback validates
        bullets.push("Measurement frame: this engagement was '" + serviceAvailed + "'. The case study should pit each claimed outcome against what that scope actually agreed to deliver. Avoid attributing outcomes the service was not designed to produce. The narrative below should ground each claim back to the original scope.");

        // 4. Recurring vs first-time framing
        if (clientType === "recurring") {
          bullets.push("Recurring client. This is not a 'first impression' case study — it is a 'continued trust' one. The narrative should reference the prior engagement(s) and show why they re-engaged, not just what one project delivered.");
        } else {
          bullets.push("First-time client. The case study works best as a 'before / during / after' arc — what they tried before, what changed when working with us, what is now true.");
        }

        // 5. Pull-quote candidates from longest-substantive answers
        var answers = resp.answers || {};
        var answerLabels = {
          before: 'Before the engagement',
          standout: 'What stood out',
          impact: 'Impact on the business',
          describe: 'Describing the experience',
          improve: 'What we could improve',
          gaps: 'Gaps in our approach',
          final: 'Final reflections'
        };
        var pullCandidates = [];
        Object.keys(answers).forEach(function(key) {
          var text = (answers[key] || "").trim();
          if (text.length >= 60) {
            // Pick the most quotable sentence — longest sentence under 200 chars
            var sentences = text.split(/(?<=[.!?])\s+/);
            var best = sentences.filter(function(s) { return s.length >= 40 && s.length <= 200; }).sort(function(a, b) { return b.length - a.length; })[0] || sentences[0];
            if (best) {
              pullCandidates.push({
                source: answerLabels[key] || key,
                text: best.trim(),
                fullAnswerLength: text.length
              });
            }
          }
        });

        // 6. Service-vs-results check: which answers actually reference scope deliverables?
        var lowerService = serviceAvailed.toLowerCase();
        var scopeWords = lowerService.split(/[\s,]+/).filter(function(w) { return w.length >= 4; });
        var scopeAttribution = [];
        Object.keys(answers).forEach(function(key) {
          var text = (answers[key] || "").toLowerCase();
          var matches = scopeWords.filter(function(w) { return text.indexOf(w) !== -1; });
          if (matches.length) {
            scopeAttribution.push({
              answer: answerLabels[key] || key,
              scopeTermsHit: matches
            });
          }
        });

        return {
          summary: bullets,
          standout: standout,
          liftEdge: liftEdge,
          uniform: uniform,
          uniformValue: uniformValue,
          // Legacy keys kept so older renderers don't break — but new ones above are canonical.
          strongest: standout,
          weakest: liftEdge,
          averageScore: avg,
          pullQuoteCandidates: pullCandidates,
          scopeAttribution: scopeAttribution,
          serviceAvailed: serviceAvailed,
          generatedAt: new Date().toISOString()
        };
      }

      // Promote a feedback response to a case study draft. Honors consent level.
      // - consent.use === 'named'     → full attribution preserved
      // - consent.use === 'anonymous' → strip identifying fields
      // - consent.use === 'no' OR missing → REJECTED (server-side guard, never trust client)
      if (action === "promote-to-case-study") {
        var responseId = data.responseId;
        if (!responseId) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing responseId" }) };

        var sourceResp = await responsesStore.get(responseId, { type: "json" });
        if (!sourceResp) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Source response not found" }) };

        var consentLevel = (sourceResp.consent && sourceResp.consent.use) ? sourceResp.consent.use : "no";
        if (consentLevel !== "named" && consentLevel !== "anonymous") {
          return {
            statusCode: 403,
            headers: corsHeaders(),
            body: JSON.stringify({ error: "Client did not consent to public use. Cannot promote to case study.", consent: consentLevel })
          };
        }

        // Hydrate form config so the case study has the engagement metadata
        var sourceForm = null;
        try { sourceForm = await formsStore.get(sourceResp.formId, { type: "json" }); } catch (e) {}

        var caseStudyId = "cs_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);
        var anonymized = consentLevel === "anonymous";

        // Generate inference scaffolding before saving
        var inferences = generateInferences(sourceResp, sourceForm);

        var caseStudy = {
          id: caseStudyId,
          status: "draft",
          consentLevel: consentLevel,
          anonymized: anonymized,
          // Source pointers (kept internally even when anonymized)
          source: {
            responseId: sourceResp.id,
            formId: sourceResp.formId,
            promotedAt: new Date().toISOString(),
            promotedBy: data.promotedBy || "admin"
          },
          // Engagement metadata.
          // Industry survives anonymization on purpose — readers need at least
          // a "this was an international bank" or "this was a luxury watch brand"
          // reference even when the specific name is hidden.
          engagement: {
            clientName: anonymized ? null : (sourceForm ? sourceForm.clientName : null),
            company: anonymized ? null : (sourceForm ? sourceForm.company : null),
            industry: (sourceForm && sourceForm.industry) ? sourceForm.industry : null,
            serviceAvailed: sourceForm ? sourceForm.serviceAvailed : null,
            engagementCompletedAt: sourceResp.submittedAt,
            clientType: sourceForm ? sourceForm.clientType : null
          },
          // Respondent (gated by consent)
          respondent: anonymized
            ? { name: null, email: null, role: (sourceResp.respondent && sourceResp.respondent.role) || null }
            : (sourceResp.respondent || {}),
          // Ratings always carry over (numeric, not identifying)
          ratings: sourceResp.ratings || {},
          // Pull-quotes — pre-extract longest/best answers as candidates (editor refines later)
          answers: sourceResp.answers || {},
          // Inferences — auto-generated reads of what the feedback actually shows.
          // Pitted against the service availed so claims stay grounded in the agreed scope.
          inferences: inferences,
          // Editor scaffolding (pre-filled with strongest pull-quote candidate as a starter)
          headline: "",
          subhead: "",
          pullQuotes: (inferences.pullQuoteCandidates || []).slice(0, 3).map(function(p) { return { text: p.text, source: p.source }; }),
          narrative: "",
          notes: data.notes || "",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        await caseStudiesStore.setJSON(caseStudyId, caseStudy);

        // Update case-studies index
        var csIndex = [];
        try {
          var existingCs2 = await caseStudiesStore.get("_index", { type: "json" });
          if (existingCs2) csIndex = existingCs2;
        } catch (e) {}
        csIndex.unshift({
          id: caseStudyId,
          status: "draft",
          consentLevel: consentLevel,
          anonymized: anonymized,
          clientName: anonymized ? "Anonymous" : (sourceForm ? sourceForm.clientName : "Unknown"),
          company: anonymized ? "(anonymized)" : (sourceForm ? sourceForm.company : null),
          industry: (sourceForm && sourceForm.industry) ? sourceForm.industry : null,
          serviceAvailed: sourceForm ? sourceForm.serviceAvailed : null,
          sourceResponseId: sourceResp.id,
          createdAt: caseStudy.createdAt
        });
        await caseStudiesStore.setJSON("_index", csIndex);

        // Mark the source response as promoted (so admin renders the badge + dedupes)
        try {
          sourceResp.promotedToCaseStudy = caseStudyId;
          sourceResp.promotedAt = caseStudy.source.promotedAt;
          await responsesStore.setJSON(responseId, sourceResp);
        } catch (e) {}

        return {
          statusCode: 200,
          headers: corsHeaders(),
          body: JSON.stringify({ success: true, caseStudyId: caseStudyId, anonymized: anonymized, consentLevel: consentLevel })
        };
      }

      // Regenerate inferences on an existing case study (re-runs the analysis
      // engine against the original feedback response + form).
      if (action === "regenerate-inferences") {
        var csId2 = data.id;
        if (!csId2) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing id" }) };
        var existing = await caseStudiesStore.get(csId2, { type: "json" });
        if (!existing) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Case study not found" }) };
        var srcResp = await responsesStore.get(existing.source && existing.source.responseId, { type: "json" });
        if (!srcResp) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Original response no longer exists. Cannot regenerate." }) };
        var srcForm = null;
        try { srcForm = await formsStore.get(srcResp.formId, { type: "json" }); } catch (e) {}
        var fresh = generateInferences(srcResp, srcForm);
        existing.inferences = fresh;
        // Refresh engagement metadata too — picks up newly-added industry on the form
        existing.engagement = existing.engagement || {};
        if (srcForm) {
          existing.engagement.industry = srcForm.industry || existing.engagement.industry || null;
          existing.engagement.serviceAvailed = srcForm.serviceAvailed || existing.engagement.serviceAvailed || null;
          existing.engagement.clientType = srcForm.clientType || existing.engagement.clientType || null;
          // Re-fill non-anonymized identity if consent allows and they're missing
          if (!existing.anonymized) {
            if (!existing.engagement.clientName) existing.engagement.clientName = srcForm.clientName || null;
            if (!existing.engagement.company) existing.engagement.company = srcForm.company || null;
          }
        }
        // Refresh ratings + answers in case the response was edited
        existing.ratings = srcResp.ratings || existing.ratings || {};
        existing.answers = srcResp.answers || existing.answers || {};
        // Refresh pull-quote candidates if user hasn't customized them yet
        if (!existing.pullQuotes || existing.pullQuotes.length === 0) {
          existing.pullQuotes = (fresh.pullQuoteCandidates || []).slice(0, 3).map(function(p) { return { text: p.text, source: p.source }; });
        }
        existing.updatedAt = new Date().toISOString();
        await caseStudiesStore.setJSON(csId2, existing);

        // Refresh index entry too (industry might have just been added on the form)
        try {
          var idxAll = await caseStudiesStore.get("_index", { type: "json" });
          if (idxAll) {
            idxAll = idxAll.map(function(it) {
              if (it.id === csId2) {
                it.industry = existing.engagement.industry;
                it.serviceAvailed = existing.engagement.serviceAvailed;
              }
              return it;
            });
            await caseStudiesStore.setJSON("_index", idxAll);
          }
        } catch (e) {}

        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, caseStudy: existing }) };
      }

      // Update a case study (editor saves headline/subhead/narrative/pullQuotes/notes/status)
      if (action === "update-case-study") {
        var csId3 = data.id;
        if (!csId3) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing id" }) };
        var existing2 = await caseStudiesStore.get(csId3, { type: "json" });
        if (!existing2) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Case study not found" }) };

        var editableFields = ["headline", "subhead", "narrative", "pullQuotes", "notes", "status"];
        editableFields.forEach(function(k) {
          if (Object.prototype.hasOwnProperty.call(data, k)) existing2[k] = data[k];
        });
        existing2.updatedAt = new Date().toISOString();
        await caseStudiesStore.setJSON(csId3, existing2);

        // Update index entry if status changed
        try {
          var idxAll2 = await caseStudiesStore.get("_index", { type: "json" });
          if (idxAll2) {
            idxAll2 = idxAll2.map(function(it) {
              if (it.id === csId3) it.status = existing2.status;
              return it;
            });
            await caseStudiesStore.setJSON("_index", idxAll2);
          }
        } catch (e) {}

        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, caseStudy: existing2 }) };
      }

      // Delete a form
      if (action === "delete-form") {
        var formId = data.id;
        if (!formId) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing id" }) };

        await formsStore.delete(formId);

        var index = [];
        try {
          var existing = await formsStore.get("_index", { type: "json" });
          if (existing) index = existing;
        } catch (e) {}
        index = index.filter(function(f) { return f.id !== formId; });
        await formsStore.setJSON("_index", index);

        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true }) };
      }

      // Delete a response
      if (action === "delete-response") {
        var respId = data.id;
        var formId = data.formId;
        if (!respId || !formId) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing id or formId" }) };

        await responsesStore.delete(respId);

        var respIndex = [];
        try {
          var existing = await responsesStore.get("_index_" + formId, { type: "json" });
          if (existing) respIndex = existing;
        } catch (e) {}
        respIndex = respIndex.filter(function(r) { return r.id !== respId; });
        await responsesStore.setJSON("_index_" + formId, respIndex);

        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true }) };
      }

      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Invalid action" }) };
    }

    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };

  } catch (err) {
    console.error("Feedback CRUD error:", err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: err.message }) };
  }
};

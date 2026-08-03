// Agent Execution Sweep — Netlify Scheduled Function
// Runs every 2 hours during business hours
// Checks for approved agent items and executes them based on risk level
//
// Low-risk items: auto-execute immediately
// High-risk items: create drafts for review (if review mode is on)
//                  or auto-execute (if review mode is off)

var { schedule } = require("@netlify/functions");
var { getStore } = require("@netlify/blobs");
var https = require("https");

function httpPost(url, payload) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(payload);
    var parsed = new URL(url);
    var options = { hostname: parsed.hostname, path: parsed.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
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

function internalGet(path) {
  return new Promise(function(resolve, reject) {
    https.get('https://studiojnsq.com' + path, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    }).on('error', reject);
  });
}

// Runs every 2 hours: at 00, 02, 04, 06, 08, 10, 12, 14, 16, 18, 20, 22 UTC
exports.handler = schedule("0 */2 * * *", async function(event) {
  var briefsStore = getStore({ name: "agent-briefs", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  // Get config (review mode settings)
  var config;
  try {
    config = await internalGet('/.netlify/functions/crm-crud?action=get-config');
  } catch (e) {
    config = { reviewMode: { press: true, pipeline: true }, senders: [] };
  }
  var reviewMode = config.reviewMode || {};

  // Get today's briefs for all agents
  var agents = ['rank', 'growth', 'pipeline', 'press', 'dev'];
  var today = new Date().toISOString().slice(0, 10);
  var executed = 0;
  var drafted = 0;
  var skipped = 0;

  for (var a = 0; a < agents.length; a++) {
    var agentKey = agents[a];
    var briefId = agentKey + '_' + today;

    var brief;
    try {
      brief = await briefsStore.get(briefId, { type: "json" });
    } catch (e) { continue; }

    if (!brief || !brief.items) continue;

    for (var i = 0; i < brief.items.length; i++) {
      var item = brief.items[i];

      // Only process approved items that haven't been executed
      if (item.status !== 'approved') { skipped++; continue; }
      if (item.executed) { skipped++; continue; }

      var risk = item.risk || (item.type === 'insight' ? 'low' : 'high');
      var agentReviewOn = reviewMode[agentKey] !== false;

      // Low-risk items: auto-execute
      if (risk === 'low') {
        // Log the execution
        try {
          await httpPost('https://studiojnsq.com/.netlify/functions/crm-crud', {
            action: 'log-activity',
            type: 'agent-execution',
            description: '[' + agentKey.toUpperCase() + '] Auto-executed: ' + item.title,
            agent: agentKey,
            data: { briefId: briefId, itemId: item.id, risk: 'low' }
          });
        } catch (e) {}

        // Mark as executed
        item.executed = true;
        item.executedAt = new Date().toISOString();
        item.executionType = 'auto';
        executed++;
      }

      // High-risk items with review mode ON: create draft
      else if (risk === 'high' && agentReviewOn) {
        if (item.data && item.data.contactId && item.data.heat) {
          // Pipeline outreach: create email draft
          try {
            var contact = await internalGet('/.netlify/functions/crm-crud?action=get-contact&id=' + item.data.contactId);
            if (contact && contact.email) {
              var senderList = config.senders || [];
              var defaultSender = senderList.length > 0 ? senderList[0].email : '';

              await httpPost('https://studiojnsq.com/.netlify/functions/crm-crud', {
                action: 'draft-email',
                contactId: item.data.contactId,
                sender: defaultSender,
                to: contact.email,
                subject: 'Your ' + (contact.diagnosticType || 'Brand').toUpperCase() + '™ Diagnostic Results — Studio JNSQ',
                emailBody: 'Hi ' + (contact.name || 'there') + ',\n\nI noticed you recently completed the ' + (contact.diagnosticType || 'brand').toUpperCase() + '™ diagnostic on our site. Your score of ' + (contact.diagnosticScore || 'N/A') + '% tells an interesting story.\n\nAt Studio JNSQ, we practice Brand Equity Architecture — the discipline of building the financial and reputational value your brand holds in the market. Based on your diagnostic results, there are specific structural areas we could help strengthen.\n\nWould you be open to a 30-minute conversation about what your results mean and what the path forward looks like?\n\nYou can book directly here: https://calendly.com/jerico-studio-jnsq/30min\n\nBest,\nStudio JNSQ',
                agent: 'pipeline'
              });
              drafted++;
            }
          } catch (e) {}

          item.executed = true;
          item.executedAt = new Date().toISOString();
          item.executionType = 'draft-created';
        }
        // LinkedIn repurpose: mark as ready for manual LinkedIn drafting from admin
        else if (item.data && item.data.format === 'linkedin-repurpose') {
          try {
            await httpPost('https://studiojnsq.com/.netlify/functions/crm-crud', {
              action: 'log-activity',
              type: 'linkedin-ready',
              description: '[PRESS] LinkedIn draft ready: ' + item.title + ' — Use "Draft to LinkedIn" button in Agent Hub.',
              agent: 'press',
              data: { briefId: briefId, itemId: item.id, format: 'linkedin-repurpose', blogSlug: item.data.blogSlug, blogTitle: item.data.blogTitle }
            });
          } catch (e) {}
          // Do NOT mark as executed — leave for manual "Draft to LinkedIn" button
          drafted++;
        }
        // Press editorial: log as draft needed
        else if (item.data && item.data.format) {
          try {
            await httpPost('https://studiojnsq.com/.netlify/functions/crm-crud', {
              action: 'log-activity',
              type: 'draft-needed',
              description: '[PRESS] Draft needed: ' + item.title,
              agent: 'press',
              data: { briefId: briefId, itemId: item.id, format: item.data.format }
            });
          } catch (e) {}
          item.executed = true;
          item.executedAt = new Date().toISOString();
          item.executionType = 'draft-queued';
          drafted++;
        }
        else {
          // Generic high-risk: log for manual review
          try {
            await httpPost('https://studiojnsq.com/.netlify/functions/crm-crud', {
              action: 'log-activity',
              type: 'manual-review',
              description: '[' + agentKey.toUpperCase() + '] Needs manual execution: ' + item.title,
              agent: agentKey,
              data: { briefId: briefId, itemId: item.id }
            });
          } catch (e) {}
          item.executed = true;
          item.executedAt = new Date().toISOString();
          item.executionType = 'manual-queued';
          drafted++;
        }
      }

      // High-risk with review mode OFF: auto-execute
      else if (risk === 'high' && !agentReviewOn) {
        try {
          await httpPost('https://studiojnsq.com/.netlify/functions/crm-crud', {
            action: 'log-activity',
            type: 'agent-execution',
            description: '[' + agentKey.toUpperCase() + '] Auto-executed (review off): ' + item.title,
            agent: agentKey,
            data: { briefId: briefId, itemId: item.id, risk: 'high' }
          });
        } catch (e) {}
        item.executed = true;
        item.executedAt = new Date().toISOString();
        item.executionType = 'auto-no-review';
        executed++;
      }
    }

    // Save updated brief
    await briefsStore.setJSON(briefId, brief);
  }

  // Also check yesterday's briefs for any approved items that weren't caught
  var yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  for (var b = 0; b < agents.length; b++) {
    var yBriefId = agents[b] + '_' + yesterday;
    try {
      var yBrief = await briefsStore.get(yBriefId, { type: "json" });
      if (yBrief && yBrief.items) {
        var changed = false;
        yBrief.items.forEach(function(item) {
          if (item.status === 'approved' && !item.executed) {
            item.executed = true;
            item.executedAt = new Date().toISOString();
            item.executionType = 'late-sweep';
            changed = true;
            executed++;
          }
        });
        if (changed) await briefsStore.setJSON(yBriefId, yBrief);
      }
    } catch (e) {}
  }

  console.log('Sweep complete: ' + executed + ' executed, ' + drafted + ' drafted, ' + skipped + ' skipped');
  return { statusCode: 200 };
});

// exports.handler assigned above via schedule()

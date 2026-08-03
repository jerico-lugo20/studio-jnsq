// Agent Pipeline (Sales) — Netlify Scheduled Function
// Runs daily at 6:00 AM UTC+8 (22:00 UTC previous day)
// Processes new leads, scores them, recommends outreach

var { schedule } = require("@netlify/functions");
var https = require("https");
var helpers = require("./_agent-helpers");
var structuredItem = helpers.structuredItem;
var manualContract = helpers.manualContract;

function httpPost(url, payload) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(payload);
    var parsed = new URL(url);
    var options = { hostname: parsed.hostname, path: parsed.pathname + (parsed.search || ''), method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
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

async function runPipelineScan() {
  var today = new Date().toISOString().slice(0, 10);
  var items = [];
  var metrics = { newLeads: 0, hotLeads: 0, warmLeads: 0, coldLeads: 0, totalPipeline: 0 };

  try {
    // Get CRM contacts
    var crmData = await internalGet('/.netlify/functions/crm-crud?action=list-contacts&limit=200');
    var contacts = crmData.contacts || [];
    metrics.totalPipeline = contacts.length;

    // Find new contacts that need processing
    var newContacts = contacts.filter(function(c) { return c.stage === 'new'; });
    metrics.newLeads = newContacts.length;

    if (newContacts.length === 0) {
      items.push(structuredItem({
        type: 'insight',
        title: 'No new leads to process',
        issue: 'Pipeline has ' + contacts.length + ' total contacts and no new ones since last check.',
        evidence: { source: 'CRM (stage=new)', count: 0, snippets: ['Total in pipeline: ' + contacts.length] },
        fix: 'No action. Check back tomorrow. Consider whether outbound channels are seeding the pipeline at the desired rate.',
        priority: 'low',
        risk: 'low'
      }));
    }

    // Score and categorize each new lead
    for (var i = 0; i < newContacts.length; i++) {
      var c = newContacts[i];
      var score = c.diagnosticScore || 0;
      var hasEmail = c.email && c.email.indexOf('@') > 0;
      var hasCompany = c.company && c.company.length > 1;

      // Scoring logic
      var heat = 'cold';
      if (score > 0 && score < 50 && hasEmail) heat = 'hot';
      else if (score > 0 && score < 70 && hasEmail) heat = 'warm';
      else if (hasEmail && hasCompany) heat = 'warm';

      if (heat === 'hot') metrics.hotLeads++;
      else if (heat === 'warm') metrics.warmLeads++;
      else metrics.coldLeads++;

      // Build dossier and action item for hot/warm leads
      if (heat === 'hot' || heat === 'warm') {
        var diagInfo = c.diagnosticType ? c.diagnosticType.toUpperCase() + '™ score: ' + (score || 'N/A') + '%' : 'No diagnostic taken';
        var dossier = 'Contact: ' + (c.name || 'Unknown') + '\n';
        dossier += 'Company: ' + (c.company || 'Unknown') + '\n';
        dossier += 'Industry: ' + (c.industry || 'Unknown') + '\n';
        dossier += 'Market: ' + (c.market || 'Unknown') + '\n';
        dossier += 'Diagnostic: ' + diagInfo + '\n';
        dossier += 'Source: ' + (c.source || 'Unknown') + '\n';

        if (score && score < 50) {
          dossier += '\nHigh-pain signal: Score below 50% indicates significant structural weakness. This prospect likely feels the problem acutely.';
        }

        var talkingPoints = '';
        if (c.diagnosticType === 'mad' || c.diagnosticType === 'MAD') {
          talkingPoints = 'Reference their MAD™ score. Discuss the facet(s) dragging the diamond down. Frame the conversation around brand equity as a financial asset, not a marketing exercise.';
        } else if (c.diagnosticType === 'rvf' || c.diagnosticType === 'RVF') {
          talkingPoints = 'Reference their RVF™ score. Discuss which trade equation is misaligned. Frame around resource allocation efficiency and the cost of staying in the current trade.';
        }

        items.push(structuredItem({
          type: 'action',
          title: (heat === 'hot' ? 'HOT' : 'WARM') + ': Reach out to ' + (c.name || c.company || c.email),
          issue: 'New ' + heat + ' lead in the pipeline. Diagnostic + contact data suggests they\'re a fit for outreach.',
          evidence: {
            source: 'CRM contact ' + (c.id || ''),
            count: heat,
            snippets: [
              'Contact: ' + (c.name || 'Unknown') + '  •  Company: ' + (c.company || 'Unknown'),
              'Industry: ' + (c.industry || 'Unknown') + '  •  Market: ' + (c.market || 'Unknown'),
              'Diagnostic: ' + diagInfo,
              'Source: ' + (c.source || 'Unknown')
            ].concat(score && score < 50 ? ['High-pain signal: score below 50% — they likely feel the problem acutely'] : [])
          },
          fix: 'Talking points: ' + talkingPoints + '\n\nRecommended: ' + (hasEmail ? 'Send personalized email introducing Studio JNSQ\'s brand equity architecture services.' : 'Research contact further to find email.'),
          doctrineRef: 'CLAUDE.md: Doctrine: Brand Equity Architecture',
          priority: heat === 'hot' ? 'high' : 'medium',
          risk: 'high',
          data: { contactId: c.id, heat: heat, score: score, diagnosticType: c.diagnosticType }
        }));

        // Update contact stage to researched
        try {
          await httpPost('https://studiojnsq.com/.netlify/functions/crm-crud', {
            action: 'move-stage',
            id: c.id,
            stage: 'researched',
            agent: 'pipeline'
          });
          // Update dossier
          await httpPost('https://studiojnsq.com/.netlify/functions/crm-crud', {
            action: 'update-contact',
            id: c.id,
            dossier: dossier,
            priority: heat === 'hot' ? 'high' : 'medium'
          });
        } catch (ue) {}
      }
    }

    // Pipeline health summary
    var byStage = {};
    contacts.forEach(function(c) { byStage[c.stage] = (byStage[c.stage] || 0) + 1; });
    items.push(structuredItem({
      type: 'insight',
      title: 'Pipeline health: ' + contacts.length + ' total contacts',
      issue: 'Snapshot of stage distribution.',
      evidence: {
        source: 'CRM contacts',
        count: contacts.length,
        snippets: Object.keys(byStage).map(function(s) { return s + ': ' + byStage[s]; })
      },
      fix: 'No action if numbers look healthy. If a stage is empty for >7 days, surface the bottleneck.',
      priority: 'low',
      risk: 'low'
    }));

  } catch (err) {
    items.push(structuredItem({
      type: 'alert',
      title: 'Pipeline agent error',
      issue: 'The pipeline agent threw an error during scan.',
      evidence: { source: 'agent-pipeline', snippets: [err.message] },
      fix: 'Check Netlify function logs. Likely a transient API or data shape issue.',
      priority: 'high', risk: 'low',
      contract: manualContract('Pipeline agent error')
    }));
  }

  var summary = metrics.newLeads + ' new leads processed. ' + metrics.hotLeads + ' hot, ' + metrics.warmLeads + ' warm, ' + metrics.coldLeads + ' cold. ' + metrics.totalPipeline + ' total in pipeline.';

  await httpPost('https://studiojnsq.com/.netlify/functions/agent-hub', {
    action: 'submit-brief',
    agent: 'pipeline',
    title: 'Daily Pipeline Brief — ' + today,
    summary: summary,
    items: items,
    metrics: metrics
  });

  return { ok: true, items: items.length, summary: summary, metrics: metrics };
}

exports.handler = schedule("0 22 * * *", async function(event) {
  try { await runPipelineScan(); } catch (e) { console.error('agent-pipeline scheduled run failed:', e); }
  return { statusCode: 200 };
});

exports.runScan = runPipelineScan;

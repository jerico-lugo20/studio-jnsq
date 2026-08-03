// Shared helpers for all JNSQ scheduled agents.
// Keeps the structured-item shape consistent: every brief item carries
// issue / evidence / fix / doctrineRef so the admin can render it cleanly
// without "what does this mean" gaps.

// Build a structured item. Falls back gracefully if some fields are omitted.
function structuredItem(opts) {
  return {
    type: opts.type || 'action',
    title: opts.title || '',
    issue: opts.issue || '',
    evidence: opts.evidence || null,
    fix: opts.fix || '',
    doctrineRef: opts.doctrineRef || null,
    description: opts.description || (opts.issue || '') + (opts.fix ? '\n\nFix: ' + opts.fix : ''),
    priority: opts.priority || 'medium',
    risk: opts.risk || 'low',
    data: opts.data || {},
    contract: opts.contract || null,
  };
}

// Extract up to N snippets of context around regex matches in HTML body text.
// Strips script/style + tags so the snippet is plain text. Marks the matched
// substring with «...» so the renderer can highlight it.
function evidenceFromRegex(html, regex, contextChars, maxSnippets) {
  contextChars = contextChars || 80;
  maxSnippets = maxSnippets || 3;
  var clean = (html || '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  var rx = new RegExp(regex.source, regex.flags.indexOf('g') === -1 ? regex.flags + 'g' : regex.flags);
  var snippets = [];
  var m;
  var safety = 0;
  while ((m = rx.exec(clean)) !== null && safety++ < 50) {
    var start = Math.max(0, m.index - contextChars);
    var end = Math.min(clean.length, m.index + m[0].length + contextChars);
    var raw = clean.slice(start, end).replace(/\s+/g, ' ').trim();
    var stripped = raw.replace(/<[^>]+>/g, '');
    var marked = stripped.replace(m[0], '«' + m[0] + '»');
    snippets.push((start > 0 ? '…' : '') + marked + (end < clean.length ? '…' : ''));
    if (snippets.length >= maxSnippets) break;
  }
  return snippets;
}

// Standard contracts for agents that emit work for the cowork-watcher.
var DEPLOY_DIR =
  process.env.JNSQ_DEPLOY_DIR ||
  "/Users/jericolugo/Library/Mobile Documents/com~apple~CloudDocs/Important files/JCL/JNSQ Media Consultancy Services/JNSQ Suite/outputs/studio-jnsq-deploy";

function manualContract(reason) {
  return { kind: 'manual', reason: reason || 'Needs human review', workingDir: DEPLOY_DIR, prompt: '', timeout: 0, autoDeploy: false, tags: ['manual'] };
}

function autoContract(opts) {
  return {
    kind: 'auto',
    skill: opts.skill || null,
    workingDir: opts.workingDir || DEPLOY_DIR,
    prompt: opts.prompt || '',
    timeout: opts.timeout || 900,
    autoDeploy: opts.autoDeploy || false,
    tags: opts.tags || ['site-fix'],
  };
}

module.exports = {
  structuredItem: structuredItem,
  evidenceFromRegex: evidenceFromRegex,
  manualContract: manualContract,
  autoContract: autoContract,
  DEPLOY_DIR: DEPLOY_DIR,
};

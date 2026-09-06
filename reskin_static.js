#!/usr/bin/env node
// ============================================================
// STATIC PAGE MIGRATION (6 September 2026)
// Applies the rebrand's design language to the static pages that
// still carried the old shell: portfolio case studies, diagnostic
// info pages, about, founder, archetypes. Same skin as the insights
// renderer, plus a token remap for jnsq-system pages. Logic, forms
// and the diagnostic app itself are untouched.
// Run once from the repo root: node reskin_static.js
// ============================================================
var fs = require('fs');
var Skin = require('./netlify/functions/insights-skin.js');

// Pull the shared pieces out of the skin module's source so there is
// exactly one place the design tokens live.
var src = fs.readFileSync('./netlify/functions/insights-skin.js', 'utf8');
function grab(name) {
  var m = src.match(new RegExp('var ' + name + ' = ([\\s\\S]*?);\\n\\nvar |var ' + name + ' = ([\\s\\S]*?);\\n\\nfunction '));
  return null; // not used; we rebuild via the module below
}

// Rebuild the shell pieces by running the module's reskin() against a stub,
// then extracting what it injected.
var stub = '<html><head></head><body><nav class="jnsq-nav">x</nav><footer class="jnsq-footer">x</footer></body></html>';
var skinned = Skin.reskin(stub);
var NEW_NAV = skinned.match(/<header class="njq-head">[\s\S]*?<\/header>/)[0];
var NEW_FOOTER = skinned.match(/<footer class="njq-foot">[\s\S]*?<\/footer>/)[0];
var HEAD_INJECT = skinned.match(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=IBM[\s\S]*?<\/style>/)[0];

// Extra rules for jnsq-system static pages: retint the base tokens and
// swap the faces, including inline font-family styles.
var STATIC_CSS = [
'<style id="static-migration">',
':root{',
'  --jnsq-bg:#FDFBF3; --jnsq-ink:#26231A; --jnsq-ink-soft:#2D3748; --jnsq-body:#514C40;',
'  --jnsq-mute:#948D7C; --jnsq-line:#EAE3D0; --jnsq-line-soft:#F1EAD8; --jnsq-paper:#FFFDF4;',
'}',
"[style*=\"Lora\"]{font-family:'Newsreader',Georgia,serif!important;}",
"[style*=\"Inter\"]{font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,sans-serif!important;}",
"body{font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,sans-serif!important;background:#FDFBF3!important;}",
"h1,h2,h3,h4,.jnsq-display-1,.jnsq-display-2,.jnsq-h1,.jnsq-h2,.cs-client,.cs-headline{font-family:'Newsreader',Georgia,serif!important;font-weight:500!important;color:#26231A!important;letter-spacing:0!important;}",
".jnsq-eyebrow,.jnsq-small,.cs-eyebrow,.cs-industry,.cs-meta-item,.cs-tag-row,.section-label{font-family:'IBM Plex Mono',ui-monospace,monospace!important;letter-spacing:.14em!important;}",
".jnsq-lead{color:#514C40!important;}",
".cs-card,.jnsq-card,.fw-card,.facet-tile,.stall-card,.stall-trio{border-radius:0!important;box-shadow:none!important;border-color:#EAE3D0!important;}",
".cs-card{background:#FFFDF4!important;}",
".jnsq-btn,.jnsq-btn-primary,.jnsq-btn-ghost,.jnsq-nav-cta,.cs-btn{border-radius:2px!important;font-family:'IBM Plex Sans',sans-serif!important;font-weight:600!important;letter-spacing:.02em!important;text-transform:none!important;box-shadow:none!important;}",
'</style>'
].join('\n');

var PAGES = [
  { f: 'about.html', on: 'Our story' },
  { f: 'founder.html', on: 'Our story' },
  { f: 'archetypes.html', on: 'Diagnostic' },
  { f: 'diagnostic.html', on: 'Diagnostic' },
  { f: 'diagnostic-mad.html', on: 'Diagnostic' },
  { f: 'diagnostic-rvf.html', on: 'Diagnostic' }
];
fs.readdirSync('case-studies').forEach(function (f) {
  if (f.slice(-5) === '.html') PAGES.push({ f: 'case-studies/' + f, on: 'Portfolio' });
});

PAGES.forEach(function (p) {
  var s = fs.readFileSync(p.f, 'utf8');
  var before = s.length;

  // shell
  var nav = NEW_NAV.replace('class="on" href="/insights"', 'href="/insights"');
  var onMap = { 'Portfolio': '/#/portfolio', 'Diagnostic': '/#/diagnostic', 'Our story': '/#/our-story' };
  if (onMap[p.on]) nav = nav.replace('href="' + onMap[p.on] + '"', 'class="on" href="' + onMap[p.on] + '"');
  s = s.replace(/<nav class="jnsq-nav">[\s\S]*?<\/nav>/, nav);
  s = s.replace(/<footer class="jnsq-footer">[\s\S]*?<\/footer>/, NEW_FOOTER);

  // language: journal -> insights, case studies label -> portfolio, booking -> email
  s = s.replace(/(["'(])\/journal(\/|["')?#])/g, '$1/insights$2');
  s = s.replace(/>Case Studies</g, '>Portfolio<');
  s = s.replace(/https:\/\/calendly\.com\/jerico-studio-jnsq\/30min/g,
    'mailto:strategy@studiojnsq.com?subject=Book%20a%20call%20with%20a%20strategist');

  // head injection
  s = s.replace('</head>', HEAD_INJECT + '\n' + STATIC_CSS + '\n</head>');

  fs.writeFileSync(p.f, s);
  console.log(p.f, 'migrated,', Math.round((s.length - before) / 1024), 'KB added');
});
console.log('done:', PAGES.length, 'pages');

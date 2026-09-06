#!/usr/bin/env node
// ============================================================
// DIAGNOSTIC APP MIGRATION (6 September 2026)
// Puts app.html into the rebrand's design language. Purely visual:
// the shell (nav, footer), the tokens and the faces. Scoring, gating,
// tier logic, promo codes, retrieval, PDF generation and the portal
// are untouched, and no script in the file is modified.
// Run once from the repo root: node reskin_app.js
// ============================================================
var fs = require('fs');
var Skin = require('./netlify/functions/insights-skin.js');

var stub = '<html><head></head><body><nav class="jnsq-nav">x</nav><footer class="jnsq-footer">x</footer></body></html>';
var skinned = Skin.reskin(stub);
var NEW_NAV = skinned.match(/<header class="njq-head">[\s\S]*?<\/header>/)[0]
  .replace('class="on" href="/insights"', 'href="/insights"')
  .replace('href="/#/diagnostic"', 'class="on" href="/#/diagnostic"');
var NEW_FOOTER = skinned.match(/<footer class="njq-foot">[\s\S]*?<\/footer>/)[0];
var HEAD_INJECT = skinned.match(/<link href="https:\/\/fonts\.googleapis\.com\/css2\?family=IBM[\s\S]*?<\/style>/)[0];

// The app has its own dense token set and hundreds of inline styles.
// Retint the tokens, swap the faces, and flatten the chrome.
var APP_CSS = [
'<style id="app-migration">',
':root{',
'  --jnsq-bg:#FDFBF3; --jnsq-ink:#26231A; --jnsq-ink-soft:#2D3748; --jnsq-body:#514C40;',
'  --jnsq-mute:#948D7C; --jnsq-line:#EAE3D0; --jnsq-line-soft:#F1EAD8; --jnsq-paper:#FFFDF4;',
'  --yellow:#FDD500; --dark:#26231A; --steel:#514C40; --mid:#948D7C; --light:#FFFAE8;',
'  --cream:#FFFAE8; --paper:#FFFDF4;',
'}',
"body{background:#FDFBF3!important;font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,sans-serif!important;color:#514C40;}",
"[style*=\"Lora\"]{font-family:'Newsreader',Georgia,serif!important;}",
"[style*=\"Inter\"]{font-family:'IBM Plex Sans',-apple-system,BlinkMacSystemFont,sans-serif!important;}",
"h1,h2,h3,h4,.prem-q-title,.section-heading,.tier-name,.jhh-title,.statement,.prem-result-title{",
"  font-family:'Newsreader',Georgia,serif!important;font-weight:500!important;color:#26231A!important;letter-spacing:0!important;}",
".section-label,.prem-progress-label,.gate-tier div:first-child,.tier-label,.label,.jnsq-eyebrow{",
"  font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace!important;letter-spacing:.16em!important;}",
'',
'/* flatten the chrome: square corners, hairline borders, no heavy shadows */',
'.prem-question,.gate-tier,.intake-field input,.intake-field select,.intake-field textarea,',
'.card,.service-tier,.fw-card,.prem-card,.contact-gate,.pm-card,.dash-card{',
'  border-radius:2px!important;box-shadow:none!important;}',
'.prem-rating label{border-radius:2px!important;}',
'.btn-primary,.btn-secondary,.gate-btn,.prem-btn,.intake-submit,.pm-btn,.jnsq-btn{',
"  border-radius:2px!important;font-family:'IBM Plex Sans',sans-serif!important;font-weight:600!important;",
'  letter-spacing:.02em!important;text-transform:none!important;box-shadow:none!important;}',
'',
'/* the gate sits on ink; keep it legible against the new palette */',
'.contact-gate{background:#26231A!important;border:1px solid #26231A!important;}',
'.gate-tier{border-radius:2px!important;}',
'.gate-tier.selected{border-color:#FDD500!important;}',
'</style>'
].join('\n');

var s = fs.readFileSync('app.html', 'utf8');
var before = s.length;

// shell swap: the app's own nav block and the shared footer
s = s.replace(/<nav id="mainNav">[\s\S]*?<\/nav>/, NEW_NAV);
s = s.replace(/<footer class="jnsq-footer">[\s\S]*?<\/footer>/, NEW_FOOTER);

// language: journal to insights, case studies to portfolio, booking to email
s = s.replace(/(["'(])\/journal(\/|["')?#])/g, '$1/insights$2');
s = s.replace(/>Case Studies</g, '>Portfolio<');
s = s.replace(/https:\/\/calendly\.com\/jerico-studio-jnsq\/30min/g,
  'mailto:strategy@studiojnsq.com?subject=Book%20a%20call%20with%20a%20strategist');

s = s.replace('</head>', HEAD_INJECT + '\n' + APP_CSS + '\n</head>');

fs.writeFileSync('app.html', s);
console.log('app.html migrated,', Math.round((s.length - before) / 1024), 'KB added');

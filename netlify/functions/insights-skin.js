// ============================================================
// INSIGHTS SKIN (6 September 2026)
// Adapts the server-rendered article pages to the rebranded design
// language: Newsreader and IBM Plex, the cream and hairline palette,
// the new header and footer. The article mechanics (rail, TOC, FAQ,
// series nav, related pieces) are untouched; only the visual layer
// and the shell change. Applied by render-blog-post.js on output.
// ============================================================

var NEW_FONTS = '<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&display=swap" rel="stylesheet">\n';

var NEW_NAV = [
'<header class="njq-head">',
'  <div class="njq-head-in">',
'    <a class="njq-lock" href="/"><span class="name">STUDIO JNSQ</span><span class="disc">Brand Equity Architecture</span></a>',
'    <nav class="njq-nav">',
'      <a href="/">Home</a>',
'      <a href="/#/services">Services</a>',
'      <a href="/#/investment-readiness">Investment readiness</a>',
'      <a href="/#/portfolio">Portfolio</a>',
'      <a href="/#/frameworks">Frameworks</a>',
'      <a class="on" href="/insights">Insights</a>',
'      <a href="/#/diagnostic">Diagnostic</a>',
'      <a href="/#/our-story">Our story</a>',
'    </nav>',
'  </div>',
'</header>'
].join('\n');

var NEW_FOOTER = [
'<footer class="njq-foot">',
'  <div class="njq-foot-in">',
'    <div class="njq-foot-brand">',
'      <span class="name">STUDIO JNSQ</span><span class="disc">Brand Equity Architecture</span>',
'      <p class="pos">The brand equity architecture firm for valuable brands.</p>',
'      <p class="geo">Manila, working across APAC. Engagements also taken in the Gulf and the United Kingdom; pricing varies there.</p>',
'    </div>',
'    <div class="njq-foot-cols">',
'      <div><p class="lbl">Discipline</p><a href="/#/our-story">Our story</a><a href="/#/frameworks">Frameworks</a><a href="/insights">Insights</a></div>',
'      <div><p class="lbl">Work</p><a href="/#/portfolio">Portfolio</a><a href="/#/services">Services</a><a href="/#/investment-readiness">Investment readiness</a></div>',
'      <div><p class="lbl">Start</p><a href="/#/diagnostic">Take a diagnostic</a><a href="mailto:strategy@studiojnsq.com?subject=Book%20a%20call%20with%20a%20strategist">Book a call</a><a href="/portal">Strategist portal</a></div>',
'    </div>',
'  </div>',
'  <div class="njq-foot-base">&copy; 2026 Studio JNSQ. Expertise that moves markets, made visible.</div>',
'</footer>'
].join('\n');

var SKIN_CSS = [
'<style id="insights-skin">',
':root{',
'  --njq-yellow:#FDD500; --njq-yellow-deep:#A8850A; --njq-ink:#2D3748; --njq-ink-deep:#26231A;',
'  --njq-body:#514C40; --njq-grey:#948D7C; --njq-hair:#EAE3D0; --njq-cream:#FFFAE8; --njq-page:#FDFBF3;',
'  --njq-serif:\'Newsreader\',Georgia,serif; --njq-sans:\'IBM Plex Sans\',-apple-system,BlinkMacSystemFont,sans-serif;',
'  --njq-mono:\'IBM Plex Mono\',ui-monospace,Menlo,monospace;',
'}',
'body{background:var(--njq-page)!important;color:var(--njq-body)!important;font-family:var(--njq-sans)!important;}',
'',
'/* ---- type ---- */',
'h1,h2,h3,h4,.article-title,.ph-title,.r-title,.faq-inner h2,.go-deeper-inner h2,.related-inner h2,.tags-inner h2{',
'  font-family:var(--njq-serif)!important;font-weight:500!important;color:var(--njq-ink-deep)!important;letter-spacing:0!important;}',
'.article-title{line-height:1.12!important;}',
'.article-excerpt,.lead-italic{font-family:var(--njq-serif)!important;font-style:italic;color:var(--njq-yellow-deep)!important;}',
'.breadcrumb,.breadcrumb a,.label,.aside-label,.article-meta,.article-kicker,.series-chip,.series-tag,.tag-pill,.attribution,.direction,.num,.go-deeper-intro,.promo-callout-eyebrow{',
'  font-family:var(--njq-mono)!important;letter-spacing:.14em!important;text-transform:uppercase;color:var(--njq-grey)!important;}',
'.breadcrumb a:hover{color:var(--njq-ink-deep)!important;}',
'.series-chip,.series-tag{color:var(--njq-yellow-deep)!important;background:transparent!important;border:1px solid var(--njq-hair)!important;border-radius:2px!important;}',
'.article-meta strong{color:var(--njq-ink)!important;}',
'',
'/* ---- article body ---- */',
'.canon-body p,.canon-body li{font-size:16.5px;line-height:1.78;color:var(--njq-body)!important;font-family:var(--njq-sans)!important;}',
'.canon-body h2{font-size:1.7rem;margin-top:2.2em;}',
'.canon-body h3{font-size:1.25rem;}',
'.canon-body a,.inline-link{color:var(--njq-ink-deep)!important;text-decoration:underline!important;text-decoration-color:var(--njq-yellow)!important;text-decoration-thickness:2px!important;text-underline-offset:3px!important;}',
'.canon-body blockquote,.pull-quote{font-family:var(--njq-serif)!important;font-style:italic;color:var(--njq-ink-deep)!important;background:var(--njq-cream)!important;border-left:3px solid var(--njq-yellow)!important;border-radius:0!important;box-shadow:none!important;}',
'.hero-img-frame,.hero-img-frame img,.hero-stack-img img{border-radius:0!important;border:1px solid var(--njq-hair)!important;box-shadow:none!important;}',
'',
'/* ---- cards, rails, sections ---- */',
'.aside-card,.deeper-card,.related-card,.series-nav-card,.what-this-means,.try-this,.next-edition,.faq-grid>*,.engage-card,.media-card{',
'  background:#FFFDF4!important;border:1px solid var(--njq-hair)!important;border-radius:0!important;box-shadow:none!important;}',
'.aside-card{border-top:3px solid var(--njq-yellow)!important;}',
'.what-this-means,.try-this,.next-edition{background:var(--njq-cream)!important;}',
'.faq-section,.go-deeper,.tags-section,.series-nav-wrap,.related-section{background:var(--njq-page)!important;border-top:1px solid var(--njq-hair);}',
'.toc-list a,.insights-list li{color:var(--njq-body)!important;font-family:var(--njq-sans)!important;}',
'.toc-list a:hover{color:var(--njq-ink-deep)!important;}',
'.insights-list li::marker{color:var(--njq-yellow-deep);}',
'.mark{background:linear-gradient(transparent 62%,var(--njq-yellow) 62%)!important;}',
'',
'/* ---- buttons ---- */',
'.engage-btn,.media-btn,.promo-callout-btn,.related-empty-link{',
'  font-family:var(--njq-sans)!important;font-weight:600!important;letter-spacing:.02em!important;text-transform:none!important;',
'  background:var(--njq-yellow)!important;color:var(--njq-ink-deep)!important;border:1px solid transparent!important;border-radius:2px!important;box-shadow:none!important;}',
'.engage-btn:hover,.media-btn:hover{background:#EFC400!important;transform:translateY(-1px);}',
'.jnsq-scroll-progress{background:var(--njq-yellow)!important;}',
'',
'/* ---- the promo gate does not carry into the rebrand (pending decision) ---- */',
'#jnsq-promo-modal,.jnsq-promo-modal,.jnsq-promo-trigger,.promo-callout{display:none!important;}',
'',
'/* ---- new header ---- */',
'.njq-head{position:sticky;top:0;z-index:90;background:rgba(253,251,243,.94);backdrop-filter:blur(8px);border-bottom:1px solid var(--njq-hair);}',
'.njq-head-in{max-width:1480px;margin:0 auto;padding:0 clamp(20px,3.6vw,56px);height:62px;display:flex;align-items:center;justify-content:space-between;gap:20px;}',
'.njq-lock{text-decoration:none;line-height:1;}',
'.njq-lock .name{display:block;font-family:var(--njq-mono);font-weight:600;font-size:13px;letter-spacing:.34em;color:var(--njq-ink-deep);}',
'.njq-lock .disc{display:block;font-family:var(--njq-mono);font-size:7.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--njq-grey);margin-top:3px;}',
'.njq-nav{display:flex;align-items:center;flex-wrap:wrap;gap:2px 22px;}',
'.njq-nav a{font-family:var(--njq-sans);font-size:13.5px;color:var(--njq-ink);text-decoration:none;padding-bottom:3px;border-bottom:2px solid transparent;}',
'.njq-nav a:hover{color:var(--njq-ink-deep);}',
'.njq-nav a.on{color:var(--njq-ink-deep);border-bottom-color:var(--njq-yellow);}',
'@media(max-width:940px){.njq-nav{display:none;}}',
'',
'/* ---- new footer ---- */',
'.njq-foot{background:var(--njq-page);border-top:1px solid var(--njq-hair);margin-top:64px;}',
'.njq-foot-in{max-width:1480px;margin:0 auto;padding:56px clamp(20px,3.6vw,56px) 40px;display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,2fr);gap:48px;}',
'@media(max-width:860px){.njq-foot-in{grid-template-columns:1fr;}}',
'.njq-foot-brand .name{font-family:var(--njq-mono);font-weight:600;font-size:13px;letter-spacing:.34em;color:var(--njq-ink-deep);display:block;}',
'.njq-foot-brand .disc{font-family:var(--njq-mono);font-size:7.5px;letter-spacing:.3em;text-transform:uppercase;color:var(--njq-grey);display:block;margin-top:3px;}',
'.njq-foot-brand .pos{font-family:var(--njq-serif);font-style:italic;color:var(--njq-ink);margin:16px 0 8px;font-size:15.5px;}',
'.njq-foot-brand .geo{font-size:12.5px;color:var(--njq-grey);line-height:1.7;margin:0;}',
'.njq-foot-cols{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;}',
'@media(max-width:600px){.njq-foot-cols{grid-template-columns:1fr;}}',
'.njq-foot-cols .lbl{font-family:var(--njq-mono);font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--njq-yellow-deep);margin:0 0 10px;}',
'.njq-foot-cols a{display:block;font-size:13.5px;color:var(--njq-body);text-decoration:none;padding:4px 0;}',
'.njq-foot-cols a:hover{color:var(--njq-ink-deep);text-decoration:underline;text-decoration-color:var(--njq-yellow);}',
'.njq-foot-base{max-width:1480px;margin:0 auto;padding:18px clamp(20px,3.6vw,56px) 28px;border-top:1px solid var(--njq-hair);font-family:var(--njq-mono);font-size:10.5px;letter-spacing:.08em;color:var(--njq-grey);}',
'',
'/* ---- listing page (server-rendered index) ---- */',
'.blog-card{background:#FFFDF4!important;border:1px solid var(--njq-hair)!important;border-radius:0!important;box-shadow:none!important;}',
'.blog-card:hover{transform:translateY(-3px);border-color:var(--njq-yellow)!important;}',
'.blog-card-title{font-family:var(--njq-serif)!important;font-weight:500!important;color:var(--njq-ink-deep)!important;}',
'.blog-card-excerpt{color:var(--njq-body)!important;font-family:var(--njq-sans)!important;}',
'.blog-card-meta,.blog-card-tags,.blog-card-tags *{font-family:var(--njq-mono)!important;letter-spacing:.1em!important;color:var(--njq-grey)!important;}',
'.blog-card-tags .tag,.blog-card-tags span,.blog-card-tags a{background:transparent!important;border:1px solid var(--njq-hair)!important;border-radius:2px!important;color:var(--njq-yellow-deep)!important;}',
'.blog-card-image{border-bottom:1px solid var(--njq-hair);}',
'.blog-search-bar,.blog-search{border-radius:2px!important;}',
'.blog-search input{font-family:var(--njq-sans)!important;}',
'</style>'
].join('\n');

function reskin(html) {
  var s = String(html);

  // shell: old nav out, new header in
  s = s.replace(/<nav class="jnsq-nav">[\s\S]*?<\/nav>/, NEW_NAV);

  // shell: old footer out, new footer in
  s = s.replace(/<footer class="jnsq-footer">[\s\S]*?<\/footer>/, NEW_FOOTER);

  // booking flows are offline during the upgrade: calendly goes to email
  s = s.replace(/https:\/\/calendly\.com\/jerico-studio-jnsq\/30min/g,
                'mailto:strategy@studiojnsq.com?subject=Book%20a%20call%20with%20a%20strategist');

  // fonts + skin, injected at the end of head
  s = s.replace('</head>', NEW_FONTS + SKIN_CSS + '\n</head>');

  return s;
}

module.exports = { reskin: reskin };

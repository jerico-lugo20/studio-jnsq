#!/usr/bin/env node
// ============================================================
// REAL URL BUILD (7 September 2026)
// The rebuilt site shipped as a hash-routed single page, so every
// commercial section lived at one address and returned 404 when
// requested directly. This splits the shell into server-rendered
// pages, one per destination, each with its own title, meta
// description, canonical and structured data.
//
// Source of truth is index.html: the shell, the section markup and
// the motion system are all reused verbatim. Only the routing layer
// and the head change.
//
// Run from the repo root: node build_pages.js
// ============================================================
var fs = require('fs');

var SRC = fs.readFileSync('index.src.html', 'utf8');
var SITE = 'https://studiojnsq.com';

// ---------- carve the shell ----------
var navStart = SRC.indexOf('<header class="nav">');
var navEnd = SRC.indexOf('</header>', navStart) + '</header>'.length;
var mainStart = SRC.indexOf('<main id="app">');
var mainEnd = SRC.indexOf('</main>') + '</main>'.length;

var HEAD = SRC.slice(0, navStart);          // doctype, meta, fonts, all styles
var TAIL = SRC.slice(mainEnd);              // dots nav, every script, the maintenance modal

// ---------- carve each view ----------
var views = {};
var re = /<section class="view" id="v-([a-z-]+)">/g, m, marks = [];
while ((m = re.exec(SRC)) !== null) marks.push({ key: m[1], start: m.index });
marks.forEach(function (mk, i) {
  var end = (i + 1 < marks.length) ? marks[i + 1].start : mainEnd - '</main>'.length;
  views[mk.key] = SRC.slice(mk.start, end);
});

// ---------- where every destination lives ----------
var ROUTES = {
  'home': '/',
  'services': '/services',
  'investment-readiness': '/investment-readiness',
  'portfolio': '/portfolio',
  'frameworks': '/frameworks',
  'frameworks-mad': '/frameworks/mad',
  'frameworks-rvf': '/frameworks/rvf',
  'diagnostic': '/diagnostic',
  'insights': '/insights',       // server-rendered elsewhere, linked only
  'our-story': '/our-story',
  'contact': '/contact'
};

var PAGES = [
  { key: 'home', file: 'index.html', title: 'Studio JNSQ | Brand Equity Architecture for Valuable Brands',
    desc: 'Studio JNSQ is the brand equity architecture firm for valuable brands. We get the market to trust you, so you can choose. Free MAD™ Snapshot for people and companies.' },

  { key: 'services', file: 'services.html', title: 'Services and Pricing | Studio JNSQ',
    desc: 'Diagnostics from free, retainers from ₱75,000 a month, projects from ₱50,000. The diagnostic always comes first, and the score decides the work. Brand equity architecture for people and companies.' },

  { key: 'investment-readiness', file: 'investment-readiness.html', title: 'Brand Equity for Investment Readiness | Studio JNSQ',
    desc: 'Push the valuation to the maximum number the evidence will carry, by surfacing the value of the brand beyond the revenue it generates. Advisory, delivery, or delivery at a flat fee, before a term sheet arrives.' },

  { key: 'portfolio', file: 'portfolio.html', title: 'Portfolio | Studio JNSQ | Work You Can Check',
    desc: 'Named case studies with measured movement: a full MAD™ audit, RVF™ diagnostics and the systems built from them. Nothing enters a case study a sceptical reader cannot verify in ten minutes.' },

  { key: 'frameworks', file: 'frameworks.html', title: 'The Frameworks | MAD™ and RVF™ | Studio JNSQ',
    desc: 'Two proprietary instruments. The Market Authority Diamond™ reads what the market can establish about you. The Resource Value Formula™ reads whether the business underneath can carry it.' },

  { key: 'frameworks-mad', file: 'frameworks-mad.html', title: 'The Market Authority Diamond™ Explained | Studio JNSQ',
    desc: 'How the MAD™ framework works: credibility, visibility, market trust and demand, with branding as the centering point. Forty four items, one shape, and the lean is the diagnosis.' },

  { key: 'frameworks-rvf', file: 'frameworks-rvf.html', title: 'The Resource Value Formula™ Explained | Studio JNSQ',
    desc: 'How the RVF™ framework works: three resource trades of money, effort and time, the nine stall patterns between them, and what the diagnostic reads.' },

  { key: 'diagnostic', file: 'diagnostic.html', title: 'The Diagnostics | MAD™ and RVF™ | Studio JNSQ',
    desc: 'Find out where you stand. The snapshot is free and takes five minutes. Full diagnostics from ₱3,000 for a person and ₱7,000 for a company, with a strategist reading available.' },

  { key: 'our-story', file: 'our-story.html', title: 'Our Story and the Founder | Studio JNSQ',
    desc: 'Studio JNSQ exists because of a pattern: brilliant inside the building, invisible outside it. The story of the firm, the frameworks, and Jerico Lugo, MCIPR.' },

  { key: 'contact', file: 'contact.html', title: 'Start Here | Studio JNSQ',
    desc: 'Two ways in, and one of them is free. Take the MAD™ Snapshot, or bring the score to thirty minutes with a strategist. Email strategy@studiojnsq.com.' }
];

// ---------- structured data ----------
var ORG = {
  "@context": "https://schema.org",
  "@type": ["Organization", "ProfessionalService"],
  "@id": SITE + "/#organization",
  "name": "Studio JNSQ",
  "alternateName": "Studio JNSQ Brand Equity Architecture",
  "url": SITE,
  "description": "Studio JNSQ is a brand equity architecture firm. Brand equity architecture is the discipline of building the financial and reputational value of a company. It sits at the convergence of PR and Finance.",
  "slogan": "We get the market to trust you, so you can choose.",
  "founder": { "@type": "Person", "name": "Jerico Lugo", "jobTitle": "Founder and Brand Equity Architect" },
  "address": { "@type": "PostalAddress", "addressLocality": "Manila", "addressCountry": "PH" },
  "areaServed": [
    { "@type": "Place", "name": "Asia-Pacific" },
    { "@type": "Place", "name": "Gulf Cooperation Council" },
    { "@type": "Place", "name": "United Kingdom" }
  ],
  "email": "strategy@studiojnsq.com",
  "knowsAbout": [
    "Brand equity architecture", "Brand equity", "Market authority",
    "Investment readiness", "Public relations", "Executive visibility"
  ]
};

function breadcrumb(name, path) {
  return {
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/" },
      { "@type": "ListItem", "position": 2, "name": name, "item": SITE + path }
    ]
  };
}

var SERVICE_SCHEMA = {
  "@context": "https://schema.org", "@type": "Service",
  "name": "Brand equity architecture",
  "provider": { "@id": SITE + "/#organization" },
  "description": "Diagnostics, reads and audits, retainers and projects. Every engagement opens with a score, and the score decides the work.",
  "areaServed": ["Asia-Pacific", "Gulf Cooperation Council", "United Kingdom"],
  "hasOfferCatalog": {
    "@type": "OfferCatalog", "name": "Studio JNSQ services",
    "itemListElement": [
      { "@type": "Offer", "name": "MAD™ Snapshot", "price": "0", "priceCurrency": "PHP",
        "itemOffered": { "@type": "Service", "name": "Market Authority Diamond Snapshot" } },
      { "@type": "Offer", "name": "Full MAD™ diagnostic, for a person", "price": "3000", "priceCurrency": "PHP",
        "itemOffered": { "@type": "Service", "name": "Full MAD diagnostic for an individual" } },
      { "@type": "Offer", "name": "Full diagnostic, for a company", "price": "7000", "priceCurrency": "PHP",
        "itemOffered": { "@type": "Service", "name": "Full MAD or RVF diagnostic for a company" } },
      { "@type": "Offer", "name": "Brand Equity Foundations retainer", "price": "75000", "priceCurrency": "PHP",
        "itemOffered": { "@type": "Service", "name": "Brand Equity Foundations" } },
      { "@type": "Offer", "name": "Brand Equity Builder retainer", "price": "100000", "priceCurrency": "PHP",
        "itemOffered": { "@type": "Service", "name": "Brand Equity Builder" } },
      { "@type": "Offer", "name": "Brand Equity Architecture retainer", "price": "150000", "priceCurrency": "PHP",
        "itemOffered": { "@type": "Service", "name": "Brand Equity Architecture" } }
    ]
  }
};

var PERSON_SCHEMA = {
  "@context": "https://schema.org", "@type": "Person",
  "name": "Jerico Lugo", "alternateName": "Jec",
  "jobTitle": "Founder and Brand Equity Architect",
  "worksFor": { "@id": SITE + "/#organization" },
  "url": SITE + "/our-story",
  "description": "Jerico Lugo, MCIPR, founder of Studio JNSQ. He works with people who have strong names inside the companies they have worked in, but not outside.",
  "knowsAbout": ["Brand equity architecture", "Public relations", "Market authority", "Valuation"]
};

function schemaFor(key) {
  var out = [];
  if (key === 'home') out.push(ORG);
  if (key === 'services') { out.push(SERVICE_SCHEMA); out.push(breadcrumb('Services', '/services')); }
  if (key === 'investment-readiness') {
    out.push({ "@context": "https://schema.org", "@type": "Service",
      "name": "Brand equity for investment readiness",
      "provider": { "@id": SITE + "/#organization" },
      "description": "The practice of pushing the valuation to the maximum number the evidence will carry, by surfacing the value of the brand beyond the revenue it generates.",
      "areaServed": ["Asia-Pacific", "Gulf Cooperation Council", "United Kingdom"] });
    out.push(breadcrumb('Investment readiness', '/investment-readiness'));
  }
  if (key === 'our-story') { out.push(PERSON_SCHEMA); out.push(breadcrumb('Our story', '/our-story')); }
  if (key === 'portfolio') out.push(breadcrumb('Portfolio', '/portfolio'));
  if (key === 'frameworks') out.push(breadcrumb('Frameworks', '/frameworks'));
  if (key === 'frameworks-mad') out.push(breadcrumb('The Market Authority Diamond', '/frameworks/mad'));
  if (key === 'frameworks-rvf') out.push(breadcrumb('The Resource Value Formula', '/frameworks/rvf'));
  if (key === 'diagnostic') out.push(breadcrumb('Diagnostics', '/diagnostic'));
  if (key === 'contact') out.push(breadcrumb('Start here', '/contact'));
  return out.map(function (o) {
    return '<script type="application/ld+json">' + JSON.stringify(o) + '<\/script>';
  }).join('\n');
}

// ---------- rewrite hash links to real paths ----------
function realLinks(html) {
  Object.keys(ROUTES).forEach(function (k) {
    html = html.split('href="#/' + k + '"').join('href="' + ROUTES[k] + '"');
  });
  return html;
}

// ---------- nav, with the current page marked ----------
var NAV_SRC = SRC.slice(navStart, navEnd);
function navFor(key) {
  var nav = realLinks(NAV_SRC);
  var here = ROUTES[key];
  if (here) {
    nav = nav.replace('<a href="' + here + '">', '<a href="' + here + '" aria-current="page">');
  }
  return nav;
}

// ---------- build ----------
var head = HEAD;
PAGES.forEach(function (p) {
  var canonical = SITE + (ROUTES[p.key] === '/' ? '/' : ROUTES[p.key]);

  var h = head
    .replace(/<title>[^<]*<\/title>/, '<title>' + p.title + '</title>')
    .replace('</title>',
      '</title>\n<meta name="description" content="' + p.desc + '">\n' +
      '<link rel="canonical" href="' + canonical + '">\n' +
      '<meta property="og:type" content="website">\n' +
      '<meta property="og:site_name" content="Studio JNSQ">\n' +
      '<meta property="og:title" content="' + p.title + '">\n' +
      '<meta property="og:description" content="' + p.desc + '">\n' +
      '<meta property="og:url" content="' + canonical + '">\n' +
      '<meta name="twitter:card" content="summary_large_image">\n' +
      '<meta name="twitter:title" content="' + p.title + '">\n' +
      '<meta name="twitter:description" content="' + p.desc + '">\n' +
      schemaFor(p.key));

  var view = realLinks(views[p.key]).replace('<section class="view" id="v-' + p.key + '">',
                                             '<section class="view active" id="v-' + p.key + '">');

  var pageVar = '<script>window.__PAGE=' + JSON.stringify(p.key) + ';<\/script>\n';

  var out = h + navFor(p.key) + '\n<main id="app">\n' + view + '\n</main>\n' + pageVar + realLinks(TAIL);
  fs.writeFileSync(p.file, out);
  console.log(p.file.padEnd(28), ROUTES[p.key].padEnd(24), Math.round(out.length / 1024) + ' KB');
});

console.log('\n' + PAGES.length + ' pages built from index.src.html');

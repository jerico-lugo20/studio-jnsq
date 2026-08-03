// ============================================================
//  Studio JNSQ — Canonical Blog Post Renderer (shared source of truth)
//  Used by:
//   - /admin.html editor for the live preview pane
//   - /.netlify/functions/render-blog-post for server-rendered /blog/<slug>
//  Any change to the canonical layout goes here and reflects in both.
//
//  UMD wrapper so this same file loads in a browser (window.CanonicalPost)
//  and via require() in Node.js (Netlify functions).
// ============================================================
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.CanonicalPost = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {

  // ============================================================
  //  HELPERS
  // ============================================================
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function decodeEntities(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }
  function formatDate(d) {
    if (!d) return '';
    var date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  function isoDate(d) {
    if (!d) return new Date().toISOString();
    var date = new Date(d);
    if (isNaN(date.getTime())) return new Date().toISOString();
    return date.toISOString();
  }
  function calculateReadingTime(body) {
    if (!body) return 0;
    var text = String(body).replace(/<[^>]+>/g, ' ');
    var words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.ceil(words / 200));
  }

  var SERIES_LABEL = {
    foundation: 'Foundation', mad: 'MAD™ Series', numbers: 'The Numbers',
    practice: 'The Practice', diagnostics: 'The Diagnostics',
    bip: 'Brilliant In Public', standalone: 'Standalone'
  };
  var SERIES_DESC = {
    foundation: 'Definitional pieces. The starting line for brand equity architecture.',
    mad: 'The anatomy of the Market Authority Diamond™. Where brand equity actually lives.',
    numbers: 'CAC, MRR, LTV. Brand equity translated to the metrics your CFO already cares about.',
    practice: 'How the discipline shows up in operating decisions, week to week.',
    diagnostics: 'The MAD™ and RVF™ diagnostics, the playbooks for reading the score.',
    bip: 'Long-form insights from Jerico Lugo on brand equity architecture, media strategy, and the systems behind valuable brands.',
    standalone: 'Sharp observations that sit outside the recurring series.'
  };
  function seriesLabel(s) { return SERIES_LABEL[s] || 'Journal'; }
  function seriesDescription(s) { return SERIES_DESC[s] || ''; }

  function resolveImg(url) {
    if (!url) return '';
    if (url.indexOf('drive.google.com') !== -1) {
      var match = url.match(/[-\w]{25,}/);
      if (match) return 'https://drive.google.com/uc?export=view&id=' + match[0];
    }
    return url;
  }
  function encodeImgUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return url.split('/').map(function (seg, i) { return i === 0 ? seg : encodeURIComponent(seg); }).join('/');
  }

  // ============================================================
  //  AUTO-LINKIFY DOCTRINE CTAs
  //  Turns bare-text mentions of the MAD/RVF diagnostics, "book a
  //  chat with Jerico/Jec", and "take the diagnostic" into proper
  //  hyperlinks. Applied server-side so writers never touch anchors.
  //  HTML-aware: skips content inside existing <a> tags.
  // ============================================================
  // Strip <a>...</a> tags but keep inner content. Used in sections where
  // hyperlinks are NOT allowed (per rule: links only in body + closing).
  function stripHyperlinks(html) {
    if (!html) return '';
    return String(html).replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  }

  // ctx can be either a slug string (legacy) or a post object (preferred)
  function _extractCtx(ctx) {
    if (!ctx) return { slug: '', promoGate: null };
    if (typeof ctx === 'string') return { slug: ctx, promoGate: null };
    return { slug: ctx.slug || '', promoGate: ctx.promoGate || null };
  }

  function linkifyText(text, ctx) {
    if (!text) return '';
    var c = _extractCtx(ctx);
    var src = c.slug ? '?src=blog-' + encodeURIComponent(c.slug) : '';
    var mad = '/diagnostic/MAD' + src;
    var rvf = '/diagnostic/RVF' + src;
    var diag = '/diagnostic' + src;
    var calendly = 'https://calendly.com/jerico-studio-jnsq/30min';
    var out = text;
    out = out.replace(/(Market Authority Diamond(?:™|&#8482;|&trade;)?)\s+diagnostic/gi,
      '<a href="' + mad + '">$1 diagnostic</a>');
    out = out.replace(/(MAD(?:™|&#8482;|&trade;)?)\s+diagnostic/gi,
      '<a href="' + mad + '">$1 diagnostic</a>');
    out = out.replace(/(Resource Value Formula(?:™|&#8482;|&trade;)?)\s+diagnostic/gi,
      '<a href="' + rvf + '">$1 diagnostic</a>');
    out = out.replace(/(RVF(?:™|&#8482;|&trade;)?)\s+diagnostic/gi,
      '<a href="' + rvf + '">$1 diagnostic</a>');
    out = out.replace(/(book (?:a\s+)?(?:quick\s+)?(?:chat|call)\s+with\s+(?:Jerico|Jec))/gi,
      '<a href="' + calendly + '" target="_blank" rel="noopener">$1</a>');
    out = out.replace(/(take the diagnostic)/gi,
      '<a href="' + diag + '">$1</a>');

    // Promo-gate trigger: only when post has an active promo gate.
    // Match "subscribe here" or "sign up here" (case-insensitive) and wrap the
    // word "here" in a special anchor that opens the claim-promo modal client-side.
    if (c.promoGate && c.promoGate.enabled && c.promoGate.code) {
      var pg = c.promoGate;
      var triggerAttrs = 'class="jnsq-promo-trigger" ' +
        'data-code="' + escapeAttr(pg.code) + '" ' +
        'data-discount="' + escapeAttr(pg.discountPct || '') + '" ' +
        'data-tier="' + escapeAttr(pg.tier || '') + '" ' +
        'data-expiry="' + escapeAttr(pg.expiry || '') + '" ' +
        'data-slug="' + escapeAttr(c.slug) + '"';
      // Match "subscribe here" / "sign up here" — link ONLY the word "here"
      out = out.replace(/(subscribe|sign up|register)\s+(here)\b/gi,
        function (m, verb, herePart) {
          return verb + ' <a href="#claim-promo" ' + triggerAttrs + '>' + herePart + '</a>';
        });
      // Also match "here to (get|receive|claim) (your|the|a) code"
      out = out.replace(/\b(here)\s+(to\s+(?:get|receive|claim)\s+(?:your|the|a)?\s*(?:code|diagnostic|report))/gi,
        function (m, herePart, rest) {
          return '<a href="#claim-promo" ' + triggerAttrs + '>' + herePart + '</a> ' + rest;
        });
    }
    return out;
  }

  // Apply linkifyText to a string that may already contain HTML tags/anchors.
  function linkifyHtmlAware(html, ctx) {
    if (!html) return '';
    var pattern = /(<a\b[^>]*>[\s\S]*?<\/a>)|(<(?:code|pre)\b[^>]*>[\s\S]*?<\/(?:code|pre)>)|(<[^>]+>)|([^<]+)/gi;
    return html.replace(pattern, function (m, anchor, skipBlock, tag, textNode) {
      if (anchor) return anchor;
      if (skipBlock) return skipBlock;
      if (tag) return tag;
      return linkifyText(textNode, ctx);
    });
  }

  // Inject IDs into H2 tags and extract a TOC
  function processBodyAndToc(bodyHtml) {
    if (!bodyHtml) return { body: '', toc: [] };
    var toc = [];
    var idx = 0;
    var body = bodyHtml.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/gi, function (m, attrs, text) {
      var plain = text.replace(/<[^>]+>/g, '').trim();
      var idMatch = /id\s*=\s*["']([^"']+)["']/.exec(attrs);
      var id;
      if (idMatch) { id = idMatch[1]; }
      else {
        id = 'h-' + idx + '-' + plain.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
        attrs = attrs + ' id="' + id + '"';
      }
      toc.push({ id: id, text: plain });
      idx++;
      return '<h2' + attrs + '>' + text + '</h2>';
    });
    return { body: body, toc: toc };
  }

  // ============================================================
  //  SECTION RENDERERS
  // ============================================================
  function renderBreadcrumb(post) {
    var crumbs = ['<a href="/">Home</a>', '<a href="/journal">Journal</a>'];
    if (post.series) {
      crumbs.push('<a href="/journal?filter=' + encodeURIComponent(post.series) + '">' + escapeHtml(seriesLabel(post.series)) + '</a>');
    }
    if (post.seriesIndex) crumbs.push('Edition ' + escapeHtml(post.seriesIndex));
    return crumbs.join(' &nbsp;/&nbsp; ');
  }

  function renderSeriesChip(post) {
    if (!post.series && !post.seriesLabel) return '';
    var label;
    if (post.seriesLabel) {
      label = post.seriesLabel;
    } else if (post.series === 'bip') {
      label = 'BIP' + (post.seriesIndex ? ' Edition ' + post.seriesIndex : '') + ' · Brilliant In Public';
    } else if (post.seriesIndex) {
      label = seriesLabel(post.series) + ' · Edition ' + post.seriesIndex;
    } else {
      label = seriesLabel(post.series);
    }
    return '<a href="/journal?filter=' + encodeURIComponent(post.series || 'standalone') + '" class="series-chip"><span>' + escapeHtml(label) + '</span></a>';
  }

  function renderMeta(post) {
    var bits = [];
    if (post.author) bits.push('<span>By <strong>' + escapeHtml(post.author) + '</strong></span>');
    if (post.publishDate) bits.push('<span>' + escapeHtml(formatDate(post.publishDate)) + '</span>');
    var rt = calculateReadingTime(post.body);
    if (rt > 0) bits.push('<span>' + rt + ' min read</span>');
    return bits.join('\n');
  }

  function renderHero(post) {
    // STACK LAYOUT: breadcrumb → chip → title → excerpt → byline → big hero image (full width)
    var imgUrl = encodeImgUrl(resolveImg(post.heroImage));
    var placeholderMark = 'Studio JNSQ' + (post.series ? ' · ' + seriesLabel(post.series) : '') + (post.seriesIndex ? ' ' + post.seriesIndex : '');
    var placeholderTitle = post.excerpt ? post.excerpt : (post.title || 'The JNSQ Journal');
    var imgBlock = imgUrl
      ? '<img src="' + escapeAttr(imgUrl) + '" alt="' + escapeAttr(post.title || '') + '" loading="eager" onload="this.previousElementSibling.style.display=\'none\';" onerror="this.style.display=\'none\';">'
      : '<img src="" alt="" style="display:none;">';
    return '<section class="article-hero article-hero-stack">\n' +
      '  <div class="wide-container">\n' +
      '    <div class="hero-stack-text">\n' +
      '      <div class="breadcrumb">' + renderBreadcrumb(post) + '</div>\n' +
      '      ' + renderSeriesChip(post) + '\n' +
      '      <h1 class="article-title">' + escapeHtml(post.title || '') + '</h1>\n' +
      (post.excerpt ? '      <p class="article-excerpt">' + escapeHtml(post.excerpt) + '</p>\n' : '') +
      '      <div class="article-meta">\n' + renderMeta(post) + '\n      </div>\n' +
      '    </div>\n' +
      '    <div class="hero-stack-img">\n' +
      '      <div class="hero-img-frame">\n' +
      '        <div class="placeholder">\n' +
      '          <div class="mark">' + escapeHtml(placeholderMark) + '</div>\n' +
      '          <div class="ph-title">' + escapeHtml(placeholderTitle) + '</div>\n' +
      '        </div>\n' +
      '        ' + imgBlock + '\n' +
      '      </div>\n' +
      '    </div>\n' +
      '  </div>\n' +
      '</section>\n';
  }

  // (renderKicker is defined below with linkifier + HTML trust)

  function renderOpening(post) {
    if (!post.opening) return '';
    // Opening keeps bold/italic/underline but NOT hyperlinks (per rule).
    return '<p class="lead-italic">' + stripHyperlinks(post.opening) + '</p>\n';
  }

  function renderWTM(post) {
    var w = post.whatThisMeans || {};
    if (!w.headline && !w.body && !(w.items && w.items.length)) return '';
    // WTM keeps emphasis (bold/italic/underline) but strips hyperlinks per rule.
    var items = (w.items || []).map(function (it) {
      return '<li>' + stripHyperlinks(it) + '</li>';
    }).join('');
    return '<div class="what-this-means">\n' +
      '  <div class="label">' + escapeHtml(w.label || 'What does this actually mean?') + '</div>\n' +
      (w.headline ? '  <h3>' + stripHyperlinks(w.headline) + '</h3>\n' : '') +
      (w.body ? '  <p>' + stripHyperlinks(w.body) + '</p>\n' : '') +
      (items ? '  <ol>' + items + '</ol>\n' : '') +
      '</div>\n';
  }

  function renderPullQuote(post) {
    var p = post.pullQuote || {};
    if (!p.text) return '';
    return '<blockquote class="pull-quote">\n' +
      '  "' + escapeHtml(p.text) + '"\n' +
      (p.attribution ? '  <span class="attribution">' + escapeHtml(p.attribution) + '</span>\n' : '') +
      '</blockquote>\n';
  }

  function renderClosing(post) {
    if (!post.closing) return '';
    // closing is trusted HTML from docx (may contain <a href> and <strong>/<em>)
    var withParas = post.closing.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br>');
    return '<div class="closing-block-plain">\n  <p>' + linkifyHtmlAware(withParas, post) + '</p>\n</div>\n';
  }

  // ============================================================
  //  PROMO CALLOUT
  //  When the post has an active promo gate, render a prominent
  //  strategic CTA inside the article (no need for the writer to
  //  add "Subscribe here" inline). Reuses the promo modal.
  // ============================================================
  function renderPromoCallout(post) {
    var pg = post.promoGate;
    if (!pg || !pg.enabled) return '';
    var codeType = pg.codeType === 'unique' ? 'unique' : 'shared';
    // Shared campaigns need a code; unique campaigns need at least a suffix (generated code = initials + suffix).
    if (codeType === 'shared' && !pg.code) return '';
    if (codeType === 'unique' && !pg.codeSuffix) return '';
    var tier = pg.tier || 'diagnostic report';
    var discount = pg.discountPct ? escapeHtml(String(pg.discountPct)) + '%' : '';
    var eyebrow = discount ? discount + ' off · ' + escapeHtml(tier) : 'Free ' + escapeHtml(tier);
    var subCopy = codeType === 'unique'
      ? 'Enter your details and we generate a unique code for you. One-time reader promo, no spam.'
      : 'Enter your email and we send it the moment you submit. One-time reader promo, no spam.';
    return '<aside class="promo-callout">\n' +
      '  <div class="promo-callout-inner">\n' +
      '    <div class="promo-callout-eyebrow">' + eyebrow + '</div>\n' +
      '    <h3 class="promo-callout-title">Get an exclusive code for readers.</h3>\n' +
      '    <p class="promo-callout-body">' + subCopy + '</p>\n' +
      '    <a href="#claim-promo" class="promo-callout-btn jnsq-promo-trigger" ' +
        'data-code="' + escapeAttr(pg.code || '') + '" ' +
        'data-code-type="' + escapeAttr(codeType) + '" ' +
        'data-code-suffix="' + escapeAttr(pg.codeSuffix || '') + '" ' +
        'data-discount="' + escapeAttr(pg.discountPct || '') + '" ' +
        'data-tier="' + escapeAttr(pg.tier || '') + '" ' +
        'data-expiry="' + escapeAttr(pg.expiry || '') + '" ' +
        'data-slug="' + escapeAttr(post.slug || '') + '">Send me the code &rarr;</a>\n' +
      '  </div>\n' +
      '</aside>\n';
  }

  function renderKicker(post) {
    if (!post.kicker) return '';
    // Kicker keeps emphasis but not hyperlinks.
    return '<p class="article-kicker">' + stripHyperlinks(post.kicker) + '</p>\n';
  }

  function renderTryThis(post) {
    var t = post.tryThis || {};
    if (!t.headline && !t.body) return '';
    // Try This keeps emphasis but strips hyperlinks per rule.
    return '<div class="try-this">\n' +
      '  <div class="label">' + escapeHtml(t.label || 'Try This') + '</div>\n' +
      (t.headline ? '  <h3>' + escapeHtml(t.headline) + '</h3>\n' : '') +
      (t.body ? '  <p>' + stripHyperlinks(t.body) + '</p>\n' : '') +
      '</div>\n';
  }

  function renderNextEdition(post) {
    var n = post.nextEdition || {};
    if (!n.text) return '';
    // Text is trusted HTML from docx (preserves bold/italic). Strip any hyperlinks
    // per rule: links only in body + closing. Keep the emphasis formatting.
    var inner = stripHyperlinks(n.text);
    return '<p class="next-edition">' + inner + '</p>\n';
  }

  function renderSignOff(post) {
    if (!post.signOff) return '';
    return '<p class="sign-off">' + escapeHtml(post.signOff) + '</p>\n';
  }

  function renderSidebar(post, tocItems) {
    // 1. Key Insights
    var insights = (post.keyInsights && post.keyInsights.length) ? post.keyInsights : tocItems.slice(0, 3).map(function (t) { return t.text; });
    var insightsHtml = insights.length
      ? '<div class="aside-card">\n' +
        '  <div class="aside-label">Key Insights</div>\n' +
        '  <ul class="insights-list">\n' +
        insights.map(function (i) { return '    <li>' + escapeHtml(i) + '</li>'; }).join('\n') + '\n' +
        '  </ul>\n' +
        '</div>\n'
      : '';

    // 2. In This Article
    var tocHtml = tocItems.length
      ? '<div class="aside-card">\n' +
        '  <div class="aside-label">In This Article</div>\n' +
        '  <ul class="toc-list">\n' +
        tocItems.map(function (t) { return '    <li><a href="#' + escapeAttr(t.id) + '">' + escapeHtml(t.text) + '</a></li>'; }).join('\n') + '\n' +
        '  </ul>\n' +
        '</div>\n'
      : '';

    // 3. Media
    var mediaHtml =
      '<div class="aside-card media-card">\n' +
      '  <div class="aside-label">Media &middot; Press &middot; Commentary</div>\n' +
      '  <h4>Want Jec on record?</h4>\n' +
      '  <p>For interviews, quotes, or commentary on brand equity architecture in the evolving media landscape.</p>\n' +
      '  <a href="https://calendly.com/jerico-studio-jnsq/30min" target="_blank" rel="noopener" class="media-btn">Book a chat &rarr;</a>\n' +
      '</div>\n';

    // 4. Engage
    var engageHtml =
      '<div class="aside-card engage-card">\n' +
      '  <div class="aside-label">Engage</div>\n' +
      '  <h4>Want this conversation in private?</h4>\n' +
      '  <p>30 minutes with Jec. No pitch. Just a sharper read on where you are.</p>\n' +
      '  <a href="https://calendly.com/jerico-studio-jnsq/30min" target="_blank" rel="noopener" class="engage-btn">Book the 30 &rarr;</a>\n' +
      '</div>\n';

    // 5. Series
    var seriesHtml = post.series
      ? '<div class="aside-card">\n' +
        '  <div class="aside-label">Series</div>\n' +
        '  <h4>' + escapeHtml(seriesLabel(post.series)) + '</h4>\n' +
        '  <p style="margin-bottom:8px;">' + escapeHtml(seriesDescription(post.series)) + '</p>\n' +
        '  <a class="inline-link" href="/journal?filter=' + encodeURIComponent(post.series) + '" style="font-size:11.5px;font-weight:700;letter-spacing:0.06em;">See all ' + escapeHtml(seriesLabel(post.series)) + ' &rarr;</a>\n' +
        '</div>\n'
      : '';

    return '<aside class="article-aside">\n' + insightsHtml + tocHtml + mediaHtml + engageHtml + seriesHtml + '</aside>\n';
  }

  function renderFAQ(post) {
    if (!post.faqs || !post.faqs.length) return '';
    // Question is plain text; answer is trusted HTML but strips hyperlinks (rule: no links outside body/closing).
    var items = post.faqs.map(function (f) {
      return '      <details>\n' +
        '        <summary>' + escapeHtml(f.question) + '</summary>\n' +
        '        <p>' + stripHyperlinks(f.answer) + '</p>\n' +
        '      </details>';
    }).join('\n');
    return '<section class="faq-section">\n' +
      '  <div class="faq-inner">\n' +
      '    <div class="label">Frequently Asked Questions</div>\n' +
      '    <h2>The questions readers keep sending after this one.</h2>\n' +
      '    <div class="faq-grid">\n' + items + '\n    </div>\n' +
      '  </div>\n' +
      '</section>\n';
  }

  function renderGoDeeper(post) {
    if (!post.goDeeper || !post.goDeeper.length) return '';
    // Card titles come from the docx and may include emphasis but not hyperlinks
    // (the card itself is a link; nested links inside would break the anchor).
    var cards = post.goDeeper.map(function (g) {
      return '      <a href="/journal/' + encodeURIComponent(g.slug || '#') + '" class="deeper-card">\n' +
        '        <div class="num">' + escapeHtml(g.num || '') + '</div>\n' +
        '        <h3>' + stripHyperlinks(g.title || '') + '</h3>\n' +
        '        <p>' + stripHyperlinks(g.excerpt || '') + '</p>\n' +
        (g.seriesTag ? '        <span class="series-tag">' + escapeHtml(g.seriesTag) + '</span>\n' : '') +
        '      </a>';
    }).join('\n');
    var intro = post.goDeeperIntro
      ? '      <p class="go-deeper-intro">' + stripHyperlinks(post.goDeeperIntro) + '</p>\n'
      : '';
    return '<section class="go-deeper" style="background: var(--jnsq-paper); border-top: 1px solid var(--jnsq-line);">\n' +
      '  <div class="go-deeper-inner">\n' +
      '    <div class="header">\n' +
      '      <div class="label">Go Deeper</div>\n' +
      '      <h2>Understand the foundation. See the pieces.</h2>\n' + intro +
      '    </div>\n' +
      '    <div class="deeper-grid">\n' + cards + '\n    </div>\n' +
      '  </div>\n' +
      '</section>\n';
  }

  function renderTags(post) {
    if (!post.tags || !post.tags.length) return '';
    var pills = post.tags.map(function (t) {
      var slug = String(t).toLowerCase().replace(/\s+/g, '-');
      return '      <a class="tag-pill" rel="tag" href="/journal?tag=' + encodeURIComponent(slug) + '">' + escapeHtml(t) + '</a>';
    }).join('\n');
    return '<section class="tags-section">\n' +
      '  <div class="tags-inner">\n' +
      '    <div class="label">Tagged</div>\n' +
      '    <div class="tags-row">\n' + pills + '\n    </div>\n' +
      '  </div>\n' +
      '</section>\n';
  }

  function renderSeriesNav(post) {
    var prev = post.prevInSeries || {};
    var next = post.nextInSeries || {};
    var cross = post.__crossSeriesNext || null;

    if (!prev.slug && !prev.title && !next.slug && !next.title && !cross) return '';

    var prevCard = prev.slug && prev.title
      ? '    <a href="/journal/' + encodeURIComponent(prev.slug) + '" class="series-nav-card">\n' +
        '      <div class="direction">&larr; Previous in series</div>\n' +
        '      <h4>' + escapeHtml(prev.title) + '</h4>\n' +
        '    </a>'
      : '    <div class="series-nav-card disabled">\n' +
        '      <div class="direction">&larr; Previous in series</div>\n' +
        '      <h4>You are at the first published edition in this view.</h4>\n' +
        '    </div>';

    var nextCard;
    if (cross) {
      // Bridging to the first published edition of the NEXT series
      nextCard = '    <a href="/journal/' + encodeURIComponent(cross.slug) + '" class="series-nav-card next">\n' +
        '      <div class="direction">Continue with ' + escapeHtml(cross.seriesName) + ' &rarr;</div>\n' +
        '      <h4>' + escapeHtml(cross.title) + '</h4>\n' +
        '    </a>';
    } else if (next.slug && next.title) {
      nextCard = '    <a href="/journal/' + encodeURIComponent(next.slug) + '" class="series-nav-card next">\n' +
        '      <div class="direction">Next in series &rarr;</div>\n' +
        '      <h4>' + escapeHtml(next.title) + '</h4>\n' +
        '    </a>';
    } else {
      // No next available anywhere — soft CTA to the Journal home
      nextCard = '    <a href="/journal" class="series-nav-card next">\n' +
        '      <div class="direction">You are at the latest edition &rarr;</div>\n' +
        '      <h4>Browse the full Journal.</h4>\n' +
        '    </a>';
    }
    return '<div class="series-nav-wrap">\n  <div class="series-nav">\n' + prevCard + '\n' + nextCard + '\n  </div>\n</div>\n';
  }

  function renderRelated(post) {
    // Three states, driven by post.related (server-injected) + post.__relatedMeta:
    //   1. No related in this series yet → "first, more coming" note
    //   2. Some published (partial) → show cards + "more coming" tail note
    //   3. All published → show cards + "read them all" encouragement
    var hasRelated = post.related && post.related.length;
    var meta = post.__relatedMeta || {};
    var seriesName = meta.seriesName || (post.series ? seriesLabel(post.series) : 'the Journal');
    var bodyHtml;
    var tailNote = '';

    if (hasRelated) {
      var cards = post.related.map(function (r) {
        return '      <a class="related-card" href="/journal/' + encodeURIComponent(r.slug || '#') + '">\n' +
          '        <div class="r-title">' + escapeHtml(r.title || '') + '</div>\n' +
          '        <div class="r-excerpt">' + escapeHtml(r.excerpt || '') + '</div>\n' +
          '      </a>';
      }).join('\n');
      bodyHtml = '    <div class="related-grid">\n' + cards + '\n    </div>\n';

      if (meta.allPublished) {
        tailNote = '    <p class="related-tail">The full series is live. Read all of ' + escapeHtml(seriesName) + ' to see the pattern in full.</p>\n';
      } else if (meta.totalCount && meta.publishedCount < meta.totalCount) {
        tailNote = '    <p class="related-tail">More editions of ' + escapeHtml(seriesName) + ' are on the way. The thread will extend as new pieces publish.</p>\n';
      }
    } else {
      // BIP posts (Brilliant In Public) start at Edition 15 as Volume II, so the
      // "earliest edition" copy is series-specific. Everything else uses the
      // generic "one of the earliest editions" line.
      var emptyCopy = post.series === 'bip'
        ? 'You are at the earliest edition of <em>Brilliant In Public Volume II</em>. More editions are coming, and the thread will extend as new pieces publish.'
        : 'This is one of the earliest editions in ' + escapeHtml(seriesName) + '. More is coming, and the thread will extend as new pieces publish.';
      bodyHtml = '    <div class="related-empty">\n' +
        '      <p>' + emptyCopy + '</p>\n' +
        '      <a class="related-empty-link" href="/journal">Browse the Journal &rarr;</a>\n' +
        '    </div>\n';
    }
    return '<section class="related-section">\n' +
      '  <div class="related-inner">\n' +
      '    <div class="label">More from the Journal</div>\n' +
      '    <h2>Where this thread continues.</h2>\n' + bodyHtml + tailNote +
      '  </div>\n' +
      '</section>\n';
  }

  function renderJsonLd(post) {
    var url = 'https://studiojnsq.com/journal/' + (post.slug || '');
    var img = resolveImg(post.heroImage) || 'https://studiojnsq.com/images/jnsq-logo-mark.png';
    var blogPosting = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      'headline': post.title || '',
      'description': post.metaDescription || post.excerpt || '',
      'image': img,
      'url': url,
      'mainEntityOfPage': { '@type': 'WebPage', '@id': url },
      'datePublished': isoDate(post.publishDate),
      'dateModified': isoDate(post.updatedAt || post.publishDate),
      'author': { '@type': 'Person', 'name': post.author || 'Studio JNSQ', 'url': 'https://studiojnsq.com/about' },
      'publisher': { '@type': 'Organization', 'name': 'Studio JNSQ', 'url': 'https://studiojnsq.com', 'logo': { '@type': 'ImageObject', 'url': 'https://studiojnsq.com/images/jnsq-logo-mark.png' } },
      'keywords': post.keywords || (Array.isArray(post.tags) ? post.tags.join(', ') : ''),
      'articleSection': seriesLabel(post.series),
      'isPartOf': { '@type': 'Blog', 'name': seriesLabel(post.series), 'url': 'https://studiojnsq.com/journal?filter=' + (post.series || 'standalone') }
    };
    var blocks = ['<script type="application/ld+json">' + JSON.stringify(blogPosting) + '<\/script>'];
    if (post.faqs && post.faqs.length) {
      var faqPage = { '@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': post.faqs.map(function (f) {
        return { '@type': 'Question', 'name': f.question || '', 'acceptedAnswer': { '@type': 'Answer', 'text': f.answer || '' } };
      })};
      blocks.push('<script type="application/ld+json">' + JSON.stringify(faqPage) + '<\/script>');
    }
    var crumbItems = [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://studiojnsq.com/' },
      { '@type': 'ListItem', 'position': 2, 'name': 'Journal', 'item': 'https://studiojnsq.com/journal' }
    ];
    if (post.series) crumbItems.push({ '@type': 'ListItem', 'position': 3, 'name': seriesLabel(post.series), 'item': 'https://studiojnsq.com/journal?filter=' + post.series });
    crumbItems.push({ '@type': 'ListItem', 'position': crumbItems.length + 1, 'name': post.title || '', 'item': url });
    blocks.push('<script type="application/ld+json">' + JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': crumbItems }) + '<\/script>');
    return blocks.join('\n');
  }

  // ============================================================
  //  FOOTER + STYLES (mirror /blog/bip-15-why-your-marketing-is-working.html)
  // ============================================================
  function renderFooter() {
    return '<footer class="jnsq-footer">\n' +
      '  <div class="jnsq-container">\n' +
      '    <div class="jnsq-footer-grid" style="grid-template-columns: 1.6fr 1fr 1fr 1fr 1fr;">\n' +
      '      <div>\n' +
      '        <div class="jnsq-footer-brand">STUDIO <span class="accent">JNSQ</span></div>\n' +
      '        <p class="jnsq-footer-tagline">Others make you profitable. Brand equity makes you valuable.</p>\n' +
      '        <p style="font-family:\'Inter\',sans-serif;font-size:12px;color:var(--jnsq-mute);margin-top:var(--space-3);line-height:1.6;">The Brand Equity Architecture Firm For Valuable Brands.</p>\n' +
      '      </div>\n' +
      '      <div class="jnsq-footer-col"><h4>Discipline</h4><ul>\n' +
      '        <li><a href="/about">About Studio JNSQ</a></li>\n' +
      '        <li><a href="/journal">The Journal</a></li>\n' +
      '        <li><a href="/case-studies/">Case Studies</a></li>\n' +
      '        <li><a href="/diagnostic">Diagnostic</a></li>\n' +
      '      </ul></div>\n' +
      '      <div class="jnsq-footer-col"><h4>Frameworks</h4><ul>\n' +
      '        <li><a href="/diagnostic/MAD">MAD&#8482; Diagnostic</a></li>\n' +
      '        <li><a href="/diagnostic/RVF">RVF&#8482; Diagnostic</a></li>\n' +
      '        <li><a href="/journal/branding-vs-brand-equity-vs-brand-architecture">The doctrine</a></li>\n' +
      '        <li><a href="/journal?filter=foundation">Foundation series</a></li>\n' +
      '      </ul></div>\n' +
      '      <div class="jnsq-footer-col"><h4>Series</h4><ul>\n' +
      '        <li><a href="/journal?filter=bip">Brilliant In Public</a></li>\n' +
      '        <li><a href="/journal?filter=mad">MAD Series</a></li>\n' +
      '        <li><a href="/journal?filter=numbers">The Numbers</a></li>\n' +
      '        <li><a href="/journal?filter=diagnostics">Diagnostics</a></li>\n' +
      '      </ul></div>\n' +
      '      <div class="jnsq-footer-col"><h4>Connect</h4><ul>\n' +
      '        <li><a href="https://calendly.com/jerico-studio-jnsq/30min" target="_blank" rel="noopener">Book a call</a></li>\n' +
      '        <li><a href="/diagnostic">Start a diagnosis</a></li>\n' +
      '        <li><a href="/case-studies/">See client work</a></li>\n' +
      '      </ul></div>\n' +
      '    </div>\n' +
      '    <div class="jnsq-footer-bottom">\n' +
      '      <div>&copy; 2026 Studio JNSQ. The brand equity architecture firm for valuable brands.</div>\n' +
      '      <div class="legal"><a href="/">studiojnsq.com</a></div>\n' +
      '    </div>\n' +
      '  </div>\n' +
      '</footer>\n';
  }

  function renderCanonicalStyles() {
    return '<style>\n' +
"body { background: var(--jnsq-bg); color: var(--jnsq-body); font-family: 'Inter', sans-serif; -webkit-font-smoothing: antialiased; }\n" +
"* { margin: 0; padding: 0; box-sizing: border-box; }\n" +
"html { scroll-behavior: smooth; scroll-padding-top: 90px; }\n" +
".wide-container { max-width: 1320px; margin: 0 auto; padding: 0 var(--space-4); }\n" +
"@media (min-width: 1440px) { .wide-container { padding: 0 var(--space-5); } }\n" +
".article-hero { padding: var(--space-7) 0 var(--space-6); position: relative; overflow: hidden; }\n" +
".article-hero::before { content: ''; position: absolute; inset: 0; z-index: -1; background: radial-gradient(ellipse 55% 40% at 15% 25%, rgba(253,213,0,0.14), transparent 70%), radial-gradient(ellipse 50% 40% at 85% 75%, rgba(253,213,0,0.09), transparent 70%); animation: jnsqDrift 28s var(--ease-in-out-soft) infinite alternate; }\n" +
".hero-grid { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: var(--space-6); align-items: center; }\n" +
"@media (max-width: 960px) { .hero-grid { grid-template-columns: 1fr; gap: var(--space-5); } .hero-grid .hero-img-side { order: -1; } }\n" +
".breadcrumb { font-size: 12px; font-weight: 500; letter-spacing: 0.04em; color: var(--jnsq-mute); margin-bottom: var(--space-3); }\n" +
".breadcrumb a { color: var(--jnsq-yellow); text-decoration: none; transition: text-shadow var(--dur-quick) ease; }\n" +
".breadcrumb a:hover { text-shadow: 0 0 12px rgba(253,213,0,0.45); }\n" +
".series-chip { display: inline-flex; align-items: center; gap: 8px; background: var(--jnsq-ink); color: var(--jnsq-yellow); font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; padding: 7px 14px; border-radius: 4px; text-decoration: none; margin-bottom: var(--space-3); transition: transform var(--dur-quick) var(--ease-out-soft), box-shadow var(--dur-quick) ease; }\n" +
".series-chip:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(26,26,26,0.12); }\n" +
".article-title { font-family: 'Lora', Georgia, serif; font-size: clamp(2rem, 3.6vw, 3rem); font-weight: 500; line-height: 1.08; letter-spacing: -0.015em; color: var(--jnsq-ink); max-width: 18ch; margin: 0 0 var(--space-3); }\n" +
".article-excerpt { font-family: 'Lora', Georgia, serif; font-size: clamp(1.0625rem, 1.4vw, 1.25rem); font-style: italic; line-height: 1.5; color: var(--jnsq-body); max-width: 50ch; margin: 0 0 var(--space-4); }\n" +
".article-meta { display: flex; gap: var(--space-3); flex-wrap: wrap; font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--jnsq-mute); }\n" +
".article-meta strong { color: var(--jnsq-ink); font-weight: 700; }\n" +
".hero-img-side { width: 100%; }\n" +
".hero-img-frame { position: relative; width: 100%; aspect-ratio: 3 / 2; border-radius: 6px; overflow: hidden; background: linear-gradient(135deg, rgba(253,213,0,0.18), rgba(253,213,0,0.04)), var(--jnsq-paper); box-shadow: 0 24px 60px rgba(26,26,26,0.10); }\n" +
".hero-img-frame img { width: 100%; height: 100%; object-fit: cover; display: block; }\n" +
".hero-img-frame .placeholder { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 14px; padding: var(--space-4); font-family: 'Lora', Georgia, serif; }\n" +
".hero-img-frame .placeholder .mark { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase; color: var(--jnsq-yellow); text-shadow: 0 0 14px rgba(253,213,0,0.35); }\n" +
".hero-img-frame .placeholder .ph-title { font-size: clamp(1.125rem, 2vw, 1.5rem); font-style: italic; color: var(--jnsq-ink); text-align: center; max-width: 32ch; line-height: 1.35; }\n" +
/* Stack hero: title/byline on top, big hero image below at full width */
".article-hero-stack .wide-container { display: flex; flex-direction: column; align-items: center; text-align: center; }\n" +
".hero-stack-text { max-width: 900px; margin: 0 auto var(--space-6); padding: 0 var(--space-4); }\n" +
".hero-stack-text .breadcrumb { justify-content: center; text-align: center; }\n" +
".hero-stack-text .series-chip { margin-left: auto; margin-right: auto; }\n" +
".hero-stack-text .article-title { max-width: none; text-align: center; margin-left: auto; margin-right: auto; font-size: clamp(2.2rem, 4.2vw, 3.6rem); line-height: 1.05; }\n" +
".hero-stack-text .article-excerpt { max-width: 62ch; text-align: center; margin: 0 auto var(--space-4); }\n" +
".hero-stack-text .article-meta { justify-content: center; }\n" +
".hero-stack-img { width: 100%; max-width: 1280px; margin: 0 auto; padding: 0 var(--space-4); }\n" +
".hero-stack-img .hero-img-frame { aspect-ratio: 16 / 9; border-radius: 10px; }\n" +
"@media (max-width: 720px) { .hero-stack-img .hero-img-frame { aspect-ratio: 4 / 3; } }\n" +
/* Kicker (recap line): matches next-edition teaser style (Lora italic, muted, 14px, bottom border) */
".article-kicker { font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 14px; line-height: 1.6; color: var(--jnsq-mute); padding: 0 0 var(--space-4); border-bottom: 1px solid var(--jnsq-line); margin: 0 0 var(--space-5); }\n" +
".article-shell { max-width: 1320px; margin: 0 auto; padding: var(--space-7) var(--space-4) var(--space-5); display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: var(--space-6); align-items: start; }\n" +
"@media (max-width: 1024px) { .article-shell { grid-template-columns: 1fr; gap: var(--space-5); } .article-aside { order: -1; position: static !important; } }\n" +
".article-main { min-width: 0; max-width: 760px; }\n" +
".article-main .canon-body h2 { font-family: 'Lora', Georgia, serif; font-size: clamp(1.5rem, 2.5vw, 2rem); font-weight: 500; line-height: 1.2; letter-spacing: -0.005em; color: var(--jnsq-ink); margin: var(--space-6) 0 var(--space-3); scroll-margin-top: 90px; }\n" +
".article-main .canon-body h2::before { content: ''; display: block; width: 36px; height: 3px; background: var(--jnsq-yellow); margin-bottom: 14px; border-radius: 2px; }\n" +
".article-main .canon-body p, .article-main .closing-block-plain p { font-family: 'Inter', sans-serif; font-size: 1.0625rem; line-height: 1.85; color: var(--jnsq-body); margin-bottom: var(--space-3); }\n" +
".article-main .canon-body strong, .article-main .closing-block-plain strong { color: var(--jnsq-ink); font-weight: 600; }\n" +
".article-main .canon-body em, .article-main .closing-block-plain em { color: var(--jnsq-ink); font-style: italic; }\n" +
".article-main .canon-body a, .article-main .closing-block-plain a { color: var(--jnsq-ink); text-decoration: underline; text-decoration-color: var(--jnsq-yellow); text-decoration-thickness: 2px; text-underline-offset: 4px; transition: background var(--dur-quick) ease; }\n" +
".article-main .canon-body a:hover, .article-main .closing-block-plain a:hover { background: var(--jnsq-yellow-soft); }\n" +
".article-main .canon-body ol, .article-main .canon-body ul { margin: 0 0 var(--space-3) var(--space-4); }\n" +
".article-main .canon-body ol li, .article-main .canon-body ul li { margin-bottom: 12px; line-height: 1.75; font-size: 1.0625rem; }\n" +
".article-main .canon-body ol li::marker { color: var(--jnsq-yellow); font-weight: 700; }\n" +
".article-main .canon-body blockquote { border-left: 4px solid var(--jnsq-yellow); padding: var(--space-3) var(--space-4); margin: var(--space-5) 0; background: rgba(253,213,0,0.04); font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 1.25rem; line-height: 1.4; color: var(--jnsq-ink); }\n" +
".article-main .lead-italic { font-family: 'Inter', sans-serif; font-style: italic; color: var(--jnsq-body); margin-bottom: var(--space-3); font-size: 1.0625rem; line-height: 1.85; }\n" +
".what-this-means { background: linear-gradient(135deg, rgba(253,213,0,0.10), rgba(253,213,0,0.04)); border: 1px solid rgba(253,213,0,0.30); border-radius: 8px; padding: var(--space-5); margin: var(--space-6) 0; position: relative; }\n" +
".what-this-means .label { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--jnsq-yellow); margin-bottom: var(--space-2); text-shadow: 0 0 14px rgba(253,213,0,0.30); }\n" +
".what-this-means h3 { font-family: 'Lora', Georgia, serif; font-size: 1.375rem; font-weight: 500; color: var(--jnsq-ink); margin-bottom: var(--space-3); line-height: 1.3; }\n" +
".what-this-means p { margin-bottom: var(--space-2); font-family: 'Inter', sans-serif; font-size: 1.0625rem; line-height: 1.85; color: var(--jnsq-body); }\n" +
".what-this-means ol { margin: var(--space-3) 0 0 var(--space-4); }\n" +
".what-this-means ol li { font-family: 'Inter', sans-serif; font-size: 1.0625rem; line-height: 1.75; color: var(--jnsq-body); margin-bottom: 12px; }\n" +
".what-this-means ol li::marker { color: var(--jnsq-yellow); font-weight: 700; }\n" +
".pull-quote { font-family: 'Lora', Georgia, serif; font-weight: 500; font-style: italic; font-size: clamp(1.375rem, 2.2vw, 1.75rem); line-height: 1.35; color: var(--jnsq-ink); border-left: 4px solid var(--jnsq-yellow); padding: var(--space-3) var(--space-4); margin: var(--space-6) 0; background: rgba(253,213,0,0.04); letter-spacing: -0.005em; }\n" +
".pull-quote .attribution { display: block; font-style: normal; font-size: 12px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--jnsq-mute); margin-top: var(--space-2); }\n" +
".try-this { background: var(--jnsq-ink); color: #fff; border-radius: 8px; padding: var(--space-5); margin: var(--space-5) 0; position: relative; overflow: hidden; }\n" +
".try-this::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--jnsq-yellow); }\n" +
".try-this .label { display: inline-block; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--jnsq-yellow); margin-bottom: var(--space-3); text-shadow: 0 0 14px rgba(253,213,0,0.40); }\n" +
".try-this h3 { font-family: 'Lora', Georgia, serif; font-size: 1.375rem; font-weight: 500; color: #fff; margin-bottom: var(--space-3); line-height: 1.3; }\n" +
".try-this p { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.85); margin-bottom: 0; }\n" +
/* Promo callout: prominent CTA box shown when the post has an active promo gate. */
".promo-callout { margin: var(--space-6) 0 var(--space-5); background: linear-gradient(135deg, rgba(253,213,0,0.14), rgba(253,213,0,0.05)); border: 1px solid rgba(253,213,0,0.42); border-radius: 10px; padding: var(--space-5) var(--space-5) var(--space-5); position: relative; overflow: hidden; }\n" +
".promo-callout::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: var(--jnsq-yellow); }\n" +
".promo-callout-inner { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }\n" +
".promo-callout-eyebrow { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--jnsq-yellow); text-shadow: 0 0 12px rgba(253,213,0,0.35); }\n" +
".promo-callout-title { font-family: 'Lora', Georgia, serif; font-size: clamp(1.375rem, 1.9vw, 1.625rem); font-weight: 500; color: var(--jnsq-ink); margin: 0; line-height: 1.25; letter-spacing: -0.01em; }\n" +
".promo-callout-body { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.6; color: var(--jnsq-body); margin: 0; max-width: 46ch; }\n" +
/* Button: hardcoded hex so it renders correctly even if CSS vars aren't inherited into the anchor */
".promo-callout-btn { display: inline-flex; align-items: center; padding: 14px 24px; background: #1A1A1A; color: #FDD500 !important; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; text-decoration: none !important; border-radius: 6px; margin-top: 4px; transition: transform 0.15s ease, box-shadow 0.15s ease; cursor: pointer; border: 2px solid #1A1A1A; }\n" +
".promo-callout-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(26,26,26,0.16); color: #FDD500 !important; background: #1A1A1A; }\n" +
".promo-callout-btn:visited { color: #FDD500 !important; }\n" +
".next-edition { font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 14px; line-height: 1.6; color: var(--jnsq-mute); padding: var(--space-3) 0; border-top: 1px solid var(--jnsq-line); margin-top: var(--space-5); }\n" +
".next-edition a { color: var(--jnsq-ink); text-decoration: underline; text-decoration-color: var(--jnsq-yellow); text-decoration-thickness: 1.5px; text-underline-offset: 3px; }\n" +
".sign-off { font-family: 'Lora', Georgia, serif; font-weight: 500; font-size: 1.5rem; color: var(--jnsq-ink); margin: var(--space-5) 0 var(--space-3); letter-spacing: -0.01em; }\n" +
".article-aside { position: sticky; top: 80px; display: flex; flex-direction: column; gap: var(--space-3); max-height: calc(100vh - 96px); overflow-y: auto; padding-right: 4px; }\n" +
".article-aside::-webkit-scrollbar { width: 4px; }\n" +
".article-aside::-webkit-scrollbar-thumb { background: var(--jnsq-line); border-radius: 2px; }\n" +
".aside-card { background: var(--jnsq-paper); border: 1px solid var(--jnsq-line); border-radius: 6px; padding: var(--space-3) var(--space-4); position: relative; transition: border-color var(--dur-medium) ease; }\n" +
".aside-card:hover { border-color: rgba(253,213,0,0.30); }\n" +
".aside-label { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--jnsq-yellow); margin-bottom: 10px; }\n" +
".aside-card h4 { font-family: 'Lora', Georgia, serif; font-size: 14px; font-weight: 500; color: var(--jnsq-ink); margin-bottom: 6px; line-height: 1.3; }\n" +
".aside-card p { font-family: 'Inter', sans-serif; font-size: 12.5px; line-height: 1.55; color: var(--jnsq-body); }\n" +
".aside-card p a, .aside-card .inline-link { color: var(--jnsq-ink); text-decoration: underline; text-decoration-color: var(--jnsq-yellow); text-decoration-thickness: 1.5px; text-underline-offset: 3px; }\n" +
".aside-card p a:hover, .aside-card .inline-link:hover { background: var(--jnsq-yellow-soft); }\n" +
".insights-list { list-style: none; padding: 0; margin: 0; }\n" +
".insights-list li { border-left: 2px solid var(--jnsq-yellow); padding: 8px 0 8px 12px; font-family: 'Inter', sans-serif; font-size: 12.5px; line-height: 1.5; color: var(--jnsq-body); margin-bottom: 8px; }\n" +
".insights-list li:last-child { margin-bottom: 0; }\n" +
".toc-list { list-style: none; padding: 0; margin: 0; }\n" +
".toc-list li { padding: 6px 0; border-bottom: 1px dashed rgba(0,0,0,0.06); }\n" +
".toc-list li:last-child { border-bottom: none; }\n" +
".toc-list a { display: block; font-family: 'Inter', sans-serif; font-size: 12px; color: var(--jnsq-body); text-decoration: none; transition: color var(--dur-quick) ease, padding-left var(--dur-quick) ease; }\n" +
".toc-list a:hover { color: var(--jnsq-ink); padding-left: 6px; background: none; }\n" +
".toc-list a::before { content: '→'; color: var(--jnsq-yellow); margin-right: 6px; font-weight: 700; opacity: 0.7; }\n" +
".aside-card.media-card { background: var(--jnsq-yellow); border-color: var(--jnsq-yellow); }\n" +
".aside-card.media-card .aside-label { color: var(--jnsq-ink); opacity: 0.7; }\n" +
".aside-card.media-card h4 { color: var(--jnsq-ink); }\n" +
".aside-card.media-card p { color: var(--jnsq-ink); opacity: 0.85; margin-bottom: 10px; }\n" +
".aside-card.media-card .media-btn { display: block; text-align: center; background: var(--jnsq-ink); color: var(--jnsq-yellow); font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 10px 12px; border-radius: 4px; text-decoration: none; transition: transform var(--dur-quick) var(--ease-out-soft), box-shadow var(--dur-quick) ease; }\n" +
".aside-card.media-card .media-btn:hover { transform: translateY(-2px); box-shadow: 0 10px 24px rgba(26,26,26,0.20); background: var(--jnsq-ink); }\n" +
".aside-card.engage-card { text-align: left; }\n" +
".aside-card .engage-btn { display: block; text-align: center; background: var(--jnsq-yellow); color: var(--jnsq-ink) !important; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 12px 16px; border-radius: 4px; text-decoration: none !important; margin-top: 10px; box-shadow: 0 6px 18px rgba(253,213,0,0.30); transition: transform var(--dur-quick) var(--ease-out-soft), box-shadow var(--dur-quick) ease; }\n" +
".aside-card .engage-btn:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(253,213,0,0.40); background: var(--jnsq-yellow); color: var(--jnsq-ink) !important; }\n" +
".faq-section { padding: var(--space-7) 0 var(--space-5); }\n" +
".faq-inner { max-width: 1320px; margin: 0 auto; padding: 0 var(--space-4); }\n" +
".faq-section .label { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--jnsq-yellow); margin-bottom: var(--space-3); text-align: center; }\n" +
".faq-section h2 { font-family: 'Lora', Georgia, serif; font-size: clamp(1.5rem, 2.5vw, 2.25rem); font-weight: 500; color: var(--jnsq-ink); text-align: center; margin-bottom: var(--space-5); letter-spacing: -0.005em; }\n" +
".faq-grid { max-width: 980px; margin: 0 auto; display: flex; flex-direction: column; gap: 12px; }\n" +
".faq-grid details { background: var(--jnsq-paper); border: 1px solid var(--jnsq-line); border-radius: 8px; padding: 18px 22px; position: relative; overflow: hidden; transition: border-color var(--dur-medium) ease, box-shadow var(--dur-medium) var(--ease-out-soft), transform var(--dur-medium) var(--ease-out-soft), background var(--dur-medium) ease; }\n" +
".faq-grid details::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--jnsq-yellow); transform: scaleX(0); transform-origin: left; transition: transform var(--dur-slow) var(--ease-out-soft); }\n" +
".faq-grid details:hover { border-color: rgba(253,213,0,0.30); box-shadow: 0 14px 36px rgba(26,26,26,0.07); transform: translateY(-2px); }\n" +
".faq-grid details:hover::before { transform: scaleX(1); }\n" +
".faq-grid details[open] { border-color: rgba(253,213,0,0.55); background: linear-gradient(135deg, rgba(253,213,0,0.07), rgba(253,213,0,0.02)); box-shadow: 0 14px 36px rgba(26,26,26,0.05); transform: none; }\n" +
".faq-grid details[open]::before { transform: scaleX(1); }\n" +
".faq-grid summary { font-family: 'Inter', sans-serif; font-size: 16px; font-weight: 600; color: var(--jnsq-ink); cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: var(--space-3); transition: color var(--dur-quick) ease; }\n" +
".faq-grid summary::-webkit-details-marker { display: none; }\n" +
".faq-grid summary::after { content: '+'; font-size: 26px; font-weight: 300; color: var(--jnsq-yellow); flex-shrink: 0; transition: transform 0.3s var(--ease-out-soft); line-height: 1; }\n" +
".faq-grid details[open] summary { font-weight: 700; }\n" +
".faq-grid details[open] summary::after { transform: rotate(45deg); }\n" +
".faq-grid details p { font-family: 'Inter', sans-serif; font-size: 15px; line-height: 1.75; color: var(--jnsq-body); padding-top: var(--space-3); margin: 0; max-width: 80ch; border-top: 1px dashed rgba(253,213,0,0.30); margin-top: var(--space-3); }\n" +
".faq-grid a { color: var(--jnsq-ink); text-decoration: underline; text-decoration-color: var(--jnsq-yellow); text-decoration-thickness: 2px; text-underline-offset: 3px; }\n" +
".go-deeper { padding: var(--space-7) 0 var(--space-5); }\n" +
".go-deeper-inner { max-width: 1320px; margin: 0 auto; padding: 0 var(--space-4); }\n" +
".go-deeper .header { text-align: center; margin-bottom: var(--space-5); }\n" +
".go-deeper .label { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--jnsq-yellow); margin-bottom: var(--space-2); }\n" +
".go-deeper h2 { font-family: 'Lora', Georgia, serif; font-size: clamp(1.5rem, 2.5vw, 2.25rem); font-weight: 500; color: var(--jnsq-ink); letter-spacing: -0.005em; }\n" +
".go-deeper .go-deeper-intro { font-family: 'Inter', sans-serif; font-size: 1rem; line-height: 1.6; color: var(--jnsq-body); max-width: 640px; margin: var(--space-3) auto 0; text-align: center; }\n" +
".deeper-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); }\n" +
"@media (max-width: 900px) { .deeper-grid { grid-template-columns: 1fr; } }\n" +
".deeper-card { background: var(--jnsq-paper); border: 1px solid var(--jnsq-line); border-radius: 6px; padding: var(--space-4); text-decoration: none; color: inherit; position: relative; transition: transform var(--dur-medium) var(--ease-out-soft), box-shadow var(--dur-medium) var(--ease-out-soft), border-color var(--dur-medium) ease; }\n" +
".deeper-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--jnsq-yellow); transform: scaleX(0); transform-origin: left; transition: transform var(--dur-slow) var(--ease-out-soft); }\n" +
".deeper-card:hover { transform: translateY(-4px); box-shadow: 0 20px 50px rgba(26,26,26,0.07); border-color: rgba(253,213,0,0.30); }\n" +
".deeper-card:hover::before { transform: scaleX(1); }\n" +
".deeper-card .num { font-family: 'Lora', Georgia, serif; font-size: 1.75rem; font-weight: 500; color: var(--jnsq-yellow); line-height: 1; margin-bottom: 12px; }\n" +
".deeper-card h3 { font-family: 'Lora', Georgia, serif; font-size: 1.0625rem; font-weight: 500; line-height: 1.35; color: var(--jnsq-ink); margin-bottom: 6px; }\n" +
".deeper-card p { font-family: 'Inter', sans-serif; font-size: 13.5px; color: var(--jnsq-body); line-height: 1.55; }\n" +
".deeper-card .series-tag { display: inline-block; font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--jnsq-mute); margin-top: 10px; }\n" +
".tags-section { padding: var(--space-4) 0; }\n" +
".tags-inner { max-width: 1320px; margin: 0 auto; padding: 0 var(--space-4); }\n" +
".tags-section .label { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--jnsq-mute); margin-bottom: var(--space-2); }\n" +
".tags-row { display: flex; gap: 8px; flex-wrap: wrap; }\n" +
".tag-pill { display: inline-block; padding: 7px 14px; background: var(--jnsq-paper); border: 1px solid var(--jnsq-line); border-radius: 100px; font-family: 'Inter', sans-serif; font-size: 12.5px; font-weight: 500; color: var(--jnsq-body); text-decoration: none; transition: all var(--dur-quick) ease; }\n" +
".tag-pill:hover { background: var(--jnsq-yellow-soft); border-color: var(--jnsq-yellow); color: var(--jnsq-ink); transform: translateY(-1px); }\n" +
".series-nav-wrap { padding: var(--space-4) 0; }\n" +
".series-nav { max-width: 1320px; margin: 0 auto; padding: 0 var(--space-4); display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }\n" +
"@media (max-width: 700px) { .series-nav { grid-template-columns: 1fr; } }\n" +
".series-nav-card { background: var(--jnsq-bg); border: 1px solid var(--jnsq-line); border-radius: 6px; padding: var(--space-3) var(--space-4); text-decoration: none; color: inherit; transition: border-color var(--dur-medium) ease, transform var(--dur-medium) var(--ease-out-soft); }\n" +
".series-nav-card:hover { border-color: rgba(253,213,0,0.30); transform: translateY(-2px); }\n" +
".series-nav-card .direction { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--jnsq-yellow); margin-bottom: 6px; }\n" +
".series-nav-card.next { text-align: right; }\n" +
".series-nav-card h4 { font-family: 'Lora', Georgia, serif; font-size: 1rem; font-weight: 500; color: var(--jnsq-ink); line-height: 1.3; }\n" +
".series-nav-card.disabled { opacity: 0.4; pointer-events: none; }\n" +
".related-section { background: var(--jnsq-paper); padding: var(--space-7) 0; border-top: 1px solid var(--jnsq-line); }\n" +
".related-inner { max-width: 1320px; margin: 0 auto; padding: 0 var(--space-4); }\n" +
".related-section .label { font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: var(--jnsq-yellow); margin-bottom: var(--space-2); text-align: center; }\n" +
".related-section h2 { font-family: 'Lora', Georgia, serif; font-size: clamp(1.5rem, 2.5vw, 2.25rem); font-weight: 500; color: var(--jnsq-ink); text-align: center; margin-bottom: var(--space-5); letter-spacing: -0.005em; }\n" +
".related-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-3); }\n" +
"@media (max-width: 900px) { .related-grid { grid-template-columns: 1fr; } }\n" +
".related-empty { max-width: 640px; margin: 0 auto; text-align: center; padding: var(--space-5) var(--space-4); border: 1px dashed var(--jnsq-line); border-radius: 8px; background: rgba(253,213,0,0.03); }\n" +
".related-empty p { font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 1.0625rem; line-height: 1.6; color: var(--jnsq-body); margin: 0 0 var(--space-3); }\n" +
".related-empty-link { display: inline-block; font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--jnsq-ink); text-decoration: underline; text-decoration-color: var(--jnsq-yellow); text-decoration-thickness: 2px; text-underline-offset: 4px; }\n" +
".related-tail { max-width: 640px; margin: var(--space-4) auto 0; text-align: center; font-family: 'Lora', Georgia, serif; font-style: italic; font-size: 0.95rem; color: var(--jnsq-mute); line-height: 1.55; }\n" +
".related-card { background: var(--jnsq-bg); border: 1px solid var(--jnsq-line); border-radius: 6px; padding: var(--space-4); text-decoration: none; color: inherit; transition: transform var(--dur-medium) var(--ease-out-soft), box-shadow var(--dur-medium) var(--ease-out-soft), border-color var(--dur-medium) ease; }\n" +
".related-card:hover { transform: translateY(-3px); box-shadow: 0 18px 44px rgba(26,26,26,0.06); border-color: rgba(253,213,0,0.30); }\n" +
".r-title { font-family: 'Lora', Georgia, serif; font-size: 1.0625rem; font-weight: 500; line-height: 1.35; color: var(--jnsq-ink); margin-bottom: 8px; }\n" +
".r-excerpt { font-family: 'Inter', sans-serif; font-size: 13.5px; color: var(--jnsq-body); line-height: 1.55; }\n" +
".jnsq-footer .jnsq-footer-grid { grid-template-columns: 1.6fr 1fr 1fr 1fr 1fr; }\n" +
'</style>';
  }

  // ============================================================
  //  MAIN — render the complete canonical HTML for a post
  // ============================================================
  function renderCanonicalPost(post) {
    // Pre-decode entity strings that may have been double-encoded
    ['title', 'excerpt', 'opening', 'closing', 'signOff', 'metaDescription', 'ogDescription'].forEach(function (k) {
      if (post[k]) post[k] = decodeEntities(post[k]);
    });
    if (post.whatThisMeans) {
      ['headline', 'body', 'label'].forEach(function (k) { if (post.whatThisMeans[k]) post.whatThisMeans[k] = decodeEntities(post.whatThisMeans[k]); });
      if (Array.isArray(post.whatThisMeans.items)) post.whatThisMeans.items = post.whatThisMeans.items.map(decodeEntities);
    }
    if (post.pullQuote) {
      if (post.pullQuote.text) post.pullQuote.text = decodeEntities(post.pullQuote.text);
      if (post.pullQuote.attribution) post.pullQuote.attribution = decodeEntities(post.pullQuote.attribution);
    }
    if (post.tryThis) {
      if (post.tryThis.headline) post.tryThis.headline = decodeEntities(post.tryThis.headline);
      if (post.tryThis.body) post.tryThis.body = decodeEntities(post.tryThis.body);
    }
    if (Array.isArray(post.keyInsights)) post.keyInsights = post.keyInsights.map(decodeEntities);
    if (Array.isArray(post.faqs)) post.faqs = post.faqs.map(function (f) { return { question: decodeEntities(f.question), answer: decodeEntities(f.answer) }; });

    var processed = processBodyAndToc(post.body || '');
    // Auto-linkify doctrine CTAs inside the main body HTML (H2s + <p> paragraphs)
    var bodyHtml = linkifyHtmlAware(processed.body, post);
    var tocItems = processed.toc;

    var url = 'https://studiojnsq.com/journal/' + (post.slug || '');
    var heroImgFull = resolveImg(post.heroImage) || '';
    var titleSafe = escapeHtml(post.title || '');
    var descSafe = escapeAttr(post.metaDescription || post.excerpt || '');
    var ogDescSafe = escapeAttr(post.ogDescription || post.excerpt || '');
    var keywordsSafe = escapeAttr(post.keywords || (Array.isArray(post.tags) ? post.tags.join(', ') : ''));
    var authorSafe = escapeAttr(post.author || 'Studio JNSQ');

    return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'<meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'<title>' + titleSafe + (post.series === 'bip' && post.seriesIndex ? ' | BIP Ed.' + escapeHtml(post.seriesIndex) : '') + ' | Studio JNSQ</title>\n' +
'<meta name="description" content="' + descSafe + '">\n' +
'<meta name="keywords" content="' + keywordsSafe + '">\n' +
'<meta name="author" content="' + authorSafe + '">\n' +
'<link rel="canonical" href="' + escapeAttr(url) + '">\n' +
'<meta property="og:type" content="article">\n' +
'<meta property="og:title" content="' + titleSafe + '">\n' +
'<meta property="og:description" content="' + ogDescSafe + '">\n' +
'<meta property="og:url" content="' + escapeAttr(url) + '">\n' +
'<meta property="og:site_name" content="Studio JNSQ">\n' +
(heroImgFull ? '<meta property="og:image" content="' + escapeAttr(heroImgFull) + '">\n' : '') +
'<meta property="article:published_time" content="' + isoDate(post.publishDate) + '">\n' +
'<meta property="article:modified_time" content="' + isoDate(post.updatedAt || post.publishDate) + '">\n' +
'<meta property="article:author" content="' + authorSafe + '">\n' +
'<meta property="article:section" content="' + escapeAttr(seriesLabel(post.series)) + '">\n' +
(Array.isArray(post.tags) ? post.tags.map(function (t) { return '<meta property="article:tag" content="' + escapeAttr(t) + '">'; }).join('\n') + '\n' : '') +
'<meta name="twitter:card" content="summary_large_image">\n' +
'<meta name="twitter:title" content="' + titleSafe + '">\n' +
'<meta name="twitter:description" content="' + ogDescSafe + '">\n' +
(heroImgFull ? '<meta name="twitter:image" content="' + escapeAttr(heroImgFull) + '">\n' : '') +
'<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
'<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
'<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap" rel="stylesheet">\n' +
'<link rel="stylesheet" href="/css/jnsq-system.css?v=2">\n' +
renderCanonicalStyles() + '\n' +
renderJsonLd(post) + '\n' +
'</head>\n' +
'<body data-series="' + escapeAttr(post.series || 'standalone') + '" data-funnel-stage="' + escapeAttr(post.funnelStage || 'tofu') + '" data-series-index="' + escapeAttr(post.seriesIndex || '') + '">\n' +
'<div class="jnsq-scroll-progress"></div>\n' +
'<nav class="jnsq-nav">\n' +
'  <div class="jnsq-nav-inner">\n' +
'    <a href="/" class="jnsq-nav-logo">STUDIO <span class="accent">JNSQ</span></a>\n' +
'    <div class="jnsq-nav-links">\n' +
'      <a href="/">Home</a>\n' +
'      <a href="/about">About</a>\n' +
'      <a href="/journal">Journal</a>\n' +
'      <a href="/case-studies/">Case Studies</a>\n' +
'      <a href="/diagnostic">Diagnostic</a>\n' +
'    </div>\n' +
'    <a href="/diagnostic" class="jnsq-nav-cta">Take the Diagnostic</a>\n' +
'  </div>\n' +
'</nav>\n' +
renderHero(post) +
'<div class="article-shell">\n' +
'  <main class="article-main">\n' +
renderKicker(post) +
renderOpening(post) +
'    <div class="canon-body">' + bodyHtml + '</div>\n' +
renderWTM(post) +
renderPullQuote(post) +
renderClosing(post) +
renderPromoCallout(post) +
renderTryThis(post) +
renderNextEdition(post) +
renderSignOff(post) +
'  </main>\n' +
renderSidebar(post, tocItems) +
'</div>\n' +
renderFAQ(post) +
renderGoDeeper(post) +
renderTags(post) +
renderSeriesNav(post) +
renderRelated(post) +
renderFooter() +
renderPromoModal(post) +
'<script src="/js/jnsq-system.js?v=2" defer><\/script>\n' +
renderPromoScript(post) +
'</body>\n</html>';
  }

  // ============================================================
  //  PROMO-GATE READER FLOW
  //  Renders a modal + client script when the post has an active
  //  promo gate. The linkifier turns "subscribe here" into a trigger.
  // ============================================================
  function renderPromoModal(post) {
    if (!post.promoGate || !post.promoGate.enabled) return '';
    var pg = post.promoGate;
    var codeType = pg.codeType === 'unique' ? 'unique' : 'shared';
    if (codeType === 'shared' && !pg.code) return '';
    if (codeType === 'unique' && !pg.codeSuffix) return '';
    var expiryStr = pg.expiry ? ' &middot; Expires ' + escapeHtml(String(pg.expiry).slice(0,10)) : '';
    var tierStr = pg.tier ? escapeHtml(pg.tier) : 'diagnostic report';
    var subCopy = codeType === 'unique'
      ? 'Tell us who you are and we generate a code tied to your name. One-time reader promo, no spam.'
      : 'Tell us a little about you and we send the code the moment you submit. One-time reader promo, no spam.';
    // For shared codes we know the code up-front; for unique we display "…" until server returns.
    var initialCode = codeType === 'shared' ? escapeHtml(pg.code) : '&hellip;';
    return '\n<div id="jnsq-promo-modal" class="jnsq-promo-modal" aria-hidden="true" role="dialog" aria-labelledby="promo-title">\n' +
      '  <div class="jnsq-promo-backdrop" data-close></div>\n' +
      '  <div class="jnsq-promo-panel">\n' +
      '    <button class="jnsq-promo-close" aria-label="Close" data-close>&times;</button>\n' +
      '    <div class="jnsq-promo-view jnsq-promo-view-form">\n' +
      '      <div class="jnsq-promo-eyebrow">Free ' + tierStr + '</div>\n' +
      '      <h3 id="promo-title">Get your code.</h3>\n' +
      '      <p>' + subCopy + '</p>\n' +
      '      <form class="jnsq-promo-form" novalidate>\n' +
      '        <div class="jnsq-promo-row">\n' +
      '          <label>Full name<span class="req">*</span><input type="text" name="name" required autocomplete="name"></label>\n' +
      '          <label>Email<span class="req">*</span><input type="email" name="email" required autocomplete="email"></label>\n' +
      '        </div>\n' +
      '        <div class="jnsq-promo-row">\n' +
      '          <label>Company<span class="req">*</span><input type="text" name="company" required autocomplete="organization"></label>\n' +
      '          <label>Position<input type="text" name="position" autocomplete="organization-title"></label>\n' +
      '        </div>\n' +
      '        <div class="jnsq-promo-row">\n' +
      '          <label>Phone number<input type="tel" name="phone" autocomplete="tel"></label>\n' +
      '          <label>LinkedIn URL<input type="url" name="linkedin" placeholder="https://linkedin.com/in/..." autocomplete="url"></label>\n' +
      '        </div>\n' +
      '        <button type="submit" class="jnsq-promo-submit">Send me the code &rarr;</button>\n' +
      '        <div class="jnsq-promo-error" role="alert"></div>\n' +
      '        <p class="jnsq-promo-fine">Fields marked <span class="req">*</span> are required. We handle your data per our privacy notice.</p>\n' +
      '      </form>\n' +
      '    </div>\n' +
      '    <div class="jnsq-promo-view jnsq-promo-view-success" hidden>\n' +
      '      <div class="jnsq-promo-eyebrow">Your code</div>\n' +
      '      <div class="jnsq-promo-code-box">\n' +
      '        <div class="jnsq-promo-code-value" data-code>' + initialCode + '</div>\n' +
      '        <button type="button" class="jnsq-promo-copy" data-copy>Copy</button>\n' +
      '      </div>\n' +
      '      <p class="jnsq-promo-detail">Apply at checkout on the <a href="/diagnostic">diagnostic</a> page' +
        (pg.discountPct ? ' for ' + escapeHtml(pg.discountPct) + '% off ' + tierStr : '') +
        expiryStr + '.</p>\n' +
      '      <a class="jnsq-promo-diag-cta" href="/diagnostic?src=blog-' + escapeAttr(post.slug || '') + '" data-diag-cta>Take the diagnostic &rarr;</a>\n' +
      '    </div>\n' +
      '  </div>\n' +
      '</div>\n' +
      // Modal CSS
      '<style>\n' +
      '.jnsq-promo-modal { position: fixed; inset: 0; display: none; z-index: 9999; align-items: center; justify-content: center; padding: 24px; }\n' +
      '.jnsq-promo-modal.open { display: flex; }\n' +
      '.jnsq-promo-backdrop { position: absolute; inset: 0; background: rgba(26,26,26,0.55); backdrop-filter: blur(3px); }\n' +
      '.jnsq-promo-panel { position: relative; background: #FBF8EC; max-width: 540px; width: 100%; border-radius: 10px; padding: 36px 32px 32px; box-shadow: 0 30px 80px rgba(26,26,26,0.30); max-height: 92vh; overflow-y: auto; }\n' +
      '.jnsq-promo-close { position: absolute; top: 12px; right: 14px; background: transparent; border: none; font-size: 26px; color: #6B7B8D; cursor: pointer; line-height: 1; }\n' +
      '.jnsq-promo-eyebrow { font-family: "Inter", sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #A88600; margin-bottom: 8px; }\n' +
      '.jnsq-promo-panel h3 { font-family: "Lora", Georgia, serif; font-size: 1.75rem; margin: 0 0 8px; color: #1A1A1A; font-weight: 500; }\n' +
      '.jnsq-promo-panel p { font-family: "Inter", sans-serif; font-size: 14.5px; line-height: 1.55; color: #3d3d3d; margin: 0 0 18px; }\n' +
      '.jnsq-promo-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }\n' +
      '@media (max-width: 520px) { .jnsq-promo-row { grid-template-columns: 1fr; } }\n' +
      '.jnsq-promo-form label { display: block; font-family: "Inter", sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #1A1A1A; margin-bottom: 0; }\n' +
      '.jnsq-promo-form .req { color: #B8412A; margin-left: 3px; }\n' +
      '.jnsq-promo-form input { display: block; width: 100%; padding: 10px 12px; margin-top: 6px; border: 1px solid #E0E0D8; border-radius: 6px; font-family: "Inter", sans-serif; font-size: 14px; background: #fff; color: #1A1A1A; box-sizing: border-box; }\n' +
      '.jnsq-promo-form input:focus { outline: none; border-color: #FDD500; box-shadow: 0 0 0 3px rgba(253,213,0,0.25); }\n' +
      '.jnsq-promo-form input:invalid:not(:placeholder-shown) { border-color: #E39B85; }\n' +
      '.jnsq-promo-submit { width: 100%; padding: 14px 16px; background: #1A1A1A; color: #FDD500; border: none; border-radius: 6px; font-family: "Inter", sans-serif; font-size: 12.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; margin-top: 8px; }\n' +
      '.jnsq-promo-submit:disabled { opacity: 0.6; cursor: wait; }\n' +
      '.jnsq-promo-error { color: #B8412A; font-size: 13px; margin-top: 10px; min-height: 18px; }\n' +
      '.jnsq-promo-fine { font-size: 11px !important; color: #6B7B8D !important; margin: 10px 0 0 !important; line-height: 1.5 !important; }\n' +
      '.jnsq-promo-code-box { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; background: rgba(253,213,0,0.12); border: 1px dashed var(--jnsq-yellow); border-radius: 8px; margin: 12px 0 16px; }\n' +
      '.jnsq-promo-code-value { font-family: "Inter", sans-serif; font-size: 1.4rem; font-weight: 700; letter-spacing: 0.14em; color: var(--jnsq-ink); }\n' +
      '.jnsq-promo-copy { background: var(--jnsq-ink); color: #fff; border: none; padding: 8px 14px; border-radius: 4px; font-family: "Inter", sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }\n' +
      '.jnsq-promo-copy.copied { background: #0F6E56; }\n' +
      '.jnsq-promo-detail { font-size: 13px; color: var(--jnsq-mute); margin-bottom: 20px; }\n' +
      '.jnsq-promo-detail a { color: var(--jnsq-ink); text-decoration: underline; text-decoration-color: var(--jnsq-yellow); }\n' +
      '.jnsq-promo-diag-cta { display: inline-block; padding: 12px 18px; background: var(--jnsq-yellow); color: var(--jnsq-ink); font-family: "Inter", sans-serif; font-size: 12.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; text-decoration: none; border-radius: 6px; }\n' +
      '.jnsq-promo-trigger { color: var(--jnsq-ink); text-decoration: underline; text-decoration-color: var(--jnsq-yellow); text-decoration-thickness: 2px; text-underline-offset: 3px; cursor: pointer; }\n' +
      '.jnsq-promo-trigger:hover { background: rgba(253,213,0,0.15); }\n' +
      '</style>\n';
  }

  function renderPromoScript(post) {
    if (!post.promoGate || !post.promoGate.enabled) return '';
    var pg = post.promoGate;
    var codeType = pg.codeType === 'unique' ? 'unique' : 'shared';
    if (codeType === 'shared' && !pg.code) return '';
    if (codeType === 'unique' && !pg.codeSuffix) return '';
    var slug = post.slug || '';
    return '<script>\n' +
      '(function(){\n' +
      '  var modal = document.getElementById("jnsq-promo-modal");\n' +
      '  if (!modal) return;\n' +
      '  var formView = modal.querySelector(".jnsq-promo-view-form");\n' +
      '  var successView = modal.querySelector(".jnsq-promo-view-success");\n' +
      '  var form = modal.querySelector(".jnsq-promo-form");\n' +
      '  var errBox = modal.querySelector(".jnsq-promo-error");\n' +
      '  var submitBtn = modal.querySelector(".jnsq-promo-submit");\n' +
      '  var copyBtn = modal.querySelector(".jnsq-promo-copy");\n' +
      '  var codeValueEl = modal.querySelector("[data-code]");\n' +
      '  var diagCta = modal.querySelector("[data-diag-cta]");\n' +
      '  var currentTrigger = null;\n' +
      '  function openModal(trigger) {\n' +
      '    currentTrigger = trigger;\n' +
      '    var t = trigger || {};\n' +
      '    var ct = (t.dataset && t.dataset.codeType) || "shared";\n' +
      '    // For shared codes we can preview immediately; unique codes are generated on submit.\n' +
      '    if (ct === "shared" && t.dataset && t.dataset.code) codeValueEl.textContent = t.dataset.code;\n' +
      '    if (ct === "unique") codeValueEl.textContent = "\\u2026";\n' +
      '    formView.hidden = false; successView.hidden = true;\n' +
      '    errBox.textContent = "";\n' +
      '    modal.classList.add("open");\n' +
      '    modal.setAttribute("aria-hidden","false");\n' +
      '    setTimeout(function(){ var em = form.querySelector("input[name=name]"); if (em) em.focus(); }, 60);\n' +
      '  }\n' +
      '  function closeModal(){\n' +
      '    modal.classList.remove("open");\n' +
      '    modal.setAttribute("aria-hidden","true");\n' +
      '  }\n' +
      '  document.addEventListener("click", function(e){\n' +
      '    var t = e.target.closest(".jnsq-promo-trigger");\n' +
      '    if (t) { e.preventDefault(); openModal(t); return; }\n' +
      '    if (e.target.matches("[data-close]")) closeModal();\n' +
      '  });\n' +
      '  document.addEventListener("keydown", function(e){ if (e.key === "Escape" && modal.classList.contains("open")) closeModal(); });\n' +
      '  form.addEventListener("submit", function(e){\n' +
      '    e.preventDefault();\n' +
      '    var name = form.querySelector("input[name=name]").value.trim();\n' +
      '    var email = form.querySelector("input[name=email]").value.trim();\n' +
      '    var company = form.querySelector("input[name=company]").value.trim();\n' +
      '    var position = form.querySelector("input[name=position]").value.trim();\n' +
      '    var phone = form.querySelector("input[name=phone]").value.trim();\n' +
      '    var linkedin = form.querySelector("input[name=linkedin]").value.trim();\n' +
      '    if (!name) { errBox.textContent = "Please enter your full name."; return; }\n' +
      '    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) { errBox.textContent = "Please enter a valid email."; return; }\n' +
      '    if (!company) { errBox.textContent = "Please enter your company."; return; }\n' +
      '    errBox.textContent = "";\n' +
      '    submitBtn.disabled = true; submitBtn.textContent = "Sending...";\n' +
      '    var td = currentTrigger ? currentTrigger.dataset : {};\n' +
      '    fetch("/.netlify/functions/lead-capture", {\n' +
      '      method: "POST", headers: {"Content-Type":"application/json"},\n' +
      '      body: JSON.stringify({\n' +
      '        name: name, email: email, company: company,\n' +
      '        position: position, phone: phone, linkedin: linkedin,\n' +
      '        source: "blog:" + ' + JSON.stringify(slug) + ',\n' +
      '        code: td.code || "",\n' +
      '        codeType: td.codeType || "shared",\n' +
      '        codeSuffix: td.codeSuffix || "",\n' +
      '        tier: td.tier || "",\n' +
      '        discount: td.discount || ""\n' +
      '      })\n' +
      '    }).then(function(r){ return r.ok ? r.json() : r.json().then(function(j){ throw new Error(j.error || "Server error"); }); })\n' +
      '      .then(function(resp){\n' +
      '        // Server returns the FINAL code (shared echoes it back; unique generates it).\n' +
      '        var finalCode = (resp && resp.code) || td.code || "";\n' +
      '        if (finalCode) codeValueEl.textContent = finalCode;\n' +
      '        if (diagCta && finalCode) {\n' +
      '          var href = diagCta.getAttribute("href") || "/diagnostic";\n' +
      '          diagCta.setAttribute("href", href.split("&promo=")[0] + "&promo=" + encodeURIComponent(finalCode));\n' +
      '        }\n' +
      '        formView.hidden = true; successView.hidden = false;\n' +
      '      })\n' +
      '      .catch(function(err){ errBox.textContent = (err && err.message) ? err.message : "Something went wrong. Try again."; })\n' +
      '      .finally(function(){ submitBtn.disabled = false; submitBtn.textContent = "Send me the code \\u2192"; });\n' +
      '  });\n' +
      '  copyBtn.addEventListener("click", function(){\n' +
      '    var code = codeValueEl.textContent.trim();\n' +
      '    if (navigator.clipboard) {\n' +
      '      navigator.clipboard.writeText(code).then(function(){\n' +
      '        copyBtn.textContent = "Copied!"; copyBtn.classList.add("copied");\n' +
      '        setTimeout(function(){ copyBtn.textContent = "Copy"; copyBtn.classList.remove("copied"); }, 1800);\n' +
      '      });\n' +
      '    }\n' +
      '  });\n' +
      '})();\n' +
      '<\/script>\n';
  }

  // ============================================================
  //  SCORER — analyzes the RENDERED HTML, not just the form fields.
  //  Returns { total, criteria: [{name, pts, tip}], evaluatedAt }
  // ============================================================
  function scorePost(post, renderedHtml) {
    // Body-derived DOM analysis (works with any renderable HTML string)
    var html = renderedHtml || renderCanonicalPost(post);
    // Strip tags to get plain text for text-based checks
    var bodyOnly = post.body || '';
    var bodyPlain = bodyOnly.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    var htmlPlain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    var criteria = [];

    // 1. Hook-first excerpt
    var contextStarters = /^(in this|today|back when|recently|over the past|throughout|let me|i want to|here'?s|here is)\b/i;
    var hookOK = post.excerpt && !contextStarters.test(post.excerpt.trim()) && post.excerpt.trim().length > 0;
    criteria.push({ name: 'Hook-first excerpt', pts: hookOK ? 10 : 4, tip: 'Excerpt opens with the punch, not the setup' });

    // 2. No em-dashes (in body OR any rendered text)
    var emDashCount = (bodyOnly.match(/—/g) || []).length;
    criteria.push({ name: 'No em-dashes', pts: emDashCount === 0 ? 10 : Math.max(0, 10 - emDashCount * 2), tip: emDashCount > 0 ? emDashCount + ' em-dashes in body' : 'Clean' });

    // 3. TM symbols on framework names
    var fwMentions = (bodyPlain.match(/\b(MAD|RVF|TLE|RF|TISCU)\b/g) || []).length;
    var fwWithTM = (bodyPlain.match(/\b(MAD|RVF|TLE|RF|TISCU)™/g) || []).length;
    var tmRatio = fwMentions ? fwWithTM / fwMentions : 1;
    criteria.push({ name: 'TM on frameworks', pts: Math.round(tmRatio * 10), tip: fwMentions ? fwWithTM + '/' + fwMentions + ' mentions have TM' : 'No framework mentions' });

    // 4. Voice
    var firstPersonCount = (bodyPlain.match(/\bi\b/gi) || []).length;
    var secondPersonCount = (bodyPlain.match(/\byou\b|\byour\b/gi) || []).length;
    var voiceOK;
    if (post.series === 'bip') voiceOK = firstPersonCount >= 1 && secondPersonCount >= 3;
    else voiceOK = secondPersonCount >= 5;
    criteria.push({ name: 'Voice (' + (post.series === 'bip' ? 'first + second' : 'second person') + ')', pts: voiceOK ? 10 : 6, tip: '"I" ' + firstPersonCount + ' / "you" ' + secondPersonCount });

    // 5. Word count
    var wc = bodyPlain.split(/\s+/).filter(Boolean).length;
    var min = post.series === 'bip' ? 700 : 800;
    var max = post.series === 'bip' ? 1300 : 1800;
    var wcOK = wc >= min && wc <= max;
    var wcPts = wcOK ? 10 : (wc < min ? Math.round(10 * wc / min) : Math.round(10 * max / wc));
    criteria.push({ name: 'Word count (' + wc + ')', pts: Math.max(0, Math.min(10, wcPts)), tip: wcOK ? 'In range' : 'Target ' + min + '-' + max });

    // 6. Body emphasis — count strong/em in body AND rendered output
    var strongCount = (bodyOnly.match(/<strong\b/gi) || []).length;
    var emCount = (bodyOnly.match(/<em\b/gi) || []).length;
    var emphasisOK = (strongCount + emCount) >= 5;
    criteria.push({ name: 'Body emphasis (bold/italic)', pts: emphasisOK ? 10 : Math.round((strongCount + emCount) * 2), tip: strongCount + ' bold, ' + emCount + ' italic' });

    // 7. Template sections complete — check RENDERED HTML (structured OR embedded in body)
    var hasKeyInsights = (post.keyInsights && post.keyInsights.length >= 3);
    var hasWTM = /class="what-this-means"/.test(html) || /what does this/i.test(bodyPlain);
    var hasTry = /class="try-this"/.test(html) || /try this/i.test(bodyPlain);
    var hasClosing = /class="closing-block-plain"/.test(html) || (post.closing && post.closing.length > 50);
    var hasOpening = /class="lead-italic"/.test(html) || (post.opening && post.opening.length > 50);
    var hasPullQuote = /class="pull-quote"/.test(html) || /<blockquote/.test(bodyOnly);
    var sectionsPresent = 0;
    if (hasKeyInsights) sectionsPresent++;
    if (hasWTM) sectionsPresent++;
    if (hasTry) sectionsPresent++;
    if (hasClosing) sectionsPresent++;
    if (hasOpening) sectionsPresent++;
    if (hasPullQuote) sectionsPresent++;
    criteria.push({ name: 'Template sections complete', pts: Math.min(10, Math.round(sectionsPresent * 10 / 6)), tip: sectionsPresent + '/6 (insights, wtm, try, closing, opening, pull-quote)' });

    // 8. SEO completeness
    var seoChecks = 0;
    if (post.metaDescription && post.metaDescription.length >= 80) seoChecks++;
    if (post.ogDescription || post.excerpt) seoChecks++;
    if (post.keywords) seoChecks++;
    if (post.tags && post.tags.length >= 3) seoChecks++;
    if (post.heroImage) seoChecks++;
    criteria.push({ name: 'SEO complete', pts: seoChecks * 2, tip: seoChecks + '/5 (meta, og, keywords, tags, hero)' });

    // 9. Internal links — check RENDERED HTML for MAD/RVF/journal links
    var madLinks = (html.match(/href="[^"]*\/diagnostic\/(MAD|mad)/g) || []).length;
    var rvfLinks = (html.match(/href="[^"]*\/diagnostic\/(RVF|rvf)/g) || []).length;
    var journalLinks = (html.match(/href="[^"]*\/(?:journal|blog)\//g) || []).length;
    var totalLinks = madLinks + rvfLinks + journalLinks;
    criteria.push({ name: 'Internal links', pts: Math.min(10, totalLinks * 2), tip: 'MAD ' + madLinks + ', RVF ' + rvfLinks + ', journal ' + journalLinks });

    // 10. Funnel forward link
    var hasForward = (post.goDeeper && post.goDeeper.length >= 1) || (post.nextInSeries && post.nextInSeries.slug) || (post.related && post.related.length >= 1);
    criteria.push({ name: 'Funnel forward link', pts: hasForward ? 10 : 3, tip: hasForward ? 'Go Deeper / Next / Related present' : 'No next-step path' });

    var total = criteria.reduce(function (s, c) { return s + (c.pts || 0); }, 0);
    return { total: total, criteria: criteria, evaluatedAt: new Date().toISOString() };
  }

  // ============================================================
  //  PUBLIC API
  // ============================================================
  return {
    renderCanonicalPost: renderCanonicalPost,
    renderCanonicalStyles: renderCanonicalStyles,
    scorePost: scorePost,
    seriesLabel: seriesLabel,
    seriesDescription: seriesDescription,
    calculateReadingTime: calculateReadingTime,
    escapeHtml: escapeHtml,
    resolveImg: resolveImg,
    encodeImgUrl: encodeImgUrl
  };
}));

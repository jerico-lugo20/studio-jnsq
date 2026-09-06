
var Skin = require('./insights-skin.js');

// INSIGHTS RENAME (6 Sep 2026): the Journal now lives at /insights. Rewrite
// every path reference and the visible label in the outgoing HTML so links,
// canonicals and breadcrumbs all point at the new namespace.
function toInsights(html) {
  return String(html)
    .replace(/([\"'(])\/journal(\/|[\"')?#])/g, '$1/insights$2')
    .replace(/([\"'(])\/journal([\"'])/g, '$1/insights$2')
    .replace(/studiojnsq\.com\/journal/g, 'studiojnsq.com/insights')
    .replace(/Back to the Journal/g, 'Back to Insights')
    .replace(/More from the Journal/g, 'More from Insights')
    .replace(/Browse the Journal/g, 'Browse Insights')
    .replace(/Subscribe to the Journal/g, 'Subscribe to Insights')
    .replace(/>Journal</g, '>Insights<');
}
// Server-side renderer for every /blog/<slug> URL.
// Uses the shared canonical renderer (canonical-post-renderer.js) which is the
// single source of truth for the layout. Same file also loads in admin.html for
// the live preview pane, guaranteeing what you see in admin === what publishes.

const { getStore } = require("@netlify/blobs");
const CanonicalPost = require("./canonical-post-renderer.js");

function render404(slug) {
  var esc = CanonicalPost.escapeHtml;
  // Coherent "Coming soon" experience — same visual language as the article pages.
  return '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>Coming Soon | Studio JNSQ</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:ital,wght@0,500;1,400;1,500&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/css/jnsq-system.css?v=2">' +
    '<style>' +
      ':root{--jnsq-bg:#FAFAF6;--jnsq-ink:#1A1A1A;--jnsq-body:#3d3d3d;--jnsq-mute:#7a7a7a;--jnsq-line:#e8e6df;--jnsq-yellow:#FDD500;--jnsq-yellow-soft:#fefbef;}' +
      'body{margin:0;font-family:"Inter",sans-serif;background:var(--jnsq-bg);color:var(--jnsq-body);min-height:100vh;display:flex;flex-direction:column;}' +
      '.cs-nav{padding:20px 32px;border-bottom:1px solid var(--jnsq-line);background:var(--jnsq-bg);}' +
      '.cs-nav-inner{max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;}' +
      '.cs-logo{font-family:"Inter",sans-serif;font-weight:800;font-size:14px;letter-spacing:0.24em;color:var(--jnsq-ink);text-decoration:none;}' +
      '.cs-logo .accent{color:var(--jnsq-yellow);}' +
      '.cs-nav-links{display:flex;gap:28px;font-size:13.5px;letter-spacing:0.02em;}' +
      '.cs-nav-links a{color:var(--jnsq-ink);text-decoration:none;}' +
      '.cs-nav-links a:hover{color:var(--jnsq-yellow);}' +
      '.cs-nav-cta{padding:10px 20px;background:var(--jnsq-ink);color:var(--jnsq-yellow);font-size:12px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;border-radius:999px;}' +
      '.cs-nav-cta:hover{background:#000;}' +
      '.cs-main{flex:1;display:flex;align-items:center;justify-content:center;padding:80px 24px;}' +
      '.cs-card{max-width:640px;text-align:center;position:relative;}' +
      '.cs-eyebrow{font-family:"Inter",sans-serif;font-size:11px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:var(--jnsq-ink);margin-bottom:24px;display:inline-flex;align-items:center;gap:10px;padding:8px 18px;border:1px solid var(--jnsq-line);border-radius:999px;background:#fff;}' +
      '.cs-eyebrow::before{content:"";width:20px;height:20px;background:url("/images/jnsq-logo-mark.png") center / contain no-repeat;filter:drop-shadow(0 0 6px rgba(253,213,0,0.35));animation:cs-pulse 2s ease-in-out infinite;}' +
      '@keyframes cs-pulse{0%,100%{filter:drop-shadow(0 0 6px rgba(253,213,0,0.35));}50%{filter:drop-shadow(0 0 12px rgba(253,213,0,0.15));}}' +
      '.cs-title{font-family:"Lora",Georgia,serif;font-weight:500;font-size:clamp(2.25rem,5.5vw,3.75rem);line-height:1.05;letter-spacing:-0.02em;color:var(--jnsq-ink);margin:0 0 20px;}' +
      '.cs-title em{font-style:italic;color:var(--jnsq-ink);background:linear-gradient(180deg,transparent 60%,var(--jnsq-yellow-soft) 60%);}' +
      '.cs-sub{font-family:"Lora",Georgia,serif;font-style:italic;font-size:1.125rem;line-height:1.6;color:var(--jnsq-mute);margin:0 0 40px;}' +
      '.cs-actions{display:inline-flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:center;}' +
      '.cs-btn{display:inline-flex;align-items:center;padding:14px 26px;font-family:"Inter",sans-serif;font-size:12.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;text-decoration:none;border-radius:6px;transition:transform 0.15s ease,box-shadow 0.15s ease;}' +
      '.cs-btn-primary{background:var(--jnsq-ink);color:var(--jnsq-yellow);border:2px solid var(--jnsq-ink);}' +
      '.cs-btn-primary:hover{transform:translateY(-1px);box-shadow:0 12px 26px rgba(26,26,26,0.16);}' +
      '.cs-btn-secondary{background:transparent;color:var(--jnsq-ink);border:2px solid var(--jnsq-ink);}' +
      '.cs-btn-secondary:hover{background:var(--jnsq-ink);color:var(--jnsq-yellow);}' +
      // Subscribe form
      '.cs-subscribe{max-width:520px;margin:8px auto 32px;text-align:left;}' +
      '.cs-sub-label{font-family:"Inter",sans-serif;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:var(--jnsq-ink);text-align:center;margin-bottom:14px;}' +
      '.cs-sub-row{display:flex;gap:8px;padding:8px;background:#fff;border:1px solid var(--jnsq-line);border-radius:10px;box-shadow:0 6px 20px rgba(26,26,26,0.05);}' +
      '.cs-sub-row input{flex:1;border:none;background:transparent;padding:12px 14px;font-family:"Inter",sans-serif;font-size:15px;color:var(--jnsq-ink);outline:none;}' +
      '.cs-sub-row input::placeholder{color:#bfbcae;}' +
      '.cs-sub-row button{background:var(--jnsq-ink);color:var(--jnsq-yellow);border:none;border-radius:6px;padding:12px 22px;font-family:"Inter",sans-serif;font-size:12.5px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;cursor:pointer;transition:transform 0.15s ease,box-shadow 0.15s ease;white-space:nowrap;}' +
      '.cs-sub-row button:hover{transform:translateY(-1px);box-shadow:0 12px 26px rgba(26,26,26,0.16);}' +
      '.cs-sub-row button:disabled{opacity:0.6;cursor:default;transform:none;box-shadow:none;}' +
      '.cs-subscribe.done .cs-sub-row{background:var(--jnsq-yellow-soft);border-color:var(--jnsq-yellow);}' +
      '.cs-sub-note{margin:10px 0 0;font-family:"Inter",sans-serif;font-size:13px;line-height:1.5;text-align:center;min-height:20px;color:transparent;}' +
      '.cs-sub-note.ok{color:#0F6E56;}' +
      '.cs-sub-note.err{color:#B8412A;}' +
      '.cs-divider{display:flex;align-items:center;gap:14px;margin:24px 0 20px;color:var(--jnsq-mute);}' +
      '.cs-divider::before,.cs-divider::after{content:"";flex:1;height:1px;background:var(--jnsq-line);}' +
      '.cs-divider span{font-family:"Inter",sans-serif;font-size:11px;font-weight:600;letter-spacing:0.24em;text-transform:uppercase;}' +
      '@media (max-width:520px){.cs-sub-row{flex-direction:column;}.cs-sub-row button{width:100%;}}' +
      '.cs-meta{margin-top:56px;padding-top:32px;border-top:1px solid var(--jnsq-line);font-size:13px;color:var(--jnsq-mute);}' +
      '.cs-meta code{font-family:"JetBrains Mono","Courier New",monospace;font-size:12px;background:var(--jnsq-yellow-soft);padding:2px 8px;border-radius:4px;color:var(--jnsq-ink);}' +
      '.cs-foot{padding:24px;text-align:center;font-size:12px;letter-spacing:0.08em;color:var(--jnsq-mute);}' +
      '@media (max-width:600px){.cs-nav-links{display:none;}.cs-main{padding:56px 20px;}.cs-title{font-size:2rem;}}' +
    '</style>' +
    '</head><body>' +
    '<nav class="cs-nav"><div class="cs-nav-inner">' +
      '<a href="/" class="cs-logo">STUDIO <span class="accent">JNSQ</span></a>' +
      '<div class="cs-nav-links">' +
        '<a href="/">Home</a><a href="/about">About</a><a href="/journal">Journal</a><a href="/case-studies/">Case Studies</a><a href="/diagnostic">Diagnostic</a>' +
      '</div>' +
      '<a href="/diagnostic" class="cs-nav-cta">Take the Diagnostic</a>' +
    '</div></nav>' +
    '<main class="cs-main"><div class="cs-card">' +
      '<div class="cs-eyebrow">In the works</div>' +
      '<h1 class="cs-title">This piece is <em>coming soon.</em></h1>' +
      '<p class="cs-sub">We are still writing it. The Journal drops a new edition every week, so this page will fill in on its scheduled date.</p>' +
      // Subscribe form — capture the reader before they leave.
      '<form class="cs-subscribe" novalidate autocomplete="off" data-source="coming-soon:' + esc(slug || 'unknown') + '">' +
        '<div class="cs-sub-label">Get the drop the moment it publishes.</div>' +
        '<div class="cs-sub-row">' +
          '<input type="email" name="email" placeholder="your@email.com" required autocomplete="email">' +
          '<button type="submit">Subscribe &rarr;</button>' +
        '</div>' +
        '<p class="cs-sub-note" role="status" aria-live="polite"></p>' +
      '</form>' +
      '<div class="cs-divider"><span>Or</span></div>' +
      '<div class="cs-actions">' +
        '<a href="/journal" class="cs-btn cs-btn-primary">Browse the Journal &rarr;</a>' +
        '<a href="/diagnostic" class="cs-btn cs-btn-secondary">Take the diagnostic</a>' +
      '</div>' +
      (slug ? '<div class="cs-meta">Requested URL: <code>/journal/' + esc(slug) + '</code></div>' : '') +
    '</div></main>' +
    '<footer class="cs-foot">Studio JNSQ &middot; Brand equity architecture for valuable brands</footer>' +
    // Subscribe form script
    '<script>(function(){' +
      'var form = document.querySelector(".cs-subscribe");' +
      'if(!form) return;' +
      'var input = form.querySelector("input[name=email]");' +
      'var btn = form.querySelector("button");' +
      'var note = form.querySelector(".cs-sub-note");' +
      'form.addEventListener("submit", function(e){' +
        'e.preventDefault();' +
        'var email = input.value.trim();' +
        'if(!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)){' +
          'note.textContent = "Please enter a valid email."; note.className = "cs-sub-note err"; return;' +
        '}' +
        'btn.disabled = true; btn.textContent = "Sending..."; note.textContent = ""; note.className = "cs-sub-note";' +
        'fetch("/.netlify/functions/newsletter-subscribe", {' +
          'method: "POST", headers: {"Content-Type":"application/json"},' +
          'body: JSON.stringify({ email: email, source: form.dataset.source || "coming-soon", list: "coming-soon" })' +
        '}).then(function(r){ return r.ok ? r.json() : r.json().then(function(j){ throw new Error(j.error || "Server error"); }); })' +
          '.then(function(resp){' +
            'note.textContent = resp.alreadySubscribed ? "You are already on the list. We will email you the moment this drops." : "You are on the list. Watch your inbox for the drop.";' +
            'note.className = "cs-sub-note ok";' +
            'form.classList.add("done");' +
            'input.disabled = true; btn.disabled = true; btn.textContent = "Subscribed \\u2713";' +
          '}).catch(function(err){' +
            'note.textContent = (err && err.message) ? err.message : "Something went wrong. Try again.";' +
            'note.className = "cs-sub-note err";' +
            'btn.disabled = false; btn.textContent = "Subscribe \\u2192";' +
          '});' +
      '});' +
    '})();<\/script>' +
    '</body></html>';
}

function renderComingSoon(post) {
  var esc = CanonicalPost.escapeHtml;
  var title = post.title || 'Coming soon';
  var dateStr = '';
  if (post.publishDate) {
    try {
      var d = new Date(post.publishDate);
      if (!isNaN(d)) dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    } catch (e) {}
  }
  var seriesLabel = (post.series && CanonicalPost.seriesLabel) ? CanonicalPost.seriesLabel(post.series) : (post.series || 'the Journal');
  var isBip = post.series === 'bip';
  var subscribeCta = isBip
    ? '<p style="font-family:\'Lora\',Georgia,serif;font-style:italic;font-size:1.0625rem;color:var(--jnsq-mute);margin:24px 0 32px;">Get every new Brilliant In Public edition the moment it drops.</p>' +
      '<a href="/journal" style="display:inline-block;padding:14px 24px;background:var(--jnsq-ink);color:var(--jnsq-yellow);font-family:\'Inter\',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;border-radius:4px;">Subscribe to BIP</a>'
    : '<p style="font-family:\'Lora\',Georgia,serif;font-style:italic;font-size:1.0625rem;color:var(--jnsq-mute);margin:24px 0 32px;">Get every editorial the moment it publishes.</p>' +
      '<a href="/journal" style="display:inline-block;padding:14px 24px;background:var(--jnsq-ink);color:var(--jnsq-yellow);font-family:\'Inter\',sans-serif;font-size:12px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;text-decoration:none;border-radius:4px;">Subscribe to the Journal</a>';

  return '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<meta name="robots" content="noindex,nofollow">' +
    '<title>' + esc(title) + ' | Coming Soon | Studio JNSQ</title>' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:ital,wght@0,500;1,400;1,500&display=swap" rel="stylesheet">' +
    '<link rel="stylesheet" href="/css/jnsq-system.css?v=2">' +
    '</head><body style="font-family:Inter,sans-serif;background:var(--jnsq-bg,#FAFAF6);color:var(--jnsq-body,#3d3d3d);min-height:100vh;">' +
    '<nav class="jnsq-nav"><div class="jnsq-nav-inner"><a href="/" class="jnsq-nav-logo">STUDIO <span class="accent">JNSQ</span></a><div class="jnsq-nav-links"><a href="/">Home</a><a href="/about">About</a><a href="/journal">Journal</a><a href="/case-studies/">Case Studies</a><a href="/diagnostic">Diagnostic</a></div><a href="/diagnostic" class="jnsq-nav-cta">Take the Diagnostic</a></div></nav>' +
    '<div style="display:flex;align-items:center;justify-content:center;padding:96px 24px;min-height:calc(100vh - 200px);">' +
    '<div style="max-width:640px;text-align:center;">' +
    '<div style="font-family:\'Inter\',sans-serif;font-size:11px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:var(--jnsq-yellow);margin-bottom:12px;">Coming to ' + esc(seriesLabel) + '</div>' +
    '<h1 style="font-family:\'Lora\',Georgia,serif;font-size:clamp(2rem,4.5vw,3.25rem);font-weight:500;color:var(--jnsq-ink);line-height:1.1;letter-spacing:-0.015em;margin:0 0 20px;">' + esc(title) + '</h1>' +
    (dateStr ? '<p style="font-family:\'Lora\',Georgia,serif;font-style:italic;font-size:1.125rem;color:var(--jnsq-mute);margin:0 0 16px;">Drops ' + esc(dateStr) + '.</p>' : '') +
    subscribeCta +
    '<p style="margin-top:48px;font-family:\'Inter\',sans-serif;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;"><a href="/journal" style="color:var(--jnsq-ink);text-decoration:underline;text-decoration-color:var(--jnsq-yellow);text-decoration-thickness:2px;text-underline-offset:4px;">&larr; Back to the Journal</a></p>' +
    '</div></div></body></html>';
}

exports.handler = async function (event, context) {
  try {
    var slug = '';
    if (event.queryStringParameters && event.queryStringParameters.slug) {
      slug = event.queryStringParameters.slug;
    } else if (event.path) {
      // Accept both /journal/:slug (canonical) and legacy /blog/:slug just in case
      var m = event.path.match(/\/(?:insights|journal|blog)\/([^\/?#]+)/);
      if (m) slug = decodeURIComponent(m[1]);
    }
    if (!slug) {
      return { statusCode: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: render404('') };
    }
    slug = slug.replace(/\.html?$/i, '');

    var store = getStore({ name: 'blog-posts', siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
    var post = null;
    try { post = await store.get(slug, { type: 'json' }); } catch (e) { post = null; }
    if (!post) {
      return { statusCode: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' }, body: render404(slug) };
    }
    post.slug = post.slug || slug;

    // ============================================================
    //  INLINE PROMOTION: if this post is 'scheduled' and its 8AM UK
    //  drop moment has arrived, promote it to 'published' right now.
    //  Belt-and-suspenders in case the scheduled-publisher cron doesn't
    //  fire (Netlify Scheduled Functions require a paid plan).
    // ============================================================
    if (post.status === 'scheduled') {
      try {
        var fmt = new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/London',
          year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', hour12: false
        });
        var parts = fmt.formatToParts(new Date());
        var ukY = '', ukMo = '', ukD = '', ukH = '';
        parts.forEach(function (p) {
          if (p.type === 'year') ukY = p.value;
          else if (p.type === 'month') ukMo = p.value;
          else if (p.type === 'day') ukD = p.value;
          else if (p.type === 'hour') ukH = p.value;
        });
        var datePart = String(post.publishDate || '').slice(0, 10);
        var dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
        if (dm) {
          var target = dm[1] + dm[2] + dm[3] + '08';
          var nowKey = ukY + ukMo + ukD + ukH;
          if (nowKey >= target) {
            post.status = 'published';
            post.publishedAt = post.publishedAt || new Date().toISOString();
            post.updatedAt = new Date().toISOString();
            await store.setJSON(slug, post);
            // Refresh the index summary too
            try {
              var idx = (await store.get('_index', { type: 'json' })) || [];
              var row = idx.find(function (r) { return r.slug === slug; });
              if (row) { row.status = 'published'; await store.setJSON('_index', idx); }
            } catch (ie) { /* non-fatal */ }
            console.log('inline-promoted', slug, 'to published');
          }
        }
      } catch (e) { console.warn('inline promotion failed:', e && e.message); }
    }

    // ============================================================
    //  STATUS GATE: unpublished posts return a "coming soon" page
    //  with the title + expected drop date + subscribe CTA.
    //  Admin previews can bypass with ?preview=1.
    // ============================================================
    var previewMode = event.queryStringParameters && event.queryStringParameters.preview === '1';
    if (post.status !== 'published' && !previewMode) {
      return {
        statusCode: 200, // 200 with no-index so search engines skip; users get a friendly page
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=30, s-maxage=60',
          'X-Robots-Tag': 'noindex, nofollow'
        },
        body: Skin.reskin(toInsights(renderComingSoon(post)))
      };
    }

    // ============================================================
    //  DYNAMIC RELATED + CROSS-SERIES NEXT
    //  Only PUBLISHED posts are ever shown as clickable cards.
    //  If the reader is at the last edition of a series and there
    //  are no more published posts in it, we hand them off to the
    //  first published edition of the NEXT series (chronologically).
    // ============================================================
    try {
      var idx = await store.get('_index', { type: 'json' }) || [];
      var series = post.series;

      // Series follow this canonical reading order for cross-series next:
      var seriesOrder = ['foundation', 'mad', 'numbers', 'practice', 'diagnostics', 'bip', 'standalone'];

      // Related: only PUBLISHED siblings in the same series
      var sameSeries = idx
        .filter(function (p) {
          return p.status === 'published' && p.slug !== post.slug && p.series === series;
        })
        .sort(function (a, b) {
          var an = a.seriesIndex ? Number(a.seriesIndex) : 999;
          var bn = b.seriesIndex ? Number(b.seriesIndex) : 999;
          if (an !== bn) return an - bn;
          return (a.publishDate || '').localeCompare(b.publishDate || '');
        });

      post.related = sameSeries.slice(0, 3).map(function (p) {
        return { slug: p.slug, title: p.title, excerpt: p.excerpt || '' };
      });

      var totalPublishedInSeries = sameSeries.length;
      var totalInSeries = idx.filter(function (p) {
        return p.slug !== post.slug && p.series === series;
      }).length;
      post.__relatedMeta = {
        seriesId: series,
        seriesName: CanonicalPost.seriesLabel ? CanonicalPost.seriesLabel(series) : series,
        publishedCount: totalPublishedInSeries,
        totalCount: totalInSeries,
        allPublished: totalInSeries > 0 && totalPublishedInSeries === totalInSeries
      };

      // Enforce that prevInSeries + nextInSeries point ONLY to published posts.
      var pubIdxBySlug = {};
      idx.forEach(function (p) { if (p.status === 'published') pubIdxBySlug[p.slug] = p; });

      if (post.prevInSeries && post.prevInSeries.slug && !pubIdxBySlug[post.prevInSeries.slug]) {
        post.prevInSeries = { slug: '', title: '' };
      }
      if (post.nextInSeries && post.nextInSeries.slug && !pubIdxBySlug[post.nextInSeries.slug]) {
        post.nextInSeries = { slug: '', title: '' };
      }

      // Cross-series next: if we have no next-in-series to link to, look ahead to the next series.
      if (!post.nextInSeries || !post.nextInSeries.slug) {
        var currentSeriesIdx = seriesOrder.indexOf(series);
        var crossSeriesNext = null;
        if (currentSeriesIdx >= 0) {
          for (var i = currentSeriesIdx + 1; i < seriesOrder.length; i++) {
            var candidateSeries = seriesOrder[i];
            var firstOfNext = idx
              .filter(function (p) { return p.status === 'published' && p.series === candidateSeries && p.slug !== post.slug; })
              .sort(function (a, b) {
                var an = a.seriesIndex ? Number(a.seriesIndex) : 999;
                var bn = b.seriesIndex ? Number(b.seriesIndex) : 999;
                if (an !== bn) return an - bn;
                return (a.publishDate || '').localeCompare(b.publishDate || '');
              })[0];
            if (firstOfNext) {
              crossSeriesNext = {
                slug: firstOfNext.slug,
                title: firstOfNext.title,
                seriesName: CanonicalPost.seriesLabel ? CanonicalPost.seriesLabel(candidateSeries) : candidateSeries,
                isCrossSeries: true
              };
              break;
            }
          }
        }
        if (crossSeriesNext) {
          post.nextInSeries = { slug: crossSeriesNext.slug, title: crossSeriesNext.title };
          post.__crossSeriesNext = crossSeriesNext;
        }
      }
    } catch (e) {
      console.warn('related lookup failed:', e && e.message);
    }

    var html = CanonicalPost.renderCanonicalPost(post);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        // Short cache so recent publishes reflect within ~60s across the CDN
        'Cache-Control': 'public, max-age=30, s-maxage=60'
      },
      body: Skin.reskin(toInsights(html))
    };
  } catch (err) {
    console.error('render-blog-post error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
      body: '<!DOCTYPE html><html><body><h1>Error rendering post</h1><pre>' + String(err && err.message || err) + '</pre></body></html>'
    };
  }
};

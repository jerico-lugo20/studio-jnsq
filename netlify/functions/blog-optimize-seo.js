// Studio JNSQ Blog SEO/GEO Optimizer
// Given a post slug (or POSTed post), apply deterministic + AI-assisted improvements
// to lift the doctrine score, then persist the result.
//
// Deterministic (fast, no AI):
//   - Trademark symbols: MAD → MAD™, RVF → RVF™, TLE → TLE™, RF → RF™, TISCU → TISCU™
//     (only when NOT already followed by ™ and not inside a URL)
//   - Em dashes: replace — and – with ", " or period contextually
//   - Add strong emphasis to at least one MAD/RVF/brand-equity/™ phrase per paragraph
//     when body has no <strong> tags
//   - Add italic emphasis to first-person quote lines or "the question is..." patterns
//     when body has no <em> tags
//   - Auto-wire a doctrine tag pool if tags are thin
//
// AI-assisted (when requested via ?rewrite=true):
//   - Rewrite the excerpt if hook-first check fails
//   - Rewrite the opening paragraph if it's not hook-first
//
// Returns: { patched: bool, changes: [...], post: {...}, prevScore: n, newScore: n }

const { getStore } = require("@netlify/blobs");
const CanonicalPost = require("./canonical-post-renderer.js");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

// ================================================================
//  DETERMINISTIC RULES
// ================================================================

// Trademark symbols on JNSQ frameworks
function addTrademarks(text) {
  if (!text) return { text, count: 0 };
  var count = 0;
  var frameworks = ['MAD', 'RVF', 'TLE', 'TISCU Triangle', 'TISCU'];
  var out = text;
  frameworks.forEach(function (f) {
    // Match framework name NOT already followed by ™, and NOT inside a URL fragment
    // Word boundary + not preceded by / or =
    var re = new RegExp('(^|[^/=\\w])(' + f.replace(/\s/g, '\\s') + ')(?!™)(?![a-zA-Z0-9])', 'g');
    out = out.replace(re, function (m, pre, name) {
      count++;
      return pre + name + '™';
    });
  });
  return { text: out, count: count };
}

// Em dashes → contextual replacement
function fixEmDashes(text) {
  if (!text) return { text, count: 0 };
  var count = 0;
  var out = text;
  // — with spaces around it → ", "
  out = out.replace(/\s*—\s*/g, function () { count++; return ', '; });
  // – (en dash) with spaces → ", "
  out = out.replace(/\s*–\s*/g, function () { count++; return ', '; });
  return { text: out, count: count };
}

// Wrap key phrases in <strong> if body has no <strong> tags
function addStrongEmphasis(html) {
  if (!html) return { html, count: 0 };
  if (/<strong\b/i.test(html)) return { html, count: 0 };
  var count = 0;
  // Pick up to 5 phrases that scream doctrine and wrap them
  var phrases = [
    /\b(brand equity architecture)\b/gi,
    /\b(market authority)\b/gi,
    /\b(MAD™|RVF™|TLE™|TISCU\s*Triangle™)\b/gi,
    /\b(pricing power|exit multiples?|valuation multiples?)\b/gi,
    /\b(compounds?|compounding)\b/gi
  ];
  var out = html;
  phrases.forEach(function (re) {
    var applied = 0;
    out = out.replace(re, function (m) {
      if (applied >= 1) return m; // only wrap first occurrence per phrase
      applied++;
      count++;
      return '<strong>' + m + '</strong>';
    });
  });
  return { html: out, count: count };
}

// Wrap short italic emphasis if body has no <em>
function addItalicEmphasis(html) {
  if (!html) return { html, count: 0 };
  if (/<em\b/i.test(html)) return { html, count: 0 };
  var count = 0;
  // First internal-voice pattern: "The question is not X. It is Y."
  var patterns = [
    /(The question is not )([^<.]+\.)/i,
    /(This is )([^<.]+\.)/i
  ];
  var out = html;
  patterns.forEach(function (re) {
    if (count > 0) return;
    out = out.replace(re, function (m, a, b) {
      count++;
      return a + '<em>' + b + '</em>';
    });
  });
  return { html: out, count: count };
}

// Ensure tags include doctrine words
function ensureDoctrineTags(tagsArr) {
  var defaults = ['brand equity architecture'];
  var current = (tagsArr || []).map(String);
  var added = [];
  defaults.forEach(function (d) {
    if (!current.some(function (t) { return t.toLowerCase() === d.toLowerCase(); })) {
      current.push(d);
      added.push(d);
    }
  });
  return { tags: current, added: added };
}

// ================================================================
//  AI ASSIST — hook + opening rewrite
// ================================================================
async function aiRewriteHook(post, apiKey) {
  var msg = [
    "Rewrite ONLY the excerpt for this Studio JNSQ blog post so it hooks in the first 15 words.",
    "Rules:",
    "- 18-28 words total",
    "- Hook must land in the first 15 words",
    "- No em dashes",
    "- No filler words (actually, so, just)",
    "- Second person voice",
    "- Frame as a business/financial reveal (valuation, exit, pricing power, compounding)",
    "- Return ONLY the new excerpt string. No preamble.",
    "",
    "TITLE: " + post.title,
    "OLD EXCERPT: " + (post.excerpt || "(none)"),
    "OPENING PARAGRAPH: " + (post.opening || "").slice(0, 400)
  ].join("\n");

  var res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 200,
      messages: [{ role: "user", content: msg }]
    })
  });

  if (!res.ok) return null;
  var data = await res.json();
  var text = "";
  if (data.content && data.content.length) {
    for (var i = 0; i < data.content.length; i++) if (data.content[i].type === "text") text += data.content[i].text;
  }
  return text.trim().replace(/^["'"'`]|["'"'`]$/g, '');
}

// ================================================================
//  MAIN
// ================================================================
exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders(), body: "" };

  var qs = event.queryStringParameters || {};
  var slug = qs.slug || (event.body ? (JSON.parse(event.body).slug || null) : null);
  var doRewrite = String(qs.rewrite || "").toLowerCase() === "true";

  if (!slug) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "slug required" }) };

  try {
    var store = getStore({ name: "blog-posts", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
    var post = await store.get(slug, { type: "json" });
    if (!post) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Post not found" }) };

    // Score BEFORE
    var htmlBefore = CanonicalPost.renderCanonicalPost(post);
    var scoreBefore = CanonicalPost.scorePost(post, htmlBefore).total;

    var changes = [];

    // 1) Trademarks on body + title + excerpt
    var t = addTrademarks(post.body || '');
    if (t.count > 0) { post.body = t.text; changes.push('Added ' + t.count + ' ™ to framework refs in body'); }

    var tTitle = addTrademarks(post.title || '');
    if (tTitle.count > 0) { post.title = tTitle.text; changes.push('Added ™ in title'); }

    var tExc = addTrademarks(post.excerpt || '');
    if (tExc.count > 0) { post.excerpt = tExc.text; changes.push('Added ™ in excerpt'); }

    // 2) Em dashes
    ['body', 'excerpt', 'opening', 'closing'].forEach(function (k) {
      if (!post[k]) return;
      var r = fixEmDashes(post[k]);
      if (r.count > 0) { post[k] = r.text; changes.push('Fixed ' + r.count + ' em-dash(es) in ' + k); }
    });
    if (post.pullQuote && post.pullQuote.text) {
      var r2 = fixEmDashes(post.pullQuote.text);
      if (r2.count > 0) { post.pullQuote.text = r2.text; changes.push('Fixed em-dashes in pull quote'); }
    }
    if (post.whatThisMeans) {
      var r3 = fixEmDashes(post.whatThisMeans.body || '');
      if (r3.count > 0) { post.whatThisMeans.body = r3.text; changes.push('Fixed em-dashes in WTM body'); }
    }

    // 3) Add strong emphasis
    var s = addStrongEmphasis(post.body || '');
    if (s.count > 0) { post.body = s.html; changes.push('Bolded ' + s.count + ' doctrine phrase(s)'); }

    // 4) Add italic emphasis
    var e = addItalicEmphasis(post.body || '');
    if (e.count > 0) { post.body = e.html; changes.push('Italicized ' + e.count + ' internal-voice line(s)'); }

    // 5) Ensure doctrine tags
    var tg = ensureDoctrineTags(Array.isArray(post.tags) ? post.tags : (post.tags ? String(post.tags).split(',').map(function(x){return x.trim();}) : []));
    if (tg.added.length) { post.tags = tg.tags; changes.push('Added tag(s): ' + tg.added.join(', ')); }

    // 6) AI hook rewrite (opt-in)
    if (doRewrite && process.env.ANTHROPIC_API_KEY) {
      var newExcerpt = await aiRewriteHook(post, process.env.ANTHROPIC_API_KEY);
      if (newExcerpt && newExcerpt.length > 10 && newExcerpt.length < 250) {
        post.excerpt = newExcerpt;
        changes.push('AI-rewrote excerpt for hook-first');
      }
    }

    if (changes.length === 0) {
      // Nothing to change; still return the current score
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ patched: false, changes: [], prevScore: scoreBefore, newScore: scoreBefore, message: 'Already optimized' })
      };
    }

    // Score AFTER
    post.updatedAt = new Date().toISOString();
    var htmlAfter = CanonicalPost.renderCanonicalPost(post);
    var scoreAfter = CanonicalPost.scorePost(post, htmlAfter).total;

    // Persist
    await store.setJSON(slug, post);

    // Update index summary too (it stores excerpt, tags, etc.)
    try {
      var idx = await store.get("_index", { type: "json" }) || [];
      idx = idx.filter(function (p) { return p.slug !== slug; });
      idx.push({
        slug: post.slug, title: post.title, excerpt: post.excerpt,
        heroImage: post.heroImage, status: post.status, publishDate: post.publishDate,
        author: post.author, tags: post.tags, series: post.series, seriesIndex: post.seriesIndex,
        seriesLabel: post.seriesLabel, funnelStage: post.funnelStage,
        promoGate: post.promoGate, scoreCache: post.scoreCache,
        createdAt: post.createdAt, updatedAt: post.updatedAt
      });
      await store.setJSON("_index", idx);
    } catch (e) { /* index update non-fatal */ }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        patched: true,
        changes: changes,
        prevScore: scoreBefore,
        newScore: scoreAfter,
        delta: scoreAfter - scoreBefore,
        post: post
      })
    };
  } catch (err) {
    console.error("blog-optimize-seo error:", err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: err.message }) };
  }
};

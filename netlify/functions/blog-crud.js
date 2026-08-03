// Blog post CRUD via Netlify Blobs
// GET: list all posts or get single post by slug
// POST: create or update a post (full BIP template schema)
// DELETE: remove a post by slug
//
// Persisted schema (v2 — matches BIP canonical template):
//   Basics: slug, title, excerpt, body, heroImage, status, publishDate, author, tags
//   Series: series, seriesIndex, seriesLabel, funnelStage
//   Sections: opening, whatThisMeans {label,headline,body,items[]}, pullQuote {text,attribution},
//             tryThis {label,headline,body}, closing, nextEdition {text,linkSlug,linkLabel}, signOff
//   Key Insights: keyInsights[] (array of strings)
//   FAQ: faqs[] of {question, answer}
//   Go Deeper: goDeeper[] of {num,title,excerpt,slug,seriesTag}
//   Related: related[] of {slug,title,excerpt}
//   Series Nav: prevInSeries {slug,title}, nextInSeries {slug,title}
//   SEO: metaDescription, ogDescription, keywords
//   Promo Gate: promoGate {enabled, codeRef, code, discountPct, expiry, tier}
//   Score: scoreCache {total, criteria[], evaluatedAt}

const { getStore } = require("@netlify/blobs");

const TEMPLATE_FIELDS = [
  "slug", "title", "excerpt", "body", "heroImage", "status", "publishDate", "author", "tags",
  "series", "seriesIndex", "seriesLabel", "funnelStage",
  "opening", "whatThisMeans", "pullQuote", "tryThis", "closing", "nextEdition", "signOff",
  "keyInsights", "faqs", "goDeeper", "related",
  "prevInSeries", "nextInSeries",
  "metaDescription", "ogDescription", "keywords",
  "promoGate", "scoreCache"
];

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  const store = getStore({ name: "blog-posts", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  try {
    // GET — list posts or get single post
    if (event.httpMethod === "GET") {
      const slug = event.queryStringParameters && event.queryStringParameters.slug;
      const status = event.queryStringParameters && event.queryStringParameters.status;
      const series = event.queryStringParameters && event.queryStringParameters.series;

      if (slug) {
        const post = await store.get(slug, { type: "json" });
        if (!post) {
          return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Post not found" }) };
        }
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(post) };
      }

      let index = [];
      try {
        const existing = await store.get("_index", { type: "json" });
        if (existing) index = existing;
      } catch (e) { /* no index yet */ }

      // ============================================================
      //  INLINE PROMOTION: any 'scheduled' entry whose 8AM UK drop
      //  has arrived flips to 'published' now. Belt-and-suspenders
      //  in case the scheduled-publisher cron isn't running.
      // ============================================================
      const scheduled = index.filter(function (p) { return p.status === "scheduled"; });
      if (scheduled.length) {
        const fmt = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/London",
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", hour12: false
        });
        const parts = fmt.formatToParts(new Date());
        let ukY = "", ukMo = "", ukD = "", ukH = "";
        parts.forEach(function (p) {
          if (p.type === "year") ukY = p.value;
          else if (p.type === "month") ukMo = p.value;
          else if (p.type === "day") ukD = p.value;
          else if (p.type === "hour") ukH = p.value;
        });
        const nowKey = ukY + ukMo + ukD + ukH;
        let indexDirty = false;
        for (const summary of scheduled) {
          const datePart = String(summary.publishDate || "").slice(0, 10);
          const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
          if (!dm) continue;
          const target = dm[1] + dm[2] + dm[3] + "08";
          if (nowKey < target) continue;
          try {
            const full = await store.get(summary.slug, { type: "json" });
            if (!full) continue;
            full.status = "published";
            full.publishedAt = full.publishedAt || new Date().toISOString();
            full.updatedAt = new Date().toISOString();
            await store.setJSON(summary.slug, full);
            summary.status = "published";
            indexDirty = true;
            console.log("inline-promoted (via list)", summary.slug);
          } catch (e) { console.warn("promote failed:", summary.slug, e && e.message); }
        }
        if (indexDirty) {
          try { await store.setJSON("_index", index); } catch (e) { /* non-fatal */ }
        }
      }

      if (status) {
        index = index.filter(function(p) { return p.status === status; });
      }
      if (series) {
        index = index.filter(function(p) { return p.series === series; });
      }

      index.sort(function(a, b) {
        return new Date(b.publishDate || b.createdAt) - new Date(a.publishDate || a.createdAt);
      });

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ posts: index, count: index.length })
      };
    }

    // POST — create or update a post
    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body);

      if (!data.slug || !data.title) {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Slug and title are required" }) };
      }

      let existing = null;
      try {
        existing = await store.get(data.slug, { type: "json" });
      } catch (e) { /* doesn't exist */ }

      const now = new Date().toISOString();

      // Build post object accepting all template fields with sensible defaults
      const post = {
        slug: data.slug,
        title: data.title,
        excerpt: data.excerpt || "",
        body: data.body || "",
        heroImage: data.heroImage || "",
        status: data.status || "draft",
        publishDate: data.publishDate || now,
        author: data.author || "Studio JNSQ",
        tags: Array.isArray(data.tags) ? data.tags : [],

        // Series & funnel
        series: data.series || "standalone",
        seriesIndex: data.seriesIndex || null,
        seriesLabel: data.seriesLabel || "",
        funnelStage: data.funnelStage || "tofu",

        // Sections
        kicker: data.kicker || "",
        opening: data.opening || "",
        whatThisMeans: data.whatThisMeans || { label: "", headline: "", body: "", items: [] },
        pullQuote: data.pullQuote || { text: "", attribution: "" },
        tryThis: data.tryThis || { label: "Try This", headline: "", body: "" },
        closing: data.closing || "",
        nextEdition: data.nextEdition || { text: "", linkSlug: "", linkLabel: "" },
        // signOff: preserve whatever the admin sent (including empty string).
        // No default injection — editorial posts leave this blank; BIP posts set it explicitly.
        signOff: (data.signOff !== undefined && data.signOff !== null) ? String(data.signOff) : "",

        // Key insights (3-bullet sidebar)
        keyInsights: Array.isArray(data.keyInsights) ? data.keyInsights : [],

        // FAQ
        faqs: Array.isArray(data.faqs) ? data.faqs : [],

        // Go Deeper (3 numbered cards + optional section intro line)
        goDeeperIntro: data.goDeeperIntro || "",
        goDeeper: Array.isArray(data.goDeeper) ? data.goDeeper : [],

        // Related (3 cards)
        related: Array.isArray(data.related) ? data.related : [],

        // Series navigation
        prevInSeries: data.prevInSeries || { slug: "", title: "" },
        nextInSeries: data.nextInSeries || { slug: "", title: "" },

        // SEO
        metaDescription: data.metaDescription || data.excerpt || "",
        ogDescription: data.ogDescription || data.excerpt || "",
        keywords: data.keywords || (Array.isArray(data.tags) ? data.tags.join(", ") : ""),

        // Promo gate
        promoGate: data.promoGate || { enabled: false, codeRef: "", code: "", discountPct: 0, expiry: "", tier: "" },

        // Score cache
        scoreCache: data.scoreCache || null,

        createdAt: existing ? existing.createdAt : now,
        updatedAt: now
      };

      await store.setJSON(data.slug, post);

      // Update index (lightweight summary record)
      let index = [];
      try {
        const existingIndex = await store.get("_index", { type: "json" });
        if (existingIndex) index = existingIndex;
      } catch (e) { /* no index yet */ }

      index = index.filter(function(p) { return p.slug !== data.slug; });

      index.push({
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        heroImage: post.heroImage,
        status: post.status,
        publishDate: post.publishDate,
        author: post.author,
        tags: post.tags,
        series: post.series,
        seriesIndex: post.seriesIndex,
        seriesLabel: post.seriesLabel,
        funnelStage: post.funnelStage,
        promoGate: { enabled: !!(post.promoGate && post.promoGate.enabled), codeRef: (post.promoGate && post.promoGate.codeRef) || "" },
        scoreCache: post.scoreCache ? { total: post.scoreCache.total, evaluatedAt: post.scoreCache.evaluatedAt } : null,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt
      });

      await store.setJSON("_index", index);

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true, post })
      };
    }

    // DELETE — remove a post
    if (event.httpMethod === "DELETE") {
      const slug = event.queryStringParameters && event.queryStringParameters.slug;
      if (!slug) {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Slug parameter is required" }) };
      }

      await store.delete(slug);

      let index = [];
      try {
        const existingIndex = await store.get("_index", { type: "json" });
        if (existingIndex) index = existingIndex;
      } catch (e) { /* no index */ }

      index = index.filter(function(p) { return p.slug !== slug; });
      await store.setJSON("_index", index);

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true })
      };
    }

    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("Blog CRUD error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to process blog request: " + err.message })
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };
}

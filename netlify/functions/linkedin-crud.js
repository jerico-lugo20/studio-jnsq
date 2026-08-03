// LinkedIn posts CRUD via Netlify Blobs
// Store: linkedin-posts
// Schema:
//   { id, status: 'draft'|'scheduled'|'published',
//     content: string, hook: string, sourceType: 'blog'|'bip'|'manual', sourceSlug: string,
//     scheduledFor: iso, publishedAt: iso, linkedInUrl: string,
//     engagement: { likes, comments, shares, impressions, reactions, updatedAt },
//     createdAt, updatedAt }

const { getStore } = require("@netlify/blobs");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };
}

function genId() { return 'li_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders(), body: "" };
  const store = getStore({ name: "linkedin-posts", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  try {
    if (event.httpMethod === "GET") {
      const id = event.queryStringParameters && event.queryStringParameters.id;
      const status = event.queryStringParameters && event.queryStringParameters.status;
      if (id) {
        const p = await store.get(id, { type: "json" });
        if (!p) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Not found" }) };
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(p) };
      }
      let index = [];
      try { const ex = await store.get("_index", { type: "json" }); if (ex) index = ex; } catch (e) {}
      if (status) index = index.filter((p) => p.status === status);
      index.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

      // Summary stats
      var summary = {
        total: index.length,
        drafts: index.filter((p) => p.status === "draft").length,
        scheduled: index.filter((p) => p.status === "scheduled").length,
        published: index.filter((p) => p.status === "published").length,
        totalEngagement: index.reduce((s, p) => {
          const e = p.engagement || {};
          return s + (e.likes || 0) + (e.comments || 0) + (e.shares || 0) + (e.reactions || 0);
        }, 0)
      };
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ posts: index, summary }) };
    }

    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body);
      let existing = null;
      let id = data.id;
      if (id) {
        try { existing = await store.get(id, { type: "json" }); } catch (e) {}
      }
      if (!id) id = genId();

      const now = new Date().toISOString();
      const post = {
        id,
        status: data.status || "draft",
        content: data.content || "",
        hook: data.hook || (data.content ? String(data.content).split(/[.\n]/)[0].slice(0, 120) : ""),
        sourceType: data.sourceType || "manual",
        sourceSlug: data.sourceSlug || "",
        scheduledFor: data.scheduledFor || "",
        publishedAt: data.publishedAt || (data.status === "published" ? now : ""),
        linkedInUrl: data.linkedInUrl || "",
        engagement: data.engagement || (existing && existing.engagement) || { likes: 0, comments: 0, shares: 0, impressions: 0, reactions: 0, updatedAt: "" },
        createdAt: existing ? existing.createdAt : now,
        updatedAt: now
      };
      await store.setJSON(id, post);

      let index = [];
      try { const ex = await store.get("_index", { type: "json" }); if (ex) index = ex; } catch (e) {}
      index = index.filter((p) => p.id !== id);
      index.push({
        id: post.id, status: post.status, hook: post.hook, sourceType: post.sourceType, sourceSlug: post.sourceSlug,
        scheduledFor: post.scheduledFor, publishedAt: post.publishedAt, linkedInUrl: post.linkedInUrl,
        engagement: post.engagement, createdAt: post.createdAt, updatedAt: post.updatedAt
      });
      await store.setJSON("_index", index);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, post }) };
    }

    if (event.httpMethod === "DELETE") {
      const id = event.queryStringParameters && event.queryStringParameters.id;
      if (!id) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "id required" }) };
      await store.delete(id);
      let index = [];
      try { const ex = await store.get("_index", { type: "json" }); if (ex) index = ex; } catch (e) {}
      index = index.filter((p) => p.id !== id);
      await store.setJSON("_index", index);
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("linkedin-crud error:", err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Failed: " + err.message }) };
  }
};

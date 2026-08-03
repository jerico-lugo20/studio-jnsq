// Media mentions + saved queries CRUD via Netlify Blobs
// Store: media-monitor
// Actions:
//   ?resource=mentions        GET list | POST upsert | DELETE by id
//   ?resource=queries         GET list | POST upsert | DELETE by id
//   ?resource=summary         GET aggregate stats

const { getStore } = require("@netlify/blobs");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };
}

function genId(prefix) { return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6); }

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders(), body: "" };
  const store = getStore({ name: "media-monitor", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  var qs = event.queryStringParameters || {};
  var resource = qs.resource || 'mentions';

  try {
    if (resource === 'mentions') {
      return await handleMentions(event, store, qs);
    }
    if (resource === 'queries') {
      return await handleQueries(event, store, qs);
    }
    if (resource === 'summary') {
      return await handleSummary(store);
    }
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Unknown resource" }) };
  } catch (err) {
    console.error("media-monitor-crud error:", err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "Failed: " + err.message }) };
  }
};

// ==================================================================
//  MENTIONS
//  { id, title, source, url, publishedAt, category, keyword, snippet,
//    status: 'unreviewed'|'reviewed'|'actioned', notes, createdAt, updatedAt }
// ==================================================================
async function handleMentions(event, store, qs) {
  if (event.httpMethod === "GET") {
    let index = [];
    try { const ex = await store.get("_mentions_index", { type: "json" }); if (ex) index = ex; } catch (e) {}
    if (qs.category) index = index.filter((m) => m.category === qs.category);
    if (qs.status) index = index.filter((m) => m.status === qs.status);
    index.sort((a, b) => new Date(b.publishedAt || b.createdAt) - new Date(a.publishedAt || a.createdAt));
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ mentions: index }) };
  }
  if (event.httpMethod === "POST") {
    const data = JSON.parse(event.body);
    let existing = null;
    let id = data.id;
    if (id) { try { existing = await store.get(id, { type: "json" }); } catch (e) {} }
    if (!id) id = genId('mn');
    const now = new Date().toISOString();
    const mention = {
      id,
      title: data.title || "",
      source: data.source || "",
      url: data.url || "",
      publishedAt: data.publishedAt || now,
      category: data.category || "own",
      keyword: data.keyword || "",
      snippet: data.snippet || "",
      status: data.status || "unreviewed",
      notes: data.notes || "",
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
    await store.setJSON(id, mention);
    let index = [];
    try { const ex = await store.get("_mentions_index", { type: "json" }); if (ex) index = ex; } catch (e) {}
    index = index.filter((m) => m.id !== id);
    index.push(mention);
    await store.setJSON("_mentions_index", index);
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, mention }) };
  }
  if (event.httpMethod === "DELETE") {
    const id = qs.id;
    if (!id) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "id required" }) };
    await store.delete(id);
    let index = [];
    try { const ex = await store.get("_mentions_index", { type: "json" }); if (ex) index = ex; } catch (e) {}
    index = index.filter((m) => m.id !== id);
    await store.setJSON("_mentions_index", index);
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true }) };
  }
  return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
}

// ==================================================================
//  QUERIES
//  { id, name, keywords[], category, source: 'google-news'|'rss'|'manual',
//    frequency: 'daily'|'weekly'|'manual', lastRunAt, active, createdAt, updatedAt }
// ==================================================================
async function handleQueries(event, store, qs) {
  if (event.httpMethod === "GET") {
    let index = [];
    try { const ex = await store.get("_queries_index", { type: "json" }); if (ex) index = ex; } catch (e) {}
    index.sort((a, b) => (b.active === a.active ? 0 : b.active ? 1 : -1));
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ queries: index }) };
  }
  if (event.httpMethod === "POST") {
    const data = JSON.parse(event.body);
    let existing = null;
    let id = data.id;
    if (id) { try { existing = await store.get(id, { type: "json" }); } catch (e) {} }
    if (!id) id = genId('q');
    const now = new Date().toISOString();
    const query = {
      id,
      name: data.name || "",
      keywords: Array.isArray(data.keywords) ? data.keywords : (typeof data.keywords === 'string' ? data.keywords.split(',').map(k => k.trim()).filter(Boolean) : []),
      category: data.category || "own",
      source: data.source || "google-news",
      frequency: data.frequency || "daily",
      lastRunAt: data.lastRunAt || "",
      active: data.active !== undefined ? !!data.active : true,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now
    };
    await store.setJSON(id, query);
    let index = [];
    try { const ex = await store.get("_queries_index", { type: "json" }); if (ex) index = ex; } catch (e) {}
    index = index.filter((q) => q.id !== id);
    index.push(query);
    await store.setJSON("_queries_index", index);
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, query }) };
  }
  if (event.httpMethod === "DELETE") {
    const id = qs.id;
    if (!id) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "id required" }) };
    await store.delete(id);
    let index = [];
    try { const ex = await store.get("_queries_index", { type: "json" }); if (ex) index = ex; } catch (e) {}
    index = index.filter((q) => q.id !== id);
    await store.setJSON("_queries_index", index);
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true }) };
  }
  return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
}

async function handleSummary(store) {
  let mIndex = [];
  let qIndex = [];
  try { const m = await store.get("_mentions_index", { type: "json" }); if (m) mIndex = m; } catch (e) {}
  try { const q = await store.get("_queries_index", { type: "json" }); if (q) qIndex = q; } catch (e) {}
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const week = 7 * day;
  const summary = {
    totalMentions: mIndex.length,
    unreviewed: mIndex.filter((m) => m.status === 'unreviewed').length,
    thisWeek: mIndex.filter((m) => new Date(m.publishedAt || m.createdAt).getTime() > now - week).length,
    byCategory: {
      own: mIndex.filter((m) => m.category === 'own').length,
      competitor: mIndex.filter((m) => m.category === 'competitor').length,
      opportunity: mIndex.filter((m) => m.category === 'opportunity').length,
      trend: mIndex.filter((m) => m.category === 'trend').length
    },
    queries: {
      total: qIndex.length,
      active: qIndex.filter((q) => q.active).length
    }
  };
  return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(summary) };
}

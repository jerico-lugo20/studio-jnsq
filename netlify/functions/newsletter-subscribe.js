// Newsletter subscription — email signup with deduplication + admin listing.
//
// POST   /.netlify/functions/newsletter-subscribe
//        body: { email, name?, source?, list? }
//        Adds a subscriber (dedup by email + list). Silent success if already subscribed.
//
// GET    /.netlify/functions/newsletter-subscribe
//        Returns all subscribers (admin listing).
//        Optional query: ?list=coming-soon or ?source=blog:foo or ?limit=100
//
// DELETE /.netlify/functions/newsletter-subscribe?id=<id>
//        Removes a subscriber (unsubscribe / admin cleanup).
//
// Stores in blob "newsletter" with key "subscribers" (array of records).

const { getStore } = require("@netlify/blobs");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };
}

function generateId() {
  return 'sub_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function getStoreInst() {
  return getStore({ name: "newsletter", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
}

async function loadSubscribers(store) {
  try {
    const existing = await store.get("subscribers", { type: "json" });
    if (Array.isArray(existing)) return existing;
  } catch (e) { /* no data yet */ }
  return [];
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  const store = getStoreInst();

  try {
    // ------- GET (admin listing) -------
    if (event.httpMethod === "GET") {
      let subscribers = await loadSubscribers(store);
      const qs = event.queryStringParameters || {};

      // Filter by list
      if (qs.list) {
        subscribers = subscribers.filter(s => (s.list || 'default') === qs.list);
      }
      // Filter by source substring
      if (qs.source) {
        const q = String(qs.source).toLowerCase();
        subscribers = subscribers.filter(s => (s.source || '').toLowerCase().includes(q));
      }
      // Sort newest first
      subscribers.sort((a, b) => (b.subscribedAt || '').localeCompare(a.subscribedAt || ''));
      // Limit
      const limit = parseInt(qs.limit || '0', 10);
      if (limit > 0) subscribers = subscribers.slice(0, limit);

      // Aggregate list breakdown for admin dashboard
      const all = await loadSubscribers(store);
      const listCounts = {};
      all.forEach(s => {
        const list = s.list || 'default';
        listCounts[list] = (listCounts[list] || 0) + 1;
      });

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ subscribers, count: subscribers.length, total: all.length, listCounts })
      };
    }

    // ------- DELETE (admin) -------
    if (event.httpMethod === "DELETE") {
      const qs = event.queryStringParameters || {};
      if (!qs.id && !qs.email) {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing id or email" }) };
      }
      let subscribers = await loadSubscribers(store);
      const before = subscribers.length;
      subscribers = subscribers.filter(s => {
        if (qs.id && s.id === qs.id) return false;
        if (qs.email && s.email && s.email.toLowerCase() === qs.email.toLowerCase()) return false;
        return true;
      });
      await store.setJSON("subscribers", subscribers);
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true, removed: before - subscribers.length })
      };
    }

    // ------- POST (subscribe) -------
    if (event.httpMethod === "POST") {
      let data;
      try { data = JSON.parse(event.body || "{}"); }
      catch (e) { return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Invalid JSON" }) }; }

      const email = String(data.email || '').trim().toLowerCase();
      if (!isEmail(email)) {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Please enter a valid email address." }) };
      }

      const name = String(data.name || '').trim().slice(0, 200);
      const source = String(data.source || '').trim().slice(0, 200);
      const list = String(data.list || 'default').trim().slice(0, 60) || 'default';

      let subscribers = await loadSubscribers(store);

      // Dedup by (email, list) pair — same email can be on multiple lists.
      const existing = subscribers.find(s =>
        s.email && s.email.toLowerCase() === email &&
        (s.list || 'default') === list
      );

      if (!existing) {
        subscribers.push({
          id: generateId(),
          email,
          name: name || null,
          source: source || null,
          list,
          status: 'active',
          subscribedAt: new Date().toISOString(),
          ip: event.headers['x-forwarded-for'] || event.headers['client-ip'] || '',
          userAgent: (event.headers['user-agent'] || '').slice(0, 400)
        });
        if (subscribers.length > 20000) subscribers = subscribers.slice(subscribers.length - 20000);
        await store.setJSON("subscribers", subscribers);
      }

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true, message: existing ? "You're already on this list." : "Thank you for subscribing.", alreadySubscribed: !!existing })
      };
    }

    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("Newsletter subscribe error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: err.message || "Failed to process subscription" })
    };
  }
};

// Promo code management — CRUD via Netlify Blobs
// GET: returns all promo codes (with optional ?linkedTo=blog:<slug> filter)
// POST: full-replace OR { action: "add", code: {...} } / { action: "remove", code: "X" }
//
// Code schema (v2):
//   { code, discountPct, expiry, usageType, maxUses, tiers, forEveryone,
//     linkedTo (e.g. "blog:bip-15-..."), createdAt, status }

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  const store = getStore({ name: "promo-codes", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  try {
    if (event.httpMethod === "GET") {
      let codes = [];
      try {
        const existing = await store.get("codes", { type: "json" });
        if (existing) codes = existing;
      } catch (e) { /* no codes yet */ }

      const linkedTo = event.queryStringParameters && event.queryStringParameters.linkedTo;
      if (linkedTo) {
        codes = codes.filter(function(c) { return c.linkedTo === linkedTo; });
      }

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ codes })
      };
    }

    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body);

      // Load current codes
      let codes = [];
      try {
        const existing = await store.get("codes", { type: "json" });
        if (existing) codes = existing;
      } catch (e) { /* none */ }

      // Action-based mutations (used by the blog promo gate)
      if (data.action === "add" && data.code) {
        const incoming = data.code;
        if (!incoming.code) {
          return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Code is required" }) };
        }

        // Upsert by code (case-insensitive)
        const upperCode = String(incoming.code).toUpperCase();
        codes = codes.filter(function(c) { return String(c.code).toUpperCase() !== upperCode; });

        codes.push({
          code: upperCode,
          discountPct: Number(incoming.discountPct) || 0,
          expiry: incoming.expiry || "",
          usageType: incoming.usageType || "unlimited",
          maxUses: Number(incoming.maxUses) || null,
          tiers: Array.isArray(incoming.tiers) ? incoming.tiers : [],
          forEveryone: !!incoming.forEveryone,
          linkedTo: incoming.linkedTo || "",
          status: incoming.status || "active",
          createdAt: incoming.createdAt || new Date().toISOString(),
          // Extended fields for unique/lead-generated codes
          email: incoming.email || "",
          leadName: incoming.leadName || "",
          source: incoming.source || ""
        });

        await store.setJSON("codes", codes);
        return {
          statusCode: 200,
          headers: corsHeaders(),
          body: JSON.stringify({ success: true, codes, addedCode: upperCode })
        };
      }

      if (data.action === "remove" && data.code) {
        const upperCode = String(data.code).toUpperCase();
        codes = codes.filter(function(c) { return String(c.code).toUpperCase() !== upperCode; });
        await store.setJSON("codes", codes);
        return {
          statusCode: 200,
          headers: corsHeaders(),
          body: JSON.stringify({ success: true, codes, removedCode: upperCode })
        };
      }

      // Default: full replace (preserves existing admin Promo Code tab behavior)
      if (Array.isArray(data.codes)) {
        await store.setJSON("codes", data.codes);
        return {
          statusCode: 200,
          headers: corsHeaders(),
          body: JSON.stringify({ success: true, count: data.codes.length })
        };
      }

      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Invalid payload — expected { codes: [] } or { action: 'add'|'remove', code }" }) };
    }

    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("Promo codes error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to process promo codes: " + err.message })
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

// List all diagnosis records (strategist portal + admin dashboard)
// AUTH REQUIRED: Authorization: Bearer <token> where token is either
// a strategist session token (HMAC, SESSION_SECRET) or an admin token.

const { getStore } = require("@netlify/blobs");
const crypto = require("crypto");

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Strategist session token (same scheme as strategist-auth.js)
function verifyStrategistToken(token, secret) {
  if (!token || !secret || token.indexOf(".") === -1) return false;
  const parts = token.split(".");
  const expected = b64url(crypto.createHmac("sha256", secret).update(parts[0]).digest());
  const a = Buffer.from(parts[1]);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    return !!payload.exp && Date.now() <= payload.exp;
  } catch (e) { return false; }
}

// Admin token (base64 password:timestamp, 24h validity — see admin-auth.js)
function verifyAdminToken(token) {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!token || !adminPassword) return false;
  try {
    const decoded = Buffer.from(token, "base64").toString();
    const sep = decoded.lastIndexOf(":");
    if (sep === -1) return false;
    const pass = decoded.slice(0, sep);
    const ts = parseInt(decoded.slice(sep + 1), 10);
    const a = Buffer.from(pass);
    const b = Buffer.from(adminPassword);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
    return !!ts && (Date.now() - ts) < 24 * 3600 * 1000;
  } catch (e) { return false; }
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const authHeader = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!verifyStrategistToken(token, process.env.SESSION_SECRET) && !verifyAdminToken(token)) {
    return { statusCode: 401, headers: corsHeaders(), body: JSON.stringify({ error: "Authentication required" }) };
  }

  try {
    const store = getStore({ name: "diagnoses", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

    // Get the index
    let index = [];
    try {
      const existingIndex = await store.get("_index", { type: "json" });
      if (existingIndex) index = existingIndex;
    } catch (e) { /* index doesn't exist yet */ }

    // If full=true, return all records; otherwise just the index
    const full = event.queryStringParameters && event.queryStringParameters.full === "true";

    if (full) {
      // Fetch all records
      const records = {};
      for (const entry of index) {
        try {
          const record = await store.get(entry.code, { type: "json" });
          if (record) records[entry.code] = record;
        } catch (e) { /* skip failed entries */ }
      }
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ records, count: Object.keys(records).length })
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ index, count: index.length })
    };
  } catch (err) {
    console.error("List diagnoses error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to list diagnoses" })
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

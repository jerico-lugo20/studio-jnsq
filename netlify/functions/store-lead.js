// Store lead data from diagnostic gate form
// Uses Netlify Blobs for persistent storage

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const data = JSON.parse(event.body);
    const store = getStore({ name: "leads", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

    const key = data.access_code || ("lead-" + Date.now());
    const record = {
      ...data,
      storedAt: new Date().toISOString()
    };

    await store.setJSON(key, record);

    // Update leads index
    let index = [];
    try {
      const existing = await store.get("_index", { type: "json" });
      if (existing) index = existing;
    } catch (e) { /* no index yet */ }

    index.push({
      code: key,
      name: data.full_name || "",
      email: data.email || "",
      company: data.company || "",
      timestamp: data.timestamp || new Date().toISOString()
    });
    await store.setJSON("_index", index);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error("Store lead error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to store lead" })
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

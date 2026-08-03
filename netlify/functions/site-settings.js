// Site settings — key-value store for toggles and config
// GET: returns all settings
// POST: updates specific settings (merge)

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  var store = getStore({ name: "site-settings", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  try {
    if (event.httpMethod === "GET") {
      var settings = {};
      try {
        var existing = await store.get("settings", { type: "json" });
        if (existing) settings = existing;
      } catch (e) { /* no settings yet */ }

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ settings: settings })
      };
    }

    if (event.httpMethod === "POST") {
      var data = JSON.parse(event.body);

      // Load existing settings and merge
      var settings = {};
      try {
        var existing = await store.get("settings", { type: "json" });
        if (existing) settings = existing;
      } catch (e) { /* no settings yet */ }

      // Merge new settings in
      Object.keys(data).forEach(function(key) {
        settings[key] = data[key];
      });

      await store.setJSON("settings", settings);

      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true, settings: settings })
      };
    }

    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("Site settings error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to process settings" })
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

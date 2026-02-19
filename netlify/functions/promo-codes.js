// Promo code CRUD via Netlify Blobs — accessible from any device/browser
const { getStore, connectLambda } = require("@netlify/blobs");

const PROMO_KEY = "_promo_codes";

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  try {
    connectLambda(event);
    const store = getStore("diagnoses"); // reuse same store

    // GET — list all promo codes
    if (event.httpMethod === "GET") {
      let codes = [];
      try {
        const existing = await store.get(PROMO_KEY, { type: "json" });
        if (existing) codes = existing;
      } catch (e) { /* doesn't exist yet */ }
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ codes })
      };
    }

    // POST — save promo codes (full replace)
    if (event.httpMethod === "POST") {
      const data = JSON.parse(event.body);
      const codes = data.codes || [];
      await store.setJSON(PROMO_KEY, codes);
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true, count: codes.length })
      };
    }

    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  } catch (err) {
    console.error("Promo codes error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to process promo codes" })
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

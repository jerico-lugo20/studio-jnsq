// Store diagnostic gate lead data
// Uses Netlify Blobs for persistent key-value storage

const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    connectLambda(event);

    const data = JSON.parse(event.body);
    const { full_name, position, company, source, email, linkedin, access_code, timestamp } = data;

    if (!email || !access_code) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Email and access code are required" }) };
    }

    const store = getStore("diagnostic-leads");

    // Store the lead record keyed by access code
    const record = {
      full_name: full_name || "",
      position: position || "",
      company: company || "",
      source: source || "",
      email: email || "",
      linkedin: linkedin || "",
      access_code,
      timestamp: timestamp || new Date().toISOString(),
      storedAt: new Date().toISOString()
    };

    await store.setJSON(access_code, record);

    // Maintain an index of all leads
    let index = [];
    try {
      const existingIndex = await store.get("_index");
      if (existingIndex) index = JSON.parse(existingIndex);
    } catch (e) { /* index doesn't exist yet */ }

    index.push({
      access_code,
      full_name: full_name || "Unknown",
      email: email || "",
      company: company || "",
      timestamp: record.timestamp
    });
    await store.setJSON("_index", index);

    // Also add the access code to the promo codes list (in diagnoses store)
    // so it validates as a 100% discount code in the diagnostic payment flow
    const diagStore = getStore("diagnoses");
    const PROMO_KEY = "_promo_codes";
    let promoCodes = [];
    try {
      const existing = await diagStore.get(PROMO_KEY, { type: "json" });
      if (existing) promoCodes = existing;
    } catch (e) { /* doesn't exist yet */ }

    // Only add if not already present
    if (!promoCodes.find(c => c.code === access_code)) {
      promoCodes.push({
        code: access_code,
        discountPct: 100,
        fullFree: true,
        label: "Diagnostic Gate - " + (full_name || email),
        expiry: "",
        maxUses: 1,
        usedCount: 0,
        createdAt: new Date().toISOString(),
        source: "diagnostic-gate"
      });
      await diagStore.setJSON(PROMO_KEY, promoCodes);
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ success: true, access_code })
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

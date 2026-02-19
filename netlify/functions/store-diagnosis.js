// Store a diagnosis record (centralized storage)
// Uses Netlify Blobs for persistent key-value storage

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const data = JSON.parse(event.body);
    const { code, percentages, scores, contact, tier, questionAnswers, interventionData, intake, fileData, timestamp } = data;

    if (!code) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Diagnosis code is required" }) };
    }

    const store = getStore("diagnoses");

    // Store the full diagnosis record
    const record = {
      code,
      percentages: percentages || {},
      scores: scores || {},
      contact: contact || {},
      tier: tier || "free",
      questionAnswers: questionAnswers || {},
      interventionData: interventionData || {},
      intake: intake || {},
      fileData: fileData || {},
      timestamp: timestamp || new Date().toISOString(),
      storedAt: new Date().toISOString()
    };

    await store.setJSON(code, record);

    // Also maintain an index of all codes for listing
    let index = [];
    try {
      const existingIndex = await store.get("_index");
      if (existingIndex) index = JSON.parse(existingIndex);
    } catch (e) { /* index doesn't exist yet */ }

    if (!index.find(entry => entry.code === code)) {
      index.push({
        code,
        name: (contact && contact.name) || "Unknown",
        email: (contact && contact.email) || "",
        tier: tier || "free",
        timestamp: record.timestamp
      });
      await store.setJSON("_index", index);
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ success: true, code })
    };
  } catch (err) {
    console.error("Store diagnosis error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to store diagnosis" })
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

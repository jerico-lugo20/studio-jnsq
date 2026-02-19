// List all diagnosis records (for strategist portal)

const { getStore, connectLambda } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    // Connect Lambda environment for Netlify Blobs
    connectLambda(event);

    const store = getStore("diagnoses");

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
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

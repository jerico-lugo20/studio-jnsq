// Retrieve a diagnosis record by code

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const code = event.queryStringParameters && event.queryStringParameters.code;
    if (!code) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Code parameter is required" }) };
    }

    const store = getStore("diagnoses");
    const record = await store.get(code, { type: "json" });

    if (!record) {
      return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Diagnosis not found" }) };
    }

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify(record)
    };
  } catch (err) {
    console.error("Get diagnosis error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to retrieve diagnosis" })
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

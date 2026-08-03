// Admin portal authentication
// Validates password against environment variable ADMIN_PASSWORD
// Returns a simple session token on success

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    const data = JSON.parse(event.body);
    const password = data.password || "";
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.error("ADMIN_PASSWORD environment variable not set");
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Admin portal not configured" })
      };
    }

    if (password === adminPassword) {
      // Generate a simple session token (valid for 24 hours)
      const token = Buffer.from(adminPassword + ":" + Date.now()).toString("base64");
      return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify({ success: true, token })
      };
    }

    return {
      statusCode: 401,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Invalid password" })
    };
  } catch (err) {
    console.error("Admin auth error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Authentication failed" })
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

// Agent Trigger — manual on-demand invocation of any agent's scan logic
//
// POST /.netlify/functions/agent-trigger
//   body: { agent: 'dev' | 'rank' | 'growth' | 'pipeline' | 'press' }
// GET  /.netlify/functions/agent-trigger?agent=dev
//
// Runs the scan, submits a fresh brief to agent-hub, and returns a summary.
// Used by the admin's "Run Now" button on each agent card.

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

// Lazy-load each agent so a missing/broken sibling doesn't bring this whole endpoint down.
function loadAgent(name) {
  switch (name) {
    case "dev":      return require("./agent-dev");
    case "rank":     try { return require("./agent-rank"); }     catch (e) { return null; }
    case "growth":   try { return require("./agent-growth"); }   catch (e) { return null; }
    case "pipeline": try { return require("./agent-pipeline"); } catch (e) { return null; }
    case "press":    try { return require("./agent-press"); }    catch (e) { return null; }
    default: return null;
  }
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  var agentName = "";
  if (event.httpMethod === "GET") {
    agentName = (event.queryStringParameters && event.queryStringParameters.agent) || "";
  } else if (event.httpMethod === "POST") {
    try {
      var body = JSON.parse(event.body || "{}");
      agentName = body.agent || "";
    } catch (e) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Invalid JSON body" }) };
    }
  } else {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  if (!agentName) {
    return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "agent param required" }) };
  }

  var mod = loadAgent(agentName);
  if (!mod) {
    return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Unknown agent: " + agentName }) };
  }

  if (typeof mod.runScan !== "function") {
    return {
      statusCode: 501,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: "Agent " + agentName + " does not yet expose runScan().",
        hint: "Refactor agent-" + agentName + ".js to export runScan = async () => {...} for manual triggering."
      }),
    };
  }

  var startedAt = new Date().toISOString();
  try {
    var result = await mod.runScan();
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: true,
        agent: agentName,
        startedAt: startedAt,
        finishedAt: new Date().toISOString(),
        result: result || {},
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        ok: false,
        agent: agentName,
        error: e.message || String(e),
        stack: (e.stack || "").slice(0, 2000),
        startedAt: startedAt,
      }),
    };
  }
};

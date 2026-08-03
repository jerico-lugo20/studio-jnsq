// List all leads — merges from both "leads" and "diagnoses" blob stores
// Deduplicates by email, preferring the most complete record

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  try {
    // Fetch from leads store
    var leadsStore = getStore({ name: "leads", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
    var leadsIndex = [];
    try {
      var existing = await leadsStore.get("_index", { type: "json" });
      if (existing) leadsIndex = existing;
    } catch (e) { /* no leads index yet */ }

    // Fetch from diagnoses store
    var diagStore = getStore({ name: "diagnoses", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
    var diagIndex = [];
    try {
      var existingDiag = await diagStore.get("_index", { type: "json" });
      if (existingDiag) diagIndex = existingDiag;
    } catch (e) { /* no diagnoses index yet */ }

    // Normalize leads from leads store
    var allLeads = leadsIndex.map(function(lead) {
      return {
        name: lead.name || "",
        email: lead.email || "",
        company: lead.company || "",
        source: lead.source || "gate",
        promoCode: lead.code || "",
        date: lead.timestamp || ""
      };
    });

    // Normalize leads from diagnoses store (only those with contact info)
    diagIndex.forEach(function(diag) {
      if (diag.name || diag.email) {
        allLeads.push({
          name: diag.name || "",
          email: diag.email || "",
          company: diag.company || "",
          source: diag.tier ? (diag.code && diag.code.indexOf("RVF") === 0 ? "RVF" : "MAD") : "diagnostic",
          promoCode: diag.code || "",
          date: diag.timestamp || ""
        });
      }
    });

    // Deduplicate by email — keep the most complete record
    var seen = {};
    var merged = [];
    allLeads.forEach(function(lead) {
      var key = (lead.email || lead.name || lead.promoCode).toLowerCase();
      if (!key) return;
      if (!seen[key]) {
        seen[key] = lead;
        merged.push(lead);
      } else {
        // Merge missing fields into existing record
        var existing = seen[key];
        if (!existing.name && lead.name) existing.name = lead.name;
        if (!existing.company && lead.company) existing.company = lead.company;
        if (!existing.source && lead.source) existing.source = lead.source;
        if (!existing.promoCode && lead.promoCode) existing.promoCode = lead.promoCode;
      }
    });

    // Sort by date descending
    merged.sort(function(a, b) {
      return new Date(b.date || 0) - new Date(a.date || 0);
    });

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({ leads: merged, count: merged.length })
    };
  } catch (err) {
    console.error("List leads error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Failed to list leads" })
    };
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };
}

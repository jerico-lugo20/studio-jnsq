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
    // CRITICAL: type/trade/overallScore must round-trip for RVF records — without them,
    // the strategist portal cannot distinguish RVF from MAD and the retrieved diagnosis
    // shows trade as undefined. Older versions of this function dropped them silently.
    const {
      code, percentages, scores, contact, tier,
      questionAnswers, interventionData, intake, fileData, timestamp,
      type, trade, overallScore, diagnosticType,
      // MAD individual path: without these the report regenerates as a company
      // report on retrieval (wrong price, no archetype page).
      diagnosticMode, archetype
    } = data;

    if (!code) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Diagnosis code is required" }) };
    }

    const store = getStore({ name: "diagnoses", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

    // Determine the diagnostic type. Trust an explicit `type` field; otherwise infer
    // from the score keys (RVF uses aspiration/reality/readiness/horizon; MAD uses
    // branding/demand/credibility/visibility/trust).
    let resolvedType = (type || diagnosticType || "").toLowerCase();
    if (!resolvedType) {
      const keys = Object.keys(percentages || scores || {});
      if (keys.some(k => ["aspiration","reality","readiness","horizon"].includes(k))) resolvedType = "rvf";
      else if (keys.some(k => ["branding","demand","credibility","visibility","trust"].includes(k))) resolvedType = "mad";
    }
    if (resolvedType !== "rvf" && resolvedType !== "mad") resolvedType = ""; // unknown stays empty rather than wrong

    // Merge with any existing record so a follow-up POST (e.g. after the contact gate)
    // doesn't blow away earlier fields. If a field is provided in the new payload, it wins.
    let existingRecord = null;
    try { existingRecord = await store.get(code, { type: "json" }); } catch (e) { /* new record */ }

    const record = Object.assign({}, existingRecord || {}, {
      code,
      type: resolvedType || (existingRecord && existingRecord.type) || "",
      percentages: percentages || (existingRecord && existingRecord.percentages) || {},
      scores: scores || (existingRecord && existingRecord.scores) || {},
      contact: contact || (existingRecord && existingRecord.contact) || {},
      tier: tier || (existingRecord && existingRecord.tier) || "free",
      questionAnswers: questionAnswers || (existingRecord && existingRecord.questionAnswers) || {},
      interventionData: interventionData || (existingRecord && existingRecord.interventionData) || {},
      intake: intake || (existingRecord && existingRecord.intake) || {},
      fileData: fileData || (existingRecord && existingRecord.fileData) || {},
      // MAD-specific: the individual/company path and the resolved archetype
      diagnosticMode: diagnosticMode || (existingRecord && existingRecord.diagnosticMode) || null,
      archetype: (archetype !== undefined && archetype !== null) ? archetype : ((existingRecord && existingRecord.archetype) || null),
      // RVF-specific: trade + overallScore must persist
      trade: (trade !== undefined && trade !== null) ? trade : (existingRecord && existingRecord.trade) || null,
      overallScore: (overallScore !== undefined && overallScore !== null) ? overallScore : (existingRecord && existingRecord.overallScore) || null,
      timestamp: timestamp || (existingRecord && existingRecord.timestamp) || new Date().toISOString(),
      storedAt: new Date().toISOString()
    });

    await store.setJSON(code, record);

    // Also maintain an index of all codes for listing. Update existing entries
    // so the strategist portal's quick-list shows the right type/name once contact
    // info arrives in a follow-up save.
    let index = [];
    try {
      const existingIndex = await store.get("_index", { type: "json" });
      if (existingIndex) index = existingIndex;
    } catch (e) { /* index doesn't exist yet */ }

    const indexEntry = {
      code,
      type: record.type,
      name: (record.contact && record.contact.name) || "Unknown",
      email: (record.contact && record.contact.email) || "",
      tier: record.tier,
      trade: record.trade || null,
      overallScore: record.overallScore || null,
      timestamp: record.timestamp,
      updatedAt: record.storedAt
    };
    const existingIdx = index.findIndex(entry => entry.code === code);
    if (existingIdx === -1) {
      index.push(indexEntry);
    } else {
      index[existingIdx] = Object.assign({}, index[existingIdx], indexEntry);
    }
    await store.setJSON("_index", index);

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

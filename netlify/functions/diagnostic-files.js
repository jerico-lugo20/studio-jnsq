// Diagnostic intake file storage via Netlify Blobs
// Store: diagnostic-files (keys: CODE/fileKey)
//
// POST action=upload — public (intake flow): { code, fileKey, name, type, data(base64) }
//                      Only accepted if the diagnosis code already exists. 4MB cap.
// POST action=list   — strategist session required: { token, code } -> { files: {key:{name,type,size}} }
// POST action=get    — strategist session required: { token, code, fileKey } -> { name, type, data }

var { getStore } = require("@netlify/blobs");
var crypto = require("crypto");

var FILE_KEYS = ["brandKit", "mediaKit", "strategyDeck"];
var MAX_BYTES = 4 * 1024 * 1024; // 4MB decoded

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

function resp(code, obj) {
  return { statusCode: code, headers: corsHeaders(), body: JSON.stringify(obj) };
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Same session scheme as strategist-auth.js
function verifySession(token, secret) {
  if (!token || token.indexOf(".") === -1) return null;
  var parts = token.split(".");
  var expected = b64url(crypto.createHmac("sha256", secret).update(parts[0]).digest());
  var a = Buffer.from(parts[1]);
  var b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    var payload = JSON.parse(Buffer.from(parts[0].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString());
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch (e) { return null; }
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders(), body: "" };
  if (event.httpMethod !== "POST") return resp(405, { error: "POST only" });

  var body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return resp(400, { error: "Invalid JSON" }); }
  var action = body.action;

  var files = getStore({ name: "diagnostic-files", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  // ---------- upload (public, from intake) ----------
  if (action === "upload") {
    var code = String(body.code || "").trim().toUpperCase();
    // Codes were minted as MAD-*, MAD-I*, RVF-* and legacy JNSQ-*. The old
    // pattern accepted only JNSQ-*, so every MAD/RVF intake upload was rejected
    // with "Invalid code" and silently swallowed by the client. This is why
    // captured files never reached storage.
    if (!/^(JNSQ|MAD|RVF)-[A-Z0-9-]{4,20}$/.test(code)) return resp(400, { error: "Invalid code" });
    if (FILE_KEYS.indexOf(body.fileKey) === -1) return resp(400, { error: "Invalid file key" });
    if (!body.data || typeof body.data !== "string") return resp(400, { error: "No file data" });

    // Size guard: base64 -> bytes
    var approxBytes = Math.floor(body.data.length * 3 / 4);
    if (approxBytes > MAX_BYTES) return resp(413, { error: "File exceeds 4MB. Please share a link (Google Drive, Dropbox) instead." });

    // The diagnosis must already exist, upload is tied to a real record
    var diagnoses = getStore({ name: "diagnoses", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
    var record = await diagnoses.get(code, { type: "json" });
    if (!record) return resp(404, { error: "Diagnosis not found" });

    await files.setJSON(code + "/" + body.fileKey, {
      name: String(body.name || body.fileKey).slice(0, 200),
      type: String(body.type || "application/octet-stream").slice(0, 100),
      size: approxBytes,
      data: body.data,
      uploadedAt: new Date().toISOString()
    });
    return resp(200, { ok: true });
  }

  // ---------- everything below requires a strategist session ----------
  var secret = process.env.SESSION_SECRET;
  if (!secret) return resp(500, { error: "SESSION_SECRET not configured" });
  var session = verifySession(body.token, secret);
  if (!session) return resp(401, { error: "Session expired. Log in again." });

  var code2 = String(body.code || "").trim().toUpperCase();
  if (!code2) return resp(400, { error: "Code required" });

  if (action === "list") {
    var out = {};
    for (var i = 0; i < FILE_KEYS.length; i++) {
      var meta = await files.get(code2 + "/" + FILE_KEYS[i], { type: "json" });
      if (meta) out[FILE_KEYS[i]] = { name: meta.name, type: meta.type, size: meta.size, uploadedAt: meta.uploadedAt };
    }
    return resp(200, { files: out });
  }

  if (action === "get") {
    if (FILE_KEYS.indexOf(body.fileKey) === -1) return resp(400, { error: "Invalid file key" });
    var f = await files.get(code2 + "/" + body.fileKey, { type: "json" });
    if (!f) return resp(404, { error: "File not found" });
    return resp(200, { name: f.name, type: f.type, data: f.data });
  }

  return resp(400, { error: "Unknown action" });
};

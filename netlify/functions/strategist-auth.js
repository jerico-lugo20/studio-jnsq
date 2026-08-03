// Strategist Portal authentication via Netlify Blobs
// Store: strategist-users (user records), strategist-audit (audit log)
//
// POST action=bootstrap        — first-run: create founder OVR account (only if no users exist)
// POST action=login            — email + password -> session token
// POST action=verify           — validate session token -> identity
// POST action=change-password  — authed user changes own password
// POST action=create-user      — OVR: any role; MANAGER: strategists only
// POST action=list-users       — OVR / MANAGER
// POST action=set-active       — OVR only: activate / deactivate a user
//
// Roles: OVR (founder, full override) > MANAGER (approves) > STRATEGIST
// Sessions: HMAC-SHA256 signed tokens, 12h expiry. Secret: SESSION_SECRET env var.
// Passwords: scrypt, per-user random salt. 5 failed logins locks account 15 min.

var { getStore } = require("@netlify/blobs");
var crypto = require("crypto");

var FOUNDER_EMAIL = "jerico.lugo20@gmail.com";
var ROLES = ["OVR", "MANAGER", "STRATEGIST"];
var SESSION_HOURS = 12;
var MAX_FAILS = 5;
var LOCK_MINUTES = 15;
var MIN_PASSWORD_LEN = 10;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

function resp(code, obj) {
  return { statusCode: code, headers: corsHeaders(), body: JSON.stringify(obj) };
}

function hashPassword(password, salt) {
  salt = salt || crypto.randomBytes(16).toString("hex");
  var hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt: salt, hash: hash };
}

function verifyPassword(password, salt, expectedHash) {
  var got = crypto.scryptSync(password, salt, 64);
  var expected = Buffer.from(expectedHash, "hex");
  return got.length === expected.length && crypto.timingSafeEqual(got, expected);
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signSession(payload, secret) {
  var body = b64url(JSON.stringify(payload));
  var sig = b64url(crypto.createHmac("sha256", secret).update(body).digest());
  return body + "." + sig;
}

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

function makeToken(user, secret) {
  return signSession({
    email: user.email,
    name: user.name,
    role: user.role,
    exp: Date.now() + SESSION_HOURS * 3600 * 1000
  }, secret);
}

function normEmail(e) { return String(e || "").trim().toLowerCase(); }

async function audit(store, entry) {
  entry.at = new Date().toISOString();
  var key = "log-" + Date.now() + "-" + crypto.randomBytes(4).toString("hex");
  try { await store.setJSON(key, entry); } catch (e) { /* audit must never block auth */ }
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders(), body: "" };
  if (event.httpMethod !== "POST") return resp(405, { error: "POST only" });

  var secret = process.env.SESSION_SECRET;
  if (!secret) return resp(500, { error: "SESSION_SECRET not configured" });

  var users = getStore({ name: "strategist-users", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  var auditStore = getStore({ name: "strategist-audit", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });

  var body;
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return resp(400, { error: "Invalid JSON" }); }
  var action = body.action;

  // ---------- bootstrap: founder account, only when store is empty ----------
  if (action === "bootstrap") {
    var existing = await users.list();
    if (existing.blobs && existing.blobs.length > 0) return resp(403, { error: "Already initialized" });
    var email = normEmail(body.email);
    if (email !== FOUNDER_EMAIL) return resp(403, { error: "Bootstrap is restricted to the founder account" });
    if (!body.password || body.password.length < MIN_PASSWORD_LEN) return resp(400, { error: "Password must be at least " + MIN_PASSWORD_LEN + " characters" });
    var pw = hashPassword(body.password);
    var user = {
      email: email, name: body.name || "Jec", role: "OVR",
      salt: pw.salt, hash: pw.hash,
      active: true, mustChangePassword: false,
      fails: 0, lockUntil: 0,
      createdAt: new Date().toISOString(), createdBy: "bootstrap"
    };
    await users.setJSON(email, user);
    await audit(auditStore, { event: "bootstrap", email: email });
    return resp(200, { token: makeToken(user, secret), user: { email: user.email, name: user.name, role: user.role } });
  }

  // ---------- login ----------
  if (action === "login") {
    var email = normEmail(body.email);
    var listing = await users.list();
    if (!listing.blobs || listing.blobs.length === 0) return resp(409, { error: "NO_USERS" }); // triggers founder setup UI
    var user = await users.get(email, { type: "json" });
    if (!user || !user.active) {
      await audit(auditStore, { event: "login-fail", email: email, reason: user ? "inactive" : "unknown" });
      return resp(401, { error: "Invalid credentials" });
    }
    if (user.lockUntil && Date.now() < user.lockUntil) {
      return resp(429, { error: "Account locked. Try again in a few minutes." });
    }
    if (!body.password || !verifyPassword(body.password, user.salt, user.hash)) {
      user.fails = (user.fails || 0) + 1;
      if (user.fails >= MAX_FAILS) { user.lockUntil = Date.now() + LOCK_MINUTES * 60 * 1000; user.fails = 0; }
      await users.setJSON(email, user);
      await audit(auditStore, { event: "login-fail", email: email, reason: "bad-password" });
      return resp(401, { error: "Invalid credentials" });
    }
    user.fails = 0; user.lockUntil = 0; user.lastLogin = new Date().toISOString();
    await users.setJSON(email, user);
    await audit(auditStore, { event: "login", email: email, role: user.role });
    return resp(200, {
      token: makeToken(user, secret),
      user: { email: user.email, name: user.name, role: user.role },
      mustChangePassword: !!user.mustChangePassword
    });
  }

  // ---------- everything below requires a valid session ----------
  var session = verifySession(body.token, secret);
  if (!session) return resp(401, { error: "Session expired. Log in again." });
  var actor = await users.get(normEmail(session.email), { type: "json" });
  if (!actor || !actor.active) return resp(401, { error: "Account no longer active" });

  if (action === "verify") {
    return resp(200, { user: { email: actor.email, name: actor.name, role: actor.role }, mustChangePassword: !!actor.mustChangePassword });
  }

  if (action === "change-password") {
    if (!body.newPassword || body.newPassword.length < MIN_PASSWORD_LEN) return resp(400, { error: "Password must be at least " + MIN_PASSWORD_LEN + " characters" });
    if (!body.mustChange) { // normal change requires current password; first-login forced change doesn't
      if (!body.currentPassword || !verifyPassword(body.currentPassword, actor.salt, actor.hash)) return resp(401, { error: "Current password is incorrect" });
    } else if (!actor.mustChangePassword) {
      return resp(403, { error: "No forced change pending" });
    }
    var npw = hashPassword(body.newPassword);
    actor.salt = npw.salt; actor.hash = npw.hash; actor.mustChangePassword = false;
    await users.setJSON(actor.email, actor);
    await audit(auditStore, { event: "password-changed", email: actor.email });
    return resp(200, { ok: true, token: makeToken(actor, secret) });
  }

  if (action === "create-user") {
    var role = String(body.role || "").toUpperCase();
    if (ROLES.indexOf(role) === -1) return resp(400, { error: "Role must be one of " + ROLES.join(", ") });
    if (actor.role === "STRATEGIST") return resp(403, { error: "Strategists cannot create users" });
    if (actor.role === "MANAGER" && role !== "STRATEGIST") return resp(403, { error: "Managers can only create strategist accounts" });
    var email = normEmail(body.email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return resp(400, { error: "Valid email required" });
    if (!body.name) return resp(400, { error: "Name required" });
    if (!body.tempPassword || body.tempPassword.length < MIN_PASSWORD_LEN) return resp(400, { error: "Temp password must be at least " + MIN_PASSWORD_LEN + " characters" });
    var dupe = await users.get(email, { type: "json" });
    if (dupe) return resp(409, { error: "User already exists" });
    var pw = hashPassword(body.tempPassword);
    var nu = {
      email: email, name: body.name, role: role,
      salt: pw.salt, hash: pw.hash,
      active: true, mustChangePassword: true,
      fails: 0, lockUntil: 0,
      managerEmail: role === "STRATEGIST" ? (normEmail(body.managerEmail) || (actor.role === "MANAGER" ? actor.email : "")) : "",
      createdAt: new Date().toISOString(), createdBy: actor.email
    };
    await users.setJSON(email, nu);
    await audit(auditStore, { event: "user-created", email: email, role: role, by: actor.email });
    return resp(200, { ok: true, user: { email: nu.email, name: nu.name, role: nu.role } });
  }

  if (action === "list-users") {
    if (actor.role === "STRATEGIST") return resp(403, { error: "Not authorized" });
    var listing = await users.list();
    var out = [];
    for (var i = 0; i < (listing.blobs || []).length; i++) {
      var u = await users.get(listing.blobs[i].key, { type: "json" });
      if (!u) continue;
      if (actor.role === "MANAGER" && u.role !== "STRATEGIST" && u.email !== actor.email) continue;
      out.push({ email: u.email, name: u.name, role: u.role, active: u.active, mustChangePassword: !!u.mustChangePassword, managerEmail: u.managerEmail || "", lastLogin: u.lastLogin || null, createdAt: u.createdAt });
    }
    return resp(200, { users: out });
  }

  if (action === "set-active") {
    if (actor.role !== "OVR") return resp(403, { error: "Only OVR can activate or deactivate accounts" });
    var email = normEmail(body.email);
    if (email === actor.email) return resp(400, { error: "You cannot deactivate your own account" });
    var target = await users.get(email, { type: "json" });
    if (!target) return resp(404, { error: "User not found" });
    target.active = !!body.active;
    await users.setJSON(email, target);
    await audit(auditStore, { event: body.active ? "user-activated" : "user-deactivated", email: email, by: actor.email });
    return resp(200, { ok: true });
  }

  // ---------- reset-password: OVR resets anyone, MANAGER resets strategists ----------
  if (action === "reset-password") {
    if (actor.role === "STRATEGIST") return resp(403, { error: "Ask your manager or OVR to reset your password" });
    var email = normEmail(body.email);
    var target = await users.get(email, { type: "json" });
    if (!target) return resp(404, { error: "User not found" });
    if (actor.role === "MANAGER" && target.role !== "STRATEGIST") return resp(403, { error: "Managers can only reset strategist passwords" });
    if (!body.tempPassword || body.tempPassword.length < MIN_PASSWORD_LEN) return resp(400, { error: "Temp password must be at least " + MIN_PASSWORD_LEN + " characters" });
    var pw = hashPassword(body.tempPassword);
    target.salt = pw.salt;
    target.hash = pw.hash;
    target.mustChangePassword = true;
    target.fails = 0;
    target.lockUntil = 0;
    await users.setJSON(email, target);
    await audit(auditStore, { event: "password-reset", email: email, by: actor.email });
    return resp(200, { ok: true });
  }

  return resp(400, { error: "Unknown action" });
};

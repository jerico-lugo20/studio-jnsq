// Gmail Send API — proxies email sending through Gmail API
// Requires GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN env vars
// Set these up via Google Cloud Console → APIs → Gmail API → OAuth2

var https = require("https");
var { getStore } = require("@netlify/blobs");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

// Get fresh access token from refresh token
function getAccessToken() {
  return new Promise(function(resolve, reject) {
    var clientId = process.env.GMAIL_CLIENT_ID;
    var clientSecret = process.env.GMAIL_CLIENT_SECRET;
    var refreshToken = process.env.GMAIL_REFRESH_TOKEN;

    if (!clientId || !clientSecret || !refreshToken) {
      reject(new Error("Gmail OAuth not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN in Netlify env vars."));
      return;
    }

    var postData = "client_id=" + encodeURIComponent(clientId) +
                   "&client_secret=" + encodeURIComponent(clientSecret) +
                   "&refresh_token=" + encodeURIComponent(refreshToken) +
                   "&grant_type=refresh_token";

    var options = {
      hostname: "oauth2.googleapis.com",
      path: "/token",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Content-Length": Buffer.byteLength(postData) }
    };

    var req = https.request(options, function(res) {
      var data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() {
        try {
          var parsed = JSON.parse(data);
          if (parsed.access_token) resolve(parsed.access_token);
          else reject(new Error("Token refresh failed: " + data));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

// ---------- Studio JNSQ branded email template ----------

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Plain text body -> simple HTML paragraphs (bare URLs become links)
function textToHtml(text) {
  var escaped = escapeHtml(text);
  escaped = escaped.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#394550;text-decoration:underline;">$1</a>');
  var paragraphs = escaped.split(/\n\s*\n/);
  return paragraphs.map(function (p) {
    return '<p style="margin:0 0 16px 0;">' + p.replace(/\n/g, "<br>") + "</p>";
  }).join("");
}

// Extract a display name from "Name <email>" or fall back to the mailbox
function senderNameFrom(from) {
  var m = String(from || "").match(/^\s*"?([^"<]+?)"?\s*</);
  if (m) return m[1].trim();
  var mailbox = String(from || "").split("@")[0];
  return mailbox ? mailbox.charAt(0).toUpperCase() + mailbox.slice(1) : "Studio JNSQ";
}

// Wrap body content in the Studio JNSQ branded shell
function brandedHtml(bodyText, senderName) {
  return [
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background-color:#f7f5f0;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f7f5f0;padding:32px 16px;"><tr><td align="center">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;">',
    // yellow accent bar
    '<tr><td style="height:5px;background-color:#FDD500;font-size:0;line-height:0;">&nbsp;</td></tr>',
    // logotype header
    '<tr><td style="padding:28px 40px 0 40px;font-family:Georgia,\'Times New Roman\',serif;font-size:22px;font-weight:bold;color:#1a1a1a;">Studio JNSQ<span style="color:#FDD500;">.</span></td></tr>',
    // body
    '<tr><td style="padding:24px 40px 8px 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.65;color:#394550;">',
    bodyText,
    "</td></tr>",
    // signature
    '<tr><td style="padding:8px 40px 28px 40px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#394550;">',
    '<p style="margin:0;">' + escapeHtml(senderName) + '<br><span style="font-size:13px;color:#8a939b;">Studio JNSQ</span></p>',
    "</td></tr>",
    // footer
    '<tr><td style="padding:20px 40px 24px 40px;border-top:1px solid #eeeae0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#8a939b;">',
    '<p style="margin:0 0 4px 0;">Studio JNSQ &middot; The Brand Equity Architecture Firm For Valuable Brands</p>',
    '<p style="margin:0 0 4px 0;font-style:italic;">Others make you profitable. Brand equity makes you valuable.</p>',
    '<p style="margin:0;"><a href="https://studiojnsq.com" style="color:#8a939b;text-decoration:underline;">studiojnsq.com</a></p>',
    "</td></tr>",
    "</table></td></tr></table></body></html>"
  ].join("");
}

// Build RFC 2822 multipart email (plain text + branded HTML) and base64url encode it
// opts.senderName overrides the name shown in the signature; opts.plain skips branding
function buildRawEmail(from, to, cc, bcc, subject, body, opts) {
  opts = opts || {};
  var headers = [];
  headers.push("From: " + from);
  headers.push("To: " + to);
  if (cc) headers.push("Cc: " + cc);
  if (bcc) headers.push("Bcc: " + bcc);
  headers.push("Subject: " + subject);
  headers.push("MIME-Version: 1.0");

  if (opts.plain) {
    headers.push("Content-Type: text/plain; charset=UTF-8");
    headers.push("");
    headers.push(body);
  } else {
    var boundary = "jnsq-" + Date.now().toString(36);
    var senderName = opts.senderName || senderNameFrom(from);
    var htmlBody = opts.html ? body : textToHtml(body);
    var plainBody = opts.html ? String(body).replace(/<[^>]+>/g, "") : body;
    headers.push('Content-Type: multipart/alternative; boundary="' + boundary + '"');
    headers.push("");
    headers.push("--" + boundary);
    headers.push("Content-Type: text/plain; charset=UTF-8");
    headers.push("");
    headers.push(plainBody);
    headers.push("");
    headers.push("--" + boundary);
    headers.push("Content-Type: text/html; charset=UTF-8");
    headers.push("");
    headers.push(brandedHtml(htmlBody, senderName));
    headers.push("");
    headers.push("--" + boundary + "--");
  }

  var rawEmail = headers.join("\r\n");
  return Buffer.from(rawEmail).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Send email via Gmail API
function sendViaGmail(accessToken, rawEmail) {
  return new Promise(function(resolve, reject) {
    var postBody = JSON.stringify({ raw: rawEmail });
    var options = {
      hostname: "gmail.googleapis.com",
      path: "/gmail/v1/users/me/messages/send",
      method: "POST",
      headers: {
        "Authorization": "Bearer " + accessToken,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postBody)
      }
    };

    var req = https.request(options, function(res) {
      var data = "";
      res.on("data", function(chunk) { data += chunk; });
      res.on("end", function() {
        try {
          var parsed = JSON.parse(data);
          if (res.statusCode === 200 || res.statusCode === 201) resolve(parsed);
          else reject(new Error("Gmail API error " + res.statusCode + ": " + data));
        } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(postBody);
    req.end();
  });
}

exports.handler = async function(event, context) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  var body;
  try { body = JSON.parse(event.body); } catch (e) { body = {}; }

  if (body.action === "send") {
    try {
      var accessToken = await getAccessToken();
      var rawEmail = buildRawEmail(
        body.from || "jerico.lugo20@gmail.com",
        body.to,
        body.cc || "",
        body.bcc || "",
        body.subject,
        body.body,
        { senderName: body.senderName, plain: !!body.plain, html: !!body.html }
      );
      var result = await sendViaGmail(accessToken, rawEmail);

      // Mark draft as sent in CRM
      if (body.draftId) {
        var activitiesStore = getStore({ name: "crm-activities", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
        try {
          var draft = await activitiesStore.get("email_" + body.draftId, { type: "json" });
          if (draft) {
            draft.status = "sent";
            draft.sentAt = new Date().toISOString();
            draft.gmailMessageId = result.id || null;
            await activitiesStore.setJSON("email_" + body.draftId, draft);
          }
        } catch (e) {}
      }

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: true, messageId: result.id }) };
    } catch (err) {
      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ ok: false, error: err.message }) };
    }
  }

  if (body.action === "check") {
    // Check if Gmail OAuth is configured
    var configured = !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ configured: configured }) };
  }

  return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Unknown action" }) };
};

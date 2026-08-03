// Agent Dev (Developer) — Netlify Scheduled Function
// Runs daily at 5:20 AM UTC+8 (21:20 UTC previous day)
// Scans live site for health + fixable code issues. Emits items with action contracts
// so the cowork-watcher can dispatch fixable items to `claude -p` automatically.

var { schedule } = require("@netlify/functions");
var https = require("https");
var tls = require("tls");
var helpers = require("./_agent-helpers");
var structuredItem = helpers.structuredItem;
var manualContract = helpers.manualContract;
var autoContract = helpers.autoContract;
var DEPLOY_DIR = helpers.DEPLOY_DIR;

function httpGet(url) {
  return new Promise(function (resolve, reject) {
    var start = Date.now();
    https
      .get(url, { headers: { "User-Agent": "StudioJNSQ-DevAgent/1.0" } }, function (res) {
        var data = "";
        res.on("data", function (chunk) {
          data += chunk;
        });
        res.on("end", function () {
          resolve({ status: res.statusCode, time: Date.now() - start, body: data });
        });
      })
      .on("error", reject);
  });
}

function httpPost(url, payload) {
  return new Promise(function (resolve, reject) {
    var body = JSON.stringify(payload);
    var parsed = new URL(url);
    var options = {
      hostname: parsed.hostname,
      path: parsed.pathname,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    };
    var req = https.request(options, function (res) {
      var data = "";
      res.on("data", function (chunk) {
        data += chunk;
      });
      res.on("end", function () {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function checkSSL(hostname) {
  return new Promise(function (resolve, reject) {
    var socket = tls.connect(443, hostname, { servername: hostname }, function () {
      var cert = socket.getPeerCertificate();
      var expiry = new Date(cert.valid_to);
      var daysLeft = Math.floor((expiry - Date.now()) / (1000 * 60 * 60 * 24));
      socket.destroy();
      resolve({ expiry: expiry.toISOString(), daysLeft: daysLeft });
    });
    socket.on("error", reject);
  });
}

// ── Fixable-issue scanners ──────────────────────────────────────────────────

function scanForDoubleTrademark(html, pageUrl, pageName) {
  var hits = [];
  // Literal double ™, double &#8482;, or escape+literal mix
  var patterns = [
    { rx: /™™/g, label: "literal ™™" },
    { rx: /&#8482;&#8482;/g, label: "&#8482;&#8482;" },
    { rx: /™\\u2122/g, label: "literal+escape ™\\u2122" },
    { rx: /\\u2122\\u2122/g, label: "double escape \\u2122\\u2122" },
  ];
  patterns.forEach(function (p) {
    var matches = html.match(p.rx);
    if (matches && matches.length) {
      hits.push({ pattern: p.label, count: matches.length });
    }
  });
  if (hits.length === 0) return null;

  return structuredItem({
    type: "action",
    title: "Double ™ found on " + pageName,
    issue: "Detected " + hits.map(function (h) { return h.count + "× " + h.pattern; }).join(", ") + " on the live page. The site renders ™™ instead of a single ™.",
    evidence: { source: pageUrl, snippets: hits.map(function (h) { return h.count + "× " + h.pattern; }) },
    fix: "Search the deploy directory for these patterns and replace each with a single ™.",
    doctrineRef: "CLAUDE.md: framework trademarks (single ™ on MAD™, RVF™, TLE™, RF™, TISCU Triangle™)",
    priority: "medium",
    risk: "low",
    data: { url: pageUrl, hits: hits },
    contract: autoContract({
      prompt:
        "[JNSQ dev agent — fix double trademark]\n\n" +
        "The live page " + pageUrl + " contains double trademark sequences (" +
        hits.map(function (h) { return h.count + "× " + h.pattern; }).join(", ") + ").\n\n" +
        "Tasks:\n" +
        "1. Search the deploy directory (HTML and JS files) for these patterns: ™™, &#8482;&#8482;, ™\\u2122, \\u2122\\u2122, &trade;&trade;.\n" +
        "2. Replace each with a single ™ (or &#8482; if that's the surrounding convention).\n" +
        "3. Do NOT touch text where a single ™ is correct.\n" +
        "4. After edits, list the files changed and the count per file.\n" +
        "5. Do not deploy. Stop after edits so the human can review.\n",
      tags: ["site-fix", "trademark"],
    }),
  });
}

function scanForStaleCopyright(html, pageUrl, pageName, currentYear) {
  // Detect "© 20XX Studio JNSQ" or "&copy; 20XX" where year is older than current
  var rx = /(?:©|&copy;)\s*(\d{4})\s*Studio JNSQ/g;
  var stale = [];
  var m;
  while ((m = rx.exec(html)) !== null) {
    var y = parseInt(m[1], 10);
    if (y < currentYear) stale.push(y);
  }
  if (stale.length === 0) return null;

  return structuredItem({
    type: "action",
    title: "Stale copyright year (" + stale.join(", ") + ") on " + pageName,
    issue: "Found " + stale.length + " copyright reference(s) with year " + stale.join(", ") + ". Should be " + currentYear + ".",
    evidence: { source: pageUrl, count: stale.length, snippets: stale.map(function(y) { return '© ' + y + ' Studio JNSQ'; }) },
    fix: "Update each instance to © " + currentYear + " in the source HTML.",
    priority: "low",
    risk: "low",
    data: { url: pageUrl, staleYears: stale, currentYear: currentYear },
    contract: autoContract({
      prompt:
        "[JNSQ dev agent — refresh copyright year]\n\n" +
        "The live page " + pageUrl + " contains copyright references with year(s) " + stale.join(", ") +
        ". Update them to " + currentYear + ".\n\n" +
        "Tasks:\n" +
        "1. Search the deploy directory for '© ' or '&copy; ' followed by a year before " + currentYear + " adjacent to 'Studio JNSQ'.\n" +
        "2. Update each to " + currentYear + ".\n" +
        "3. Verify no other content changed.\n" +
        "4. Stop after edits, don't deploy.\n",
      tags: ["site-fix", "copyright"],
    }),
  });
}

function scanForBlogDoctrineViolations(html, pageUrl, pageName) {
  // Em dash in body content is a JNSQ doctrine violation.
  // Strip script/style first, then look for em dashes in visible content.
  var stripped = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  var emDashCount = (stripped.match(/—/g) || []).length;
  var entityCount = (stripped.match(/&mdash;/g) || []).length;
  var total = emDashCount + entityCount;
  if (total < 2) return null; // 1 stray dash might be a placeholder; flag only at 2+

  return structuredItem({
    type: "action",
    title: "Em dashes detected in " + pageName + " (" + total + ")",
    issue: "Found " + emDashCount + " literal '—' and " + entityCount + " '&mdash;' in visible body content. Doctrine: never use em dashes. Replace with commas, semicolons, or period breaks.",
    evidence: { source: pageUrl, count: total, snippets: [emDashCount + " literal —, " + entityCount + " &mdash;"] },
    fix: "In the source HTML, replace ' — ' with ', ' and '&mdash;' with ','. Skip em dashes inside <script>, <style>, JSON-LD, or known empty-state placeholders.",
    doctrineRef: "CLAUDE.md: Writing Guidelines — No em dashes",
    priority: "low",
    risk: "low",
    data: { url: pageUrl, literal: emDashCount, entity: entityCount },
    contract: autoContract({
      prompt:
        "[JNSQ dev agent — em dash sweep]\n\n" +
        "The live page " + pageUrl + " contains " + total + " em dashes in visible body content. " +
        "Per JNSQ doctrine (CLAUDE.md): never use em dashes. Replace with commas, semicolons, or period breaks.\n\n" +
        "Tasks:\n" +
        "1. Find the source HTML file that produces " + pageUrl + ".\n" +
        "2. Within that file, replace ' — ' with ', ' and '&mdash;' with ','.\n" +
        "3. Skip any em dashes inside <script>, <style>, JSON-LD, or known placeholder UIs (empty-state '—').\n" +
        "4. Report file path + replacement counts.\n" +
        "5. Do not deploy.\n",
      tags: ["site-fix", "doctrine"],
    }),
  });
}

function scanForCommonAuthorityClaims(html, pageUrl, pageName) {
  // Doctrine check: 'brand architecture' should be 'brand equity architecture' on diagnostic pages
  // (excluding intentional doctrine comparison content).
  if (!/diagnostic/i.test(pageUrl)) return null;
  var withoutEquity = (html.match(/\bbrand architecture\b/gi) || []).length;
  // Subtract contexts where 'brand equity architecture' is the intended phrase
  var withEquity = (html.match(/\bbrand equity architecture\b/gi) || []).length;
  var unequited = withoutEquity - withEquity;
  if (unequited < 1) return null;
  return structuredItem({
    type: "insight",
    title: "Possibly missing 'equity' on " + pageName,
    issue: "Detected " + unequited + " mention(s) of 'brand architecture' without 'equity' prefix. Could be intentional contrast (in the doctrine post) or a doctrine gap.",
    evidence: { source: pageUrl, count: unequited },
    fix: "Open the page and check each instance. If it's casual/generic, prepend 'equity'. If it's defining the term as distinct from brand equity architecture, leave it.",
    doctrineRef: "/journal/branding-vs-brand-equity-vs-brand-architecture",
    priority: "low",
    risk: "low",
    data: { url: pageUrl, count: unequited },
    contract: manualContract("Doctrine wording — needs human judgment"),
  });
}

// ── Core scan logic (reusable by scheduled + manual trigger) ────────────────
async function runDevAgentScan() {
  var today = new Date().toISOString().slice(0, 10);
  var currentYear = new Date().getFullYear();
  var items = [];
  var pagesChecked = 0;
  var endpointsChecked = 0;
  var allHealthy = true;
  var totalResponseTime = 0;

  // 1. Page health checks + content scanning
  var pages = [
    { url: "https://studiojnsq.com", name: "Homepage" },
    { url: "https://studiojnsq.com/journal", name: "Journal" },
    { url: "https://studiojnsq.com/about", name: "About" },
    { url: "https://studiojnsq.com/diagnostic", name: "Diagnostic Selector" },
    { url: "https://studiojnsq.com/diagnostic/MAD", name: "MAD Diagnostic" },
    { url: "https://studiojnsq.com/diagnostic/RVF", name: "RVF Diagnostic" },
    { url: "https://studiojnsq.com/admin", name: "Admin Dashboard" },
  ];

  for (var i = 0; i < pages.length; i++) {
    try {
      var res = await httpGet(pages[i].url);
      pagesChecked++;
      totalResponseTime += res.time;

      if (res.status !== 200) {
        allHealthy = false;
        items.push(structuredItem({
          type: "alert",
          title: pages[i].name + " DOWN (HTTP " + res.status + ")",
          issue: "Page returned non-200. Critical for visitor-facing pages.",
          evidence: { source: pages[i].url, count: "HTTP " + res.status, snippets: ["Response time: " + res.time + "ms"] },
          fix: "Check Netlify deploy logs and recent commits. Likely an infra issue rather than source code.",
          priority: "high",
          risk: "low",
          data: { url: pages[i].url, statusCode: res.status, responseTime: res.time + "ms" },
          contract: manualContract("Page returning non-200 — likely infra, not source code"),
        }));
        continue;
      }

      if (res.time > 3000) {
        items.push(structuredItem({
          type: "action",
          title: pages[i].name + " slow (" + res.time + "ms)",
          issue: "Response time exceeded 3 second target. Slow pages harm SEO and bounce rates.",
          evidence: { source: pages[i].url, count: res.time + "ms", target: "< 3000ms" },
          fix: "Investigate hosting/CDN settings or large assets on this page. Check page weight and image sizes.",
          priority: "medium",
          risk: "low",
          data: { url: pages[i].url, responseTime: res.time + "ms" },
          contract: manualContract("Performance — investigate hosting/CDN or large assets"),
        }));
      }

      // Content integrity on homepage
      if (i === 0) {
        var checks = [
          { pattern: /Studio JNSQ/i, name: "Brand name" },
          { pattern: /Brand Equity Architecture/i, name: "Core positioning" },
          { pattern: /diagnostic/i, name: "Diagnostic references" },
          { pattern: /MAD/i, name: "MAD framework" },
          { pattern: /RVF/i, name: "RVF framework" },
        ];
        var missing = checks.filter(function (ch) { return !ch.pattern.test(res.body); });
        if (missing.length > 0) {
          allHealthy = false;
          items.push(structuredItem({
            type: "alert",
            title: "Homepage missing critical content",
            issue: "Homepage scan failed to find " + missing.length + " required string(s). Content may have been corrupted.",
            evidence: { source: pages[i].url, snippets: missing.map(function (m) { return "Missing: " + m.name; }) },
            fix: "Read index.html. Restore missing anchors using doctrine in CLAUDE.md.",
            doctrineRef: "CLAUDE.md: Doctrine: Brand Equity Architecture",
            priority: "high",
            risk: "low",
            contract: autoContract({
              prompt:
                "[JNSQ dev agent — restore homepage anchors]\n\n" +
                "Homepage scan failed to find these required strings: " +
                missing.map(function (m) { return m.name; }).join(", ") + ".\n\n" +
                "Tasks:\n" +
                "1. Read index.html in the deploy dir.\n" +
                "2. Verify each anchor is present in the visible body (not just in scripts/JSON-LD).\n" +
                "3. If genuinely missing, restore using JNSQ doctrine in CLAUDE.md and the site backup folder.\n" +
                "4. If present but the regex missed (e.g. inside an SVG), report and stop.\n" +
                "5. Stop without deploying.\n",
              tags: ["site-fix", "content-integrity"],
            }),
          }));
        }
      }

      // Run fixable-issue scanners on every page
      var sc;
      sc = scanForDoubleTrademark(res.body, pages[i].url, pages[i].name); if (sc) items.push(sc);
      sc = scanForStaleCopyright(res.body, pages[i].url, pages[i].name, currentYear); if (sc) items.push(sc);
      sc = scanForBlogDoctrineViolations(res.body, pages[i].url, pages[i].name); if (sc) items.push(sc);
      sc = scanForCommonAuthorityClaims(res.body, pages[i].url, pages[i].name); if (sc) items.push(sc);
    } catch (err) {
      allHealthy = false;
      pagesChecked++;
      items.push(structuredItem({
        type: "alert",
        title: pages[i].name + " UNREACHABLE",
        issue: "Could not establish connection to the page. DNS, SSL, or CDN failure.",
        evidence: { source: pages[i].url, snippets: [err.message] },
        fix: "Verify site at studiojnsq.com loads. Check Netlify dashboard for incidents.",
        priority: "high",
        risk: "low",
        data: { url: pages[i].url },
        contract: manualContract("Network error — needs human"),
      }));
    }
  }

  // 2. API endpoint health
  var apis = [
    { path: "/.netlify/functions/agent-hub?action=stats", name: "Agent Hub" },
    { path: "/.netlify/functions/blog-crud?action=list", name: "Blog API" },
    { path: "/.netlify/functions/crm-crud?action=crm-stats", name: "CRM API" },
    { path: "/.netlify/functions/agent-hub?action=watcher-status", name: "Watcher Status" },
  ];

  for (var j = 0; j < apis.length; j++) {
    try {
      var apiRes = await httpGet("https://studiojnsq.com" + apis[j].path);
      endpointsChecked++;
      if (apiRes.status !== 200) {
        allHealthy = false;
        items.push(structuredItem({
          type: "alert",
          title: apis[j].name + " endpoint error (HTTP " + apiRes.status + ")",
          issue: "Internal API returned non-200. Functions that depend on this endpoint will fail.",
          evidence: { source: 'https://studiojnsq.com' + apis[j].path, count: 'HTTP ' + apiRes.status },
          fix: "Check Netlify function logs in dashboard for the failing function.",
          priority: "high",
          risk: "low",
          contract: manualContract("API returning non-200 — check Netlify function logs"),
        }));
      }
    } catch (err) {
      allHealthy = false;
      endpointsChecked++;
      items.push(structuredItem({
        type: "alert",
        title: apis[j].name + " endpoint unreachable",
        issue: "Network error reaching the function endpoint.",
        evidence: { source: 'https://studiojnsq.com' + apis[j].path, snippets: [err.message] },
        fix: "Check Netlify dashboard for outages or function errors.",
        priority: "high",
        risk: "low",
        contract: manualContract("Network error to API"),
      }));
    }
  }

  // 3. SSL check
  try {
    var ssl = await checkSSL("studiojnsq.com");
    if (ssl.daysLeft < 14) {
      allHealthy = false;
      items.push(structuredItem({
        type: "alert",
        title: "SSL certificate expiring in " + ssl.daysLeft + " days",
        issue: "Certificate is within renewal window. Netlify usually auto-renews but should be verified.",
        evidence: { source: "studiojnsq.com SSL", count: ssl.daysLeft + " days remaining", snippets: ["Expires: " + ssl.expiry.slice(0, 10)] },
        fix: "Verify auto-renewal in Netlify dashboard. If stalled, force renewal.",
        priority: "high",
        risk: "low",
        contract: manualContract("SSL renewal — Netlify auto-renews; verify in dashboard if < 14 days"),
      }));
    } else if (ssl.daysLeft < 30) {
      items.push(structuredItem({
        type: "insight",
        title: "SSL certificate expires in " + ssl.daysLeft + " days",
        issue: "Approaching renewal window. Netlify auto-renews around 30 days out.",
        evidence: { source: "studiojnsq.com SSL", snippets: ["Valid until: " + ssl.expiry.slice(0, 10)] },
        fix: "No action needed. Re-check next week if it doesn't auto-renew.",
        priority: "low",
        risk: "low",
        contract: manualContract("Informational"),
      }));
    }
  } catch (e) {
    items.push(structuredItem({
      type: "alert",
      title: "SSL check failed",
      issue: "Could not probe SSL certificate.",
      evidence: { source: "studiojnsq.com:443", snippets: [e.message] },
      fix: "Re-run on next agent tick. If persistent, check Netlify SSL settings.",
      priority: "medium",
      risk: "low",
      contract: manualContract("SSL probe error"),
    }));
  }

  // 4. Watcher health: did the cowork-watcher heartbeat recently?
  try {
    var ws = await httpGet("https://studiojnsq.com/.netlify/functions/agent-hub?action=watcher-status");
    if (ws.status === 200) {
      var wsData = JSON.parse(ws.body);
      if (!wsData.connected && wsData.lastSeen) {
        items.push(structuredItem({
          type: "insight",
          title: "Cowork watcher offline",
          issue: "Last heartbeat was " + wsData.ageSeconds + "s ago. Approved auto-items will not dispatch until the watcher is restarted.",
          evidence: {
            source: 'agent-hub watcher-status',
            snippets: ['Last seen: ' + wsData.lastSeen, 'Host: ' + (wsData.host || 'unknown'), wsData.lastError ? 'Last error: ' + wsData.lastError.message : null].filter(Boolean)
          },
          fix: "On your Mac: cd tools/cowork-watcher && npm start",
          priority: "medium",
          risk: "low",
          contract: manualContract("Restart watcher: cd tools/cowork-watcher && npm start"),
        }));
      } else if (!wsData.connected) {
        items.push(structuredItem({
          type: "insight",
          title: "Cowork watcher never seen",
          issue: "No heartbeat ever recorded. Auto-dispatch is disabled until the watcher runs.",
          evidence: { source: 'agent-hub watcher-status', count: 'never connected' },
          fix: "On your Mac: cd tools/cowork-watcher && cp .env.example .env && npm start",
          priority: "low",
          risk: "low",
          contract: manualContract("Initial watcher setup"),
        }));
      }
    }
  } catch (e) {
    // non-fatal
  }

  var avgTime = pagesChecked > 0 ? Math.round(totalResponseTime / pagesChecked) : 0;
  var fixableCount = items.filter(function (it) { return it.contract && it.contract.kind === "auto"; }).length;
  var manualCount = items.filter(function (it) { return it.contract && it.contract.kind === "manual"; }).length;
  var summary = allHealthy
    ? "All systems operational. " + pagesChecked + " pages, " + endpointsChecked + " APIs checked. Avg response: " + avgTime + "ms. " +
      (fixableCount > 0 ? fixableCount + " auto-fixable issue(s) flagged." : "")
    : items.filter(function (i) { return i.type === "alert"; }).length + " alert(s), " +
      fixableCount + " auto-fixable, " + manualCount + " manual. Avg: " + avgTime + "ms.";

  await httpPost("https://studiojnsq.com/.netlify/functions/agent-hub", {
    action: "submit-brief",
    agent: "dev",
    title: "Daily Dev Brief — " + today,
    summary: summary,
    items: items,
    metrics: {
      pagesChecked: pagesChecked,
      endpointsChecked: endpointsChecked,
      allHealthy: allHealthy,
      avgResponseTime: avgTime + "ms",
      issuesFound: items.length,
      autoFixable: fixableCount,
      manualReview: manualCount,
    },
  });

  return { ok: true, items: items.length, autoFixable: fixableCount, manualReview: manualCount, summary: summary };
}

// Scheduled wrapper
exports.handler = schedule("20 21 * * *", async function (event) {
  try {
    await runDevAgentScan();
  } catch (e) {
    console.error("agent-dev scheduled run failed:", e);
  }
  return { statusCode: 200 };
});

// Exported for manual trigger via agent-trigger.js
exports.runScan = runDevAgentScan;

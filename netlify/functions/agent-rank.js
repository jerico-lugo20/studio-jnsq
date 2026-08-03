// Agent Rank (SEO) — Netlify Scheduled Function
// Runs daily at 5:30 AM UTC+8 (21:30 UTC previous day)
// Audits studiojnsq.com SEO health and submits brief to Agent Hub

var { schedule } = require("@netlify/functions");
var https = require("https");
var helpers = require("./_agent-helpers");
var structuredItem = helpers.structuredItem;
var manualContract = helpers.manualContract;

function httpGet(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, { headers: { 'User-Agent': 'StudioJNSQ-RankAgent/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data, headers: res.headers }); });
    }).on('error', reject);
  });
}

function httpPost(url, payload) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(payload);
    var parsed = new URL(url);
    var options = { hostname: parsed.hostname, path: parsed.pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function checkMeta(html, pageUrl) {
  var issues = [];
  pageUrl = pageUrl || '';

  // Title
  var titleMatch = html.match(/<title>(.*?)<\/title>/i);
  if (!titleMatch || !titleMatch[1]) {
    issues.push(structuredItem({
      type: 'alert',
      title: 'Missing page title',
      issue: 'The page has no <title> tag. Search engines won\'t know what to display.',
      evidence: { source: pageUrl, count: '0 <title> tags' },
      fix: 'Add a <title> in <head> with the target keyword. ~50-60 chars including the brand suffix.',
      priority: 'high', risk: 'low'
    }));
  } else if (titleMatch[1].length > 60) {
    issues.push(structuredItem({
      type: 'insight',
      title: 'Title tag over 60 chars',
      issue: 'Google typically truncates titles at ~60 chars. Yours is ' + titleMatch[1].length + '.',
      evidence: { source: pageUrl, count: titleMatch[1].length + ' chars', target: '≤ 60', snippets: ['"' + titleMatch[1] + '"'] },
      fix: 'Tighten to ≤ 60 chars. Lead with the keyword, drop redundant words.',
      priority: 'low', risk: 'low'
    }));
  }

  // Meta description
  var descMatch = html.match(/<meta\s+name=["']description["']\s+content=["'](.*?)["']/i);
  if (!descMatch) {
    issues.push(structuredItem({
      type: 'alert',
      title: 'Missing meta description',
      issue: 'No meta description tag found. This hurts CTR from search results because Google generates one from random page text.',
      evidence: { source: pageUrl, count: '0 meta description tags' },
      fix: 'Add <meta name="description" content="..."> with a 140-160 char pitch that includes the target keyword.',
      priority: 'high', risk: 'low'
    }));
  } else if (descMatch[1].length > 160) {
    issues.push(structuredItem({
      type: 'insight',
      title: 'Meta description over 160 chars',
      issue: 'Description will be truncated in SERP. Yours is ' + descMatch[1].length + ' chars.',
      evidence: { source: pageUrl, count: descMatch[1].length + ' chars', target: '≤ 160', snippets: ['"' + descMatch[1] + '"'] },
      fix: 'Tighten to ≤ 160. Lead with the keyword.',
      priority: 'low', risk: 'low'
    }));
  }

  // OG tags
  if (!html.match(/og:title/i)) {
    issues.push(structuredItem({
      type: 'action',
      title: 'Missing Open Graph title',
      issue: 'Without og:title, social link previews fall back to the page <title>, which may not be optimized for sharing.',
      evidence: { source: pageUrl, count: '0 og:title tags' },
      fix: 'Add <meta property="og:title" content="..."> in <head>.',
      priority: 'medium', risk: 'low'
    }));
  }
  if (!html.match(/og:description/i)) {
    issues.push(structuredItem({
      type: 'action',
      title: 'Missing Open Graph description',
      issue: 'Social link previews will use the meta description as fallback. Better to have an og: variant tuned for sharing.',
      evidence: { source: pageUrl, count: '0 og:description tags' },
      fix: 'Add <meta property="og:description" content="..."> in <head>.',
      priority: 'medium', risk: 'low'
    }));
  }

  // Schema
  if (!html.match(/application\/ld\+json/i)) {
    issues.push(structuredItem({
      type: 'action',
      title: 'No structured data (JSON-LD)',
      issue: 'No schema.org markup found. JSON-LD enables rich results in search.',
      evidence: { source: pageUrl, count: '0 ld+json blocks' },
      fix: 'Add JSON-LD blocks for the appropriate schema type (WebPage, Article, FAQPage, Quiz, etc.) for this page.',
      priority: 'medium', risk: 'low'
    }));
  }

  // Brand equity architecture keyword
  var beaCount = (html.match(/brand equity architecture/gi) || []).length;
  if (beaCount === 0) {
    issues.push(structuredItem({
      type: 'action',
      title: 'No "brand equity architecture" keyword on page',
      issue: 'The target search term doesn\'t appear at all on this page. This blocks ranking for the doctrine\'s anchor phrase.',
      evidence: { source: pageUrl, count: 0, target: '≥ 1 mention' },
      fix: 'Surface the phrase naturally in the headline, subhead, or body copy.',
      doctrineRef: '/journal/branding-vs-brand-equity-vs-brand-architecture',
      priority: 'high', risk: 'low'
    }));
  }

  // TM symbols
  var madNoTm = (html.match(/\bMAD\b(?!™)/g) || []).length;
  var rvfNoTm = (html.match(/\bRVF\b(?!™)/g) || []).length;
  if (madNoTm > 2) {
    issues.push(structuredItem({
      type: 'action',
      title: 'MAD missing ™ symbol (' + madNoTm + ' instances)',
      issue: madNoTm + ' bare references to "MAD" without the ™ symbol. Doctrine: framework names always carry ™.',
      evidence: { source: pageUrl, count: madNoTm },
      fix: 'Replace bare MAD with MAD™ (or &#8482;). Skip occurrences inside attribute values where ™ doesn\'t belong.',
      doctrineRef: 'CLAUDE.md: Writing Guidelines — Trademark symbols on frameworks',
      priority: 'medium', risk: 'low'
    }));
  }
  if (rvfNoTm > 2) {
    issues.push(structuredItem({
      type: 'action',
      title: 'RVF missing ™ symbol (' + rvfNoTm + ' instances)',
      issue: rvfNoTm + ' bare references to "RVF" without the ™ symbol.',
      evidence: { source: pageUrl, count: rvfNoTm },
      fix: 'Replace bare RVF with RVF™ (or &#8482;).',
      doctrineRef: 'CLAUDE.md: Writing Guidelines — Trademark symbols on frameworks',
      priority: 'medium', risk: 'low'
    }));
  }

  // Images without alt
  var imgs = html.match(/<img[^>]*>/gi) || [];
  var noAlt = imgs.filter(function(img) { return !img.match(/alt=["'][^"']+["']/i); });
  if (noAlt.length > 0) {
    issues.push(structuredItem({
      type: 'action',
      title: noAlt.length + ' images missing alt text',
      issue: 'Images without alt text hurt accessibility and SEO. Screen readers + search crawlers can\'t describe them.',
      evidence: {
        source: pageUrl,
        count: noAlt.length,
        snippets: noAlt.slice(0, 3).map(function(img) {
          var src = img.match(/src=["']([^"']+)["']/);
          return 'img src="' + (src ? src[1].slice(0, 80) : '?') + '"';
        })
      },
      fix: 'Add descriptive alt="..." to each image. For decorative images, use alt="".',
      priority: 'medium', risk: 'low'
    }));
  }

  return issues;
}

async function runRankScan() {
  var today = new Date().toISOString().slice(0, 10);
  var items = [];
  var pagesChecked = 0;
  var totalIssues = 0;

  var pages = [
    { url: 'https://studiojnsq.com', name: 'Homepage' },
    { url: 'https://studiojnsq.com/journal', name: 'Blog' },
    { url: 'https://studiojnsq.com/diagnostic', name: 'Diagnostic Selector' }
  ];

  for (var i = 0; i < pages.length; i++) {
    try {
      var result = await httpGet(pages[i].url);
      pagesChecked++;

      if (result.status !== 200) {
        items.push(structuredItem({
          type: 'alert',
          title: pages[i].name + ' returned HTTP ' + result.status,
          issue: 'Page is not returning 200. Search crawlers will drop it from the index if persistent.',
          evidence: { source: pages[i].url, count: 'HTTP ' + result.status },
          fix: 'Check Netlify deploy + recent commits. If page builds locally, redeploy.',
          priority: 'high', risk: 'low',
          data: { url: pages[i].url, status: result.status },
          contract: manualContract('HTTP error — likely infra')
        }));
        totalIssues++;
        continue;
      }

      var pageIssues = checkMeta(result.body, pages[i].url);
      pageIssues.forEach(function(issue) {
        issue.title = pages[i].name + ': ' + issue.title;
        issue.data = Object.assign({}, issue.data || {}, { url: pages[i].url });
        items.push(issue);
        totalIssues++;
      });
    } catch (err) {
      items.push(structuredItem({
        type: 'alert',
        title: pages[i].name + ' unreachable',
        issue: 'Network error fetching the page.',
        evidence: { source: pages[i].url, snippets: [err.message] },
        fix: 'Verify site uptime. Check Netlify dashboard for incidents.',
        priority: 'high', risk: 'low',
        data: { url: pages[i].url },
        contract: manualContract('Network error')
      }));
      totalIssues++;
    }
  }

  // Check robots.txt
  try {
    var robots = await httpGet('https://studiojnsq.com/robots.txt');
    pagesChecked++;
    if (robots.status !== 200) {
      items.push(structuredItem({
        type: 'action',
        title: 'robots.txt missing or error',
        issue: 'robots.txt returned ' + robots.status + '. Crawlers fall back to default behavior; you lose control over crawl directives.',
        evidence: { source: 'https://studiojnsq.com/robots.txt', count: 'HTTP ' + robots.status },
        fix: 'Create /robots.txt with Allow + Sitemap directive for studiojnsq.com/sitemap.xml.',
        priority: 'medium', risk: 'low'
      }));
      totalIssues++;
    }
  } catch (e) {}

  // Check sitemap
  try {
    var sitemap = await httpGet('https://studiojnsq.com/sitemap.xml');
    pagesChecked++;
    if (sitemap.status !== 200) {
      items.push(structuredItem({
        type: 'action',
        title: 'sitemap.xml missing',
        issue: 'No sitemap found. Crawl coverage relies on internal links only, which is slower for new content.',
        evidence: { source: 'https://studiojnsq.com/sitemap.xml', count: 'HTTP ' + sitemap.status },
        fix: 'Generate a sitemap.xml listing all canonical URLs with lastmod dates. Reference it from robots.txt.',
        priority: 'medium', risk: 'low'
      }));
      totalIssues++;
    }
  } catch (e) {}

  // Build summary
  var criticalCount = items.filter(function(i) { return i.priority === 'high'; }).length;
  var summary = pagesChecked + ' pages checked. ' + totalIssues + ' issues found' + (criticalCount > 0 ? ' (' + criticalCount + ' critical)' : '') + '.';
  if (totalIssues === 0) summary = pagesChecked + ' pages checked. All clear. No issues found.';

  // Submit brief
  await httpPost('https://studiojnsq.com/.netlify/functions/agent-hub', {
    action: 'submit-brief',
    agent: 'rank',
    title: 'Daily SEO Brief — ' + today,
    summary: summary,
    items: items,
    metrics: { pagesChecked: pagesChecked, issuesFound: totalIssues, criticalIssues: criticalCount }
  });

  return { ok: true, items: items.length, summary: summary, pagesChecked: pagesChecked, issuesFound: totalIssues };
}

exports.handler = schedule("30 21 * * *", async function(event) {
  try { await runRankScan(); } catch (e) { console.error('agent-rank scheduled run failed:', e); }
  return { statusCode: 200 };
});

exports.runScan = runRankScan;

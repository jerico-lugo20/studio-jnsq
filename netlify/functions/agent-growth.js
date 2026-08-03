// Agent Growth (Marketing) — Netlify Scheduled Function
// Runs daily at 5:45 AM UTC+8 (21:45 UTC previous day)
// Analyzes content performance, copy quality, blog cadence, and submits brief

var { schedule } = require("@netlify/functions");
var https = require("https");

function httpGet(url) {
  return new Promise(function(resolve, reject) {
    https.get(url, { headers: { 'User-Agent': 'StudioJNSQ-GrowthAgent/1.0' } }, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { resolve({ status: res.statusCode, body: data }); });
    }).on('error', reject);
  });
}

function httpPost(url, payload) {
  return new Promise(function(resolve, reject) {
    var body = JSON.stringify(payload);
    var parsed = new URL(url);
    var options = { hostname: parsed.hostname, path: parsed.pathname + (parsed.search || ''), method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
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

function internalGet(path) {
  return new Promise(function(resolve, reject) {
    https.get('https://studiojnsq.com' + path, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

// Shared helpers (structuredItem, evidenceFromRegex, contracts)
var helpers = require('./_agent-helpers');
var structuredItem = helpers.structuredItem;
var evidenceFromRegex = helpers.evidenceFromRegex;

async function runGrowthScan() {
  var today = new Date().toISOString().slice(0, 10);
  var items = [];

  // 1. Blog cadence check
  try {
    var blogData = await internalGet('/.netlify/functions/blog-crud?action=list&status=published');
    var posts = (blogData.posts || []).sort(function(a, b) { return new Date(b.publishDate) - new Date(a.publishDate); });
    var totalPosts = posts.length;

    // Check latest post date
    if (posts.length > 0) {
      var latestDate = new Date(posts[0].publishDate);
      var daysSinceLatest = Math.floor((Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceLatest > 3) {
        items.push(structuredItem({
          type: 'action',
          title: 'Blog overdue: ' + daysSinceLatest + ' days since last post',
          issue: 'Publishing cadence target is 3 days. Last post was "' + posts[0].title + '" published ' + daysSinceLatest + ' days ago. Search momentum and feed freshness fade fast on a quiet blog.',
          evidence: {
            source: '/journal/' + posts[0].slug,
            count: daysSinceLatest + ' days idle',
            target: '< 3 days between posts'
          },
          fix: 'Publish the next article. The Editorial Pipeline section below should already have the next slot queued, or pull from the doctrine bank.',
          doctrineRef: 'Cadence: ship every 3 days',
          priority: 'high',
          risk: 'high',
          data: { daysSince: daysSinceLatest, lastPost: posts[0].slug }
        }));
      } else {
        items.push(structuredItem({
          type: 'insight',
          title: 'Blog cadence on track (' + daysSinceLatest + ' days since last post)',
          issue: 'Cadence is healthy. Most recent post: "' + posts[0].title + '".',
          evidence: { source: '/journal/' + posts[0].slug, count: daysSinceLatest + ' days since last' },
          fix: 'Keep momentum. Next slot from Editorial Pipeline should still ship within 3 days.',
          priority: 'low',
          risk: 'low'
        }));
      }
    }

    // Check for missing hero images
    var missingImages = posts.filter(function(p) { return !p.heroImage; });
    if (missingImages.length > 0) {
      items.push(structuredItem({
        type: 'action',
        title: missingImages.length + ' blog posts missing hero images',
        issue: 'Hero images carry the BIP visual signature and improve social/SEO presentation. ' + missingImages.length + ' published post(s) currently render without one.',
        evidence: {
          source: '/journal (published posts)',
          count: missingImages.length,
          snippets: missingImages.slice(0, 5).map(function(p) { return '/journal/' + p.slug + ' — "' + (p.title || '').slice(0, 60) + '"'; })
        },
        fix: 'Create or assign a hero image per post. Use BIP highlight bg #fefbef for consistency. Update each post via blog-crud.',
        priority: 'medium',
        risk: 'low'
      }));
    }
  } catch (e) {
    items.push({ type: 'alert', title: 'Could not fetch blog data', description: e.message, priority: 'high', risk: 'low' });
  }

  // 2. Editorial pipeline check — suggest next blog posts
  var editorialIdeas = 0;
  try {
    var editorialData = await internalGet('/.netlify/functions/crm-crud?action=list-editorial');
    var editItems = editorialData.items || [];
    var ideaItems = editItems.filter(function(e) { return e.status === 'Idea'; });
    var draftItems = editItems.filter(function(e) { return e.status === 'Draft'; });
    editorialIdeas = ideaItems.length;

    // Get published blog slugs to avoid duplicates
    var publishedSlugs = posts.map(function(p) { return (p.title || '').toLowerCase(); });

    // Recommend next blog post from editorial pipeline
    var blogIdeas = ideaItems.filter(function(e) { return e.type === 'Blog' || e.type === 'Editorial'; });
    if (blogIdeas.length > 0) {
      var nextBlog = blogIdeas[0];
      // Check it hasn't already been published
      var alreadyPublished = publishedSlugs.some(function(s) { return nextBlog.topic.toLowerCase().indexOf(s) !== -1 || s.indexOf(nextBlog.topic.toLowerCase().slice(0, 20)) !== -1; });
      if (!alreadyPublished) {
        items.push(structuredItem({
          type: 'action',
          title: 'Next blog post: "' + nextBlog.topic + '"',
          issue: 'Top of the Editorial Pipeline queue, ready to ship. Notes: ' + (nextBlog.notes || 'None') + '.',
          evidence: {
            source: 'Editorial Pipeline (' + nextBlog.source + ')',
            snippets: ['Priority: ' + nextBlog.priority + '  •  Type: ' + nextBlog.type]
          },
          fix: 'Draft the article in BIP voice. Title pattern: hook first, no preamble. 3-4 screenshot lines. Sign off "— Jec".',
          doctrineRef: 'CLAUDE.md: BIP Pattern Reference',
          priority: 'high',
          risk: 'high',
          data: { editorialTopic: nextBlog.topic, editorialType: nextBlog.type, editorialNotes: nextBlog.notes }
        }));
      }
    }

    // If pipeline is thin, suggest new ideas
    if (ideaItems.length < 3) {
      items.push(structuredItem({
        type: 'action',
        title: 'Editorial pipeline running low (' + ideaItems.length + ' ideas remaining)',
        issue: 'Pipeline holds only ' + ideaItems.length + ' active idea(s). With a 3-day cadence, that\'s less than ' + (ideaItems.length * 3) + ' days of runway.',
        evidence: { source: 'Editorial Pipeline', count: ideaItems.length, target: '≥ 6 ideas' },
        fix: 'Add ideas around: brand equity trends, framework deep-dives (MAD™ facets / RVF™ equations), industry-specific brand equity analysis, founder brand-building case studies. Each tagged Blog or Editorial.',
        priority: 'medium',
        risk: 'low'
      }));
    }

    // Report draft status
    if (draftItems.length > 0) {
      items.push(structuredItem({
        type: 'insight',
        title: draftItems.length + ' article(s) in draft status',
        issue: 'Drafts in flight that haven\'t shipped yet.',
        evidence: {
          source: 'Editorial Pipeline (status=Draft)',
          snippets: draftItems.map(function(d) { return '"' + d.topic + '" (' + (d.priority || 'no priority') + ')'; })
        },
        fix: 'Review each draft. Publish when polished or move back to Idea status to free up the slot.',
        priority: 'low',
        risk: 'low'
      }));
    }

    // Suggest LinkedIn content from editorial pipeline
    var linkedinIdeas = ideaItems.filter(function(e) { return e.type === 'LinkedIn'; });
    if (linkedinIdeas.length > 0) {
      items.push(structuredItem({
        type: 'action',
        title: 'LinkedIn post ready: "' + linkedinIdeas[0].topic + '"',
        issue: 'Top LinkedIn idea queued for the JCL personal account. Notes: ' + (linkedinIdeas[0].notes || 'None') + '.',
        evidence: {
          source: 'Editorial Pipeline (type=LinkedIn)',
          snippets: ['Topic: ' + linkedinIdeas[0].topic, 'Source: ' + (linkedinIdeas[0].source || 'unknown')]
        },
        fix: 'Draft using JCL voice. HOOK first. No em dashes. Vary line length. HumEx posts allowed for JCL.',
        doctrineRef: 'CLAUDE.md: Caption Writing Rule (Critical) — ALWAYS HOOK. NEVER CONTEXTUALIZE.',
        priority: 'medium',
        risk: 'high',
        data: { editorialTopic: linkedinIdeas[0].topic, editorialType: 'LinkedIn' }
      }));
    }
  } catch (e) {
    items.push({ type: 'insight', title: 'Editorial pipeline not accessible', description: 'Could not read editorial pipeline: ' + e.message, priority: 'low', risk: 'low' });
  }

  // 3. Website copy audit (homepage only — blog posts checked elsewhere)
  // Doctrine reminder for verifier: the dedicated post `/journal/branding-vs-brand-equity-vs-brand-architecture`
  // is the ONE place where the phrase 'brand architecture' appears intentionally as a comparison term.
  // We're scanning the homepage here, so that post is not in scope. If the regex shifts to scan
  // blog posts, add an exclusion list keyed on slug.
  try {
    var homepage = await httpGet('https://studiojnsq.com');
    if (homepage.status === 200) {
      var html = homepage.body;
      var hasBrandEquityArch = (html.match(/brand equity architecture/gi) || []).length;
      // Exclude both 'brand equity architecture' (subtract) AND 'brand architecture firm'
      var brandArchRegex = /(?<!equity )brand architecture(?! firm)/gi;
      var hasBrandArch = (html.match(brandArchRegex) || []).length;

      if (hasBrandEquityArch < 3) {
        items.push(structuredItem({
          type: 'action',
          title: 'Homepage thin on "brand equity architecture" anchor (' + hasBrandEquityArch + ' / target 3+)',
          issue: 'The homepage uses the exact phrase "brand equity architecture" only ' + hasBrandEquityArch + ' time(s). To own the search term we want 3-5 prominent uses across the page.',
          evidence: {
            source: 'https://studiojnsq.com',
            count: hasBrandEquityArch,
            target: '3 to 5',
            snippets: evidenceFromRegex(html, /brand equity architecture/gi, 70, 3),
          },
          fix: 'Surface the phrase 2-3 more times in headline, hero subhead, or section eyebrows. Avoid keyword stuffing; integrate it where the doctrine is actually being explained.',
          doctrineRef: '/journal/branding-vs-brand-equity-vs-brand-architecture',
          priority: 'high',
          risk: 'high',
          description: 'Only ' + hasBrandEquityArch + ' instance(s) of "brand equity architecture" on the homepage. Target is 3-5 for search term ownership.'
        }));
      }
      if (hasBrandArch > 0) {
        items.push(structuredItem({
          type: 'action',
          title: '"brand architecture" appears ' + hasBrandArch + 'x without "equity" prefix on homepage',
          issue: 'Detected ' + hasBrandArch + ' instance(s) of the phrase "brand architecture" on the homepage where the doctrine reads "brand equity architecture." If these are intentional contrasts (defining the term), they should live in the doctrine post; if generic, prepend "equity".',
          evidence: {
            source: 'https://studiojnsq.com',
            count: hasBrandArch,
            snippets: evidenceFromRegex(html, brandArchRegex, 90, 5),
            excluded: ['"brand architecture firm" (kept)', '"brand equity architecture" (already correct)']
          },
          fix: 'For each snippet, decide: (a) is this defining the term as distinct from brand equity architecture? Move/keep in the doctrine post and the homepage references it. (b) is this casual / generic? Prepend "equity" so it reads "brand equity architecture".',
          doctrineRef: 'CLAUDE.md → Doctrine: Brand Equity Architecture',
          priority: 'medium',
          risk: 'low',
          description: 'Per doctrine, the homepage should always use "brand equity architecture" (the ONE exception is the comparison post at /journal/branding-vs-brand-equity-vs-brand-architecture which is intentional and out of scope here).'
        }));
      }
    }
  } catch (e) {}

  // 4. Lead pipeline check
  try {
    var crmStats = await internalGet('/.netlify/functions/crm-crud?action=crm-stats');
    var byStage = crmStats.byStage || {};
    var byMarket = crmStats.byMarket || {};
    var stageBreak = Object.keys(byStage).map(function(s) { return s + ': ' + byStage[s]; }).join(', ');
    var marketBreak = Object.keys(byMarket).map(function(m) { return m + ': ' + byMarket[m]; }).join(', ');
    items.push(structuredItem({
      type: 'insight',
      title: 'Pipeline status: ' + (crmStats.total || 0) + ' total contacts',
      issue: 'Snapshot of where contacts sit across stages and markets.',
      evidence: {
        source: 'CRM stats',
        count: crmStats.total || 0,
        snippets: [
          'By stage: ' + (stageBreak || '(none)'),
          'By market: ' + (marketBreak || '(none)')
        ]
      },
      fix: 'No action needed if numbers look healthy. If a stage is empty for >7 days or one market dominates, surface that to the Pipeline agent.',
      priority: 'low',
      risk: 'low'
    }));
  } catch (e) {}

  // 5. Diagnostic funnel check
  var funnelPages = ['/diagnostic', '/diagnostic/MAD', '/diagnostic/RVF'];
  var funnelOk = 0;
  for (var fi = 0; fi < funnelPages.length; fi++) {
    try {
      var fRes = await httpGet('https://studiojnsq.com' + funnelPages[fi]);
      if (fRes.status === 200) funnelOk++;
      else items.push(structuredItem({
        type: 'alert',
        title: 'Diagnostic page error: ' + funnelPages[fi],
        issue: 'The page returned HTTP ' + fRes.status + '. The diagnostic funnel is the conversion path; any non-200 here is critical.',
        evidence: { source: 'https://studiojnsq.com' + funnelPages[fi], count: 'HTTP ' + fRes.status },
        fix: 'Check Netlify deploy logs and recent commits. If the page builds locally, redeploy. Escalate to Dev agent if persistent.',
        priority: 'high',
        risk: 'low'
      }));
    } catch (e) {
      items.push(structuredItem({
        type: 'alert',
        title: 'Diagnostic page unreachable: ' + funnelPages[fi],
        issue: 'Network error reaching the diagnostic funnel. Could be DNS, CDN, or SSL.',
        evidence: { source: 'https://studiojnsq.com' + funnelPages[fi], snippets: [e.message] },
        fix: 'Verify the site is up at studiojnsq.com. Check Netlify dashboard for incidents.',
        priority: 'high',
        risk: 'low'
      }));
    }
  }

  var summary = (totalPosts || 0) + ' blog posts. ' + editorialIdeas + ' editorial ideas queued. Funnel: ' + funnelOk + '/3 pages healthy. ' + items.filter(function(i) { return i.type === 'action'; }).length + ' actions recommended.';

  await httpPost('https://studiojnsq.com/.netlify/functions/agent-hub', {
    action: 'submit-brief',
    agent: 'growth',
    title: 'Daily Growth Brief — ' + today,
    summary: summary,
    items: items,
    metrics: { blogPosts: totalPosts || 0, funnelHealth: funnelOk + '/3', actionsRecommended: items.filter(function(i) { return i.type === 'action'; }).length }
  });

  return { ok: true, items: items.length, summary: summary, blogPosts: totalPosts || 0, funnelHealth: funnelOk + '/3' };
}

exports.handler = schedule("45 21 * * *", async function(event) {
  try { await runGrowthScan(); } catch (e) { console.error('agent-growth scheduled run failed:', e); }
  return { statusCode: 200 };
});

exports.runScan = runGrowthScan;

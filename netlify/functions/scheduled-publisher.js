// Studio JNSQ Scheduled Publisher
// Runs on a Netlify cron. Every 30 min it scans the blog store for posts with
// status = "scheduled" whose scheduled UK drop time has arrived, and flips
// them to status = "published".
//
// Drop time is 08:00 UK time on the post's publishDate (respects DST).

const { getStore } = require("@netlify/blobs");

// Return current UK-time components using Intl (handles GMT/BST automatically)
function nowInUK() {
  var fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  });
  var parts = fmt.formatToParts(new Date());
  var out = { year: '', month: '', day: '', hour: '', minute: '' };
  parts.forEach(function (p) {
    if (p.type === 'year') out.year = p.value;
    else if (p.type === 'month') out.month = p.value;
    else if (p.type === 'day') out.day = p.value;
    else if (p.type === 'hour') out.hour = p.value;
    else if (p.type === 'minute') out.minute = p.value;
  });
  return out;
}

// Compare "YYYY-MM-DD" + hour==8 in UK to current UK time.
// Returns true when the post's scheduled UK drop has arrived.
function shouldPublish(publishDateIso, ukNow) {
  if (!publishDateIso) return false;
  // publishDate stored as ISO string; take the calendar date portion
  var datePart = String(publishDateIso).slice(0, 10);
  var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!m) return false;
  var targetY = m[1], targetMo = m[2], targetD = m[3];
  var targetHour = 8; // 08:00 UK

  // Compare year, month, day, hour lexicographically via a joined string
  var target = targetY + targetMo + targetD + String(targetHour).padStart(2, '0');
  var now = ukNow.year + ukNow.month + ukNow.day + ukNow.hour;
  return now >= target;
}

exports.handler = async function (event) {
  var store = getStore({ name: 'blog-posts', siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
  var ukNow = nowInUK();
  console.log('scheduled-publisher tick — UK now:', ukNow);

  var idx;
  try { idx = (await store.get('_index', { type: 'json' })) || []; }
  catch (e) { console.error('index load failed:', e); return { statusCode: 500 }; }

  var scheduled = idx.filter(function (p) { return p.status === 'scheduled'; });
  console.log('scheduled candidates:', scheduled.length);

  var published = [];
  var skipped = [];
  var errors = [];

  for (var i = 0; i < scheduled.length; i++) {
    var summary = scheduled[i];
    if (!shouldPublish(summary.publishDate, ukNow)) {
      skipped.push(summary.slug);
      continue;
    }
    try {
      var post = await store.get(summary.slug, { type: 'json' });
      if (!post) { errors.push(summary.slug + ' (missing full post)'); continue; }
      post.status = 'published';
      post.updatedAt = new Date().toISOString();
      // Record the actual publish moment (server clock) — informational
      post.publishedAt = post.publishedAt || new Date().toISOString();
      await store.setJSON(summary.slug, post);
      published.push(summary.slug);
    } catch (e) {
      errors.push(summary.slug + ': ' + (e && e.message));
    }
  }

  // Update the summary index to reflect new statuses
  if (published.length) {
    try {
      var freshIdx = (await store.get('_index', { type: 'json' })) || [];
      published.forEach(function (slug) {
        var row = freshIdx.find(function (r) { return r.slug === slug; });
        if (row) row.status = 'published';
      });
      await store.setJSON('_index', freshIdx);
    } catch (e) {
      errors.push('index update: ' + e.message);
    }
  }

  var summary = {
    ukTime: ukNow.year + '-' + ukNow.month + '-' + ukNow.day + ' ' + ukNow.hour + ':' + ukNow.minute,
    scanned: scheduled.length,
    published: published,
    skipped: skipped.length,
    errors: errors
  };
  console.log('scheduled-publisher summary:', JSON.stringify(summary));
  return { statusCode: 200, body: JSON.stringify(summary) };
};

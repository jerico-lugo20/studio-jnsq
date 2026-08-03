// Server-rendered Journal index.
// Serves blog.html with the published post cards ALREADY present in the HTML,
// so search engines and AI crawlers (which don't run JS, and whose JS rendering
// is blocked from /.netlify/* by robots.txt) see real links to every article.
// The client-side app then re-hydrates the same grid for search/filter/show-more.
// On ANY error this falls back to serving blog.html unchanged — it can never
// make the page worse than it was before this function existed.

const { getStore } = require("@netlify/blobs");
const fs = require("fs");
const path = require("path");

// Pinned guides always appear first (canonical July 2026 slugs)
const PINNED = [
  "what-is-the-market-authority-diamond-for-brand-equity",
  "what-is-the-resource-value-formula-for-brand-equity",
  "where-do-mad-and-rvf-meet-for-brand-equity-architecture"
];

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function convertGoogleDriveUrl(url) {
  if (!url) return "";
  var m = String(url).match(/\/d\/([a-zA-Z0-9-_]+)\//);
  if (m && m[1]) return "https://drive.google.com/uc?export=view&id=" + m[1];
  return url;
}

function cardHtml(post) {
  var imageUrl = post.heroImage ? convertGoogleDriveUrl(post.heroImage) : "";
  var dateStr = "";
  try {
    dateStr = new Date(post.publishDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch (e) {}
  var tagsHtml = (post.tags || []).map(function (tag) {
    return '<span class="tag">' + escapeHtml(tag) + "</span>";
  }).join("");
  var isPinned = PINNED.indexOf(post.slug) !== -1;
  var pinIcon = isPinned ? '<svg style="position:absolute;top:12px;right:12px;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.15));" width="22" height="22" viewBox="0 0 24 24" fill="#FDD500" stroke="#394550" stroke-width="1.5"><path d="M12 2C12 2 8 6 8 10c0 1.5.5 2.8 1.3 3.7L7 16h4v6h2v-6h4l-2.3-2.3C15.5 12.8 16 11.5 16 10c0-4-4-8-4-8z"/></svg>' : "";
  var cardUrl = "/journal/" + encodeURIComponent(post.slug);
  return '<a href="' + cardUrl + '" class="blog-card lift" style="position:relative;' + (isPinned ? "border:1px solid var(--yellow);" : "") + '">' +
    (imageUrl
      ? '<img src="' + imageUrl + '" alt="' + escapeHtml(post.title) + '" class="blog-card-image" loading="lazy">'
      : '<div class="blog-card-image" style="background-color: var(--dark);"></div>') +
    pinIcon +
    '<div class="blog-card-content">' +
      '<h2 class="blog-card-title">' + escapeHtml(post.title) + "</h2>" +
      '<p class="blog-card-excerpt">' + escapeHtml(post.excerpt || String(post.body || "").substring(0, 150)) + "</p>" +
      '<div class="blog-card-meta">' +
        (post.author ? "<span>" + escapeHtml(post.author) + "</span>" : "") +
        "<span>" + dateStr + "</span>" +
      "</div>" +
      (tagsHtml ? '<div class="blog-card-tags">' + tagsHtml + "</div>" : "") +
    "</div>" +
  "</a>";
}

function loadTemplate() {
  // included_files places blog.html relative to the function bundle root.
  var candidates = [
    path.resolve(__dirname, "../../blog.html"),
    path.resolve(__dirname, "blog.html"),
    path.resolve(process.cwd(), "blog.html")
  ];
  for (var i = 0; i < candidates.length; i++) {
    try {
      if (fs.existsSync(candidates[i])) return fs.readFileSync(candidates[i], "utf8");
    } catch (e) {}
  }
  return null;
}

exports.handler = async function (event, context) {
  var template = loadTemplate();
  // Only allow the CDN to cache a rendered page when it actually contains posts.
  // A degraded render (empty Blobs read or an error) must NOT be cached, or a
  // transient Blobs hiccup would freeze an empty journal at the edge for minutes.
  var cachedHeaders = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=60, s-maxage=300"
  };
  var noStoreHeaders = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, max-age=0, must-revalidate"
  };
  if (!template) {
    // Should never happen; send the visitor to the static file as last resort.
    return { statusCode: 302, headers: { Location: "/blog.html", "Cache-Control": "no-store" } };
  }
  try {
    var store = getStore({ name: "blog-posts", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
    var index = (await store.get("_index", { type: "json" })) || [];
    var published = index.filter(function (p) { return p.status === "published"; });

    published.sort(function (a, b) {
      var aPin = PINNED.indexOf(a.slug);
      var bPin = PINNED.indexOf(b.slug);
      if (aPin !== -1 && bPin !== -1) return aPin - bPin;
      if (aPin !== -1) return -1;
      if (bPin !== -1) return 1;
      return new Date(b.publishDate) - new Date(a.publishDate);
    });

    if (published.length) {
      var cards = published.map(cardHtml).join("\n");
      // Inject into the empty grid; client JS re-renders the same markup after load.
      template = template.replace(
        '<div id="blogGrid" class="blog-grid">\n                    <!-- Blog cards will be inserted here -->\n                </div>',
        '<div id="blogGrid" class="blog-grid" data-ssr="1">' + cards + "</div>"
      );
      // Robustness: if exact whitespace above ever changes, fall back to a regex pass.
      if (template.indexOf('data-ssr="1"') === -1) {
        template = template.replace(
          /<div id="blogGrid" class="blog-grid">[\s\S]*?<\/div>/,
          '<div id="blogGrid" class="blog-grid" data-ssr="1">' + cards + "</div>"
        );
      }
      // Posts injected: safe to let the CDN cache this good render.
      return { statusCode: 200, headers: cachedHeaders, body: template };
    }
    // No published posts came back (empty or degraded Blobs read): serve the
    // page but forbid caching so the next request re-reads Blobs immediately.
    return { statusCode: 200, headers: noStoreHeaders, body: template };
  } catch (err) {
    console.error("render-journal-index error:", err && err.message);
    // Fallback: serve the untouched template, uncached, so a transient failure
    // cannot get frozen at the CDN edge.
    return { statusCode: 200, headers: noStoreHeaders, body: template };
  }
};

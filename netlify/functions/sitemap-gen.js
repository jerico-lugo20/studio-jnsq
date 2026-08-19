// Auto-generate sitemap.xml from published blog posts
// Called by build or on-demand to keep sitemap fresh

const { getStore } = require("@netlify/blobs");

exports.handler = async (event, context) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/xml; charset=utf-8"
  };

  try {
    const store = getStore({ name: "blog-posts", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
    const { blobs } = await store.list();

    const today = new Date().toISOString().split('T')[0];

    // Static pages
    const staticPages = [
      { loc: "https://studiojnsq.com/", changefreq: "weekly", priority: "1.0", lastmod: today },
      { loc: "https://studiojnsq.com/about", changefreq: "monthly", priority: "0.7", lastmod: today },
      { loc: "https://studiojnsq.com/journal", changefreq: "weekly", priority: "0.9", lastmod: today },
      { loc: "https://studiojnsq.com/diagnostic", changefreq: "weekly", priority: "0.9", lastmod: today },
      { loc: "https://studiojnsq.com/founder", changefreq: "monthly", priority: "0.8", lastmod: "2026-08-19" },
      { loc: "https://studiojnsq.com/archetypes", changefreq: "monthly", priority: "0.9", lastmod: "2026-08-10" },
      { loc: "https://studiojnsq.com/diagnostic/MAD", changefreq: "monthly", priority: "0.9", lastmod: "2026-04-02" },
      { loc: "https://studiojnsq.com/diagnostic/RVF", changefreq: "monthly", priority: "0.9", lastmod: "2026-04-02" },
      { loc: "https://studiojnsq.com/case-studies/", changefreq: "monthly", priority: "0.8", lastmod: "2026-07-31" },
      { loc: "https://studiojnsq.com/case-studies/idiyanale", changefreq: "monthly", priority: "0.7", lastmod: "2026-05-18" },
      { loc: "https://studiojnsq.com/case-studies/international-bank", changefreq: "monthly", priority: "0.7", lastmod: "2026-05-20" },
      { loc: "https://studiojnsq.com/case-studies/rovic-agriventures-egg-production", changefreq: "monthly", priority: "0.7", lastmod: "2026-07-31" },
      { loc: "https://studiojnsq.com/case-studies/rovic-chicken-dealer-poultry-distribution", changefreq: "monthly", priority: "0.7", lastmod: "2026-07-31" },
      { loc: "https://studiojnsq.com/case-studies/advisory-jaycee-ynares", changefreq: "monthly", priority: "0.7", lastmod: "2026-07-14" }
    ];

    // Blog posts
    const blogPages = [];
    for (const blob of blobs) {
      try {
        const data = await store.get(blob.key, { type: "json" });
        if (data && data.status === "published" && data.slug) {
          const lastmod = (data.updatedAt || data.publishDate || today).split('T')[0];
          blogPages.push({
            loc: `https://studiojnsq.com/journal/${data.slug}`,
            changefreq: "monthly",
            priority: "0.7",
            lastmod: lastmod
          });
        }
      } catch (e) {
        // Skip invalid entries
      }
    }

    const allPages = [...staticPages, ...blogPages];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(p => `  <url>
    <loc>${p.loc}</loc>
    <lastmod>${p.lastmod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: xml
    };
  } catch (err) {
    console.error("Sitemap generation error:", err);
    return {
      statusCode: 500,
      headers: { "Content-Type": "text/plain" },
      body: "Error generating sitemap"
    };
  }
};

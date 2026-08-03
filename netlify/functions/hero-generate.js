// Studio JNSQ Hero SVG Generator
// Renders a branded article hero as SVG. Two variants: BIP + Journal.
// GET params or blob-lookup by slug. Returns image/svg+xml.
//
// Layout matches the approved v3.1 hero templates:
//   - Cream background, ghost MAD diamond watermark (right)
//   - Header row: STUDIO JNSQ | series meta
//   - Left col (~60%): yellow square eyebrow, massive title (Inter Black + Lora italic mix), subtitle question, byline
//   - Right col (~30%): KEY INSIGHTS x3 (yellow numeral + bold + gray sub), giant Nº XX
//   - Footer: yellow studiojnsq.com | series meta

const { getStore } = require("@netlify/blobs");

// ==================================================================
// SHARED PIECES
// ==================================================================
const W = 1600;
const H = 900;

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// The title can contain <em>...</em> for italic emphasis and <br> for hand-composed line breaks.
// Everything else is escaped. This preserves the "Your marketing / is working. Your brand / *still isn't growing*" look.
function titleHtml(raw) {
  if (!raw) return "";
  let s = esc(raw);
  s = s
    .replace(/&lt;em&gt;/g, "<em>")
    .replace(/&lt;\/em&gt;/g, "</em>")
    .replace(/&lt;br\s*\/?&gt;/g, "<br/>")
    .replace(/\|LINEBREAK\|/g, "<br/>");
  return s;
}

// Fonts: import via SVG <style>. When the SVG is rendered inline in a browser
// or as an <img>, fonts get pulled from Google Fonts.
function fontStyle() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&display=swap');
    .stack-inter { font-family: 'Inter', system-ui, sans-serif; }
    .stack-lora { font-family: 'Lora', Georgia, serif; }
    .ink { color: #1A1A1A; fill: #1A1A1A; }
    .yellow { color: #FDD500; fill: #FDD500; }
    .mute { color: #A8A8A0; fill: #A8A8A0; }
    .line { stroke: #E0E0D8; }
    .body-title-mix em { font-family: 'Lora', Georgia, serif; font-style: italic; font-weight: 500; }
  `;
}

// Ghost MAD diamond watermark — geometric outline (stroked lines only, no fill).
// Faint yellow, positioned behind the right column. Shows the 4 facets converging on a center point.
function madWatermark() {
  return `
    <g transform="translate(1310, 500)" opacity="0.22">
      <g fill="none" stroke="#FDD500" stroke-width="2.2" stroke-linejoin="miter">
        <!-- Outer diamond outline -->
        <path d="M 0 -180 L 180 0 L 0 180 L -180 0 Z"/>
        <!-- Inner diamond outline -->
        <path d="M 0 -100 L 100 0 L 0 100 L -100 0 Z"/>
        <!-- 4 axes converging on center -->
        <line x1="0" y1="-180" x2="0" y2="180"/>
        <line x1="-180" y1="0" x2="180" y2="0"/>
        <!-- 4 facet edges (from mid-outer to center) -->
        <line x1="0" y1="-180" x2="100" y2="0"/>
        <line x1="180" y1="0" x2="0" y2="100"/>
        <line x1="0" y1="180" x2="-100" y2="0"/>
        <line x1="-180" y1="0" x2="0" y2="-100"/>
        <!-- Center Branding dot -->
        <circle cx="0" cy="0" r="6" fill="#FDD500" stroke="none"/>
      </g>
    </g>
  `;
}

// ==================================================================
// TEMPLATE — combined BIP + Journal, driven by data
// ==================================================================
function buildHeroSvg(data) {
  const variant = (data.variant || "journal").toLowerCase();
  const isBip = variant === "bip";

  const eyebrow = data.eyebrow || (isBip ? "ON BRAND GROWTH — BRILLIANT IN PUBLIC" : "ON BRAND EQUITY — THE FOUNDATION");
  const title = data.title || "Untitled";
  const subtitle = data.subtitle || "";
  const author = data.author || (isBip ? "JERICO LUGO" : "STUDIO JNSQ EDITORIAL TEAM");
  const readMin = data.readMin || 3;
  const insights = Array.isArray(data.insights) ? data.insights : [];
  const edition = data.edition || 1;
  const seriesTitle = data.seriesTitle || (isBip ? "BRILLIANT IN PUBLIC" : "THE JOURNAL");
  const seriesSubtitle = data.seriesSubtitle || (isBip ? "BRAND EQUITY ARCHITECTURE IN THE EVOLVING MEDIA AND PR LANDSCAPE" : "MEDIA · PR · BRAND STRATEGY");
  const editionSuffix = data.editionSuffix || (isBip ? "BRILLIANT IN PUBLIC" : (data.seriesLabel || "THE FOUNDATION"));
  const volume = data.volume || (isBip ? "II" : "");
  const date = data.date || "JULY 2026";
  const footerMeta = data.footerMeta || (isBip
    ? `BRILLIANT IN PUBLIC · EDITION Nº ${edition} · ${date}`
    : `THE JOURNAL · ENTRY Nº ${String(edition).padStart(2, "0")} · ${date}`);

  // Right-column top-right header block
  const headerRight = isBip
    ? `
      <!-- Volume stamp (top far-right, rotated) -->
      <g transform="translate(1400, 55) rotate(-2)">
        <rect x="0" y="0" width="130" height="44" fill="none" stroke="#1A1A1A" stroke-width="1.5"/>
        <text x="65" y="29" text-anchor="middle" class="stack-inter ink" font-size="16" font-weight="700" letter-spacing="2">VOLUME ${esc(volume)}</text>
      </g>
      <text x="1520" y="130" text-anchor="end" class="stack-inter ink" font-size="20" font-weight="800" letter-spacing="2.5">${esc(seriesTitle)}</text>
      <text x="1520" y="155" text-anchor="end" class="stack-inter mute" font-size="12.5" font-weight="700" letter-spacing="1.5">${esc(seriesSubtitle)}</text>
    `
    : `
      <text x="1520" y="105" text-anchor="end" class="stack-inter ink" font-size="22" font-weight="800" letter-spacing="2.5">${esc(seriesTitle)}</text>
      <text x="1520" y="132" text-anchor="end" class="stack-inter mute" font-size="14" font-weight="700" letter-spacing="1.5">${esc(seriesSubtitle)}</text>
    `;

  // Insights (right column, ~1050-1520)
  let insightsG = "";
  const insightStartY = 305;
  const insightGap = 110;
  insights.slice(0, 3).forEach((ins, idx) => {
    // Insight may be { headline, subhead } or a single string we split by " — " or newline
    let headline = "", subhead = "";
    if (typeof ins === "object" && ins) {
      headline = ins.headline || ins.h || "";
      subhead = ins.subhead || ins.s || "";
    } else {
      const t = String(ins);
      const splitMatch = t.split(/\s*[:—\-]\s*/);
      if (splitMatch.length >= 2) {
        headline = splitMatch[0].trim();
        subhead = splitMatch.slice(1).join(" — ").trim();
      } else {
        // Split by comma/period midpoint
        const half = Math.floor(t.length / 2);
        const cut = t.indexOf(" ", half);
        if (cut > 0) {
          headline = t.slice(0, cut).trim();
          subhead = t.slice(cut).trim();
        } else {
          headline = t;
        }
      }
    }
    const y = insightStartY + idx * insightGap;
    insightsG += `
      <g transform="translate(1050, ${y})">
        <text x="0" y="0" class="stack-lora yellow" font-size="40" font-weight="700" font-style="italic">${String(idx + 1).padStart(2, "0")}</text>
        <text x="80" y="-8" class="stack-inter ink" font-size="19" font-weight="700">${esc(headline)}</text>
        <text x="80" y="18" class="stack-inter mute" font-size="17" font-weight="500">${esc(subhead)}</text>
        <line x1="0" y1="42" x2="470" y2="42" class="line" stroke-width="1"/>
      </g>
    `;
  });

  // Edition block bottom-right of column
  const editionBlock = isBip
    ? `
      <text x="1050" y="675" class="stack-inter mute" font-size="14" font-weight="700" letter-spacing="1.5">EDITION</text>
      <text x="1050" y="740" class="stack-lora ink" font-size="72" font-weight="700" font-style="italic">Nº ${esc(edition)}</text>
      <text x="1050" y="770" class="stack-inter mute" font-size="14" font-weight="700" letter-spacing="1.5">${esc(editionSuffix)}</text>
    `
    : `
      <text x="1050" y="705" class="stack-lora ink" font-size="76" font-weight="700">Nº ${esc(String(edition).padStart(2, "0"))}</text>
      <text x="1050" y="740" class="stack-inter mute" font-size="14" font-weight="700" letter-spacing="1.5">${esc(editionSuffix)}</text>
    `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid meet">
  <defs>
    <style type="text/css"><![CDATA[
      ${fontStyle()}
    ]]></style>
  </defs>

  <!-- Cream background -->
  <rect x="0" y="0" width="${W}" height="${H}" fill="#FBF8EC"/>

  <!-- Ghost MAD watermark -->
  ${madWatermark()}

  <!-- Header row -->
  <text x="80" y="115" class="stack-inter ink" font-size="26" font-weight="800" letter-spacing="3.5">STUDIO JNSQ</text>
  ${headerRight}

  <!-- Horizontal rule -->
  <line x1="80" y1="180" x2="${W - 80}" y2="180" class="line" stroke-width="2"/>

  <!-- Left column -->
  <!-- Eyebrow -->
  <g transform="translate(80, 260)">
    <rect x="0" y="-12" width="14" height="14" fill="#FDD500"/>
    <text x="26" y="0" class="stack-inter ink" font-size="15" font-weight="700" letter-spacing="2.5">${esc(eyebrow)}</text>
  </g>

  <!-- Title (uses foreignObject for proper wrapping + Inter Black + Lora italic mix).
       Supports <br/> for hand-composed line breaks (matches original hero designs). -->
  <foreignObject x="76" y="290" width="880" height="360">
    <div xmlns="http://www.w3.org/1999/xhtml"
         class="body-title-mix"
         style="font-family:'Inter',system-ui,sans-serif;font-weight:900;font-size:68px;line-height:1.02;color:#1A1A1A;letter-spacing:-0.025em;">
      ${titleHtml(title)}
    </div>
  </foreignObject>

  <!-- Subtitle question -->
  <foreignObject x="80" y="670" width="800" height="80">
    <div xmlns="http://www.w3.org/1999/xhtml"
         style="font-family:'Inter',system-ui,sans-serif;font-weight:500;font-size:20px;line-height:1.45;color:#5C5C58;">
      ${esc(subtitle)}
    </div>
  </foreignObject>

  <!-- Byline -->
  <text x="80" y="795" class="stack-inter mute" font-size="14" font-weight="700" letter-spacing="2">WORDS BY ${esc(String(author).toUpperCase())} · ${esc(readMin)} MIN READ</text>

  <!-- Right column: KEY INSIGHTS label -->
  <text x="1050" y="265" class="stack-inter ink" font-size="17" font-weight="800" letter-spacing="2.5">KEY INSIGHTS</text>
  <line x1="1050" y1="278" x2="1520" y2="278" class="line" stroke-width="1"/>

  <!-- Insights -->
  ${insightsG}

  <!-- Edition block -->
  ${editionBlock}

  <!-- Footer horizontal rule -->
  <line x1="80" y1="835" x2="${W - 80}" y2="835" class="line" stroke-width="2"/>

  <!-- Footer -->
  <text x="80" y="870" class="stack-inter yellow" font-size="15" font-weight="700" letter-spacing="1.5">studiojnsq.com</text>
  <text x="${W - 80}" y="870" text-anchor="end" class="stack-inter mute" font-size="14" font-weight="700" letter-spacing="2.5">${esc(footerMeta)}</text>
</svg>`;
}

// ==================================================================
// HANDLER
// ==================================================================
function corsHeaders(mime) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": mime || "image/svg+xml",
    "Cache-Control": "public, max-age=600"
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders("text/plain"), body: "" };

  const qs = event.queryStringParameters || {};

  // Two invocation modes:
  //   1) ?slug=<slug>   → pull structured data from the blog-posts blob store
  //   2) query-only     → build from raw params (useful for admin preview)
  let data = {};

  if (qs.slug) {
    try {
      const store = getStore({ name: "blog-posts", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
      const post = await store.get(qs.slug, { type: "json" });
      if (post) {
        data = {
          variant: (post.series === "bip") ? "bip" : "journal",
          eyebrow: post.heroEyebrow || (post.series === "bip"
            ? `ON ${(post.topic || "BRAND GROWTH").toUpperCase()} — BRILLIANT IN PUBLIC`
            : `ON ${(post.topic || "BRAND EQUITY").toUpperCase()} — ${(post.seriesName || "THE FOUNDATION").toUpperCase()}`),
          title: post.heroTitleHtml || post.title || "",
          subtitle: post.heroSubtitle || post.excerpt || "",
          author: post.author || (post.series === "bip" ? "JERICO LUGO" : "STUDIO JNSQ EDITORIAL TEAM"),
          readMin: post.readMin || 3,
          insights: (post.insights || []).map(i => (typeof i === "string" ? i : (i.headline ? { headline: i.headline, subhead: i.subhead } : ""))),
          edition: post.seriesIndex || post.editionN || 1,
          seriesTitle: post.series === "bip" ? "BRILLIANT IN PUBLIC" : "THE JOURNAL",
          seriesSubtitle: post.series === "bip"
            ? "BRAND EQUITY ARCHITECTURE IN THE EVOLVING MEDIA AND PR LANDSCAPE"
            : "MEDIA · PR · BRAND STRATEGY",
          editionSuffix: post.series === "bip"
            ? "BRILLIANT IN PUBLIC"
            : (post.seriesLabel || post.seriesName || "THE FOUNDATION"),
          volume: post.volume || "II",
          date: post.heroDate || "JULY 2026",
          footerMeta: post.footerMeta || null
        };
      }
    } catch (e) {
      console.error("hero-generate blob load error:", e);
    }
  }

  // Overlay any explicit query params so admin preview can experiment
  const paramList = ["variant","eyebrow","title","subtitle","author","readMin","edition","seriesTitle","seriesSubtitle","editionSuffix","volume","date","footerMeta"];
  paramList.forEach(k => { if (qs[k] != null) data[k] = qs[k]; });

  // Insights via query params (i1h/i1s/i2h/i2s/i3h/i3s)
  if (qs.i1h || qs.i2h || qs.i3h) {
    data.insights = [
      { headline: qs.i1h || "", subhead: qs.i1s || "" },
      { headline: qs.i2h || "", subhead: qs.i2s || "" },
      { headline: qs.i3h || "", subhead: qs.i3s || "" }
    ].filter(i => i.headline);
  }

  // Sensible fallback so the URL works even with no params (renders a demo)
  if (!data.title) {
    data = {
      variant: "journal",
      title: "What is brand equity, <em>and why should you care?</em>",
      subtitle: "If you switched off all marketing tomorrow, would the market still come to you?",
      author: "STUDIO JNSQ EDITORIAL TEAM",
      readMin: 3,
      edition: 1,
      editionSuffix: "THE FOUNDATION · PART 1 OF 3",
      insights: [
        { headline: "Intangibles ≈ 90% of value", subhead: "of the S&P 500, up from 17% in 1975." },
        { headline: "Equity compounds; spend resets.", subhead: "+5% retention → +25–95% profit." },
        { headline: "A system, not a campaign.", subhead: "Measurable, buildable brand value." }
      ]
    };
  }

  const svg = buildHeroSvg(data);

  return { statusCode: 200, headers: corsHeaders(), body: svg };
};

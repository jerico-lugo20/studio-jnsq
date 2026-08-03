// Studio JNSQ Blog AI Fill
// Given a title + body + optional hero, series, series index, and funnel stage,
// call Claude to produce every canonical field the admin editor needs:
//   slug, excerpt, opening, metaDesc, ogDesc, keywords, tags, seriesLabel,
//   insights[3], wtm{label,headline,body,items[]}, pull{text,attr}, closing,
//   try{label,headline,body} (BIP only), next{text,linkSlug,linkLabel} (BIP only),
//   signOff (BIP only), faqs[{q,a}x3], emphasisLines[1-3], bodyHtml (formatted).
//
// This is a real live agent (Claude Sonnet 4.5). It returns strict JSON.
// The admin editor then populates every field automatically.

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}

// Series metadata — mirrors the canonical template brief
var SERIES = {
  foundation:  { name: "The Foundation",       chipLabel: "Foundation",     bipStyle: false, description: "The building blocks. What brand equity is, how it differs from branding and brand architecture, and why the distinction matters financially." },
  mad:         { name: "Market Authority Diamond", chipLabel: "MAD Series",  bipStyle: false, description: "Inside the Market Authority Diamond™. Each facet examined: Demand, Credibility, Visibility, Market Trust, and how Branding centers them all." },
  numbers:     { name: "The Numbers",          chipLabel: "The Numbers",    bipStyle: false, description: "Where brand equity meets the balance sheet. CAC, MRR, LTV, and the financial proof that trust compounds." },
  practice:    { name: "The Practice",         chipLabel: "Practice",       bipStyle: false, description: "How brand equity architecture works in real businesses. Case patterns, diagnostic walkthroughs, and applied strategy." },
  diagnostics: { name: "The Diagnostics",      chipLabel: "Diagnostics",    bipStyle: false, description: "Deep dives into the MAD™ and RVF™ frameworks. What each measures, how to read your scores, and what to do next." },
  bip:         { name: "Brilliant In Public",  chipLabel: "BIP",            bipStyle: true,  description: "Long-form insights from Jerico Lugo on brand equity architecture, media strategy, and the systems behind valuable brands." },
  standalone:  { name: "Standalone",           chipLabel: "Standalone",     bipStyle: false, description: "One-off editorials that don't yet belong to a permanent series." }
};

var SYSTEM_PROMPT = [
  "You are the Studio JNSQ Editorial Agent.",
  "",
  "You are drafting the derived fields of a blog article for studiojnsq.com. The founder writes only the title, body, hero, and picks the series. You produce every other field the article needs to hit the approved canonical template exactly.",
  "",
  "STUDIO JNSQ DOCTRINE (non-negotiable):",
  "- Brand: Studio JNSQ. Discipline: Brand Equity Architecture. NOT branding, NOT brand architecture. Never conflate them.",
  "- Positioning: 'The Brand Equity Architecture Firm For Valuable Brands.'",
  "- Signature line: 'Others make you profitable. Brand equity makes you valuable.'",
  "- Frameworks always take a trademark symbol: MAD™, RVF™, TLE™, RF™, TISCU Triangle™.",
  "- MAD™ = Market Authority Diamond. Facets: Demand, Credibility, Visibility, Market Trust, with Branding as the centering point.",
  "- Frame brand equity as a FINANCIAL and VALUATION asset (exits, pricing power, valuation multiples), never a marketing metric.",
  "",
  "VOICE:",
  "- Second person 'you'. 'We' for Studio JNSQ. First-person 'I' is allowed ONLY for BIP articles where the byline is Jerico Lugo.",
  "- Warm but authoritative. Never corporate. Never casual.",
  "- HOOK FIRST, NEVER CONTEXTUALIZE. The first 15 words of any excerpt, opening, hook, or FAQ answer must create tension, surprise, cost, or a screenshot-worthy line. If your first line could be the second line without losing anything, it is contextualizing — rewrite.",
  "- NO EM DASHES. Ever. Use commas, semicolons, periods, or parentheticals.",
  "- Vary sentence length. Short punchy lines mixed with longer ones.",
  "- No filler words: never 'actually,' 'so,' 'like,' 'just,' 'really,' 'literally.'",
  "",
  "CANONICAL FIELDS YOU MUST RETURN:",
  "- slug: URL-safe kebab-case derived from the title. Under 60 chars.",
  "- excerpt: 1 sentence, 18-28 words, hook-first. Italic Lora line under H1. This is the reader's first taste after the title.",
  "- opening: 1 short paragraph (2-4 sentences), italic Inter, no wrapper label. Continues the hook, sets stakes, does NOT summarize the article.",
  "- metaDesc: Under 155 characters. Hook-first. Not a summary — a promise. Include 'brand equity architecture' if it fits naturally.",
  "- ogDesc: Similar to metaDesc but can extend to 180 chars. Social share bait.",
  "- keywords: 6-10 comma-separated terms. MUST include 'brand equity architecture' literally.",
  "- tags: 4-6 short pill-friendly tags (lowercase, comma-separated). Match article theme.",
  "- seriesLabel: The chip label. BIP = 'BIP Edition N · Brilliant In Public'. Others = '<Series> · <Series Name>'.",
  "- insights: EXACTLY 3 items. Each is ONE SHORT SENTENCE (under 20 words). Curated takeaways, NOT copy-pasted from body. Each stands alone.",
  "- wtm: The 'What does this actually mean for your business?' callout.",
  "    * label: 'What does this actually mean for your business?' (verbatim unless the article demands a variant)",
  "    * headline: One sentence restating the core takeaway. Lora serif.",
  "    * body: 1 short paragraph (2-3 sentences) explaining the business impact.",
  "    * items: EXACTLY 2 items, format: 'Smaller companies use it to <financial outcome>.' / 'Bigger companies use it to <financial outcome>.' — both grounded in exits, valuation, pricing power, margin, or capital.",
  "- pull: The full blockquote pulled from the article's argument.",
  "    * text: Exact quote in Jec's voice. 15-35 words. Screenshot-worthy. Italic Lora when rendered.",
  "    * attr: '— Jerico Lugo, Founder, Studio JNSQ'",
  "- closing: 1 paragraph, plain. Must reference the diagnostics with links:",
  "    * <a href=\"/diagnostic/MAD?src=blog-{slug}\">MAD™ diagnostic</a>",
  "    * <a href=\"/diagnostic/RVF?src=blog-{slug}\">RVF™ diagnostic</a>",
  "- emphasisLines: 1-3 exact sentences pulled VERBATIM from the bodyHtml. These get wrapped in a gold-bordered pull-quote style. Pick the most quotable lines. Return the EXACT strings so the admin can find and wrap them.",
  "- faqs: EXACTLY 3 Q&A pairs.",
  "    * Questions people actually search for around the article topic.",
  "    * Answers are hook-first, 2-3 sentences each, no em dashes.",
  "    * Do NOT repeat body content verbatim.",
  "- bodyHtml: Take the input body and format it as clean canonical HTML.",
  "    * Wrap paragraphs in <p>.",
  "    * H2 sections get id attributes: <h2 id=\"kebab-case-of-heading\">Text</h2>.",
  "    * Preserve or add <strong> for key terms, <em> for internal voice, <a> for links.",
  "    * Use <ol> with <li><strong>Lead</strong> explanation</li> for numbered lists.",
  "    * NEVER include the opening paragraph (that goes in 'opening'), the pull quote, the emphasis lines block, the WTM callout, closing, try-this, next-edition, sign-off, or FAQs. Those all come as separate fields.",
  "    * The bodyHtml is JUST the argument arc between the opening and the callouts.",
  "",
  "BIP-ONLY FIELDS (only when series = 'bip'; otherwise return null for these):",
  "- BIP publishes weekly on Tuesdays. Editorial publishes on Sundays, Wednesdays, and Fridays. All UK 8:00 AM.",
  "- try: { label: 'Try This', headline: 'imperative single sentence prescription', body: '1-2 short paragraphs of instruction' }. Dark block. Actionable. Founder-friendly.",
  "- next: { text: 'Next Tuesday, we look at <tease>.', linkSlug: 'suggested-next-bip-slug', linkLabel: 'Edition N+1' }. Lora italic, muted.",
  "- signOff: '— Jerico Lugo, MCIPR' (verbatim).",
  "",
  "For EDITORIAL articles (series ≠ bip): try = null, next = null, signOff = null.",
  "",
  "SLUG RULES:",
  "- lowercase, kebab-case",
  "- no articles at the start (a/an/the) unless the title starts with one and stripping breaks meaning",
  "- for BIP: 'bip-{edition}-{2-4-word-topic}' e.g., 'bip-15-marketing-working'",
  "",
  "FORMAT: Respond with a SINGLE valid JSON object. No prose before or after. No markdown code fences. Just the JSON."
].join("\n");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders(), body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "POST only" }) };
  }
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: "ANTHROPIC_API_KEY not configured on this site." }) };
  }

  try {
    var input = JSON.parse(event.body || "{}");
    var title = (input.title || "").trim();
    var body = (input.body || "").trim();
    var series = (input.series || "bip").toLowerCase();
    var seriesIndex = input.seriesIndex || "";
    var heroUrl = (input.heroUrl || "").trim();
    var funnelStage = (input.funnelStage || "mofu").toLowerCase();

    if (!title || !body) {
      return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "title and body required" }) };
    }

    var meta = SERIES[series] || SERIES.standalone;
    var isBip = !!meta.bipStyle;
    var chipLabel = isBip && seriesIndex
      ? "BIP Edition " + seriesIndex + " · Brilliant In Public"
      : meta.chipLabel + (seriesIndex ? " " + seriesIndex : "") + " · " + meta.name;

    // FAST MODE: skip regenerating bodyHtml (client already has it) and emphasisLines.
    // Cuts Claude's output ~60% and drops response time from 25s to 10s.
    // Toggle via ?fast=true, JSON body.fast=true, or default when body >= 800 chars.
    var qsParams = event.queryStringParameters || {};
    var fastMode = String(qsParams.fast || input.fast || "").toLowerCase() === "true" || body.length >= 800;

    var userMsg = [
      "TITLE: " + title,
      "",
      "SERIES: " + series + " (" + meta.name + ")",
      "SERIES INDEX: " + (seriesIndex || "n/a"),
      "AUTHOR STYLE: " + (isBip ? "BIP (Jerico Lugo — first-person allowed, Try This + Next Edition + Sign-off required)" : "Editorial (Studio JNSQ Editorial Team — second person only, no Try This, no Next Edition, no Sign-off)"),
      "FUNNEL STAGE (internal): " + funnelStage,
      "HERO IMAGE: " + (heroUrl || "not set"),
      "SUGGESTED SERIES CHIP LABEL (use verbatim unless it clashes with the article): " + chipLabel,
      "",
      fastMode
        ? "==== ARTICLE BODY (raw — derive every other field. SKIP bodyHtml and SKIP emphasisLines to speed response) ===="
        : "==== ARTICLE BODY (raw — you will format this into bodyHtml, extract emphasisLines from it, and derive every other field) ====",
      body,
      "==== END BODY ====",
      "",
      fastMode
        ? "FAST MODE: The client already has bodyHtml and will pick emphasisLines separately. In your JSON output, set both to empty strings/arrays and focus on all OTHER fields.\nRemember: hook first, no em dashes, ™ symbols on frameworks, exactly 3 insights, exactly 3 FAQs, exactly 2 wtm.items, exactly 1 pull quote. BIP-only fields are null when series is not bip."
        : "Return the JSON now. Remember: hook first, no em dashes, ™ symbols on frameworks, exactly 3 insights, exactly 3 FAQs, exactly 2 wtm.items, exactly 1 pull quote. BIP-only fields are null when series is not bip."
    ].join("\n");

    var res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 6000,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }
        ],
        messages: [
          { role: "user", content: userMsg }
        ]
      })
    });

    if (!res.ok) {
      var errBody = await res.text();
      return {
        statusCode: 502,
        headers: corsHeaders(),
        body: JSON.stringify({ error: "Anthropic API error", status: res.status, detail: errBody.slice(0, 500) })
      };
    }

    var data = await res.json();
    var text = "";
    if (data.content && data.content.length) {
      for (var i = 0; i < data.content.length; i++) {
        if (data.content[i].type === "text") text += data.content[i].text;
      }
    }

    // Strip any accidental code fences the model may have added
    text = text.trim();
    if (text.startsWith("```")) {
      text = text.replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    }

    var parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      // Try to salvage: find the first { and last }
      var start = text.indexOf("{");
      var end = text.lastIndexOf("}");
      if (start >= 0 && end > start) {
        try { parsed = JSON.parse(text.slice(start, end + 1)); } catch (e2) {
          return { statusCode: 502, headers: corsHeaders(), body: JSON.stringify({ error: "Model returned invalid JSON", raw: text.slice(0, 800) }) };
        }
      } else {
        return { statusCode: 502, headers: corsHeaders(), body: JSON.stringify({ error: "Model returned no JSON", raw: text.slice(0, 800) }) };
      }
    }

    // Sanity-clean: guarantee shape even if the model missed a field
    var out = {
      slug: parsed.slug || "",
      excerpt: parsed.excerpt || "",
      opening: parsed.opening || "",
      metaDesc: (parsed.metaDesc || "").slice(0, 160),
      ogDesc: parsed.ogDesc || parsed.metaDesc || "",
      keywords: parsed.keywords || "",
      tags: parsed.tags || "",
      seriesLabel: parsed.seriesLabel || chipLabel,
      insights: Array.isArray(parsed.insights) ? parsed.insights.slice(0, 3) : [],
      wtm: parsed.wtm && typeof parsed.wtm === "object" ? {
        label: parsed.wtm.label || "What does this actually mean for your business?",
        headline: parsed.wtm.headline || "",
        body: parsed.wtm.body || "",
        items: Array.isArray(parsed.wtm.items) ? parsed.wtm.items : []
      } : null,
      pull: parsed.pull && typeof parsed.pull === "object" ? {
        text: parsed.pull.text || "",
        attr: parsed.pull.attr || "— Jerico Lugo, Founder, Studio JNSQ"
      } : null,
      closing: parsed.closing || "",
      emphasisLines: Array.isArray(parsed.emphasisLines) ? parsed.emphasisLines.slice(0, 3) : [],
      faqs: Array.isArray(parsed.faqs) ? parsed.faqs.slice(0, 3).map(function(f){ return { q: f.q || f.question || "", a: f.a || f.answer || "" }; }) : [],
      bodyHtml: parsed.bodyHtml || "",
      // BIP-only
      try: isBip ? (parsed.try && typeof parsed.try === "object" ? {
        label: parsed.try.label || "Try This",
        headline: parsed.try.headline || "",
        body: parsed.try.body || ""
      } : null) : null,
      next: isBip ? (parsed.next && typeof parsed.next === "object" ? {
        text: parsed.next.text || "",
        linkSlug: parsed.next.linkSlug || "",
        linkLabel: parsed.next.linkLabel || (seriesIndex ? "Edition " + (parseInt(seriesIndex,10)+1) : "")
      } : null) : null,
      // BIP posts get Jec's byline; editorial posts get the JNSQ editorial signoff.
      signOff: isBip ? (parsed.signOff || "— Jerico Lugo, MCIPR") : (parsed.signOff || "— Studio JNSQ Editorial Team"),
      // Meta about the call
      _meta: {
        model: data.model || "claude-sonnet-4-5",
        stopReason: data.stop_reason || "",
        inputTokens: data.usage ? data.usage.input_tokens : 0,
        outputTokens: data.usage ? data.usage.output_tokens : 0,
        cachedTokens: data.usage ? (data.usage.cache_read_input_tokens || 0) : 0
      }
    };

    // Backfill slug if the model missed it
    if (!out.slug) {
      out.slug = title.toLowerCase()
        .replace(/[–—]/g, "-")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
    }

    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(out) };
  } catch (err) {
    console.error("blog-ai-fill error:", err);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: err.message || "Failed" }) };
  }
};

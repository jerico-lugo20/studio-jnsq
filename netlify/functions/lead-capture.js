// Lead capture for promo-gate claims.
// Stores { id, name, email, company, position, phone, linkedin,
//          source, code, tier, discount, ip, userAgent, timestamp }
// in the 'promo-leads' blob. Also maintains a _index for admin listing.
//
// Supported methods:
//   POST   /.netlify/functions/lead-capture         → create lead
//   GET    /.netlify/functions/lead-capture?list=1  → list leads (admin)
//   GET    /.netlify/functions/lead-capture?id=xyz  → fetch single lead
//   DELETE /.netlify/functions/lead-capture?id=xyz  → delete a lead

const { getStore } = require("@netlify/blobs");

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };
}

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function getBlobStore() {
  return getStore({ name: "promo-leads", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
}

function getPromoCodesStore() {
  return getStore({ name: "promo-codes", siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
}

// Convert the blog gate's tier string into the array shape promo-codes uses.
function tiersFromString(tier) {
  if (!tier) return [];
  if (tier === 'both') return ['$70 Report', '$100 Full Diagnostic'];
  return [tier];
}

// Register a freshly-generated unique code in the promo-codes registry so it
// actually validates at checkout. Called from the POST handler after the lead
// is saved. Non-fatal — logs on error so the lead capture still succeeds.
async function registerPromoCode(spec) {
  try {
    const store = getPromoCodesStore();
    let codes = [];
    try { const ex = await store.get('codes', { type: 'json' }); if (Array.isArray(ex)) codes = ex; }
    catch (e) { /* first write */ }

    const upperCode = String(spec.code || '').toUpperCase();
    if (!upperCode) return;

    // Upsert
    codes = codes.filter(function (c) { return String(c.code || '').toUpperCase() !== upperCode; });
    codes.push({
      code: upperCode,
      discountPct: Number(spec.discountPct) || 0,
      expiry: spec.expiry || '',
      usageType: spec.usageType || 'one-time',
      maxUses: spec.maxUses || 1,
      tiers: Array.isArray(spec.tiers) ? spec.tiers : [],
      forEveryone: spec.forEveryone !== undefined ? !!spec.forEveryone : true,
      linkedTo: spec.linkedTo || '',
      email: spec.email || '',
      leadName: spec.leadName || '',
      source: spec.source || 'blog-promo-gate-unique',
      status: 'active',
      createdAt: new Date().toISOString()
    });
    if (codes.length > 20000) codes = codes.slice(codes.length - 20000);
    await store.setJSON('codes', codes);
  } catch (e) {
    console.error('registerPromoCode error:', e && e.message);
    // swallow — lead capture is the primary success path
  }
}

// Turn a full name into an initials-lastname stub for unique codes.
// "Marina Alva" -> "MAlva", "Jerico Cadag Lugo" -> "JCLugo", "Cher" -> "Cher".
// Ambiguous / diacritic-heavy names still produce a stable, deterministic stub.
function initialsFromName(name) {
  var clean = String(name || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^A-Za-z\s'-]/g, ' ')                    // keep letters + word breaks
    .trim();
  if (!clean) return 'Reader';
  var parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    // Single name: capitalize first letter, keep up to 8 chars
    return parts[0].charAt(0).toUpperCase() + parts[0].slice(1, 8).toLowerCase();
  }
  // Multi-part: first letter of each middle+first, full last name (capitalized)
  var last = parts[parts.length - 1].replace(/[^A-Za-z]/g, ''); // strip apostrophes / hyphens from surname
  if (!last) last = parts[0].replace(/[^A-Za-z]/g, '');
  var initials = parts.slice(0, -1).map(function (p) {
    var c = p.replace(/[^A-Za-z]/g, '');
    return c ? c.charAt(0).toUpperCase() : '';
  }).join('');
  var lastCased = last.charAt(0).toUpperCase() + last.slice(1, 12).toLowerCase();
  return (initials + lastCased).slice(0, 20);
}

// Sanitize a suffix so it's safe as a promo code fragment.
function normalizeSuffix(s) {
  return String(s || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 24) || 'JNSQ';
}

// Build "MAlva-Foundation1"-style code, deduping against the existing lead index.
function buildUniqueCode(name, suffix, existingCodes) {
  var stub = initialsFromName(name);
  var suf = normalizeSuffix(suffix);
  var base = stub + '-' + suf;
  if (!existingCodes || existingCodes.indexOf(base) === -1) return base;
  for (var i = 2; i < 200; i++) {
    var candidate = base + '-' + i;
    if (existingCodes.indexOf(candidate) === -1) return candidate;
  }
  // Fallback: append short random tail
  return base + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

exports.handler = async function (event) {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: corsHeaders(), body: "" };

  // -------- GET (admin listing / single fetch) --------
  if (event.httpMethod === "GET") {
    try {
      const store = getBlobStore();
      const qs = event.queryStringParameters || {};

      if (qs.id) {
        const record = await store.get(qs.id, { type: 'json' });
        if (!record) return { statusCode: 404, headers: corsHeaders(), body: JSON.stringify({ error: "Not found" }) };
        return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify(record) };
      }

      // Default: list. Returns the _index (lightweight rows).
      let idx = [];
      try { const ex = await store.get('_index', { type: 'json' }); if (Array.isArray(ex)) idx = ex; }
      catch (e) { /* no index yet */ }

      // Sort newest first
      idx.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

      // Optional filter by source substring
      if (qs.source) {
        const s = String(qs.source).toLowerCase();
        idx = idx.filter(row => (row.source || '').toLowerCase().includes(s));
      }

      // Optional limit
      const limit = parseInt(qs.limit || '0', 10);
      if (limit > 0) idx = idx.slice(0, limit);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ leads: idx, count: idx.length }) };
    } catch (e) {
      console.error('lead-capture GET error:', e);
      return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: e.message || 'Failed' }) };
    }
  }

  // -------- DELETE (admin cleanup) --------
  if (event.httpMethod === "DELETE") {
    try {
      const store = getBlobStore();
      const qs = event.queryStringParameters || {};
      if (!qs.id) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing id" }) };

      await store.delete(qs.id);

      // Remove from index too
      let idx = [];
      try { const ex = await store.get('_index', { type: 'json' }); if (Array.isArray(ex)) idx = ex; } catch (e) {}
      idx = idx.filter(row => row.id !== qs.id);
      await store.setJSON('_index', idx);

      return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true }) };
    } catch (e) {
      console.error('lead-capture DELETE error:', e);
      return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: e.message || 'Failed' }) };
    }
  }

  // -------- POST (create lead) --------
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: corsHeaders(), body: JSON.stringify({ error: "Method not allowed" }) };

  let data;
  try { data = JSON.parse(event.body || "{}"); }
  catch (e) { return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Invalid JSON" }) }; }

  // Required fields
  const name = String(data.name || '').trim();
  const email = String(data.email || '').trim().toLowerCase();
  const company = String(data.company || '').trim();

  if (!name) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Full name is required" }) };
  if (!isEmail(email)) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Valid email is required" }) };
  if (!company) return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Company is required" }) };

  const codeType = data.codeType === 'unique' ? 'unique' : 'shared';
  const suffix = String(data.codeSuffix || '').trim();
  const sharedCode = String(data.code || '').trim();

  try {
    const store = getBlobStore();

    // Load existing index (needed for unique-code dedup and for the write below).
    let idx = [];
    try { const ex = await store.get('_index', { type: 'json' }); if (Array.isArray(ex)) idx = ex; }
    catch (e) { /* first write */ }

    // Determine the final code
    let finalCode;
    if (codeType === 'unique') {
      if (!suffix) {
        return { statusCode: 400, headers: corsHeaders(), body: JSON.stringify({ error: "Missing code suffix for unique campaign" }) };
      }
      const existingCodes = idx.map(r => r.code).filter(Boolean);
      finalCode = buildUniqueCode(name, suffix, existingCodes);
    } else {
      finalCode = sharedCode;
    }

    const now = new Date();
    const record = {
      id: 'lead_' + now.getTime().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      name: name.slice(0, 200),
      email: email.slice(0, 200),
      company: company.slice(0, 200),
      position: String(data.position || '').trim().slice(0, 200),
      phone: String(data.phone || '').trim().slice(0, 60),
      linkedin: String(data.linkedin || '').trim().slice(0, 400),
      source: String(data.source || '').slice(0, 200),
      code: finalCode.slice(0, 80),
      codeType: codeType,
      codeSuffix: suffix.slice(0, 60),
      tier: String(data.tier || '').slice(0, 100),
      discount: String(data.discount || '').slice(0, 20),
      ip: event.headers['x-forwarded-for'] || event.headers['client-ip'] || '',
      userAgent: (event.headers['user-agent'] || '').slice(0, 400),
      timestamp: now.toISOString(),
      type: 'promo-lead'
    };

    await store.setJSON(record.id, record);

    // Append to lightweight index for admin listing
    idx.push({
      id: record.id,
      name: record.name,
      email: record.email,
      company: record.company,
      position: record.position,
      phone: record.phone,
      linkedin: record.linkedin,
      source: record.source,
      code: record.code,
      codeType: record.codeType,
      codeSuffix: record.codeSuffix,
      tier: record.tier,
      discount: record.discount,
      timestamp: record.timestamp,
      type: record.type
    });
    // Cap index size for performance
    if (idx.length > 5000) idx = idx.slice(idx.length - 5000);
    await store.setJSON('_index', idx);

    // Register the unique code in the promo-codes registry so it validates at
    // checkout. Shared codes are already registered when the blog post is saved.
    if (codeType === 'unique' && finalCode) {
      // Default expiry: 30 days from now.
      const exp = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      // Convert incoming tier string into promo-codes tier array.
      const tiers = tiersFromString(String(data.tier || ''));
      // Parse discount: incoming may be a number, "100", or "100%" from the modal
      const rawDiscount = String(data.discount || '').replace(/[^0-9.]/g, '');
      const discountPct = Number(rawDiscount) || 0;

      await registerPromoCode({
        code: finalCode,
        discountPct: discountPct,
        expiry: exp,
        usageType: 'one-time',
        maxUses: 1,
        tiers: tiers,
        forEveryone: true, // unique codes are already deterministic per email; anyone with the string can use it
        linkedTo: record.source, // e.g., "blog:foundation-1-what-is-brand-equity"
        email: record.email,
        leadName: record.name,
        source: 'blog-promo-gate-unique'
      });
    }

    // Return the final code so the reader's modal can display it.
    return { statusCode: 200, headers: corsHeaders(), body: JSON.stringify({ success: true, id: record.id, code: record.code, codeType: record.codeType }) };
  } catch (e) {
    console.error('lead-capture POST error:', e);
    return { statusCode: 500, headers: corsHeaders(), body: JSON.stringify({ error: e.message || 'Failed' }) };
  }
};

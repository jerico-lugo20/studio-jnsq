/* ============================================================
   Studio JNSQ — MAD(tm) Archetype Engine
   Shared source of truth for the 16 Market Authority archetypes.

   Used by:
     - index.html          (full 44-question MAD(tm) individual diagnostic)
     - archetypes.html     (free 15-question Career Equity Archetype(tm) finder)

   Both surfaces MUST classify identically. Do not fork this logic.
   Extracted verbatim from index.html on 2026-08-10.

   determineArchetype() reads only the low/mid/high band of each facet
   plus the walls mean, which is why a 15-question and a 44-question
   instrument can share it without disagreeing.
   ============================================================ */
(function (root) {
  'use strict';

  var madArchetypes = {
    'blank-canvas':       { name: 'The Blank Canvas', tier: 1, tierName: 'Center Break', desc: 'All facets low, center empty. Starting point, everything ahead.', next: 'architect', center: 'low', walls: 'low', trust: 'low', demand: 'low' },
    'drifter':            { name: 'The Drifter', tier: 1, tierName: 'Center Break', desc: 'Fragments without strategy. The market sees pieces, not a person.', next: 'architect', center: 'low', walls: 'mixed', trust: 'any', demand: 'any' },
    'accidental-expert':  { name: 'The Accidental Expert', tier: 1, tierName: 'Center Break', desc: 'Success without architecture. Fragile by design.', next: 'architect', center: 'low', walls: 'high', trust: 'any', demand: 'any' },
    'inherited-name':     { name: 'The Inherited Name', tier: 1, tierName: 'Center Break', desc: 'Authority borrowed from title, company, or family. Not yet yours.', next: 'architect', center: 'low', walls: 'any', trust: 'mid+', demand: 'mid+' },
    'architect':          { name: 'The Architect', tier: 2, tierName: 'Wall Break', desc: 'Blueprint without construction. Clear identity, not yet built out.', next: 'rising-contender', center: 'mid+', walls: 'low', trust: 'any', demand: 'any' },
    'hidden-genius':      { name: 'The Hidden Genius', tier: 2, tierName: 'Wall Break', desc: 'Proven but unseen. Deep credibility, low visibility.', next: 'new-authority', center: 'mid+', walls: 'cred-high-vis-low', trust: 'any', demand: 'any' },
    'broadcast':          { name: 'The Broadcast', tier: 2, tierName: 'Wall Break', desc: 'High reach, low depth. Visible but not yet validated.', next: 'new-authority', center: 'mid+', walls: 'cred-low-vis-high', trust: 'any', demand: 'any' },
    'rising-contender':   { name: 'The Rising Contender', tier: 2, tierName: 'Wall Break', desc: 'Forming but not yet load-bearing. The foundation is taking shape.', next: 'new-authority', center: 'mid+', walls: 'mid', trust: 'any', demand: 'any' },
    'new-authority':      { name: 'The New Authority', tier: 3, tierName: 'Foundation Break', desc: 'New to market or recently pivoted. Walls strong, trust still building.', next: 'quiet-authority', center: 'mid+', walls: 'mid+', trust: 'low', demand: 'any' },
    'polarizer':          { name: 'The Polarizer', tier: 3, tierName: 'Foundation Break', desc: 'Strong reactions both ways. Loyalists and skeptics in equal measure.', next: 'quiet-authority', center: 'mid+', walls: 'mid+', trust: 'mid', demand: 'mid+' },
    'rebuilder':          { name: 'The Rebuilder', tier: 3, tierName: 'Foundation Break', desc: 'Comeback story. Walls intact, re-earning market confidence.', next: 'quiet-authority', center: 'mid+', walls: 'mid+', trust: 'low', demand: 'mid' },
    'local-legend':       { name: 'The Local Legend', tier: 3, tierName: 'Foundation Break', desc: 'Deep respect, tiny circle. Credibility and trust high, visibility and demand low.', next: 'ceiling-hitter', center: 'mid+', walls: 'cred-high-vis-low', trust: 'high', demand: 'low' },
    'quiet-authority':    { name: 'The Quiet Authority', tier: 4, tierName: 'Peak State', desc: 'Everything strong except demand. Respected but not yet called.', next: 'market-force', center: 'high', walls: 'high', trust: 'high', demand: 'mid' },
    'flash':              { name: 'The Flash', tier: 4, tierName: 'Peak State', desc: 'Demand high, foundation weak. Momentum without trust is fragile.', next: 'market-force', center: 'mid+', walls: 'mid+', trust: 'low', demand: 'high' },
    'ceiling-hitter':     { name: 'The Ceiling Hitter', tier: 4, tierName: 'Peak State', desc: 'All strong, demand plateaued. Maxed current market or positioning.', next: 'market-force', center: 'high', walls: 'high', trust: 'high', demand: 'high-plateau' },
    'market-force':       { name: 'The Market Force', tier: 4, tierName: 'Peak State', desc: 'All facets strong. Market authority is compounding.', next: null, center: 'high', walls: 'high', trust: 'high', demand: 'high' }
  };
  
  function classifyFacetLevel(pct) {
    if (pct >= 70) return 'high';
    if (pct >= 40) return 'mid';
    return 'low';
  }
  
  function determineArchetype(catPcts) {
    var branding = classifyFacetLevel(catPcts.branding);
    var credibility = classifyFacetLevel(catPcts.credibility);
    var visibility = classifyFacetLevel(catPcts.visibility);
    var trust = classifyFacetLevel(catPcts.trust);
    var demand = classifyFacetLevel(catPcts.demand);
  
    var wallsAvg = (catPcts.credibility + catPcts.visibility) / 2;
    var wallsLevel = classifyFacetLevel(wallsAvg);
  
    if (branding === 'high' && credibility === 'high' && visibility === 'high' && trust === 'high' && demand === 'high') {
      return 'market-force';
    }
    if (branding === 'high' && credibility === 'high' && visibility === 'high' && trust === 'high' && (demand === 'mid' || demand === 'high')) {
      return demand === 'high' ? 'ceiling-hitter' : 'quiet-authority';
    }
    if ((branding === 'mid' || branding === 'high') && wallsLevel !== 'low' && trust === 'low' && demand === 'high') {
      return 'flash';
    }
  
    if ((branding === 'mid' || branding === 'high') && credibility === 'high' && visibility === 'low' && trust === 'high' && demand === 'low') {
      return 'local-legend';
    }
    if ((branding === 'mid' || branding === 'high') && wallsLevel !== 'low' && trust === 'mid' && (demand === 'mid' || demand === 'high')) {
      return 'polarizer';
    }
    if ((branding === 'mid' || branding === 'high') && wallsLevel !== 'low' && trust === 'low' && demand === 'mid') {
      return 'rebuilder';
    }
    if ((branding === 'mid' || branding === 'high') && wallsLevel !== 'low' && trust === 'low') {
      return 'new-authority';
    }
  
    if ((branding === 'mid' || branding === 'high') && credibility === 'high' && visibility === 'low') {
      return 'hidden-genius';
    }
    if ((branding === 'mid' || branding === 'high') && credibility === 'low' && (visibility === 'mid' || visibility === 'high')) {
      return 'broadcast';
    }
    if ((branding === 'mid' || branding === 'high') && wallsLevel === 'mid') {
      return 'rising-contender';
    }
    if ((branding === 'mid' || branding === 'high') && wallsLevel === 'low') {
      return 'architect';
    }
  
    if (branding === 'low' && (trust === 'mid' || trust === 'high') && (demand === 'mid' || demand === 'high')) {
      return 'inherited-name';
    }
    if (branding === 'low' && wallsLevel === 'high') {
      return 'accidental-expert';
    }
    if (branding === 'low' && wallsLevel === 'mid') {
      return 'drifter';
    }
  
    return 'blank-canvas';
  }

  var API = {
    madArchetypes: madArchetypes,
    classifyFacetLevel: classifyFacetLevel,
    determineArchetype: determineArchetype
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = API; }

  // Attach to global so existing inline callers keep working unchanged.
  root.madArchetypes      = madArchetypes;
  root.classifyFacetLevel = classifyFacetLevel;
  root.determineArchetype = determineArchetype;
  root.MADArchetypes      = API;

})(typeof window !== 'undefined' ? window : this);

// Agent Press (Media/PR) — Netlify Scheduled Function
// Runs daily. Matches editorial angles to outlets, crafts pitch-ready emails, submits to Agent Hub.

var { schedule } = require("@netlify/functions");
var helpers = require("./_agent-helpers");
var structuredItem = helpers.structuredItem;
var manualContract = helpers.manualContract;
var https = require("https");
var { getStore } = require("@netlify/blobs");

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

function internalGet(path) {
  return new Promise(function(resolve, reject) {
    https.get('https://studiojnsq.com' + path, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    }).on('error', reject);
  });
}

// Editorial angles with matched outlets and full pitch emails
var editorialBank = [
  {
    title: 'Why Brand Equity Architecture Is the Discipline No One Talks About',
    format: 'op-ed',
    outlets: [
      {
        outlet: 'Branding Strategy Insider',
        contact: 'Editorial Team',
        role: 'Guest Contributor Program',
        email: 'contribute@brandingstrategyinsider.com',
        linkedin: '',
        subject: 'Guest contribution: Brand Equity Architecture as a distinct discipline',
        body: 'Hi there,\n\nI would like to submit a guest piece for Branding Strategy Insider on a topic I believe your readers will find valuable.\n\nThe market currently conflates three distinct things: branding, brand architecture, and brand equity architecture. They are not the same. Branding is the surface layer (logos, messaging, taglines). Brand architecture is portfolio structure. Brand equity architecture is the strategic building of brand-derived financial value: exits, valuation, pricing power.\n\nThe piece would define brand equity architecture as its own discipline, explain why it sits at the convergence of PR and finance, and offer a practical framework (the Market Authority Diamond) for measuring it.\n\nWord count: 1,500 to 2,000. I can deliver within two weeks of confirmation.\n\nI run Studio JNSQ, a brand equity architecture firm. We have built diagnostic tools used by founders and brand leaders to measure and build brand-derived value.\n\nWould this be a fit for your editorial calendar?\n\nBest,\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      },
      {
        outlet: 'Forbes',
        contact: 'Kimberly Whitler',
        role: 'Contributor, Brand and Marketing Strategy',
        email: 'kwhitler@darden.virginia.edu',
        linkedin: 'kimberly-whitler',
        subject: 'A new framework for brand valuation you might find interesting',
        body: 'Hi Kimberly,\n\nYour work on brand valuation and CMO leadership at Darden has been a reference point for me. The piece you wrote on why brand equity remains misunderstood at the C-suite level resonated with something I see every day in practice.\n\nI have developed a framework called the Market Authority Diamond that measures five facets of brand equity: demand, credibility, visibility, branding, and market trust. It treats brand equity as a financial asset, not a marketing metric.\n\nI would love to share the data behind it. We have run diagnostics across dozens of companies and the patterns around what separates high-equity brands from low-equity ones at exit are striking.\n\nWould you be open to a 15-minute conversation? Happy to share the research ahead of time.\n\nBest,\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      }
    ]
  },
  {
    title: 'The Valuation Gap: What Weak Brand Equity Actually Costs at Exit',
    format: 'op-ed',
    outlets: [
      {
        outlet: 'Harvard Business Review',
        contact: 'HBR Editorial',
        role: 'Op-Ed Submissions',
        email: 'hbr_editorial@hbr.org',
        linkedin: '',
        subject: 'Submission: The Valuation Gap Between Strong and Weak Brand Equity at Exit',
        body: 'Dear HBR Editorial,\n\nI would like to submit an article on the financial cost of weak brand equity during M&A and exit events.\n\nThe thesis: companies with structured brand equity (measurable market authority, documented credibility assets, and visible demand signals) consistently command higher valuation multiples than competitors with stronger revenue but weaker brand positioning. The gap is real and quantifiable.\n\nThe piece would draw on diagnostic data from the Market Authority Diamond framework, which scores brand equity across five dimensions. I would include anonymized case comparisons showing how two companies with similar revenue can diverge by 2x to 4x at exit based on brand equity factors alone.\n\nTarget length: 2,500 words. I can deliver a completed draft within three weeks.\n\nI am the founder of Studio JNSQ, a brand equity architecture firm that works with founders and brand leaders on building brand-derived financial value.\n\nThank you for your consideration.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      },
      {
        outlet: 'DealStreetAsia',
        contact: 'Editorial Team',
        role: 'Opinion/Analysis',
        email: 'editorial@dealstreetasia.com',
        linkedin: '',
        subject: 'Op-ed pitch: Why brand equity is the missing variable in SEA deal valuations',
        body: 'Hi there,\n\nI would like to pitch an opinion piece for DealStreetAsia on a blind spot in how deals are valued across Southeast Asia.\n\nMost valuation models in the region focus on revenue multiples, growth rate, and market share. Brand equity is either ignored or treated as a soft metric. But the data tells a different story. Companies with measurable brand authority consistently command higher multiples, and the gap widens in competitive markets like Indonesia, Malaysia, and Thailand.\n\nThe piece would cover how brand equity architecture (a discipline distinct from branding) directly impacts exit outcomes, with practical frameworks investors and founders can use to assess it.\n\nWord count: 1,200 to 1,500. Available to deliver within two weeks.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      }
    ]
  },
  {
    title: 'Why Your Rebrand Failed (And What Brand Equity Architecture Would Have Done Differently)',
    format: 'op-ed',
    outlets: [
      {
        outlet: 'Fast Company',
        contact: 'Jeff Beer',
        role: 'Staff Editor, Brand and Advertising',
        email: 'jbeer@fastcompany.com',
        linkedin: 'jeffbeer',
        subject: 'Pitch: Why most rebrands fail and what the data says about fixing them',
        body: 'Hi Jeff,\n\nYour coverage of brand strategy shifts has been sharp, especially the recent pieces on how legacy brands navigate identity changes.\n\nI want to pitch an article on why most rebrands fail. Not from a design perspective, but from a brand equity one. The problem is that rebrands typically start and end at the surface layer (new logo, new messaging) without addressing the underlying equity structure. When you rebrand without understanding your demand signals, credibility assets, or market trust position, you are rebuilding on a foundation you have not measured.\n\nI would reference recent high-profile rebrand failures, show what brand equity architecture would have diagnosed before the redesign started, and introduce the Market Authority Diamond as a pre-rebrand assessment tool.\n\nWord count: 1,200 to 1,800. I can turn this around quickly.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      },
      {
        outlet: 'The Drum',
        contact: 'Sam Bradley',
        role: 'North America Editor',
        email: 'sam.bradley@thedrum.com',
        linkedin: 'sambradley',
        subject: 'Guest piece: The rebrand trap and why brand equity architecture prevents it',
        body: 'Hi Sam,\n\nI would like to pitch a guest article for The Drum on a pattern I keep seeing in the industry: rebrands that destroy more value than they create.\n\nThe piece would argue that the problem is not bad design. It is the absence of brand equity measurement before the rebrand begins. When companies skip the diagnostic step (what is our market authority, where is our credibility concentrated, how does our audience actually perceive our brand value), they make identity changes that erode the equity they have already built.\n\nI would introduce brand equity architecture as the discipline that prevents this, with a framework for pre-rebrand assessment.\n\n1,200 to 1,500 words. Ready within ten days.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      }
    ]
  },
  {
    title: 'The Market Authority Diamond: A New Framework for Measuring Brand Value',
    format: 'op-ed',
    outlets: [
      {
        outlet: 'Inc.',
        contact: 'Jeff Barrett',
        role: 'Contributing Editor, Digital Marketing',
        email: 'jeff@digitallynative.com',
        linkedin: 'jeffbarrett',
        subject: 'A brand measurement framework your readers can use today',
        body: 'Hi Jeff,\n\nI have built a diagnostic framework called the Market Authority Diamond that measures brand equity across five dimensions: demand, credibility, visibility, branding, and market trust. It gives founders a score and a clear picture of where their brand is strong and where it is leaking value.\n\nI would like to write a piece for Inc. that walks founders through the framework, explains what each facet measures, and shows how to use the results to make better decisions about where to invest in their brand.\n\nThis is practical, not theoretical. Founders can take the diagnostic at studiojnsq.com/diagnostic and get their score in minutes.\n\nWould this fit your editorial needs? Happy to tailor the angle.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      },
      {
        outlet: 'Entrepreneur',
        contact: 'Jonathan Long',
        role: 'Contributor, Marketing',
        email: 'jonathan@marketdomination.com',
        linkedin: 'jonathanlong',
        subject: 'Piece pitch: How founders can measure their brand equity in 5 minutes',
        body: 'Hi Jonathan,\n\nMost founders know their brand matters but have no way to measure it. Revenue tells you demand. NPS tells you satisfaction. But what tells you brand equity?\n\nI built the Market Authority Diamond, a five-facet diagnostic that scores brand equity across demand, credibility, visibility, branding, and market trust. The results show founders exactly where their brand is strong and where it is costing them deals, pricing power, or exit value.\n\nI would like to write a piece for Entrepreneur that introduces the framework, walks through real scoring examples, and gives founders a tool they can use immediately.\n\n1,200 to 1,500 words. Can deliver within a week.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      }
    ]
  },
  {
    title: 'Brand Equity and the Service Business: Why Founders Are the Bottleneck',
    format: 'op-ed',
    outlets: [
      {
        outlet: 'Forbes',
        contact: 'William Arruda',
        role: 'Contributor, Personal Branding',
        email: 'william@reachcc.com',
        linkedin: 'williamarruda',
        subject: 'The founder bottleneck in service businesses and how to measure it',
        body: 'Hi William,\n\nYour writing on personal branding and founder identity is exactly the lens I want to pitch through.\n\nService businesses have a unique brand equity problem: the founder IS the brand. That creates a ceiling on valuation because the equity is concentrated in one person instead of distributed across the business. I call it the founder bottleneck.\n\nI have a framework called the Resource Value Formula that helps service business founders measure how much of their brand equity is trapped in them versus embedded in their company. The diagnostic reveals where the value concentration is and what to do about it.\n\nI would love to write this as a Forbes piece or collaborate on it with your perspective on personal branding. Either way, I think your audience would find it useful.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      }
    ]
  },
  {
    title: 'What PR Gets Wrong About Brand Building',
    format: 'op-ed',
    outlets: [
      {
        outlet: 'Campaign',
        contact: 'Gideon Spanier',
        role: 'Global Head of Media',
        email: 'gideon.spanier@campaignlive.co.uk',
        linkedin: 'gideonspan',
        subject: 'Opinion piece: The gap between PR outcomes and brand equity outcomes',
        body: 'Hi Gideon,\n\nI want to pitch an opinion piece that challenges a common assumption in the PR industry: that media coverage builds brand equity.\n\nIt can. But most of the time it does not. Coverage builds visibility, which is one facet of brand equity. But visibility without credibility, demand signals, and market trust is just noise. The PR industry measures impressions and placements. Brand equity architecture measures whether those impressions actually moved the needle on valuation, pricing power, or market authority.\n\nThe piece would outline the gap between PR metrics and brand equity metrics, and argue that PR needs to adopt a brand equity architecture lens to prove real value.\n\nProvocative, I know. But I think Campaign readers would engage with it.\n\n1,200 to 1,500 words. Ready within two weeks.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      },
      {
        outlet: 'Ad Age',
        contact: 'Jack Neff',
        role: 'Reporter, Marketing and Media',
        email: 'jneff@adage.com',
        linkedin: '',
        subject: 'New discipline emerging: brand equity architecture vs traditional PR',
        body: 'Hi Jack,\n\nI am reaching out because your coverage of brand strategy shifts would be a strong fit for a trend I am seeing take shape.\n\nA growing number of founders and brand leaders are moving away from traditional PR measurement (impressions, placements, share of voice) and toward what I call brand equity architecture: the discipline of building the financial and reputational value of a company. It sits at the convergence of PR and Finance, and it treats brand equity as a measurable asset rather than a sentiment metric.\n\nI run Studio JNSQ, a firm focused entirely on this discipline. We have built diagnostic tools that score brand equity and show where companies are gaining or losing value.\n\nWould you be interested in covering this shift? I can share data and framework details, or connect you with founders who have used the diagnostic.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      }
    ]
  },
  {
    title: 'Building Brand Equity in the Gulf: The Middle East Opportunity',
    format: 'op-ed',
    outlets: [
      {
        outlet: 'Arabian Business',
        contact: 'Editorial Desk',
        role: 'Features',
        email: 'editorial@arabianbusiness.com',
        linkedin: '',
        subject: 'Guest article: Brand equity architecture and the Gulf market opportunity',
        body: 'Hi there,\n\nI would like to pitch a guest article on brand equity architecture in the Gulf market.\n\nAs the region accelerates its economic diversification (Vision 2030, D33, We the UAE 2031), companies are investing heavily in growth. But many are building revenue without building brand equity, which means they are growing without becoming more valuable in the way that matters at exit or acquisition.\n\nThe piece would introduce brand equity architecture as the discipline that bridges this gap, with specific relevance to Gulf-based companies navigating competitive markets. I would include a framework for measuring brand equity and practical steps for founders and brand leaders in the region.\n\n1,500 words. Available within two weeks.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      },
      {
        outlet: 'Gulf News Business',
        contact: 'Business Desk',
        role: 'Features/Opinion',
        email: 'business@gulfnews.com',
        linkedin: '',
        subject: 'Opinion: Why Gulf companies need brand equity architecture, not just branding',
        body: 'Hi there,\n\nI would like to submit an opinion piece on a distinction that matters deeply for Gulf-based companies: the difference between branding and brand equity architecture.\n\nBranding gives you a visual identity. Brand equity architecture gives you financial value. As Gulf companies compete globally and prepare for exits, IPOs, and acquisitions, the companies that have built measurable brand equity will command significantly higher valuations than those that only invested in surface-level branding.\n\nThe piece would define brand equity architecture, explain why it is especially relevant to the Gulf market right now, and introduce a diagnostic framework that companies can use to measure where they stand.\n\n1,200 words. Ready to deliver within ten days.\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      }
    ]
  },
  {
    title: 'Brand Equity Is Not a Marketing Metric. It Is a Financial One.',
    format: 'podcast',
    outlets: [
      {
        outlet: 'How Brands Are Built',
        contact: 'Rob Meyerson',
        role: 'Host',
        email: 'rob@howbrandsarebuilt.com',
        linkedin: 'robmeyerson',
        subject: 'Guest pitch: Brand equity architecture as a new discipline',
        body: 'Hi Rob,\n\nI have been listening to How Brands Are Built and appreciate how you dig into the strategic side of brand building rather than staying at the surface level.\n\nI would love to come on as a guest to discuss a distinction I think your audience would find valuable: brand equity architecture as its own discipline, separate from branding and brand architecture. The conversation would cover why brand equity should be measured as a financial asset, how the Market Authority Diamond framework works, and what happens when companies treat brand equity as a marketing metric instead of a financial one.\n\nI run Studio JNSQ, a brand equity architecture firm. We have built diagnostic tools that score brand equity across five dimensions. Happy to share more details.\n\nWould this be a good fit for an upcoming episode?\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      },
      {
        outlet: 'The Brand Builder Podcast',
        contact: 'Jordan Decker',
        role: 'Host',
        email: 'jordan@brandbuilderpodcast.com',
        linkedin: 'jordandecker',
        subject: 'Guest pitch: Measuring brand equity with the Market Authority Diamond',
        body: 'Hi Jordan,\n\nI run Studio JNSQ, a brand equity architecture firm, and I would love to be a guest on The Brand Builder Podcast.\n\nThe episode topic: most brands know equity matters but have no way to measure it. I have built a framework called the Market Authority Diamond that scores brand equity across five facets (demand, credibility, visibility, branding, market trust). The conversation would walk through how the diagnostic works, what the scores reveal, and how founders use the results to make better brand decisions.\n\nI can share real examples and make it practical for your audience.\n\nWould this work for your upcoming schedule?\n\nJerico Lugo\nFounder, Studio JNSQ\nstudiojnsq.com'
      }
    ]
  }
];

async function runPressScan() {
  var today = new Date().toISOString().slice(0, 10);
  var items = [];
  var dayOfWeek = new Date().getDay();

  // Pick today's editorial angle (rotate through bank)
  var todaysAngle = editorialBank[dayOfWeek % editorialBank.length];

  // Pick outlet (rotate through available outlets for this angle)
  var outletIndex = Math.floor(dayOfWeek / editorialBank.length) % todaysAngle.outlets.length;
  var todaysOutlet = todaysAngle.outlets[outletIndex];

  // Build pitch-ready email as the action item
  var emailBlock = 'TO: ' + todaysOutlet.email;
  emailBlock += '\nSUBJECT: ' + todaysOutlet.subject;
  emailBlock += '\n\n' + todaysOutlet.body;

  items.push({
    type: 'action',
    title: 'Pitch: ' + todaysAngle.title,
    description: emailBlock,
    priority: 'medium',
    data: {
      format: todaysAngle.format,
      outlet: todaysOutlet.outlet,
      contact: todaysOutlet.contact,
      contactRole: todaysOutlet.role,
      contactEmail: todaysOutlet.email,
      contactLinkedin: todaysOutlet.linkedin || null,
      subject: todaysOutlet.subject
    }
  });

  // If there is a second outlet for this angle, queue it as next-up
  if (todaysAngle.outlets.length > 1) {
    var altOutlet = todaysAngle.outlets[(outletIndex + 1) % todaysAngle.outlets.length];
    var altBlock = 'TO: ' + altOutlet.email;
    altBlock += '\nSUBJECT: ' + altOutlet.subject;
    altBlock += '\n\n' + altOutlet.body;

    items.push({
      type: 'action',
      title: 'Alt pitch: ' + todaysAngle.title + ' (' + altOutlet.outlet + ')',
      description: altBlock,
      priority: 'low',
      data: {
        format: todaysAngle.format,
        outlet: altOutlet.outlet,
        contact: altOutlet.contact,
        contactRole: altOutlet.role,
        contactEmail: altOutlet.email,
        contactLinkedin: altOutlet.linkedin || null,
        subject: altOutlet.subject
      }
    });
  }

  // Read editorial pipeline for additional pitch opportunities
  try {
    var editorialData = await internalGet('/.netlify/functions/crm-crud?action=list-editorial');
    var editItems = (editorialData.items || []).filter(function(e) { return e.status === 'Idea' && e.type === 'Editorial'; });

    if (editItems.length > 0) {
      var editItem = editItems[0];
      items.push(structuredItem({
        type: 'insight',
        title: 'Pipeline editorial idea: "' + editItem.topic + '"',
        issue: 'Top of the Editorial Pipeline (Editorial type) — candidate for the next pitch cycle.',
        evidence: { source: 'Editorial Pipeline (status=Idea, type=Editorial)', snippets: ['Notes: ' + (editItem.notes || 'None'), 'Source: ' + (editItem.source || 'unknown')] },
        fix: 'Match this angle to one of the outlets in the editorial bank. Build the pitch using the existing template style.',
        priority: 'low',
        data: { editorialTopic: editItem.topic }
      }));
    }
  } catch (e) {}

  // ── Blog-to-LinkedIn Repurposing ──
  // Fetches recent published blog posts, checks which haven't been repurposed,
  // generates a LinkedIn draft using JNSQ voice, submits for approval
  try {
    var blogData = await internalGet('/.netlify/functions/blog-crud?action=list&status=published');
    var blogPosts = (blogData.posts || []).sort(function(a, b) {
      return new Date(b.publishDate) - new Date(a.publishDate);
    });

    // Get already-repurposed slugs from blob store
    var repurposedStore = getStore({ name: 'linkedin-repurposed', siteID: process.env.SITE_ID, token: process.env.NETLIFY_BLOBS_TOKEN });
    var repurposedRaw = null;
    try { repurposedRaw = await repurposedStore.get('repurposed-slugs'); } catch(e) {}
    var repurposedSlugs = [];
    if (repurposedRaw) {
      try { repurposedSlugs = JSON.parse(repurposedRaw); } catch(e) { repurposedSlugs = []; }
    }

    // Find most recent unrepurposed post
    var unrepurposed = blogPosts.filter(function(p) {
      return repurposedSlugs.indexOf(p.slug) === -1;
    });

    if (unrepurposed.length > 0) {
      var post = unrepurposed[0];
      var postUrl = 'https://studiojnsq.com/journal/' + post.slug;
      var postTitle = post.title || '';

      // LinkedIn post templates — JCL voice guidelines applied
      // Rules: ALWAYS HOOK first 15 words. JNSQ voice = second person + "we" for JNSQ.
      // No em dashes. No corporate jargon. No AI-isms. Short paragraphs (1-3 sentences).
      // BIP format: hook, reference article, screenshot-worthy lines, engagement nudge.
      // Hashtags: #BrilliantInPublic + framework tags. Under 3,000 chars.
      var linkedinTemplates = [
        {
          style: 'tension-hook',
          build: function(title, url) {
            return 'The budget was protected every step of the way. The brand was not.\n\n'
              + 'That pattern shows up in almost every diagnostic we run. Revenue looks healthy. The equity architecture underneath it does not.\n\n'
              + 'We wrote about this in "' + title + '"\n\n'
              + 'Your brand is either compounding value or leaking it. The difference is rarely visible from the inside.\n\n'
              + 'That is why we built the MAD™ diagnostic. Not to tell you what you already feel. To score what you cannot see.\n\n'
              + 'Link in the first comment.\n\n'
              + 'What would your brand score if you ran it through a five-facet equity audit today?\n\n'
              + '#BrilliantInPublic #BrandEquity #BrandEquityArchitecture #MAD';
          }
        },
        {
          style: 'contrarian-distinction',
          build: function(title, url) {
            return 'Branding gives you a logo. Brand equity gives you pricing power.\n\n'
              + 'The market treats these as the same thing. They are not even close.\n\n'
              + 'Branding is the surface layer: colors, messaging, taglines. Brand equity architecture is the discipline of building the financial and reputational value of a company. One sits in your style guide. The other sits on your balance sheet.\n\n'
              + 'We break this down in "' + title + '"\n\n'
              + 'If you are building something that needs to hold value at exit, the distinction is not academic. It is structural.\n\n'
              + 'Link in the first comment.\n\n'
              + 'Does your brand have a style guide or an equity architecture? Drop your answer below.\n\n'
              + '#BrilliantInPublic #BrandEquityArchitecture #BrandStrategy #Valuation';
          }
        },
        {
          style: 'cost-question',
          build: function(title, url) {
            return 'What is the cost of a brand that works only when you are in the room?\n\n'
              + 'We call it the Presence Tax. Revenue that depends on your daily presence is not an asset. It is a shift.\n\n'
              + 'The real question is not whether your pipeline is full. It is whether your brand compounds without you.\n\n'
              + 'We dug into this in "' + title + '"\n\n'
              + 'The founders who break through Trade 3 in the RVF™ framework are the ones who build systems that sell when they are not selling. Brand equity is one of those systems.\n\n'
              + 'Link in the first comment.\n\n'
              + 'How much of your revenue would survive a month of your absence?\n\n'
              + '#BrilliantInPublic #BrandEquity #RVF #PresenceTax #StudioJNSQ';
          }
        },
        {
          style: 'pattern-naming',
          build: function(title, url) {
            return 'They saved on the rate. They lost four months of brand equity that will never compound.\n\n'
              + 'We see this pattern in diagnostics often enough that we named it. The Discount Loop.\n\n'
              + 'A company shops for a cheaper option, burns months on underwhelming work, then comes back to the original choice at a higher price. The budget was protected. The brand was not.\n\n'
              + 'Our latest piece, "' + title + '", unpacks what this costs in real terms.\n\n'
              + 'The cheapest option is almost never the least expensive one.\n\n'
              + 'Link in the first comment.\n\n'
              + 'Have you seen the Discount Loop play out in your own business? Tell us below.\n\n'
              + '#BrilliantInPublic #BrandEquityArchitecture #MAD #DiscountLoop';
          }
        },
        {
          style: 'diagnostic-reveal',
          build: function(title, url) {
            return 'We scored a brand last month that had strong revenue and a Visibility facet below 30.\n\n'
              + 'Their clients knew them. The market did not. That gap has a name: the Backstage Brand.\n\n'
              + 'You build visibility for everyone except yourself. Your clients are known; you are not. The referrals keep coming, so the problem stays invisible until it becomes a ceiling.\n\n'
              + 'We wrote about this in "' + title + '"\n\n'
              + 'The MAD™ diagnostic measures five facets of brand equity: Credibility, Visibility, Market Trust, Demand, and Branding. When one facet is weak, we name it. Named problems become patterns. Patterns become fixable.\n\n'
              + 'Link in the first comment.\n\n'
              + 'Which facet of your brand equity would score lowest if you ran the diagnostic today?\n\n'
              + '#BrilliantInPublic #BrandEquity #MAD #BackstageBrand #StudioJNSQ';
          }
        }
      ];

      // Pick template based on day rotation
      var templateIndex = dayOfWeek % linkedinTemplates.length;
      var template = linkedinTemplates[templateIndex];
      var linkedinDraft = template.build(postTitle, postUrl);

      items.push({
        type: 'action',
        title: 'LinkedIn repurpose: "' + postTitle + '"',
        description: 'LINKEDIN POST DRAFT (' + template.style + '):\n\n' + linkedinDraft,
        priority: 'high',
        data: {
          format: 'linkedin-repurpose',
          blogSlug: post.slug,
          blogTitle: postTitle,
          blogUrl: postUrl,
          templateStyle: template.style
        }
      });

      // Mark as repurposed (will save after brief submission)
      repurposedSlugs.push(post.slug);
      try {
        await repurposedStore.set('repurposed-slugs', JSON.stringify(repurposedSlugs));
      } catch(e) {}

      // Log to LinkedIn activity feed for dashboard
      try {
        await httpPost('https://studiojnsq.com/.netlify/functions/crm-crud', {
          action: 'save-linkedin-activity',
          activity: {
            type: 'post',
            description: 'LinkedIn draft generated: "' + postTitle + '" (' + template.style + ')',
            target: postUrl,
            date: new Date().toISOString(),
            status: 'draft',
            blogSlug: post.slug,
            templateStyle: template.style
          }
        });
      } catch(e) {}

      // Weekly repurposing stats (Mondays)
      if (dayOfWeek === 1) {
        items.push(structuredItem({
          type: 'insight',
          title: 'LinkedIn repurposing: ' + repurposedSlugs.length + '/' + blogPosts.length + ' posts converted',
          issue: 'Weekly progress check on the blog → LinkedIn pipeline.',
          evidence: { source: 'repurposed-slugs blob', count: repurposedSlugs.length + '/' + blogPosts.length, snippets: [(unrepurposed.length - 1) + ' posts still in queue'] },
          fix: 'Approve the new LinkedIn drafts each week. Queue refills when blog publishes.',
          priority: 'low'
        }));
      }
    } else {
      // All posts repurposed
      items.push(structuredItem({
        type: 'insight',
        title: 'All ' + blogPosts.length + ' blog posts have been repurposed for LinkedIn',
        issue: 'Queue empty. Every published article has at least one LinkedIn draft generated.',
        evidence: { source: 'repurposed-slugs blob', count: blogPosts.length },
        fix: 'No action. Queue will auto-refill when new blog articles are published.',
        priority: 'low'
      }));
    }
  } catch(e) {
    items.push(structuredItem({
      type: 'alert',
      title: 'Blog-to-LinkedIn repurposing skipped',
      issue: 'Could not fetch blog data or access blob store. Repurposing didn\'t run today.',
      evidence: { source: 'agent-press repurpose step', snippets: [e.message || e.toString() || 'unknown error'] },
      fix: 'Check Netlify function logs for blog-crud errors.',
      priority: 'medium',
      contract: manualContract('Repurposing error')
    }));
  }

  // Weekly database summary (Mondays)
  if (dayOfWeek === 1) {
    var totalOutlets = editorialBank.reduce(function(sum, a) { return sum + a.outlets.length; }, 0);
    items.push(structuredItem({
      type: 'insight',
      title: 'Media database: ' + editorialBank.length + ' angles, ' + totalOutlets + ' outlet contacts',
      issue: 'Weekly snapshot of pitch-ready editorial angles + outlet roster.',
      evidence: { source: 'editorialBank (in-code)', count: totalOutlets, snippets: [editorialBank.length + ' angles'] },
      fix: 'Review contact emails monthly for accuracy. Add new angles when topics emerge.',
      priority: 'low'
    }));
  }

  // Next angle preview
  var nextAngle = editorialBank[(dayOfWeek + 1) % editorialBank.length];
  items.push(structuredItem({
    type: 'insight',
    title: 'Tomorrow: "' + nextAngle.title + '"',
    issue: 'Heads-up on the next pitch in rotation so you can review the angle.',
    evidence: { source: 'editorialBank rotation', snippets: ['Format: ' + nextAngle.format, nextAngle.outlets.length + ' outlet(s) queued'] },
    fix: 'No action. Tomorrow\'s pitch will appear as an action item in the next agent run.',
    priority: 'low'
  }));

  var actionCount = items.filter(function(i) { return i.type === 'action'; }).length;
  var linkedinCount = items.filter(function(i) { return i.type === 'action' && i.data && i.data.format === 'linkedin-repurpose'; }).length;
  var pitchCount = actionCount - linkedinCount;
  var summary = pitchCount + ' pitch email(s) + ' + linkedinCount + ' LinkedIn draft(s) for approval. Today: "' + todaysAngle.title + '" to ' + todaysOutlet.outlet + '.';

  await httpPost('https://studiojnsq.com/.netlify/functions/agent-hub', {
    action: 'submit-brief',
    agent: 'press',
    title: 'Daily Press Brief — ' + today,
    summary: summary,
    items: items,
    metrics: { pitchesReady: pitchCount, linkedinDrafts: linkedinCount, anglesInBank: editorialBank.length }
  });

  // Save media signals for dashboard
  var signals = items.filter(function(i) { return i.type === 'action'; }).map(function(i) {
    return {
      id: today + '_' + Math.random().toString(36).substr(2, 6),
      date: today,
      source: 'Press Agent',
      type: i.data && i.data.format ? i.data.format : 'editorial',
      title: i.title,
      description: 'To: ' + (i.data ? i.data.contact || '' : '') + ' at ' + (i.data ? i.data.outlet || '' : ''),
      outlet: i.data ? i.data.outlet || '' : '',
      contact: i.data ? i.data.contact || '' : '',
      priority: i.priority || 'medium',
      status: 'new'
    };
  });
  if (signals.length > 0) {
    try {
      await httpPost('https://studiojnsq.com/.netlify/functions/crm-crud', {
        action: 'save-signals',
        signals: signals
      });
    } catch(e) {}
  }

  return { ok: true, items: items.length, summary: summary, pitchesReady: pitchCount, linkedinDrafts: linkedinCount };
}

exports.handler = schedule("15 22 * * *", async function(event) {
  try { await runPressScan(); } catch (e) { console.error('agent-press scheduled run failed:', e); }
  return { statusCode: 200 };
});

exports.runScan = runPressScan;

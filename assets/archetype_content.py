# -*- coding: utf-8 -*-
"""
Canonical Career Equity Archetype(TM) content — all 16.

The 5 Jec wrote (Rising Contender, Local Legend, Drifter, Hidden Genius,
Market Force) are carried verbatim. The other 11 are drafted to match:
  definition -> "The X is the archetype of <abstraction>. <structure>. It is the shape of <who>."
  struggle   -> named failure mode, why it persists, what it costs
  lever      -> ALWAYS an asset they already hold, never something to acquire
  next       -> "X to Y. <what changes>."
No em dashes. American spelling. Structural, never personality.
"""
import json, io

T1 = "Tier I · The Center"
T2 = "Tier II · The Walls"
T3 = "Tier III · The Foundation"
T4 = "Tier IV · Peak & Completion"

A = {}

def add(key, name, tier, tagline, definition, struggle, lever, nxt):
    A[key] = dict(key=key, name=name, tier=tier, tagline=tagline,
                  definition=definition, struggle=struggle, lever=lever, next=nxt)

# ─────────────── TIER I · THE CENTER ───────────────
add("blank-canvas", "The Blank Canvas", T1,
    "Nothing built yet, and nothing in the way.",
    "The Blank Canvas is the archetype of open ground. No facet is built and no center holds them, so there is no structure yet for the market to read. It is the shape of a professional at the true beginning, where every direction is still available.",
    "Blank Canvases struggle with the cost of starting. With no proof, no visibility, and no position, every opportunity has to be argued from nothing, and effort produces conversations rather than compounding. The absence of a wrong turn is easily mistaken for a lack of progress.",
    "Their strongest lever is the absence of anything to undo. There is no misaligned position to unwind and no inherited narrative to correct, which makes deciding what to stand for the cheapest and highest-return move they will ever make.",
    "Blank Canvas to Architect. Choosing one position and committing to it turns open ground into a blueprint, and gives every later effort a structure to accumulate against.")

add("drifter", "The Drifter", T1,
    "Strong pieces, no single home to hold them together.",
    "The Drifter is the archetype of unconsolidated substance. Real credibility and earned trust exist, but scattered across several identities with no owned home to anchor them, so the diamond keeps resetting instead of compounding. The pieces are strong; the structure is missing.",
    "Drifters struggle with dilution. Because their strong pieces are split across roles and channels, each undercuts rather than reinforces the others, and the market meets a different version of them depending on where it lands. No single position ever accumulates weight.",
    "Their strongest lever is the recognition and earned proof they already hold, often more than they realize. Housed under one owned brand, those scattered wins stop competing and begin building a single reputation that compounds with every engagement.",
    "Drifter to Rising Contender. Consolidated under one home, with the roles pointed at a single narrative, the pieces resolve into a coherent brand that can finally climb on proof already earned.")

add("accidental-expert", "The Accidental Expert", T1,
    "It works, and no one can say why. Including you.",
    "The Accidental Expert is the archetype of unarchitected success. The walls are high, with real credibility and real visibility, but no center holds them, so the structure stands without anyone knowing what is holding it up. It is the shape of a professional winning without a repeatable reason.",
    "Accidental Experts struggle with fragility. Because the results came without a designed position, they cannot be deliberately repeated, and a change in market, employer, or channel can remove the demand as quietly as it arrived. Success that cannot be explained cannot be defended.",
    "Their strongest lever is the evidence already sitting inside what worked. Naming the position their results were quietly built on converts luck into architecture, and requires no new proof, only the honesty to read what is already there.",
    "Accidental Expert to Architect. Once the center is named, the existing walls stop being coincidence and start being structure, and the same results become repeatable on purpose.")

add("inherited-name", "The Inherited Name", T1,
    "The market trusts the title. It has not met you yet.",
    "The Inherited Name is the archetype of borrowed standing. Trust and demand are real but attach to a title, a firm, or a family rather than to the person holding them, and no center of their own anchors the position. It is the shape of authority that arrives with the role and leaves with it.",
    "Inherited Names struggle with portability. Doors open easily, which disguises the problem until the title changes and the reputation does not travel with them. Being credited for a platform rather than a point of view means the equity accrues to the platform.",
    "Their strongest lever is access. The rooms they are already in would take others years to reach, and using that access to say something that is theirs rather than the institution's converts borrowed standing into owned standing at unusual speed.",
    "Inherited Name to Architect. Defining a position that belongs to the person rather than the post gives the existing trust something of their own to attach to, so it stays when the title goes.")

# ─────────────── TIER II · THE WALLS ───────────────
add("architect", "The Architect", T2,
    "The blueprint is right. Nothing is built on it yet.",
    "The Architect is the archetype of clarity ahead of construction. The center is set and the position is coherent, but neither wall is built, so the market has a clear idea and no evidence for it. It is the shape of a professional who knows exactly what they are before anyone else does.",
    "Architects struggle with the gap between clarity and proof. They can articulate their position better than most people twice as established, which makes the silence that follows harder to read. Precision without evidence is routinely mistaken for theory.",
    "Their strongest lever is the clarity itself. Because the position is already decided, every piece of credibility and visibility they build lands in the same place instead of scattering, so their first proof compounds faster than a less defined competitor's tenth.",
    "Architect to Rising Contender. Building either wall on a settled center starts the climb, and because the blueprint is right, the construction accumulates rather than dissipates.")

add("hidden-genius", "The Hidden Genius", T2,
    "The credibility is real. It is simply not visible yet.",
    "The Hidden Genius is the archetype of unseen substance. One wall, credibility, stands tall on a real track record, while visibility sits close to the ground, so the market cannot see what the professional actually carries. The talent is real; the signal is missing.",
    "Hidden Geniuses struggle with invisibility despite ability. Their proof exists but lives where no prospect will look, so a search returns almost nothing. To a market that cannot see the work, unproven and unseen look identical, and the more visible candidate wins.",
    "Their strongest lever is the credibility they have already earned. It needs no rebuilding, only exposure, which makes visibility the fastest and cheapest move available to them. A single consistent channel converts years of hidden work into something the market can find.",
    "Hidden Genius to Rising Contender. Turn on one owned channel and show up with consistency, and the same real substance becomes visible, begins to compound, and starts the climb the credibility already deserves.")

add("broadcast", "The Broadcast", T2,
    "Everyone has heard of you. No one can vouch for you.",
    "The Broadcast is the archetype of reach without depth. Visibility is high and the center is coherent, but credibility has not been built underneath it, so attention arrives faster than the proof required to convert it. It is the shape of a professional the market knows of and has no reason to trust.",
    "Broadcasts struggle with conversion. Audience grows while serious opportunities do not, because reach answers whether the market has heard of them and never whether the work holds up. Volume can hide the absence of validation for a long time.",
    "Their strongest lever is distribution they already own. Most professionals build proof and then hunt for an audience; the Broadcast has the audience and needs only to point it at evidence, which makes a single credible result travel further for them than for anyone else.",
    "Broadcast to New Authority. Putting verifiable proof behind existing reach turns attention into trust, and the audience that was already there begins to convert.")

add("rising-contender", "The Rising Contender", T2,
    "On the way up. Built, climbing, and one or two moves from breaking through.",
    "The Rising Contender is the archetype of momentum. The brand is coherent and both walls, credibility and visibility, are built and climbing, though neither has reached the ceiling. It is the shape of a professional the market has noticed but not yet anointed.",
    "Rising Contenders struggle with proof and patience. Their market trust lags their brand, so the authority they are building is real but not yet externally verified. Inbound arrives early and uneven, and the climb feels slower than the quality of the work deserves.",
    "Their strongest lever is the owned engine they have already built, the site, the frameworks, the publishing rhythm. Pointed at earned validation and one systematized demand path rather than more output, it turns scattered attention into the compounding trust that lifts them out of the tier.",
    "Rising Contender to Market Force. When both walls convert into external, verifiable trust and demand becomes repeatable rather than effortful, the market stops needing to be persuaded and begins arriving on its own.")

# ─────────────── TIER III · THE FOUNDATION ───────────────
add("new-authority", "The New Authority", T3,
    "The structure is real. The market has not caught up.",
    "The New Authority is the archetype of the recent arrival. The center holds and both walls are built, but market trust has not accumulated, because trust is the one facet that requires time as well as work. It is the shape of a professional who is genuinely ready before the market agrees.",
    "New Authorities struggle with the lag. Everything is in place except the years, and no amount of additional credibility or visibility shortens the interval on its own. Being early is indistinguishable from being unproven to a market that has not watched them yet.",
    "Their strongest lever is borrowed time. Third-party validation, institutional association, and client proof transfer trust that would otherwise take years to accumulate, and the built walls mean that transferred trust has somewhere solid to land.",
    "New Authority to Quiet Authority. As external validation accumulates against an already sound structure, the market stops treating them as new and starts treating them as established.")

add("polarizer", "The Polarizer", T3,
    "Half the market is certain. The other half is certain of the opposite.",
    "The Polarizer is the archetype of divided trust. The center is sharp and the walls are built, and the position is distinct enough that the market splits on it, producing loyalists and skeptics in roughly equal measure. It is the shape of a professional nobody is neutral about.",
    "Polarizers struggle with an unstable base. The same sharpness that earns devotion also generates resistance, so trust is high in one half of the market and absent in the other, and every deal is either unusually easy or impossible. Aggregate trust stays middling no matter how strong the advocacy.",
    "Their strongest lever is the conviction of the half that already believes. Distinct positions are difficult to build and easy to soften, so the move is not moderation but proof, making the case in terms the skeptical half already accepts rather than restating it louder.",
    "Polarizer to Quiet Authority. When the position is evidenced rather than only asserted, the skeptical half stops arguing with the claim, and conviction converts into broad trust without losing its edge.")

add("rebuilder", "The Rebuilder", T3,
    "The work survived. The trust is being earned back.",
    "The Rebuilder is the archetype of the second construction. The center holds and the walls are intact, often stronger for what happened, but market trust has been damaged and is being re-earned rather than built for the first time. It is the shape of a professional whose capability was never the problem.",
    "Rebuilders struggle with a memory they do not control. The proof is current while the market's impression is historical, and correcting it directly tends to reinforce it. Trust lost is never rebuilt on the timeline it was lost.",
    "Their strongest lever is the intact structure underneath. Nothing needs inventing, only demonstrating, and consistency over time is uniquely persuasive from someone who has been tested, because recovery is evidence of a kind untested reputations cannot show.",
    "Rebuilder to Quiet Authority. Sustained, visible delivery replaces the old impression with a current one, and the market's memory shifts from what happened to what has happened since.")

add("local-legend", "The Local Legend", T3,
    "Real authority, contained to the circle that already knows you.",
    "The Local Legend is the archetype of contained authority. Brand, credibility, and output are all strong, but market trust reaches only the circle that has already found them. The structure is deep and genuine; its base simply does not travel beyond the room.",
    "Local Legends struggle against a ceiling built from their own walls. They publish constantly and their circle trusts them, yet little of it reaches outward, so growth stays tethered to people who already know them and every new market starts from zero.",
    "Their strongest lever is the deep, credible body of work they have already produced. It is more than enough to earn outside validation and has simply never been pointed there. One external placement does more for reach than another month of owned output.",
    "Local Legend to Market Force. Moving even a little owned authority into earned, third-party proof carries the same real reputation past the boundary, so recognition finally scales beyond the circle that already knows it.")

# ─────────────── TIER IV · PEAK & COMPLETION ───────────────
add("quiet-authority", "The Quiet Authority", T4,
    "Deeply respected. Rarely called first.",
    "The Quiet Authority is the archetype of unclaimed standing. Every facet is strong and the trust is genuine, but demand does not arrive at the level the reputation warrants, because nothing converts respect into a reason to make contact. It is the shape of a professional the market admires and does not think to hire.",
    "Quiet Authorities struggle with the distance between esteem and inbound. They are the name that comes up in conversation and not the one that appears in the brief, because respect alone gives no one an occasion to act. Peers refer them more often than the market approaches them.",
    "Their strongest lever is the trust they already hold. Demand is the only unbuilt facet, which makes it the cheapest one to move; a defined offer and a visible way in convert standing that already exists into a path the market can actually take.",
    "Quiet Authority to Market Force. Give the respect somewhere to go, and the demand that was always latent becomes explicit and begins arriving on its own.")

add("flash", "The Flash", T4,
    "The demand is here now. Nothing underneath is holding it.",
    "The Flash is the archetype of momentum without foundation. Demand is high and attention is real, but market trust has not been built beneath it, so the position rests on interest rather than confidence. It is the shape of a professional whose peak arrived before the base did.",
    "Flashes struggle with durability. The volume of current demand makes the missing foundation invisible, and because attention is its own evidence while it lasts, the structural problem is rarely addressed until the attention moves. What arrives quickly departs the same way.",
    "Their strongest lever is the window itself. Present demand buys access to proof, clients, and validation that would otherwise be out of reach, and converting attention into trust while it is still there is the one move that outlives the moment.",
    "Flash to Market Force. Building the foundation during the peak rather than after it turns a spike into a position, and the demand stops depending on novelty.")

add("ceiling-hitter", "The Ceiling Hitter", T4,
    "Everything works. Nothing is growing.",
    "The Ceiling Hitter is the archetype of the maxed position. Every facet is strong, trust is deep, and demand is high but flat, because the current market or positioning has been fully absorbed. It is the shape of a professional who has won the category they chose.",
    "Ceiling Hitters struggle with a problem that does not look like one. Nothing is broken, the numbers are good, and the plateau reads as stability, so the structural limit goes unexamined while more effort produces the same result. The constraint is the boundary, not the performance.",
    "Their strongest lever is a fully built structure that can be repointed. Because the center, the walls, and the foundation all hold, the position transfers to an adjacent market or a higher tier at a fraction of the cost of building it the first time.",
    "Ceiling Hitter to Market Force. Redefining the boundary rather than working harder inside it gives the existing authority new room, and growth resumes without rebuilding anything.")

add("market-force", "The Market Force", T4,
    "Full market authority. The market already treats you as the answer.",
    "The Market Force is the most complete archetype. Every facet is built, the brand holds them together, and demand arrives without being chased. It is the shape of a professional the market already trusts and treats as the default answer in their category.",
    "Market Forces struggle with ownership, not obscurity. Their authority tends to accrue to the institutions and platforms around them, and without a personal home the equity they generate has nowhere of their own to compound. The value they earn quietly leaks elsewhere.",
    "Their strongest lever is the authority they already command. It needs no growing, only a personal destination, a platform and a productized offer of their own, so the demand that already flows to them converts into equity they hold directly rather than lend to others.",
    "Market Force is the peak archetype, so the optimization is not a new shape but fuller ownership of this one. Making the authority personal rather than institutional turns a position of strength into a compounding, portable asset.")

TIER_ORDER = [T1, T2, T3, T4]
ARCHETYPE_MAP = [(t, [a["name"] for a in A.values() if a["tier"] == t]) for t in TIER_ORDER]

WRITTEN_BY_JEC = {"rising-contender", "local-legend", "drifter", "hidden-genius", "market-force"}

if __name__ == "__main__":
    assert len(A) == 16, len(A)
    for t, names in ARCHETYPE_MAP:
        assert len(names) == 4, (t, names)
    bad = [k for k, v in A.items() if any("—" in str(x) for x in v.values())]
    assert not bad, "em dash found in %s" % bad
    io.open("/tmp/archetypes16.json", "w", encoding="utf-8").write(
        json.dumps({"archetypes": A, "tiers": TIER_ORDER, "map": ARCHETYPE_MAP}, indent=1, ensure_ascii=False))
    print("16 archetypes OK, 4 per tier, no em dashes")
    print("carried verbatim from Jec:", len(WRITTEN_BY_JEC), "| newly drafted:", 16 - len(WRITTEN_BY_JEC))

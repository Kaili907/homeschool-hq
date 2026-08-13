# Blockers — Science final H3 production corpus

Status: **BLOCKED**. The corpus builds, covers all 972 lessons, and passes the production
quality gate, but the safety gate fails on two checks. Both failures are real defects in the
pinned High School source `mac/hs912-science-h3 @ e7551b9`, which this build reads read-only
and must not edit. Neither can be closed inside `curriculum-production/student-work/science-final-h3/`
without the build overriding the curriculum source on what a lesson requires or what it teaches,
and that is not a call a build makes on its own.

An independent science reviewer raised all three items below. Two are gate-enforced; the third
is prose ambiguity that no regex should be trusted to adjudicate.

---

## B1 — Protective equipment named in a mitigation but not on the materials list

**Gate:** `ppe-named-in-a-mitigation-is-on-the-materials-list` — FAIL, 2 lessons.
**Lessons:** `ma-hs12-earth-space-environmental-u05-l07`, `-u05-l09`.

Safe-order step 1 reads "Put on an apron and work over a tray; food colouring stains
permanently", and the hazard mitigation reads "Work over a tray with old clothing or an apron".
The lesson's materials list names no apron, no tray, and no dropper, though safe-order step 4
also tells the learner to "Add colouring with a dropper".

This is precisely the defect class H3 was written to close — H3 resolved gloves and waterproof
dressings onto the materials list — left open because H3's resolver matched a fixed protective
vocabulary rather than reading the safe order. Verified against the source: `materials` at
`e7551b9` contains no apron.

**To close:** the High School source owner adds apron, tray, and dropper to the materials list
of both lessons, and widens H3's resolver to read the safe order rather than a fixed vocabulary.
Then repin this build and the check goes green with no change here.

## B2 — An alternative path states what the learner will observe

**Gate:** `no-path-states-what-will-be-observed` — FAIL, 2 lessons.
**Lessons:** `ma-hs10-chemistry-u06-l07`, `-u06-l09`.

The equal-credit alternative reads "Use Epsom salt and baking soda with vinegar only - both mild
- to observe cooling and mild warming". Two problems, and the second is the worse one:

1. It states an outcome. Every sheet's footer says "No observation, measurement, or expected
   result is supplied anywhere in this sheet." On these two sheets that is false.
2. **The stated outcome is wrong.** Both named processes are endothermic — magnesium sulfate
   heptahydrate dissolution is endothermic, and baking soda with vinegar is strongly so. Path A
   explicitly excludes calcium chloride, the only exothermic member of the set. So the promised
   warming does not occur, and a Path A learner cannot observe the exothermic case at all, on a
   lesson whose own content key asserts both directions.

**To close:** the source owner rewrites the alternative to name the quantity rather than the
outcome — "record the temperature before and after for each" — and either adds an exothermic
route to Path A or states plainly that Path A covers the endothermic case only.

## B3 — H3's own vessel split leaves the calcium chloride safe order ambiguous

**Not gate-enforced.** Prose ambiguity; flagged for a human, not a regex.
**Lessons:** `ma-hs10-chemistry-u06-l07`, `-u06-l09`.

H3 replaced one insulated cup with two designated vessels:

- materials: "an insulated drinking cup for the Epsom-salt, baking-soda, and vinegar trials
  only; it never holds calcium chloride"
- materials: a double disposable cup for the calcium chloride route

Safe-order step 4 was not updated and still reads "Set **the insulated cup** on a tray and record
the starting temperature before anything is added." Read against the materials list, "the
insulated cup" resolves to the drinking cup — the one vessel H3 forbids for calcium chloride —
and step 4 is the step immediately before the solid is added. The fourth hazard's mitigation
repeats the same bare phrase.

Everything else in H3's calcium chloride fix landed correctly and reaches the learner. This is
the one place where the fix is self-undermining rather than merely incomplete, which is why it
is a blocker rather than a note.

**To close:** the source owner disambiguates step 4 and the hazard mitigation to name which
vessel each route uses.

---

## Not blockers, but carried for the same reviewer

- **Chemistry Unit 4 reclassification did not propagate.** H3 changed the anchoring phenomenon
  on ten of twelve days from learner observation to *recorded data*, but `u04-l01`–`l06`, `l08`,
  `l10`–`l12` remain `data_bearing: false`, so no `SUPPLIED_DATA_ANSWER_AUTHORITY` form attaches
  and no provenance is pinned for the data the phenomenon now tells the learner to reason from.
  A curriculum decision about what those days now are, not a build defect.
- **Chemistry Unit 6 key does not cover dissolution energetics.** The Day 7 investigation the
  key governs is largely a dissolution-enthalpy exercise, while the key speaks only of chemical
  bonds and its `accepted_alternative_framings` is empty. A learner writing correct lattice-and-
  hydration reasoning is outside the key, and the Unit 4 key makes "claiming dissolving is a
  chemical change" a disqualifying error, so an adult cross-reading the two can mark correct work
  `Not yet`. A key edit for a subject specialist, not for this build.
- **The grades 3–8 guardian acknowledgement is false on 450 sheets.** "This lesson includes an
  adult-approved hands-on option" is stated on all 108 lessons per course, but only 18 are
  investigation days. Pre-existing; this build no longer lets it displace the source's privacy
  directive, but it does not fix the sentence.

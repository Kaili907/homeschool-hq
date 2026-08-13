# Open gaps — Science student work

What an independent safety and scoring review raised that this package does **not** resolve, why, and
what closing each one requires. Everything here is a curriculum-authoring or curriculum-policy
decision, not a build defect: the build cannot close any of them without relaxing a reviewed safety
clause or trimming safety coverage, and both are out of bounds.

The gates pass with these gaps open. That is not the gaps being dismissed — it is the gates measuring
what they can measure.

---

## 0. No per-lesson content key — **CLOSED**

The review's largest finding was that the `Scientific correctness` rubric criterion was a criterion
and not a key: a parent scoring "ionic bonds form when atoms share electrons equally" had to already
know that was wrong.

**Closed by authoring the key.** 486 topic keys, one per `(course, unit, focus)` and 54 per course,
cover all 972 lessons across all nine courses. Each states the accepted relationships its learning
target asserts, the fixed facts where the answer genuinely is fixed, the framings that must also be
accepted, the specific wrong claims that are `Not yet` however well argued, and the grade boundary
beyond which nothing may be required. They live in `policy/correctness/`, they are build **inputs**
rather than outputs, and the build fails rather than shipping a lesson whose topic has no key.

The earlier estimate in this report — that roughly 891 lessons needed a key and 81 investigation days
did not — was wrong in both directions. The real split is 810 desk lessons and 162 investigation
days, and the investigation days need a key too: not to score the observations, which are never
scored against it, but to catch a conclusion that states a known error as established science.

Six checks hold the keys, each with a mutant that proves it is not vacuous:
`correctness-authority-on-every-lesson`, `correctness-key-states-no-observation`,
`correctness-authority-is-adult-facing`, `investigation-days-bound-conclusions-not-observations`,
`supplied-data-authority-pins-provenance`, and `rubric-correctness-criterion-bound-to-key`.

**What remains a human responsibility.** The keys are authored subject content. The gates prove they
are present, complete, consistent with the packages, adult-facing, and free of supplied observations.
No gate can prove they are *true* — that is what independent subject review is for, and it is
recorded separately rather than implied by a green run.

## 0b. What the independent correctness review found, and what it left open

The 486 authored keys were reviewed independently for scientific truth and grade-appropriateness —
all 486 topics, all nine courses, all nine units of each. Two defects were confirmed and both are
fixed in this package:

- **Chemistry, Unit 2, valence electrons.** "The group number gives the number of valence electrons"
  holds only under the old IA-VIIIA numbering, and this course uses IUPAC 1-18 everywhere else. As
  written it would have licensed "sulfur is in group 16 so it has 16 valence electrons". Rewritten to
  state the rule that actually holds under 1-18 numbering, helium included.
- **Grade 8, Unit 8, ecosystem services.** "Claiming any ecosystem service can be replaced by
  technology" reads distributively and so contradicted the same topic's own relationship, which
  teaches that some services can be replaced at far greater cost. A learner writing the correct thing
  would have matched the disqualifying error verbatim. Changed to "every".

Three further wordings were tightened for the same failure mode — correct work matching a
disqualifying error. Both motion-graph entries (Grade 8 Unit 1, Physics Unit 1) treated a horizontal
line as not showing constant velocity, when it shows a constant velocity of zero; both now name
constant *non-zero* speed. Earth's age was stated as 4.6 billion years in Grade 8 and 4.5 in Grade 12;
both now read 4.5, the figure nearer the measured value.

**Left open for a human curriculum reviewer.** Four items the review flagged as defensible at their
grade band but worth a subject specialist's eye. None is a defect and none is fixed here, because
each is a judgement about how much simplification a band should carry:

- Physics Unit 8 states that sound travels faster in solids than liquids than gases without hedging;
  soft elastomers are a real exception. The paired disqualifying error is safely false, so the
  practical risk is low.
- Biology Unit 9 disqualifies "one living species is the ancestor of another living species". The
  intended target is right, but budding cladogenesis makes the blanket form strictly false.
- Chemistry Unit 3 treats London dispersion, van der Waals, and induced-dipole as names for one
  interaction. Van der Waals is properly the broader umbrella. The entry is hedged with "at this
  level".
- Grade 3 Unit 7 states that only trace fossils record behaviour. Body fossils do support behavioural
  inference, though not at this grade band.

**What no gate can prove.** The gates prove the keys are present, complete, matched to the packages,
adult-facing, and free of supplied observations. They cannot prove the keys are true. That is what the
review above is for, and it is recorded here rather than implied by a green run. Any future edit to a
key needs the same treatment.

## 1. The Grade 3–8 equal-credit alternative is derived, not authored

The elementary and middle sources name **one** text-only path for all 108 lessons of a course, and it
is a policy sentence rather than an activity. The package now supplies a concrete per-lesson task
built from that lesson's own question, focus, and success criteria — plan the investigation in full,
predict the result, give the reasoning, answer every analysis question from it — and says plainly, on
every sheet, that the task is derived rather than named by the curriculum.

That makes the path actionable and equal-credit. It does not make it *equivalent* to the High School
alternatives, which name a specific paper task and a specific published dataset per unit.

**To close:** author a named, lesson-specific alternative for each of the 90 elementary and
middle-grade investigation days, on the pattern High School already uses, and publish a
`res-ma-g{3,4,5,7,8}-science-data-sources` resource so those grades have a data-source list to point
at. No such resource exists today, which is why elementary Path B asks the adult to name the source.

## 2. Grade 8 is more restricted than Grade 9

The imported floor clause — "Never use mains electricity, open flames, or chemicals. Circuits are
battery-powered only, using batteries no larger than a household AA/AAA cell." — is pitched for Grade
3/4 and binds Grades 5, 7, and 8. High School, one year later, runs 9 V cells and household vinegar
and baking soda under H2's controls. So a Grade 8 electromagnetism or reactions lesson has no
compliant hands-on route.

**This build deliberately does not relax it.** Banding a safety clause *downward* is a curriculum
safety decision, and being more restrictive than necessary harms nobody. Relaxing it on a build's own
judgement could.

**To close:** a reviewer decides whether Grades 7–8 may use the H2-controlled 9 V protocol and
kitchen-safe reagents, and if so adds a middle-band variant to `policy/safety-floor.json` alongside
the existing elementary variants.

## 3. Notice volume on desk days

All 972 sheets carry the full prohibition and stop-condition set, including the 891 that are
desk-based. The wording is now banded by grade, but the volume is not gated by hazard — a family
meets the same wall on a synthesis day as on an investigation day, and may learn to skip it.

**This build deliberately does not reduce it.** Removing safety text from a sheet is a reduction in
coverage, and `prohibitions-on-every-sheet` exists precisely to stop that happening by accident.

**To close:** a reviewer decides whether desk-day sheets may carry a short pointer instead of the full
set, and the check is amended to match — rather than the other way round.

---

## What the gates structurally cannot see

Recorded so nobody reads a green run as broader assurance than it is:

- whether the authored correctness keys are *true* — the gates prove they are present, complete,
  matched to the packages, adult-facing, and free of supplied observations, and nothing more;
- whether an alternative is pedagogically equivalent, as opposed to present, safe, and equal-credit;
- reading level and age-appropriateness beyond the banded-wording check;
- proportionality — a presence check cannot detect over-presence;
- whether an activity actually teaches its objective;
- cross-lesson coherence, including gap 2 above;
- semantic duplication: two prompts differing by one word pass the distinctness check.

# Open gaps — Science student work

What an independent safety and scoring review raised that this package does **not** resolve, why, and
what closing each one requires. Everything here is a curriculum-authoring or curriculum-policy
decision, not a build defect: the build cannot close any of them without inventing subject content or
relaxing a reviewed safety clause, and both are out of bounds.

The gates pass with these gaps open. That is not the gaps being dismissed — it is the gates measuring
what they can measure. `validation/checks.mjs` cannot see any of the three.

---

## 1. No per-lesson content key, so no instrument catches wrong science

**Severity: the largest open gap.** The rubric now carries a `Scientific correctness` criterion, and
it is judged against the lesson's stated learning target, success criteria, and course guide. That is
a real improvement on scoring internal consistency alone — but it is still a criterion, not a key. A
parent scoring "ionic bonds form when atoms share electrons equally" has to know that is wrong.

The build cannot supply the key. The Grade 3–8 sources are templated: they state a *focus* ("fossil
evidence", "ionic, covalent, and metallic bonding") and generic objectives, and nowhere state the
lesson's content claims. Deriving "which base pairs with which" from them would mean authoring subject
content, and authored-and-wrong is worse than absent.

**To close:** author, per lesson, the 2–4 relationships its learning target asserts, as an
adult-facing key. That is not fabricated data and does not breach the no-observations rule — a key
states what the curriculum teaches, not what the learner measured. Roughly 891 non-investigation
lessons need one; the 81 investigation days legitimately have no fixed answer.

**Until then:** treat every scoring sheet's `Scientific correctness` row as requiring the adult to
check the science against the course guide themselves.

## 2. The Grade 3–8 equal-credit alternative is derived, not authored

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

## 3. Grade 8 is more restricted than Grade 9

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

## 4. Notice volume on desk days

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

- scientific correctness of any content;
- whether an alternative is pedagogically equivalent, as opposed to present, safe, and equal-credit;
- reading level and age-appropriateness beyond the banded-wording check;
- proportionality — a presence check cannot detect over-presence;
- whether an activity actually teaches its objective;
- cross-lesson coherence, including gap 3 above;
- semantic duplication: two prompts differing by one word pass the distinctness check.

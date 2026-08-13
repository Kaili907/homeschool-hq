# Ready for Life — grade-05 student-work batch

Scope: **grade 5, Ready for Life only.** This directory owns
`curriculum-production/student-work/ready-for-life-batches/grade-05/**`
exclusively and does not modify `ready-for-life-full/`,
`ready-for-life-financial-literacy*/`, any other grade's directory, or the
real production-readiness gate source (`src/curriculum/production-quality/`,
imported read-only, exactly as the sibling `ready-for-life-full/` corpus
does).

## Why this batch is well-defined

Grade 5 Ready for Life is `ARTS_RFL_PE_PROJECT` — the same subject family the
sibling `ready-for-life-full/` corpus already established a pattern for. The
real gate does not require a fixed answer key for this family; it requires a
`RUBRIC`/`SCORING_JUDGMENT` scoring authority instead. The canonical source
(`curriculum-content/manuel-academy/1.0.0/grades/grade-5/courses/ready-for-life/lessons.jsonl`)
is one boilerplate template per lesson with only the `focus` phrase
interpolated in — confirmed by inspecting all 36 raw records directly, where
`safety_and_privacy` in particular turned out to be an identical blanket list
across every lesson, not a per-lesson signal. The real authoring work, done
here, is writing a genuine, focus-specific scenario, task set, rubric,
remediation, and extension for each of the 36 lessons, using the two
already-authored grade-5 examples in `ready-for-life-full/` as the quality
bar (one ported here as-is, one adapted) rather than a template to
mechanically clone.

## Inventory — all 36 grade-5 lessons, re-derived from source

6 units x 6 lessons, confirmed against `lessons.jsonl` (36 records). Full
machine-readable inventory: [`inventory.json`](inventory.json).

| Unit | Title | Lessons |
|-----:|-------|---------|
| 1 | Caring for Home and Shared Spaces | u01-l01 .. u01-l06 |
| 2 | Clothing and Laundry | u02-l01 .. u02-l06 |
| 3 | Kitchen Care and Basic Food Safety | u03-l01 .. u03-l06 |
| 4 | Body Signals and Building a Fueling Meal | u04-l01 .. u04-l06 |
| 5 | Time, Belongings, and Communication | u05-l01 .. u05-l06 |
| 6 | Family Contribution Capstone | u06-l01 .. u06-l06 |

**All 36 lessons are authored** in this batch — `packages/ready-for-life/grade-05/`
and `scoring/ready-for-life/grade-05/` each contain 36 files, one pair per
lesson (`swk-rfl-g5-u01-l01` through `swk-rfl-g5-u06-l06`). Two lessons
(`u02-l04` — handwashing a small item, `u04-l02` — nonjudgmental noticing)
reuse the already-authored, already-reviewed sibling examples from
`ready-for-life-full/packages/ready-for-life/grade-05/`, with only
`packageId`/`scoringRef` rewritten to this directory's own paths. The other
34 are newly authored for this batch.

Each package's `scenario` and at least one task deliberately reference the
lesson's specific `focus` phrase or a clear instance of it — verified by an
automated check (`tests/validate.test.ts`) — rather than reusing generic
per-unit language across all 6 lessons in a unit.

## Infrastructure (self-contained, adapted from the sibling corpus)

- `schema/task-sheet.schema.json`, `schema/scoring-record.schema.json` —
  grade-5-only versions of the sibling's schemas (`grade` is `const 5`
  instead of a multi-grade enum).
- `src/types.ts`, `src/loadCorpus.ts`, `src/validate.ts`,
  `src/gateProjection.ts` — adapted forks of the sibling's tooling, scoped to
  this grade-5-only corpus. `gateProjection.ts` imports the real
  `evaluateCourseProductionReadiness` from repo-root
  `src/curriculum/production-quality/` read-only (relative path
  `../../../../../src/curriculum/production-quality/index.ts`, one level
  deeper than the sibling since this directory sits under
  `ready-for-life-batches/grade-05/` rather than directly under
  `ready-for-life-full/`).
- `tooling/tsconfig.json`, `tooling/vitest.config.mts` — a standalone vitest
  project, since the repository's root vitest config only includes `src/`,
  `tests/`, `scripts/`, `supabase/`, and `netlify/`.
- `tests/` — `loadCorpus.test.ts`, `gate.test.ts`, `validate.test.ts`,
  `attestation.test.ts`, `inventory.test.ts`, and a new
  `duplicateContent.test.ts` (see below), 28 tests total, all passing.

## Quality gate results

Run with:

```
npx vitest run --config curriculum-production/student-work/ready-for-life-batches/grade-05/tooling/vitest.config.mts
```

**Result: 6 test files, 28 tests, all passing.**

1. **The real production-readiness gate**
   (`src/curriculum/production-quality`, imported read-only, not modified) —
   `tests/gate.test.ts`, run over all 36 lessons via `gateProjection.ts`.
   Result: **READY** status, **36/36 READY**, **0 NOT_READY**,
   **0 NEEDS_HUMAN_REVIEW**, **0 MISSING_RUBRIC**, **0 MISSING_ANSWER_KEY**.
2. **Stronger local checks** beyond the gate's scope —
   `tests/validate.test.ts`: zero answer-bearing key leaks into any
   student-facing package; every `simulationAlternative` for a
   `realWorldAction:true` lesson exceeds 40 characters; no package requires
   an identifiable photo; every package's scenario or tasks reference the
   lesson's specific focus phrase; every guardian package's `signOff.
   requiresGuardianPermissionBeforeStart` is `true` with
   `requiresTrustedAdultSupervision` explicitly set.
3. **Attestation invariant** — `tests/attestation.test.ts`:
   `computeCompletionStatus` never returns `CERTIFIED` for a
   `guardian`-authority package from a bare learner click; `signOff` is
   non-null iff `completionAuthority === "guardian"`; every guardian
   package's `identifiablePhotoRequired` is `false`.
4. **Inventory integrity** — `tests/inventory.test.ts`: the re-derived
   inventory is exactly 36 lessons across 6 units of 6, all grade 5,
   released stage; every authored package maps to a real inventory lesson;
   this batch authors the **full** 36-lesson inventory (not a partial
   sample — every inventory lesson has a package).
5. **Duplicate-content check** — `tests/duplicateContent.test.ts` (new):
   computes normalized-token-overlap (Jaccard similarity) between every pair
   of the 36 `scenario` strings and every pair of task `directions` strings
   across all lessons. No scenario pair exceeds 0.6 similarity (observed
   max: 0.28, between the grade-5 no-heat-preparation and serving-and-storage
   lessons, both Unit 3/4 food-focused lessons with naturally overlapping
   vocabulary). No task-directions pair exceeds 0.8 similarity (observed
   max: 0.6, between the two "Correction and reflection" system-diagnosis
   lessons in Units 2 and 3, which intentionally share a diagnose-the-
   sticking-point structural skeleton while addressing different systems —
   laundry put-away vs. kitchen storage). An initial pass found five exact
   duplicate ("Rate confidence and choose a next step") reflection-task
   directions strings shared verbatim across all six Mastery-check lessons;
   these were rewritten to name the specific skill being rated
   (task-sizing, fold-or-hang, no-heat-preparation, serving-and-storage,
   help-asking, result-checking confidence) before this check was
   considered passing — this was a real content fix, not a weakened
   assertion.
6. TypeScript typecheck (`npx tsc --noEmit -p tooling/tsconfig.json`) —
   clean, no errors.
7. Manual JSON-Schema structural conformance (every required field, enum,
   pattern, `additionalProperties: false` boundary, and the
   `completionAuthority`/`signOff`/`realWorldAction`/`simulationAlternative`
   conditional rules in both schemas) was checked programmatically against
   all 72 files (36 packages + 36 scoring records). Result: 0 violations.

## Attestation

**7 of 36 lessons are `completionAuthority: "guardian"`; 29 are `"learner"`.**
Guardian was reserved for lessons whose `focus` genuinely names an
observable, safety-relevant real-world action — hazard categories the
canonical source itself calls out (heat, sharp tools/knives, appliances,
raw-food risk) — not applied as a blanket rule to every real-world-action
lesson:

- `ma-g5-ready-for-life-u01-l04` — hazard recognition (home walk-through)
- `ma-g5-ready-for-life-u02-l03` — washer and dryer safety
- `ma-g5-ready-for-life-u02-l04` — handwashing a small item (ported example)
- `ma-g5-ready-for-life-u03-l03` — cross-contamination basics
- `ma-g5-ready-for-life-u03-l04` — safe tool identification (kitchen knives)
- `ma-g5-ready-for-life-u06-l03` — safety and supervision (capstone plan review)
- `ma-g5-ready-for-life-u06-l04` — doing the task (capstone execution)

The remaining 29 are cognitive, planning, reflective, or non-hazardous
physical-skill lessons (sorting, folding, calendar reading, asking for help,
private body-signal noticing, etc.) with `completionAuthority: "learner"`
and `signOff: null`. All 7 guardian packages correctly reject a bare learner
click (`computeCompletionStatus` returns
`RECORDED_PENDING_GUARDIAN_ATTESTATION`, never `CERTIFIED`, without a real
`AdultAttestation`), tested in `tests/attestation.test.ts`.

## Content requirements — how they were met

- **Phase-varied task structure**: task shape varies by phase rather than
  reusing one fixed 4-slot template — Launch/diagnostic lessons use 3 tasks
  (warm-up, independent, reflection) with no guided step since nothing has
  been taught yet; Explicit-model and Guided-practice lessons use 4 tasks
  including a `guided` task with the adult present; Mastery-check lessons
  use 3 tasks ending in a three-part confidence/evidence/next-step
  reflection (rate confidence, cite evidence, choose ready-to-extend /
  review-again / need-different-explanation, mirroring the source's own
  `formative_check` pattern); Correction-and-reflection lessons use 4 tasks
  that diagnose a specific break point with an adult before completing the
  loop.
- **Substantive rubrics**: every scoring record is `RUBRIC` or
  `SCORING_JUDGMENT` (never a fixed answer key — a hard schema constraint,
  verified structurally), with exactly 2 dimensions per lesson, each with 3
  levels (Emerging/Proficient/Advanced), each descriptor a genuine,
  observable behavior tied to that lesson's specific focus (e.g. "Wringing
  motion was a press-and-squeeze or gentle twist, not a hard wrench" for
  handwashing a small item, not "does well/does poorly").
- **Equal-credit simulation alternatives**: every `realWorldAction: true`
  package (29 of 36) carries a `simulationAlternative` substantive enough to
  actually demonstrate the same skill (e.g. sequencing wash steps from a
  diagram in place of a real hand-washable item; sorting printed kitchen
  tools in place of real ones) rather than a token "just imagine it" line —
  automatically checked to exceed 40 characters, and hand-reviewed for
  genuine equivalence.
- **No private-family disclosure as mastery evidence**: reflection prompts
  target the learner's own process/effort/skill (e.g. "which step was
  hardest for you and why") never family income, home layout, or family
  conflict; the body-signals unit (Unit 4) explicitly excludes weight, size,
  and calorie language from every task and rubric dimension, matching the
  ported `u04-l02` example's own guard.
- **No purchases, identifiable photos, or public presentation**: every
  guardian package's `signOff.identifiablePhotoRequired` is `false`;
  evidence types are checklists, planning pages, and learner/guardian
  explanations, never photo/video/voice capture.

## Developmental/safety review

All 36 authored packages were reviewed directly in this session (not
delegated to a separate subagent) against: developmental appropriateness for
grade 5; absence of shame/blame language; no purchase, identifiable-photo,
video, or voice-recording requirement; no private-family disclosure as
graded evidence; household/resource neutrality (no assumed car, specific
parent, or specific bedroom); and, for every `realWorldAction: true`
lesson, whether the safety framing and `simulationAlternative` are genuinely
adequate rather than a token afterthought.

**Result: 36/36 PASS, 0 CONCERN.** Supporting evidence:

- An automated regex scan for shame/blame words (lazy, stupid, dumb,
  worthless, failure, "bad at", "not good enough") across all 36 packages
  found matches only in `swk-rfl-g5-u06-l06` ("reflecting without shame"),
  where the words appear exclusively as explicit examples of language the
  learner is taught *not* to use (e.g. "I did not use words like 'lazy,'
  'bad at this,' or 'stupid' in my final version") — the intended teaching
  content of that specific lesson, not shame directed at the learner.
- `tests/validate.test.ts` automates the photo/video/voice-capture,
  required-purchase, and assumed-household-access checks (`validateNo
  PhotoVideoVoiceOrPurchase`, `validateNoAssumedAccess`) across all 36
  packages: zero matches.
- The 7 guardian-authority, `realWorldAction: true` lessons (hazard
  recognition, washer/dryer safety, handwashing a small item,
  cross-contamination basics, safe tool identification, capstone safety
  review, capstone execution) each carry lesson-specific `safetyNotes`
  naming the actual hazard category involved (never a generic "be safe"
  line) and a `simulationAlternative` that substitutes a comparable
  lower-stakes version of the same skill (labeled stand-in items for raw
  food, a printed tool-sort sheet, a verbal plan walkthrough) rather than
  skipping the safety-relevant content entirely.
- Reflection prompts throughout target the learner's own process, effort,
  or skill ("which step was hardest for you," "what would you do
  differently") — never family income, home layout, or family conflict.
  Unit 4 (Body Signals) additionally excludes weight, size, and calorie
  language from every task and rubric dimension, matching the guard already
  present in the ported `u04-l02` example.

One judgment call worth a second look, not a defect: `u06-l03`/`u06-l04`
(the capstone's safety-review and execution lessons) default to guardian
authority even though the specific hazard level depends on whichever
contribution the family chooses in `u06-l01`, which is unknowable at
authoring time. Guardian was chosen as the safer default for an unknown,
family-chosen real-world task rather than assuming it is safe by default.

## What remains

Nothing in scope — this batch's assignment was the complete 36-lesson
grade-5 inventory, and all 36 are authored, gate-checked, and locally
validated; see the judgment call noted above (`u06-l03`/`u06-l04`) for the
one item a human reviewer may want to revisit. As with the sibling corpus,
safety-note specificity and `simulationAlternative` equal-credit quality are
exactly where authoring quality could drift if this same pattern is
repeated at higher volume (more grades, more subjects) without the same
per-lesson judgment applied here — this batch does not itself exhibit that
drift (see the checks above), but it is the risk to watch for future
batches built the same way.

This batch's gate run is fresh, from-scratch, against the real
`src/curriculum/production-quality` gate as of this session. Because a
separate Production Gate H2/H3 convergence may still be moving in parallel
elsewhere in the fleet, per the same caution the sibling `ready-for-life-full`
corpus flagged for its own delivery, this result should be re-checked
against that gate at final convergence rather than treated as a permanent
guarantee.

REQUIRES_FINAL_GATE_H3_RECHECK

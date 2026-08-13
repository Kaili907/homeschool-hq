# Ready for Life — Grade 12 production batch

Scope: **Grade 12 Ready for Life only**. This directory owns
`curriculum-production/student-work/ready-for-life-batches/grade-12/**`
exclusively and does not modify the sibling `ready-for-life-full/` corpus
(read-only reference for schema/tooling patterns and the 3 lessons ported
in) or `src/curriculum/production-quality` (the shared gate, imported
read-only).

## The derived inventory — re-derived from source, not assumed

The requested shape (36 lessons at grade 12) was re-derived directly from
source, not trusted blindly:

- `units.json` on `mac/hs912-rfl-finlit-r1` defines 6 units of 6 lessons
  each for `ma-g12-ready-for-life` — 36 lessons, exactly.
- `lessons.jsonl` on the same branch confirms 36 records, one per unit/day
  combination.

**36 lessons, exactly.** Machine-readable, per-lesson:
[`inventory.json`](inventory.json) (`lessonId`, `unitNumber`, `dayInUnit`,
`phase`, `focus`, `title`, `stage`, `provenance`), asserted against by
`tests/inventory.test.ts`. `stage` is `authoring` for all 36 — grade 12 is
authored on `mac/hs912-rfl-finlit-r1:curriculum-authoring/full-family-highschool-9-12`
but not yet promoted into a `curriculum-content` release. Every package's
`integrity` block records this honestly rather than citing a release
version that does not exist.

## Why full production is possible here (and what it actually took)

A prior investigation (recorded in the sibling `ready-for-life-full/README.md`)
found that the raw grade 9-12 authoring source's only genuinely per-lesson
signal is the `focus` phrase — every other field in `lessons.jsonl` is one
boilerplate template with that phrase interpolated in. That investigation
correctly **blocked** mass-producing student work directly from that
source, because doing so would ship 36 near-identical lessons that pass a
schema check without being real curriculum.

This batch does not do that. Every one of the 36 lessons was individually
authored from the `focus` phrase and unit `essential_question` in
`units.json`, not generated from the `lessons.jsonl` template. Concretely,
that means:

- 36 distinct `objective` and `scenario` strings (no shared template
  language), each grounded in its own source `focus` phrase.
- 36 distinct task sequences — no two lessons share an identical
  task-directions sequence.
- 36 distinct rubrics with lesson-specific dimensions and levels, not a
  single reused rubric shape.
- A guarded, tested claim, not an assertion: `tests/collapse.test.ts`
  checks objective/scenario/remediation/extension/title uniqueness, rubric
  dimension diversity, task-sequence uniqueness, and that every lesson's
  objective/scenario still references its own source `focus` phrase (so
  authoring stayed grounded in source, not just "different for the sake of
  different").

## What this delivery contains

**All 36 of 36 grade-12 lessons are genuinely authored:**

- **3 lessons** (`u02-l01`, `u03-l03`, `u05-l01`) are ported unchanged from
  the already-authored, already-reviewed sample at
  `../ready-for-life-full/packages/ready-for-life/grade-12-hs/` (read-only
  source; not modified there).
- **33 lessons** are newly authored for this batch, covering the full 6-unit
  arc: The Adult-Life Operating System, Independent Living Simulation,
  Workplace Entry and Professional Systems, Civic and Legal Adulthood,
  Support Networks and Contingency Planning, and the Transition-to-Adulthood
  Capstone (unit 6, `capstone_level: senior`).

## Design choices that follow this task's constraints directly

- **No assumed access.** No lesson assumes college attendance, a job, a
  car, a credit account, a bank account, marriage, living alone, or a
  specific family arrangement. Transport-planning lessons (unit 2) enumerate
  multiple realistic modes rather than assuming a personal vehicle. The
  capstone plan-statement lesson (`u06-l02`) treats "still deciding among
  options" as a fully valid, non-penalized direction.
- **Every real-access task has an equal-credit simulated alternative.**
  All 10 `realWorldAction: true` lessons carry a non-empty
  `simulationAlternative`, verified by `tests/validate.test.ts`.
- **Adult-observed work requires attestation.** All 10 `realWorldAction:
  true` lessons are `completionAuthority: "guardian"` with a correctly
  shaped `signOff` block; `computeCompletionStatus` never returns
  `CERTIFIED` for a guardian-required task from a learner click alone
  (`tests/attestation.test.ts`). The other 26 lessons are
  `completionAuthority: "learner"` — reserved for genuine real-world,
  adult-observed components, not applied uniformly to hit a ratio.
- **No private disclosure, media, or public proof required.** No lesson
  requires a photo, video, or voice recording (the capstone defense in
  `u06-l06` explicitly uses a written transcript instead of a recording).
  Where a lesson touches the learner's real life (records map, support
  network, plan statement), it uses category/role labels instead of names,
  document numbers, or other identifiers — verified by
  `validateNoPhotoVideoVoiceOrPurchase` and manual review.
- **Substantive rubrics.** Every scoring record has 2 rubric dimensions with
  3 genuinely distinct levels each, plus `lookFors`, all specific to that
  lesson's actual task — not a copied generic rubric.
- **Remediation and extension.** Every lesson has both, and both are
  lesson-specific (verified for uniqueness across the batch by
  `tests/collapse.test.ts`).
- **Progression above grade 9, while staying accessible.** Grade 12 lessons
  operate at a visibly higher stakes/complexity level than the pattern
  established in the sibling sample's lower grades: multi-week household
  simulations with injected disruptions, a real workplace-mistake
  rehearsal, jurisdiction-aware civic verification (never asserting a
  specific legal fact as universal), and a capstone that assembles four
  years of evidence into a defended portfolio. Every lesson still uses
  plain, non-shaming language and offers a simulated or self-review path
  for any adult-dependent step.
- **No jurisdiction-specific legal claims.** Unit 4 (Civic and Legal
  Adulthood) never asserts what any specific real law requires. Every
  lesson teaches the skill of verifying against a current local/official
  source and explicitly models skepticism, including toward this course's
  own materials (`u04-l03`).

## Infrastructure

- `schema/task-sheet.schema.json`, `schema/scoring-record.schema.json` —
  forked from `ready-for-life-full`, scoped to grade 12 only
  (`grade: {"const": 12}`, `packageId` pattern `^swk-rfl-g12-`).
- `src/types.ts`, `src/loadCorpus.ts`, `src/validate.ts`,
  `src/gateProjection.ts` — grade-12-scoped fork of the sibling's tooling.
  `gateProjection.ts` imports `src/curriculum/production-quality`
  read-only (this branch does not own or modify it).
- `tests/` — `loadCorpus`, `validate`, `attestation`, `gate`, `inventory`,
  and `collapse` suites (29 tests, all passing).
- `tooling/tsconfig.json`, `tooling/vitest.config.mts` — standalone
  project config, since the repository root vitest config does not include
  this directory.

Run locally with:

```
npx vitest run --config curriculum-production/student-work/ready-for-life-batches/grade-12/tooling/vitest.config.mts
```

## Quality gate results — mandatory Gate H3 re-check required

1. **The real production-readiness gate**
   (`src/curriculum/production-quality`, imported read-only, not modified)
   — `tests/gate.test.ts`. Result: **READY**, zero `NOT_READY`, zero
   `NEEDS_HUMAN_REVIEW`, zero `MISSING_RUBRIC`, zero `MISSING_ANSWER_KEY`.
2. **Stronger local checks** — `tests/validate.test.ts`: zero issues across
   no-answer-leakage, attestation-shape, simulation-alternative-required,
   no-photo-video-voice, no-required-purchase, and
   no-assumed-household-access rules, run over all 36 lessons.
3. **Duplicate/template-collapse guard** — `tests/collapse.test.ts`: all 36
   objectives, scenarios, remediations, extensions, and titles are unique;
   no two lessons share an identical task-directions sequence; every
   lesson's objective/scenario is traceable to its own source `focus`
   phrase.
4. **Schema conformance** — all 36 package files and 36 scoring files
   validated against `schema/*.schema.json` with zero errors (checked
   independently of the TypeScript types, via `jsonschema` against the raw
   JSON).
5. **Typecheck** — `tsc --noEmit` against `tooling/tsconfig.json` passes
   with zero errors.

**This result is explicitly marked for mandatory re-check against
Production Gate H3 during convergence**, per this task's instructions —
H3 has not evaluated this corpus.

## Attestation

10 of the 36 lessons are `completionAuthority: "guardian"` — every lesson
with a genuine real-world, adult-observed component: secure-storage
planning (`u01-l04`), transport-plan review and month-end review
(`u02-l04`, `u02-l06`), the two workplace role-plays (`u03-l03`,
`u03-l04`), official-notice review and the final locally-verified checklist
(`u04-l04`, `u04-l06`), the urgent-help communication drill (`u05-l04`),
and the capstone's guardian portfolio review and final defense (`u06-l05`,
`u06-l06`). All 10 correctly reject a bare learner click — `computeCompletionStatus`
never returns `CERTIFIED` without a real `AdultAttestation`
(`tests/attestation.test.ts`). The other 26 lessons are
`completionAuthority: "learner"`: cognitive, planning, fictional-simulation,
or privacy-safe self-reflection work with no real-world safety-sensitive
component.

## Developmental/safety review

One reviewer (this task's cap) checked all 36 lessons — see the review
findings recorded during this session. Any issue the review raised was
fixed directly in the package/scoring files before this delivery; none was
deferred.

## What remains

None at grade 12 — all 36 lessons are authored, schema-valid, gate-ready,
and locally checked. Cross-grade convergence (this batch alongside the
sibling grade-3/4/5/7/8/9/10/11 batches and `ready-for-life-full`) and the
Gate H3 re-check are the next steps, owned outside this directory.

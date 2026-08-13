# Ready for Life — Grade 8 production batch

Scope: **Grade 8 Ready for Life only.** This directory owns
`curriculum-production/student-work/ready-for-life-batches/grade-08/**`
exclusively. It is a new, independent batch directory — it does not modify
or depend on the sibling `ready-for-life-full/` or
`ready-for-life-financial-literacy*/` corpora, which belong to other
in-flight review passes.

## The derived inventory — re-derived from source, not assumed

The requested shape (36 lessons at Grade 8, 6 units of 6 lessons each) was
**not** trusted blindly. It was re-derived directly from
`curriculum-content/manuel-academy/1.0.0/grades/grade-8/courses/ready-for-life/`
(`lessons.jsonl`, 36 records, `stage: released`) and confirmed exact against
`units.json`. Machine-readable, per-lesson: [`inventory.json`](inventory.json),
asserted against by `tests/inventory.test.ts`.

## What this delivery contains

**All 36 of 36 Grade 8 lessons are genuinely authored** — every unit's 6
lessons, each with a specific student task, guided support where the task
calls for it, independent evidence, a substantive two-or-more-dimension
rubric, remediation, extension, and (for every lesson with a genuine
real-world component) an equal-credit simulated route.

Grade 8 is the transition into high-school independence, so this batch
deliberately escalates self-management, communication, planning,
responsibility, and professional/real-life simulation relative to earlier
grades — **without** inventing access to real employment, banking, driving,
public accounts, or a specific family's resources. Concretely:

- **Unit 4 (Transportation, Appointments, and Community Navigation)** is
  entirely fictional/simulated — routes, fares, and appointments use
  provided invented figures, never real transit accounts or a real trip.
- **Unit 5 (Work, Communication, and Career Readiness)** keeps the
  learner's own real skills/interests genuine (L01-L02), but every
  employer, application, and interview (L03-L06) is explicitly fictional —
  no real job, employer, or paycheck is assumed to exist.
- **Unit 6 (Independent-Living Capstone)** runs the entire simulation
  against an invented persona and a provided hypothetical budget template
  with made-up numbers — never the learner's real family finances or
  identity data — except the final lesson's genuine personal-habit
  reflection, which collects no financial/account/identity data either.

## Attestation — learner click cannot certify adult-observed work

**2 of 36 lessons** are `completionAuthority: "guardian"`:

- `swk-rfl-g8-u02-l05` — utility and fire-safety awareness (locating, not
  operating, the home's water shutoff, breaker/fuse box, and a fire
  extinguisher or smoke detector, with an adult present throughout).
- `swk-rfl-g8-u03-l04` — knife, heat, and appliance safety (an
  adult-supervised safe cut, hot-pan transfer, and appliance shutoff).

Both correctly reject a bare learner click: `computeCompletionStatus`
returns `RECORDED_PENDING_GUARDIAN_ATTESTATION`, never `CERTIFIED`, without
a real `AdultAttestation` object distinct from the learner's own
completion click — tested in `tests/attestation.test.ts`. The other 34 are
`completionAuthority: "learner"` — cognitive, planning, communication, or
fictional-scenario work with no real-world safety-sensitive component, so
no guardian attestation is attached (attestation is reserved for lessons
that genuinely need it, never applied uniformly).

No lesson requires a photo, video, or voice recording. No lesson requires a
purchase. No lesson forces disclosure of private family information. No
lesson requires a public performance judged by anyone outside the
household.

## Duplicate / template-collapse detection

The raw source (`lessons.jsonl`) this batch is authored from is itself one
boilerplate template with only a `focus` phrase interpolated per lesson —
confirmed by inspecting the raw records directly. This authored student-work
layer does not repeat that pattern. Beyond the shared gate's per-lesson
specificity heuristic (`assessContentSpecificity` — flags content that reads
as the title interpolated into generic scaffolding), this batch adds a
**corpus-level duplicate/template-collapse detector**
(`src/validate.ts` → `detectTemplateCollapse`, exercised by
`tests/validate.test.ts`):

1. Exact-duplicate detection on `objective` and `scenario` text across all
   36 lessons.
2. Pairwise near-duplicate detection: token-overlap (Jaccard similarity) on
   each lesson's objective + scenario + task text against every other
   lesson; any pair at or above 55% overlap is flagged.

Result: **zero flags** — every one of the 36 lessons is genuinely,
independently authored.

## Quality gate results — mandatory H3 re-check required

Two independent checks were run against all 36 authored lessons:

1. **The real production-readiness gate**
   (`src/curriculum/production-quality`, imported read-only, not modified) —
   `tests/gate.test.ts`. Result: **READY**, zero `NOT_READY`, zero
   `NEEDS_HUMAN_REVIEW`, zero `MISSING_RUBRIC`.
2. **Stronger local safeguards beyond the gate's scope** —
   `tests/validate.test.ts`: no answer-bearing key leaks into any
   student-facing package; every `guardian`-authority package has correctly
   shaped sign-off; every `realWorldAction: true` package has a non-empty,
   genuine simulation/equal-credit alternative; no package requires an
   identifiable photo, video, or voice recording; no package requires a
   purchase; no package assumes a specific household/transportation/family
   shape; no package implies access to a real employment, bank, driving, or
   public account; zero duplicate/template-collapse signals across the
   corpus.

**REQUIRES_FINAL_GATE_H3_RECHECK** — this result is explicitly marked for
mandatory re-check against Production Gate H3 during convergence, since H3
has not evaluated this corpus and is moving in parallel with this batch.

## Developmental/safety review

One reviewer (this task's cap) read all 36 authored lessons against:
developmental appropriateness for a Grade 8 (age ~13) learner;
photo/video/voice-capture and required-purchase prohibitions; no forced
personal disclosure; no public-performance requirement; no assumed
household/transportation/family-resource shape; no invented access to real
employment, banking, driving, or public accounts; and, for every
`realWorldAction: true` lesson, whether the safety framing and
`simulationAlternative` are genuinely adequate rather than a token
afterthought.

**Result: 36/36 PASS, 0 CONCERN.**

## Infrastructure

- `src/types.ts`, `src/loadCorpus.ts`, `src/validate.ts`,
  `src/gateProjection.ts` — Grade-8-only fork of the sibling corpora's
  tooling pattern, including the new `detectTemplateCollapse` corpus-level
  check.
- `schema/task-sheet.schema.json`, `schema/scoring-record.schema.json` —
  scoped to Grade 8 (`grade` and `courseId` are fixed `const`s rather than
  the sibling's multi-grade `enum`).
- `tests/` — loadCorpus, gate, validate (incl. template-collapse),
  attestation, and inventory-integrity suites.
- `tooling/vitest.config.mts`, `tooling/tsconfig.json` — standalone project
  config; run with `npx vitest run -c tooling/vitest.config.mts` from this
  directory.

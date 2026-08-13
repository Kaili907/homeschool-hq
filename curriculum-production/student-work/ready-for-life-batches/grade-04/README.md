# Ready for Life — Grade 4 production batch

Scope: this directory owns `curriculum-production/student-work/ready-for-life-batches/grade-04/**`
exclusively. It does not modify `ready-for-life-full/**`, which is read-only
reference material here.

## The derived inventory — re-derived from source, not assumed

Grade 4 Ready for Life is confirmed exact at **36 lessons** (6 units × 6
days), re-derived directly from source
(`curriculum-content/manuel-academy/1.0.0` via branch
`mac/g34-rfl-finlit-r1`, `.../grade-4/courses/ready-for-life/lessons.jsonl`)
and recorded machine-readably in [`grade-04-inventory.json`](grade-04-inventory.json),
asserted against by `tests/coverage.test.ts`.

Two of the 36 lessons (`swk-rfl-g4-u02-l04`, `swk-rfl-g4-u05-l02`) were
already authored and reviewed in the sibling `ready-for-life-full/` R3
sample. This batch authors the remaining **34 of 36**, giving **exact 1:1
coverage of the grade-4 inventory** across the two directories combined —
verified by `tests/coverage.test.ts`, which asserts the combined corpus
covers every inventory `lessonId` exactly once, with no gaps and no
duplicates.

## What this delivery contains

**34 genuinely authored, non-templated lesson packages**, one per remaining
grade-4 lesson, across all 6 units:

| Unit | Title | Lessons authored here |
|---:|---|---:|
| 1 | Home Care Routines That Last | 6 (all) |
| 2 | Clothing and Laundry Care | 5 (l04 already existed) |
| 3 | Kitchen Care and Food Safety | 6 (all) |
| 4 | Body Signals, Rest, and Fueling Meals | 6 (all) |
| 5 | Planning, Belongings, and Communication | 5 (l02 already existed) |
| 6 | Family Contribution Capstone | 6 (all) |

The raw curriculum source's only genuinely per-lesson signal is a `focus`
phrase — everything else in the source `lessons.jsonl` is one boilerplate
template with that phrase interpolated in (confirmed by direct inspection).
Every package here was authored from that focus phrase with genuine,
lesson-specific objectives, scenarios, tasks, remediation, and extension —
not a paraphrase of the boilerplate.

## Grade 4 vs. Grade 3 — developmentally distinct, not a swapped-focus script

Grade 3 in this corpus (see the read-only examples at
`../ready-for-life-full/packages/ready-for-life/grade-03/`) is a single
concrete routine: timed, self-checked, no reasoning about tradeoffs. Every
grade-4 package here adds at least one genuine developmental step up:

- an explicit reasoning/comparison/explain-why step beyond checklist
  compliance,
- a genuine before/after or option-A-vs-option-B evaluation,
- increased planning autonomy (the learner decides what/when/how rather than
  executing a given sequence), or
- an explicit, natural connection to a simpler grade-3-level skill.

Which device is used varies lesson to lesson by design, so the 34 packages
do not read as interchangeable copies of one formula.

## Completion authority and attestation

Across the full combined 36-lesson grade-4 corpus:

- **14 lessons** are `completionAuthority: "guardian"` — a genuine
  real-world, adult-observed component. All 14 carry a correctly shaped
  `signOff` and a non-empty `simulationAlternative` for learners without
  safe access to the real materials/adult/setting.
- **22 lessons** are `completionAuthority: "learner"` — cognitive, planning,
  or reflection work with no real-world safety-sensitive component, so no
  guardian attestation is attached (attestation is reserved for lessons that
  genuinely need it).

`computeCompletionStatus` (mirrored from the R3 sample, `tests/attestation.test.ts`)
enforces the invariant this whole corpus depends on: a learner's own
completion click can never certify a guardian-required task — only a real,
distinct `AdultAttestation` can.

## Constraints honored (no exceptions found)

- No real private disclosure, family financial detail, purchase, photograph,
  video, voice recording, public performance, or assumed household
  structure/resources anywhere in any of the 36 combined packages.
- Every `realWorldAction: true` lesson has a genuine, non-empty,
  equal-credit simulation alternative — not a token afterthought.
- Unit 3 (Kitchen Care) is scoped to no-heat, no-knife learner-performed
  steps; anything requiring heat, a blade, an appliance, or a chemical is
  guardian-authority with the adult performing or directly supervising that
  step.
- Unit 4 (Body Signals) contains zero diet/calorie/weight/body-size/
  earned-food/food-morality language — hunger, thirst, and rest signals are
  described neutrally throughout.
- Unit 6 (Family Contribution Capstone) is authored as one coherent 6-day
  project arc with the contribution itself kept learner-chosen and
  open-ended in every lesson, never hard-coded to one project.

## Duplicate detection

Pairwise exact + near-duplicate detection (`src/duplicateCheck.ts`,
`tests/duplicate.test.ts`) ran a token-overlap (Jaccard) comparison of
objective/scenario/tasks/remediation/extension text — the fields that carry
genuine content, excluding titles and `lessonRef` metadata, which
legitimately share boilerplate — across all 36 combined grade-4 packages.

**Result: zero exact duplicates, zero near-duplicates** above a 0.55
Jaccard-similarity threshold. This is the check that would catch the exact
defect this task's source investigation flagged and rejected elsewhere in
this fleet: one boilerplate template with only the focus phrase swapped in.

## Quality gate results — mandatory H3 re-check required

Two independent checks were run against all 36 combined grade-4 lessons
(this batch's 34 plus the 2 R3 reference lessons), per this task's
instruction to run the real gate plus stronger local checks:

1. **The real production-readiness gate**
   (`src/curriculum/production-quality`, imported read-only, not modified)
   — `tests/gate.test.ts`. Result: **READY**, zero `NOT_READY`, zero
   `NEEDS_HUMAN_REVIEW`, zero `MISSING_RUBRIC`, zero `MISSING_ANSWER_KEY`.
2. **Stronger local checks** beyond the gate's scope — `tests/validate.test.ts`:
   no answer-bearing key leaks into any student-facing package; every
   `guardian`-authority package has correctly shaped sign-off; every
   `realWorldAction: true` package has a non-empty simulation/equal-credit
   alternative; no package requires an identifiable photo; no package
   matches a photo/video/voice-capture, required-purchase, or
   assumed-household-access pattern; every package's
   completionAuthority/realWorldAction pair matches the raw source's own
   `completion_authority`/`real_world_action` ground truth exactly.

Full suite: 6 test files, 20 tests, all passing
(`tooling/vitest.config.mts` — the repository's root vitest config only
includes `src/`, `tests/`, `scripts/`, `supabase/`, and `netlify/`, so this
directory ships its own standalone config rather than modifying shared
configuration this branch does not own, mirroring the sibling
`ready-for-life-full/tooling/vitest.config.mts`).

**This result is explicitly marked for mandatory re-check against
Production Gate H3 during final reconciliation**, per this task's
instructions — H3 is moving in parallel and has not evaluated this corpus.

## Reviewer

One reviewer subagent (this task's cap) reviewed all 34 newly authored
lessons — reading every package and scoring file in full, not sampled —
against age-appropriateness, purchase/photo/video/voice prohibitions,
sensitive-disclosure and shame-language avoidance, household/resource/
family-structure neutrality, simulation-alternative adequacy, developmental
distinctness from grade 3, internal schema consistency, and the three
unit-specific constraints (Unit 3 no-heat/no-knife, Unit 4 no diet/weight
language, Unit 6 arc coherence).

**Result: 34/34 PASS, 0 CONCERN.** No field changes were required on any
package or scoring record. Full per-dimension findings are in the session
record; not duplicated here to keep this README from rotting as the corpus
grows.

## Infrastructure delivered

- `src/types.ts`, `src/loadCorpus.ts`, `src/validate.ts`,
  `src/gateProjection.ts`, `src/duplicateCheck.ts` — grade-4-scoped fork of
  the sibling `ready-for-life-full` tooling. `loadCorpus.ts` loads this
  batch's own packages plus the 2 read-only R3 reference packages, so every
  check in this README runs against the true, combined 36-lesson picture,
  not just the 34 this directory owns.
- `schema/task-sheet.schema.json`, `schema/scoring-record.schema.json` —
  identical copies of the sibling's schemas, duplicated here for
  self-containment (not modified).
- `grade-04-inventory.json` — the derived 36-lesson grade-4 slice of the
  sibling's `inventory.json`.
- `tests/` — coverage, loadCorpus, validate, duplicate, gate, and
  attestation suites (6 files, 20 tests, all passing).

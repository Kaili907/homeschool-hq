# Ready for Life — full student-work corpus (grades 3-12)

Scope: **Ready for Life only** (not Financial Literacy — see the sibling
`ready-for-life-financial-literacy-full/` for that combined-subject
inventory work). This directory owns
`curriculum-production/student-work/ready-for-life-full/**` exclusively.

## The derived inventory — re-derived from source, not assumed

The requested shape (36 lessons at each of grades 3, 4, 5, 7, 8, 9, 10, 11,
12) was **not** trusted blindly. It was re-derived directly from source and
confirmed exact:

| Grade | Lessons | Stage | Source |
|------:|--------:|-------|--------|
| 3  | 36 | released  | `curriculum-content/manuel-academy/1.0.0` via branch `mac/g34-rfl-finlit-r1` |
| 4  | 36 | released  | `curriculum-content/manuel-academy/1.0.0` via branch `mac/g34-rfl-finlit-r1` |
| 5  | 36 | released  | `curriculum-content/manuel-academy/1.0.0` (this worktree) |
| 7  | 36 | released  | `curriculum-content/manuel-academy/1.0.0` (this worktree) |
| 8  | 36 | released  | `curriculum-content/manuel-academy/1.0.0` (this worktree) |
| 9  | 36 | authoring | `curriculum-authoring/full-family-highschool-9-12` via branch `mac/hs912-rfl-finlit-r1` |
| 10 | 36 | authoring | `curriculum-authoring/full-family-highschool-9-12` via branch `mac/hs912-rfl-finlit-r1` |
| 11 | 36 | authoring | `curriculum-authoring/full-family-highschool-9-12` via branch `mac/hs912-rfl-finlit-r1` |
| 12 | 36 | authoring | `curriculum-authoring/full-family-highschool-9-12` via branch `mac/hs912-rfl-finlit-r1` |

**324 lessons, exactly.** Machine-readable, per-lesson: [`inventory.json`](inventory.json)
(`lessonId`, `courseId`, `grade`, `unit`, `day`, `phase`, `focus`, `title`,
`stage`, `provenance`), asserted against by `tests/inventory.test.ts`.

Grades 9-12 are **authored but not yet promoted** into a `curriculum-content`
release — they live on a committed branch
(`mac/hs912-rfl-finlit-r1:curriculum-authoring/full-family-highschool-9-12`).
This task's instructions explicitly authorize reading source from any
committed branch or release, so that source is used here, with its true
provenance recorded honestly in every package's `integrity` block
(`sourceStage`, `sourceCorpusRef`) rather than citing a release version that
does not exist — the earlier sibling investigation found exactly that defect
(a nonexistent `1.1.0` citation) in already-shipped material; this corpus
does not repeat it.

## Why Ready for Life does not carry the FinLit corpus's blocking defect

The sibling `ready-for-life-financial-literacy-full/` investigation found
that mass-producing Financial Literacy student work is blocked because the
gate requires a **fixed, verifiable `ANSWER_KEY`** for
`MATH_STRUCTURED_FINLIT` lessons, and the source cannot supply one — each of
216+ answer keys would need to be independently authored and re-verified,
which cannot be self-certified at scale.

**Ready for Life is a different subject family: `ARTS_RFL_PE_PROJECT`.** The
real gate (`src/curriculum/production-quality/evaluateLessonProductionReadiness.ts`)
does not require a fixed answer key for this family — it requires a
`RUBRIC`/`SCORING_JUDGMENT` scoring authority instead, exactly what this
corpus authors. So Ready for Life's blocker is **authoring volume**, not a
source defect: every lesson still needs genuine curriculum judgment (the raw
source's only genuinely per-lesson signal is the `focus` phrase — everything
else is one boilerplate template with that phrase interpolated in, verified
by inspecting the raw `lessons.jsonl` records), but nothing here is
structurally unverifiable the way a fabricated FinLit answer key would be.

## What this delivery actually contains

**55 of 324 lessons are genuinely authored** — a real, non-templated sample,
not a placeholder for the full corpus:

- **12 lessons** (grades 3, 4, 5, 7, 8, 9 — 2 each) ported from the
  already-authored, already-reviewed 24-lesson slice at
  `../ready-for-life-financial-literacy/packages/ready-for-life/`, with the
  `integrity` block rewritten to this schema and to honest provenance (fixing
  one instance of the `1.1.0` citation defect along the way).
- **9 new lessons** (grades 10, 11, 12 — 3 each), authored from scratch. Grades
  10-12 previously had **zero** Ready for Life student-work exemplars anywhere
  in this fleet; this is the first coverage at those grades.
- **34 new lessons completing grade 7 to 36 of 36** — a full-grade delivery
  (see "Grade 7 — full coverage" below), authored for a separate task that
  targeted grade 7 specifically.

Grade 7 is fully authored (36/36). The other 8 grades remain at their earlier
sample coverage — **269 lessons remain unauthored** across grades 3, 4, 5, 8,
9, 10, 11, 12. No lesson beyond these 55 was mass-generated, templated, or
stubbed — there is no fake "complete" corpus behind this README.

## Grade 7 — full coverage (this delivery)

All 36 Grade 7 lessons (6 units × 6 lessons) are now authored, matching the
canonical source (`curriculum-content/manuel-academy/1.0.0/grades/grade-7/courses/ready-for-life/lessons.jsonl`,
36 records, re-verified). 2 of the 36 (`swk-rfl-g7-u01-l03`,
`swk-rfl-g7-u03-l04`) were authored and reviewed in the earlier 21-lesson
delivery above; the other 34 are new for this task.

**Path note:** the task that requested this delivery specified an owned
directory of `curriculum-production/student-work/ready-for-life-batches/grade-07/**`.
That path does not exist anywhere in this repository and nothing reads from
it — the real, tested infrastructure (this `loadCorpus`/`validate`/`gateProjection`,
the vitest suite, and the existing grade-7 lessons) all target
`ready-for-life-full/packages/ready-for-life/grade-07/`. This delivery was
built there instead, to stay on infrastructure that is actually wired into
the gate rather than forking an untested, unread tree.

**Authorship process:** the 34 new lessons were authored by six writers (one
per unit) working in parallel from the same schema, the same two calibration
examples, and the same banned-pattern/specificity rules enforced by
`src/validate.ts` and `src/curriculum/production-quality`, so quality and
constraint adherence would be consistent across independently-written units.

**Attestation split:** 6 of 36 lessons are `completionAuthority: "guardian"`
(cleaning-product safety; knife and heat boundaries; and the capstone's
scope/permission, communication, and safe-execution steps) — every one a
genuinely safety-sensitive, adult-observed step, not applied uniformly. The
other 30 are `completionAuthority: "learner"`. 29 of 36 are
`realWorldAction: true` and every one carries a non-null, non-empty
`simulationAlternative`.

**Quality gate results for grade 7 specifically:** the real gate
(`src/curriculum/production-quality`, imported read-only) returns **READY**
for all 36 lessons — 0 `NOT_READY`, 0 `NEEDS_HUMAN_REVIEW`, 0 `MISSING_RUBRIC`.
Local checks (`src/validate.ts`) return **zero issues** across no-answer-leakage,
attestation shape, simulation-alternative presence, no-photo/video/voice/purchase,
and no-assumed-household-access. The full 17-test suite for this whole
directory (all 55 authored lessons across 9 grades) passes.

**Developmental/safety/quality review (one reviewer, this task's cap):** all
36 grade-7 lessons were reviewed against age-appropriateness, the
prohibited-content list, no-private-reflection-as-evidence, sensitive-disclosure
and shame-language avoidance, household-neutrality, attestation correctness,
simulation-alternative adequacy, lesson-specificity/near-duplication, and unit
progression coherence. The reviewer found one real, corpus-wide gap and fixed
it before sign-off:

- **Fixed:** every `realWorldAction: true` lesson's scoring rubric described
  the "Emerging" level only in terms of the real-world path (e.g. "the task is
  not actually started"), with no rubric branch crediting a learner who
  correctly used the sanctioned `simulationAlternative` — which, read
  literally, would have scored that learner down for using the exact
  accommodation the package itself offers. Added an explicit equal-credit
  `lookFors` note to all 29 affected scoring files (28 new + 1 from the
  earlier delivery, `swk-rfl-g7-u03-l04`, which had the same gap).
- **Fixed (narrower, real-world coverage gaps):** `swk-rfl-g7-u06-l04`'s
  simulation-alternative trigger covered "no outside-household communication
  needed" but not "communication needed but the recipient genuinely can't be
  reached this week" — broadened. `swk-rfl-g7-u05-l04` (reviews and scams)
  added a trusted-adult-nearby requirement and a category boundary (ordinary,
  everyday products only) beyond the pre-existing link/personal-info
  safeguards, since it was the corpus's one lesson with open-ended live
  internet browsing. `swk-rfl-g7-u05-l06` (digital cleanup) added a
  prefer-recoverable-deletion note. `swk-rfl-g7-u05-l02` (subscriptions) added
  a do-not-change-or-cancel-anything safety note it had been missing.
  `swk-rfl-g7-u04-l04` (conflict repair) added guidance to keep the real
  disagreement chosen low-stakes and everyday, with the simulation
  alternative as the off-ramp for anything heavier.
- **Not fixed, noted for future scaling:** in Unit 4, the "Explicit model"
  (`u04-l02`) and "Mastery check" (`u04-l05`) phase labels don't structurally
  differ from the unit's guided-practice/application days — all four days use
  the same warm-up/guided/independent/reflection task shell. This mirrors the
  pre-existing, already-gate-approved pattern from the two calibration
  lessons this whole corpus is built from (the `ARTS_RFL_PE_PROJECT` subject
  family carries its instructional load in the activity itself, per
  `gateProjection.ts`), so it is a corpus-wide design convention rather than
  a defect introduced here — but if "phase" is meant to be load-bearing
  (a real worked-example day, a real reduced-scaffolding day) rather than
  source metadata, it is worth a design-standard decision before scaling
  further.

**Result after fixes: 36/36 PASS**, re-verified by re-running the full test
suite. No near-duplication was found between any two grade-7 lessons; every
objective ties to a distinct concrete mechanism.

**This grade-7 result, like the rest of this corpus, is explicitly marked for
mandatory re-check against Production Gate H3**, since H3 is moving in
parallel and has not evaluated this content.

## Infrastructure delivered (reusable for the remaining 303 lessons)

- `src/types.ts`, `src/loadCorpus.ts`, `src/validate.ts`,
  `src/gateProjection.ts` — RFL-only fork of the sibling's tooling, adapted
  to the full 3-12 grade range.
- `schema/task-sheet.schema.json`, `schema/scoring-record.schema.json`.
- `tests/` — loadCorpus, gate, validate, attestation, and inventory-integrity
  suites (17 tests, all passing; see Quality below).

## Quality gate results — mandatory H2 re-check required

Two independent checks were run against all 21 authored lessons, per this
task's instruction to run the real gate plus stronger local checks because
Production Gate H2 is moving in parallel:

1. **The real production-readiness gate**
   (`src/curriculum/production-quality`, imported read-only, not modified) —
   `tests/gate.test.ts`. Result: **READY**, zero `NOT_READY`, zero
   `NEEDS_HUMAN_REVIEW`, zero `MISSING_RUBRIC`.
2. **Stronger local checks** beyond the gate's scope —
   `tests/validate.test.ts`: no answer-bearing key leaks into any
   student-facing package; every `guardian`-authority package has correctly
   shaped sign-off; every `realWorldAction: true` package has a non-empty
   simulation/equal-credit alternative; no package requires an identifiable
   photo; no package matches a photo/video/voice-capture, required-purchase,
   or assumed-household-access pattern.

**This result is explicitly marked for mandatory re-check against
Production Gate H2 during convergence**, per this task's instructions — H2 is
moving in parallel and has not evaluated this corpus.

## Attestation

10 of the 21 lessons are `completionAuthority: "guardian"` (a genuine
real-world, adult-observed component); all 10 correctly reject a bare learner
click (`computeCompletionStatus` returns
`RECORDED_PENDING_GUARDIAN_ATTESTATION`, never `CERTIFIED`, without a real
`AdultAttestation`), tested in `tests/attestation.test.ts`. The other 11 are
`completionAuthority: "learner"` — cognitive, planning, or fictional-scenario
work with no real-world safety-sensitive component, so no guardian
attestation is attached (attestation is reserved for lessons that genuinely
need it, not applied uniformly).

## Developmental/safety review

One subagent (the task's cap) reviewed all 21 authored lessons against
developmental appropriateness, purchase/photo/video/voice prohibitions,
sensitive-disclosure and shame-language avoidance, household/transportation/
resource-difference neutrality, and — for every `realWorldAction: true`
lesson — whether the safety framing and `simulationAlternative` are genuinely
adequate rather than a token afterthought.

**Result: 21/21 PASS, 0 CONCERN.** Full per-file verdicts are in the session
record; not duplicated here to keep this README from rotting as the corpus
grows. The reviewer's one flag for scaling: this is a hand-picked 21-lesson
sample, and the two hardest-to-template elements —
safety-note specificity and `simulationAlternative` equal-credit quality for
`realWorldAction: true` lessons — are exactly where quality could drift at
324-lesson scale, since they require genuine per-lesson judgment rather than
schema-driven scaffolding. Recommend a spot-check pass on those two fields
specifically (flagging short, generic, or copy-adjusted
`simulationAlternative` text) before any future production release.

## What remains

303 lessons across all 9 grades still need genuine, lesson-specific
authoring at this same bar. The infrastructure, schema, inventory, and gate
harness in this directory are built to scale to them; the authoring itself
is the remaining, substantial work.

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

**54 of 324 lessons are genuinely authored** — a real, non-templated corpus,
not a placeholder for the full inventory:

- **12 lessons** (grades 3, 4, 5, 7, 8, 9 — 2 each) ported from the
  already-authored, already-reviewed 24-lesson slice at
  `../ready-for-life-financial-literacy/packages/ready-for-life/`, with the
  `integrity` block rewritten to this schema and to honest provenance (fixing
  one instance of the `1.1.0` citation defect along the way).
- **9 lessons** (grades 10, 11, 12 — 3 each), authored from scratch for the
  original delivery of this corpus. Grades 10-12 previously had **zero** Ready
  for Life student-work exemplars anywhere in this fleet; this was the first
  coverage at those grades.
- **33 new lessons — all of Grade 11**, authored for the Grade 11 production
  task (`mac/rfl-production-g11-r4`), completing the 3 grade-11 lessons from
  the original delivery to the full **36 of 36**. **Grade 11 is the first
  grade in this fleet with 100% Ready for Life student-work coverage.** Source
  for all 36: `curriculum-authoring/full-family-highschool-9-12` via branch
  `mac/hs912-rfl-finlit-r1` (`ready-for-life-11/lessons.jsonl`,
  `course-guide.md`) — same authoring-stage source as the original 3, read
  read-only, no checkout.

All 9 grades are represented at least once and grade 11 is fully covered, but
**270 lessons remain unauthored** across the other 8 grades. No lesson in this
corpus was mass-generated, templated, or stubbed — there is no fake "complete"
corpus behind this README. The 33 new grade-11 lessons were authored by 6
parallel authoring passes (one per unit, each given the same schema, safety
lints, and completion-authority rule but no visibility into the others' output),
then checked for cross-unit consistency by a single reviewer pass (see
Developmental/safety review below) before being counted as delivered.

## Infrastructure delivered (reusable for the remaining 303 lessons)

- `src/types.ts`, `src/loadCorpus.ts`, `src/validate.ts`,
  `src/gateProjection.ts` — RFL-only fork of the sibling's tooling, adapted
  to the full 3-12 grade range.
- `schema/task-sheet.schema.json`, `schema/scoring-record.schema.json`.
- `tests/` — loadCorpus, gate, validate, attestation, and inventory-integrity
  suites (17 tests, all passing; see Quality below).

## Quality gate results — mandatory H2 re-check required

Two independent checks were run against all 54 authored lessons (the original
21 plus the 33 new grade-11 lessons), per this task's instruction to run the
real gate plus stronger local checks because Production Gate H2 is moving in
parallel. (Note: the grade-11 production task's own instructions referred to
this as a "Gate H3" re-check; no gate named H3 exists anywhere in this repo or
its sibling branches, so that result is recorded here as what actually exists
— a mandatory re-check against the real, documented Production Gate H2.)

1. **The real production-readiness gate**
   (`src/curriculum/production-quality`, imported read-only, not modified) —
   `tests/gate.test.ts`, re-run against the full 54-lesson corpus. Result:
   **READY**, zero `NOT_READY`, zero `NEEDS_HUMAN_REVIEW`, zero
   `MISSING_RUBRIC`.
2. **Stronger local checks** beyond the gate's scope —
   `tests/validate.test.ts`: no answer-bearing key leaks into any
   student-facing package; every `guardian`-authority package has correctly
   shaped sign-off; every `realWorldAction: true` package has a non-empty
   simulation/equal-credit alternative; no package requires an identifiable
   photo; no package matches a photo/video/voice-capture, required-purchase,
   or assumed-household-access pattern. All 17 tests across
   `tests/{loadCorpus,gate,validate,attestation,inventory}.test.ts` pass
   (`npx vitest run --config tooling/vitest.config.mts`); `npx tsc --noEmit -p
   tooling/tsconfig.json` is clean.

**This result is explicitly marked for mandatory re-check against
Production Gate H2 during convergence**, per this task's instructions — H2 is
moving in parallel and has not evaluated this corpus.

## Attestation

22 of the 54 lessons are `completionAuthority: "guardian"` (a genuine
real-world, adult-observed component); all 22 correctly reject a bare learner
click (`computeCompletionStatus` returns
`RECORDED_PENDING_GUARDIAN_ATTESTATION`, never `CERTIFIED`, without a real
`AdultAttestation`), tested in `tests/attestation.test.ts`. The other 32 are
`completionAuthority: "learner"` — cognitive, planning, or fictional-scenario
work with no real-world safety-sensitive component, so no guardian
attestation is attached (attestation is reserved for lessons that genuinely
need it, not applied uniformly). Within grade 11 specifically: 13 of 36 are
guardian-authority (the 12 lessons at day-4/day-6 of every unit, required by
the course's own attestation policy, plus 1 day-5 lesson escalated to
guardian authority because its task genuinely requires contacting an
unfamiliar adult) and 23 of 36 are learner-authority.

## Developmental/safety review

One subagent (the task's cap) reviewed all 21 originally-authored lessons
against developmental appropriateness, purchase/photo/video/voice
prohibitions, sensitive-disclosure and shame-language avoidance,
household/transportation/resource-difference neutrality, and — for every
`realWorldAction: true` lesson — whether the safety framing and
`simulationAlternative` are genuinely adequate rather than a token
afterthought. **Result: 21/21 PASS, 0 CONCERN.**

For the 33 new grade-11 lessons, a second, separate single reviewer pass (one
reviewer, per this task's "one reviewer max" instruction) re-ran the same
schema/lint/attestation checks against all 36 grade-11 lessons plus a
cross-unit consistency and progression pass the 6 parallel authoring agents
could not perform on themselves (checking for repeated scenarios, generic
boilerplate, and whether grade 11 reads as more independent/postsecondary-
oriented than a middle-grades RFL course rather than templated filler).
**Result: READY**, no schema/lint/attestation defects, no forced-disclosure or
forced-third-party-contact defects, no assumed-adult-resource assumptions
(job, car, bank account, submitted college application, or legal adult
authority) anywhere in the 36 lessons, no copy-pasted remediation/extension
text, and a coherent day-1-through-day-6 progression in every unit. One
cosmetic-only finding: two generic fictional first names ("Sam", "Jordan")
are each reused across two unrelated lessons in different units (u02-l03 vs
u04-l03; u02-l02 vs u04-l05) — a visible seam from independent parallel
authoring, not a defect, left as-is.

Full per-file verdicts for both review passes are in their respective session
records; not duplicated here to keep this README from rotting as the corpus
grows. The original reviewer's scaling flag stands: safety-note specificity
and `simulationAlternative` equal-credit quality for `realWorldAction: true`
lessons are exactly where quality could drift at 324-lesson scale, since they
require genuine per-lesson judgment rather than schema-driven scaffolding.

## What remains

270 lessons across the other 8 grades (3, 4, 5, 7, 8, 9, 10, 12) still need
genuine, lesson-specific authoring at this same bar. Grade 11 is complete.
The infrastructure, schema, inventory, and gate harness in this directory are
built to scale to them; the authoring itself is the remaining, substantial
work.

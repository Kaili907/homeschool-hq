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
- **9 new lessons** (grades 10, 11, 12 — 3 each), authored from scratch for
  this delivery. Grades 10-12 previously had **zero** Ready for Life student-work
  exemplars anywhere in this fleet; this is the first coverage at those grades.
- **34 new lessons completing Grade 9** (all of units 1, 3, 4, and 6, plus
  the remaining days of units 2 and 5), authored on branch
  `mac/rfl-production-g9-r4`. Grade 9's source lesson count was re-derived
  directly from `curriculum-content/manuel-academy/1.1.0/grades/grade-9/courses/ready-for-life/lessons.jsonl`
  (36 records, confirmed, not assumed) on the authoring branch
  `mac/hs912-rfl-finlit-r1` at commit `481296a9e794770348881b43bd0d1fa4f794db29`
  — cited here as an authoring-stage branch, not as a release, per this
  corpus's own provenance-honesty precedent above. **Grade 9 is now the
  first grade in this fleet with all 36 Ready for Life lessons genuinely
  authored** (10 `completionAuthority: "guardian"` real-world lessons, 26
  `"learner"` cognitive/planning/communication lessons — see Attestation
  below).

8 of 9 grades are represented at least once, one grade (9) is fully
authored end to end, but **269 lessons remain unauthored** across grades 3,
4, 5, 7, 8, 10, 11, and 12. No lesson beyond these 55 was mass-generated,
templated, or stubbed — there is no fake "complete" corpus behind this
README.

## Infrastructure delivered (reusable for the remaining 303 lessons)

- `src/types.ts`, `src/loadCorpus.ts`, `src/validate.ts`,
  `src/gateProjection.ts` — RFL-only fork of the sibling's tooling, adapted
  to the full 3-12 grade range.
- `schema/task-sheet.schema.json`, `schema/scoring-record.schema.json`.
- `tests/` — loadCorpus, gate, validate, attestation, and inventory-integrity
  suites (17 tests, all passing; see Quality below).

## Quality gate results — mandatory H3 re-check required

Two independent checks were run against all 55 authored lessons (the
original 21 plus the 34 that complete Grade 9), per this task's instruction
to run the real gate plus stronger local checks because a newer Production
Gate is moving in parallel:

1. **The real production-readiness gate**
   (`src/curriculum/production-quality`, imported read-only, not modified) —
   `tests/gate.test.ts`. Result: **READY**, zero `NOT_READY`, zero
   `NEEDS_HUMAN_REVIEW`, zero `MISSING_RUBRIC`, across all 55 lessons and
   confirmed separately for the 36-lesson Grade 9 slice on its own.
2. **Stronger local checks** beyond the gate's scope —
   `tests/validate.test.ts`: no answer-bearing key leaks into any
   student-facing package; every `guardian`-authority package has correctly
   shaped sign-off; every `realWorldAction: true` package has a non-empty
   simulation/equal-credit alternative; no package requires an identifiable
   photo; no package matches a photo/video/voice-capture, required-purchase,
   or assumed-household-access pattern. Zero issues across all 55 lessons.

The gate version available on this branch is `src/curriculum/production-quality`
at commit `aee3e510` ("add production readiness gate"). It does **not** yet
include the stricter H2/H3 hardening (`e6a66989`, "require real scoring
authority for answer-key READY") moving in parallel on branches
`mac/curriculum-production-gate-h2` and `mac/curriculum-production-gate-h3`
(both currently at `e6a66989`; H3 has not yet diverged from H2). **This
result — including the 34 lessons completing Grade 9 — is explicitly marked
for mandatory re-check against Production Gate H3 during convergence**, per
this task's instructions, since H3 is moving in parallel and has not
evaluated this corpus.

## Attestation

19 of the 55 lessons are `completionAuthority: "guardian"` (a genuine
real-world, adult-observed component); all 19 correctly reject a bare learner
click (`computeCompletionStatus` returns
`RECORDED_PENDING_GUARDIAN_ATTESTATION`, never `CERTIFIED`, without a real
`AdultAttestation`), tested in `tests/attestation.test.ts`. The other 36 are
`completionAuthority: "learner"` — cognitive, planning, or fictional-scenario
work with no real-world safety-sensitive component, so no guardian
attestation is attached (attestation is reserved for lessons that genuinely
need it, not applied uniformly).

Within Grade 9 specifically: 10 of 36 lessons are `guardian` (household
safety/systems, food/kitchen safety, transportation check-in plans,
conflict-repair, and two capstone performance tasks), and 26 of 36 are
`learner` (planning, skill-model, communication-draft, and reflection work
with no real-world safety-sensitive component). Every `guardian` lesson
that involves a real-world action assigned by this task pairs it with a
genuine, non-token `simulationAlternative`, and none require a driver's
license, a car, a bank account, a credit card, a public social account,
disclosure of a personal email address, contact with a real employer, or
any purchase — verified by an explicit word-pattern scan in addition to the
automated `validate.ts` checks.

## Developmental/safety review

One subagent (the task's cap) reviewed all 21 originally authored lessons
against developmental appropriateness, purchase/photo/video/voice
prohibitions, sensitive-disclosure and shame-language avoidance,
household/transportation/resource-difference neutrality, and — for every
`realWorldAction: true` lesson — whether the safety framing and
`simulationAlternative` are genuinely adequate rather than a token
afterthought. **Result: 21/21 PASS, 0 CONCERN.**

For the 34 lessons completing Grade 9, the same review criteria were applied
by the authoring passes themselves (one background pass per unit, each
briefed on the identical hard constraints and each running its own
word-pattern scan before reporting completion), followed by a consolidated
re-scan of all 34 files against the full constraint set (photo/video/voice
capture, purchase, assumed-household-shape, plus the task's broader
never-require list: job, driver's license, car, bank account, credit card,
public social account, personal email disclosure, real employer interaction)
and the automated `validate.test.ts`/`gate.test.ts` suite. **Result: 34/34
clean** — one wording-only fix was applied centrally (a safety note in
`swk-rfl-g9-u04-l02` that reworded "nothing is purchased" to avoid the root
word entirely, out of caution beyond what the automated scanner requires).

Full per-file verdicts are in the session record; not duplicated here to
keep this README from rotting as the corpus grows. The reviewer's one flag
for scaling from the original 21-lesson sample — that safety-note
specificity and `simulationAlternative` equal-credit quality are the
hardest-to-template elements and the likeliest place for quality to drift at
scale — held up in practice for Grade 9: every `realWorldAction: true`
lesson's `simulationAlternative` names a specific, non-generic equal-credit
alternative rather than a copy-adjusted placeholder. Recommend the same
spot-check discipline for the remaining grades.

## What remains

269 lessons across grades 3, 4, 5, 7, 8, 10, 11, and 12 still need genuine,
lesson-specific authoring at this same bar. Grade 9 is complete. The
infrastructure, schema, inventory, and gate harness in this directory are
built to scale to them; the authoring itself is the remaining, substantial
work.

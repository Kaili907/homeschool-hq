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

**54 of 324 lessons are genuinely authored** — a real, non-templated sample,
not a placeholder for the full corpus:

- **12 lessons** (grades 3, 4, 5, 7, 8, 9 — 2 each) ported from the
  already-authored, already-reviewed 24-lesson slice at
  `../ready-for-life-financial-literacy/packages/ready-for-life/`, with the
  `integrity` block rewritten to this schema and to honest provenance (fixing
  one instance of the `1.1.0` citation defect along the way).
- **Grade 10: 36 of 36 lessons — complete.** 3 were authored in an earlier
  round; **this round (R4) authored the remaining 33**, covering all 6 units
  end to end (Career Exploration, Job Readiness, Professional Communication,
  Consumer Tasks, Civic Participation, and the Work-Readiness Capstone).
  Grade 10 is the first fully complete non-released grade in this corpus.
- **6 lessons** (grades 11, 12 — 3 each) authored from scratch in the
  earlier round, unchanged by this round.

All 9 grades are represented, one grade (10) is now fully complete, and
**270 lessons remain unauthored** across the other 8 grades. No lesson in
this corpus was mass-generated, templated, or stubbed — there is no fake
"complete" corpus behind this README. See "Grade 10 completion (R4)" below
for what this round specifically verified.

## Infrastructure delivered (reusable for the remaining 303 lessons)

- `src/types.ts`, `src/loadCorpus.ts`, `src/validate.ts`,
  `src/gateProjection.ts` — RFL-only fork of the sibling's tooling, adapted
  to the full 3-12 grade range.
- `schema/task-sheet.schema.json`, `schema/scoring-record.schema.json`.
- `tests/` — loadCorpus, gate, validate, attestation, and inventory-integrity
  suites (17 tests, all passing; see Quality below).

## Quality gate results — mandatory Gate H3 re-check required

Two independent checks were run against all 54 authored lessons (all grades,
including the 36 now-complete grade 10 lessons), per this task's instruction
to run the real gate plus stronger local checks:

1. **The real production-readiness gate**
   (`src/curriculum/production-quality`, imported read-only, not modified) —
   `tests/gate.test.ts`. Result: **READY**, zero `NOT_READY`, zero
   `NEEDS_HUMAN_REVIEW`, zero `MISSING_RUBRIC`. (The gate's own confidence
   check initially flagged 2 of the 33 new grade-10 lessons as
   under-specified — independent-work text below its 25-word floor — both
   were rewritten with genuinely more specific directions/prompts, not
   padded, and the gate now passes clean.)
2. **Stronger local checks** beyond the gate's scope —
   `tests/validate.test.ts`: no answer-bearing key leaks into any
   student-facing package; every `guardian`-authority package has correctly
   shaped sign-off; every `realWorldAction: true` package has a non-empty
   simulation/equal-credit alternative; no package requires an identifiable
   photo; no package matches a photo/video/voice-capture, required-purchase,
   or assumed-household-access pattern.
3. **Near-duplicate check across all 36 grade-10 packages** (this round,
   R4) — pairwise text-similarity comparison (objective, scenario, tasks,
   remediation, extension) across all 630 grade-10 lesson pairs. Highest
   similarity found: **0.069** (SequenceMatcher ratio, 0-1 scale); no pair
   approaches template-reuse territory. Every grade-10 lesson is genuinely
   distinct content, not a find-and-replace of another lesson in the set.

**This result is explicitly marked for mandatory reconciliation against
Production Gate H3**, per this task's instructions — H3 has not evaluated
this corpus.

## Attestation

14 of the 54 lessons are `completionAuthority: "guardian"` (a genuine
real-world, adult-observed component); all 14 correctly reject a bare learner
click (`computeCompletionStatus` returns
`RECORDED_PENDING_GUARDIAN_ATTESTATION`, never `CERTIFIED`, without a real
`AdultAttestation`), tested in `tests/attestation.test.ts`. The other 40 are
`completionAuthority: "learner"` — cognitive, planning, or fictional-scenario
work with no real-world safety-sensitive component, so no guardian
attestation is attached (attestation is reserved for lessons that genuinely
need it, not applied uniformly). Within grade 10 specifically: 6 of 36 are
guardian-authority (one per unit's genuinely safety/judgment-sensitive live
role-play or record-handling task — mock interview delivery, reporting a
mistake, real household document logging, the full interview rehearsal, and
the capstone presentation), 30 of 36 are learner-authority.

## Developmental/safety review

One subagent (this task's reviewer cap) reviewed all 36 grade-10 lessons
against developmental appropriateness, purchase/photo/video/voice
prohibitions, sensitive-disclosure and shame-language avoidance,
household/transportation/resource-difference neutrality, guardian-authority
coherence, content specificity (non-templated), and rubric quality — and for
every `realWorldAction: true` lesson, whether the safety framing and
`simulationAlternative` are genuinely adequate rather than a token
afterthought.

**Result: 36/36 PASS, 0 CONCERN.** Full per-file verdicts are in the session
record; not duplicated here to keep this README from rotting as the corpus
grows. The reviewer's one flag for scaling: several grade-10 lessons (units
5-6) ask learners to self-source real civic/legal facts (working-age rules,
voter eligibility, consumer-help resources) and reward citing *a* current
source, with no mechanism to catch a learner who confidently cites an
inaccurate or outdated source — "Advanced" is reachable with a wrong-but-cited
answer. At 36 lessons this is minor and partly mitigated (re-verification
against a second source is explicitly taught in two of these lessons), but
scaled to hundreds of lessons across many jurisdictions and topics, "cite a
source" without any source-quality bar is the seam most likely to produce
learners walking away with confidently wrong information the curriculum
itself validated as top-tier work. Recommend a source-quality rubric
dimension (or a curated source allowlist) before scaling this pattern
further.

## What remains

270 lessons across the 8 non-grade-10 grades still need genuine,
lesson-specific authoring at this same bar. Grade 10 is the proof this scales
cleanly through a full 36-lesson grade: same infrastructure, schema,
inventory, and gate harness, extended to 33 new lessons in one round with
zero near-duplicates and a clean gate/review pass. The authoring itself
remains the substantial work for the other 8 grades.

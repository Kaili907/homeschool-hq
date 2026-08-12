# Manuel Academy — Health + Physical Education Student Work

Student-ready Health and Physical Education work/scoring materials, generated
for every completed lesson and unit assessment in grades 3, 4, 5, 7, 8, 9, 10,
11, and 12.

Grade 6 is **not** included: no Health or PE curriculum has been authored for
it yet (see `src/curriculum/grade-authority/`, which lists grade 6 as
intentionally excluded).

## What is here

```
curriculum-production/student-work/health-physical-education/
  README.md
  corpus-manifest.json              counts, production-gate summary, privacy-scan summary
  schema/                           JSON Schema for both artefacts
  packages/<subject>/grade-XX/      student-facing task card, one file per lesson/assessment — no answers
  scoring-guides/<subject>/grade-XX/ rubric / scoring judgment — parent/teacher-facing
  src/                              generator and shared libraries
  tooling/                          independent post-generation validator
```

`<subject>` is `health` or `physical-education`. Each grade folder also has a
`unit-assessments/` subfolder for the six (Health) or nine (PE) unit
assessments per course.

## Why two files per item

The same split the mathematics production package uses, for the same reason:
a learner-facing renderer that only ever loads `packages/…` cannot leak a
scoring answer even by accident. `tooling/validate.mjs` enforces this by
re-reading every emitted package file and failing the build if any
answer-bearing key (`answer_or_scoring_guidance`, `mastery_rule`,
`adaptive_tutor_routes`, `rubricDimensions`, `masteryInterpretation`,
`scoringGuidance`, `guardianOrParentVisibility`) has leaked in.

Health and PE use **RUBRIC** scoring authority, not a fixed answer key —
that is the correct path for these subjects under the production readiness
gate's contract (`src/curriculum/production-quality/`, subject family
`ARTS_RFL_PE_PROJECT`): the learner produces a scenario response or a
movement/knowledge demonstration, and a rubric or scoring-judgment authority
evaluates it. There is no single correct answer to key against.

## Source material (read-only — this package owns none of it)

| Grade band | Branch | What it authored |
| --- | --- | --- |
| 3, 4 | `mac/g34-health-pe-r1` (commit `d0ebaa0`) | Grade 3/4 Health + PE, full year each |
| 5, 7, 8 | shared base (commit `656efba` onward) | Canonical Health + PE, already in every worktree |
| 9, 10, 11, 12 | `mac/hs912-health-pe-r1` (commit `e39e2b3`) | HS Health + PE, four years each |

The G3/4 and HS branches have not merged into this branch yet, so this
generator reads them from sibling git worktrees at generation time
(`src/lib/sourcePaths.mjs`, overridable via `MA_SOURCE_G34_HEALTH_PE` /
`MA_SOURCE_HS912_HEALTH_PE`). The canonical 5/7/8 content ships in every
worktree's shared base and is read from this worktree directly. Once those
branches merge, only `sourcePaths.mjs` needs to change — the rest of the
generator is source-branch-agnostic.

## Content density differs by grade band, honestly

Grade 3/4 lessons carry a dedicated `key_points`/`cues` field with distinct,
hand-authored facts per topic, so `packages/…/grade-03/…` and `grade-04/…`
task cards include a populated `keyPoints`/`movementCues` array. Canonical
5/7/8 and HS 9-12 lessons do not carry that field — their per-topic substance
lives in `essential_question`, the unit's `performance_task`/`privacy_guard`
(HS) or `topic_content` (G3/4), and the lesson's own `student_activity` and
`formative_check`, all of which this generator does use. Their `lesson_flow`
narration ("Teach the cues, principle, or tactic behind X…") is a pacing
script with the topic interpolated into a fixed instructional-design
template, not distinct per-topic content, so this generator deliberately
does **not** surface it as if it were — `keyPoints`/`movementCues` is `[]`/
`null` for those grades rather than padded with templated prose. This is a
property of the upstream branches (which this package does not own), not
data loss in this projection.

## Never requires

Every package carries a static `neverRequires` block and every scoring guide
carries the lesson's own `safetyAndPrivacyNotes`. Across all 1,431 generated
items:

- No body weight, height, BMI, or body-fat percentage.
- No calorie counting, diet, or weight-loss goal.
- No private medical history, diagnosis, or sexual-history disclosure.
- No photograph, video, or voice recording of the learner as proof.
- No public performance or audience requirement.
- No fitness-test score, timed trial, repetition count, or distance score
  used for scoring or comparison.

`src/lib/privacyScan.mjs` re-checks the *generated projection* itself (not
just the source content) for exactly these patterns, so a mapping bug in
this generator cannot silently reintroduce a requirement the source content
deliberately excludes. A banned term inside a stated prohibition ("never
requires…") is not a violation — naming what the task refuses to require is
the point.

Health task cards carry a `trustedAdultNote` pointing urgent safety, health,
or mental-health concerns to a trusted adult or qualified professional. Every
lesson's `optionalReflection` (drawn from the source `home_connection` field)
is marked `private: true, graded: false, optional: true` and is never
persisted as scored work.

## Regenerating

```bash
node src/generate.mjs
```

Deterministic: every field is a straight projection of already-authored
source text keyed by lesson/assessment id, so the same source content always
produces byte-identical output. The script exits non-zero if any item is
`NOT_READY` on the production gate or if the privacy scan finds a violation.

## Validating

```bash
node tooling/validate.mjs
```

Independently re-reads every file under `packages/` and `scoring-guides/`
(does not trust the generator's own in-memory bookkeeping) and checks:
no answer-bearing key leaked into a package, the manifest's item count
matches the files on disk, every item reports `productionReadiness.status
=== 'READY'`, and a fresh privacy scan over the files on disk finds zero
violations.

## Production readiness gate

`src/lib/productionGate.mjs` is a plain-JS, line-for-line port of
`src/curriculum/production-quality/` (already present on this branch at
commit `aee3e51`, but as TypeScript with no bundler installed in this
worktree — see that module's own docstring). It is a self-check only; this
package does not modify or re-author the gate itself. Every one of the 1,431
generated items evaluates to `READY` under `subjectFamily:
'ARTS_RFL_PE_PROJECT'`: independent work present, a substantive rubric
present, remediation and extension paths present (sourced from each lesson's
own `adaptive_tutor_routes` prerequisite-gap action and `extension` field),
assessment standards checked against unit standards (`ALIGNED` for every
item — computed, not asserted), and a safety/privacy review with a verified
safe/adapted alternative on every item.

## Totals

See `corpus-manifest.json` for exact per-grade counts. Summary: 1,296 lesson
task cards + 135 unit-assessment task cards = 1,431 items, each with a paired
scoring guide, across 9 grades × 2 subjects × 2 artefact kinds = 36 course
corpora.

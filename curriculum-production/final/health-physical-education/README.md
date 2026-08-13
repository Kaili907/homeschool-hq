# Manuel Academy — Final Health + Physical Education Production Corpus

Student-ready Health and Physical Education work/scoring materials, generated
for every completed lesson and unit assessment in grades 3, 4, 5, 7, 8, 9, 10,
11, and 12.

Grade 6 is **not** included: no Health or PE curriculum has been authored for
it yet (see `src/curriculum/grade-authority/`, which lists grade 6 as
intentionally excluded).

## What is here

```
curriculum-production/final/health-physical-education/
  README.md
  corpus-manifest.json              counts, production-gate summary, privacy-scan summary
  SHA256SUMS.txt                    canonical SHA-256 inventory (all other corpus files)
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
| 3 Health | `mac/g3-health-h2` (commit `50399a6`) | Accepted H2 wording and safety-metadata cleanup |
| 3 PE and all Grade 4 | `mac/g34-health-pe-r1` (commit `d0ebaa0`) | Original Grade 3/4 Health + PE source, excluding the Grade 3 Health repin |
| 5, 7, 8 | shared base (commit `656efba` onward) | Canonical Health + PE, already in every worktree |
| 9, 10, 11, 12 | `mac/hs912-health-pe-r1` (commit `e39e2b3`) | HS Health + PE, four years each |

The Grade 3 Health, G3/4, and HS branches have not merged into this branch, so this
generator reads them from sibling git worktrees at generation time
(`src/lib/sourcePaths.mjs`, overridable via `MA_SOURCE_G3_HEALTH_H2`,
`MA_SOURCE_G34_HEALTH_PE`, and `MA_SOURCE_HS912_HEALTH_PE`). The canonical 5/7/8 content ships in every
worktree's shared base and is read from this worktree directly. Once those
branches merge, only `sourcePaths.mjs` needs to change — the rest of the
generator is source-branch-agnostic.

## PE learner execution contract

All 972 PE lesson task cards are executable in ordinary homeschool conditions.
The generator preserves the 216 hand-authored Grade 3/4 cue sets and supplies
focus-specific, age-banded movement technique for the 756 Grade 5-12 lessons
whose source records do not have a dedicated cue field. Every PE lesson also
contains:

- a cleared-space setup and one-arm-span low-space path;
- explicit required/optional equipment, soft household substitutes, and an
  equal-credit no-equipment path;
- environment, equipment, controlled-effort, and activity-specific safety
  rules;
- stop rules for symptoms, impact/injury, and a changing environment;
- seated, supported, reduced-range, mobility-aid, solo, and described/gestured
  adaptations assessed for equal credit;
- five actionable activity steps and four observable completion criteria.

`src/lib/peExecution.mjs` owns this shared projection. The independent
validator re-audits the emitted PE lessons and fails if any required block is
missing. `pe-content-repair-evidence.json` records the confirmed baseline,
repair counts, post-repair zeroes, category coverage, and convergence
classification.

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
deliberately excludes. The accepted H2 lexical negation scope is used: a banned
term is excused only by a preceding negation in the same clause. Naming what
the task refuses to require stays valid, while an unrelated earlier negation
cannot hide a later requirement.

Health task cards carry a `trustedAdultNote` pointing urgent safety, health,
or mental-health concerns to a trusted adult or qualified professional. Every
lesson's `optionalReflection` (drawn from the source `home_connection` field)
is marked `private: true, graded: false, optional: true` and is never
persisted as scored work.

## Regenerating

```bash
node src/generate.mjs
```

Deterministic: source projections and the shared PE execution templates are
keyed only by authored lesson data, so the same source content always produces
byte-identical output. The script exits non-zero if any item is `NOT_READY`,
the privacy scan finds a violation, or the 972-lesson PE execution audit finds
any missing cue, equipment resolution, safety/stop block, adaptation,
home-use path, or completion criteria.

## Validating

```bash
node tooling/validate.mjs
```

Independently re-reads every file under `packages/` and `scoring-guides/`
(does not trust the generator's own in-memory bookkeeping) and checks:
no answer-bearing key leaked into a package, exact lesson/assessment counts,
paired artifacts, exact per-item source provenance, H2 repin coverage, H3
rubric-only scoring, private/ungraded optional reflection, PE adaptations,
Health fictional/private scenarios and trusted-adult language, the complete PE
learner execution contract and repair evidence, a fresh privacy scan, and every
entry in `SHA256SUMS.txt`.

## Production readiness gate

`src/lib/productionGate.mjs` is the plain-JS projection of the applicable
`ARTS_RFL_PE_PROJECT` semantics from
`mac/curriculum-production-gate-h3@49b3c4b86cc7764627bd4cfbd752222849831abf`.
It is a self-check only; this package does not modify or re-author the gate
itself. Every one of the 1,431
generated items evaluates to `READY` under `subjectFamily:
'ARTS_RFL_PE_PROJECT'`: independent work present, a substantive rubric
present, remediation and extension paths present (sourced from each lesson's
own `adaptive_tutor_routes` prerequisite-gap action and `extension` field),
assessment standards checked against unit standards (`ALIGNED` for every
item — computed, not asserted), and a safety/privacy review with a verified
safe/adapted alternative on every item.

No Health/PE item uses or synthesizes an answer key. Judgment work is admitted
only with `RUBRIC` authority and substantive criteria; the H3 credential-request
checks are applied to work, remediation, extension, safety alternatives, and
scoring content.

## Totals

See `corpus-manifest.json` for exact per-grade counts. Summary: 1,296 lesson
task cards + 135 unit-assessment task cards = 1,431 items, each with a paired
scoring guide, across 9 grades × 2 subjects × 2 artefact kinds = 36 course
corpora.

# Technology + Arts/Music — Student Production Materials

Student-ready project/task/scoring materials for the Technology and Arts/Music
subjects, covering three grade bands: elementary (grades 3-4), canonical
(grades 5, 7, 8), and high school (grades 9-12). Generated from the existing
canonical/authoring curriculum content — this package does not redefine
lessons, it turns each unit's real performance task, topics, and assessment
record into a complete student task package and a separate parent/tutor
scoring guide.

Scope of this directory: `curriculum-production/student-work/technology-arts/**`
only. Nothing outside this path was modified.

## What's here

```
manifest.json           sources, commit SHAs, totals, gate result, policy summary
schema/                 JSON Schema for both artifact types
src/                    course registry + pure generation functions
generate.mjs            regenerates packages/ and scoring-guides/ from source
run-gate.ts             runs the shared repo production-quality gate against the corpus
tooling/                Node ESM loader + runner so run-gate.ts can import
                        src/curriculum/production-quality/*.ts directly
tests/validate-corpus.mjs   independent structural/policy check (no shared deps)
packages/<subject>/<grade>/<unit_id>.task-package.json    student-facing
scoring-guides/<subject>/<grade>/<unit_id>.scoring-guide.json   parent/tutor-facing
gate-report.json, gate-report.md   output of the last gate run
```

`<subject>` is `technology` or `arts-music`. `<grade>` is `grade-03` … `grade-12`.
108 units total (18 courses × 6 units each) — see `manifest.json` for the
per-band/per-subject breakdown.

## Task package contents (student-facing)

- `project_brief`, `requirements`, `primary_task` — the deliverable, grounded
  in that unit's actual `performance_task` and `topics` from the source
  `units.json`, not generic scaffold text.
- `test_or_check_criteria` (technology) / `critique_criteria` (arts/music) —
  a pass/fail or reflection checklist distinct from the rubric.
- `presentation_and_privacy` — technology: an explicit sandbox/no-real-
  credentials note; arts/music: explicit private/small-audience/public-choice
  presentation options plus a text/no-audio alternative.
- `copyright_and_authorship` — states the graded work must be the student's
  own, and (arts/music) that only original, public-domain, or properly
  licensed/cited material may be used.
- `remediation`, `extension` — unit-specific reteach and going-further paths.

## Scoring guide contents (parent/tutor-facing, kept separate from the task package)

- `rubric` — four dimensions (accuracy/fidelity, evidence and reasoning,
  application/performance, checking and revision) with four descriptor
  levels each, matching the shared assessment rubric already used across
  this curriculum family.
- `points_reference` — the linked `assessments.json` prompts/points, kept as
  a teacher reference, not a fixed single-answer key (these are
  rubric/judgment-scored, not answer-keyed).
- `scoring_judgment_guidance`, `remediation_plan`, `extension_plan`,
  `mastery_interpretation`, `accommodation_note`, `source_integrity`,
  `safety_and_privacy`.

## Regenerating

```bash
node generate.mjs
node --experimental-strip-types tooling/run-ts.mjs run-gate.ts
node tests/validate-corpus.mjs
```

Requires Node ≥ 22.6 (for `--experimental-strip-types`). Regeneration reads
G3-4 and HS 9-12 source content from sibling worktrees
(`mac-g34-tech-arts-r1`, `mac-hs912-tech-arts-r1`) — see `manifest.json`
→ `generatedFrom` for exact paths, or override with `TECH_ARTS_G34_ROOT`
and `TECH_ARTS_HS_ROOT` env vars if your checkout layout differs. Canonical
grades 5/7/8 are read from this worktree's own `curriculum-content` package.

## Production Quality Gate

`run-gate.ts` imports the shared `src/curriculum/production-quality` module
from this branch directly (not a reimplementation) and evaluates every
generated unit as one `LessonProductionInput` under the
`ARTS_RFL_PE_PROJECT` subject family — the gate's own contract for
project/rubric-scored work, which does not require the instruction/worked-
example/guided-practice blocks that structured math/FinLit lessons need,
since the activity itself carries the instructional load. Latest run: **108
READY / 0 NEEDS_HUMAN_REVIEW / 0 NOT_READY** — see `gate-report.md`.

`tests/validate-corpus.mjs` is a second, dependency-free check covering file
counts, required fields, the same 25-word specificity floor the gate uses,
duplicate-content detection, and the privacy/copyright/authorship
assertions specific to this session's brief.

## Known upstream note

Grade 4 and grade 5 arts/music unit 5 share identical `performance_task` and
`topics` text in the source `units.json` files (a seam between the G3-4 and
canonical-5/7/8 authoring branches, not introduced here). The generated task
packages for those two units are still text-distinct (grade and `unit_id`
are woven into `project_brief`), but a human curriculum reviewer may want to
differentiate the underlying source content across that boundary.

# Manuel Academy — Grades 3/4 Release Candidate r1

One normalized, internally validated candidate assembled from seven independently authored branches.
**Candidate id:** `manuel-academy-grades-3-4-r1`. **Status:** `GRADE34_ASSEMBLY_READY`.

This is a candidate, not a published release. Nothing here is served to a learner yet.

## What this is

| | |
| --- | --- |
| Grades | 3, 4 |
| Courses | 20 (10 subjects × 2 grades) |
| Units | 154 |
| Lessons | 1800 |
| Unit assessments | 154 |
| Scheduled sessions | 1800 (every lesson scheduled exactly once, all courses span weeks 1–36) |
| Validation | Assembly integrity **PASS**; release-contract conformance **FAIL** on 2 checks — [`validation/validation-report.md`](validation/validation-report.md) |

## What was and was not done

**Not rewritten.** Every lesson, unit, and assessment file is copied byte-for-byte from its lane's
pinned commit. No lesson text, lesson ID, unit ID, or standards citation was edited, renumbered, or
regenerated.

**Normalized.** Directory layout (keyed on the canonical subject slugs the sealed 1.0.0 release
already uses), one schedule shape across all 20 courses, one course/unit/lesson index set, one
manifest, one schema candidate derived from the content as authored.

**Reconciled by content, not by ancestry.** No source branch is merged. Two lanes authored their
courses inside `curriculum-content/manuel-academy/1.0.0/grades/grade-{3,4}/` — inside the frozen
Grades 5/7/8 package. Their content was read out of those commits and written here.
**The sealed 1.0.0 package is untouched on this branch**, and a validation check enforces that.

**Source branches unchanged.** This session wrote to `curriculum-release-candidates/g34-r1/**` only.

## Layout

```
g34-r1/
  MANIFEST.json                     package identity, counts, per-course status, boundaries
  course-index.json                 20 courses with counts, cadence, source branch and commit
  unit-index.json                   154 units
  lesson-index.csv                  1800 lessons
  SHA256SUMS.txt                    checksums for every file in this tree
  grades/grade-{3,4}/courses/<subject>/
                                    verbatim lane content: lessons.jsonl, units.json,
                                    assessments.json, course guides, and each lane's own extras
                                    (text banks, practice/projects, mastery evidence, the lane's
                                    original schedule file) preserved under its authored name
  schedules/<course_id>.csv         normalized schedule, one row per session
  schedules/schedule-index.json     cadence and provenance per course
  schemas/lesson.schema.candidate.json
  standards/standards-custody-report.md
  standards/standards-inventory.json
  standards/sources/<lane>/...      each lane's standards artifacts, verbatim
  validation/validation-report.md   + validation.json
  ledger/source-branches.json       pinned input commits
  ledger/source-branch-ledger.md    what each branch contributed
  tools/assemble.py                 regenerates everything below from the pinned commits
```

## Reproducing

From the repo root:

```bash
python3 curriculum-release-candidates/g34-r1/tools/assemble.py
```

The assembler reads only from the commits pinned in `ledger/source-branches.json` via `git show`,
so it is deterministic: same pinned commits produce a byte-identical tree.

## Read these before promoting

- **All 1800 lessons fail `release/lesson-schema.json`.** Three separate divergences: standards are
  emitted as strings where the schema requires objects carrying `mapping_status` (all 1800), ELA
  uses `schema_version` `1.1` against a `const: "1.0"` (360), and the schema's `subject` enum still
  carries the matrix slugs `arts-music`/`technology-computer-science` where the lane authored the
  canonical `arts-and-music`/`technology` (216). None is fixable by assembly without rewriting
  lessons; all three must be settled before promotion.
- [`standards/standards-custody-report.md`](standards/standards-custody-report.md) — the above in
  full, plus 8 of 20 courses shipping no standards artifact, the financial-literacy standards gap,
  the health framework mismatch with the 5/7/8 courses, and the naming decision this assembly made.
- Health and Physical Education (4 courses, 288 lessons) carry
  `status: PENDING_FINAL_HEALTH_REVIEW`. They are complete and included in full, not hidden.
- Grades 3 and 4 do not exist in the runtime yet: not in `AcademyGrade`, not in `PILOT_GRADES`, not
  in `scripts/build-curriculum.mjs`. Promotion needs a new release version — 1.0.0 stays frozen.

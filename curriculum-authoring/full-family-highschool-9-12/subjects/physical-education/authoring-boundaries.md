# Authoring Boundaries — Grades 9-12 Physical Education (`mac/hs912-health-pe-r1`)

**Owns:** `curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/**` and `curriculum-authoring/full-family-highschool-9-12/subjects/health/**`.

## Did

- Read the frozen Grades 5/7/8 canonical package (`curriculum-content/manuel-academy/1.0.0/**`) to determine the lesson contract, the 12-day unit arc, the assessment shape, the PE policy floor, and the Grade 8 endpoint these courses extend from. Read only — nothing under `curriculum-content/` was modified.
- Confirmed the five Michigan K-12 Physical Education Standards (2017) and the grades 9-12 LEVEL 1 / LEVEL 2 structure against official MDE sources, and recorded honestly what could not be read. See [`standards-reference.md`](standards-reference.md).
- Authored four PE courses (Grades 9-12), 36 units, 432 lessons, and 36 unit assessments.
- Wrote a generator (`tools/build-courses.mjs`), a ten-gate validator (`tools/validate-course.mjs`), and 29 tests that prove each gate can fail (`tools/validate-course.test.mjs`).

## Did not

- Did not create or modify `curriculum-authoring/full-family-highschool-9-12/release/**`. No high-school release contract exists yet on any branch; establishing it belongs to the release lane (`mac/hs912-release-r1`), which is the precedent set by `mac/g34-release-standards-r1` for Grades 3/4.
- Did not write anything into `curriculum-content/manuel-academy/1.0.0/**`. Build output lands in `build/` inside this subject's own tree; importing it into the canonical package is the release/convergence lane's decision.
- Did not touch any other subject tree, any Study Engine code, routing, catalog, identity, or any production path.
- Did not modify the canonical `schemas/lesson.schema.json`, whose `grade` enum is `[5, 7, 8]` and whose lesson-id pattern is `^ma-g(5|7|8)-...`. Both need widening to accept grades 9-12; that is a canonical-package change and therefore a release-lane decision. This lane enforces the equivalent contract locally instead.
- Did not invent Michigan PE outcome codes. No lesson claims one, and every mapping is marked `unverified` rather than being upgraded to `canonical` on the strength of a search snippet.
- Did not require any purchase. Every unit has a free, household-equipment, or bodyweight route, because an activity a family cannot afford is not an activity the course can require.

## Handoff to the release lane

1. **`lesson.schema.json` needs grades 9-12.** Both the `grade` enum and the `lesson_id` pattern currently exclude them.
2. **`course-index.json`, `unit-index.json`, and `lesson-index.csv`** in the canonical package will need the 8 new courses (4 PE + 4 health) appended. `build/course-index.json` in each subject tree is emitted in the canonical entry shape and can be concatenated. The PE entries carry an additive `pe_level` field.
3. **`standards_mapping`, `pe_level`, `inclusive_adaptation`, and `guardian_safety` are additive fields.** The canonical schema sets `additionalProperties: true`, so they import cleanly, but the release lane should decide whether to keep or strip each.
4. **Every PE mapping is `unverified`, by design.** A reviewer with direct access to the Michigan PE standards PDF should upgrade them and add per-outcome codes. The validator reports the count on every run so this cannot be forgotten silently.
5. **The 12-day unit blocks are an instructional sequence, not a training calendar.** Grade 10 unit 4, Grade 11 unit 1, and Grade 12 unit 2 each run a multi-week training cycle that overlaps subsequent units. Scheduling logic that assumes a unit's work ends on its last day will mis-model these three.

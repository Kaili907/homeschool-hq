# Authoring Boundaries — Grades 9-12 Health (`mac/hs912-health-pe-r1`)

**Owns:** `curriculum-authoring/full-family-highschool-9-12/subjects/health/**` and `curriculum-authoring/full-family-highschool-9-12/subjects/physical-education/**`.

## Did

- Read the frozen Grades 5/7/8 canonical package (`curriculum-content/manuel-academy/1.0.0/**`) to determine the lesson contract, the unit and assessment shape, the policy floor, and the Grade 8 endpoint these courses extend from. Read only — nothing under `curriculum-content/` was modified.
- Verified the Michigan Health Education Standards Guidelines 2025 framework directly from an official State Board source, including the six Practices, eight topics, section structure, code format, and the statutory citations. See [`standards-reference.md`](standards-reference.md).
- Authored four Health courses (Grades 9-12), 24 units, 144 lessons, 24 unit assessments, and one optional guardian-activated module.
- Wrote a generator (`tools/build-courses.mjs`), a nine-gate validator (`tools/validate-course.mjs`), and 25 tests that prove each gate can fail (`tools/validate-course.test.mjs`).

## Did not

- Did not create or modify `curriculum-authoring/full-family-highschool-9-12/release/**`. No high-school release contract exists yet on any branch; establishing it belongs to the release lane (`mac/hs912-release-r1`), which is the precedent set by `mac/g34-release-standards-r1` for Grades 3/4.
- Did not write anything into `curriculum-content/manuel-academy/1.0.0/**`. Build output lands in `build/` inside this subject's own tree; importing it into the canonical package is the release/convergence lane's decision.
- Did not touch any other subject tree, any Study Engine code, routing, catalog, identity, or any production path.
- Did not modify the canonical `schemas/lesson.schema.json`, whose `grade` enum is `[5, 7, 8]` and whose lesson-id pattern is `^ma-g(5|7|8)-...`. Both need widening to accept grades 9-12; that is a canonical-package change and therefore a release-lane decision. This lane enforces the equivalent contract locally instead — see `study-compatibility` in [`validation-contract.md`](validation-contract.md).
- Did not invent Michigan standard codes. No lesson claims a per-indicator number, because the 9-12 indicator lists were not read from the source.
- Did not decide whether the sex-education module is delivered. That is a guardian decision by law; the lane's job was to make declining it cost nothing. See [`sex-education-module.md`](sex-education-module.md).

## Handoff to the release lane

1. **`lesson.schema.json` needs grades 9-12.** Both the `grade` enum and the `lesson_id` pattern currently exclude them.
2. **`course-index.json`, `unit-index.json`, and `lesson-index.csv`** in the canonical package will need the 8 new courses (4 health + 4 PE) appended. `build/course-index.json` in each subject tree is emitted in the canonical entry shape and can be concatenated.
3. **The optional module is not a course.** It must not be added to any course index, schedule, or credit calculation.
4. **`standards_mapping` is an additive field.** The canonical schema sets `additionalProperties: true`, so it imports cleanly, but the release lane should decide whether to keep it or strip it.
5. **Unverified mappings are reported, not hidden.** 42 `unverified` and 1 `human-review` entry in health; every PE mapping is `unverified`. The counts come from the validator on each run. Convergence decides whether that ratio is acceptable before sign-off.

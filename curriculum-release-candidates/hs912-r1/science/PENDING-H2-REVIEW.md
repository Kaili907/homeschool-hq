# Science — imported verbatim, `PENDING_H2_REVIEW`

**Source branch:** `mac/hs912-science-h2` @ `265ea3a75740ccbeea0dfa02c723514779def052`
**Imported:** verbatim, entire subject tree, no field renamed, no identifier changed.
**Superseded candidate:** `mac/hs912-science-r1` @ `f58f7f1eec0a0f93801df4978c00511ec98cc95e` — **not imported.**

## Why this family is not in the canonical layout

The other nine families deliver `<family>/grade-N/{units.json,lessons.jsonl,assessments.json}`
with identifiers of the form `ma-g<grade>-<family>`, which is what `release/course-matrix.json`
allocates and what `release/validate-high-school.mjs` reads.

Science was authored against a different contract — repository schema set `2.0.0`, validated by
`src/curriculum-authoring/v2/validation.ts` — and delivers a single authoring set with
`course_ref`/`unit_ref` linkage and course identifiers named after the course rather than the
grade slot:

| Grade | Delivered course id | Identifier required by `course-matrix.json` |
| --- | --- | --- |
| 9 | `ma-hs9-biology` | `ma-g9-science` |
| 10 | `ma-hs10-chemistry` | `ma-g10-science` |
| 11 | `ma-hs11-physics` | `ma-g11-science` |
| 12 | `ma-hs12-earth-space-environmental` | `ma-g12-science` |

The lesson record shape differs as well: `accessibility`, `safety_privacy`, `mastery`,
`scoring_guidance` and `tutor_routes` where the contract's lesson shape expects
`accessibility_and_accommodations`, `safety_and_privacy`, `mastery_rule`,
`answer_or_scoring_guidance` and `adaptive_tutor_routes`.

**The assembly session does not rewrite either.** Renaming another lane's identifiers would
break the stability rule in `release/authoring-boundaries.md` §4, and it would silently
diverge from the content the parallel read-only H2 review is reviewing right now. Translating
the lesson schema would be authoring, not importing. Both are recorded as blockers instead.

## What was proved about this content, on its own terms

`validation/validate-assembly.mjs` → `checkScience` verifies the native authoring set without
reference to the contract's shape, and it passes on every structural claim:

- four courses, one per grade 9–12, no grade skipped
- 36 units, 432 lessons, 36 assessments — one assessment per unit
- every lesson identifier unique
- every `lesson_ref` resolves; no lesson is orphaned
- the native schedule covers every lesson exactly once

The lane's own validation report (`validation/validation-report.md`, 48/48 mission checks and
0 contract issues) is imported alongside it and is not re-run here.

## What has to happen next

One of the following, decided by the release lane and the Director — not by assembly:

1. The science lane re-emits its authoring set under `ma-g<grade>-science` and the contract
   lesson shape; or
2. `release/course-matrix.json` and `validate-high-school.mjs` adopt the schema-set 2.0.0
   identifiers for science and record the exception; or
3. The release lane publishes a crosswalk that both validators read, so the two identifier
   schemes coexist deliberately rather than by accident.

Until then this family carries `PENDING_H2_REVIEW` and the release candidate carries `BLOCKED`.

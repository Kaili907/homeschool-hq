# Release lesson schema - delta from the release lane's file

[`lesson.release.v1.json`](lesson.release.v1.json) is
[`standards/sources/release/lesson-schema.json`](../standards/sources/release/lesson-schema.json)
- carried verbatim in this release, authored by `mac/g34-release-standards-r1`, **not edited** -
with three declared changes and nothing else.

## 1. `subject` enum canonicalized

```
- "technology-computer-science", "arts-music"
+ "technology", "arts-and-music"
```

The release lane wrote the enum from `course-matrix.json`'s planning slugs. Every lane authored the
canonical slugs, which are the ones the sealed `curriculum-content/manuel-academy/1.0.0` package and
`src/curriculum-authoring/v2/contracts.ts` use, and which the candidate's own directory layout keys
on. The r1 custody report section 5 recorded this as the open question and answered it the same way;
section 1a recorded that the schema needed the same remap applied to it. This is that remap, applied
at the release boundary instead of in the lane's file.

216 lessons (144 arts-and-music, 72 technology) fail the unmodified enum and pass this one. No
lesson's `subject` value changed. [`adapters/subject-slug-map.json`](../adapters/subject-slug-map.json)
translates in both directions for any consumer still keyed on the matrix slugs.

## 2. `authored_schema_version` declared

An optional string property recording the `schema_version` the authoring lane emitted, when it
differs from the release-wide value. The base schema sets `additionalProperties: true`, so this is
declarative rather than permissive - it documents a field that was already allowed.

## 3. `$id`, `title`, `description`

Retargeted to this release. No constraint changes.

## What did not change

`schema_version` keeps `const: "1.0"`. The `standards` item shape keeps its three required
properties and the `mapping_status` enum. Every `required` field, `minItems`, `minLength`,
`pattern`, and range is untouched. The subject enum is the only constraint change in either
direction.

**It is a substitution, not a widening.** `technology-computer-science` and `arts-music` are
*removed*, not kept alongside the canonical values, so neither schema subsumes the other: a lesson
carrying a matrix slug would validate against the lane's file and fail this one. That case does not
arise in this corpus - 0 of 1800 lessons carry a matrix slug - and keeping both would have made the
release schema accept two spellings of the same subject, which is the divergence it exists to
close. `adapters/subject-slug-map.json` is what a consumer keyed on the matrix slugs uses instead.

## One inherited description to be aware of

`code_or_strand`'s description is carried verbatim from the lane's file and reads "Exact standard
code when verified (e.g. '3.OA.A.1')". No lane emits that cluster-lettered form - the mathematics
lane states it writes `3.OA.1` deliberately, and ELA writes codes in a transposed house order. The
description is left unedited to keep the delta minimal; what the codes actually look like, and how
to join them against an official namespace, is recorded in the `code_format` block on every
`standards/courses/<course_id>.standards.json`.

## Both are run

`validation/validation-report.md` reports `lesson-schema-compatibility` against this schema and,
separately, `lesson-schema-compatibility-against-unmodified-release-schema` against the lane's file,
so the residual gap stays visible rather than being normalized out of sight.

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
`pattern`, and range is untouched. A lesson that validates against the lane's file also validates
against this one: the only relaxation is on `subject`, and it is a widening to the canonical values.

## Both are run

`validation/validation-report.md` reports `lesson-schema-compatibility` against this schema and,
separately, `lesson-schema-compatibility-against-unmodified-release-schema` against the lane's file,
so the residual gap stays visible rather than being normalized out of sight.

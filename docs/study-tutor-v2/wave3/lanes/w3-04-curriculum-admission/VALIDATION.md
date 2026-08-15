# W3-04 validation

Validation date: 2026-08-15.

## Focused commands

From `adaptive-tutor/`:

```text
npm run typecheck
npx tsc -p tsconfig.test.json
node --test .test-dist/core/v3/curriculum-admission/curriculum-admission.test.js
```

Observed result: TypeScript passed and the focused Node suite passed 17 tests,
0 failed.

## Repository gates

From the repository root:

- `npm run typecheck`: passed.
- `npm run build`: passed. The curriculum projection reported 90 courses and
  8,292 lessons; Vite completed with only its existing large-chunk warning.
- `npm test`: 501 files passed; 6,432 tests passed and 4 skipped. One unrelated
  PostgreSQL suite failed before executing because the locally installed
  embedded PostgreSQL binary could not load `libicudata.77.dylib`.

From `adaptive-tutor/`:

- `npm test`: 21 tests passed.
- `npm run build`: passed.
- `npm run validate`: 18 of 19 legacy checks passed. The inherited broad
  `platform-boundary` filename scan reported pre-existing v2 `authority` paths
  and compiled test output. Tutor V2's release generator already records this
  same inherited baseline finding. The generated report was restored, and no
  out-of-scope file was retained.

The two non-green broad checks are environment/baseline findings outside this
lane. The owned implementation, canonical coverage test, package typechecks,
and both builds are conclusive.

## Proved cases

- accepted capability admission for a nominal grade different from the official
  working level;
- arbitrary metadata-supplied course and subject identifiers;
- unknown-course refusal before capability fallback;
- Grade 6 negative control and unavailable working-level refusal;
- exact course/subject, unit, lesson, and lesson-to-unit membership;
- missing, unreviewed, refused, static-only, and unsupported capability states;
- declaration-selected static-only versus refused unsupported outcomes;
- no free-form Tutor invocation during active assessment;
- Study action-family intersection and cross-scope refusal;
- rejection of curriculum-assignment and working-level mutation fields;
- duplicate/malformed curriculum and capability metadata refusal;
- input immutability; and
- compilation of the current accepted 90-course, 698-unit, 8,292-lesson
  canonical metadata with exact irregular identifiers and no Grade 6.

## Scope

No curriculum content or release metadata was changed. The lane changes only
`adaptive-tutor/core/v3/curriculum-admission/**` and this owned documentation
directory.

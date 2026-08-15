# Grade-authority consumer audit

Canonical Academy curriculum support is `3, 4, 5, 7, 8, 9, 10, 11, 12`.
Grade 6 remains nominally valid but is not curriculum-supported. The complete
session handoff and classification is in
`docs/admin-dashboard/admin-dash-1-grade-authority-convergence.md`.

## Migrated in Admin Dashboard Session 1

- `src/types.ts`: nominal and Academy grade contracts are derived from this
  module; nominal Grades 9 and 11 are restored.
- `src/academy/featureFlag.ts`, `academyRoute.ts`, `workingLevel.ts`: canonical
  narrowing, flags, ID grammar, subject working levels, and stale enrollment.
- `src/components/hub/AcademyLevelsPanel.tsx`: canonical working-level choices.
- `src/study/contracts/production/content.ts` and
  `netlify/functions/_shared/study-content/resolver.js`: Study grade validation
  and one/two-digit lesson-context parsing.
- `src/sync/provenance.ts`: nominal and Academy validation plus canonical course
  parsing.

## Deferred Admin Dashboard consumers

- Session 2: `src/admin/curriculum/**` read contracts, validators, and browser
  data/UI.
- Session 3: `src/admin/curriculum-validation/**`, standards-review surfaces,
  known-evidence enumeration, and curriculum-integrity aggregation.
- Sessions 5 and 6: no active `5/7/8` grade-authority consumer was assigned by
  this audit.

## Intentionally release-scoped or historical

The v1 package ID `manuel-academy-grades-5-7-8-curriculum-v1`, its package
schemas/validation artifacts, `scripts/build-curriculum.mjs`,
`tests/curriculum-content.test.js`, and the three grade-directory loops in
`src/curriculum-authoring/v2/v1Importer.node.ts` describe the immutable 1.0.0
release on disk. They must not be widened merely because runtime authority is
wider. The active Admin integrity aggregator still requires Session 3 work so
future releases do not depend on a fixed v1 grade list.

## Other subsystems requiring a later decision

- `netlify/functions/_shared/anthropic-policy.js` has a nominal tutor-request
  whitelist based on seeded household profiles.
- `src/curriculum/parser.ts` has a Family Pilot plan-document vocabulary.
- `src/reading/passages.ts` and `src/components/reading/ReadingView.tsx` own the
  narrower reading-fluency grade vocabulary.

Typed template interpolation such as ``grade-${grade}`` and ``ma-g${grade}``
is not an independent membership authority when `grade` is already an
`AcademyGrade`; validation/parsing grammar is centralized here.

# Owned file manifest

This session created 70 source, schema, fixture, test, and documentation files
inside its four owned trees. The downloadable ZIP is generated afterward as a
71st owned artifact and is intentionally excluded from its own archive.

No pre-existing file was modified. No file outside these owned trees was
created, edited, deleted, moved, or integrated.

## `contracts/` — 14 files

- `common.ts`
- `focus-profile.ts`
- `index.ts`
- `learning-evidence.ts`
- `legacy-adapters.ts`
- `node-shim.d.ts`
- `parent-teacher-controls.ts`
- `parent-teacher-private.ts`
- `review-scheduling.ts`
- `study-plan.ts`
- `study-session.ts`
- `tsconfig.json`
- `type-contracts.type-test.ts`
- `versioning.ts`

## `schemas/` — 29 files

Runtime/schema sources:

- `focus-profile.schema.ts`
- `generate-json-schemas.ts`
- `index.ts`
- `json-schema.ts`
- `learning-evidence.schema.ts`
- `migrations.ts`
- `parent-teacher-controls.schema.ts`
- `parent-teacher-private.schema.ts`
- `package-contracts.ps1`
- `registry.ts`
- `review-scheduling.schema.ts`
- `study-plan.schema.ts`
- `study-session.schema.ts`
- `test-helpers.ts`
- `validation.ts`

Automated tests:

- `fixtures.test.ts`
- `identifier-stability.test.ts`
- `safety-privacy.test.ts`
- `schema-roundtrip.test.ts`
- `session-state.test.ts`
- `validation-boundary.test.ts`
- `versioning.test.ts`

Generated JSON Schemas:

- `generated/learning-evidence.v1.schema.json`
- `generated/lesson-study-plan.v1.schema.json`
- `generated/parent-teacher-controls.v1.schema.json`
- `generated/parent-teacher-private.v1.schema.json`
- `generated/student-focus-profile.v1.schema.json`
- `generated/student-skill-review.v1.schema.json`
- `generated/study-session.v1.schema.json`

## `fixtures/` — 18 files

Valid:

- `valid/focus-profile-established.json`
- `valid/focus-profile-insufficient-data.json`
- `valid/learning-evidence-low-accuracy.json`
- `valid/manifest.json`
- `valid/parent-teacher-controls.json`
- `valid/parent-teacher-private.json`
- `valid/review-schedule.json`
- `valid/session-abandoned.json`
- `valid/session-active.json`
- `valid/session-approved-break.json`
- `valid/session-completed.json`
- `valid/session-paused.json`
- `valid/session-planned.json`
- `valid/session-student-requested-break.json`
- `valid/session-technical-interruption.json`
- `valid/study-plan.json`

Invalid:

- `invalid/mutations.json`
- `invalid/README.md`

## `docs/contracts/` — 9 files before ZIP

- `README.md`
- `compatibility.md`
- `contract-reference.md`
- `core-change-requests.md`
- `example-payloads.md`
- `file-manifest.md`
- `integration-notes.md`
- `validation-report.md`
- `versioning-and-migrations.md`

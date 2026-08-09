# Curriculum Authoring Schema Set 2.0.0

This directory documents the future Curriculum Studio authoring boundary. The
authoritative typed contract is `src/curriculum-authoring/v2/contracts.ts`; its
generated JSON Schema artifact is
`curriculum-content/manuel-academy/schema-sets/2.0.0/schema-set.json`.

Published curriculum release `curriculum-content/manuel-academy/1.0.0` remains
immutable. The v1 importer reads that release and creates an in-memory v2 draft
plus `compatibility-report.json`. It never writes into the published release.

## Architecture

The schema set is defined once with typed schema combinators. The same
definitions infer TypeScript types, validate server inputs, and emit strict JSON
Schema. Every defined object boundary rejects unknown properties. Independently
stored entities carry `schema_set_version: "2.0.0"`.

The entity contracts cover:

- curriculum manifest, course, unit, lesson, assessment, and schedule;
- protected assessment interpretation with stable prompt references;
- standard framework, standard, and alignment reference;
- policy-owned mastery and lesson-only strengthening;
- controlled Tutor signal, strategy, and parameter routes;
- accessibility, safety/privacy, media/resource, and policy set;
- registered, typed, explicitly classified extension entries.

`validateAuthoringSet` adds semantic checks across the strict entity schemas:
identifier uniqueness, parent references, authoring order, schedule coverage,
manifest counts, assessment point sums, standards relationships, mastery floor,
Tutor authority, policy references, resource fallbacks, extension registration,
and projection validation.

## Projection boundary

Student and protected projections have separate schemas. Projectors construct
new objects from explicit allowlists; they never copy an authoring object and
delete known secrets. A new authoring field therefore stays out of student
output until it is deliberately added to the student contract.

Student lesson output excludes scoring guidance, mastery interpretation, Tutor
routes, safety/privacy administration, guardian visibility notes, and protected
extensions. Student assessment output excludes protected interpretation and
prompt scoring. Unknown or unregistered extensions never enter student output.

## Mastery and Tutor authority

The global policy owns the Academy mastery floor. `resolveMastery` combines the
floor with lesson strengthening by taking numeric maxima, preserving independent
evidence, unioning evidence types, and selecting the stronger transfer mode.
Semantic validation rejects any explicit weakening.

Tutor routes use five controlled signals and matching controlled strategies.
Parameters are data-only. Curriculum cannot control answer revealing, final
graded answers, or graded-work policy. Recursive forbidden-key checks protect
the Tutor and extension boundaries against equivalent authority fields.

## v1 import classifications

The importer preserves every raw source record in its in-memory result and
reports a zero dropped-field count. Existing standard strings are retained as
`legacy_label`; no canonical IDs are guessed. Bare labels `2`, `3`, `4`, and `5`
are classified `CONTENT_CORRECTION_REQUIRED` for human mapping review.

The compatibility report uses these classifications:

- `NO_BREAK`
- `MIGRATION_REQUIRED`
- `CONTENT_CORRECTION_REQUIRED`
- `SCHEMA_VERSION_REQUIRED`

## Integration boundaries

This foundation does not build Studio UI, approval, publishing, or a database
authoring model. ADMIN-16 owns the future database model; no database migration
is required here.

Before all structured mastery rules can be enforced at runtime, learner evidence
must record evidence type and transfer mode. Those are explicit integration
dependencies, not changes to the current learner mastery runtime.

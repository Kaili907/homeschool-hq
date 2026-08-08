# Curriculum safety and versioning boundary

## Current published boundary

The current source package identifies itself through
`curriculum-manifest.json` version `1.0.0`, with course/unit/lesson indexes, a
lesson schema, validation evidence, file hashes, and a package `MANIFEST.json`.
The application uses `ACADEMY_RELEASE_VERSION` and serves immutable,
version-addressed student chunks. Protected scoring/tutor fields stay out of the
static browser projection.

The Admin Console may browse published metadata and authorized protected views,
but published files and rows are immutable. It must not edit
`curriculum-content/manuel-academy/1.0.0` or generated
`public/curriculum/1.0.0` in place.

## Required lifecycle

Every authoring flow follows this sequence:

1. **Published** — immutable source version and its manifest/checksums.
2. **Create Draft** — create a new draft referencing its published base version.
3. **Edit** — mutate draft content only, with optimistic revision control.
4. **Validate** — run schema, index/referential integrity, uniqueness, schedule,
   count, protected-field, safety/privacy, and package checks.
5. **Preview** — render the exact candidate projection in an isolated,
   non-production preview identified by draft revision.
6. **Review Diff** — show content and manifest/index/checksum differences against
   the base version; never rely on a summary alone.
7. **Approve** — an owner records approval of the exact validated draft revision
   and validation digest. Later edits invalidate approval.
8. **Publish New Version** — materialize a new immutable semantic version,
   manifest, indexes, checksums, validation evidence, and audit event.

ADMIN-0 freezes lifecycle names in `ADMIN_CURRICULUM_LIFECYCLE`. ADMIN-5 may
display the lifecycle, but no curriculum editing is implemented in the initial
shell.

## Rollback

Rollback changes an active release pointer to a previously published immutable
version through an owner-authorized, audited release operation. It never edits,
deletes, or reuses a published version number. The rollback event records the
from/to versions, reason code, actor, app version, and configuration revision.
Historical learner events retain the curriculum version used when they occurred.

## Version identifiers

- `appVersion` is an immutable deployed build identifier. A mutable environment
  label or package version alone is insufficient when multiple builds can share
  it.
- `engineVersion` identifies the independently deployable engine implementation
  or contract that produced the event. It is not inferred from `appVersion`.
- `curriculumVersion` is the immutable package/release version from the curriculum
  manifest and content path. It is nullable only when curriculum is irrelevant.

Operational telemetry snapshots all three identifiers at event acceptance.
Usage/cost and audit records snapshot the versions relevant to their action.
Admin overview responses include the current app and curriculum versions plus
the observation time; they do not infer historical versions from current state.

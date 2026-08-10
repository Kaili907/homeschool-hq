# Immutable curriculum release publishing

ADMIN-20B publishes one exact ADMIN-20A staged candidate into the existing
curriculum release registry. The terminal state for this card is
`PUBLISHED, NOT ACTIVE`. It does not update the production active pointer,
change learner `releaseVersion` pins, clear runtime caches, or deploy code.

## Boundary

`GET /api/admin/curriculum/drafts/:draftId/publishing` reports bounded
publication eligibility. `POST` accepts only `stagingId` and `idempotencyKey`.
The authenticated server principal supplies the actor identity; browser role,
capability, artifact, manifest, digest, target-version, and release fields are
not accepted.

The HTTP boundary independently requires `curriculum:publish` for mutation.
The database RPC
`academy_admin_publish_curriculum_release_v1(uuid, uuid, uuid, text, text)`
reauthorizes a current owner assignment before consulting a retry receipt or
writing any release state.

## Exact staged evidence

PostgreSQL loads the immutable staging row and artifacts by `staging_id`. It
rechecks the draft ID and revision, base release, target version, Schema Set,
validation ID and result digest, approval ID, entity counts, exact canonical
artifact bytes, every artifact byte count and SHA-256, content inventory
SHA-256, canonical manifest SHA-256, manifest file inventory, and package
SHA-256. It also requires the exact validation to remain publication-ready,
the exact approval to remain current, and the latest validation to have no
blocking or human-review finding.

No curriculum snapshot is rematerialized during publish. The staged bytes and
digests are authoritative.

## Registry and artifact model

`academy_curriculum_releases` remains the only published release registry.
Legacy `1.0.0` retains its `legacy_import` commit-pinned provenance. New rows
use `staged_publish`, link to the immutable staging identity, and record the
content, manifest, and package digests.

`academy_curriculum_release_files` remains the release artifact inventory. A
new conditional custody class, `immutable_embedded_json`, stores the exact
canonical staged JSON bytes with a deterministic
`curriculum_registry:<release-id>:<snapshot-path>` locator. Existing legacy
file rows remain metadata-only and commit-pinned. The pre-existing immutable
registry triggers reject update or delete for both provenance classes.

Operational timestamps are release metadata only and never participate in
content, manifest, or package identity.

## Atomicity, retry, and conflict behavior

Release registration, every published artifact row, the bounded
`curriculum.publish` audit event, and the request receipt occur inside one
database transaction. Any artifact or audit failure rolls the whole statement
back.

An exact request replay returns its stored response. A different request for
the already-published same staging/package identity resolves to the same
release without a second audit event. Reusing a request identity with changed
input is a conflict. The same target version with different staging or package
identity is a conflict; no row is overwritten or repaired.

## No activation

Publication does not reference a pointer mutation RPC and performs no insert,
update, or delete against `academy_curriculum_active_pointers`, `profiles`, or
learner enrollment state. Curriculum Studio offers Publish only when the
server-resolved capability permits it and renders the success state exactly as
`PUBLISHED, NOT ACTIVE`. There is no Activate action in ADMIN-20B.

Activation and rollback remain separate authorized work. A future activation
card must select an already-published immutable registry row, update the
append-only active-pointer model, define learner pinning policy, and provide
its own rollback and cache/runtime-binding evidence.

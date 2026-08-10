# Curriculum release staging

Status: repository-only. The migration has not been applied to hosted
Supabase, and no curriculum candidate has been staged in production.

ADMIN-20A freezes one exact approved draft revision as an immutable candidate.
It does not publish the candidate, make it active, assign it to a learner,
alter the `production` pointer, deploy content, or change the learner runtime's
hard-coded `1.0.0` binding.

## Exact gate and target custody

`POST /api/admin/curriculum/drafts/:draftId/staging` accepts only the current
draft revision and a retry UUID. The server derives every other fact. Before
materialization it requires the approval foundation's exact `publishGate` and
binds the candidate to the same draft revision, immutable base release, target
version intent, Schema Set `2.0.0`, validation snapshot/result digest, and
approval decision. The database repeats the actor, revision, validation,
approval, lifecycle, schema, and target checks inside the staging transaction.

Target versions are never invented. A collision with either an immutable
published release or an already staged candidate fails; no record is replaced.
The existing owner-only `curriculum:publish` capability is the narrow frozen
authority available for release custody. Despite that capability name, this
operation only creates state `staged` with `publication_status =
not_published`.

## Deterministic candidate package

The staging service reuses the Studio materializer:

1. load the immutable `1.0.0` Schema v2 import;
2. apply base overrides;
3. add draft-created authorable entities;
4. remove tombstoned entities; and
5. retain protected base schedules, policy sets, standards frameworks, and
   assessment interpretations unchanged.

The complete Schema v2 snapshot is encoded into ten canonical JSON artifacts:
the authoring manifest plus nine deterministic collections. Object keys are
canonicalized, collection order comes from the validated materializer, and
operational timestamps are excluded. Every artifact has a byte count and
SHA-256. The content hash covers the sorted artifact inventory; the manifest
hash covers exact release, draft, validation, approval, count, and file
bindings; the package hash binds the content and manifest identities.

The database stores canonical artifact bytes and JSON together. Candidate,
artifact, idempotency receipt, and bounded staging audit evidence are committed
in one transaction. A malformed or partial artifact set leaves no candidate
and no staging audit event. Candidate and artifact tables reject updates and
deletes and use forced RLS with no direct application-role privileges.

## Replay, read model, and UI

The first successful request UUID becomes the staging identity. Exact request
replay returns the stored response. A different request for the same exact
revision and package resolves to that same staging identity. Reusing a request
identity or exact draft revision for different content conflicts.

`GET /api/admin/curriculum/drafts/:draftId/staging` requires
`curriculum:read` and projects the exact draft/revision, validation and approval
states, target, blocking reasons, eligibility, and immutable checksum summary.
Curriculum Studio clearly labels success `STAGED, NOT PUBLISHED`, exposes safe
retry and unavailable/permission states, and contains no activation action.

ADMIN-20B remains responsible for release publication, registry promotion,
artifact delivery, active-pointer transitions, learner binding, rollback, and
all production execution of those operations.

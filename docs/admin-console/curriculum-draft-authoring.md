# Curriculum Studio draft-authoring foundation

ADMIN-16B creates a private mutable authoring plane without changing the
published curriculum package or immutable release registry. Each workspace has
a UUID, an immutable published base-release foreign key, target semantic-version
intent, authoring schema version `2.0.0`, lifecycle state `draft`, revision,
server timestamps, and server-resolved creator/updater authority.

## Entity model and save validation

The authorable classes are `course`, `unit`, `lesson`, `assessment`, and
`media_resource`. Each row stores a stable entity UUID for audit identity, the
Schema v2 entity reference/type, `base_override` or `draft_created` origin,
full validated payload, SHA-256, navigation position, entity revision, and a
one-way tombstone flag. The API runs the exact strict Schema v2 validator,
including nested field constraints and unknown-field rejection. The database
also enforces the allowed entity classes, matching top-level identity, Schema
Set version, exact top-level key sets, bounds, and payload size.

Policy sets, standards frameworks, schedules, curriculum manifests, and
protected assessment-interpretation entities are not accepted by the generic
entity endpoints. This foundation performs save-time entity validation only;
cross-entity references, counts, schedule coverage, candidate projections, and
publication completeness remain part of ADMIN-18 final validation.

The bulk resource inventory projects only provider-safe metadata and omits the
stored resource locator from response, search, and detail rendering. Editors
can still open the authoritative resource entity through the existing
draft-entity workflow when a locator is required for authoring.

## CAS, replay, tombstones, and audit

Every entity mutation supplies both the expected workspace revision and, for
update/tombstone, expected entity revision. A successful write advances both.
Stale revisions return a conflict and the transaction makes no state or audit
change. Mutation request UUIDs and server-computed request digests provide exact
replay; changed input under the same request UUID is rejected.

Entity deletion is unavailable. Tombstoning preserves the payload/digest and
advances revisions; tombstoned rows cannot be revived or edited. Draft/entity
table triggers also reject direct deletion and authority-changing transitions.

Workspace creation appends `curriculum_draft.create`. Entity writes append
`curriculum_entity.create`, `curriculum_entity.update`, or
`curriculum_entity.tombstone` through the existing ADMIN-15 appender in the
same transaction. Audit values contain only the previously approved structural
facts and digest, never raw curriculum payloads.

## Authorization and API

Every endpoint independently verifies the Supabase bearer through the Admin
authorization boundary. Reads require `curriculum:read`; writes require
`curriculum:drafts:write`. The browser supplies no actor, role, authority,
timestamp, digest, or resulting revision. The trusted server derives the actor,
computes digests, invokes narrow service-role-only RPCs, and the database
re-resolves the actor's current assignment before each operation. Draft tables,
entity tables, replay receipts, and internal helpers have forced RLS and no
direct `anon`, `authenticated`, or `service_role` table grants.

The versioned JSON endpoints are:

- `GET|POST /api/admin/curriculum/drafts`
- `GET /api/admin/curriculum/drafts/:draftId`
- `POST /api/admin/curriculum/drafts/:draftId/entities`
- `GET|PUT /api/admin/curriculum/drafts/:draftId/entities/:entityType/:entityRef`
- `POST /api/admin/curriculum/drafts/:draftId/entities/:entityType/:entityRef/tombstone`

No endpoint accepts arbitrary SQL, JSON patches, generic protected classes,
publish/activate operations, or client authority assertions.

## Deferred Studio work

This card intentionally leaves the composed Studio UI, base-release import and
materialized navigation, collaborators, full-set validation, preview builds,
semantic diff/review, approval, publish materialization, and release activation
to later cards.

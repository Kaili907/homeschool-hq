# ADMIN-15 append-only Admin audit foundation

Status: implemented locally; migration not applied hosted.

ADMIN-15 implements the ADMIN-0 version 2 audit contract without adding actions,
resources, capabilities, or configuration mutation. The immutable relation is
`academy_private.admin_audit_events` in
`20260809130000_academy_admin_audit_foundation.sql`. The timestamp is later than
the separately known `20260809120000` telemetry migration and does not collide
with any migration present at the exact ADMIN-15 base. On this base its manifest
dependency is the latest present migration,
`20260808123000_academy_admin_safety_operations.sql`.

## Write boundary

`academy_private.append_admin_audit_event_v1` is an ungranted, fixed-search-path
security-definer function for later privileged mutation RPCs. It must be called
inside the same database transaction as the protected mutation. PostgreSQL
transaction semantics make either both changes commit or both roll back.

The helper accepts only canonical action/resource/value inputs. It derives
`auth.uid()`, the current unrevoked and unexpired Admin role, and the active role
assignment from database state. Browser user IDs, roles, assignments, JWT role
metadata, and capability arrays are not accepted as inputs. The snapshot is
stored on the event and does not change if authorization is later revoked.

The table has enabled and forced RLS, no application-role grants, and no update
or delete policy. A before-update-or-delete trigger rejects mutation even if a
future grant is accidentally broadened. There is no audit-delete operation.

## Canonical and privacy validation

Action/resource pairs are the exact ADMIN-0 v2 pairs. There are no wildcards.
Previous and new values must be nonempty, flat objects with at most eight
allowlisted fields, 2,048 bytes each, scalar values or arrays of at most 16
scalars, bounded numbers, and token-safe strings. Nested objects, unknown fields,
free text, URLs, bearer/JWT/key-like strings, credentials, prompts,
conversations, learner content, student audio, assessment answers, provider
payloads, exceptions, and private notes cannot satisfy this contract.

ADMIN-0 v2 intentionally does not freeze reason codes. ADMIN-15 therefore owns
a local exact allowlist in `admin_audit_reason_is_allowed`. This is the boundary
for future contract promotion; adding a reason requires review and must not be
implemented as free text or a regex wildcard.

## Read boundary

`GET /api/admin/v1/audit` independently verifies the Supabase bearer and current
Admin assignment, then requires `audit:read`. The server uses a service-only RPC
that accepts only canonical filters, an exact resource reference, a limit from 1
through 100, and the two-part `(occurred_at, event_id)` cursor. The API exposes
that cursor as canonical base64url JSON and rejects malformed, duplicated, or
unknown query parameters. Sorting is newest first by both cursor fields.

The browser DTO is rebuilt from allowlisted fields. It exposes the safe actor
role but omits actor user identity, assignment references, bearer tokens,
capability lists, account/household details, raw rows, and database errors. The
Audit Log UI renders values field-by-field in a semantic table; it never dumps
raw JSON and has no mutation control.

## Granular curriculum extension

The additive ADMIN-16B handoff vocabulary preserves contract version 2, the
existing event shape, and the ungranted v1 appender signature. It adds exact
entity and collaborator pairs plus action-aware safe-value validation. See
[granular curriculum draft audit vocabulary](admin-curriculum-audit-vocabulary.md).

## ADMIN-14 handoff

ADMIN-14 may add configuration storage and narrow configuration mutation RPCs.
Each successful mutation must invoke the internal append helper before its
transaction commits. ADMIN-14 must not grant the helper to browser or service
roles, expand the frozen ADMIN-0 action/resource vocabulary, accept unrestricted
JSON, or turn the local reason allowlist into free text.

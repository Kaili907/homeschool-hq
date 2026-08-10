# Admin Access & Permissions

## Authorization contract

The implementation reuses ADMIN-0 contract version 2 without changing its role
or capability vocabulary. Roles remain exactly `owner`, `admin`, and `viewer`,
and effective capabilities are derived from `ADMIN_ROLE_CAPABILITIES`.

Every current Admin role inherits `overview:read`, so the minimized access view
uses that existing baseline capability. The browser does not gain a new generic
or directly assignable capability. Mutations continue to require the frozen
owner-only `admin_roles:manage` capability.

## Read projection

`GET /api/admin/v1/access` verifies the bearer through the canonical server
authorization boundary, then invokes `academy_admin_read_access_v1()` with the
same authenticated token. The database re-resolves `auth.uid()` and returns at
most 250 active, unexpired assignments with only:

- pseudonymous principal and assignment references;
- canonical role, active status, and revision; and
- whether the row belongs to the current session principal.

Email, profile data, credentials, tokens, session identifiers, assignment actor
history, expiry, and raw database errors are not projected. The server and
browser each validate the exact shape, and displayed capabilities are derived
from the canonical role rather than accepted as row authority.

## Mutations and Owner safety

The reviewed architecture supports changing or revoking an existing active
assignment. It does not yet define a safe principal discovery, invitation, or
account onboarding contract, so this implementation does not invent an “add
principal” flow.

`POST /api/admin/v1/access/change-role` and `/revoke` accept only an assignment
reference, expected revision, canonical replacement role when applicable,
bounded reason code, and UUID request identifier. The database:

1. derives the actor from `auth.uid()` and requires a current Owner;
2. serializes active-assignment mutations and reauthorizes after locking;
3. checks the target revision and refuses no-op or noncanonical roles;
4. refuses owner demotion/revocation when it would leave no valid Owner;
5. writes the minimized audit event(s) before a permitted self-demotion;
6. revokes the immutable old assignment and, for a role change, inserts a new
   canonical assignment; and
7. completes a private idempotency receipt in the same transaction.

Changing a role therefore produces correlated `admin_role.revoke` and
`admin_role.assign` audit events. Revocation produces the revoke event. Any
authorization, conflict, validation, assignment, audit, or receipt failure
rolls back the whole operation.

Migration `20260810144700_academy_admin_access_management.sql` is repository
only and is recorded as not applied to hosted Supabase in the strict migration
manifest.

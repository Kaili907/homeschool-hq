# Admin Console authorization foundation

## Boundary

This implementation conforms to the controlling ADMIN-0-R1 contract version 2.
`/academy/admin` uses the existing Supabase Auth adult identity. ADMIN-1 adds no
password, PIN, student session, email-domain, or parallel identity system.
Student Study bearers are not Supabase access tokens and are rejected by the
Supabase Auth verification step.

Browser visibility is advisory only. The browser reads a minimized versioned
authorization state from `GET /api/admin/v1/authorization`; it never reads the
role table or receives a service-role credential. Every later Admin data or
mutation endpoint must independently call the server capability boundary with a
canonical capability. Hidden routes and forged client state grant no authority.

## Canonical role and capability contract

`src/admin/contracts.ts` is the single source of truth. Roles are exactly
`owner`, `admin`, and `viewer`, with additive capability inheritance:

- `viewer` receives the resource-specific read capabilities: overview,
  learners, engines, costs, safety, health, curriculum, configuration, audit,
  and releases.
- `admin` additionally receives engine operation, safety triage, incident
  acknowledgement, and curriculum-draft write capabilities.
- `owner` additionally receives Admin-role management, global configuration,
  curriculum approval/publication, and release management capabilities.

The removed `admin:read`, `admin:operate`, and `admin:*:manage` aliases are not
accepted. Adding or renaming a capability requires an Admin contract revision.

## Server enforcement flow

1. Validate the bearer against the configured Supabase Auth `/auth/v1/user`
   endpoint with a bounded timeout.
2. Pin that exact verified access token into an authenticated Supabase RPC
   client.
3. Invoke `academy_admin_authorization_v2()` with no user, role, or capability
   arguments. The fixed-search-path security-definer function derives
   `auth.uid()` and returns only a current, active, non-revoked, unexpired role.
4. Derive the ADMIN-0 capability set from that role and require the endpoint's
   exact capability.

Missing, revoked, expired, ambiguous, malformed, timed-out, or failed lookups
deny access. Request roles, JWT user metadata, parent PIN state, query values,
and route visibility are never consulted.

## Database and lifecycle contract

Migration `20260808120000_academy_admin_authorization.sql` creates
`academy_admin_role_assignments`, linked to `auth.users`. Forced RLS has no
client policy and no application role receives direct table privileges.
`authenticated` receives only `EXECUTE` on the narrow authorization function;
`anon` and `service_role` do not.

Assignments may have an immutable `expires_at`. Expired rows remain preserved
as history but the authorization function never returns them. A partial unique
index allows at most one active assignment per user.

Role mutation is deliberately not exposed. The table permits only a one-way
active-to-revoked revision transition and refuses deletion. Its actor user/role
snapshot, bounded reason-code, revision, and correlation fields map to the
future canonical `admin_role.assign` and `admin_role.revoke` audit events, using
the assignment ID as the `admin_role_assignment` resource reference. A later
owner-only mutation function must append that Admin audit event atomically or
fail the mutation.

The migration is repository-only and has not been applied to hosted Supabase.
Its timestamp remains unchanged for dispatcher-led cross-branch reconciliation.

## Browser and ADMIN-5 seam

The browser accepts only this exact safe state:

- `contractVersion: 2`
- `status: "authorized"`
- the server-resolved canonical `role`
- the exact canonical capability array for that role

`readAdminAuthorization` fails closed for any mismatch.
`hasAdminAuthorizationCapability` lets ADMIN-5 ask for capabilities such as
`overview:read`; it remains an advisory rendering guard. ADMIN-5 must recognize
the canonical `/academy/admin` path before the learner Academy parser and must
wait for authorization resolution before rendering sensitive data.

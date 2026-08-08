# Admin Console authorization foundation

## Boundary

`/academy/admin` uses the existing Supabase Auth adult identity. ADMIN-1 adds no
password, PIN, student session, email-domain, or parallel identity system.
Student Study bearers are not Supabase access tokens and are rejected by the
Supabase Auth verification step.

Browser visibility is advisory only. The browser reads a minimized versioned
authorization projection from `GET /api/admin/v1/authorization`; it never reads
the role table or a service-role credential. Every later Admin data or mutation
endpoint must independently call the server-side authorization helper with its
required capability. A hidden route or forged client state therefore grants no
data or action authority.

## Role and capability contract

| Role | Capabilities |
| --- | --- |
| `viewer` | `admin:read` |
| `admin` | `admin:read`, `admin:operate` |
| `owner` | all admin capabilities, including role management, high-risk configuration, curriculum publication, and release management |

The exact owner-only capability identifiers are:

- `admin:roles:manage`
- `admin:config:manage`
- `admin:curriculum:publish`
- `admin:releases:manage`

Those capabilities are authorization vocabulary and integration seams only.
ADMIN-1 does not implement role management, configuration, curriculum, release,
rollback, telemetry, cost, or audit-log workflows.

## Server enforcement flow

1. Validate the bearer against the configured Supabase Auth `/auth/v1/user`
   endpoint.
2. Use only the verified Auth user ID to query one active, non-revoked
   `academy_admin_role_assignments` row through the server-held service role.
3. Derive the fixed capability set from that database role.
4. Require the endpoint's capability. Missing, revoked, duplicate, malformed,
   timed-out, or failed lookups deny access.

Request roles, JWT user metadata, parent PIN state, query parameters, and route
visibility are never consulted. The service-role key remains confined to the
Netlify helper and is not returned in the browser contract.

## Database contract

Migration `20260808120000_academy_admin_authorization.sql` creates the role
assignment table in `public` so the trusted Netlify Data API client can read it.
It references `auth.users`, permits only `owner`/`admin`/`viewer`, allows at most
one active assignment per user, and preserves revoked assignment rows.

RLS is enabled and forced with no browser policy. `anon` and `authenticated`
receive no table privileges. `service_role` receives `SELECT` only; it cannot
assign, elevate, or revoke roles. A later owner-authorized role-management
workflow requires a separately reviewed mutation boundary.

The migration is repository-only and must not be applied to hosted Supabase by
this session.

## ADMIN-0 / ADMIN-5 reconciliation seam

ADMIN-0 may reconcile endpoint naming, shared contract placement, and capability
ownership while preserving the security properties above. ADMIN-5 may use
`readAdminAuthorization` and `hasAdminCapability` to guard rendering at
`/academy/admin`, but must treat those results as presentation state only.
Protected API handlers remain the enforcement points.

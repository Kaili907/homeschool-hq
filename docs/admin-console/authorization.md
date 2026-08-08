# Admin authorization contract

## Identity and assignment source

An Admin principal is a Supabase Auth user with an active, server-controlled
Admin role assignment. The assignment references `auth.users.id`; it does not
replace Academy identity and it is not inferred from:

- request JSON, headers other than the verified bearer credential, or URL data;
- JWT `user_metadata`, browser storage, or a client capability array;
- `academy_household_memberships.member_role = 'guardian'`;
- `academy_guardian_student_access.permission_level`;
- a learner session grant; or
- the local Parent Hub/Grown-Ups PIN.

The role vocabulary is exactly `owner`, `admin`, and `viewer`. Role removal or
revocation must take effect on the next server request. Cached authorization may
not outlive the underlying session/assignment and must fail closed when freshness
cannot be established.

## Capabilities

Capabilities are additive: owner includes admin; admin includes viewer.

| Surface/action | viewer | admin | owner |
| --- | --- | --- | --- |
| Read overview, learners, engines, costs, safety, health, curriculum, configuration, audit, releases | Yes | Yes | Yes |
| Execute explicitly approved engine operations | No | Yes | Yes |
| Triage safety cases without altering source safety history | No | Yes | Yes |
| Acknowledge operational incidents | No | Yes | Yes |
| Create/edit curriculum drafts and run validation/preview/diff | No | Yes | Yes |
| Assign/revoke Admin roles | No | No | Yes |
| Manage security-sensitive/global configuration | No | No | Yes |
| Approve or publish a new curriculum version | No | No | Yes |
| Activate or roll back an application/curriculum release pointer | No | No | Yes |
| Update/delete audit history or edit a published curriculum version | No | No | No |

The exact machine names are in `ADMIN_ROLE_CAPABILITIES` in
`src/admin/contracts.ts`. A later session may add a capability only through an
explicit contract revision. It may not silently broaden a role by treating an
unknown action as allowed.

"Read" always means authorized Admin operational data. It does not grant access
to raw learner conversations, protected work, student audio, assessment answer
content, credentials, secrets, or unrestricted adult-private notes.

## Enforcement sequence

For every Admin API/RPC request:

1. Verify the Supabase access token server-side using the existing bounded-time
   pattern.
2. Reject learner session credentials and unauthenticated requests.
3. Load the active assignment by the verified `auth.users.id`; never accept a
   caller-supplied actor ID or role.
4. Resolve the role to a canonical capability and reject absent, unknown,
   revoked, expired, or ambiguous assignments.
5. Scope and validate all resource identifiers on the server.
6. Execute the narrow read or mutation. Administrative mutations append the
   required audit record atomically.

Client route guards exist only to prevent data flashes and improve navigation.
They are not an authorization decision.

## Database posture for ADMIN-1

Reuse repository conventions:

- an additive assignment relation linked to `auth.users`, rather than expanding
  household guardian semantics into global operator semantics;
- RLS enabled, with forced RLS where the repository's privileged-table pattern
  requires it;
- no `anon` access and no broad authenticated table mutation;
- exact grants on narrow security-definer functions with a fixed `search_path`;
- server-derived `auth.uid()`, current assignment status, and capability checks;
- append-only role-assignment history and reason codes for grant/revoke actions;
- service-role credentials never exposed to browser code.

An owner role is authority within this Admin contract, not a bypass around RLS,
retention, curriculum immutability, privacy, safety, or audit rules.

# Security-definer matrix

| Function family | Callable role | Required authority | Critical controls |
| --- | --- | --- | --- |
| Academic reads and writes | `authenticated` for approved subject-bound RPCs; trusted server for protected operations | Current user, household, learner, role, revision, and operation scope | Fixed `search_path`; direct table writes denied; authorization and mutation share a transaction |
| Guardian launch issue/verify/revoke | Authenticated opaque wrapper; detailed issue helper is private | Active guardian membership, guardian-to-learner relationship, grant state and revision | Public errors are non-enumerating; browser receives only opaque session reference and expiry |
| Verified academic runtime | `service_role` only | Verified unexpired launch grant plus locked learner/household/grant rows | Sentinel identity rejected; runtime operation is server-derived and transactional |
| Adult proposal/recipient/job operations v2 | `service_role` only | Exact live membership, relationship, permission, channel, route, and revisions | v1 execution grants retired; recipient-aware uniqueness; invalid jobs cancel safely |
| Worker claim/lease/attempt/receipt/rate-limit/monitoring v2 | `service_role` plus verified worker headers | Active opaque credential, version, configuration, scope, expiry, and revocation state | Caller worker ID is not authority; revision-bound CAS; immutable attempts/events/receipts |
| In-app delivery v2 | `service_role` plus worker context | Database policy `approved` and live recipient authorization inside the delivery transaction | Approval is not trusted from environment or caller; event and receipt bindings are checked |
| Parent notification list/read | `authenticated` | Current guardian membership, permission, route and revisions | No detailed issue leakage; authorization is rechecked for every read |
| Readiness | Appropriate authenticated/server boundary | All required marker, policy, identity, registry, worker and durable-port states | Missing/malformed components normalize to not-ready |

Database tests cover function ownership, `SECURITY DEFINER`, fixed search paths, grants/revokes, volatility, cross-household rejection, opaque errors, worker credential rejection, and live revocation. No broad public execution grant is accepted for the final v2 operational surface.

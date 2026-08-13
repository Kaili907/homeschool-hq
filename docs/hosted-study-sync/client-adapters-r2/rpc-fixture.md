# R2 injected RPC fixture

All calls use an authenticated-user provider supplied by an ephemeral auth
lease. There is no direct HTTP, Supabase singleton, or service-role dependency.

| Client method | Fixture RPC | CAS/input | Success |
| --- | --- | --- | --- |
| `firstLinkImport` | `academy_study_sync_first_link_import_v2` | base `0`, adult confirmation, stable UUID, snapshot | stored or duplicate revision |
| `hydrate` | `academy_study_sync_hydrate_v2` | stable scope refs | unavailable or lossless snapshot + revision + last operation UUID |
| `revisionedWrite` | `academy_study_sync_revisioned_write_v2` | immutable base revision, stable UUID, snapshot | stored, duplicate, stale revision, or refusal |
| `acknowledge` | `academy_study_sync_acknowledge_v2` | stable acknowledgement UUID, target operation UUID and revision | acknowledged or duplicate |

The injected provider returns a narrow `{ data, error }` union. Provider errors
can represent network unavailability, timeout, session expiry, rate limiting,
server unavailability, permanent refusal, or abort. Offline is determined
before authorization; missing authorization is determined by the ephemeral
auth seam; CAS stale and malformed response are determined by exact response
parsing.

The fake provider is intentionally an executable compatibility fixture. Final
convergence should adapt the parallel DB function result into this lossless
shape or record a blocking contract gap; it must not weaken exact parsing or
invent state absent from the server.

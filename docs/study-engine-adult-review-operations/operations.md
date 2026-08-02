# Rate Limits, Worker Schedule, Monitoring, and Readiness

## Durable rate limiting

The atomic server-time reservation RPC covers classification, proposal
creation, recipient resolution, worker claims, delivery attempts, and parent
notification reads. Dimensions are SHA-256 actor/household/learner/route
references. The database owns the window and clock, returns a bounded
`retryAfterSeconds`, requires an authorized worker for worker scopes, and stores
no request payload. Violation telemetry contains only scope, reason code, and
retry-after—not linkable references.

## Worker schedule

The local candidate declares a Netlify `*/5 * * * *` schedule. The default
uncomposed handler remains fail-closed. Scheduled and bounded manual invocations
must pass durable worker authorization, then readiness checks for persistence,
resolver, provider, monitoring, and schema before claiming at most 50 jobs.
Session 16 supplies the credential verifier and port composition; Session 17
supplies the worker engine and database scopes.

## Monitoring catalog

| Event | Severity | Threshold/window | Retention |
|---|---:|---:|---:|
| `proposal_backlog` | warning | 25 / 900s | 90d |
| `outbox_backlog` | warning | 50 / 600s | 90d |
| `oldest_pending_job` | critical | 900s / 300s | 90d |
| `lease_expiration` | warning | 1 / 300s | 90d |
| `repeated_worker_crash` | critical | 3 / 900s | 180d |
| `repeated_retry` | warning | 3 / 1800s | 90d |
| `indeterminate_job` | critical | 1 / 60s | 365d |
| `receipt_verification_failure` | critical | 1 / 300s | 365d |
| `recipient_resolution_failure` | warning | 5 / 300s | 90d |
| `permission_revocation` | info | 1 / 60s | 365d |
| `duplicate_suppression` | info | 1 / 300s | 180d |
| `rate_limit_threshold` | warning | 5 / 300s | 90d |
| `provider_not_ready` | error | 1 / 60s | 180d |
| `provider_timeout` | error | 3 / 300s | 180d |
| `provider_circuit_open` | critical | 1 / 60s | 180d |
| `delivery_permanent_failure` | critical | 1 / 60s | 365d |
| `unauthorized_worker` | critical | 1 / 60s | 365d |
| `cross_household_attempt` | critical | 1 / 60s | 365d |

All names have prefix `study.adult_review.`. The code catalog also declares
allowed dimensions, measurement, suggested dashboard, and runbook action. The
Supabase sink persists only the closed v2 schema; the structured server-log sink
is mandatory for ready composition. No external monitoring vendor is configured.

## Readiness matrix

| Dependency | Ready condition | Loss-sensitive degradation |
|---|---|---|
| Proposal/permission/resolver/outbox/leases/attempts | v2 migration present | block |
| Delivery route | in-app capability ready, idempotent, receipt-verifying | block |
| Receipt validator | attempt-bound verification available | block |
| Rate limiter | durable RPC and authorized scope | block |
| Monitoring | durable sink plus structured log | block |
| Worker | active registry entry with every required scope | block |
| Email/SMS | not required while policy allows durable in-app | route unavailable |

The public health shape is only `{state, schemaVersion}`. Secrets, worker IDs,
recipients, and dependency internals are not exposed.

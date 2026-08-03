# Session 13 replacement map

Session 14 does not add or modify a database migration. Its in-memory implementations are executable contract tests for the durable Session 13 adapters.

## Typed replacement points

| Session 14 boundary | Replace with Session 13 durable operation | Required reconciliation |
| --- | --- | --- |
| `proposalPort.createOrGet` | create adult-review proposal RPC | Map proposal/source identifiers and category/reason vocabulary; preserve full minimized classifier evidence without raw text; prove duplicate returns the same proposal |
| `proposalPort.claimRecipientResolution` / completion | durable resolution lease and state transition | Add lease token/expiry and recoverability; do not infer `delivered` |
| `recipientResolver.resolve` | membership/relationship/permission/private-route query | Require active guardian relationship and explicit adult-notification permission; exclude learning/identity-manager roles unless that permission is independently present |
| `outboxPort.enqueueRoutes` | outbox enqueue RPC | Create one job per authorized active route with stable opaque recipient/route refs and route-specific idempotency |
| `outboxPort.claim` | claim/lease RPC | Add lease token, expiry, concurrency safety, and expired-lease recovery |
| `outboxPort.recordAttempt` | append delivery-attempt ledger | Persist immutable proposal/job/route/provider/idempotency binding before the provider call |
| `outboxPort.recordTemporaryFailure` | retry transition | Preserve bounded server backoff, structured failure codes, retry time, and maximum attempts |
| `outboxPort.recordPermanentFailure` | terminal transition | Make terminal failure auditable and per route |
| `outboxPort.recordIndeterminate` | accepted/unknown transition | Add an indeterminate state; provider acceptance is not delivery |
| `outboxPort.recordVerifiedReceipt` | receipt-evidence insert + delivered transition | Require receipt verification, unique fingerprint, attempt binding, and atomic transition |
| `monitor.record` | durable monitoring/event sink | Store exact schema or export it transactionally; never add identifiers/raw fields to metric events |

## Observed Session 13 proposal differences

The inspected Session 13 draft uses one `structured_reason_code`, categories `wellbeing|threat|abuse|self_harm|other`, urgencies `routine|prompt|urgent|emergency`, states `proposed_not_delivered|approved|rejected|cancelled`, and a single resolved membership/access pair. Its create RPC also requires source session/event ledger rows and a trusted-service context. Reconciliation must choose an explicit lossless mapping or revise the durable contract; Session 14 must not silently collapse its classification/reason evidence.

## Observed Session 13 outbox gaps

The inspected draft provides pending/leased/delivered/retry/failed/cancelled state, attempt count, retry/error fields, delivered time, a receipt reference, and idempotency. Before production it still needs explicit route/channel records, per-route jobs, lease token/expiry, an append-only attempt ledger, accepted/indeterminate handling, receipt-evidence uniqueness and binding, and proof of provider-side durable idempotency. A non-null receipt string alone is not verified delivery evidence.

The draft recipient selection currently treats learning-manager or identity-manager access as eligible. Session 14 requires active guardian relationship, explicit adult-notification permission, and a private active route, rechecked immediately before send. These are blocking reconciliation requirements, not optional hardening.

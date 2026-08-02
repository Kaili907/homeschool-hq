# Before/After State Model

## Exact before-state

Session 13 persisted proposal states `proposed_not_delivered`, `approved`,
`rejected`, and `cancelled`; recipient states `unresolved`, `resolved`, and
`unavailable`; and outbox states `pending`, `leased`, `delivered`, `retry`,
`failed`, and `cancelled`. It did not provide the Session 17 lease recovery,
attempt-event ledger, or attempt-bound verification model.

Session 15 introduced proposal states `proposed-not-delivered`, `routing`,
`routed`, `unavailable`, `indeterminate`, and `cancelled`; recipient states
`pending`, `processing`, `resolved`, `unavailable`, and `indeterminate`; and job
states `pending`, `claimed`, `retry-scheduled`, `delivered`,
`permanent-failure`, `indeterminate`, and `cancelled`. Attempts were append-only,
but did not carry the complete lifecycle state model. Receipt presence was
treated as verification. Rate limiting covered classification scopes only, and
monitoring used the Session 15 safety schema.

The Session 15 tables already carried household/student bindings, permission
and route rows, proposal/job revisions, lease tokens and expirations, attempt
identity/idempotency metadata, receipt evidence references, guardian
relationship joins, server-only RPC boundaries, forced RLS, and durable safety
rate-limit/monitoring tables. Session 17 reconciles these rather than replacing
them.

## Canonical after-state

| Aggregate | States |
|---|---|
| Proposal | `proposed`, `accepted`, `rejected`, `cancelled`, `expired` |
| Recipient resolution | `pending`, `resolved`, `no-authorized-recipient`, `revoked`, `failed` |
| Outbox job | `pending`, `leased`, `retryable`, `indeterminate`, `delivered`, `permanent-failure`, `cancelled` |
| Attempt event | `created`, `submitted`, `provider-accepted`, `provider-rejected`, `timeout-indeterminate`, `receipt-verified`, `receipt-rejected`, `permanent-failure` |
| Receipt event | `absent`, `pending-verification`, `verified`, `rejected`, `replayed`, `mismatched` |

The migration maps historical Session 15 labels into the canonical vocabulary,
adds `operations_version = 2`, and installs migration-safe constraints. It does
not reinterpret the Session 14 safety classifications `urgent`, `uncertain`,
`clear`, or `invalid`.

## Transition invariants

- `delivered` requires an immutable, attempt-bound, verified receipt.
- Work submitted to a provider is never blindly recovered as retryable.
- An expired lease with submitted/accepted evidence becomes `indeterminate`.
- A route job is unique by proposal, recipient, and route, and also has a unique
  delivery idempotency key.
- Revocation, expiry, binding mismatch, and schema mismatch block delivery.
- Revision/CAS and lease generation prevent stale workers from committing.

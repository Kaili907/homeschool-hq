# Outbox, lease, attempt, and receipt state machine

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> leased: credential-bound claim
  leased --> pending: release or retry
  leased --> cancelled: live authorization fails
  leased --> indeterminate: submitted outcome unknown
  leased --> delivered: atomic verified attempt-bound receipt
  indeterminate --> delivered: verified reconciliation receipt
  indeterminate --> permanent_failure: verified terminal rejection
  pending --> cancelled: proposal or permission revoked
```

Delivered requires a receipt bound to receipt ID, provider, route, job, attempt, proposal, household, student, recipient reference, idempotency key, provider configuration version, accepted/delivered timestamp, verification evidence, and receipt schema version. Receipt/event replay uses a unique event-idempotency key. Cancellation is revision-aware, idempotent, and audited.

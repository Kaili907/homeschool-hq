# W4-04 — replay, crash-window, and idempotency adversarial certification

This lane supplies a deterministic, provider-neutral certification harness for
the Tutor V3 commercial path. It injects a one-shot process failure at every
required boundary and then creates a new coordinator over the same explicit
ephemeral certification state. The recovered result must equal the no-failure
result exactly.

The harness is under
`adaptive-tutor/adversarial/v4/replay-crash/`. It is test infrastructure, not a
production coordinator or persistence implementation.

## State and transition model

The pipeline uses these explicit states:

```text
received
  -> route-planned
  -> reserved
  -> dispatch-ready
  -> response-received
  -> response-validated
  -> advisory-constructed
  -> study-pending
  -> study-accepted
  -> memory-pending
  -> memory-applied
  -> telemetry-pending
  -> telemetry-emitted
  -> parent-pending
  -> complete

unknown dispatch without a pinned failover -> dispatch-unknown
any identity/authority conflict            -> quarantined
```

Every record contains an append-only transition trace. It records record
creation, every boundary entry, every state transition, each physical attempt,
injected failures, idempotent reuse, ignored late responses, and quarantine.
Each entry has a globally monotonic sequence, its exact before/after state, the
boundary when applicable, and the physical attempt identity when applicable.
The tests verify that the trace forms a continuous state chain.

The certification state is deliberately in-memory. Restart simulation passes
that explicit state to a new coordinator instance; it does not add a database,
filesystem journal, migration, outbox, or production persistence surface.

## Identity rules

- `logicalOperationRef` owns one immutable payload identity and one immutable
  route-plan identity.
- The plan contains one or two unique, ordered `physicalAttemptRef` values.
- A retry cannot replace, reorder, or append physical attempts.
- A second physical attempt is legal only when it was already in the pinned and
  reserved plan.
- An unknown primary dispatch retains its identity and reserve. A pinned
  failover may proceed; a request with no pinned failover remains pending and
  does not redispatch the unknown attempt.
- A late primary response cannot replace a response already selected from the
  pinned failover.

## Side-effect authority

The harness composes the production `InstructionalMemoryProjectionStore` and
its deterministic compare-and-set delta. The other injected ports are narrow
certification doubles with explicit idempotency ledgers:

- the provider keys execution by `physicalAttemptRef` and payload digest;
- Study keys the accepted effect by `logicalOperationRef` and exact advisory
  identity;
- memory keys the delta by logical operation and delta identity;
- telemetry keys an authority-free event by `eventRef`; and
- Parent projection derives only from the canonical accepted Study receipt and
  accepted memory revision.

Telemetry accepts only literal false values for Study authority, Study
mutation, and instructional use. Emitting or replaying telemetry never invokes
the Study ledger. Parent projection does not read telemetry or replay counts.

## Certified invariants

- Accepted Study effect executes at most once.
- Provider physical attempts obey the immutable route plan.
- Exact retry repairs missing memory after accepted Study effect.
- Conflicting payload or plan replay fails closed in quarantine.
- Duplicate provider response, Study receipt, memory delta, telemetry event,
  and Parent projection do not duplicate authority or state.
- Stale memory revision fails closed without changing the accepted projection.
- Telemetry duplication or forged telemetry authority cannot create Study
  authority.
- Parent projection is derived from accepted state, not replay side effects.

See `TEST-MATRIX.md` for the boundary/replay matrix and `VALIDATION.md` for the
commands and recorded results.

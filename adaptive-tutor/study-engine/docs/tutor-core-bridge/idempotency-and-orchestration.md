# Idempotency and supported orchestration

Session 6-R2 adds `orchestrateStudyCoreBridge` as the one supported
end-to-end entry point. Production integration must not compose the low-level
adapter, projector, or outbox builder in a different order.
The retained `executeLocalDemoStudyCoreBridgeCycle` helper is explicitly a
legacy local-demo compatibility surface; it is not a production entry point.

## Required order

1. Normalize and classify transient learner text through the configured safety
   gateway.
2. Stop on `urgent`, `uncertain`, or `invalid`. No Tutor Core callback is
   allowed on a stop result.
3. For `clear`, issue an opaque one-time processing permit.
4. Invoke Tutor Core exactly once.
5. Validate the frozen Core contracts and consume the permit at the authority
   adapter boundary.
6. Atomically append the verified, minimized event to the accepted-event
   ledger.
7. Only after the ledger returns `appended`, create the canonical Study
   projection, recommendation, and outbox proposals.

The orchestration result statuses are:

- `accepted`
- `duplicate-ignored`
- `quarantined`
- `stop-for-urgent-adult-review`
- `stop-for-uncertain-adult-review`
- `stop-invalid-input`

## Ledger contract

The injected `eventLedger.appendAcceptedEvent` implementation must enforce an
atomic uniqueness constraint on `(sessionId, eventId)`. The orchestration entry
passes an idempotency key containing a SHA-256 fingerprint of the canonical
verified event:

```text
study-core-bridge:event:v1:<64 lowercase hexadecimal characters>
```

For the same event ID and fingerprint, return `duplicate-ignored`. For the same
event ID and a different fingerprint, return `idempotency-collision`. This
distinguishes an identical replay from a modified Tutor result without storing
learner text. The fingerprint is calculated only from the already minimized
and authority-validated Tutor event.

The port response must be an exact one-field object with status `appended`,
`duplicate-ignored`, or `idempotency-collision`. `null`, unknown statuses, and
objects with extra fields fail closed as quarantine. Only an exact
`{ status: "appended" }` acknowledgment permits projection.

Duplicate and collision results never contain a Study projection or outbox
proposals. The orchestration function does not enqueue or deliver the returned
proposals.

## One-time permit behavior

Permits are opaque, identity-bound, context-bound, expiring capabilities.
Consumption revokes a permit before context or expiry checks, which means:

- a second use fails;
- an object copy fails;
- a context mismatch fails and cannot be retried;
- an expired permit fails;
- an adapter presentation with an unknown or malformed field consumes the
  capability before quarantine, so a repaired retry fails;
- urgent, uncertain, and invalid classifications never receive a permit.

The supported path does not accept a permit from a caller. It obtains the
permit directly from the configured gateway and passes it once to the frozen
Core authority adapter.

## Production safety configuration

Production must configure:

```ts
{
  mode: "production",
  classifier: productionUrgentSafetyClassifier
}
```

The deterministic classifier is available only through the explicit
`local-demo` mode. Adult-review hooks are proposals with
`deliveryStatus: "proposed-not-delivered"`; no delivery is implied.

## Failure behavior

Core callback errors, authority validation failures, ledger errors,
event-ID collisions, projection failures, and outbox construction failures
fail closed. Returned quarantine records never echo callback errors or raw
learner text.

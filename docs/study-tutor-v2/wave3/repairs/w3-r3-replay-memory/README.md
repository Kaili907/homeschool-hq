# W3-R3 — recoverable logical effect and instructional memory replay

This repair closes the split-success window where a canonical Study effect was
accepted but bounded instructional memory did not advance. The repair is a
provider-independent protocol and an ephemeral memory projection; it is not a
Tutor-owned durable Study engine and does not modify the production Study
runtime.

## Assembly identity

- Starting SHA: `e8d852c3fa374abb8f5cb93b7ecbddc1786671b2`
- Required W3-12 commit: `8c6c093632ff48551267dfa1b2846472f29335bf`
- Stable W3-12 patch-id: `a3b140021b7f119e94438d96b7450646cc4ede06`
- Cherry-picked W3-12 commit on this branch: `22c6cee2`

The stable patch-id was recorded before cherry-pick with:

```text
git show 8c6c093632ff48551267dfa1b2846472f29335bf | git patch-id --stable
```

## Contracts

`InstructionalMemoryDelta` binds one logical operation to one accepted source
event, one memory delta, one memory target, and the exact learner, session,
context, and opportunity scope. It carries:

- the expected prior revision and digest, or `null` for a new projection;
- at most 16 closed add, remove, or replace operations;
- a deterministic resulting revision and semantic memory digest; and
- literal false persistence, Study mutation, mastery, grade, placement, and
  curriculum authority flags.

Delta construction and application have no clock input and no timestamp field.
An identical replay therefore produces the same revision and digest. Unknown
fields, free prose, raw transcripts, unbounded collections, and authority
claims fail closed.

`InstructionalMemoryProjectionStore` applies deltas with compare-and-set
semantics. It records logical-operation and delta identity separately from the
memory target:

- an exact repeated delta returns `duplicate` with the existing projection;
- a different delta for the same logical operation is rejected;
- reuse of a delta identity is rejected;
- a stale expected revision or digest is rejected; and
- a scope mismatch is rejected before state can change.

The projection remains in-process and non-persistable. Accepted minimized
events are the reconstructible source; the projection is only a continuity aid.

## Recoverable protocol

The coordinator has six deterministic states:

```text
unclaimed
  -> effect-pending
  -> effect-accepted
  -> memory-pending
  -> complete

any conflicting or non-retryable boundary -> quarantined
```

The `logicalOperationRef` identifies the one canonical Study effect.
`physicalAttemptRef` values identify individual provider/adapter attempts.
Canonical lookup is not a physical attempt.

Every invocation first resolves the logical effect through
`CanonicalStudyEffectGateway.lookup`. A physical `accept` attempt is allowed
only when lookup says the logical effect is missing. If lookup returns the
accepted event, the coordinator never executes the Study effect again.

The accepted event contains the exact minimized `InstructionalMemoryDelta`.
After acceptance, memory is advanced from that event rather than from an
untrusted retry reconstruction. Consequently:

1. If memory application fails, state remains `memory-pending`.
2. An exact retry resolves the already accepted logical effect.
3. The accepted event supplies the original bounded delta.
4. Applying that delta either repairs missing memory or returns `duplicate`.
5. No second provider effect and no second memory projection are created.

The same rule handles loss of the coordinator itself: a fresh coordinator can
query the canonical effect, recover the minimized accepted event, and rebuild
the ephemeral projection.

## Failure windows

- Crash before canonical effect acceptance: retry may issue a new, distinctly
  identified physical attempt after lookup still reports `missing`.
- Crash after canonical effect acceptance but before its response: retry lookup
  discovers the accepted event and skips another physical attempt.
- Memory failure after effect acceptance: retry applies the event-carried delta
  without re-executing the effect.
- Crash after memory apply but before completion is observed: replaying the
  delta returns `duplicate` and the same revision/digest.
- Foreign or conflicting scope, effect, event, operation, delta, or revision:
  fail closed or enter `quarantined`; never guess or rebind.

## Authority and privacy boundary

Neither the delta, accepted event, projection, nor coordinator can declare or
mutate mastery, grades, placement, curriculum, or Study state. The event schema
contains only opaque identifiers, a content digest, exact scope, fixed boundary
flags, and the bounded memory delta. Raw learner/Tutor transcript, prompt,
provider response, media, diagnosis, and unrestricted prose are outside the
closed schemas. Foundation memory explicitly keeps `persistenceAllowed=false`.

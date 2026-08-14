# Cross-device database primitives

The database exposes primitives, not a client conflict policy.

## Initial hydrate

Call:

`academy_study_sync_hydrate_v1(student_id, assignment_ref, session_id)`

The authenticated caller receives one minimized document or `unavailable`.
The document includes:

- student, assignment, lesson and Study session references;
- completion state;
- independent authority/session/checkpoint server revisions;
- current segment, completed segments and safe instructional cursor;
- safety and guardian-attestation state;
- dynamic-source readiness and curriculum release version;
- last accepted authority client-operation ID and server timestamp.

RLS decides row visibility. The RPC does not accept household or actor
parameters and cannot widen its caller's row set.

## Revision-aware write

Call:

`academy_study_sync_write_v1(token_digest, student_id, assignment_ref, session_id, expected_revision, client_operation_id, operation, payload)`

Supported operations:

| Operation | Revision domain | Payload | Authority |
|---|---|---|---|
| `checkpoint:compare-and-swap` | Checkpoint | Exact existing minimized checkpoint object | Student or guardian with current exact Study grant |
| `safety:stop` | Session authority | `{}` | Student or guardian with current exact Study grant |
| `safety:clear` | Session authority | `{}` | Guardian only |
| `guardian-attestation:attest` | Session authority | `{}` | Guardian only |

Every write supplies an expected server revision and UUID client operation ID.
A mismatched revision returns `revision-conflict` plus the current revision. It
never silently overwrites newer state.

## Idempotency

Receipts are keyed by exact Study session and client operation UUID.

- Repeating the same operation, expected revision, actor scope and payload
  returns the original result.
- Reusing the operation UUID with different input returns
  `idempotency-collision`.
- Stored conflict results are stable on retry.
- Receipts expire after 180 days; clients must not reuse operation IDs.

## Session and actor binding

The write boundary resolves the opaque digest to a current grant and compares
its student and household with the canonical session row. The separately
supplied student, assignment and session values can only narrow the match; they
cannot supply authority. A mismatch returns the same denial envelope.

## Convergence ownership

The database intentionally does not decide whether a client should retry,
merge, fork, prompt or discard after a conflict. It supplies the server
revision, stable idempotent result and a fresh hydrate projection so the
transport/conflict owner can implement that policy without last-write-wins.

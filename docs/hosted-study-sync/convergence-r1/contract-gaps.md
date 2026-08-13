# Blocking contract gaps

These are authoritative-input gaps, not unrelated historical failures.
`contractGap.test.ts` makes them executable evidence.

## 1. Dynamic Social source cannot round-trip

The audited app record requires `sourceRef`, title, publisher, published time,
attached time, assignment/lesson/student binding, and satisfied status. Hydrate
returns only `dynamicSourceReadiness.state` and
`curriculumReleaseVersion`. Write accepts no source operation.

Result: Device B cannot reconstruct the exact attachment and Device A cannot
publish a local attachment through the finalized RPC.

## 2. RFL attestation cannot round-trip exactly

The audited record requires learner assertion time, status, attested time,
attesting adult ref, and evidence mode. Hydrate returns only pending/attested
plus attested time. The missing fields cannot be inferred from clocks or names.

## 3. Safety hold cannot round-trip exactly

The audited record requires hold ref, reason, source, dedupe key, created time,
status, and clear authority. Hydrate returns only aggregate state plus stop and
clear times. A conservative block can be synthesized, but that is not exact
state preservation and cannot preserve the original authority ledger.

## 4. Completion and first-link import are not sync operations

The finalized write RPC has no normal-completion, assignment/session creation,
or first-link import operation. Checkpoint CAS alone does not prove that a
locally completed session becomes completed server-side.

## 5. Transport and DB lanes are different protocols

The transport lane uses `HYDRATE/PULL/PUSH/ACKNOWLEDGE` with
`REPLACE_MINIMIZED_STUDY_DOCUMENT`. The DB lane exposes only the two per-session
RPCs above and has no pull/ack/document-replace primitive.

## 6. The 28-scenario harness is not wired to real convergence adapters

All 28 scenarios pass against its reference `HostedStudyDocument` adapters.
That synthetic model includes source attachment, safety hold, completion, and
attestation mutations that the finalized DB RPC does not expose. Replacing the
reference adapters without first resolving gaps 1–5 would merely disguise the
missing server contract.

## 7. Local and hosted checkpoint schemas are not losslessly interchangeable

The audited Family Pilot IndexedDB document stores `StudyCheckpoint`, while
the write RPC validates the larger `StudyCheckpointRecord` contract. The local
record does not contain `safeInstructionalCursor`, per-segment active-time
rows, `protectedTutorStateRef`, interaction ref, or technical-interruption
shape. A coordinator callback cannot invent those authority fields and still
claim exact resume.

These gaps prevent `HOSTED_SYNC_CONVERGENCE_READY`.

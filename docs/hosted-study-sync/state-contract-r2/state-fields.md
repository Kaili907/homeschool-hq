# State fields and authority

## Envelope

| Field | Meaning | Authority rule |
| --- | --- | --- |
| `contractVersion` | `hosted-study-sync-state.r2.v1` | Exact match only. |
| `identity.householdRef` | Household binding | Must match expected import scope and IndexedDB scope. |
| `identity.studentRef` | Family Pilot student binding | Every app/Core state record must match. |
| `identity.learnerRef` | Current Study learner binding | Every durable session/checkpoint/calendar record must match. It is never inferred from `studentRef`. |
| `sync.serverRevision` | Last known canonical server revision | Non-negative safe integer. |
| `sync.baseRevision` | CAS base for this operation | Non-negative and not greater than `serverRevision`. |
| `sync.operationId` | Retry-stable UUID | Must equal `idempotencyKey`. |
| `sync.idempotencyKey` | Server idempotency identity | Same UUID and snapshot semantics on every retry. |
| `sync.operationKind` | Explicit state transition class | Includes import, upsert, normal completion, and all blocked convergence operations. |
| `sync.deviceRef` / `localSequence` / `createdAt` | Bounded client provenance | Metadata only; never user authority. |

One revision domain governs the complete canonical document. R2 does not split checkpoint and authority revisions, because independently acknowledging those projections produced states that no single device could reconstruct.

## Student, assignment, session, checkpoint

`student` is the exact current `FamilyPilotStudentRecordV1`. Each `assignments[]` entry repeats its exact assignment record and adds:

- `authorityRevision`;
- explicit `sessionIdentity` (`assignmentRef`, `lessonRef`, `blockRef`, `sessionRef`, lineage root and continuation key);
- explicit completion kind: incomplete, normal certified, RFL pending guardian, or RFL certified.

The exact current Study authorities are carried in `indexedDbDocument`:

- calendar blocks and lesson plans;
- session state and last accepted event ref;
- current `StudyCheckpoint` revision and captured segment;
- completed segments;
- resume point, remaining segments, and per-segment active time in the calendar authority;
- calendar occurrence lineage and interruption state;
- minimized reviews, safe events, and outbox proposals;
- current learner preferences and parent settings where present.

The current checkpoint schema is the wire schema. No field is invented to imitate `StudyCheckpointRecord`. A future checkpoint format requires a new contract version and explicit conversion.

## Normal completion

`NORMAL_CERTIFIED` requires an exact current Core `completed` record and identical non-null `completedAt`. It is transported with operation kind `NORMAL_COMPLETION`. Completion is never inferred from a missing current segment or from a 100% display projection.

## Assessment

`assessmentStates[]` carries assignment/assessment/course/student binding, authority class, logical revision, and these explicit states:

- `PLANNED`
- `ACTIVE`
- `PENDING_ASSESSMENT`
- `SCORING_COMPLETE`
- `ADULT_REVIEW_REQUIRED`
- `PENDING_GUARDIAN_ATTESTATION`
- `CERTIFIED`

An optional minimized outcome contains only an assessment record ref, decision, assessed time, and assessor ref. `evidenceRefs` are opaque. Answer bodies, answer keys, restricted scoring authorities, and scoring guides have no DTO field.

The current local app cannot represent `SCORING_COMPLETE` separately from its pending metadata row. The R2 DTO can, so a future hosted scorer does not collapse a scored result back to pending. The pure import seam conservatively projects that state to current local `PENDING_ASSESSMENT`; the R2 snapshot remains the higher-fidelity authority until app wiring adopts it.

## Ready for Life

`rflStates[]` is exact and revisioned:

- learner assertion is explicit (`ASSERTED` plus `learnerAssertedAt`);
- guardian state is `PENDING` or `CERTIFIED`;
- `certifiedAt`, `attesterRef`, and evidence mode are required together for certification and forbidden while pending;
- `authorityRevision` selects state, never timestamps.

## Social source

`socialSources[]` carries the exact minimized source metadata already used by the final app: student/assignment/lesson binding, source ref, kind, title, publisher, published time, attached time, readiness, and `sourceRevision`. Full article text and arbitrary website content are excluded.

## Safety

Every `safetyHolds[]` entry carries:

- `holdRef`, student/session identity, reason code, closed category, source, and dedupe key;
- created/acknowledged/cleared times;
- `OPEN`, `ACKNOWLEDGED`, or `CLEARED`;
- `GUARDIAN` clear authority and exact `clearerRef` only when cleared;
- monotonic `logicalRevision`.

Open and cleared holds remain in the ledger. A clear does not delete or replace the original hold identity.

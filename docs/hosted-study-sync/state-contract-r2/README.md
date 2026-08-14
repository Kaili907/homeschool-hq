# Hosted Study sync state contract R2

Status: `LOSSLESS_SYNC_STATE_CONTRACT_READY`

Contract version: `hosted-study-sync-state.r2.v1`

This package defines one student-scoped, minimized cross-device state document. It is derived from the learner-ready Family Pilot at `7baf8dfbc27168708ed4cf504285a1838d7345f6`; the convergence candidate at `bc907416dc33d00e7b814915d7d522d4ae443e41` is gap evidence, not an implementation dependency.

Code lives in `src/study/hosted-sync/v2/contracts`. This slice contains DTOs, strict parsers, pure local conversion, fixtures, and tests only. It has no migration, network client, RPC, database, app wiring, or hosted contact.

## Canonical decision

`HostedSyncStateSnapshotR2` is the sole canonical document. Every mutation carries the complete minimized student snapshot plus one `serverRevision`, one `baseRevision`, one UUID `operationId`/`idempotencyKey`, and an explicit operation kind. This removes the former split between transport document replacement, per-session database operations, and harness-only state.

The operation vocabulary includes:

- `FIRST_LINK_IMPORT`
- `UPSERT_ASSIGNMENT_SESSION`
- `CHECKPOINT`
- `NORMAL_COMPLETION`
- `ASSESSMENT_TRANSITION`
- `RFL_TRANSITION`
- `SOCIAL_SOURCE_ATTACHMENT`
- `SAFETY_TRANSITION`
- `FULL_STATE_REPLACEMENT`

`FIRST_LINK_IMPORT` and `UPSERT_ASSIGNMENT_SESSION` are upserts by contract. A receiving device or eventual persistence adapter must not require pre-existing assignment or session rows. `NORMAL_COMPLETION` is a first-class operation rather than an inference from a checkpoint.

## Why the IndexedDB document is carried intact

The current accepted `DurableStudyDocumentV1` is already a minimized, student-scoped persistence contract: raw-answer and transcript markers must be literal `false`, response drafts are opaque refs, and safe-event payload keys are allowlisted. Its calendar block is the Study Engine authority for exact segment position, lineage, interruption history, active time, and completion. Its checkpoint is the current `StudyCheckpoint`, not the incompatible larger hosted checkpoint proposal.

R2 therefore carries the exact validated current document as `indexedDbDocument`. It does not synthesize a hosted checkpoint and does not depend on a target-device curriculum template. This is the lossless choice. Copying only a projected cursor would recreate the convergence blocker because it cannot reproduce the current calendar/session/checkpoint/event authorities exactly.

## Fail-closed boundary

`parseHostedSyncStateSnapshotR2` refuses:

- unknown contract versions;
- unknown top-level or DTO fields;
- identity mismatch against an expected household/student/learner scope;
- any student-scoped record belonging to a sibling;
- invalid, negative, unsafe, or causally impossible revisions;
- mismatched operation/idempotency UUIDs;
- assignment/session/lesson/lineage records that do not match the exact IndexedDB authority;
- dangerous browser authority claims such as roles, permissions, claims, admin flags, adult authorization flags, or server IDs;
- privacy canaries and non-false minimization markers.

Unknown Safety status values are not accepted into the cross-device authority contract. Current local recovery remains conservative, but a sync write must use the closed R2 state vocabulary so two devices cannot disagree on whether a hold blocks.

## Files

- `types.ts`: versioned DTOs and operation vocabulary.
- `parser.ts`: total fail-closed parser and serializer.
- `localConversion.ts`: pure current-local export and receiving-device upsert seam.
- `stateContract.test.ts`: actual current-document fixtures, round-trip proof, privacy canaries, and adversarial parser coverage.
- `vitest.config.mjs`: isolated offline contract-test configuration.

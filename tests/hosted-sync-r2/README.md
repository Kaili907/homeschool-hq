# Hosted Family Pilot sync E2E R2 harness

This is a local acceptance harness only. It does not import a hosted SDK, open a
network connection, apply a migration, or change production code.

The harness exercises the current learner-ready Family Pilot persistence model
as one synchronized learner aggregate:

- `FamilyPilotStudentRecordV1` / `FamilyPilotAssignmentRecordV1` for assignment
  state, progress, resume, and completion.
- `FinalFamilyPilotAppStateV1` child records for setup, saved sessions, Social
  source metadata, assessment assignment status, Ready-for-Life attestations,
  and safety holds.
- `DurableStudyDocumentV1` for the current IndexedDB Study session and
  checkpoint records.
- `FinalAssessmentAttemptV1` for the current IndexedDB assessment responses and
  lifecycle.
- `LearnerResponseRecord` for question-response custody and trusted assessment
  receipts.

Every server snapshot is passed through the current production parsers for core,
final-app, and durable Study state. The assessment/response records are checked
against their current closed status and identity contracts.

## Device model

Each `HostedSyncDeviceR2` has an `IndependentDeviceStore`, its own authorization
session, independent pending queue, and independent clock offset. The device
stores PIN digests locally because that is the current application shape, but
the sync aggregate has no PIN field. Tutor transcript state is ephemeral and is
also absent from every RPC.

An aliased device store is rejected immediately with
`shared-device-storage-detected`.

## Server model

`InMemoryR2Server` is the sole authority for this harness. It implements three
local R2 RPCs:

- `family_pilot_sync_first_link_r2`
- `family_pilot_sync_pull_r2`
- `family_pilot_sync_push_r2`

It scopes every call to the authenticated household and student grants, uses a
per-learner server revision, assigns server receipt timestamps, deduplicates by
idempotency key, and returns a current household cursor. A stale mutation is
rebased as a semantic operation over the authoritative document. Device time is
diagnostic evidence only and whole-document last-write-wins is not used.

## Privacy canaries

The server rejects a push containing a PIN digest, bearer token, Tutor
transcript, restricted adult scoring authority, answer key, correct answer, or
rubric. Learner response values are expected to synchronize within the
authorized household; restricted scoring authority is not.

## Run

```sh
npm test -- --project root-app tests/hosted-sync-r2/acceptance.test.js
```

The test file contains 32 cataloged acceptance scenarios (the prior 28 plus four
R2 first-link/assessment scenarios) and four harness/negative-control tests.

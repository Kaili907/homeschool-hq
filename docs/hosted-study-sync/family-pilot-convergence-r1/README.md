# Current Family Pilot + Hosted Sync R2 convergence R1

Status: `FAMILY_HOSTED_SYNC_CONVERGENCE_R1_READY_FOR_STAGING_REVIEW`

This tree merges Hosted Sync R2 input
`a6aaeee54e057d01124bc5cb6c1fdd3718b4e888` into current Family Pilot base
`a7c6edee867e0d3f546aaa6e0442fac434b75c84` without activating hosted sync.
The integration uses a Git merge so the complete accepted R2 history, state
contract, client, RPC surface, local emulator, migration chain, and evidence are
present rather than replaying only the final input commit.

## Runtime ruling

- Hosted sync is a literal `false` and remains unwired.
- Local Family Pilot storage and durable IndexedDB remain sufficient.
- No environment flag, provider factory, Supabase client, or background worker
  can activate the converged sync modules.
- The Parent Hub shows only `Local only` by default. The closed vocabulary for a
  future host is `Local only`, `Sync ready`, `Syncing`, `Up to date`, and
  `Needs attention`. Learner surfaces receive no sync errors.

## Current product mapping

The accepted `hosted-study-sync-state.r2.v1` checkpoint carries exact minimized
current authority for:

- nominal grade, enabled subjects, and per-subject working levels;
- Core assignment lifecycle and deterministic assignment references;
- exact durable IndexedDB calendar, session, checkpoint, progress, review,
  event, preference, parent-setting, and minimized outbox state;
- assessment, RFL, Social source metadata, and Safety state.

The R2 parser now validates working levels against the canonical
`ACADEMY_GRADES` authority. This closes the current Grade 9–12 mismatch while
retaining the deliberate Grade 6 exclusion.

Dashboard state remains a derived read model and is not synchronized as a
second authority.

## Auto Planner boundary

The School Plan and automatic-materialization provenance document stays in the
existing device-local IndexedDB record because it is not part of the accepted
R2 allowlist. The convergence seam returns that local document explicitly on
export and hydrate and never deletes it as fallback.

Assignments created by the current planner use deterministic
`finalAssignmentRef(studentRef, lessonRef)` and
`finalAssessmentAssignmentRef(studentRef, assessmentRef)` identities. Hydrated
Core/assessment facts therefore suppress a second materialization even when a
receiving device has the same School Plan but no local provenance row. A
planner-to-assignment mismatch becomes Parent `Needs attention`; it does not
delete data or create another assignment.

## First link, hydrate, write, and conflict rules

First link retains the accepted explicit Parent review, resumable manifest,
idempotent operations, exact readback verification, and local commit only after
verified hosted import. It never replaces local state merely because another
device is connected.

Hydrate imports the exact selected student checkpoint into an empty receiving
device and preserves the receiving device's local planner record. Writes use
the accepted whole-checkpoint CAS/idempotency domain. Concurrent writers receive
an explicit revision conflict; no timestamp-only winner or destructive merge is
invented. The losing device hydrates current authority and retries only a still
valid local intent with its stable operation identity.

Offline adapter outcomes occur before authorization/provider dispatch. Local
Study continues using IndexedDB. The convergence adds no new queue; callers may
retry only the same stable operation under the existing R2 contract.

## Privacy allowlist

The strict deny-by-default R2 checkpoint and pre-network serializer remain
unchanged. Hosted state never includes Parent/student PINs or their digests,
bearer/access/refresh tokens, provider credentials, answer authority or answer
material, Tutor transcripts or conversations, excluded raw learner responses,
audio, emotional labels, personality judgments, or diagnostic inference.

The Auto Planner document remains outside hosted payloads. Dashboard
presentations and learner technical errors are also outside the wire contract.

## Migrations and hosted contact

Included, in order, but not applied:

1. `20260813170000_academy_study_actor_authority_convergence.sql`
2. `20260813171000_academy_study_cross_device_authority.sql`
3. `20260813172000_academy_study_sync_lossless_v2.sql`
4. `20260813173000_academy_study_sync_lossless_checkpoint_r1.sql`

No hosted Supabase project was read, contacted, migrated, or mutated. Database
verification is local/emulated only.

## Local proof

The convergence-specific suite proves default-off/local-first policy, Grade 12
working-level round-trip, forbidden local-access omission, exact R2 parsing,
planner retention through hydrate, deterministic no-duplicate behavior on a
receiving device, non-destructive attention handling, and Parent-only status
copy. The accepted R2 suites continue to prove two-device checkpoint progress,
CAS conflict, offline retry, first-link readback, full privacy gates, and local
DB/RPC behavior.

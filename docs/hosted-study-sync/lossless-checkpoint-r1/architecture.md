# Lossless checkpoint authority repair

## Root cause

R2 named the complete `HostedSyncStateSnapshotR2` as the canonical cross-device document, including the exact `DurableStudyDocumentV1`. The hosted DB stored a normalized row for one session and one different recovery-checkpoint contract. `hydrate_v2` therefore returned a synthetic, single-session document. Calendar placement, lineage, segment occurrence state, resume/interruption history, preferences, parent settings, all other sessions/checkpoints, reviews, events, outbox, full assignment progress, outcome metadata, and authority revisions could not be reconstructed without defaults or invention.

## Repaired representation

Migration `20260813173000_academy_study_sync_lossless_checkpoint_r1.sql` adds `academy_private.study_sync_authority_checkpoints_r1`, one row per server-bound household/student. It stores only the accepted minimized `hosted-study-sync-state.r2.v1` document and its document CAS revision. The existing normalized session/checkpoint/assessment/RFL/Social/Safety tables remain available for granular enforcement and compatibility.

The checkpoint is not a browser-database dump. It is the already-approved student-scoped R2 DTO, with:

- a 2 MiB byte ceiling;
- exact top-level and nested allowlists through every continuation path;
- closed contract version;
- literal-false privacy markers;
- server binding to the authenticated household/student and explicit local learner mapping;
- operation UUID equality and base/server revision checks;
- forced RLS, postgres ownership, no browser table grants, and authenticated RPC-only access;
- absorbing normal/RFL completion, certified RFL, attached Social source, and cleared Safety state checks;
- UUID idempotency receipts and stale CAS refusal.

The four public RPC names/signatures remain unchanged. Legacy imports and granular operations continue to work. Repaired calls add `authorityCheckpoint` to first-link/hydrate and use `authority-checkpoint:compare-and-swap` for deterministic whole-document CAS.

## Hydrate invariant

`authorityCheckpointFromHydrateR1` refuses when the authority checkpoint is absent, malformed, identity-mismatched, or revision-mismatched. It never calls the clock, reads a receiving-device lesson template, or supplies a default authoritative field. The existing pure importer installs the exact durable document into an empty Device B, while PIN enrollment remains local.

## Privacy boundary

`serializeAuthorityCheckpointPrivacyGateR1` applies the production privacy-gate pattern from `37636fb3d7a6c1ceacc43d946de1eab94a765613`: deny-by-default fields, credential-shaped value rejection, canonical validation, an explicit byte limit, opaque sealed serializer output, and a pre-network gate that refuses arbitrary objects/strings. It is an unwired test seam; `HOSTED_SYNC_PRODUCTION_ACTIVATION.enabled` remains `false`.

Safety enforcement metadata approved by the R2 state contract (`reasonCode`, `source`, `dedupeKey`) remains allowed; learner text, inference, answer material, credentials, and PIN material remain forbidden. No production network activation was added.

# Hosted Study sync R2 convergence R1

## Classification

`BLOCKED`

The candidate is internally coherent at the DB RPC boundary and remains fully
disabled in Family Pilot. The exact four SQL functions now match the client,
the 36-scenario adapter harness runs against that surface, first-link planning
is explicit and name-blind, and all authoritative DB migrations replay locally.

It is not `HOSTED_SYNC_R2_CONVERGENCE_READY` for two independent reasons:

1. no mandatory production pre-network privacy serializer exists in this
   isolated branch; and
2. `hosted-study-sync-state.r2.v1` contains the exact full
   `DurableStudyDocumentV1`, while the DB contract stores and hydrates one
   `study-core-bridge.recovery-checkpoint.v1` per session. Neither representation
   contains enough information to reconstruct the other without invention.

Activation is mechanically impossible through
`HOSTED_SYNC_PRODUCTION_ACTIVATION.enabled === false`. No hosted database was
contacted or changed, and no legacy Profile sync was added.

## Candidate tree

```text
docs/hosted-study-sync/r2-convergence/
  README.md
  contract-and-rpc.md
  input-ledger.md
  validation-report.md
  blockers.md
src/study/hosted-sync/v2/
  contracts/                 canonical hosted-study-sync-state.r2.v1
  linking/                   explicit Parent first-link plan/coordinator
  client/                    exact DB/RPC adapter + closed activation gate
tests/hosted-sync-r2/        36-scenario converged adapter harness
supabase/migrations/
  20260813170000_academy_study_actor_authority_convergence.sql
  20260813171000_academy_study_cross_device_authority.sql
  20260813172000_academy_study_sync_lossless_v2.sql
```

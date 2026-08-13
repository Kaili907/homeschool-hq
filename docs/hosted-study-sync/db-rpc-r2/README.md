# Hosted Study DB/RPC lossless convergence R2

Status: local database implementation and proof only. No hosted Supabase
project was contacted and no deployment or hosted apply was performed.

R2 adds one migration after the R1 authority pair:

- `20260813172000_academy_study_sync_lossless_v2.sql`

The migration keeps `academy_study_sessions` and `academy_study_checkpoints`
canonical. It extends the existing one-to-one session authority row with exact,
minimized Social source, RFL attestation, safety-hold history, and assessment
state. The only new table is a private explicit stable-reference link ledger;
it is mapping metadata, not a parallel Study document schema.

The executable proof is
`supabase/academy-study-sync-lossless-v2.db.test.ts`. See
`contract.md`, `lossless-proof.md`, `local-validation.md`, and
`hosted-apply-runbook.md` in this directory.

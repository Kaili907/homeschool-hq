# Hosted staging/apply checklist and rollback

## Prerequisites before authorization

- Resolve every item in `contract-gaps.md` with an audited server contract.
- Add exact first-link assignment/session lineage mapping.
- Add lossless source, safety, attestation, and completion hydrate/write fields.
- Choose one transport protocol and retire or explicitly scope the other.
- Run all 28 scenarios against adapters that instantiate the real identity
  bridge, RPC client, reconciliation policy, and independent IndexedDB stores.
- Re-run local PGlite, typecheck, production build, browser bundle scan, and
  Family Pilot suites.

## Separately authorized staging sequence

1. Backup schema/ACL/function definitions and record migration table state.
2. Apply migrations to a non-production Supabase project only.
3. Verify function signatures, owners, ACLs, forced RLS, and service-role denial.
4. Seed two households, two siblings, two independent browser profiles, RFL,
   Social source, safety, completion, and revoked-grant fixtures.
5. Enable `HOSTED_SYNC_STAGING` only for test configuration.
6. Run the real 28-scenario suite plus bundle/network inspection.
7. Confirm no credential or forbidden privacy field in browser storage,
   requests, logs, DB rows, or backups.
8. Produce an apply ruling; do not promote automatically.

## Rollback

- Disable hosted sync back to `WEB_PILOT_LOCAL_ONLY`; local IndexedDB work
  remains authoritative and usable.
- Stop queue processing without deleting queued metadata.
- Revoke Study grants used for staging.
- Restore staged function/ACL definitions from the pre-apply snapshot or apply
  a reviewed forward rollback migration. Never rewrite production migration
  history in place.
- Preserve local documents, conflict diagnostics, and idempotency receipts for
  audit; do not clear learner work as rollback.

# Hosted apply runbook — do not execute in this session

This is an operator runbook, not authorization. This branch must not contact a
hosted Supabase project, apply a migration, or deploy.

## Preconditions

1. Obtain a separate, explicit hosted-change authorization naming the exact
   project and maintenance window.
2. Independently verify the project identity. Do not infer it only from a local
   config file or manifest.
3. Take a read-only hosted inventory of migration versions/checksums, Study
   persistence markers, relevant table/column/constraint/trigger definitions,
   function identities/owners/search paths/ACLs, and RLS policies.
4. Reconcile the inventory against every ordered entry in
   `docs/study-engine-final-production/migration-manifest.json`. Stop on an
   unknown migration, checksum drift, marker drift, object collision, or an
   already-present `20260813172000` with different bytes.
5. Verify `cross_device_authority_version = 1`, both R1 migration names are in
   the singleton marker, and `lossless_sync_version` is absent. Confirm the four
   V2 RPC signatures and private link table are absent.
6. Take and verify a recoverable hosted backup using the approved operations
   process. Restore it into isolated local PostgreSQL and replay every pending
   migration there first.

## Staged apply

1. Keep hosted-sync feature routing disabled.
2. Apply complete migration files in manifest order through the approved
   Supabase migration workflow. Do not paste fragments into the Dashboard SQL
   editor, rename versions, edit historical bytes, or use browser service-role
   credentials.
3. Apply `20260813170000`, `20260813171000`, and `20260813172000` only if each is
   absent and its predecessor proof passes.
4. Stop immediately on any SQL error. Do not manually repair around a failed
   transaction.

## Post-apply verification before activation

1. Verify `lossless_sync_version = 2`, the exact migration marker, security
   manifest keys, and exact LF checksum.
2. Verify owner `postgres`, fixed `search_path = pg_catalog`, and
   security-definer status for the four V2 RPCs.
3. Verify only `authenticated` has execute; `anon` and `service_role` must not.
4. Verify the private link ledger has no grants to `anon`, `authenticated`, or
   `service_role`. Verify the public authority table remains forced-RLS and has
   no browser mutation policy.
5. Verify existing authority-row count is unchanged and new JSON fields contain
   only their additive defaults.
6. Run synthetic two-household and sibling probes for first link, repeat link,
   existing remote state, mapping, hydrate, all write operations, three stale
   revision domains, duplicate/lost retry, wrong actor/scope, privilege splits,
   checkpoint integrity, and revocation.
7. Keep feature routing disabled until application transport acceptance passes
   against these exact V2 envelopes.

## Rollback/containment

The immediate recoverable response is to keep or return the caller feature flag
to disabled and, under a separately authorized migration, revoke execute on the
four V2 RPCs from `authenticated`. The schema is additive. Do not drop the link
ledger, authority fields, receipts, or imported canonical state after use; data
removal requires a separate retention/export plan and reviewed migration.

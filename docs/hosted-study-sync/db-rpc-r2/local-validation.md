# Local validation

Environment: local PGlite/PostgreSQL semantics only. Hosted contact: none.

The R2 database test replays the complete authoritative Study chain from
`schema.sql` and student identity through the R1 actor/cross-device migrations
and R2 lossless migration. It covers:

- fresh install and additive upgrade defaults for existing authority rows;
- function ACLs and absence of browser grants on the private mapping ledger;
- forced-RLS household, guardian, sibling, and exact student-principal reads;
- wrong household, student, sibling, assignment, session, and actor denial;
- guardian-only first link, RFL attestation, and safety clear;
- permitted student checkpoint, RFL assertion, and safety hold;
- all authority/session/checkpoint CAS domains and stale conflicts;
- duplicate operation, changed-payload collision, and lost-response retry;
- first import, repeat import, existing-remote link without overwrite;
- explicit mapping resolution and name-free identity behavior;
- exact hydrate after import and after subsequent writes;
- checkpoint integrity and complete checkpoint schema;
- completion, assessment, Social, RFL, and safety metadata;
- immediate grant revocation for hydrate, write, and RLS.

Final local results:

- `npm run migration:check`: READY, 53 migrations.
- `npm run test:hosted-sync-db-rpc-r2`: 3 files, 22 tests passed.
- `admin-database-security.db.test.ts` plus independent embedded-PostgreSQL
  `academy-cas.postgres.test.ts`: 2 files, 12 tests passed.
- `npm run typecheck`: passed.
- `git diff --check`: passed.
- Broad `vitest run supabase`: 49 files and 683 tests passed, with 4 initially
  skipped because the optional embedded-PostgreSQL package had not hydrated its
  macOS ICU symlinks. After running that package's postinstall hydration, all 4
  independent PostgreSQL tests passed. One unrelated pre-existing
  `study-engine-adult-review.db.test.ts` assertion remains red: the isolated
  historical Session 17 chain raises its event-idempotency unique constraint
  where the test expects `STUDY_IN_APP_ATTEMPT_NOT_SUBMITTED`. That test does
  not load any R1/R2 hosted-sync migration; R2 does not modify it.

No hosted result is claimed by this evidence.

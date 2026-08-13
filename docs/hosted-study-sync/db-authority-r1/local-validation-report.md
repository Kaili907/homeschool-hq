# Local validation report

Date: 2026-08-13 (America/Detroit).

No Supabase CLI, Docker daemon or system `psql` executable was available in
this worktree environment. Validation used the repository's pinned PGlite
PostgreSQL runtime. No hosted connection string or hosted endpoint was used.

## Results

| Validation | Result |
|---|---|
| Targeted fresh Study chain plus both new migrations | Pass |
| Full ordered repository migration replay | 52/52 applied |
| Full database security catalog audit | Pass; no unprotected base tables, unsafe definer search paths, public/anon definers, dynamic-SQL definers or non-Postgres owners |
| Migration versions/checksums/dependencies | Pass; 52 unique migrations |
| Explicit forced-RLS obligations | 79/79 present and forced |
| Unexpected object owners | None |
| Required final service routines | 14/14 present |
| Unexpected service-grant revocations | None |
| Authority/RLS functional probes | 7/7 pass |
| Complete existing + new Study DB regression | 162/162 pass across 15 files |
| Manifest/preflight tests | 21/21 pass |
| TypeScript typecheck | Pass |
| Git whitespace/error check | Pass |

Commands:

```text
npm run migration:check
npm run migration:replay:admin
npm run db:security:audit
npm run typecheck
npx vitest run supabase/academy-study-cross-device-authority.db.test.ts --reporter=verbose
npx vitest run $(rg --files supabase | rg '(study.*\.db\.test\.ts$|academy-study.*\.db\.test\.ts$)') --reporter=dot
npx vitest run supabase/study-engine-migration-manifest.test.ts scripts/study-migration-preflight.test.ts --reporter=verbose
```

The targeted suite proves:

- both verifier shapes coexist and the actor-aware shape accepts only the
  correct durable guardian actor;
- a null actor fails closed;
- forced RLS isolates guardians, students and a same-household sibling;
- missing actor and wrong household/student/assignment/session bindings fail;
- students cannot attest guardian work or clear safety;
- duplicate operation replay is stable and conflicting reuse is rejected;
- stale revisions return the current server revision;
- checkpoint CAS hydrates only minimized progress;
- grant revocation removes student RLS visibility and denies writes;
- authenticated browser calls do not require `service_role`.

The full replay is both fresh-database and practical upgrade-path evidence: it
applied the two additive `20260813…` migrations after the exact current
50-migration chain. An upgrade restored from actual hosted data was not run,
because hosted Supabase contact was explicitly prohibited.

The full replay also reports nine older foundation tables with RLS enabled but
not forced. Those tables were not declared as forced-RLS obligations by their
historical migrations. Every table the chain explicitly requires to be forced,
including the new Study authority table and all existing Study private/public
tables, passed the forced-RLS check.

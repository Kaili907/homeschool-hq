# Family Cloud Sync R1 local verification evidence

All commands in this record are local-only. Database tests use PGlite; browser
cloud behavior uses `LocalDbRpcEmulator`; browser networking is limited to the
loopback application server. No Supabase project is configured or contacted.

| Area | Command | Result |
|---|---|---|
| Exact remote tips | `git ls-remote origin <four exact branch refs>` | PASS — each required SHA was the branch tip |
| Converged Auth/data/client contracts | focused Vitest over cloud-auth, family-services, Hosted Sync client/contracts/Family Pilot | PASS — 10 files, 54 tests |
| Family Pilot focused regression | `npx vitest run src/study/family-pilot` | PASS — 108 files, 1,093 tests |
| Hosted Sync R2 | `npm run test:hosted-sync-r2` | PASS — 38 tests |
| DB/schema/RLS/RPC | `npm run test:hosted-sync-db-rpc-r2` | PASS — 3 files, 26 PGlite tests |
| Two-device/fresh-device proof | `npm run test:family-two-device-e2e` | PASS — 1 real-browser scenario |
| Local product + backup/restore | `npm run test:family-pilot-browser` | PASS — 14 Playwright tests |
| TypeScript | `npm run typecheck` | PASS |
| Enabled production build + answer audit | `VITE_FAMILY_PILOT_ENABLED=true npm run build` | PASS — 606 modules; zero answer-authority occurrences/findings |
| Runtime isolation | `npm run audit:family-pilot-runtime-isolation` | PASS — isolated Family graph, zero forbidden modules |
| Curriculum/product launch | `npm run audit:family-pilot-launch` | PASS — 90 courses, 8,292 lessons, 699 assessments |
| Migration collision/hash validation | `npm run migration:check` | PASS — 57 unique migrations |
| Production target guard | `node --test scripts/hosted-sync-preflight/preflight.test.mjs` | PASS — 11 tests, including production and URL/ref mismatch refusal |

The local browser cloud scenario additionally asserts zero non-loopback browser
requests. The database suite bootstraps all migrations in an in-memory PGlite
database. Neither path has credentials or a hosted endpoint.

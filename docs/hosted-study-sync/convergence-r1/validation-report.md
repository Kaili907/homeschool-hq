# Validation report

## Passing

- Exact authoritative SHA/ref verification: 7/7.
- Hosted sync identity/transport/reconciliation/E2E/convergence suite:
  22 files, 171 tests.
- Focused convergence suite: 8 files, 24 tests.
- Convergence production browser boundary: 2 tests.
- Local PGlite DB authority: 1 file, 7 tests.
- Relevant Family Pilot/IndexedDB/final-readiness/final-app/final-E2E/web gate:
  9 files, 78 tests.
- TypeScript `tsc --noEmit`: pass.
- Production Vite build and service-worker stamp: pass (existing chunk-size
  advisory only).

The 28 hosted E2E scenarios pass only on reference adapters. This is not counted
as the required real-adapter proof.

## Mutants / negative controls covered

- wrong household/student/sibling;
- stale/revoked grant;
- LWW and timestamp-only authority;
- student attestation and student safety clear;
- missing/stale CAS revision;
- duplicate operation double application and lost acknowledgement;
- PIN, bearer, raw Tutor/private content;
- network failure erasing local progress;
- completion, certification, and safety regression.

## Hosted contact

None. All database work used local PGlite. No migration was applied to hosted
Supabase and no production deployment was attempted.

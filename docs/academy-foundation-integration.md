# Academy foundation controlled integration

This local integration branch combines three independently approved histories:

1. `feat/academy-fresh-project-bootstrap` at
   `c84f377d4b73bb1876479bb21a043bf1b21ec328`
2. `feat/academy-student-identity-foundation` at
   `6138112bda3e395b02ae8d67a1da756f73cd28ed`
3. `fix/academy-safe-household-sync` at
   `e5131729f7866553f6bedfd2ca0ec84f0b343126`

The integration baseline is
`15644974628ead6704c1e97e959cdbd801fdd1b3`. The source histories are merged
without rebasing or squashing.

## Migration order and rollback

The only Academy migrations added relative to the baseline are:

1. `20260724074106_academy_profiles_base.sql`
2. `20260724230000_academy_student_identity_foundation.sql`
3. `20260726120000_academy_household_revision_cas.sql`

Their reviewed Git blobs remain, respectively:

1. `57f0c1ce0e43a7e5af80c135c0f2a9170145d430`
2. `df4cc097ba72561d4182a138760e82c2730a5fac`
3. `c9aa82ddc7e9bd179107b50dfe6d87d9fbfa650f`

Migration runners must use their ledger and timestamp order. The base migration
is directly rerunnable before the later CAS migration intentionally narrows the
profiles ACL. The identity migration re-verifies its manifest and deliberately
recreates its six approved policies on rerun; relation identities, policy
definitions, and RLS modes remain stable, while policy catalog OIDs may change.
The CAS migration is a definition-preserving rerun. A transaction failure while
applying CAS must leave the committed base and identity objects and ledger
entries intact and leave no CAS object or failed ledger entry.

## Validation and hosted boundary

Permanent source suites plus
`npm run test:academy-foundation-integration` validate the integrated chain,
security boundaries, designed reruns, blob identities, and final-migration
rollback. Local PostgreSQL validation must cover the ledger and independent
backend contention before this branch is submitted for fresh review.

Session 3K local validation reproduced:

- bootstrap database suite: 55/55;
- focused bootstrap ACL gate: 28/28 twice;
- bootstrap correction and incompatible/no-repair gates: 15/15 and 40/40;
- integration-chain suite: 2/2;
- safe-sync PGlite and independent-PostgreSQL suites: 23/23 and 4/4;
- affected application surface: 14 files and 251 tests;
- complete application/database suite: 47 files and 790 tests;
- TypeScript and a 192-module production build;
- PostgreSQL 17.9 identity probes: 110/110 twice;
- exact three-entry migration ledger, independent-client CAS contention, and
  final-migration rollback with zero residual CAS objects.

This integration is local only. It does not identify or link a hosted Supabase
project, apply a hosted migration, validate hosted RLS/PostgREST behavior,
configure Netlify, synchronize Lovable, or deploy the application. After local
gates pass, the next stage is a fresh independent review of this integration
branch. Hosted application remains a separate, later infrastructure decision.

# Academy foundation controlled integration

This local integration branch combines three independently approved histories:

1. `feat/academy-fresh-project-bootstrap` at
   `c84f377d4b73bb1876479bb21a043bf1b21ec328`
2. `feat/academy-student-identity-foundation` at
   `ba8b634764de48d698cd984e99a067a37802c983`
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
2. `aa9074a45a1725301e6b606e84d332248e48539f`
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

Session 3K local validation established the original integration baseline:

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

Session 3M hardens the identity verifier and audit contracts, makes the tracked
identity probes part of ordinary `npm test`, and adds real complete-chain
household, relationship, CAS, and effective-ACL coverage. Local Session 3M
validation produced:

- identity probes: 180/180 twice, with 12/12 incompatible-object cases;
- integration-chain suite: 3/3, including exact ledger and late-failure checks;
- safe-sync PGlite and independent-PostgreSQL suites: 23/23 and 4/4;
- affected application surface: 14 files and 251 tests;
- complete application/database suite: 48 files and 804 tests;
- PostgreSQL 18.4 disposable complete-chain validation, including canonical
  Base64 aliases, PIN-safe audit failures, role isolation, CAS, and cleanup;
- TypeScript, the 192-module production build, `git diff --check`, bundle/source
  credential scans, and a zero-vulnerability dependency audit.

These counts are local evidence only. They do not replace hosted Supabase
owner, JWT, PostgREST, RLS, or execution-privilege validation.

This integration is local only. It does not identify or link a hosted Supabase
project, apply a hosted migration, validate hosted RLS/PostgREST behavior,
configure Netlify, synchronize Lovable, or deploy the application.

After all local gates pass, the next stage is a fresh independent read-only
review of this integration branch. If that review approves the branch, a
separate **hosted preflight** may begin. Hosted preflight remains read-only
unless separately authorized and must:

1. establish the authoritative Manuel Academy project identity and verify the
   CLI/project link;
2. inspect current hosted migration history and determine whether the baseline
   is empty or nonempty;
3. inspect schema, role, ACL, RLS, function-owner, and migration drift;
4. derive the exact expected migration plan and confirm rollback readiness; and
5. stop before applying any migration.

Hosted preflight is not hosted application. Applying migrations requires a
later, explicit authorization after the preflight evidence is reviewed.
Netlify configuration, application deployment, and Lovable synchronization
remain still-later, separately authorized stages.

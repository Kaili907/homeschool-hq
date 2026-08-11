# Local Admin upgrade-path migration rehearsal

Classification: `LOCAL_SIMULATED_BASELINE`

Session base: `053b56557f96fae2c75526d3b5466901bc7a1ec2`

Session result: `ADMIN_UPGRADE_PATH_REHEARSAL_READY`

This rehearsal does not claim to reproduce `HOSTED_PRODUCTION_STATE`. It reads
only the checked-in migration custody manifest and SQL files. The manifest's
first Admin migration depends on the ten-migration repository prefix ending at
`20260801190000_academy_study_final_production_reconciliation.sql`; that prefix
is therefore the local simulated pre-Admin baseline. No hosted migration list,
database metadata, project reference, or hosted schema is consulted.

Run on macOS from an unlinked worktree:

```sh
npm run rehearse:admin-upgrade
```

The launcher accepts no arguments, refuses known Supabase link markers, removes
hosted database and provider connection variables from the worker environment,
self-tests macOS network denial, and runs the worker under `sandbox-exec` with
all network access denied. The worker uses only disposable in-memory PGlite
databases and exits non-zero on any mismatch.

## Coverage

Before the Admin tail, deterministic synthetic fixtures are created through the
checked-in contracts for:

- two Auth/household/profile/student/enrollment identities;
- two `Profile.academy.releaseVersion = 1.0.0` learner pins;
- successful and conflicting household CAS receipts at revision 1;
- historical Anthropic/TTS gateway quota counts;
- a credential and verified student-session grant; and
- Study household settings, sessions, and parent settings with non-default
  revisions.

After the provider ledger foundation is created, the harness records one
synthetic historical Tutor usage row through its RPC with deterministic pricing
and a calculated cost of 39 micros. The later Study provider-accounting
migration must preserve that row and its cost components, derive
`purpose = tutor_turn`, and replay the original idempotency key without change.

After the Curriculum 1.0.0 registry migration creates the checked-in custody,
the harness snapshots its release identity, 182-file inventory, hashes, counts,
and production pointer. Every later migration must preserve that custody and
the preexisting learner pins. Final mutation probes must still be rejected.

Every candidate-tail migration is applied in manifest order and followed by
exact row snapshots, baseline relation-identity checks, and service-grant
revocation checks. The final gate verifies the migration ledger, new tables and
RPC names, PostgreSQL ownership, forced RLS on every new relation, intended
authenticated/service RPC grants, no direct browser-role table grants, Study
identity/storage preservation, Curriculum custody, and provider history.

The successful rehearsal is rebuilt on two independent in-memory databases.
Their stable semantic summaries must be identical.

## Failure and roll-forward procedure

The failure harness applies through curriculum staging, then injects an error
after the statements of
`20260810151000_academy_study_safety_provider_accounting.sql` but before its
`COMMIT`. It verifies that the transaction rollback removes every operation
from that migration, preserves historical rows, leaves the migration unrecorded,
and does not start the next migration.

If migration N fails in an operational upgrade:

1. Stop the migration runner at N. Do not start N+1, deploy code requiring the
   new schema, or mark N applied manually.
2. Roll back only N's still-open transaction and retain the failure output. Do
   not run a destructive DOWN script.
3. Inspect the migration ledger, catalog, and preservation queries to establish
   whether N committed, rolled back, or is indeterminate. If indeterminate,
   keep the upgrade stopped and restore certainty from approved database
   evidence or backup tooling.
4. If N is confirmed fully rolled back and the failure was environmental,
   resolve the cause and rehearse the exact same N again on a disposable clone.
5. If SQL correction is required, follow repository custody and forward-only
   policy. Never edit an artifact already applied in any authoritative target;
   create an authorized roll-forward successor (or use the repository's
   explicit before-first-application supersession process when that status is
   proven) and rehearse the resulting manifest chain from the same baseline.
6. Resume only from the first unapplied authorized migration after row,
   identity, CAS, Study, Curriculum, accounting, RLS, and grant checks pass.

This is a stop-and-roll-forward policy. It deliberately contains no ad-hoc
destructive DOWN procedure.

## Session evidence

The local command completed two fresh upgrade runs plus the failure injection.
Both successful runs produced semantic fingerprint
`ebfb3e0aea3a25fa30433a9770ad7c06e64f387f65f67c7ae94d77cf4e5990c7`.
The final state contained 34 new Admin-tail relations, 128 Admin-tail routine
names, 182 Curriculum 1.0.0 file-custody rows, two preserved learner pins, two
Study sessions, three preserved CAS receipts, and one preserved historical
provider ledger row with two cost components.

Validation completed in this worktree:

- migration collision/custody checker: 34 migrations ready;
- independent fresh-database Admin union replay: 34/34 applied, 71 required
  forced-RLS relations present, no unexpected owners or service-grant
  revocations;
- complete Supabase database-contract sweep on the locally cached Node 22
  runtime: 31 files and 400 tests passed;
- embedded PostgreSQL CAS contract on the host runtime: 4 tests passed;
- TypeScript typecheck: passed; and
- production curriculum/Vite/service-worker build: passed.

The host-default Node 25 runtime emitted an `unexpected parseComplete` protocol
error in the PGlite socket bridge during its broad contract sweep. That one
socket-backed file passed 24/24 under Node 22, while the direct PGlite rehearsal
and embedded PostgreSQL contract passed on the host runtime. No migration SQL
or application change was made to mask the runtime-specific bridge failure.

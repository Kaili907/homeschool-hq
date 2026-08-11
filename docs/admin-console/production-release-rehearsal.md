# Local production release and rollback rehearsal

Status: local/disposable evidence only. No deployment, hosted Supabase contact,
hosted migration, production curriculum publication, or production curriculum
activation is authorized by this document.

## Rehearsal contract

The automated rehearsal starts with a new in-memory PGlite database, applies
the nine exact release-control migration files in custody-manifest order, and
creates synthetic owner, admin, viewer, and learner identities. It never loads
an environment file or accepts a project ref, URL, connection string, or
passthrough argument.

Run from the repository root:

```sh
npm run rehearse:admin-release
```

The command exits non-zero at the first failed required gate. Before starting
Vitest it:

- refuses a Supabase linked-project marker;
- requires the repository-local test runtime;
- verifies the ordered migration custody hashes against
  `docs/study-engine-final-production/migration-manifest.json`;
- proves the migration-mismatch check fails closed with a synthetic bad hash;
- rejects a hosted Supabase client, network API, child-process escape, hosted
  Supabase command, or `psql` in the fixed test-file allowlist;
- removes hosted credential and connection variable names from the child
  environment; and
- proves a loopback socket is denied with `EPERM`, then runs the test process in
  the same macOS sandbox profile with `deny network*`.

## Successful release and rollback evidence

The integrated database rehearsal proves this sequence from scratch:

1. Create draft `3.2.0-rehearsal.1` from published base `1.0.0`.
2. Record a publication-ready validation for draft revision 1.
3. Record the current owner approval for that exact revision and validation.
4. Stage deterministic canonical artifacts and verify every digest and
   provenance binding.
5. Publish the candidate and prove it is `PUBLISHED, NOT ACTIVE`; the pointer
   remains `1.0.0` at revision 1.
6. Activate it with pointer compare-and-swap (CAS) revision 1; the pointer
   becomes `3.2.0-rehearsal.1` at revision 2.
7. Prove the existing synthetic learner remains pinned to `1.0.0`.
8. Independently stage, verify, and publish `3.3.0-rehearsal.1`, which is also
   `PUBLISHED, NOT ACTIVE`.
9. Activate the second release with CAS revision 2; the pointer becomes
   `3.3.0-rehearsal.1` at revision 3.
10. Roll back with CAS revision 3 to the previously published
    `3.2.0-rehearsal.1`; the pointer becomes revision 4.
11. Prove pointer history is preserved as revision 4 rollback, revision 3
    activation, revision 2 activation, and revision 1 migration seed.
12. Prove both new releases and all their artifact rows are byte-for-byte equal
    to snapshots taken before their pointer transitions.
13. Prove all four published release rows remain present and the learner pin is
    still unchanged.

## Failure rehearsal and exact stop points

| Scenario | Exercised gate | Exact operator stop |
|---|---|---|
| Migration mismatch | Pre-database custody comparison plus synthetic bad digest | **STOP before creating a database, calculating an apply plan, or invoking any migration tool.** Reconcile the authoritative ledger and use a separately reviewed additive repair; never edit/replay history. |
| Manifest mismatch | Staging integrity and publication digest verification | **STOP after staged-evidence verification and before Publish.** Preserve the candidate and mismatch evidence; do not regenerate or repair it in place. |
| Tampered artifact | Canonical artifact verification and activation eligibility | **STOP before Publish or Activate, whichever first observes the mismatch.** Quarantine the candidate/release; do not change immutable checksums to make it pass. |
| Missing approval | Exact revision staging gate (`approval_missing`) | **STOP before Stage.** Obtain a current owner decision through the governed approval path; never substitute an operator assertion. |
| Stale approval | Staging and publication revalidation (`approval_stale`) | **STOP before Stage or Publish.** Revalidate the current revision and obtain a new approval bound to that exact validation. |
| Pointer CAS conflict | Activation/rollback expected-revision comparison | **STOP before retrying the transition.** Re-read current pointer and history, determine who won, and require a fresh activation/rollback decision; never blind-retry with a changed expected revision. |
| Authorization failure | Database reauthorization for `curriculum:publish` and `releases:manage` | **STOP before Stage, Publish, Activate, or Rollback.** Do not use a service credential to bypass a missing/revoked owner assignment. |
| Partial/unavailable evidence | Missing artifact, malformed integrity envelope, and unavailable read source | **STOP at the first unavailable required item.** Treat UNKNOWN/UNAVAILABLE as failure; do not infer integrity from file existence and do not mutate through a read fallback. |

Each negative test asserts that the protected state does not advance. A stopped
gate is a successful failure rehearsal.

## Rollback findings

Curriculum rollback is an append-only pointer transition, not deletion or
rewriting. The rehearsal returns to the previous published release by creating
pointer revision 4. Release rows, artifacts, history, audit evidence, and the
existing learner pin remain unchanged.

Application deployment rollback and database recovery are deliberately not
simulated as curriculum-pointer changes. Their distinct production procedures
are in `production-release-runbook.md`.

## Evidence interpretation

Passing this rehearsal proves repository contracts and disposable PostgreSQL
behavior. It does not prove hosted schema equivalence, provider account state,
production configuration, a deployment artifact, production smoke tests, or a
Director decision. Those remain manual authorized gates.

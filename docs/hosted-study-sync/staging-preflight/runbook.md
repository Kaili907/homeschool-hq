# Controlled hosted Study sync staging procedure

This is an ordered stop-gate runbook for a future authorized session. Today it
is procedure only: no staging project has been verified, no backup has been
requested, no hosted inventory has run, no migration has been applied, and no
deployment or feature enablement is authorized.

Every evidence record must contain UTC time, operator, reviewer, exact target
project ref, exact repository SHA, command/tool version, exit status, and an
SHA-256 hash of the captured output. Any ambiguous or missing evidence is a
stop, not a waiver.

## 1. Pin the exact learner-release SHA

Use exactly:

```text
7baf8dfbc27168708ed4cf504285a1838d7345f6
```

The preflight parser rejects any replacement. Record this SHA in the execution
evidence and confirm the commit object exists locally.

## 2. Pin the exact hosted-sync R2 convergence SHA

After R2 convergence is complete, record its full 40-character commit SHA. Use
a clean checkout at that commit. The tool requires `HEAD` to equal that SHA and
requires the distinct learner-release SHA to be its ancestor. A dirty worktree, missing
commit, abbreviation, or ancestry mismatch blocks the procedure.

Do not substitute a branch name, tag, pull-request head, or short SHA.

## 3. Capture and verify a restorable backup

Before any hosted inventory or apply consideration, independently confirm the
target project ref, organization, environment label, database host, and API
hostname in authenticated Supabase project metadata. A different project ref
from the known production ref is necessary but does not by itself prove the
project is staging.

Use the then-supported Supabase backup/snapshot mechanism under separate
authorization. Record the backup identifier, UTC completion time, retention,
restore owner, expected recovery time, and restore window in an external copy
of `rollback-checklist.json`. Confirm the backup is restorable by policy or an
approved restore rehearsal. Do not continue on a pending, expired, failed, or
unrestorable backup.

## 4. Run read-only hosted inventory

First run local-only mode exactly as documented in `README.md`. After it passes
and step 3 is evidenced, repeat with `--hosted-read`. Preserve the complete
output and its checksum.

The tool refuses the known production ref, binds the explicit target ref to the
connection URL identity, requires all enablement flags to equal `false`, and
uses catalog-only SQL inside a read-only transaction. It does not use the
Supabase CLI link state and does not accept a project ref inferred only from an
`.env` file.

Stop on connection redirection, identity mismatch, missing migration ledger,
unexpected schema exposure, object collision, owner/ACL drift, unforced RLS,
unexpected policy/function/trigger definition, or any inventory error.

## 5. Reconcile migration versions and checksums

Compare the hosted migration ledger inventory to the ordered repository
manifest at:

```text
docs/study-engine-final-production/migration-manifest.json
```

The tool verifies that every timestamped migration file appears exactly once,
in order, with its dependency and normalized SHA-256 checksum (UTF-8, CRLF
normalized to LF). Reconcile hosted historical versions separately from
repository file checksums; never infer that a matching timestamp proves
matching SQL bytes.

Historical foundation SQL must not be replayed. If the target lacks a supported
history baseline, if an applied version has unknown bytes, or if any timestamp,
name, dependency, marker, object definition, or checksum is unexplained, stop
and create a reviewed reconciliation plan. Never insert or edit migration
history ad hoc.

## 6. Replay locally from empty state

The preflight runs:

```sh
node scripts/replay-admin-migration-union.mjs
```

This uses disposable PGlite and applies the full manifest in order. Preserve
the pass report. Any SQL error, missing forced-RLS table, unexpected owner,
missing required service routine, or unexpected grant revocation blocks hosted
work. Rerun the complete preflight after any migration-byte or manifest change;
the convergence SHA must also change.

## 7. Apply to staging only in a separate future operation

This repository package contains no apply mode. `--apply` is rejected. A future
apply executable must be separately implemented and reviewed after staging is
verified, and must require all of the following at invocation time:

1. exact convergence SHA and clean worktree;
2. explicit non-production target ref confirmed by two people;
3. fresh backup identifier and recovery owner;
4. hashes of the approved manifest, read-only inventory, and rollback evidence;
5. feature flags and all consumers disabled;
6. an exact one-time authorization phrase scoped to that target and window.

Apply only the reconciled, not-yet-applied executable migrations. Never use
`supabase db push`, migration globbing, historical replay, raw ledger inserts,
or a tool linked through ambient CLI state. Do not deploy as part of migration
application. Run each approved transactional unit with stop-on-error and
capture server results before proceeding.

## 8. Run RLS and authentication probes

While flags and workers remain disabled, use synthetic identities created only
for the verified non-production target. Prove at minimum:

- unauthenticated and wrong-household tokens cannot read or mutate rows;
- Household A cannot observe or mutate Household B;
- authenticated guardian access is limited to the bound household;
- student identity/grant binding is current and rejects stale or forged claims;
- browser roles cannot use private schemas or server-only routines;
- allowed sync snapshot and CAS mutations work only with the pinned identity;
- service routines require the intended server role and preserve RLS/forced-RLS
  boundaries;
- sign-out, token rotation, and revoked grants fail closed.

Capture row counts and synthetic identifiers only. Never copy real learner or
auth-user payloads into evidence. Any unexpected allow, cross-household
visibility, owner/grant drift, or non-forced protected RLS triggers rollback.

## 9. Run a cross-device synthetic sync test

Use two isolated browser profiles/devices and one synthetic household on the
verified target. Keep family and Study enablement flags disabled in any shared
deployment; use only a separately authorized test harness/build scoped to the
non-production target.

Test first link with local-only data, empty-cloud confirmation, cloud-data
replacement, explicit reviewed conflict, CAS loss to the other device, offline
recovery, sign-out/account switch, import invalidation, and final convergence.
Prove there is no upload before adult confirmation, no silent overwrite, no
cross-household data, and no mutation after auth/ownership changes. Preserve
synthetic-only evidence and remove synthetic data later under separate cleanup
authorization.

## 10. Apply rollback and stop criteria

Stop immediately and keep every feature/worker disabled if any of these occur:

- target identity or environment label becomes uncertain;
- backup/restore evidence is unavailable;
- a checksum, ledger version, marker, or object definition differs;
- a migration is partially applied or its transaction result is uncertain;
- an RLS/auth probe permits unauthorized access or a required access path fails;
- cross-device testing loses data, silently overwrites, crosses households, or
  mutates after identity/ownership invalidation;
- audit/receipt evidence is lost, secrets appear in output, or operational logs
  contain learner payloads;
- the rollback window, operator, reviewer, or recovery owner is unavailable.

For an uncommitted transactional failure, verify rollback and catalog equality
against the pre-apply inventory. After a committed failure, do not edit applied
SQL, replay historical files, drop evidence, manually rewrite migration
history, or perform an improvised downgrade. Preserve evidence, disable all
consumers, and use either the verified provider restore procedure or a
separately reviewed additive recovery migration. The recovery choice requires
its own authorization and must be validated again from step 4.

## 11. Consider family enablement only afterward

Do not enable `VITE_FAMILY_PILOT_ENABLED`,
`VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED`, `VITE_STUDY_ENGINE_ENABLED`, or
`ACADEMY_STUDY_ENABLED` during preflight, inventory, migration apply, probes,
or cross-device validation. Successful staging validation is evidence for a
later go/no-go decision, not activation authority.

Family enablement requires a separate reviewed deployment change, fresh target
and backup checks, production-specific readiness/security review, monitoring
and support ownership, explicit rollback decision thresholds, and a controlled
family cohort. This runbook neither authorizes nor performs that change.

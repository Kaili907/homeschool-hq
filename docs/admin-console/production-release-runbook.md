# Manuel Academy production release and rollback runbook

Status: operator runbook only. It intentionally performs no external,
destructive, deployment, migration, publication, activation, or rollback
operation.

Definitions used below:

- **STOP** means make no state-changing call, preserve evidence, and escalate.
- **DIRECTOR AUTHORIZATION REQUIRED — EXTERNAL** means the exact target,
  identity, window, and read-only action must be authorized before contact.
- **DIRECTOR AUTHORIZATION REQUIRED — DESTRUCTIVE/EXTERNAL** means a separately
  recorded authorization must name the exact mutation. Authorization for one
  hold point does not authorize a later hold point or any rollback.

## PRE-DEPLOY CHECKS

1. Record candidate Git SHA, branch, clean/expected diff, release owner,
   rollback owner, maintenance window, and evidence directory.
2. Run locally from a clean dependency install:

   ```sh
   npm run rehearse:admin-release
   npm run typecheck
   npm run build
   git diff --check
   ```

3. Require every local command to exit zero. Confirm the rehearsal reported
   `PUBLISHED, NOT ACTIVE`, learner-pin isolation, two activations, rollback,
   preserved history, and immutable release/artifact equality.
4. Confirm no production secret is needed for local gates, no Supabase linked
   marker exists in the release worktree, and the intended diff contains no
   generated credential, project ref, learner data, or local evidence dump.
5. Confirm a known-good immutable application artifact and its SHA are
   available for application rollback. Confirm the previously active curriculum
   release is still published and integrity-eligible for pointer rollback.
6. Any failure or UNKNOWN is **STOP before Deploy**.

## MIGRATION CHECKS

1. Compare repository migration filenames, order, and normalized SHA-256 values
   with the approved custody manifest. A mismatch is **STOP before hosted
   preflight or apply**.
2. **DIRECTOR AUTHORIZATION REQUIRED — EXTERNAL:** read the exact hosted
   project's migration ledger and canonical catalog definitions. Save project
   identity, ledger, owners, ACLs, RLS/forced-RLS, policies, functions,
   triggers, indexes, constraints, and foundation markers. No mutation is
   authorized by this read.
3. Reconcile the hosted result against the candidate manifest. Drift,
   unexpected names, missing dependencies, a wrong project/environment, or
   incomplete evidence is **STOP before migration**.
4. Confirm a restorable backup, recovery owner, restore estimate, and an
   additive correction plan. The repository architecture is forward-only:
   historical SQL is not edited/replayed and there is no automatic production
   down migration.
5. **DIRECTOR AUTHORIZATION REQUIRED — DESTRUCTIVE/EXTERNAL:** apply only the
   separately approved exact migration set to the exact project in the exact
   window. Never infer this authorization from deploy approval.
6. If a migration transaction fails, verify it rolled back and **STOP**. If a
   post-commit check fails, keep consumers disabled, preserve evidence, and
   **STOP** for a separately reviewed additive corrective migration or backup
   recovery decision.

## ADMIN OWNER CHECK

1. **DIRECTOR AUTHORIZATION REQUIRED — EXTERNAL:** verify the intended operator
   has one current, non-revoked `owner` assignment and the minimum frozen
   capabilities required for the proposed step.
2. Verify separate read, approval, publish, and `releases:manage` boundaries;
   browser-supplied roles/capabilities are not authority.
3. Missing, duplicate, expired, revoked, or unprovable authority is **STOP
   before the governed action**. Never bypass it with service credentials.

## CONFIGURATION CHECK

1. Locally compare deploy configuration, build command, immutable artifact SHA,
   feature defaults, runtime release binding, and expected environment-variable
   names. Do not print values.
2. **DIRECTOR AUTHORIZATION REQUIRED — EXTERNAL:** compare production
   configuration names/scopes and deployment target identity without exposing
   secret values.
3. A wrong site/project/account, missing variable, unexpected secret scope,
   feature enabled early, linked local Supabase project, or configuration drift
   is **STOP before Deploy**.

## PROVIDER ACCOUNTING CHECK

1. Confirm locally that provider usage/cost ledger tests, operational event
   tests, bounded audit tests, and fail-closed provider readiness tests pass.
2. **DIRECTOR AUTHORIZATION REQUIRED — EXTERNAL:** verify production provider
   account identity, budget/limit ownership, billing visibility, usage ledger
   continuity, alert routing, and kill-switch ownership using metadata only.
3. Missing accounting coverage, ambiguous account ownership, unavailable
   billing evidence, an exceeded/unset limit, or unowned alert/kill switch is
   **STOP before Deploy**.

## CURRICULUM RELEASE CHECK

1. Select exactly one current approved draft revision. Record immutable base
   release, target version, Schema Set, validation ID/digest, approval ID,
   artifact inventory, content hash, manifest hash, and package hash.
2. Verify no target-version collision and no current validation, human-review,
   or approval blocker.
3. Verify canonical artifact bytes, byte counts, hashes, manifest inventory,
   package identity, and complete provenance. MISMATCH, INCOMPLETE, UNKNOWN, or
   UNAVAILABLE is **STOP before Stage/Publish**.
4. **DIRECTOR AUTHORIZATION REQUIRED — DESTRUCTIVE/EXTERNAL:** Stage the exact
   approved revision in production using a unique saved idempotency key.
5. Re-read and independently verify staged evidence. Do not repair staged
   evidence in place.
6. **DIRECTOR AUTHORIZATION REQUIRED — DESTRUCTIVE/EXTERNAL:** Publish the exact
   verified staging identity using a new saved idempotency key.
7. Prove the result is `PUBLISHED, NOT ACTIVE`, the active pointer and its
   revision are unchanged, existing learner pins are unchanged, and the release
   plus artifact inventory are immutable. Any contrary or unavailable result
   is **STOP before Activation**.

## DEPLOY HOLD POINT

Present the complete pre-deploy evidence bundle to the Director. The decision
must identify the candidate SHA/artifact digest, application target, migration
plan (including none), window, operator, and rollback owner.

**DIRECTOR AUTHORIZATION REQUIRED — DESTRUCTIVE/EXTERNAL:** deploy the exact
approved immutable application artifact. This label is a hold point, not an
instruction or standing authorization. Do not deploy from this runbook.

No recorded exact authorization means **STOP before Deploy**.

## POST-DEPLOY SMOKE TESTS

1. **DIRECTOR AUTHORIZATION REQUIRED — EXTERNAL:** verify deployment identity,
   health/readiness, admin authentication, authorization denial paths, bounded
   audit visibility, provider readiness/accounting, and curriculum read paths.
2. Prove the newly published curriculum is still not active and existing
   learner pins did not change during application deployment.
3. Do not use real learner records or cause provider-billed/content-generating
   traffic unless separately named in authorization. Use approved synthetic
   probes only.
4. Any failed, partial, stale, or unavailable smoke evidence is **STOP before
   Activation** and triggers an application rollback decision—not an automatic
   curriculum pointer change.

## ACTIVATION HOLD POINT

Present the published-release integrity result, current pointer version and
revision, post-deploy smokes, learner-pin evidence, operator identity, and exact
rollback target to the Director.

**DIRECTOR AUTHORIZATION REQUIRED — DESTRUCTIVE/EXTERNAL:** activate the exact
published release with the recorded expected pointer revision. Deployment or
publication authorization does not authorize activation.

No recorded exact authorization means **STOP before Activation**.

## ACTIVATION PROCEDURE

1. Immediately re-read the current pointer and immutable target evidence.
2. If the pointer revision differs from the authorized expected revision,
   **STOP**; preserve the CAS conflict, identify the winning transition, and
   request a fresh decision. Do not blind-retry.
3. **DIRECTOR AUTHORIZATION REQUIRED — DESTRUCTIVE/EXTERNAL:** submit one
   `activation` transition for the exact target, expected revision, reason code,
   and unique idempotency/correlation key.
4. **DIRECTOR AUTHORIZATION REQUIRED — EXTERNAL:** verify the new pointer
   version/revision, appended transition and audit history, unchanged existing
   learner pins, and unchanged immutable release/artifact evidence.
5. Any mismatch or unavailable evidence is **STOP** and opens the curriculum
   pointer rollback decision below.

## ROLLBACK PROCEDURE

Rollback types are independent. Choose only the type supported by evidence;
one rollback never implies or authorizes another.

### Application deployment rollback

1. Keep database history and curriculum pointer unchanged unless their own
   rollback criteria are independently met.
2. Select the last known-good immutable application artifact that remains
   schema/wire compatible; verify its digest and production configuration.
3. **DIRECTOR AUTHORIZATION REQUIRED — DESTRUCTIVE/EXTERNAL:** redeploy that
   exact artifact to the exact application target.
4. **DIRECTOR AUTHORIZATION REQUIRED — EXTERNAL:** repeat post-deploy smoke
   tests and save deployment identity/evidence. If compatibility is uncertain,
   **STOP** and disable the affected feature/traffic under separate authority.

### Database migration situation

1. An in-transaction failure should roll back atomically; verify catalog and
   ledger state, preserve logs, and **STOP**.
2. After a committed migration, do not run a down migration, edit/replay
   historical SQL, drop durable/audit data, relax RLS, or repair the ledger ad
   hoc. Disable affected consumers and preserve evidence.
3. Prepare a new reviewed forward/additive corrective migration. Backup restore
   is a distinct disaster-recovery choice requiring a verified restore point,
   data-loss analysis, recovery owner, and maintenance plan.
4. **DIRECTOR AUTHORIZATION REQUIRED — DESTRUCTIVE/EXTERNAL:** apply the exact
   approved corrective migration or execute the exact approved backup restore.
5. **DIRECTOR AUTHORIZATION REQUIRED — EXTERNAL:** re-run ledger, catalog,
   security, data-integrity, and application compatibility verification before
   enabling consumers.

### Curriculum active-pointer rollback

1. Confirm the target is a previously published immutable release present in
   pointer history and currently integrity-eligible. Record the current pointer
   revision and prove existing learner pins are not being migrated.
2. **DIRECTOR AUTHORIZATION REQUIRED — DESTRUCTIVE/EXTERNAL:** submit one
   `rollback` CAS transition to the exact release with the exact expected
   pointer revision and a new idempotency/correlation key.
3. **DIRECTOR AUTHORIZATION REQUIRED — EXTERNAL:** prove a new pointer revision
   was appended, current active release equals the rollback target, prior
   history remains present, learner pins remain unchanged, and every immutable
   release/artifact remains unchanged.
4. A CAS conflict or incomplete evidence is **STOP**; do not delete the release
   being left or rewrite pointer history.

## ABORT CONDITIONS

Abort at the named hold point for any of these conditions:

- target/project/account/operator identity is ambiguous;
- authorization is absent, stale, broader/narrower than the exact action, or
  belongs to another hold point;
- migration order/hash/ledger/catalog differs or evidence is partial;
- backup, recovery owner, rollback target, or known-good artifact is missing;
- typecheck, build, rehearsal, diff check, required tests, or smoke tests fail;
- approval is missing/stale, validation is blocking, or human review is open;
- manifest/package/artifact/provenance is mismatched, incomplete, tampered,
  unknown, or unavailable;
- provider account, accounting, limit, alert, or kill-switch ownership is not
  proven;
- publication is active unexpectedly or changed the pointer/learner pins;
- pointer expected revision changed (CAS conflict);
- authorization fails at either application or database boundary;
- audit/history/receipts are missing or immutable evidence changed; or
- any operator would need to bypass, weaken, delete, replay, or repair evidence
  to continue.

## EVIDENCE TO SAVE

Save bounded metadata only; never save secrets, curriculum payloads, or real
learner data.

- Director authorization record for each distinct external/destructive step;
- candidate Git SHA, clean diff, immutable deploy artifact ID/SHA, target, and
  deployment result;
- exact local command lines, exit codes, and complete rehearsal/typecheck/build/
  diff/test output;
- before/after remote-ref and repository configuration snapshots proving the
  local rehearsal itself made no remote/configuration change;
- migration custody manifest, computed hashes, hosted ledger/catalog preflight,
  apply result, backup/restore owner, and any corrective-migration decision;
- redacted configuration-name/scope comparison;
- admin owner assignment/capability evidence and bounded audit correlations;
- provider account metadata, budget/limit/ledger/alert/kill-switch evidence;
- draft/revision, validation, approval, staging/release IDs, artifact counts and
  digests, plus `PUBLISHED, NOT ACTIVE` proof;
- pointer version/revision before and after every activation/rollback,
  idempotency/correlation IDs, ordered history, and current active release;
- count/digest-only proof that learner pins and immutable release/artifact rows
  did not change; and
- all stop/failure evidence, incident decisions, and rollback smoke results.

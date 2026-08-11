# Admin Console RC2 GO / NO-GO package

Current production decision: **NO-GO / UNVERIFIED**

`RC2_SHA = PENDING`

This document is an operator checklist and decision record. It performs no
push, merge, hosted read, hosted migration, deployment, publication, activation,
or rollback. A checked local box never grants authority for an external action.

## 1. Current NO-GO reasons

1. A completed RC2 SHA does not exist in the evidence snapshot. The observed
   assembly head `d00bc6c8be3e83828f7a36a37c95724a00a1ccc5` contains the required
   source cherry-picks, but its worktree still has uncommitted reconciliation
   edits and no final validation commit.
2. Security, privacy, release-control, and provider-accounting fixes have not
   been committed and verified as one clean final union.
3. The final RC2 migration filename/order/dependency/hash manifest and exact
   clean replay are not committed. The in-progress assembly normalizes the
   privacy source's colliding prefix to `20260810155000`, but that reconciliation
   remains part of the unfinalized assembly.
4. No approved authoritative hosted migration/catalog evidence was obtained.
5. Production secret/config presence, effective runtime state, Owner authority,
   provider-accounting state, budgets/limits, alerts, and kill-switch ownership
   are unverified.
6. Typecheck, build, focused regressions, complete migration validation, and the
   local release rehearsal have not been run on an exact completed RC2 SHA.
7. The immutable deploy artifact, known-good application rollback artifact,
   restorable backup, recovery owner, and production smoke evidence are absent.

Any one of these is sufficient for **NO-GO / UNVERIFIED**.

## 2. Director holds

| Action | Required hold |
| --- | --- |
| Push / merge | **DIRECTOR AUTHORIZATION REQUIRED** |
| Hosted migration application | **DIRECTOR AUTHORIZATION REQUIRED** |
| Deployment | **DIRECTOR AUTHORIZATION REQUIRED** |
| Production publication | **DIRECTOR AUTHORIZATION REQUIRED** |
| Activation | **DIRECTOR AUTHORIZATION REQUIRED** |
| Rollback (application, database corrective action/restore, or curriculum pointer) | **DIRECTOR AUTHORIZATION REQUIRED** |

Authorization must name the exact action, target, candidate/artifact, operator,
window, and rollback owner. Authorization for one row does not authorize another
row. An authorization record is evidence; a verbal assumption or prior-stage
approval is not.

## 3. Universal stop conditions

**STOP** and preserve bounded evidence if any of the following is true:

- candidate SHA, artifact digest, branch ancestry, target, project, site,
  provider account, or operator identity is ambiguous;
- the working tree contains unexplained changes or generated/private evidence;
- a referenced commit/artifact is missing or an expected digest differs;
- the final migration manifest has missing/extra files, a duplicate prefix,
  stale dependency/reference, collision, order hazard, or hash mismatch;
- hosted ledger/catalog/schema evidence is missing, partial, stale, or differs
  from the exact approved candidate;
- RLS/forced-RLS, owners, grants, policies, functions, triggers, indexes, or
  constraints cannot be proven for the hosted target;
- required secret/config presence or scope is missing/unknown, a secret appears
  in client output/evidence, or effective configuration differs from approved
  intent;
- the current Owner assignment/capability is missing, stale, revoked,
  duplicated, or cannot be reverified at the action boundary;
- provider accounting has a gap/conflict, account/budget/limit/alert/kill-switch
  ownership is unknown, or invoice completeness is inferred from journal
  coverage;
- a test, typecheck, build, migration replay, rehearsal, diff check, or smoke
  check fails or is unavailable;
- approval/validation/review is missing or stale; candidate/provenance/artifact
  evidence is incomplete, mismatched, or tampered;
- publication unexpectedly changes the active pointer or existing learner pins;
- pointer expected revision changes or any action would require a blind retry;
- audit/history/receipt evidence is missing or immutable evidence changes; or
- continuing would require bypassing authorization, weakening RLS/privacy,
  editing applied migration history, deleting evidence/data, or substituting an
  unsupported destructive down migration.

Unknown and unavailable required evidence are stop states, not zero/healthy.

## 4. Required hosted migration evidence

Read-only hosted inspection itself requires a separately recorded Director
authorization naming the exact production project and evidence scope.

- [ ] Record redacted target identity sufficient to distinguish project,
  environment, account, and region without copying credentials.
- [ ] Export the authoritative applied migration ledger: exact versions,
  filenames/identifiers, order, timestamps, and recorded checksums if the
  platform supplies them.
- [ ] Compare the ledger to the completed RC2 manifest. Record missing, extra,
  renamed, out-of-order, or unverifiable entries as mismatches.
- [ ] Capture canonical definitions/metadata for required schemas, tables,
  routines, triggers, constraints, indexes, policies, owners, ACLs, RLS, and
  forced-RLS state. Do not rely on object names alone.
- [ ] Verify required foundation markers and final release-control,
  authorization, privacy, provider-accounting, and audit objects.
- [ ] Verify no historical applied SQL must be edited/replayed and no selected
  RC2 filename collides with hosted history.
- [ ] Record a restorable backup/restore point, recovery owner, restore estimate,
  data-loss window, and a reviewed forward/additive correction strategy.
- [ ] Obtain separate Director authorization for the exact hosted migration set,
  operator, target, and window.
- [ ] After application, recapture the ledger/catalog/security definitions and
  compare them to the approved post-state before enabling consumers.

Any mismatch or incomplete proof is **STOP before hosted migration application**.
The repository is forward-only: do not prescribe a destructive down migration,
edit/replay applied history, or drop audit/durable data as routine rollback.

## 5. Pre-deploy checklist

### Candidate and local evidence

- [ ] Record a completed `RC2_SHA` and prove all required source fixes are
  ancestors or byte-equivalent intentionally assembled artifacts.
- [ ] Run `node scripts/check-admin-release-evidence.mjs`; save command, runtime,
  exit status, and output.
- [ ] Run the strict migration check and exact final migration replay; save the
  final manifest, every computed digest, catalog/security assertions, and
  output.
- [ ] Run the Admin-focused authorization, privacy, provider-accounting,
  cost-alert, curriculum workflow, release-control, and production-readiness
  regressions on the exact RC2 SHA.
- [ ] Run the local network-denied release rehearsal on the exact RC2 SHA and
  require publish-not-active, pointer CAS/history, learner-pin isolation,
  immutable release/artifact equality, pointer rollback, and every negative stop
  case.
- [ ] Run repository typecheck and production build on the supported runtime;
  record runtime/package-manager versions and immutable build artifact digest.
- [ ] Run `git diff --check`, confirm expected scope, and scan tracked diff/build
  output for secrets, connection strings, project refs, learner data, and local
  evidence dumps.
- [ ] Confirm every command exits zero. Any skipped/unavailable required command
  remains unverified.

### Hosted/config/operator readiness

- [ ] Complete the hosted migration evidence checklist above.
- [ ] Verify all applicable production secret/config categories from
  `rc2-release-evidence.md` by name/scope/presence only; archive no values.
- [ ] Verify saved and effective AI/TTS/Study/quota/tier/cost-threshold state and
  all stronger deployment/catalog/safety constraints.
- [ ] Verify one intended current Owner and the exact capabilities required for
  each proposed step; prove revocation and database reauthorization behavior.
- [ ] Verify provider account identity, approved products/prices, budget/limit,
  billing visibility, journal/ledger continuity, alert routing, and kill-switch
  ownership. Do not claim invoice completeness from attempt coverage.
- [ ] Confirm a known-good immutable application rollback artifact is compatible
  with the approved post-migration schema/wire contracts.
- [ ] Confirm rollback owner, incident commander, maintenance window,
  communication route, and evidence archive owner.
- [ ] Present the complete evidence bundle to the Director and obtain action-
  specific authorization. Without it: **STOP before push/merge or deployment**.

## 6. Post-deploy smoke checklist

Deployment and each hosted read below require their own recorded Director
authorization. Use approved synthetic/minimized probes; do not use real learner
content or cause provider-billed traffic unless separately authorized.

- [ ] Prove deployed site/account, immutable artifact digest, RC2 SHA, deployment
  ID, and production configuration revision match the authorization record.
- [ ] Prove Admin authentication succeeds for the intended synthetic/current
  operator and fails closed for unauthenticated, learner/guardian, revoked, and
  insufficient-role cases.
- [ ] Verify viewer/admin/owner capability boundaries, including Owner-only
  configuration/access/release mutations and write-point reauthorization.
- [ ] Verify Overview, Attention, Learners, Engines, Costs, Health, Correlations,
  Safety, Curriculum, Configuration, Audit, Access, and Production Readiness
  return bounded authorized states without raw errors or secret/learner content.
- [ ] Verify migration/readiness evidence is current and the default hosted
  migration/Owner gates are no longer `UNVERIFIED` only because approved
  authoritative probes were supplied.
- [ ] Verify telemetry freshness/completeness, privacy-minimized payloads,
  retention state, provider-attempt coverage, ledger consistency, and monthly
  alert state. Preserve `invoiceCompletenessClaim: false` unless separately
  reconciled provider evidence exists.
- [ ] Verify AI/TTS/Study saved versus effective state, quotas, logical tiers,
  voice fallback/catalog, and deployment ceilings.
- [ ] Verify the intended curriculum release is still `PUBLISHED, NOT ACTIVE`,
  the production pointer/revision/history are unchanged, and existing learner
  pin count/digest is unchanged.
- [ ] Verify audit events/receipts are bounded, append-only, correctly
  correlated, and atomically present for any separately authorized smoke
  mutation.

Any failed, partial, stale, unknown, or unavailable required smoke is **STOP
before production publication or activation** and opens a Director decision; it
does not trigger an automatic rollback.

## 7. Production publication checklist

Publication is independent from deploy and activation.

- [ ] Select one exact current draft revision, immutable base, target version,
  Schema Set, validation identity/digest, human-review state, Owner approval,
  staging identity, artifact inventory, content hash, manifest hash, and package
  hash.
- [ ] Prove no target collision and no blocking/stale validation, review, or
  approval evidence.
- [ ] Independently verify every staged byte/count/digest and canonical package
  identity. Do not regenerate or repair staged evidence in place.
- [ ] Obtain **DIRECTOR AUTHORIZATION REQUIRED** for the exact production
  publication and a unique saved idempotency/correlation key.
- [ ] Publish once through the governed Owner/database boundary.
- [ ] Prove `PUBLISHED, NOT ACTIVE`; pointer version/revision/history, learner
  pins, and other immutable releases/artifacts remain unchanged.

Contrary or unavailable evidence is **STOP before activation**.

## 8. Activation checklist

- [ ] Present exact published-release integrity, current pointer version and
  revision, post-deploy smokes, learner-pin digest, operator identity, and exact
  pointer rollback target.
- [ ] Obtain **DIRECTOR AUTHORIZATION REQUIRED** for the exact target and exact
  expected pointer revision. Deployment/publication approval is insufficient.
- [ ] Immediately reread pointer and immutable target evidence. If revision or
  digest differs, **STOP** and request a new decision; never blind-retry.
- [ ] Submit one governed activation with a new idempotency/correlation key.
- [ ] Verify the new pointer revision, append-only transition/audit history,
  unchanged existing learner pins, and unchanged immutable release/artifact
  evidence.
- [ ] Observe the authorized smoke/monitoring window and preserve bounded
  evidence. Any mismatch/unavailability opens, but does not authorize, rollback.

## 9. Rollback procedures

Application rollback, database corrective action, and curriculum pointer
rollback are separate decisions. One never implies another. Every mutation
below is **DIRECTOR AUTHORIZATION REQUIRED**.

### 9.1 Application rollback

1. Leave database history and curriculum pointer unchanged unless their own
   independent criteria are met.
2. Verify the last known-good immutable application artifact digest and its
   compatibility with the current schema/wire/configuration state.
3. Obtain authorization naming that artifact and application target, then
   redeploy only that artifact.
4. Repeat post-deploy authorization, privacy, accounting, readiness, and
   curriculum-pointer smoke checks. Preserve before/after deployment evidence.
5. If compatibility is uncertain, **STOP** and seek separate authority to
   disable the affected feature/traffic safely.

### 9.2 Database corrective action or disaster recovery

1. For an in-transaction failure, verify atomic rollback, capture the ledger and
   catalog state, keep consumers disabled, and **STOP**.
2. After a committed migration, do not run a destructive down migration, edit
   or replay historical SQL, drop audit/durable data, relax RLS, or repair the
   migration ledger ad hoc.
3. Prepare a new reviewed forward/additive corrective migration. Verify its
   dependencies, security posture, replay, application compatibility, and
   recovery procedure.
4. Treat backup restore as a separate disaster-recovery decision requiring a
   verified restore point, data-loss analysis, recovery owner, outage window,
   and post-restore reconciliation plan.
5. Obtain authorization for exactly one corrective action or restore, execute
   it, and reverify ledger/catalog/security/data/application state before
   enabling consumers.

### 9.3 Curriculum pointer rollback

1. Verify the target is a previously published immutable release in pointer
   history and remains integrity-eligible. Record current pointer revision and
   prove existing learner pins are not being migrated.
2. Obtain authorization naming the exact target and expected current revision.
3. Submit one append-only `rollback` CAS transition with a new
   idempotency/correlation key.
4. Prove a new pointer revision was appended; current active release equals the
   target; prior history remains; learner pins remain unchanged; and immutable
   releases/artifacts are byte-identical.
5. A CAS conflict or incomplete evidence is **STOP**. Do not delete the release
   being left or rewrite pointer history.

## 10. Evidence archive checklist

Archive bounded metadata and complete command output; never archive secret
values, connection strings, provider voice IDs/keys, bearer tokens, real
learner data, curriculum payloads, prompts/responses, transcripts, or audio.

- [ ] Distinct Director authorization record for push/merge, hosted read,
  hosted migration, deploy, publication, activation, and any rollback.
- [ ] RC2 SHA/ancestry, clean worktree/diff, source SHAs, integrity-check output,
  and final evidence-manifest digest.
- [ ] Runtime/package-manager versions, dependency-lock identity, exact local
  commands, exit codes, and full focused tests/typecheck/build/rehearsal/diff
  output.
- [ ] Final migration filenames/order/dependencies/hashes, clean replay output,
  hosted pre/post ledger and catalog/security evidence, and backup/recovery
  evidence.
- [ ] Redacted configuration-name/scope/presence comparison and saved/effective
  configuration revision/state.
- [ ] Admin Owner/capability evidence and bounded audit/receipt correlations.
- [ ] Provider account metadata, product/pricing identity, budget/limit,
  journal/ledger/alert/kill-switch evidence, and explicit invoice-completeness
  limitation.
- [ ] Immutable deploy artifact ID/digest, target identity, deployment result,
  and post-deploy smoke output.
- [ ] Draft/revision, validation/review/approval/staging/publication identities,
  counts/digests, and `PUBLISHED, NOT ACTIVE` proof.
- [ ] Pointer version/revision/history before and after activation/rollback,
  learner-pin count/digest, and immutable release/artifact equality proof.
- [ ] Every stop/failure, incident decision, corrective action, rollback result,
  and post-action smoke result.

## 11. GO / NO-GO decision rubric

| Gate | GO requirement | Current evidence | Current ruling |
| --- | --- | --- | --- |
| RC identity | One completed exact RC2 SHA with all required fixes | RC2 pending; required sources are in a dirty/unfinalized assembly | **NO-GO / UNVERIFIED** |
| Source integrity | Every referenced SHA/artifact/hash resolves | Evidence checker provided; must pass on final commit | Pending final validation |
| Final migration union | Collision-free complete manifest and exact clean replay on RC2 | RC1 manifest plus pre-RC2 audit only | **NO-GO / UNVERIFIED** |
| Local validation | Focused suites, typecheck, build, rehearsal, diff/secret checks on exact RC2 | Branch-scoped historical reports only | **NO-GO / UNVERIFIED** |
| Hosted migration/catalog | Approved authoritative pre/post evidence matches RC2 | Not obtained | **NO-GO / UNVERIFIED** |
| Config/secrets/runtime | Every applicable entry present/scoped and effective state verified | Not obtained | **NO-GO / UNVERIFIED** |
| Owner authorization | Current exact Owner/capabilities at each boundary | Not obtained | **NO-GO / UNVERIFIED** |
| Provider accounting | Account/budget/limit/ledger/alerts/kill switch verified; gaps clear | Not obtained | **NO-GO / UNVERIFIED** |
| Deploy/rollback readiness | Immutable artifacts, backup, owners, compatibility, window | Not obtained | **NO-GO / UNVERIFIED** |
| Post-deploy smoke | All required bounded smokes current and positive | Not deployed; not obtained | **NO-GO / UNVERIFIED** |
| Director decision | Action-specific recorded authorization | Not granted by this package | **HOLD** |

Production may be classified GO only when every required gate has current,
positive, authoritative evidence for the exact candidate and target, no stop
condition is present, and the Director has authorized the exact next action.
Local success alone can never change a required hosted gate from `UNVERIFIED`.

## 12. Decision record

- Candidate SHA: `PENDING`
- Immutable application artifact/digest: `UNVERIFIED`
- Hosted target: `UNVERIFIED`
- Hosted migration evidence: `UNVERIFIED`
- Production Owner authority: `UNVERIFIED`
- Provider/config readiness: `UNVERIFIED`
- Rollback artifacts/owners: `UNVERIFIED`
- Director authorization record: `NOT PRESENT`
- Decision: **NO-GO / UNVERIFIED**
- Next allowed action from this package: local/read-only evidence completion
  only; all external or mutating actions remain on hold.

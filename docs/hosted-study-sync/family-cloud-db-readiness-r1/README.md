# Family Cloud database and RLS readiness R1

## Safety and target ruling

This package was prepared offline. No Supabase provider API, hosted database,
Auth endpoint, RPC, or hosted migration ledger was contacted. No SQL in this
package has been applied to any hosted project.

The known production project is `ymtvzmqhfvwjtxjdmybs`. It is prohibited for
linking, inventory, SQL execution, migration application, Auth changes, RLS
changes, RPC calls, and synthetic rows in this procedure.

Local inspection found no `supabase/config.toml`, `.supabase` link metadata,
`supabase/.temp/project-ref`, `.env` target, or relevant process environment
variable in the requested worktree or main checkout. The checked-in production
ref appears only in historical production evidence and defensive preflight
guards; it is not a local link and is not an eligible target.

```text
LOCAL_LINKED_PROJECT_REF=NONE
LOCAL_TARGET_CLASSIFICATION=UNLINKED_PRODUCTION_REF_EVIDENCE_ONLY
NON_PROD_TARGET_STATUS=NON_PROD_PROJECT_REQUIRED
```

## Reconciled migration contract

The four Hosted Sync R2 migrations below are byte-identical in the product
base, `origin/mac/hosted-sync-r2-final-convergence-r1`, and
`origin/mac/family-hosted-sync-convergence-r1`. Their SHA-256 values were
verified locally. None was rewritten.

| Order | Migration | LF-normalized SHA-256 | Evolution |
|---:|---|---|---|
| 1 | `20260813170000_academy_study_actor_authority_convergence.sql` | `b6ac6d91dc1d9e37335a44fa46f1533e623fff7a2a41f9df98fb3137605b1488` | historical, unchanged |
| 2 | `20260813171000_academy_study_cross_device_authority.sql` | `49dfe14657fcf48d8bc72c26f77f3c47e3ec610db7ed9d4151c1e295a975edc5` | historical, unchanged |
| 3 | `20260813172000_academy_study_sync_lossless_v2.sql` | `003bc5adbc7148f32ae15c477fb093f420b69873e85b0d53a8fde147ad42a3e1` | historical, unchanged |
| 4 | `20260813173000_academy_study_sync_lossless_checkpoint_r1.sql` | `f464ff93d412b3dbcde2d6206b1c1492ae0479e4b26647228a0bc9a269591404` | historical, unchanged |
| 5 | `20260814120000_academy_family_response_checkpoint_r1.sql` | `46769f46b5453fc25cb13f1817c6c6756b516a2916ea21380a0a4040c51cf282` | new forward-only migration |
| 6 | `20260815120000_academy_family_plan_checkpoint_r1.sql` | `29693df72fb2e44c7226e64e8de11abdb83e1cf02e6a1b11a92111bc5b0d52d0` | new forward-only migration |

The authoritative full predecessor order and checksums are in
`docs/study-engine-final-production/migration-manifest.json`. A staging
operator must compare that manifest with a read-only staging inventory and
apply only executable migrations absent from the verified staging ledger.
Never replay the first four historical-baseline entries, edit an applied file,
insert migration-history rows manually, or apply a filename glob.

## Tables and RPCs

The two new forward migrations add three narrow tables:

- `public.academy_family_response_checkpoints`: one current header per hosted
  Study session, with exact hosted and local scope, learner, attempt, lesson,
  contract version, CAS revisions, operation UUID, timestamps, and document
  digest.
- `public.academy_family_response_checkpoint_items`: append-only item snapshots
  keyed by session, checkpoint revision, and item ref. Response kind/value and
  trusted assessment-receipt metadata are typed columns. Authenticated RLS
  exposes only the current revision; older revisions remain database recovery
  history.
- `public.academy_family_plan_checkpoints`: one strict
  `FamilyAutoPlannerDocumentV1` checkpoint per hosted learner. Its checked JSON
  shape contains only the School Plan and deterministic Auto Planner
  materialization provenance. It has independent Parent-only CAS and forced
  household/student RLS; arbitrary keys and learner-response content fail.

The canonical browser surface remains the strict four-RPC allowlist:

1. `academy_study_sync_first_link_v2`
2. `academy_study_sync_resolve_mapping_v2`
3. `academy_study_sync_hydrate_v2`
4. `academy_study_sync_write_v2`

The migration wraps the existing first-link, hydrate, and write routines
without changing their signatures. Existing operations delegate to the prior
implementations. The two new write operations are
`learner-response-checkpoint:compare-and-swap` with revision domain
`learner-response-checkpoint` and Parent-only
`family-plan-checkpoint:compare-and-swap` with revision domain
`family-plan-checkpoint`.

No table stores an arbitrary Family Pilot document. The server rejects unknown
keys and validates the exact contract/version, local household/student/learner,
explicit link, hosted household/student/assignment/session, attempt/lesson,
operation UUID, timestamps, response kinds, assessment receipt, byte/item
limits, and revision transition. A candidate cannot omit an already-hosted
item. Each accepted revision appends a complete typed snapshot.

## Exact cloud-state inventory

| Required state | Server authority |
|---|---|
| Learner roster/profile, nominal grade, subject working levels | Existing `academy_students`/guardian identity tables plus the exact R2 `student` and `studentProfile` checkpoint fields; no PIN/verifier field exists in either Family Cloud checkpoint. |
| Course enrollment | Existing `academy_subject_enrollments` remains canonical. Hydrate returns the current learner's typed enrollment projection; the Family Plan preserves the Parent-selected `courseRef` used for deterministic planning without becoming a second enrollment authority. |
| School Plan and calendar exceptions | `family-pilot.family-plan-checkpoint.r1` stores timezone, school-year bounds, weekdays, added/non-school dates, ordered subject plans, pause state, selected course, lessons/day, and local start time. |
| Manual and Auto Planner assignments | Manual/Core assignments remain in the R2 assignment authority. Automatic assignment provenance is stored as append-only materializations with deterministic `materializationRef` and `assignmentRef`; CAS prevents two devices from silently replacing the same planner revision. |
| Today/calendar placement and provenance | The R2 durable calendar stores block source identity, lineage, intended local date/time, placement source, segments, interruptions/reschedules, and event/revision state. The Family Plan supplies the non-derivable School Plan and materialization inputs. |
| Course/lesson completion and progress | R2 assignment records, certified completion state, completed/current segment refs, active-time aggregates, session state, checkpoints, and authority revisions. Course completion remains safely derivable from the synchronized catalog-bound lesson/assessment completion facts. |
| Exact lesson/segment/page resume | R2 session/checkpoint/calendar resume state includes lesson, segment, completed/remaining segments, active seconds, and the opaque `lesson-cursor:*` presentation progress ref used by the rich lesson player. |
| Learner instructional response needed to resume | The separate typed learner-response header/item snapshots described below. |
| Assessment/trusted scorer | R2 assessment state plus minimized outcome/receipt refs, decision, scorer ref, and time; no key, expected answer, rubric, or worked solution. |
| Guardian, Social source, and Safety state | R2 guardian attestations, approved source metadata, and learner/session-scoped immutable Safety hold history with Parent clear transitions. |
| Revision/provenance/conflict state | Independent authority, response, and Family Plan CAS domains with stable UUID receipts, explicit conflicts, source/lineage refs, creation/update times, and append-only facts where required. |

Hydrate returns the exact R2 authority checkpoint, learner-response checkpoint,
Family Plan checkpoint, and canonical course-enrollment projection when those
records exist. It never returns PIN material, answer authority, Tutor content,
provider secrets, or raw audio. Parent backup remains an independent local
recovery path and is not replaced by any cloud table.

## Learner-response checkpoint

`family-pilot.learner-response-checkpoint.r1` contains only:

- exact local household, student, learner, assignment, and session refs;
- attempt and lesson refs;
- base/current revisions, operation UUID, and saved time;
- at most 256 response items;
- item/section/segment refs, response/evidence kind, a bounded choice ref or
  bounded response text, local status/time, and an optional trusted assessment
  receipt.

The complete checkpoint is limited to 1 MiB; each response item is limited to
32 KiB and text to 16 KiB. It has no prompt body, curriculum material, answer
key, correct answer, worked solution, scoring guide, adult answer authority,
Tutor conversation/transcript, raw audio, behavioral inference, PIN, bearer
token, or service credential.

## Family Plan checkpoint

`family-pilot.family-plan-checkpoint.r1` is capped at 8 MiB and 10,000
materializations to match the accepted local planner ceiling. Every nested
object is exact-key validated. School Plan subjects and dates must be unique;
added/non-school dates must be disjoint; each automatic materialization must
have a deterministic `auto:*` ref and unique assignment ref. After first link,
local planner revision advances exactly by one and prior materializations are
absorbing. This stores no generated Today projection or device-local planner
implementation cache because those remain safely derivable.

## RLS and actor boundary

All three new tables have RLS enabled and forced. `anon`, `service_role`, and public
receive no direct table privilege. `authenticated` receives current-row SELECT
columns only and no INSERT, UPDATE, or DELETE. Explicit deny policies reinforce
RPC-only browser mutation.

- A guardian must be an active authenticated adult, hold current access to the
  exact student, and present the digest for a current Study grant issued by
  that same guardian. The grant household and stored row household must match.
- A learner JWT must declare `academy_principal_kind=student_session_grant`;
  `auth.uid()`/`sub` must equal the exact current grant UUID. Its digest,
  household, student, capabilities, expiry, revocation, credential version,
  and student session version must all remain current.
- A Household A principal cannot select or mutate Household B. A learner can
  select or CAS responses only on its exact student path; School Plan mutation
  is Parent-only. Revocation removes both RLS and RPC access immediately.
- `anon` has neither table SELECT nor RPC EXECUTE and cannot read family sync
  state.
- Existing trusted-server operations remain separately granted only to
  `service_role`; the new browser response path neither invokes nor grants
  them. Never place a service-role key in a browser environment.

## Lossless first link and conflicts

When `learnerResponseCheckpoint` or `familyPlanCheckpoint` is present, Parent
first-link requires the R2 authority checkpoint in the same request. It
validates identity and revision zero, takes scope locks, delegates to the
existing explicit-link transaction, and inserts the narrow checkpoint only
after that link succeeds. A conflicting pre-existing checkpoint returns
`mapping-conflict`; an exact retry is idempotent.

The device must then call `academy_study_sync_hydrate_v2`, compare the returned
authority, learner-response, and Family Plan checkpoints byte-for-byte with
its validated local export, verify canonical course enrollment, and verify all
returned revision numbers. Only that successful read-back permits a
device-local `first-link-complete` marker. Failure leaves the local IndexedDB
documents and portable backup authoritative and intact.

Later writes use expected-revision CAS and stable operation UUID receipts:

- exact retry returns the original result;
- reused UUID with different bytes returns `idempotency-collision`;
- stale expected revision returns `revision-conflict` plus server revision;
- malformed, wrong-scope, non-monotonic, item/materialization-removing, or answer-authority
  input returns `invalid-write` or the non-oracular denial envelope.

No RPC deletes local data or hosted response history. A hydrate must be merged
into verified local storage; it must never clear a local document or portable
backup merely because cloud data is missing, stale, invalid, or unavailable.

## Exact future staging procedure

### 1. Provision and identify staging

Create or select a separate Supabase project that is explicitly labeled
staging/non-production. Its 20-character ref must not be
`ymtvzmqhfvwjtxjdmybs`. Two operators must verify project ref, organization,
environment label, API hostname, database hostname, and billing/retention
scope. Do not use ambient Supabase CLI link state and do not run `supabase link`.

Required migration/preflight environment, set only for the controlled staging
shell:

```text
HOSTED_SYNC_TARGET_PROJECT_REF=<20-character staging ref>
HOSTED_SYNC_DATABASE_URL=<secret staging PostgreSQL URL whose host/user embeds that ref>
VITE_FAMILY_PILOT_ENABLED=false
VITE_STUDY_ENGINE_ENABLED=false
ACADEMY_STUDY_ENABLED=false
VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED=false
```

Required only for the later synthetic application/Auth probe build:

```text
VITE_SUPABASE_URL=https://<staging-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<staging publishable/anon key>
SUPABASE_URL=https://<staging-ref>.supabase.co
SUPABASE_ANON_KEY=<staging anon key, if the server harness requires it>
SUPABASE_SERVICE_ROLE_KEY=<staging secret; server process only, never VITE_*>
```

For a future Netlify staging context, configure the same `VITE_*` values in
that context only, keep `SUPABASE_SERVICE_ROLE_KEY` server-scoped, and pin all
Supabase URL/key values to the verified staging ref. This readiness branch
keeps both `FAMILY_HOSTED_SYNC_CONVERGENCE_R1.enabled` and
`HOSTED_SYNC_PRODUCTION_ACTIVATION.enabled` false; changing either requires a
separate reviewed staging-activation change. Environment variables alone must
not bypass those code gates.

Do not copy production values. Keep secrets out of shell history, logs,
screenshots, checked-in files, and evidence reports.

### 2. Configure staging Auth

- Enable the chosen guardian sign-in provider only in staging and configure
  staging Site URL/redirect allowlists. Disable open public sign-up unless the
  separately reviewed test plan requires it.
- Create synthetic guardian users and synthetic households/students only.
- Ensure guardian access tokens use normal `authenticated` role and `sub`
  equal to the guardian `auth.users.id`.
- Configure the reviewed server-side learner-token issuer so learner tokens
  are Supabase-verifiable JWTs with role `authenticated`,
  `academy_principal_kind=student_session_grant`, and `sub` equal to the exact
  current `academy_private.student_session_grants.id`. The raw Study token is
  never a JWT claim; RPCs receive only its SHA-256 digest.
- Verify expiry, revocation, credential replacement, household membership
  revocation, and student session-version rotation fail closed.

If the staging project cannot mint and verify that exact learner principal,
learner RLS/RPC validation is blocked; do not weaken the database predicate.

### 3. Capture recovery evidence before apply

Capture a provider-supported staging backup/snapshot. Record its identifier,
UTC completion, retention, restore owner, restore window, and expected RTO.
Preserve a read-only catalog/migration inventory and checksums outside the
database. Confirm all consumers/workers are disabled. A missing or
unrestorable backup is a stop.

### 4. Run local-only preflight

From a clean checkout at the exact pushed readiness SHA, run the existing
preflight without `--hosted-read`. It has no apply mode. Confirm the known
production ref is rejected, target ref matches the database URL identity,
flags are exactly false, all 56 manifest entries/checksums pass, the full
embedded-Postgres replay passes, and the rollback template is complete.

```sh
node scripts/hosted-sync-preflight/preflight.mjs \
  --learner-release-sha 7baf8dfbc27168708ed4cf504285a1838d7345f6 \
  --convergence-sha "$(git rev-parse HEAD)" \
  --target-project-ref "$HOSTED_SYNC_TARGET_PROJECT_REF" \
  --format operator
```

### 5. Inventory staging read-only

Only after steps 1-4, run the documented `--hosted-read` inventory against the
verified staging URL. Preserve catalog output/checksum. Compare every hosted
version, marker, owner, ACL, function signature, trigger, RLS flag/policy, and
checksum with the manifest. Any unexplained history or object collision is a
stop and requires a separate reconciliation migration/plan.

```sh
node scripts/hosted-sync-preflight/preflight.mjs \
  --learner-release-sha 7baf8dfbc27168708ed4cf504285a1838d7345f6 \
  --convergence-sha "$(git rev-parse HEAD)" \
  --target-project-ref "$HOSTED_SYNC_TARGET_PROJECT_REF" \
  --hosted-read \
  --format operator
```

### 6. Apply only the reconciled missing list

Use a separately reviewed, staging-only, stop-on-error operation. The checked-
in preflight deliberately cannot apply. Pin the target ref and readiness SHA;
require the backup and inventory evidence hashes plus an explicit one-time
staging authorization. Apply only the missing executable migrations in the
manifest's exact order, transaction by transaction. Do not use `supabase db
push`, migration globbing, historical replay, or raw migration-ledger edits.

### 7. Expected staging checks

With flags/workers still disabled, use two synthetic households, two guardians,
two learners, and two isolated device profiles to prove:

1. all three new tables are owner `postgres`, RLS enabled/forced, and browser DML is
   absent;
2. `anon` cannot SELECT or execute any sync RPC;
3. Guardian A and learner A see only current A rows; B sees only B rows;
4. A cannot select/update B through tables or RPC parameters;
5. stale/forged/revoked guardian and learner identities fail closed;
6. first-link uploads existing local authority, response work, School Plan,
   and planner provenance; hydrate reads it and course enrollment back exactly,
   and only then the device marks completion;
7. Device B CAS advances the response checkpoint and Device A receives the
   exact result; stale, colliding, removing, oversized, wrong-identity, and
   forbidden-key candidates are rejected;
8. prior item revisions remain in append-only recovery history while browser
   SELECT exposes only current revision rows;
9. Parent-only Family Plan CAS preserves School Plan exceptions and refuses
   stale, colliding, wrong-learner, unknown-field, or materialization-removing
   candidates; a learner cannot change the School Plan;
10. simultaneous devices converge on one deterministic Auto Planner
   materialization/assignment identity rather than creating ordinary duplicates;
11. no answer authority, scoring material, Tutor conversation, secret, or
   unrelated Family Pilot field appears in rows, receipts, or logs;
12. failed/offline cloud operations leave local IndexedDB and portable backup
    readable and unchanged.

For the two-device exercise, use separate clean browser profiles. On Device A,
create synthetic local work while cloud sync is off, authenticate synthetic
Guardian A, select learner A, perform first link, and retain the original local
export. Verify read-back before recording local link completion. On Device B,
authenticate the same Guardian A, select learner A, hydrate into empty local
stores, and compare roster/profile, enrollments, School Plan, Today work,
planner materializations, current assignment/session/segment/page, responses,
assessment, guardian, and Safety state. Advance response work on B; confirm A
receives it. Then submit concurrent Family Plan and response writes from A/B
and confirm one CAS succeeds while the stale side preserves its local copy and
gets an explicit conflict. Repeat negative probes with learner B and Household
B. Use only synthetic data.

### 8. Turn staging sync back off

Set `VITE_FAMILY_PILOT_HOSTED_SYNC_ENABLED=false`, restore the two hard code
gates to false if a separately reviewed staging-only change opened them, set
`VITE_STUDY_ENGINE_ENABLED=false` and `ACADEMY_STUDY_ENABLED=false`, and deploy
only to the staging context under that future authorization. Stop sync workers,
expire/revoke synthetic Study grants, and verify browser RPC traffic is zero.
Do not delete cloud rows or roll back applied migrations merely to disable the
feature; local IndexedDB and Parent backup remain available. This session does
not perform that deployment or activation.

### 9. Rollback and recovery

For an uncommitted failure, verify transaction rollback and catalog equality
with the pre-apply inventory. After any committed failure, keep every consumer
disabled, preserve local device data and evidence, and do not edit applied SQL,
drop response history, or rewrite the hosted ledger. Choose either the verified
provider snapshot restore or a separately reviewed additive forward-recovery
migration. Re-run inventory, full local replay, RLS/RPC probes, and cross-device
read-back after recovery.

Passing staging is evidence for a later activation decision only. It does not
authorize production contact, production migration, deployment, Auth changes,
feature enablement, worker enablement, or synthetic cleanup.

## Local evidence

The new migrations and complete manifest replayed from empty state in local
PGlite (embedded PostgreSQL). The Hosted Sync DB suite exercised real SQL,
guardian/learner/anonymous/service role simulation, forced RLS, table ACLs,
first-link, hydrate, response and Family Plan CAS/idempotency/conflict,
cross-household denial, strict-shape rejection, append-only history, and
revocation. Migration manifest
checks verified complete coverage and LF-normalized checksums. No hosted
connection variables were present during these tests.

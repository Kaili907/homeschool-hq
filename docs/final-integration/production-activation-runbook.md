# Manuel Academy production activation and rollback runbook

Classification: `PRODUCTION_ACTIVATION_RUNBOOK_READY`

This is the authoritative operator sequence for moving an eventual final release
candidate from `READY_FOR_HOSTED_PREFLIGHT` through hosted validation,
migrations, production configuration, deployment, and production smoke. It also
defines stop-the-line and rollback behavior. The machine-usable companion is
[`production-activation-checklist.json`](./production-activation-checklist.json).

This document performs and authorizes no hosted action. Phase 0 is local-only.
Each later phase requires a new authorization naming the exact system, scope,
operator, and time window. A pass in one phase never grants authority for the
next. The default response to a mismatch, unknown, partial result, or missing
evidence is `STOP`.

## Non-negotiable operating rules

1. Pin the entire activation record to one immutable `releaseSha`. If HEAD,
   deploy `COMMIT_REF`, manifest custody, or a built artifact identifies another
   commit, stop.
2. Never put a secret value, token, credential, recipient contact, learner
   content, learner answer, Tutor conversation, provider payload, private adult
   note, or raw database error into terminal output, screenshots, tickets, or
   the activation record.
3. Use synthetic/operator-safe smoke data. A real learner record is not a smoke
   fixture.
4. No mismatch may be hidden by changing migration history. Historical SQL is
   not replayed merely to make a ledger look complete.
5. Database migrations are treated as additive/forward-only after commit. A
   post-commit defect requires a separately reviewed forward repair, not an
   automatic destructive reversal.
6. Application rollback, feature disablement, worker disablement, provider
   disablement, curriculum pointer rollback, and database recovery are separate
   controls. Selecting one does not authorize another.
7. Existing Study authority is immutable: already-bound Study sessions remain pinned
   to their stored release and Effective Settings snapshot. Never rewrite
   an existing Study session binding during activation or rollback.
8. Preserve immutable audit, proposal, job, attempt, receipt, telemetry,
   idempotency, and migration evidence during containment.

## Activation record

Open one bounded record before Phase 0. At minimum it must hold:

- change and authorization references;
- operator references and timestamps;
- final RC branch and `releaseSha`;
- Supabase project reference and Netlify site ID;
- Netlify production branch and verified deploy trigger mode;
- migration-manifest Git blob plus the exact approved migration tuples;
- configuration name/scope/presence and durable revision references;
- deploy ID and deploy commit ref;
- local preflight and production smoke artifact references;
- bounded result/error/reason codes; and
- final decision and resulting deploy/configuration/migration state.

Record identifiers and presence, never secret values. Hashes belong in the
record; credentials do not.

## Repository command authority

Run commands from the final RC repository root on Windows. `npm.cmd` and
`npx.cmd` avoid PowerShell execution-policy problems.

| Authority | Exact repository command | Availability ruling |
| --- | --- | --- |
| Root tests | `npm.cmd test` | Present at the authoring base |
| TypeScript | `npm.cmd run typecheck` | Present at the authoring base |
| Production build | `npm.cmd run build` | Present at the authoring base |
| Secondary/unit/browser aggregate | `npm.cmd run test:secondary` | Present at the authoring base |
| Student Runtime browser | `npm.cmd run test:student-browser` | Present at the authoring base |
| Prototype UI browser | `npm.cmd run test:ui-browser` | Present at the authoring base |
| Final assembly browser | `npm.cmd run test:assembly-browser` | Present at the authoring base |
| Migration Reconciliation Planner | `npm.cmd run plan:migration-reconciliation` | Present; local and read-only |
| Admin Production Preflight R3 | `npm.cmd run preflight:admin-production:json` | Present; local and read-only |
| Study deployment environment | `npm.cmd run preflight:study-deployment-env -- --format json` | Present; local and value-silent |
| Unified Local Production Preflight | `npm.cmd run preflight:production-local:json` | Present; must return `READY_FOR_HOSTED_PREFLIGHT` |
| Study Local Production Smoke | `npm.cmd run smoke:study-production-local` | Real repository command at `a3c9a9483fde5054ac9b7606d34ae0d8863a8630`; it must exist on the final `releaseSha` |
| Study security/adversarial R4 | `npx.cmd vitest run netlify/functions/_shared/study-runtime/verified-academic-runtime.adversarial.test.js supabase/study-production-security-adversarial.db.test.ts` | Real suites at `0841d4a50e02cb0406331ab962d21824b4bc3bc7`; both files must exist on `releaseSha` |
| Study recovery/chaos | `npx.cmd vitest run src/study/production/studyRecoveryChaos.test.ts src/study/production/sessionController.test.ts netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js` | Real gate at `50ae5c05a09e12e2e573dfe9ecf984f95a7badc0`; files must exist on `releaseSha` |
| Runbook structure | `npm.cmd run validate:production-activation-runbook` | Present; local-only |

The final RC validation worktree was still at the authoring base and exposed no
named validation command when this runbook was authored. At activation time,
inspect the final `package.json`. If a named final-RC harness exists, record and
run its exact script. If it does not, record that fact and use the explicit gate
set above. Do not invent a harness name.

The authoring base does not pin or install a hosted Supabase CLI and has no
`supabase/config.toml`. Consequently this runbook does not fabricate a
copy-paste hosted command. During migration authorization, the operator must
select the current supported Supabase migration runner, record its version,
verified target-selection mechanism, dry-run invocation, and apply invocation,
and prove that it consumes `supabase/migrations` from `releaseSha`. The same
runner and target must be used for plan and apply.

## Phase 0 — Local RC gate

Hosted contact is prohibited in this phase. The release may enter Phase 1 only
when every item below is green on the same clean `releaseSha`.

### 0.1 Custody and integration

1. Record `git rev-parse HEAD` and require it to equal `releaseSha`.
2. Require `git status --porcelain` to be empty. Generated build output may be
   ignored, but no untracked or modified source may be needed to reproduce the
   candidate.
3. Compare the approved final integration inventory with the RC. Prove every
   source commit is an ancestor or is represented by an explicitly reviewed
   final diff. A branch name or worktree presence is not integration evidence.
4. Freeze the final diff and dependency-lock inventory. Any later source or lock
   change creates a new RC and restarts Phase 0.

### 0.2 Migration identity, manifest, and checksums

Run:

```powershell
npm.cmd run plan:migration-reconciliation
npm.cmd run preflight:admin-production:json
```

Require:

- one unique numeric version per SQL file;
- one manifest entry per file and one file per manifest entry;
- exact filename/version/dependency order;
- canonical LF-normalized SHA-256 agreement;
- exact marker-transition and supersession metadata;
- the reviewed frozen historical floor unchanged or covered by an exact
  approved reconciliation record; and
- no unresolved migration identity reference in tests or documentation.

The planner is read-only and has no apply mode. Planner output never turns a
duplicate into a pass.

### 0.3 Tests, typecheck, build, and browser gates

Run the full root, type, build, and secondary gates:

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:secondary
```

Retain the three browser project results separately even though
`test:secondary` invokes them:

```powershell
npm.cmd run test:student-browser
npm.cmd run test:ui-browser
npm.cmd run test:assembly-browser
```

Do not treat a package-local missing browser dependency, skipped browser
project, advisory without an accepted ruling, cold-timeout-only partial run, or
prototype-only pass as an authenticated production-host browser pass. Record the
RC's required manual screen-reader, 200% zoom, high-contrast, reduced-motion,
keyboard, physical-touch-device, and real speech-failure checks where its release
contract requires them.

After the production build, scan `dist` for credential-shaped literals,
server-only configuration names, direct Anthropic/ElevenLabs domains,
browser-provider-key mode, preview/local adapters, and synthetic production
authority. Any match must be investigated; an unexplained match stops the line.

### 0.4 Security/adversarial and recovery/chaos

The final RC must contain and pass the real R4 authority and database suites:

```powershell
npx.cmd vitest run netlify/functions/_shared/study-runtime/verified-academic-runtime.adversarial.test.js supabase/study-production-security-adversarial.db.test.ts
```

They must cover forged learner/household/role/release/settings/revision data,
unknown fields, cross-household access, invalid identifiers and timestamps,
idempotency collisions, stale/skipped revisions, RLS/grants, privacy fields,
enrollment changes, pointer changes, and immutable session binding.

The final RC must also contain and pass the recovery/chaos gate:

```powershell
npx.cmd vitest run src/study/production/studyRecoveryChaos.test.ts src/study/production/sessionController.test.ts netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js
```

Require recovery from before/after-commit network loss, duplicate begin,
transition/checkpoint acknowledgement loss, refresh/resume, stale revision,
content unavailability, manifest mismatch, settings unavailability, controller
replacement, terminal state, and database unavailability without duplicate
effects or fallback authority.

### 0.5 Local Study production smoke

The final RC must contain the Study smoke package script and run:

```powershell
npm.cmd run smoke:study-production-local
```

Require `STUDY_LOCAL_PRODUCTION_SMOKE_READY`, zero external-contact attempts,
and passes for settings, release authority, session begin, bound content,
checkpoint, resume, terminal state, negative authority probes, manifest/content
membership, stale revision, replay/collision, and legacy ambiguity. This harness
uses synthetic in-memory/PGlite state and is not a substitute for Phase 5.

### 0.6 Local preflights and final ruling

Run the three component authorities and unified entrypoint in an environment
that supplies required names securely but never prints values:

```powershell
npm.cmd run preflight:admin-production:json
npm.cmd run plan:migration-reconciliation
npm.cmd run preflight:study-deployment-env -- --format json
npm.cmd run preflight:production-local:json
```

Admin R3 must have no local integration, configuration, Study, provider
accounting, curriculum, or migration-identity blocker. Study environment must
have no missing, unsafe, or Netlify-configuration blocker. The planner must be
valid and mutation-free. The unified result must be exactly:

```text
READY_FOR_HOSTED_PREFLIGHT
```

That result authorizes only a separately approved read-only hosted preflight.
It does not authorize a project link, migration, configuration change, deploy,
smoke test, worker invocation, or provider call.

## Phase 1 — Hosted read-only preflight

Entry requires a separate authorization naming the exact Supabase project and
Netlify site and permitting only the listed reads. Record a zero-write
attestation at exit.

### 1.1 Supabase identity and migration history

Current repository evidence names Supabase project reference
`ymtvzmqhfvwjtxjdmybs`. This is an expected identity to verify, not sufficient
authority by itself. From authenticated hosted state, independently verify:

- organization, project ref, environment, database host, and API hostname;
- that the authenticated session is read-only for this phase; and
- that no value was inferred only from a local environment file.

Export the hosted migration ledger with the operator-approved read-only
procedure. Reconcile it against the manifest at `releaseSha`. Distinguish:

- exact applied entries;
- exact historical-equivalent objects awaiting an approved supported history
  baseline;
- exact executable entries absent and eligible for a later apply approval; and
- any unexpected, partial, ambiguous, renamed, or checksum-different entry.

The last category is an immediate stop. Do not replay a historical file, insert
raw ledger rows, or continue because object names look familiar.

### 1.2 Schema prerequisites and drift

Capture bounded catalog evidence for every dependency and candidate name:

- relation kind, owner, columns, defaults, constraints, and indexes;
- functions, identity arguments, owner, volatility, security-definer state,
  configured search path, ACL, and definition;
- RLS/FORCE state, policies, triggers, grants, and default privileges;
- required roles, `auth.uid()`, UUID/digest support, IANA timezone support, and
  transactional DDL assumptions;
- every repository marker/version transition expected before the first new
  migration; and
- exposed schemas, requiring `academy_private` to remain unexposed and browser
  roles to have no private-schema/object authority.

An unowned collision, unexpected owner/grant/policy, incompatible marker,
missing prerequisite, or unverifiable definition is `STOP`.

### 1.3 Owner/Admin bootstrap state

Record only active owner/admin counts and lifecycle state—never Auth user IDs or
email addresses. The authoring-base Admin authorization foundation deliberately
contains no browser role-mutation path. If hosted state lacks an active Owner
and the final RC still lacks a separately reviewed, audited bootstrap or
owner-management procedure, stop. An ad hoc table write is not a bootstrap.

### 1.4 Environment and Netlify identity

In Netlify, inspect names, scopes, contexts, and presence only. Verify the
public/server Supabase configuration identifies the same project without
copying the URL/key values into evidence.

Verify and record:

- team/site ID and production URL;
- production branch and deploy contexts;
- whether pushes to the production branch auto-publish;
- current production deploy ID and commit ref;
- build command, `dist` publish directory, and `netlify/functions` directory;
- Node 22, redirect ordering, SPA fallback, function inventory, and exact worker
  schedule; and
- required environment name presence/scope.

This check is mandatory because repository instructions conflict: `CODEX.md`
states that `master` triggers production while the older `DEPLOY.md` describes
`main`. Hosted Netlify truth, recorded in Phase 1, selects the Phase 4 trigger.
Do not guess.

If hosted state differs from expected in any respect: `STOP`. Phase 1 performs
no write.

## Phase 2 — Migrations

Phase 2 requires a new migration authorization after Phase 1 evidence review.

### 2.1 Exact approved list

The only migration allowlist is the ordered `migrations[]` array from:

```text
docs/study-engine-final-production/migration-manifest.json
```

at the recorded `releaseSha`, paired with `supabase/migrations` at that same
SHA. A table copied into this authoring-time runbook would become stale before
the eventual final RC and is therefore not an apply authority.

Before approval, materialize the exact concrete list into
`operatorRecord.approvedMigrationEntries`. Each entry must include:

- numeric version and filename;
- canonical LF SHA-256;
- dependency and required marker transition;
- classification and supersession status;
- hosted pre-state (`exact-applied`, `historical-equivalent`, or
  `exact-absent-executable`); and
- the exact approved action (`none`, supported history baseline, or apply).

No placeholder or rule-generated range is an approved list. The list is exact
only after every concrete tuple is recorded and signed. Any RC change invalidates
it.

Historical-equivalent foundation objects are never executed again. Recording
their versions in history requires its own explicit approval and the
then-current supported Supabase history procedure. Re-read the ledger and
object definitions afterward; any drift or partial result stops Phase 2.

### 2.2 Backup and apply mechanism

Before any mutation, verify a fresh restorable platform backup or recovery
point, recovery owner, retention window, target, and restore test. A statement
that backups are automatic is not verification.

Select one operator-approved, version-recorded Supabase migration runner that:

- authenticates to the independently verified project without placing a
  credential in the command line or evidence;
- consumes the tracked `supabase/migrations` directory at `releaseSha`;
- provides a no-write plan/dry-run;
- records transaction result and migration ledger state; and
- is the same tool/version/target for dry-run and apply.

Run the no-write plan first. Its complete order must exactly equal the approved
`exact-absent-executable` entries. Extra, skipped, reordered, repeated, or
changed entries stop the line. SQL copy/paste and ad hoc ledger mutation are
prohibited.

### 2.3 Dark-state apply sequence

1. Confirm new Study entry, provider work, and worker claims are dark or
   fail-closed for the window.
2. Apply only the approved tracked list with the approved runner.
3. Stop on the first unexpected prompt, plan difference, checksum difference,
   or transaction failure. Do not proceed to later entries.
4. Re-export the ledger and verify every committed version/hash/order.
5. Verify every marker transition, relation/function definition, owner,
   search path, RLS/FORCE flag, policy, trigger, constraint, index, grant, object
   count, and exposed-schema result.
6. Run exact role/JWT/PostgREST denial and allowed-path probes using approved
   synthetic identities. Browser roles must not gain private table or trusted
   worker RPC access.
7. Record the final migration state before Phase 3.

A failure inside a transaction must be verified as leaving no partial entry or
object. A failure after commit is not undone automatically: keep consumers dark,
preserve evidence, and open a separately reviewed additive repair.

## Phase 3 — Production configuration

Phase 3 requires a new configuration authorization. Evidence records variable
names, scope, presence, revisions, and verification references—not values.

### 3.1 Required environment names

| Group | Names and requirements |
| --- | --- |
| Study client gates | `VITE_STUDY_ENGINE_ENABLED` exact `true`; `VITE_STUDY_ENGINE_PREVIEW` absent/`false`; `VITE_ALLOW_BROWSER_PROVIDER_KEYS` absent/not `true` |
| Supabase public client | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; intentionally public, same project as server configuration |
| Supabase server | `SUPABASE_URL`, optional `SUPABASE_ANON_KEY`, server-only `SUPABASE_SERVICE_ROLE_KEY` presence |
| Study server/safety | `ACADEMY_STUDY_ENABLED` exact `true`; `STUDY_SAFETY_RATE_LIMIT_HMAC_KEY` presence; `ANTHROPIC_API_KEY` presence |
| AI/TTS ceilings | `ACADEMY_AI_ENABLED`, `ACADEMY_TTS_ENABLED`; provider credential presence for `ANTHROPIC_API_KEY` and `ELEVENLABS_API_KEY`; private `ELEVENLABS_ALLOWED_VOICE_IDS` when premium TTS is approved |
| Worker references | `ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID`, `ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_ID`, `ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION`, `ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION` |
| Worker secrets | Presence only for `ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL` and `ACADEMY_STUDY_ADULT_REVIEW_WORKER_INVOCATION_SECRET` |
| Deployment versions | `ACADEMY_APP_VERSION`; optional independent `ACADEMY_TUTOR_ENGINE_VERSION`, `ACADEMY_JARVIS_ENGINE_VERSION`, `ACADEMY_TTS_ENGINE_VERSION`; host `COMMIT_REF` and `DEPLOY_ID` |
| Checked-in build contract | `VITE_USE_PROXY=true`, `NODE_VERSION=22`, functions directory `netlify/functions`, publish directory `dist` |

For each server-only name, verify that no populated `VITE_` counterpart exists.
The Study environment preflight must pass again without echoing values.

### 3.2 Verified provider pricing terms

Production price is durable authority, not an environment variable. Use the
owner-authorized preview/commit flow for effective-dated terms. Independently
verify every exact tuple:

```text
provider + providerProductId + providerModelId + logicalModelTier
+ usageUnit + currency + unitSize + priceMicrosPerUnitSize
+ effectiveFrom/effectiveUntil + revision + verificationRef
```

Require USD, canonical decimal-string IntegerMicros, half-open non-overlapping
intervals, exact provider account/model terms, and one applicable term for every
positive billable unit. Anthropic token/read-cache/request and ElevenLabs
character/request dimensions must match the final provider contract. Unsupported
or ambiguous dimensions remain `unavailable`; they never become zero by
assumption. Retain pricing history and component snapshots.

### 3.3 Durable AI/TTS configuration

Record revisions for:

- `runtime.ai.enabled` and `runtime.tts.enabled`;
- `quota.ai.requests_per_account_day` and
  `quota.tts.requests_per_account_day`;
- `ai.approved_tiers` and `ai.default_tier`; and
- `cost.warning.monthly_micros` and `cost.critical.monthly_micros`.

Deployment ceilings and durable settings are AND/lesser-of controls; durable
configuration cannot broaden a deployment-disabled provider, quota, model, or
voice. Premium TTS requires an approved private logical-voice mapping and exact
voice-version/catalog revision matching the private provider allowlist. If no
approved mapping exists, keep synthesis disabled and use the browser-speech
fallback honestly.

### 3.4 Study Effective Settings, curriculum, and worker

Verify Effective Settings V2 resolves `ready` for the synthetic smoke learner
under `admin_default < guardian < accommodation < safety`. `manual_review` or
`unavailable` is not production readiness. Record only safe source categories
and configuration revisions.

Verify the published curriculum release, manifest digest, release registry,
production pointer revision, enrollment compatibility, and immutable session
binding contract. Do not activate a draft or edit a published release.

For the worker, verify:

- opaque worker identity and credential/configuration versions;
- credential and manual invocation secret presence only;
- active least-privilege database registry/scopes;
- complete production recipient/outbox/lease/attempt/receipt/limiter/monitoring
  composition;
- the private scheduled function at exact `*/5 * * * *`; and
- the public/manual worker remains separately secret-authorized and unscheduled.

Email has no repository-approved production provider at the authoring base and
SMS is disabled. Do not invent either route. The durable in-app route may be
used only when its live permission, route, provider, receipt, idempotency, and
monitoring gates are ready.

### 3.5 Configuration exit

Freeze a configuration state record containing names/scopes/presence,
non-secret identifiers, durable revisions, pricing term revisions, release
pointer revision, worker versions, intended feature-gate states, and verification
references. Re-run the Study environment and unified local preflights. A value
must never be printed to prove presence.

## Phase 4 — Deploy

Phase 4 requires a new deployment authorization that binds one packet:

- `releaseSha` and release branch;
- verified migration ledger/marker state;
- frozen configuration state record;
- Netlify team/site ID, deploy context, production branch, and trigger mode;
- previous green rollback deploy ID; and
- smoke owner and rollback owner.

### Controlled sequence

1. Reconfirm Phase 1's hosted Netlify production branch and trigger behavior.
   Use only the verified auto-publish path or verified manual production deploy
   control. Do not infer `main` or `master` from local prose.
2. Trigger one production deploy for the approved `releaseSha`. Do not clear
   caches or launch a second deploy without recording a new reason and
   authorization.
3. Record deploy ID, start/end timestamps, build result, and published URL.
4. Require deploy `COMMIT_REF` to equal `releaseSha`.
5. Verify build command, `dist`, `netlify/functions`, Node 22, redirect order,
   SPA fallback, function inventory, exact schedule, environment context, and
   configuration-state linkage.
6. Before broad navigation, verify the shell, service-worker release identity,
   Admin authorization boundary, Study readiness boundary, and worker health
   return bounded expected states with no private or secret data.

If deploy identity is wrong, readiness is unexpectedly unavailable, or a
response leaks data, stop before Phase 5 and use the rollback matrix.

## Phase 5 — Production smoke

Phase 5 requires production-smoke authorization and approved synthetic/operator
fixtures. Do not create a dependency on real learner history.

| Smoke family | Operator check | Pass evidence |
| --- | --- | --- |
| Admin shell | Open `/academy/admin`; verify correct Owner/Admin/Viewer projection, navigation, loading/denial states, and denial for unassigned/insufficient role | bounded authorization states and status codes |
| Overview | Verify app/curriculum versions, freshness, completeness, unavailable/partial labels, and no fabricated zero | snapshot version/time and completeness states |
| Audit | Read/filter/page append-only events; confirm no content, secret, provider body, or raw error | result/count and bounded resource/action refs |
| Configuration | Verify effective values/revisions, runtime enforcement, deployment ceilings, and protective disable behavior without mutation | configuration revision refs and safe projection |
| Engine Performance | Verify versioned aggregates, half-open range behavior, honest truncation/completeness, and Study/engine separation | version/range/completeness results |
| System Health | Verify Admin API, persistence, Tutor, Study, assessment, and curriculum states; unavailable is not healthy | component states and reason codes |
| Costs | Verify decimal-string IntegerMicros, rounding fixture, thresholds, calculated/reconciled/unavailable separation, request unit, and no invented zero | arithmetic fixture and threshold state |
| Provider Pricing | Verify exact active/future terms, non-overlap, revisions, verification refs, unsupported/ambiguous handling | term IDs/revisions and safe status |
| Study Operations | Verify readiness, backlog/lease/attempt/receipt/monitoring states and one bounded worker-run evidence record | run/attempt/receipt refs and reason codes |
| Curriculum Studio | Verify published/draft/validation/release separation, immutable published artifacts, and current pointer; perform no unplanned publish | release/version/pointer/validation refs |
| Study learner route | Open `/study-engine`; verify server-derived identity, readiness honesty, refresh/deep link, learner switch/logout cancellation, and no preview fallback | route/denial/cancellation states |
| Begin/resume/content | Begin one synthetic session, verify release/settings/content binding, checkpoint, refresh/resume, and exact replay behavior | opaque refs, versions, and bounded lifecycle codes |
| Worker schedule/run | Verify private five-minute schedule and one bounded run; prove one claim/attempt, duplicate suppression, and no false delivered claim | schedule, run, attempt, receipt evidence |
| Telemetry delivery | Create one synthetic event/attempt path; prove writer delivery and exactly-once aggregate change with app/engine/curriculum versions | event/attempt refs and before/after counts |
| Authorization/privacy | Probe unauthenticated, insufficient role, forged authority, and cross-household paths; scan network/client output for secrets/private content | denial matrix and zero-leak result |
| Mobile/deep link | Verify `/academy/admin` and `/study-engine` refresh/SPA fallback, 320px/390px reflow, touch/keyboard/focus/reduced-motion, and service-worker update | device/browser/deep-link matrix |

The Study session smoke must prove two directions:

- a new session resolves the current approved pointer and Effective Settings;
- resume uses the session's stored immutable release/settings even after an
  authorized synthetic pointer-change probe.

Any attempt to rewrite that stored binding is a stop-the-line incident.

Accept the release only if every required smoke family passes. A failure,
unexpected unavailable state, privacy concern, unbounded error, or unknown is
`STOPPED`, not “pass with conditions.”

## Rollback matrix

Contain new effects first: stop new Study entry, provider work, and worker claims
as applicable while preserving durable evidence.

| Control | Use when | Action | Must remain true |
| --- | --- | --- | --- |
| Application rollback | UI/function regression with compatible schema | Publish the previously recorded green immutable Netlify deploy through the verified production control | Database state and evidence remain; rollback deploy commit ref is exact |
| Feature-gate disable | Study runtime/authority risk | Disable `ACADEMY_STUDY_ENABLED` immediately and `VITE_STUDY_ENGINE_ENABLED` in the next controlled build; keep preview/browser-provider-key modes off | Data and bindings remain; no preview fallback |
| Worker schedule disable | Duplicate, unauthorized, indeterminate, or unsafe worker behavior | Stop scheduled/manual claims using verified Netlify schedule and worker readiness/credential controls | Preserve jobs, leases, attempts, receipts, proposals, and monitoring; reconcile before re-enable |
| Provider AI/TTS disable | Safety, pricing, accounting, credential, or output risk | Set deployment and durable AI/TTS gates false through approved controls; rotate only if compromise requires it | Preserve usage, attempt, pricing, component, and audit history |
| Curriculum active-pointer rollback | Published release defect affecting new resolution | Use the Owner-authorized audited pointer operation to a previously published immutable release | Never edit/reuse a published version; pointer history remains |
| New Study session release rollback | Newly active release causes bad new sessions | Stop new begins, roll the pointer back, smoke, then re-enable | New begins use prior release; already-bound sessions keep their original release/settings |
| Database forward repair | Post-commit database defect | Keep consumers dark and apply a separately reviewed additive repair | Durable data, immutable histories, RLS, attempts, receipts, telemetry, and audit remain intact |

### Session binding invariant

Curriculum pointer rollback changes only future resolution. New Study sessions
created after the rollback may bind to the prior published release. Every
already-bound Study session remains pinned to the exact release UUID/package/
version/manifest digest and Effective Settings snapshot stored at begin. Resume
must use those stored values. Do not bulk update, rebind, “normalize,” or
silently abandon such sessions to make the pointer uniform.

### Database rollback ruling

Do not assume a committed migration is reversible. Most production migrations
are additive and contain durable identity, configuration, audit, attempt,
receipt, pricing, release, or session authority. The safe response is:

1. block affected entry points and stop worker claims;
2. capture the exact ledger/marker/object state;
3. verify whether a failed transaction committed anything;
4. preserve data and immutable evidence; and
5. design, review, checksum, rehearse, authorize, and apply a narrow additive
   forward repair.

Never weaken RLS, erase audit/attempt/receipt history, replay historical SQL,
or rewrite Study session bindings as emergency recovery.

## Stop-the-line conditions

Stop immediately on any of the following:

1. **Migration checksum mismatch** — any release file, manifest, dry-run,
   hosted ledger, or recorded checksum differs.
2. **Unexpected hosted migration** — extra, partial, reordered, ambiguous, or
   unknown ledger version.
3. **Authorization failure** — Admin, guardian, learner, worker, or service
   authority is too broad, unexpectedly absent, caller-authored, stale, or
   cross-household.
4. **Privacy leak** — any secret, credential, contact, learner content, Tutor
   conversation, provider body, private note, SQL, or raw backend error crosses
   an unauthorized boundary.
5. **Provider pricing wrong** — missing, ambiguous, stale, overlapping, or
   incorrect provider/product/model/tier/unit/currency/rate/account term.
6. **Cost arithmetic wrong** — incorrect IntegerMicros rounding, component,
   request-unit, threshold, or aggregate arithmetic.
7. **Study authority bypass** — preview, synthetic, client-authored identity,
   release, settings, content, capability, or revision becomes production
   authority.
8. **Worker duplicate delivery** — more than one effect/delivered claim for one
   attempt/idempotency identity, or delivery without a verified bound receipt.
9. **Telemetry duplicate counting** — one logical event/attempt persists or
   aggregates more than once, or a replay changes immutable facts.
10. **Production smoke failure** — any required Phase 5 check fails, is unknown,
    or is unexpectedly unavailable.
11. **Unexpected release binding behavior** — resume re-resolves current
    pointer/settings or pointer rollback changes an existing session binding.

The immediate response is containment, minimized evidence preservation, and the
smallest compatible rollback control. Do not keep applying migrations, deploy a
second candidate, or broaden a gate while investigating.

## Incident evidence

Record:

- `releaseSha`, release branch, deploy ID, and deploy commit ref;
- Supabase project ref and Netlify site ID;
- migration-manifest Git blob plus versions, filenames, and hashes;
- preflight result/artifact refs and phase timestamps;
- configuration name/scope/presence and revision refs;
- smoke result/artifact ref;
- bounded error/reason codes and opaque event/job/attempt/receipt/session refs;
- feature, provider, worker, and curriculum pointer states; and
- final accepted/stopped/rolled-back decision and current state.

Do not record secrets, token fragments, credentials, learner identity/content,
answers, Tutor text, recipient contacts, private adult notes, provider requests
or responses, or raw database errors. Count-only state, non-secret revisions,
hashes, opaque references, and bounded reason codes are sufficient.

## Closeout

Run the local structure validator against the final artifacts:

```powershell
npm.cmd run validate:production-activation-runbook
```

Then close the activation record with exactly one ruling:

- `PRODUCTION_SMOKE_ACCEPTED` — every phase and smoke family passed on the exact
  recorded state; or
- `STOPPED` — containment/rollback state and follow-up owner are recorded.

This runbook artifact itself is classified:

```text
PRODUCTION_ACTIVATION_RUNBOOK_READY
```

# Admin Console RC2 release evidence

Evidence snapshot: `2026-08-11T01:24:39Z`

Evidence package status: **READY FOR OPERATOR REVIEW**

Production decision: **NO-GO / UNVERIFIED**

`RC2_SHA = PENDING`

This package is repository evidence, not authorization to push, merge, contact
hosted infrastructure, apply migrations, deploy, publish, activate, or roll
back. The operational holds and decision rubric are in
[`rc2-go-no-go.md`](rc2-go-no-go.md).

## 1. Release candidate identity

| Identity | Exact value | Ruling |
| --- | --- | --- |
| RC1 | `4e404e7bce1ba7e843824e18c338148c23ac1896` | Completed local RC1 assembly and evidence-pack base. |
| RC2 | `PENDING` | No completed RC2 union was present at the evidence snapshot. |
| Observed in-progress RC2 assembly head | `d00bc6c8be3e83828f7a36a37c95724a00a1ccc5` | Required source cherry-picks are present, but the assembly worktree has uncommitted reconciliation edits and no final validation commit. This is **not** RC2. |
| Evidence branch | `mac/admin-release-evidence-pack` | Documentation/tooling branch only. |
| Evidence base | `4e404e7bce1ba7e843824e18c338148c23ac1896` | Matches the requested base. |

The observed in-progress assembly descends from RC1 and contains the required
security, privacy, release-control, provider-accounting, migration-audit, and
release-rehearsal source cherry-picks. At the snapshot its worktree still had
uncommitted migration-audit/package/replay reconciliation. A branch name or
dirty assembly head is not a release identity; RC2 becomes identifiable only
when its complete union is committed, its exact SHA is recorded, and the final
union passes its own checks.

All source references below are immutable commit-and-path pairs. Inspect one
with `git show <full-sha>:<path>`. Run the read-only integrity check from the
repository root with:

```sh
node scripts/check-admin-release-evidence.mjs
```

The checker accepts no arguments, runs only local read operations, and contacts
no hosted infrastructure.

## 2. Source evidence ledger

| Evidence | Exact SHA | Verifiable artifacts | What it establishes | Limit |
| --- | --- | --- | --- | --- |
| RC1 | `4e404e7bce1ba7e843824e18c338148c23ac1896` | `docs/study-engine-final-production/migration-manifest.json`; `src/components/admin/AdminConsoleRoute.tsx`; `netlify/functions/_shared/admin-production-readiness/service.js` | Integrated repository feature set and a 32-entry local migration manifest. | Does not include the later red-team fixes and says nothing about hosted state. |
| Security red-team fix | `25d2001001c89734c3ddea7581a7ad6156b9c624` | `docs/admin-security-redteam-w7-3.md`; `netlify/functions/admin-security-redteam.test.js`; `supabase/migrations/20260810153000_academy_admin_configuration_reauthorization.sql` | Closes stale Owner authorization at configuration write time and ambiguous Safety query parsing. | Report explicitly says corrective migration not applied hosted. |
| Curriculum privacy red-team fix | `076190b1812f2eb8b77b24335943a2e46283cca9` | `docs/admin-console/curriculum-privacy-hardening-migration.json`; privacy-focused endpoint/source tests; `supabase/migrations/20260810160000_academy_curriculum_privacy_hardening.sql` | Narrows resource inventory, collaborator-scoped reads/writes, and preview/diff protected fields. | Committed fix/test evidence; no separate committed execution report. Present only in the unfinalized assembly. |
| Curriculum release-control red-team fix | `af0f7f25331f98e0de1a3921330d10ec1ecb7a66` | `MIGRATIONS.md`; three release-control migration JSON records; release-control DB tests | Rebinds retries to persisted provenance, verifies canonical package identity/counts, and rejects stale pointer receipt success. | Committed fix/test evidence; no separate committed execution report. Present only in the unfinalized assembly. |
| Provider-accounting red-team fix | `4b059e6de2fd109eab6f46e9f8d56897d4f4550d` | `docs/provider-attempt-journal.md`; provider gateway tests; provider-attempt migration | Binds ledger links to normalized outcomes and makes unavailable/indeterminate journal readiness stop provider dispatch. | Journal coverage is not provider-invoice completeness. Present only in the unfinalized assembly. |
| Migration audit | `1643df521d2dbc406e85795d25cbbfe7ba2542ae` | `docs/admin-migration-chain-audit.md`; `scripts/replay-admin-migration-union.mjs`; collision detector and tests | Identifies prefix/content collisions, selects a 32-artifact union, and records a clean disposable PGlite replay. | Predates final RC1 byte choices and all later red-team migrations; it is topology evidence, not the RC2 custody manifest. |
| Release rehearsal | `cf9ead79454c6950112fceebb66036cfe480161c` | `docs/admin-console/production-release-rehearsal.md`; `docs/admin-console/production-release-runbook.md`; `scripts/admin-release-rehearsal.mjs` | Records local stage, publish-not-active, two activations, pointer rollback, CAS, immutable artifacts, and negative stop rehearsals. | Ran on the release-control branch, not a completed RC2. Disposable/local evidence only. |
| Monthly cost-alert runtime | `275d02fe976f8600e780bd8bc48e78fdd440f4bd` | `docs/admin-configuration-runtime.md`; evaluator and focused tests | Implements the trusted UTC-month, usage-derived calculated-cost alert evaluator. | Alert only; not a provider limit, invoice, or automatic shutdown. |

The machine-readable source list and artifact digests are in
`rc2-release-evidence-manifest.json`. The checker verifies every source commit,
artifact digest, and migration digest without trusting a moving branch name.

## 3. Admin feature inventory in RC1

“Built” in this table means present in the RC1 repository tree. It does not mean
deployed, migrated, configured, populated, or activated in production.

| Surface | Repository implementation | Authority / behavior |
| --- | --- | --- |
| Authenticated shell and overview | `src/components/admin/AdminConsole.tsx`; `AdminConsoleRoute.tsx`; Admin overview endpoint | Exact `/academy/admin` route; server authorization resolves before protected data renders; unknown/unavailable states remain explicit. |
| Attention Center | `AdminAttentionCenter.tsx`; attention model/loader | Aggregates bounded operator attention signals without inventing missing evidence. |
| Learner Operations | `LearnerAnalytics.tsx`; `admin-learners.js` | Authorized minimized learner projections; no raw Tutor/Study transcript or answer content. |
| Engine Performance | `EnginePerformanceDashboard.tsx`; `admin-engine-performance.js` | Canonical engine/version aggregates and honest incomplete/unavailable states. |
| AI & Costs | `AdminCostsDashboard.tsx`; `admin-costs.js`; cost ledger and monthly alert evaluator | Exact integer-micro costs, provider accounting coverage, and alert-only monthly thresholds. |
| System Health | `SystemHealthDashboard.tsx`; `admin-health.js` | Canonical healthy/degraded/unavailable/disabled/unknown states. |
| Incident / Correlation Explorer | `AdminCorrelationExplorer.tsx`; `admin-correlations.js` | Bounded cross-domain operational correlations, not raw learner content. |
| Safety Operations | `AdminSafetyOperations.tsx`; `admin-safety-operations.js` | Read-only safety projection with independent server capability checks. |
| Curriculum browser and Studio | `src/admin/curriculum/`; curriculum endpoints | Published browsing plus private drafts, structured editing, collaborators, CAS/idempotency, and tombstones. |
| Curriculum validation and review | validation engine/UI, preview/diff, standards review, approval | Exact-revision validation, protected diff reduction, human-review decisions, and Owner approval binding. |
| Curriculum release controls | staging, integrity, publishing, activation, and history modules | Immutable staging/provenance, publish-not-active separation, pointer CAS, append-only activation/rollback history, learner-pin isolation. |
| Configuration | `AdminConfiguration.tsx`; `admin-configuration.js`; runtime resolver | Owner-only confirmed CAS writes; saved/effective distinction; stronger deployment constraints win. |
| Audit Log | `AdminAuditLog.tsx`; `admin-audit.js` | Append-only bounded audit reads and atomically coupled protected mutations. |
| Access & Permissions | `AdminAccessPermissions.tsx`; `admin-access.js` | Owner-managed canonical Admin assignments; final Owner protection and revocation semantics. |
| Production Readiness | `ProductionReadinessCenter.tsx`; `admin-production-readiness.js` | Composes repository, configuration, telemetry, accounting, Study, and hosted-evidence gates; absent hosted probes stay unverified. |

## 4. Authorization evidence

RC1 uses Supabase Auth identity plus server/database-controlled `viewer`,
`admin`, and `owner` assignments. Browser roles, household guardian status,
Parent Hub PINs, learner grants, and client capability arrays are not Admin
authority. Endpoints independently require canonical capabilities; protected
database mutations rederive current assignment state.

The security red-team report at
`25d2001001c89734c3ddea7581a7ad6156b9c624` records two fixes:

- configuration commits reauthorize and lock the current Owner assignment at
  the durable write point; and
- Safety Operations rejects malformed, duplicated, or conflicting query
  representations instead of accepting a default query.

That report records 66 Admin-focused files / 718 tests, 15 post-fix
configuration DB tests, 275 repository test files / 3,132 tests on Node 22,
typecheck, build, strict migration check, and diff check as passing. These are
committed report claims for that exact branch. This evidence session did not
reinterpret them as a completed RC2 run.

Unverified: hosted Admin assignments, sole/current Owner status, hosted grants,
RLS, policies, RPC definitions, and application/DB authorization behavior.

## 5. Privacy evidence

RC1 operational telemetry is allowlisted, bounded, content-free, and separate
from learning, safety, cost, and audit authorities. It prohibits prompts,
responses, transcripts, audio, assessment content/answers, secrets, contact
details, protected learner work, and diagnostic/personality inference.

The privacy red-team fix at
`076190b1812f2eb8b77b24335943a2e46283cca9` additionally:

- omits stored media/resource locators from bulk inventory/search/detail;
- enforces current draft collaborator assignment inside standards, approval,
  validation, and staging service RPCs; and
- removes scoring guidance, mastery policy, Tutor routing, safety/privacy
  directives, and guardian-visibility notes from preview/diff before/after
  values.

Its migration SHA-256 is
`e905cfd2bf1191a97dccb933e4b918c2d6d4bb3eb0e3660958fb5fe3302a7886`.
It is repository-only source evidence and is present only in the unfinalized
assembly, not a completed RC2.

Unverified: hosted schema/policies, retention jobs and durations, real response
redaction, production logs, analytics exports, backups, and third-party data
flows.

## 6. Provider-accounting evidence

The authoritative usage/cost ledger remains separate from the Provider Attempt
Journal. The journal records one append-only lifecycle per physical attempt;
the ledger owns usage quantities, pricing provenance, billing disposition, and
calculated/reconciled cost. `invoiceCompletenessClaim` is explicitly false.

The provider-accounting red-team fix at
`4b059e6de2fd109eab6f46e9f8d56897d4f4550d` adds normalized outcome matching to
ledger links and makes unavailable/indeterminate reservation or
dispatch-readiness receipts prevent provider dispatch. Its changed
provider-attempt migration SHA-256 is
`92dc0d47e22d8fff03b4c4034bfc558351e8ca16373ec464e75b75d42a7bd192`.
RC1's normalized provider-attempt migration has different pre-red-team bytes;
final RC2 must retain the hardened bytes under the final normalized filename and
commit the regenerated manifest.

Unverified: production provider account identity, actual provider products and
prices, usage continuity, invoice reconciliation, budgets/limits, alert routing,
kill-switch ownership, and production journal/ledger gaps.

## 7. Cost-alert evidence

Commit `275d02fe976f8600e780bd8bc48e78fdd440f4bd` implements the server-owned
monthly evaluator consumed by Costs, Overview, and Production Readiness. It
uses the UTC calendar month and the usage ledger's recorded `calculated` cost.
It never accepts browser totals or dates and never treats unknown cost as zero.

The evaluator distinguishes `normal`, `warning`, `critical`, `partial`, and
`unavailable`. Incomplete non-negative evidence may prove critical after the
lower bound crosses the critical threshold; it cannot prove normal/warning
below that threshold. Thresholds do not shut down or reroute providers and do
not establish a provider invoice total.

Unverified: hosted saved thresholds, effective runtime projection, current
monthly completeness/state, provider-side hard limits, and alert recipients.

## 8. Curriculum workflow evidence

RC1 contains the repository workflow: immutable published registry → private
draft → structured edit/collaboration → validation → preview/diff → standards
review → exact-revision Owner approval → immutable stage/integrity check →
publish as `PUBLISHED, NOT ACTIVE` → separately authorized pointer activation →
append-only pointer rollback/history.

The flow uses CAS revisions, request/digest idempotency, bounded audit metadata,
and immutable release/artifact custody. Activation does not repin existing
learners. The privacy and release-control red-team fixes strengthen this flow
but remain part of an unfinalized assembly, not RC2.

Unverified: a production draft/revision, current validations/reviews/approval,
target-version availability, staged artifact custody, publication, pointer
revision/history, and learner-pin counts/digests.

## 9. Release-control evidence

The release-control red-team fix at
`af0f7f25331f98e0de1a3921330d10ec1ecb7a66` changes all three release-control
migrations. It binds staging/publishing replay to persisted identities,
requires the canonical Manuel Academy package identity, binds activation to
package and aggregate counts, and refuses a historical success receipt after a
later pointer transition.

| Source migration | Red-team SHA-256 |
| --- | --- |
| `20260810150000_academy_curriculum_release_staging.sql` | `c7976b3680a529d2cfb35650c50de065b2b08ff455097878daf1db09fd9144ca` |
| `20260810160000_academy_curriculum_release_publishing.sql` | `5e5b1df65106561399cb36b29c2585fc758f8d1c1b255ca39d38881c628e930e` |
| `20260810170000_academy_curriculum_activation_rollback.sql` | `4af0aedaae7a781da811652d967d399d5614d9372fbfe10fdbc158724c9273ec` |

These are source-branch bytes, not a final RC2 manifest. Production
publication and activation remain separate Director hold points.

## 10. Migration evidence

RC1 contains 32 ordered SQL files and a 32-entry custody manifest. The evidence
checker reads both from RC1, requires exact file coverage/order/dependencies,
and recomputes every LF-normalized migration SHA-256.

The migration audit at
`1643df521d2dbc406e85795d25cbbfe7ba2542ae` records the original collision
analysis and disposable replay: 32 applied artifacts, 71 explicitly forced-RLS
tables, expected service grants/routines, and 134 serial verifier/database tests
passing. RC1 assembly later changed several final migration bytes while keeping
the normalized topology; therefore the RC1 manifest, not the audit's earlier
hash table, is the byte authority for RC1.

RC2 cannot reuse the RC1 manifest unchanged:

- security adds `20260810153000_academy_admin_configuration_reauthorization.sql`
  with SHA-256
  `e533b15b04157cd1a7015221b59fe483b3f67691ccf6f5a497e592398c978308`;
- privacy adds a `20260810160000` prefix that collides with release publishing;
- provider red-team changes the normalized provider-attempt bytes; and
- release-control red-team changes staging, publishing, and activation bytes.

The in-progress assembly currently normalizes the privacy migration to the
`20260810155000` prefix without changing its SQL bytes. Final RC2 assembly must
commit that resolution, update every filename/dependency/document/test
reference, generate one complete manifest, and replay the exact final union.
Until then, migration status is **NO-GO / UNVERIFIED**.

## 11. Local rehearsal evidence

Commit `cf9ead79454c6950112fceebb66036cfe480161c` records a network-denied,
in-memory PGlite rehearsal. Its positive path staged and published two synthetic
releases without activation, activated each with pointer CAS, rolled back to a
prior release by appending a fourth pointer revision, preserved immutable rows
and history, and left an existing learner pin unchanged. Negative tests stopped
on custody mismatch, manifest/artifact tamper, missing/stale approval, CAS
conflict, authorization failure, and partial/unavailable evidence.

This is useful release-control component evidence. It is not an RC2 rehearsal,
does not prove the full final migration union, and proves no hosted fact.

## 12. Known baseline and environment issues

- This evidence worktree began on macOS 15.6 with Node `v25.5.0`, npm `11.8.0`,
  and no root `node_modules`. The security report's repository-wide result used
  Node 22. Exact production runtime support remains to be pinned and verified.
- The migration audit also recorded Node 25 as the host default and reported no
  installed Node 22 binary in that worktree. Passing under a different local
  runtime does not replace the recorded Node 22 evidence or production-runtime
  verification.
- The original ADMIN-0 architecture document contained future-tense/non-goal
  language after implementation, and the configuration-core document still
  called the implemented cost evaluator unavailable. This evidence branch
  corrects those documentation statements only.
- The production-readiness endpoint intentionally has no default hosted
  migration or Owner-bootstrap probe. Absent approved authoritative evidence,
  those required gates are `UNVERIFIED` and overall readiness is blocked.
- No hosted infrastructure was contacted during evidence collection.

Validation results for this evidence branch are recorded in the final commit
and operator handoff, not projected onto RC2.

## 13. Hosted unknowns

All of the following are **UNVERIFIED**:

- exact application site/account/project identity and immutable deploy artifact;
- hosted migration ledger, catalog objects, migration hashes/definitions, and
  drift from the final RC2 manifest;
- RLS/forced-RLS, owners, grants, policies, functions, triggers, indexes, and
  constraints after hosted application;
- a restorable backup, restore point, recovery owner, restore estimate, and
  forward corrective-migration plan;
- required configuration/secret presence and scope (values must not be copied
  into this package);
- current Admin Owner assignment and minimum capabilities;
- provider account, product/pricing catalog, budget/limit, billing visibility,
  usage/journal continuity, alert routing, and kill-switch owner;
- telemetry freshness/completeness and privacy/retention behavior;
- current curriculum draft/approval/stage/publication/pointer/learner-pin state;
- post-deploy authorization, privacy, accounting, readiness, and curriculum
  smoke evidence.

Every required hosted unknown keeps the decision at **NO-GO / UNVERIFIED**.

## 14. Required production secret/config presence categories

Verify names, target, scope, and presence without displaying or archiving
values. Presence alone is necessary but not sufficient.

| Category | Expected names / condition | Required evidence |
| --- | --- | --- |
| Immutable build identity | At least one of `ACADEMY_APP_VERSION`, `COMMIT_REF`, `DEPLOY_ID` | Exact deployed artifact must map to the approved RC2 SHA/digest. |
| Supabase endpoint and public Auth client | `SUPABASE_URL` or `VITE_SUPABASE_URL`; `SUPABASE_ANON_KEY` or `VITE_SUPABASE_ANON_KEY` | Exact production project identity and correct scope. |
| Server database authority | `SUPABASE_SERVICE_ROLE_KEY` | Server-only presence; never browser-exposed. |
| Gateway-only browser policy | `VITE_USE_PROXY` enabled; `VITE_ALLOW_BROWSER_PROVIDER_KEYS` absent/disabled | Prove provider credentials cannot enter the browser bundle. |
| Study enablement | `ACADEMY_STUDY_ENABLED`; `VITE_STUDY_ENGINE_ENABLED` | Saved/deployment intent must agree; disabled is valid if intentional. |
| Study secrets when enabled | `STUDY_SAFETY_RATE_LIMIT_HMAC_KEY`; worker credential, credential version, worker ID, configuration version | Presence, rotation owner, and server-only scope. |
| AI when requested or required by Study | `ACADEMY_AI_ENABLED`; `ANTHROPIC_API_KEY` | Deployment ceiling, account identity, budget/limit, and kill-switch owner. |
| Premium TTS when requested | `ACADEMY_TTS_ENABLED`; `ELEVENLABS_API_KEY`; `ELEVENLABS_ALLOWED_VOICE_IDS` | Approved logical voice catalog, provider account, allowlist, and safe fallback. |
| Version provenance | `ACADEMY_<ENGINE>_ENGINE_VERSION` for each enabled emitting engine | Immutable engine identifiers for Tutor, Study, Assessment, Curriculum, Jarvis, TTS, Gateway, and Sync. |
| Admin saved configuration | Eight authoritative settings in the configuration registry | Exact saved/effective state, revision, stronger ceilings, cost thresholds, and audit evidence. |

Do not store values, connection strings, bearer tokens, provider keys, voice
IDs, worker credentials, or project secrets in the evidence archive.

## 15. Evidence interpretation

Repository existence, local tests, local build, migration replay, and local
rehearsal are necessary evidence. None independently proves hosted
authorization, schema, configuration, provider state, deploy identity,
publication, activation, or rollback readiness. Those required hosted facts
must remain `UNVERIFIED` until obtained under explicit Director authorization.

## 16. Evidence-pack validation

Validation was run in the evidence worktree on macOS 15.6 with Node `v25.5.0`
and npm `11.8.0`. These results validate this documentation/tooling change and
the RC1 base; they are not an RC2 test run.

| Check | Result |
| --- | --- |
| Lockfile install | PASS — 145 packages installed; npm audit reported 0 vulnerabilities. |
| Evidence integrity checker | PASS — 8 source commits, 32 artifact hashes, and all 32 RC1 migration hashes/order/dependencies verified. |
| TypeScript typecheck | PASS — `tsc --noEmit`. |
| Production build | PASS — 354 modules transformed; the existing Vite large-chunk advisory remained non-fatal. |
| Strict migration check | PASS — READY with 32 RC1 migrations. |
| Checker syntax and evidence-manifest JSON parse | PASS. |
| Secret-value/dangerous-command pattern scan of the package | PASS — no matches. |
| Git whitespace check | PASS. |

The exact Node 22 repository-wide result remains the security report's
branch-scoped evidence. A completed RC2 still requires its own supported-runtime
validation and local rehearsal.

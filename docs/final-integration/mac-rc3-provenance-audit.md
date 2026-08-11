# Mac RC3 patch-equivalence and source provenance audit

**Audit result:** `MAC_RC3_PROVENANCE_AUDIT_READY`

**Product implication:** RC3 is a verified, reproducible base, but it does not contain five proven production corrections. Those five inputs must be integrated and verified in a later RC4 assembly before treating the Mac candidate as final.

## Verified boundary and release ancestry

| Fact | Verified value |
|---|---|
| Audit worktree | `/Users/stephenmanuel/manuel-academy-dev/admin-mac-worktrees/admin-final-rc3-provenance-audit` |
| Audit branch at start | `mac/admin-final-rc3-provenance-audit` |
| Audit HEAD at start | `af84dee724088e4f61e4bf84fc17c75adb61e0fa` |
| Authoritative RC3 | `mac/admin-final-rc3-assembly` at `af84dee724088e4f61e4bf84fc17c75adb61e0fa` |
| RC3 worktree | Clean and registered at the authoritative SHA |
| RC2 | `053b56557f96fae2c75526d3b5466901bc7a1ec2`; verified ancestor of RC3 |
| RC1 | `4e404e7bce1ba7e843824e18c338148c23ac1896`; verified ancestor of RC2 and RC3 |
| Required branch worktrees | All 25 exist, are registered, are clean, and match their refs |
| Non-audit ref baseline | 86 local branch/tag refs; SHA-256 inventory digest `0634968aed0e8f5dc956968000431d8197edd8fe8b72755ad8c6602b55508bdd` |
| External actions | No fetch, push, deploy, hosted Supabase contact, Netlify contact, or other hosted contact |

RC1 and RC2 are first-parent ancestors of RC3. RC3 itself is a single-parent composite commit over RC2. Its commit message explicitly records integration of baseline stabilization `253305f87c8bc049d07620dcb967890b5cf97b4d`, UX acceptance `e07a24039e39094b5a00d4c03b142e0244283df9`, and performance hardening `d4dfab147cc1a55ec1516bb443689a5c2b6bcdc9`.

## Method

The audit used only local Git facts:

- exact refs, subjects, parents, worktree state, merge bases, and bidirectional ancestry checks;
- branch-only commit and merge inventories;
- `git cherry -v` and `git patch-id --stable` for non-merge commits;
- first-parent and combined merge diffs for merge commits, which do not have ordinary stable patch IDs;
- candidate-owned path comparisons using Git blob OIDs and per-path patch comparisons;
- same-subject, author metadata, range-diff, and first-parent replay mapping for integration-adjusted commits;
- SQL Git blob IDs, SHA-256 hashes, renamed-blob searches across the RC3 tree, manifest inspection, and semantic identifier checks;
- production versus test/documentation path separation.

A whole-tree diff was not used as proof of absence. Every decision below is scoped to the candidate's commits and owned paths.

## Executive findings

Among the 25 required branches:

| Classification | Count | Branches |
|---|---:|---|
| `ANCESTOR_INCLUDED` | 0 | None of the required source tips; supporting aggregate `mac/admin-r3-ops-integration` is an RC3 ancestor |
| `PATCH_EQUIVALENT_IN_RC3` | 1 | `mac/admin-migration-chain-audit` |
| `BLOB_EQUIVALENT_ON_OWNED_PATHS` | 6 | `mac/admin-attention-center`, `mac/admin-correlation-explorer`, `mac/admin-security-redteam`, `mac/admin-performance-stress`, `mac/admin-ux-acceptance`, `mac/admin-baseline-test-reconciliation` |
| `REVIEW_ONLY_NO_PRODUCT_DELTA` | 1 | `mac/admin-release-rehearsal` |
| `SUPERSEDED` | 10 | Product integration lines and RC1/RC2-adjusted curriculum/provider corrections listed below |
| `UNIQUE_PRODUCTION_DELTA` | 5 | API contracts, browser/cache, time boundaries, dependency failures, database privilege hardening |
| `UNIQUE_TEST_OR_DOCUMENTATION_DELTA` | 2 | Upgrade rehearsal and the historical RC2 evidence pack |
| `UNPROVEN_REQUIRES_REVIEW` / `DIRTY_BLOCKED` / `MISSING` | 0 | None |

The complete local Mac-tip scan found no additional post-RC2 divergent correction subject outside the required set. The eight divergent tips newer than RC2 are UX acceptance, performance stress, API contract fuzz, upgrade rehearsal, browser/cache compatibility, time-boundary audit, failure chaos, and DB security audit; all are classified here.

## Required branch ledger

All worktree states in this table are `CLEAN`. Every listed tip is divergent from RC3 unless its classification states otherwise: neither tip is an ancestor of RC3 nor RC3 an ancestor of the tip.

| Branch | Exact tip and subject | Merge base with RC3 | Primary classification |
|---|---|---|---|
| `mac/admin-curr-workflow-integration` | `d8ba41f0dde5e9f06203ca5a07b57cade9cf1803` — `admin: integrate curriculum studio release workflow` | `806326248a7a5e363dbab3c8ec6328538b69a063` | `SUPERSEDED` |
| `mac/admin-curr-release-controls-integrated` | `0e5a1278183ac560658c0bd24ea670c7ba5bae38` — `admin: integrate curriculum release controls` | `806326248a7a5e363dbab3c8ec6328538b69a063` | `SUPERSEDED` |
| `mac/admin-provider-accounting-complete` | `70701599e4d2689a472cfab22d6af2235862ad5a` — `admin: complete provider accounting coverage` | `d20543229a56f61975485e5d9faea6315f444bc9` | `SUPERSEDED` |
| `mac/admin-access-management` | `2aca265f2886f0480f62d03d51bcff87a21d6522` — `admin: add access and permissions management` | `1d24076ce2c43b69bfee3b0f6d52c14faaf81c04` | `SUPERSEDED` |
| `mac/admin-learner-operations` | `647b9f2b624d0c8dbb72980a5a6594cbddf5c3bc` — `admin: add learner operations detail` | `d20543229a56f61975485e5d9faea6315f444bc9` | `SUPERSEDED` |
| `mac/admin-attention-center` | `ce8cafc8e75f76be2a3c8751e238c35168353a58` — `admin: add operator attention center` | `cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64` | `BLOB_EQUIVALENT_ON_OWNED_PATHS` |
| `mac/admin-correlation-explorer` | `8faa9eb23bd55f1d37d83d17c784d851722a12cf` — `admin: add operational correlation explorer` | `cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64` | `BLOB_EQUIVALENT_ON_OWNED_PATHS` |
| `mac/admin-production-readiness` | `def64a942d5a099999c565d7ff6a8989e7b9d2d4` — `admin: add production readiness center` | `d20543229a56f61975485e5d9faea6315f444bc9` | `SUPERSEDED` |
| `mac/admin-security-redteam` | `25d2001001c89734c3ddea7581a7ad6156b9c624` — `admin: adversarially verify authorization boundaries` | `cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64` | `BLOB_EQUIVALENT_ON_OWNED_PATHS` |
| `mac/admin-db-security-audit` | `47c315f767c216cd59b8b71e5b59f7bc6d2a7a17` — `admin: harden database privilege boundaries` | `053b56557f96fae2c75526d3b5466901bc7a1ec2` | `UNIQUE_PRODUCTION_DELTA` |
| `mac/admin-failure-chaos` | `5ee417c052294d4a28509561513796d3ea38a85a` — `Harden Admin Console dependency failures` | `053b56557f96fae2c75526d3b5466901bc7a1ec2` | `UNIQUE_PRODUCTION_DELTA` |
| `mac/admin-performance-stress` | `d4dfab147cc1a55ec1516bb443689a5c2b6bcdc9` — `Harden Admin performance boundaries` | `4e404e7bce1ba7e843824e18c338148c23ac1896` | `BLOB_EQUIVALENT_ON_OWNED_PATHS` |
| `mac/admin-ux-acceptance` | `e07a24039e39094b5a00d4c03b142e0244283df9` — `fix(admin): complete UX accessibility acceptance` | `4e404e7bce1ba7e843824e18c338148c23ac1896` | `BLOB_EQUIVALENT_ON_OWNED_PATHS` |
| `mac/admin-api-contract-fuzz` | `5de0065ff106298ec5b9cf1dff6cc6b1821384d1` — `admin: adversarially harden api contracts` | `053b56557f96fae2c75526d3b5466901bc7a1ec2` | `UNIQUE_PRODUCTION_DELTA` |
| `mac/admin-browser-cache-compat` | `c7a2ce032aff455e3cccf4ef1aa395149210323e` — `fix(admin): harden browser cache compatibility` | `053b56557f96fae2c75526d3b5466901bc7a1ec2` | `UNIQUE_PRODUCTION_DELTA` |
| `mac/admin-time-boundary-audit` | `cb6f95479aeddcd130351fedafa5b333a3ff8575` — `Harden admin time boundary semantics` | `053b56557f96fae2c75526d3b5466901bc7a1ec2` | `UNIQUE_PRODUCTION_DELTA` |
| `mac/admin-baseline-test-reconciliation` | `253305f87c8bc049d07620dcb967890b5cf97b4d` — `test: stabilize release-candidate verification environment` | `4e404e7bce1ba7e843824e18c338148c23ac1896` | `BLOB_EQUIVALENT_ON_OWNED_PATHS` |
| `mac/admin-upgrade-path-rehearsal` | `b4d6c889b84e5b06bb5b5dca586122541bb10c06` — `Add local Admin upgrade path rehearsal` | `053b56557f96fae2c75526d3b5466901bc7a1ec2` | `UNIQUE_TEST_OR_DOCUMENTATION_DELTA` |
| `mac/admin-migration-chain-audit` | `1643df521d2dbc406e85795d25cbbfe7ba2542ae` — `admin: audit final migration chain` | `cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64` | `PATCH_EQUIVALENT_IN_RC3` |
| `mac/admin-curr-privacy-redteam` | `076190b1812f2eb8b77b24335943a2e46283cca9` — `security(curriculum): harden privacy boundaries [mac/admin-curr-privacy-redteam]` | `806326248a7a5e363dbab3c8ec6328538b69a063` | `SUPERSEDED` |
| `mac/admin-curr-release-redteam` | `af0f7f25331f98e0de1a3921330d10ec1ecb7a66` — `Harden curriculum release lifecycle controls` | `806326248a7a5e363dbab3c8ec6328538b69a063` | `SUPERSEDED` |
| `mac/admin-curr-release-integrity` | `775e3e1e662c38583e93b3e7ef03b0fd967550ba` — `admin: verify curriculum release integrity` | `806326248a7a5e363dbab3c8ec6328538b69a063` | `SUPERSEDED` |
| `mac/admin-provider-accounting-redteam` | `4b059e6de2fd109eab6f46e9f8d56897d4f4550d` — `admin: harden provider accounting reconciliation` | `d20543229a56f61975485e5d9faea6315f444bc9` | `SUPERSEDED` |
| `mac/admin-release-evidence-pack` | `5847c3a3c4540b6a84dd54ff98b9a24b199ffbf2` — `docs(admin): add RC2 release evidence package` | `4e404e7bce1ba7e843824e18c338148c23ac1896` | `UNIQUE_TEST_OR_DOCUMENTATION_DELTA` |
| `mac/admin-release-rehearsal` | `cf9ead79454c6950112fceebb66036cfe480161c` — `docs: add admin production release rehearsal` | `806326248a7a5e363dbab3c8ec6328538b69a063` | `REVIEW_ONLY_NO_PRODUCT_DELTA` |

## Patch and owned-path findings

| Branch | Stable-patch / cherry result | Candidate-owned final-path result | Proven RC representation |
|---|---|---|---|
| Curriculum workflow | 2 equivalent, 7 non-equivalent non-merges; 5 merges inspected separately | 63/132 exact; all paths present; the remainder are later integration changes | `307588aa8af678073123f5500f09582f1a55dc5e` plus its replay chain, then RC1 |
| Curriculum release controls | 1 equivalent, 12 non-equivalent non-merges; 5 merges inspected | 66/137 exact; all paths present | `5959caed85059a855aafb7278e70c3e8ca8e32fe`, then RC1/RC2 |
| Provider accounting complete | 4 equivalent, 2 non-equivalent; tip patch `b8f46ad21cf98c8a506effdb5b9bbf994c123356` is exact | 22 exact, 30 later hardened, 1 renamed SQL across 53 line paths | `421d1894edcb9631f1d4efa5d3d1dc8cee796ab1`, then RC1/RC2 |
| Access management | Tip patch `faf51215b84fd9c2fad56437ceb6f2bbb1e6dd34` is not exact | 13/23 exact; remaining shared/component paths advanced | Aggregate ancestor `cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64` |
| Learner operations | Tip patch `4db0ae6b63e9cf264262f02683aac0ff2ecc9807` is not exact | 8/11 exact; remaining UI paths accessibility-corrected | Aggregate ancestor `cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64` |
| Attention center | Tip patch `6571bec84be86b561afa722294a741b2f7d315ee` is not exact | All 6 dedicated feature additions exact; 6 shared integration files differ | `4f45510fc89bb487a6dff273b67b76115a5898b7`, then RC1 |
| Correlation explorer | Tip patch `92e65a7b6c4edb93c0fa756272d8211bfdfea3e6` is not exact | All production-owned additions exact; one test was extended by RC3 | `257f497445e2134c9292bf7814489e688ba2b0ae`, then RC1 |
| Production readiness | Tip patch `547000a59445ae6045736151e6c1c5380d4cd0e7` is not exact | 7/23 exact; service/repository/UI were materially advanced | Aggregate `cf9d2bb…`, then RC1 expansion |
| Security red-team | Tip patch `0e5153c1954aae6bfdb47c568a4574ce954faef7` is not exact | 7/8 exact; only the union manifest differs | Integration-adjusted `21315548b129c0ff2f5021aee7ebefe0f9e2f496` in RC2 |
| Performance stress | Tip patch `5cf2f70d1b3d7a88676a9be343cd192a63897aa6` is not whole-patch exact | 27/38 exact; 32/38 per-path patches exact; all 38 touched by RC3 composite | RC3 explicitly names and integrates the source SHA |
| UX acceptance | Tip patch `c76948b6b52e17d73e53a2494e7b81a52e0b2a23` is not whole-patch exact | 20/21 exact; all 21 per-path deltas occur in RC3 composite | RC3 explicitly names and integrates the source SHA |
| Baseline reconciliation | Tip patch `0b178f0ddf98ebdf20385e0b8044d1e9502affeb` is not whole-patch exact | 3/5 exact; all substantive test-environment deltas retained | RC3 explicitly names and integrates the source SHA |
| Migration-chain audit | Source patch `54bcfab318f13d96f52854e420725b02f786e1cc` is `git cherry -` | 3/5 remain exact; 2 later adjusted | Exact stable-patch match `9a2056589e24f28422b40393e3c076416d9197bc` in RC2 |
| Curriculum privacy | Tip patch `1e7de99acd24edddab951666d6e9522586ff3701` differs | 17 exact, 12 later changed, 1 exact renamed SQL | Integration-adjusted `e13487b01a9af4461b08c51be100c837552e5877` in RC2 |
| Curriculum release red-team | Tip patch `9710b2089b56f382e61b3640d59127be022dcbda` differs | 5 exact, 8 integration-adjusted | `381ae8a6e05c6e61942805e561d38eab074cb492` in RC2 |
| Curriculum release integrity | Tip patch `25bb5174cc0236fef73cb439d77f3a112393f5fb` differs | 12 exact, 10 later hardened | `58fe8df0b3aaff4ac1bd9bc793aae523143f0a60`, then release red-team |
| Provider accounting red-team | Tip patch `9d1fd8ee1a39a946f3ae05eb890c63f559ceeb10` differs | 7 exact, 8 later changed, 1 exact renamed SQL | `679cbc53b203f7a906fb4e54660b2734a09fa9d3` in RC2 |
| Release rehearsal | Tip patch `ee7938e816b682370ea5ccf024caa7bcc4f3883a` differs only in integration context | Dedicated docs/script exact; shared package/tests advanced | Review-only replay `d00bc6c8be3e83828f7a36a37c95724a00a1ccc5` in RC2 |

The five shared curriculum-foundation merges were inspected separately: `45ae73d51afcd2173c25b30a47a515f1f694eb83`, `a3b0b1a5292135eb6b510ff69488d8cceb458a43`, `3c8449e264c24312eae7e9b701bfb11ce661a92b`, `1b0a09ae38779e4cd4bb64360654ac174f17a694`, and `f14c938b810474ac08f5756ded895ded3cb51bdb`. Their combined-resolution-only changes are shared routing/configuration/manifest adjustments, not an independent missing product payload.

## Genuine unique production deltas

All five commits below are single-parent siblings based directly on RC2. None is an RC3 ancestor, none has a stable-patch equivalent in RC3, and none has an owned-path final-blob equivalent. They do not contain one another.

### API contract hardening

- Branch: `mac/admin-api-contract-fuzz`
- Commit: `5de0065ff106298ec5b9cf1dff6cc6b1821384d1`
- Subject: `admin: adversarially harden api contracts`
- Stable patch ID: `202d8ceec34af919b14b1d27a3e57408c3ed13db`
- Dependency commit: RC2 `053b56557f96fae2c75526d3b5466901bc7a1ec2`
- Migration impact: none
- Why absent: 0 exact RC3 blobs across 17 changed paths; 16 differ and the fuzz test is absent. Identifiers such as `readQueryEntries` and `validateJsonTree` are absent from RC3.
- Production effect: canonical multi-representation query parsing, strict header/body handling, fatal UTF-8 decoding, JSON-depth/Unicode validation, and endpoint-specific fuzz coverage.

Changed paths:

```text
netlify/functions/_shared/admin-cost-projection.js
netlify/functions/_shared/admin-overview.js
netlify/functions/_shared/http.js
netlify/functions/admin-access.js
netlify/functions/admin-api-contract-fuzz.test.js
netlify/functions/admin-audit.js
netlify/functions/admin-authorization.js
netlify/functions/admin-configuration.js
netlify/functions/admin-correlations.js
netlify/functions/admin-costs.js
netlify/functions/admin-curriculum.js
netlify/functions/admin-engine-performance.js
netlify/functions/admin-health.js
netlify/functions/admin-learners.js
netlify/functions/admin-overview.js
netlify/functions/admin-production-readiness.js
netlify/functions/admin-safety-operations.js
```

### Browser/cache compatibility

- Branch: `mac/admin-browser-cache-compat`
- Commit: `c7a2ce032aff455e3cccf4ef1aa395149210323e`
- Subject: `fix(admin): harden browser cache compatibility`
- Stable patch ID: `7552f7d8533823f9b72a3c9259012da4d3589f72`
- Dependency commit: RC2 `053b56557f96fae2c75526d3b5466901bc7a1ec2`
- Migration impact: none
- Why absent: 0 exact RC3 blobs across 18 changed paths; 13 differ and 5 are absent. `APP_CACHE_PREFIX` and `beginAuthorizationRefresh` are absent from RC3.
- Production effect: protected/Admin requests become network-only/no-store, immutable Curriculum caching is separated from build-scoped app caches, and authorization refreshes on browser/session events.

Changed paths:

```text
.gitignore
netlify.toml
package-lock.json
package.json
playwright.admin.config.ts
public/sw.js
scripts/stamp-sw.mjs
src/admin/accessHttpSource.test.ts
src/admin/accessHttpSource.ts
src/admin/authorization.test.ts
src/admin/authorization.ts
src/components/admin/AdminConsoleRoute.tsx
src/components/admin/admin-console.css
src/main.tsx
tests/admin-cache-boundaries.test.js
tests/browser/admin-browser-cache.spec.ts
tests/browser/admin-browser-test-server.mjs
tests/service-worker-cache.test.js
```

### Time-boundary correction

- Branch: `mac/admin-time-boundary-audit`
- Commit: `cb6f95479aeddcd130351fedafa5b333a3ff8575`
- Subject: `Harden admin time boundary semantics`
- Stable patch ID: `5c5b8a33fbb1e3721bbffd0f7f64e6346a6efd08`
- Dependency commit: RC2 `053b56557f96fae2c75526d3b5466901bc7a1ec2`
- Migration dependencies: modifies the existing `20260809120000` and `20260810180000` migrations; no new filename
- Why absent: 0 exact RC3 blobs across 32 paths; 31 differ and one test fixture is absent. `diagnosticRetentionComplete` and both corrected SQL blobs are absent from RC3.
- Production effect: one observation clock across readiness probes, inclusive correlation end bounds with exclusive cursors, exact retention expiry treated as incomplete, runtime retention evidence, and non-overlapping trend windows.

Changed paths:

```text
MIGRATIONS.md
docs/admin-correlation-explorer.md
docs/admin-migration-chain-audit.md
docs/admin-operational-telemetry.md
docs/study-engine-final-production/migration-manifest.json
netlify/functions/_shared/admin-correlation-reader.js
netlify/functions/_shared/admin-correlation-reader.test.js
netlify/functions/_shared/admin-cost-projection.test.js
netlify/functions/_shared/admin-monthly-cost-alert.test.js
netlify/functions/_shared/admin-production-readiness/service.js
netlify/functions/_shared/admin-time-test-fixtures.js
netlify/functions/_shared/study-safety/provider-accounting.test.js
netlify/functions/admin-audit.js
netlify/functions/admin-audit.test.js
netlify/functions/admin-correlations.js
netlify/functions/admin-correlations.test.js
netlify/functions/admin-engine-performance.test.js
netlify/functions/admin-production-readiness.js
netlify/functions/admin-production-readiness.test.js
src/admin/curriculum-history/model.test.ts
src/admin/curriculum-history/model.ts
src/admin/enginePerformanceModel.test.ts
src/admin/enginePerformanceModel.ts
src/admin/systemHealth.test.ts
src/admin/systemHealth.ts
supabase/academy-admin-audit.db.test.ts
supabase/academy-admin-correlation.db.test.ts
supabase/academy-operational-events.db.test.ts
supabase/academy-provider-attempt-journal.db.test.ts
supabase/admin-config.db.test.ts
supabase/migrations/20260809120000_academy_operational_telemetry_foundation.sql
supabase/migrations/20260810180000_academy_admin_correlation_runtime_read.sql
```

### Admin dependency-failure hardening

- Branch: `mac/admin-failure-chaos`
- Commit: `5ee417c052294d4a28509561513796d3ea38a85a`
- Subject: `Harden Admin Console dependency failures`
- Stable patch ID: `0b808aae4e571354cbaf0eb4660f97d0b6ba22fe`
- Dependency commit: RC2 `053b56557f96fae2c75526d3b5466901bc7a1ec2`
- Migration impact: none
- Why absent: 0 exact RC3 blobs across 43 paths; 41 differ and the timeout implementation/test are absent. `withAdminDependencyTimeout` is absent from RC3.
- Production effect: bounded ten-second `AbortSignal` timeouts, fail-closed reads, strict result validation, and safe partial/unavailable UI states.

Changed paths:

```text
src/admin/adminDependencyTimeout.test.ts
src/admin/adminDependencyTimeout.ts
src/admin/attentionLoader.test.ts
src/admin/auditHttpSource.ts
src/admin/authorization.test.ts
src/admin/authorization.ts
src/admin/configurationHttpSource.ts
src/admin/costsHttpSource.test.ts
src/admin/costsHttpSource.ts
src/admin/costsModel.test.ts
src/admin/costsModel.ts
src/admin/curriculum-activation/httpSource.ts
src/admin/curriculum-approval/httpSource.test.ts
src/admin/curriculum-approval/httpSource.ts
src/admin/curriculum-authoring/httpSource.ts
src/admin/curriculum-history/httpSource.test.ts
src/admin/curriculum-history/httpSource.ts
src/admin/curriculum-integrity/httpSource.test.ts
src/admin/curriculum-integrity/httpSource.ts
src/admin/curriculum-publishing/httpSource.test.ts
src/admin/curriculum-publishing/httpSource.ts
src/admin/curriculum-staging/httpSource.test.ts
src/admin/curriculum-staging/httpSource.ts
src/admin/curriculum-validation/httpSource.ts
src/admin/curriculum/httpSource.ts
src/admin/engine-performance/httpSource.test.ts
src/admin/engine-performance/httpSource.ts
src/admin/incidentExplorerHttpSource.ts
src/admin/learnerAnalyticsHttpSource.test.ts
src/admin/learnerAnalyticsHttpSource.ts
src/admin/overviewHttpSource.test.ts
src/admin/overviewHttpSource.ts
src/admin/productionReadinessHttpSource.test.ts
src/admin/productionReadinessHttpSource.ts
src/admin/productionReadinessModel.ts
src/admin/safetyOperationsHttpSource.test.ts
src/admin/safetyOperationsHttpSource.ts
src/admin/systemHealthClient.test.ts
src/admin/systemHealthClient.ts
src/components/admin/AdminConfiguration.test.tsx
src/components/admin/AdminConfiguration.tsx
src/components/admin/AdminConsoleRoute.tsx
src/components/admin/ProductionReadinessCenter.test.tsx
```

### Database privilege hardening

- Branch: `mac/admin-db-security-audit`
- Commit: `47c315f767c216cd59b8b71e5b59f7bc6d2a7a17`
- Subject: `admin: harden database privilege boundaries`
- Stable patch ID: `cd216c07187e2dea6172066186ff8eed9b7d6e18`
- Dependency commit: RC2 `053b56557f96fae2c75526d3b5466901bc7a1ec2`
- Migration dependency: follows `20260810180000_academy_admin_correlation_runtime_read.sql`
- Why absent: 0 exact RC3 blobs across 7 paths; 4 differ and 3 are absent. The new migration path, its blob, and its trigger/function identifiers are absent from RC3.
- Production effect: full-chain catalog auditing and trigger-time reauthorization of privileged Curriculum writes at their state-change linearization points.

Changed paths:

```text
docs/study-engine-final-production/migration-manifest.json
package.json
scripts/audit-database-security.mjs
supabase/academy-admin-access.db.test.ts
supabase/academy-cas.db.test.ts
supabase/admin-database-security.db.test.ts
supabase/migrations/20260810190000_academy_curriculum_write_reauthorization.sql
```

## Unique tests, documentation, and review-only lines

### Upgrade-path rehearsal — unique review/tooling delta

`mac/admin-upgrade-path-rehearsal` at `b4d6c889b84e5b06bb5b5dca586122541bb10c06`, patch ID `bb2b88c149b11d26049276e01f8f721c1d0926bc`, adds:

```text
docs/admin-console/admin-upgrade-path-rehearsal.md
package.json
scripts/admin-upgrade-path-rehearsal.mjs
```

It is a local sandboxed PGlite migration rehearsal, not production code. It records RC2's 34-migration state and must be rerun/refreshed for RC3 or RC4. Transfer it for review tooling; do not make it an RC4 product input.

### RC2 evidence pack — unique but stale historical evidence

`mac/admin-release-evidence-pack` at `5847c3a3c4540b6a84dd54ff98b9a24b199ffbf2`, patch ID `aaf41493b257b287297799ef44289bc3f2bb0949`, changes:

```text
docs/admin-configuration-core.md
docs/admin-console/README.md
docs/admin-console/rc2-go-no-go.md
docs/admin-console/rc2-release-evidence-manifest.json
docs/admin-console/rc2-release-evidence.md
scripts/check-admin-release-evidence.mjs
```

Four paths are absent from RC3 and two shared docs differ. The package deliberately records `RC2_SHA=PENDING`, and its checker now rejects reliance on that value because the completed RC2 ref is `053b56557f96fae2c75526d3b5466901bc7a1ec2`. Transfer it only as immutable historical pre-RC2 provenance, never as current RC3 go/no-go evidence.

### Release rehearsal — review-only and included

`mac/admin-release-rehearsal` is review/test/documentation-only. Its dedicated runbook, rehearsal document, and script are present in RC3; shared package and DB-test blobs were advanced during RC2/RC3. The integration-adjusted replay is ancestral commit `d00bc6c8be3e83828f7a36a37c95724a00a1ccc5`.

## Migration equivalence review

### RC3 migration facts relevant to this audit

| Migration | RC3 Git blob | RC3 SHA-256 | Result |
|---|---|---|---|
| `20260810153000_academy_admin_configuration_reauthorization.sql` | `01179b86df6fcfbb772117408d882a2ab3db1f50` | `e533b15b04157cd1a7015221b59fe483b3f67691ccf6f5a497e592398c978308` | Exact security-red-team blob |
| `20260810155000_academy_curriculum_privacy_hardening.sql` | `0eac5230da3280eda41f1bf281f1657266f1a411` | `e905cfd2bf1191a97dccb933e4b918c2d6d4bb3eb0e3660958fb5fe3302a7886` | Exact renamed privacy blob; source name was `20260810160000…` |
| `20260810131000_academy_provider_attempt_journal.sql` | `2b4c0e5b1d28f2fba1239b0de26717ad0f5e59b9` | `92dc0d47e22d8fff03b4c4034bfc558351e8ca16373ec464e75b75d42a7bd192` | Exact renamed provider-red-team blob; source name was `20260810130000…` |
| `20260810151000_academy_study_safety_provider_accounting.sql` | `80a091a79db9c0eecdf2044492f94232c63e3842` | `5bcdc8891538613ada2c5872016b6cbe00e11c763b8ec6bacf4e6f354241cef6` | Exact provider-accounting blob |
| `20260810200000_academy_admin_curriculum_performance_bounds.sql` | `a0542ec3c459829201f5683ad89d818a891be495` | `d8ccaf7a6e9c9ae77dcf55e63d50ac12efc5d6d65ef175413cfd45c45745ee1a` | Exact performance-source blob |
| `20260810190000_academy_curriculum_write_reauthorization.sql` | absent | Source blob `50107fcd936f911836fb843f4fc89ebd54cff1c0`; SHA-256 `11263d264c80bc599aff13f73128c3a7b6cbb3726603277237d61fe8c951f522` | No RC3 path, renamed byte-equivalent, or semantic equivalent |
| `20260809120000_academy_operational_telemetry_foundation.sql` | RC3 `23d4686138831b7c6485e8a0254f228ecf85596f` | RC3 `5646d92084f85dd1a5b5463cff3f97970dc1e9017c85a809443266d8dcb1c23d`; time branch `e3dec4a9c4034d0756383578b635b7475c03f51c0e9f11fa3e28b38769b02c83` | RC3 has the older blob; corrected branch blob has no equivalent |
| `20260810180000_academy_admin_correlation_runtime_read.sql` | RC3 `01bbae3889b21c7b2da7104aa09ff844ae1826fd` | RC3 `604d1ea775c666f5210b55ce531f86f73595518dcdfbf13f66ade2b50035be0d`; time branch `7499d60258f5b61c1f9aec2bb3537834b0cb65c4648bc475b487dfb02d2b10d4` | RC3 has the older blob; corrected branch blob has no equivalent |

### Migration inventory by source line

- **Curriculum workflow integration:** `20260809130000` audit foundation (exact), `20260809160000` release registry (exact), `20260809170000` audit vocabulary (exact), `20260810120000` draft authoring (exact), `20260810130000` standards review (integration-adjusted), `20260810140000` human approval (integration-adjusted), `20260810141500` draft collaborators (exact), and `20260810150000` release staging (integration-adjusted/hardened).
- **Curriculum release controls:** `20260809130000` audit foundation (exact), `20260809160000` release registry (exact), `20260809170000` audit vocabulary (exact), `20260810120000` draft authoring (exact), `20260810140000` human approval (integration-adjusted), `20260810150000` staging (integration-adjusted/hardened), `20260810160000` publishing (final red-team blob exact in RC3), and `20260810170000` activation/rollback (final red-team blob exact in RC3).
- **Provider accounting complete/red-team:** provider attempt journal is byte-identically represented after the final source rename from `20260810130000` to RC3 `20260810131000`; study-safety provider accounting `20260810151000` is exact. The earliest attempt-journal foundation used `20260810120000` and was later integration-adjusted and hardened before the final exact renamed blob.
- **Access management:** `20260810144700_academy_admin_access_management.sql` is exact, Git blob `40cd44c2784a0e9811cc785050e33fbb2d5b4d4d`, SHA-256 `56bb1b1efd798586f9abce6ada581e38f70bf0704ec4e93602062c6eef268bbe`.
- **Correlation explorer:** `20260810180000_academy_admin_correlation_runtime_read.sql` is exact for the explorer source, then corrected only by the missing time-boundary line.
- **Security red-team:** `20260810153000_academy_admin_configuration_reauthorization.sql` is exact.
- **Performance stress:** `20260810200000_academy_admin_curriculum_performance_bounds.sql` is exact.
- **Curriculum privacy:** audit foundation, registry, vocabulary, draft authoring, and collaborators are exact; standards review, human approval, and staging are integration-adjusted; privacy hardening is byte-identically renamed from source `20260810160000` to RC3 `20260810155000`.
- **Curriculum release red-team:** audit foundation, registry, vocabulary, draft authoring, publishing, and activation/rollback are exact; human approval and staging are integration-adjusted. The source staging SHA-256 `c7976b3680a529d2cfb35650c50de065b2b08ff455097878daf1db09fd9144ca` becomes RC3 `07541755d368db6af7d57b34ee4e6d1e89ce92e846e434913bd5dad1acb56961` after removal of a duplicate audit-reader override while retaining the red-team hardening.
- **Curriculum release integrity:** audit foundation, registry, vocabulary, and draft authoring are exact; human approval is integration-adjusted; its staging SHA-256 `e47f8d6b58843234f13315849d8b5fdb74f33433d13944733fd2fdea895c4aac` is exact at RC1 replay `58fe8df…` and has an integration-adjusted/hardened descendant in RC3.
- **Time-boundary audit:** modifies `20260809120000` and `20260810180000`; neither corrected SQL blob has an RC3 equivalent.
- **DB-security audit:** adds `20260810190000`; RC3 has no equivalent.
- **Learner operations, attention center, production readiness, API contract fuzz, browser/cache compatibility, failure chaos, baseline reconciliation, UX acceptance, upgrade rehearsal, release evidence pack, migration-chain audit, and release rehearsal:** no branch-tip migration payload. Migration-chain/rehearsal tooling inspects inherited migrations without adding or renaming one.

All branch-local migration manifests are superseded by RC3's normalized union manifest. A future RC4 combining the two unique migration lines must contain 36 entries: retain the existing names, place `20260810190000` after `20260810180000`, and make the existing `20260810200000` entry depend on `20260810190000` instead of `20260810180000`.

## Special source-line checks

These additional clean branches were inspected because the brief called out their owned paths or they aggregate operations provenance:

| Branch | Finding |
|---|---|
| `mac/admin-provider-attempt-journal` at `a552b2ec343defb3f533f3c0412cae6b8d01355b` | Whole commit patch ID `e7260efeccf39c1eaa23b5ccc8b1d2092de05823` is exact to RC1 ancestor `32f9f6b79b18dcdf887c35db3772af04c874efe7`; later provider lines harden and renumber its migration |
| `mac/admin-curr-16b-authoring` at `8cac699a9b263c7b0bb1e33e3b5d7e5a59ca03de` | Superseded by replay `f9ecb3b24b34a565faa7686ebc83a5efdc9f3ee0`; authoring SQL is exact in RC3 |
| `mac/admin-curr-standards-review` at `47949e73b307ce9d9284f08174e19ea72f0e5ee0` | Superseded by workflow aggregate `307588aa…`; SQL is integration-adjusted in RC3 |
| `mac/admin-curr-20b-publish` at `5c4f18aa53b80c585493f6a1e9a2789c66850101` | Superseded by replay `9e4c06424549d791d6184171da820698e79da576`, release controls, and red-team hardening |
| `mac/admin-curr-20c-activation-rollback` at `57661e281e0a3e060f171e9eea40a8ac7fb7793a` | Superseded by replay `1e68c459d130bdd4a3491e6e6ff1b12efc1668dc`, release controls, and red-team hardening |
| `mac/admin-r3-ops-integration` at `cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64` | `ANCESTOR_INCLUDED`; exact RC3 ancestor and aggregate source for access, learner, and production-readiness surfaces |

No additional post-RC2/RC3 correction candidate was found outside the required list.

## Supersession graph

```text
mac/admin-r3-ops-integration (RC3 ancestor)
  ├─ access management / learner operations / production readiness (aggregate-adjusted)
  ├─ attention center -> 4f45510f...
  ├─ correlation explorer -> 257f4974...
  ├─ provider source line -> 32f9f6b7... -> ... -> 421d1894...
  └─ curriculum source lines -> 307588aa... -> 58fe8df0... -> 5959caed...
       -> RC1 4e404e7b...

RC1
  ├─ security red-team -> 21315548...
  ├─ curriculum privacy -> e13487b0...
  ├─ curriculum release integrity -> release red-team -> 381ae8a6...
  ├─ provider red-team -> 679cbc53...
  ├─ migration-chain audit -> patch-equivalent 9a205658...
  └─ release rehearsal -> d00bc6c8...
       -> RC2 053b5655...

RC2
  ├─ baseline reconciliation 253305f8...
  ├─ UX acceptance e07a2403...
  └─ performance stress d4dfab14...
       -> composite RC3 af84dee7...

RC2 sibling deltas not in RC3
  ├─ API contract hardening 5de0065f...
  ├─ browser/cache compatibility c7a2ce03...
  ├─ time-boundary correction cb6f9547...
  ├─ dependency-failure hardening 5ee417c0...
  └─ DB privilege hardening 47c315f7...
```

## A. Minimal transfer set

The object-minimal Windows transfer set is exactly these nine branches:

1. `mac/admin-final-rc3-provenance-audit` — after this report commit, it contains the exact RC3 candidate as its parent plus the current provenance evidence; fetching the separate RC3 assembly ref is not needed for object completeness.
2. `mac/admin-performance-stress` — preserves isolated source commit `d4dfab1…` and exact performance-migration provenance named by, but not ancestral to, RC3.
3. `mac/admin-api-contract-fuzz` — unique production correction.
4. `mac/admin-browser-cache-compat` — unique production correction.
5. `mac/admin-time-boundary-audit` — unique production correction and corrected migration blobs.
6. `mac/admin-failure-chaos` — unique production correction.
7. `mac/admin-db-security-audit` — unique production correction and new migration provenance.
8. `mac/admin-upgrade-path-rehearsal` — unique review/rehearsal tooling; must be refreshed before reliance.
9. `mac/admin-release-evidence-pack` — historical pre-RC2 evidence only; stale as current go/no-go evidence.

If transport policy requires the authoritative release **ref name** in addition to object reachability, fetch `mac/admin-final-rc3-assembly` as an alias. It does not add an object absent from the nine-branch minimum because `af84dee…` is the audit branch's parent.

Do not transfer obsolete product source branches merely to reproduce their final contents: their replay, exact patch, or integration-adjusted replacement commits are already reachable from RC3. Security-red-team and migration-chain source refs are also unnecessary because `21315548…` and exact-patch `9a205658…` are RC3 ancestors.

## B. Minimal Mac RC4 assembly set

Base a future assembly on exact RC3 `af84dee724088e4f61e4bf84fc17c75adb61e0fa` and integrate exactly these five production commits:

1. `5de0065ff106298ec5b9cf1dff6cc6b1821384d1` from `mac/admin-api-contract-fuzz`
2. `c7a2ce032aff455e3cccf4ef1aa395149210323e` from `mac/admin-browser-cache-compat`
3. `cb6f95479aeddcd130351fedafa5b333a3ff8575` from `mac/admin-time-boundary-audit`
4. `5ee417c052294d4a28509561513796d3ea38a85a` from `mac/admin-failure-chaos`
5. `47c315f767c216cd59b8b71e5b59f7bc6d2a7a17` from `mac/admin-db-security-audit`

These are RC2 siblings, not blind-cherry-pick-safe changes. Known overlaps include failure/browser authorization and routing files, API/time Netlify handlers, DB/time migration manifests, DB/browser `package.json`, and several RC3 performance/UX/baseline paths. RC4 must reconcile the intended deltas and then rerun the migration, browser, API, failure, time-boundary, accessibility, and performance evidence. This audit did not assemble RC4.

## Final audit classification

There are no unproven deltas. The five missing production corrections are proven by exact commits, stable patch IDs, changed paths, absent blobs/identifiers, and migration facts. Therefore the source-provenance audit itself is ready:

`MAC_RC3_PROVENANCE_AUDIT_READY`

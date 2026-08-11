# Cross-machine final integration source manifest

Classification: **BLOCKED_BY_MISSING_SOURCES**

This manifest is an inventory of Git facts for final Manuel Academy integration. It does not authorize or perform product integration. It was generated on Windows after `git fetch origin --prune`; no prior chat summary was used as evidence.

## Verification boundary

- Repository: `https://github.com/Kaili907/homeschool-hq.git`
- Inventory branch: `win/final-cross-machine-source-verifier`
- Required and observed starting HEAD: `ffd1cc5a7ff706abfde00a07bc284b22687ffe0f`
- Starting inventory worktree: clean
- Fetch completed: `2026-08-11T01:18:45.9078906Z`
- Local branches: 76 total, including 44 `win/*` branches and no `mac/*` branches
- Origin branches after prune: 219 total, with no `origin/win/*` or `origin/mac/*` branches
- Reachable commits: 457 from local branches, 570 from origin refs, and 659 from all refs
- Registered worktrees: 97
- Advertised GitHub pull-request heads checked: 1; none pointed at a requested Mac SHA

`Available on origin` below means that the commit is reachable from an advertised `refs/remotes/origin/*` ref after the fetch. `Migrations since baseline` means SQL files added between the shared Windows baseline `d65d1511dd602db586a204bb7ccb2800fd7a89e2` and the source tip. The JSON companion records exact arrays.

## Windows final sources verified

Every requested Windows SHA exists as a commit object and is the exact tip of the named local branch. None is reachable from an origin branch.

| Artifact | Branch and exact SHA | Commit subject | Direct parent | Local / origin | Registered worktree |
| --- | --- | --- | --- | --- | --- |
| Study Production Mount R5 | `win/study-production-mount-r5` at `87a21b748d8855fc814435551c4d65e47f3ff126` | `study: mount hardened production learner workspace` | `db1857642f1030b66fdc50052184cb3b6d8335d3` | yes / no | clean |
| Study Recovery correction | `win/study-recovery-chaos-gate` at `50ae5c05a09e12e2e573dfe9ecf984f95a7badc0` | `fix(study): harden production recovery` | `27254fd65db26e820eb88bf714bb7db9a7376541` | yes / no | clean |
| Study Worker Run Evidence | `win/study-worker-run-evidence` at `e97c80beb3d7c73ebc24b2a243fdf0d45a8e5e76` | `study: persist adult review worker run evidence` | `96fac0361e174225ca345d5253852ed6ba056236` | yes / no | clean |
| Study Telemetry Invocation | `win/study-telemetry-invocation` at `833860eb1d70121f9bc8c58f985b49f4c6d93788` | `study: authorize telemetry delivery invocation` | `fa1e3e3f7c5d846ba6e516d8e16e2a4c391f6c2d` | yes / no | clean |
| Windows Admin Costs final browser line | `win/admin-costs-browser-gate` at `de3d81fed1817144fcd6fab4ed50ae821edeb5e2` | `fix(admin): harden Costs and Provider Pricing browser UX` | `86003e57cfea8bfc83c3e1d41d3abde26d16abf8` | yes / no | clean |
| Admin Study Operations Evidence R2 | `win/admin-study-ops-evidence-r2` at `7e9d0c6166c022ad3b5a45f12a4365981ab7f5fd` | `admin: connect Study Operations to worker run evidence` | `7f703a2f18ec4f6b36a97de11a9f33aa51116940` | yes / no | clean |
| System Health aggregate | `win/admin-9-aggregate-r2` at `c72f9918244ad525182f2414d3afd281c51c8b07` | `admin: adopt scalable aggregates for system health` | `f5492e2e21ae51fad5e1979e555fa1e247c983a5` | yes / no | clean |
| ADMIN-14B | `win/admin-14b-runtime` at `e43a1320021fbe4e004af74c26a563532990545c` | `admin-14b: enforce effective runtime configuration` | `cf29ff6b3e851f42eb257a108f1bc473599c0ff1` | yes / no | clean |
| Unified preflight | `win/admin-unified-preflight-orchestrator` at `28ce1a938a0f06617bd92d31ff1ec7ef95fb541c` | `admin: unify local production preflight` | `f9b1278fed23048d1e0d18b4ae1d4e9e4e295919` | yes / no | clean |

### Composed Windows source tips

These local-only tips reduce the Windows source set, but they are divergent compositions rather than one final integration branch.

| Source | Exact tip | Direct parent | Origin | Worktree state |
| --- | --- | --- | --- | --- |
| `win/final-study-rc1` | `8ef764772c43f63b08403248c1e98273c35c5f4f` — `test(study): add local production smoke harness` | `dcfb37f2ce83c38fd96595a1fcea034ae8ab5e9b` | unavailable | currently modified: `MIGRATIONS.md` and `docs/study-engine-final-production/migration-manifest.json`; the branch ref remains at the recorded SHA |
| `win/final-admin-delta-rc1` | `e3f62dced44b8ddd7e932ec992756a39f30f3495` — `admin: unify local production preflight` | `b0e5b42eca478bceb5755e31b7d3ce7c19e04b6b` | unavailable | clean |

Their merge base is exactly `d65d1511dd602db586a204bb7ccb2800fd7a89e2`. Neither tip is an ancestor of the other. Relative to that base, Study RC changes 142 paths, Admin RC changes 230 paths, and the sets overlap on 65 paths.

## Mac final sources unavailable

The seven supplied Mac SHAs are absent as local commit objects, absent from every origin branch, and absent from the advertised GitHub pull-request heads. Consequently their commit subjects, parents, migrations, exact refs, cleanliness, ancestry, and supersession relationships cannot be verified on this machine.

| Artifact | Expected SHA supplied for verification | Git result |
| --- | --- | --- |
| Curriculum 16B | `8cac699a9b263c7b0bb1e33e3b5d7e5a59ca03de` | `TRANSFER_REQUIRED`; object and ref unavailable |
| Curriculum Studio shell | `a0064c00052ed9024c9b1b4f703a8e0eca0e3867` | `TRANSFER_REQUIRED`; object and ref unavailable |
| Curriculum Validation | `54b314e61be1ca979ac5248a55ce499f8acd0cd3` | `TRANSFER_REQUIRED`; object and ref unavailable |
| Provider Attempt Journal | `a552b2ec343defb3f533f3c0412cae6b8d01355b` | `TRANSFER_REQUIRED`; object and ref unavailable |
| R2 Configuration UI | `178f85c0a43cf9876b296119f7a04142bdf37ae0` | `TRANSFER_REQUIRED`; object and ref unavailable |
| R2 Audit UX | `9305ec5c5f6207e24a1e1116bdb02c5c8793a7ea` | `TRANSFER_REQUIRED`; object and ref unavailable |
| Engine Performance aggregate | `92b73d0dc85b1310d0567976388b14ba72284c74` | `TRANSFER_REQUIRED`; object and ref unavailable |

The following requested Mac branches have no matching local or origin ref. No SHA can be assigned without fabrication:

| Transfer-required branch | Expected SHA | Current owner | Reason integration cannot consume it |
| --- | --- | --- | --- |
| `mac/admin-provider-gateway-instrumentation` | unknown | Mac, per the requested machine classification; not independently provable here | no Windows object and no advertised origin ref |
| `mac/admin-curr-17b-studio-integration` | unknown | Mac, per the requested machine classification; not independently provable here | no Windows object and no advertised origin ref |
| `mac/admin-curr-standards-review` | unknown | Mac, per the requested machine classification; not independently provable here | no Windows object and no advertised origin ref |
| `mac/admin-curr-19-preview-diff` | unknown | Mac, per the requested machine classification; not independently provable here | no Windows object and no advertised origin ref |
| `mac/admin-curr-20a-release-staging` | unknown | Mac, per the requested machine classification; not independently provable here | no Windows object and no advertised origin ref |
| `mac/admin-r2-wave-integration` | unknown | Mac, per the requested machine classification; not independently provable here | no Windows object and no advertised origin ref |

Transfer must make each final branch tip reachable through an advertised Git ref, or supply a Git bundle containing the exact branch ref and its reachable history. The seven supplied SHAs must then pass `git cat-file -e <sha>^{commit}` and ref-containment checks before integration.

## Supersession and composition graph

Do not integrate both sides of any arrow separately.

```text
win/study-production-mount-r5 @ 87a21b7
  -- exact ancestor --> win/final-study-rc1 @ 8ef7647

win/study-recovery-chaos-gate @ 50ae5c0
  -- identical stable patch-id 2a86a5c... replayed as dcfb37f --> final Study RC

win/study-worker-run-evidence @ e97c80b
  -- identical stable patch-id 5df914c... replayed as 6f4994a --> final Study RC
  -- identical stable patch-id 5df914c... replayed as 3628350 --> final Admin RC

win/study-telemetry-invocation @ 833860e
  -- conflict-resolved replay as 62e06df --> final Study RC

win/admin-costs-accounting-integration @ 86003e5
  -- exact ancestor --> win/admin-costs-browser-gate @ de3d81f
  -- identical patch replay as 37f2263 --> final Admin RC

win/admin-study-operations @ 286ce75
  -- exact ancestor --> win/admin-study-ops-browser-gate @ efbf2d7
  -- exact ancestor --> win/admin-study-ops-evidence-r2 @ 7e9d0c6
  -- identical patch replay as 44282b5 --> final Admin RC

win/admin-9-aggregate-r2 @ c72f991
  -- identical patch replay as 475203f --> final Admin RC

win/admin-14b-runtime @ e43a132
  -- exact ancestor --> final Admin RC

win/admin-unified-preflight-orchestrator @ 28ce1a9
  -- identical patch replay as e3f62dc --> final Admin RC
```

For telemetry invocation, the replay's stable patch-id differs because `netlify.toml` already contained the scheduled adult-review worker block. All other changed file postimages are identical; the replay preserves the telemetry comment and redirect alongside that existing schedule. This is evidence of a conflict-resolved replay, not literal ancestry.

The two Windows RCs themselves must both be reconciled into the eventual cross-machine integration, but their shared Study lineage must not be applied twice. Mac shell-versus-Studio and R2 constituent-versus-wave supersession is unresolved until the missing Git histories arrive.

## Minimum recommended final source set

Provisional Windows minimum:

1. `win/final-study-rc1` at `8ef764772c43f63b08403248c1e98273c35c5f4f`.
2. `win/final-admin-delta-rc1` at `e3f62dced44b8ddd7e932ec992756a39f30f3495`.
3. One explicit reconciliation of their 65-path overlap; do not separately integrate the nine constituent Windows branches listed above.

No authoritative cross-machine minimum can be completed yet. After transfer, recompute ancestry for the six `mac/*` final branches against the seven supplied Mac SHAs. Prefer a composed Mac branch only when Git proves it contains or supersedes its constituents.

## Overlap hotspots

Confirmed overlap between the two Windows RCs:

- `MIGRATIONS.md`
- `docs/study-engine-final-production/migration-manifest.json`
- `netlify.toml`
- `src/study/generated/studyDatabase.ts`
- 61 additional shared Study worker, delivery, persistence, test, documentation, and migration paths; the JSON records the overlap count and shared migration paths

Confirmed single-RC touches that must be rechecked against the unavailable Mac sources:

- `src/App.tsx`, Study production route/workspace, and `src/study/client/studyBoundContentClient.ts`: Study RC
- `src/components/admin/AdminConsoleRoute.tsx`: Admin RC
- Admin shell/navigation, content-client changes outside the paths above, and all Mac-side routing/configuration collisions: **indeterminate until transfer**

## Migration-producing sources

The exact tip commits themselves add SQL only in these two cases:

- `e97c80b...` adds `20260810159000_academy_study_worker_run_evidence.sql`.
- `e43a132...` adds `20260810140000_academy_admin_configuration_runtime_enforcement.sql`.

The composed Study RC adds ten SQL paths since the shared baseline:

- `20260809160000_academy_curriculum_release_registry.sql`
- `20260810120000_academy_study_effective_settings_v2.sql`
- `20260810150000_academy_study_curriculum_binding.sql`
- `20260810151000_academy_study_session_semantics_v2.sql`
- `20260810152000_academy_study_in_app_receipt_timestamp.sql`
- `20260810152100_academy_study_worker_operations_contract.sql`
- `20260810153000_academy_study_release_registry_bridge.sql`
- `20260810154000_academy_study_bound_content_authority.sql`
- `20260810155000_academy_study_session_telemetry_outbox.sql`
- `20260810159000_academy_study_worker_run_evidence.sql`

The composed Admin RC adds thirteen SQL paths since the shared baseline:

- `20260809120000_academy_operational_telemetry_foundation.sql`
- `20260809121000_academy_provider_usage_cost_aggregate.sql`
- `20260809130000_academy_admin_audit_foundation.sql`
- `20260809140000_academy_admin_configuration_core.sql`
- `20260809150000_academy_logical_voice_profile_contract.sql`
- `20260810120000_academy_provider_pricing_terms.sql`
- `20260810120000_academy_study_effective_settings_v2.sql`
- `20260810140000_academy_admin_configuration_runtime_enforcement.sql`
- `20260810141000_academy_study_provider_cost_accounting.sql`
- `20260810150000_academy_study_curriculum_binding.sql`
- `20260810152000_academy_study_in_app_receipt_timestamp.sql`
- `20260810152100_academy_study_worker_operations_contract.sql`
- `20260810159000_academy_study_worker_run_evidence.sql`

The Admin RC contains two distinct migrations with timestamp `20260810120000`; final reconciliation must preserve the repository's migration-manifest policy rather than ordering them by timestamp guesswork. Five migration paths are shared verbatim by both Windows RC change sets. Mac migration production is unknown until transfer.

## Hold point

Final product integration is blocked until the missing Mac refs and objects are transferred and verified. No product code was changed, cherry-picked, merged, rebased, reset, pushed, deployed, or migrated by this inventory session.

# Windows final-integration branch inventory

> **Classification:** WINDOWS_FINAL_INTEGRATION_INVENTORY_READY

> **Git snapshot:** 2026-08-11T01:57:16.936Z; all-ref digest `93b8df3a12d5b40c077100de6fd594c3971635941e08f1c2758fc58272365471`. No fetch, push, merge, reset, deployment, or hosted-system contact was performed.

This inventory is derived only from the local Git object database, refs, reflogs, registered worktrees, diffs, and ancestry/patch comparisons. Git does not encode a semantic “completed” flag, so every local `win/*` ref is included; aliases and superseded lines are classified rather than omitted.

## Recommended minimal source set

Use the two terminal functional RC lines. They share the merge base shown below and collectively replace the intermediate Admin, Costs, Study, worker, telemetry, browser-gate, recovery, and preflight branches. Do not also integrate an intermediate branch listed as superseded.

| Branch | HEAD | Role |
|---|---:|---|
| `win/final-admin-delta-rc1` | `ae2c9b324` | Admin/runtime/costs/operations/preflight terminal integration line |
| `win/final-study-rc1` | `f93f0736b` | Study production mount plus worker/telemetry/recovery/smoke terminal line |

Functional common merge-base: `d65d1511dd602db586a204bb7ccb2800fd7a89e2`. The two functional deltas overlap on **64 paths**; 22 resolve to different final blobs and therefore require deliberate integration, not blind dual application.

Unique release-support branches should be applied after the two functional lines if their artifacts are part of the RC:

| Branch | HEAD |
|---|---:|
| `win/final-cross-machine-source-verifier` | `a438b00e8` |
| `win/final-migration-proposal` | `c7bca9dee` |
| `win/final-production-activation-runbook` | `805ba4645` |
| `win/final-rc-validation-harness` | `3e8b54f95` |

## Snapshot census

- Local `win/*` refs: **44**; remote-tracking `*/win/*` refs: **0**.
- All inspected refs: **318** (heads=76, remotes=220, tags=22).
- Registered worktrees: **97**; dirty at observation: **0**.

## Supersession and alias classification

| Branch | Classification | Terminal line | Git evidence |
|---|---|---|---|
| `win/admin-14b-runtime` | superseded-by-terminal-descendant | `win/final-admin-delta-rc1` | ancestor |
| `win/admin-9-aggregate-adoption-r2` | superseded-by-terminal-descendant | `win/final-admin-delta-rc1` | ancestor |
| `win/admin-9-aggregate-adoption-r2-fresh` | superseded-by-terminal-descendant | `win/final-admin-delta-rc1` | ancestor |
| `win/admin-9-aggregate-r2` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 2 patch-equivalent |
| `win/admin-costs-accounting-integration` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 6 patch-equivalent |
| `win/admin-costs-browser-gate` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 1 patch-equivalent |
| `win/admin-costs-v3-integration` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 1 subject-matched replay |
| `win/admin-migration-reconciliation-planner` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 1 patch-equivalent |
| `win/admin-preflight-r3` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 2 patch-equivalent |
| `win/admin-study-operations` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 1 subject-matched replay |
| `win/admin-study-ops-browser-gate` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 1 subject-matched replay |
| `win/admin-study-ops-evidence-r2` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 5 patch-equivalent, 1 subject-matched replay |
| `win/admin-unified-preflight-orchestrator` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 3 patch-equivalent |
| `win/final-admin-delta-rc1` | recommended-functional-source | — | recommended-functional-source |
| `win/final-cross-machine-source-verifier` | release-support-source | — | release-support-source |
| `win/final-integration-inventory` | inventory-output-branch | — | inventory-output-branch |
| `win/final-migration-proposal` | release-support-source | — | release-support-source |
| `win/final-production-activation-runbook` | release-support-source | — | release-support-source |
| `win/final-rc-validation-harness` | release-support-source | — | release-support-source |
| `win/final-study-rc1` | recommended-functional-source | — | recommended-functional-source |
| `win/provider-pricing-terms` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 2 subject-matched replay |
| `win/provider-pricing-ui` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 1 subject-matched replay |
| `win/study-bound-content-runtime` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent |
| `win/study-curriculum-binding` | superseded-by-terminal-descendant | `win/final-study-rc1` | ancestor |
| `win/study-deployment-env-preflight` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 1 subject-matched replay |
| `win/study-effective-settings-v2` | superseded-by-terminal-descendant | `win/final-study-rc1` | ancestor |
| `win/study-learner-path-r4` | superseded-by-terminal-descendant | `win/final-study-rc1` | ancestor |
| `win/study-private-scheduled-worker` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent |
| `win/study-production-client-controller` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent |
| `win/study-production-core-r3` | superseded-by-terminal-descendant | `win/final-study-rc1` | ancestor |
| `win/study-production-mount-r5` | superseded-by-terminal-descendant | `win/final-study-rc1` | ancestor |
| `win/study-production-smoke-harness` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent |
| `win/study-production-ux-shell` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent |
| `win/study-provider-cost-accounting` | superseded-by-replayed-terminal-line | `win/final-admin-delta-rc1` | 1 subject-matched replay |
| `win/study-recovery-chaos-gate` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent |
| `win/study-release-registry-bridge` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent, 1 subject-matched replay |
| `win/study-security-adversarial-r4` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent |
| `win/study-session-semantics-v2` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent |
| `win/study-session-telemetry-outbox` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 subject-matched replay |
| `win/study-telemetry-delivery-worker` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent |
| `win/study-telemetry-invocation` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 subject-matched replay |
| `win/study-worker-production-composition` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 subject-matched replay |
| `win/study-worker-run-evidence` | superseded-by-replayed-terminal-line | `win/final-study-rc1` | 1 patch-equivalent |
| `win/study-worker-schedule` | superseded-by-terminal-descendant | `win/final-study-rc1` | ancestor |

A “subject-matched replay” means the source commit is not patch-equivalent after conflict resolution, but a commit with the same Git subject is present on the terminal line. Such entries are classified as integrated corrections rather than literal ancestors. Exact ancestry and patch-equivalence remain separately recorded in JSON.

## Branch inventory

Changed paths, migrations, and additions use the comparison base recorded per branch. Normally that is the oldest reflog entry (the branch creation point); for a ref registered directly at an existing tip, the canonical same-tip branch base or first parent is used.

| Branch | Worktree | HEAD | State | Upstream | Base | Commits | Exclusive | Paths | Migrations | Test adds | Doc adds |
|---|---|---:|---|---|---:|---:|---:|---:|---:|---:|---:|
| `win/admin-14b-runtime` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-14b-runtime` | `e43a13200` | clean | — | `8751ead4b` | 5 | 0 | 61 | 3 | 8 | 3 |
| `win/admin-9-aggregate-adoption-r2` | — | `d55c5dc6c` | not-registered | — | `d65d1511d` | 1 | 0 | 15 | 1 | 2 | 0 |
| `win/admin-9-aggregate-adoption-r2-fresh` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-9-aggregate-r2-fresh` | `d55c5dc6c` | clean | — | `d65d1511d` | 1 | 0 | 15 | 1 | 2 | 0 |
| `win/admin-9-aggregate-r2` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-9-aggregate-r2` | `c72f99182` | clean | — | `2d8c911d4` | 2 | 2 | 16 | 1 | 0 | 0 |
| `win/admin-costs-accounting-integration` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-costs-accounting-integration` | `86003e57c` | clean | — | `e43a13200` | 6 | 0 | 50 | 3 | 8 | 3 |
| `win/admin-costs-browser-gate` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-costs-browser-gate` | `de3d81fed` | clean | — | `86003e57c` | 1 | 1 | 10 | 0 | 0 | 0 |
| `win/admin-costs-v3-integration` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-costs-v3-integration` | `782c3ac01` | clean | — | `d7f5e84b3` | 1 | 1 | 16 | 0 | 0 | 1 |
| `win/admin-migration-reconciliation-planner` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-migration-reconciliation-planner` | `666bf2608` | clean | — | `40abc78b0` | 1 | 0 | 17 | 0 | 1 | 1 |
| `win/admin-preflight-r3` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-preflight-r3` | `40abc78b0` | clean | — | `e43a13200` | 2 | 0 | 9 | 0 | 1 | 3 |
| `win/admin-study-operations` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-study-operations` | `286ce7507` | clean | — | `e43a13200` | 1 | 0 | 18 | 0 | 5 | 0 |
| `win/admin-study-ops-browser-gate` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-study-ops-browser-gate` | `efbf2d796` | clean | — | `286ce7507` | 1 | 0 | 6 | 0 | 0 | 0 |
| `win/admin-study-ops-evidence-r2` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-study-ops-evidence-r2` | `7e9d0c616` | clean | — | `efbf2d796` | 6 | 6 | 74 | 5 | 16 | 1 |
| `win/admin-unified-preflight-orchestrator` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-unified-preflight-orchestrator` | `28ce1a938` | clean | — | `40abc78b0` | 3 | 0 | 24 | 0 | 3 | 3 |
| `win/final-admin-delta-rc1` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-admin-delta-rc1` | `ae2c9b324` | clean | — | `e43a13200` | 24 | 24 | 168 | 8 | 33 | 11 |
| `win/final-cross-machine-source-verifier` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-cross-machine-source-verifier` | `a438b00e8` | clean | — | `ffd1cc5a7` | 1 | 1 | 2 | 0 | 0 | 2 |
| `win/final-integration-inventory` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-integration-inventory` | `ffd1cc5a7` | clean | — | `19e8faa4c` | 1 | 0 | 2 | 0 | 0 | 0 |
| `win/final-migration-proposal` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-migration-proposal` | `c7bca9dee` | clean | — | `666bf2608` | 1 | 1 | 2 | 0 | 0 | 2 |
| `win/final-production-activation-runbook` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-production-activation-runbook` | `805ba4645` | clean | — | `28ce1a938` | 1 | 1 | 4 | 0 | 0 | 2 |
| `win/final-rc-validation-harness` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-rc-validation-harness` | `3e8b54f95` | clean | — | `28ce1a938` | 1 | 1 | 5 | 0 | 1 | 1 |
| `win/final-study-rc1` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-study-rc1` | `f93f0736b` | clean | — | `87a21b748` | 9 | 9 | 73 | 5 | 22 | 2 |
| `win/provider-pricing-terms` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-provider-pricing-terms` | `0ca0d2db3` | clean | — | `d7f5e84b3` | 2 | 0 | 31 | 2 | 8 | 2 |
| `win/provider-pricing-ui` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-provider-pricing-ui` | `9884d4373` | clean | — | `0ca0d2db3` | 1 | 1 | 14 | 0 | 3 | 0 |
| `win/study-bound-content-runtime` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-bound-content-runtime` | `38e9a4743` | clean | — | `01baf7b9e` | 1 | 1 | 12 | 1 | 1 | 1 |
| `win/study-curriculum-binding` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-curriculum-binding` | `a2a514b58` | clean | — | `cf996198e` | 1 | 0 | 17 | 1 | 2 | 0 |
| `win/study-deployment-env-preflight` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-deployment-env-preflight` | `a0b5841c7` | clean | — | `96fac0361` | 1 | 1 | 4 | 0 | 1 | 1 |
| `win/study-effective-settings-v2` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-effective-settings` | `cf996198e` | clean | — | `d65d1511d` | 1 | 0 | 15 | 1 | 3 | 1 |
| `win/study-learner-path-r4` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-learner-path-r4` | `27254fd65` | clean | — | `01237423f` | 3 | 0 | 27 | 1 | 5 | 1 |
| `win/study-private-scheduled-worker` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-private-scheduled-worker` | `96fac0361` | clean | — | `e09770aa8` | 1 | 0 | 9 | 0 | 1 | 0 |
| `win/study-production-client-controller` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-production-client-controller` | `5efb261b8` | clean | — | `ac3e7518c` | 1 | 0 | 7 | 0 | 2 | 0 |
| `win/study-production-core-r3` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-production-core-r3` | `01237423f` | clean | — | `a2a514b58` | 4 | 0 | 24 | 3 | 3 | 3 |
| `win/study-production-mount-r5` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-production-mount-r5` | `87a21b748` | clean | — | `27254fd65` | 3 | 0 | 17 | 0 | 5 | 1 |
| `win/study-production-smoke-harness` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-production-smoke-harness` | `a3c9a9483` | clean | — | `27254fd65` | 1 | 1 | 9 | 0 | 2 | 1 |
| `win/study-production-ux-shell` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-production-ux-shell` | `3b4a2ab75` | clean | — | `5efb261b8` | 1 | 1 | 4 | 0 | 2 | 0 |
| `win/study-provider-cost-accounting` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-provider-cost-accounting` | `16c4c82ad` | clean | — | `0ca0d2db3` | 1 | 1 | 12 | 1 | 1 | 1 |
| `win/study-recovery-chaos-gate` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-recovery-chaos-gate` | `50ae5c05a` | clean | — | `27254fd65` | 1 | 1 | 4 | 0 | 1 | 0 |
| `win/study-release-registry-bridge` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-release-registry-bridge` | `01baf7b9e` | clean | — | `a2a514b58` | 2 | 0 | 15 | 2 | 2 | 3 |
| `win/study-security-adversarial-r4` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-security-adversarial-r4` | `0841d4a50` | clean | — | `01237423f` | 1 | 1 | 4 | 0 | 2 | 1 |
| `win/study-session-semantics-v2` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-session-semantics-v2` | `ac3e7518c` | clean | — | `a2a514b58` | 1 | 0 | 11 | 1 | 1 | 0 |
| `win/study-session-telemetry-outbox` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-session-telemetry-outbox` | `01095378f` | clean | — | `ac3e7518c` | 1 | 0 | 13 | 1 | 5 | 1 |
| `win/study-telemetry-delivery-worker` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-telemetry-delivery-worker` | `fa1e3e3f7` | clean | — | `01095378f` | 1 | 0 | 12 | 0 | 1 | 0 |
| `win/study-telemetry-invocation` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-telemetry-invocation` | `833860eb1` | clean | — | `fa1e3e3f7` | 1 | 1 | 13 | 0 | 3 | 0 |
| `win/study-worker-production-composition` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-worker-production-composition` | `e09770aa8` | clean | — | `a2a514b58` | 1 | 0 | 29 | 2 | 7 | 0 |
| `win/study-worker-run-evidence` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-worker-run-evidence` | `e97c80beb` | clean | — | `96fac0361` | 1 | 1 | 11 | 1 | 2 | 0 |
| `win/study-worker-schedule` | `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-worker-schedule` | `cf996198e` | clean | — | `d65d1511d` | 1 | 0 | 15 | 1 | 3 | 1 |

## Merge-base matrix

Each cell is `merge-base / relation / milestone-only:branch-only`. Relations are from the milestone to the branch.

| Branch | master | origin/master | integrate/admin-console-r1 | integrate/admin-console-r1-wave2 | feat/admin-tel-foundation | feat/tel-ai-gateways | win/final-admin-delta-rc1 | win/final-study-rc1 | win/final-rc-validation-harness |
|---|---|---|---|---|---|---|---|---|---|
| `win/admin-14b-runtime` | 668cfd877 / milestone-ancestor / 0:32 | 668cfd877 / diverged / 10:32 | a8822212e / milestone-ancestor / 0:15 | d65d1511d / milestone-ancestor / 0:7 | d55c5dc6c / milestone-ancestor / 0:6 | e9febc03b / milestone-ancestor / 0:5 | e43a13200 / branch-ancestor / 24:0 | d65d1511d / diverged / 21:7 | e43a13200 / branch-ancestor / 6:0 |
| `win/admin-9-aggregate-adoption-r2` | 668cfd877 / milestone-ancestor / 0:26 | 668cfd877 / diverged / 10:26 | a8822212e / milestone-ancestor / 0:9 | d65d1511d / milestone-ancestor / 0:1 | d55c5dc6c / same / 0:0 | d55c5dc6c / branch-ancestor / 1:0 | d55c5dc6c / branch-ancestor / 30:0 | d65d1511d / diverged / 21:1 | d55c5dc6c / branch-ancestor / 12:0 |
| `win/admin-9-aggregate-adoption-r2-fresh` | 668cfd877 / milestone-ancestor / 0:26 | 668cfd877 / diverged / 10:26 | a8822212e / milestone-ancestor / 0:9 | d65d1511d / milestone-ancestor / 0:1 | d55c5dc6c / same / 0:0 | d55c5dc6c / branch-ancestor / 1:0 | d55c5dc6c / branch-ancestor / 30:0 | d65d1511d / diverged / 21:1 | d55c5dc6c / branch-ancestor / 12:0 |
| `win/admin-9-aggregate-r2` | 668cfd877 / milestone-ancestor / 0:29 | 668cfd877 / diverged / 10:29 | a8822212e / milestone-ancestor / 0:12 | d65d1511d / milestone-ancestor / 0:4 | d55c5dc6c / milestone-ancestor / 0:3 | d55c5dc6c / diverged / 1:3 | d55c5dc6c / diverged / 30:3 | d65d1511d / diverged / 21:4 | d55c5dc6c / diverged / 12:3 |
| `win/admin-costs-accounting-integration` | 668cfd877 / milestone-ancestor / 0:38 | 668cfd877 / diverged / 10:38 | a8822212e / milestone-ancestor / 0:21 | d65d1511d / milestone-ancestor / 0:13 | d55c5dc6c / milestone-ancestor / 0:12 | e9febc03b / milestone-ancestor / 0:11 | e43a13200 / diverged / 24:6 | d65d1511d / diverged / 21:13 | e43a13200 / diverged / 6:6 |
| `win/admin-costs-browser-gate` | 668cfd877 / milestone-ancestor / 0:39 | 668cfd877 / diverged / 10:39 | a8822212e / milestone-ancestor / 0:22 | d65d1511d / milestone-ancestor / 0:14 | d55c5dc6c / milestone-ancestor / 0:13 | e9febc03b / milestone-ancestor / 0:12 | e43a13200 / diverged / 24:7 | d65d1511d / diverged / 21:14 | e43a13200 / diverged / 6:7 |
| `win/admin-costs-v3-integration` | 668cfd877 / milestone-ancestor / 0:29 | 668cfd877 / diverged / 10:29 | a8822212e / milestone-ancestor / 0:12 | d65d1511d / milestone-ancestor / 0:4 | d55c5dc6c / milestone-ancestor / 0:3 | e9febc03b / milestone-ancestor / 0:2 | e9febc03b / diverged / 29:2 | d65d1511d / diverged / 21:4 | e9febc03b / diverged / 11:2 |
| `win/admin-migration-reconciliation-planner` | 668cfd877 / milestone-ancestor / 0:35 | 668cfd877 / diverged / 10:35 | a8822212e / milestone-ancestor / 0:18 | d65d1511d / milestone-ancestor / 0:10 | d55c5dc6c / milestone-ancestor / 0:9 | e9febc03b / milestone-ancestor / 0:8 | e43a13200 / diverged / 24:3 | d65d1511d / diverged / 21:10 | 40abc78b0 / diverged / 4:1 |
| `win/admin-preflight-r3` | 668cfd877 / milestone-ancestor / 0:34 | 668cfd877 / diverged / 10:34 | a8822212e / milestone-ancestor / 0:17 | d65d1511d / milestone-ancestor / 0:9 | d55c5dc6c / milestone-ancestor / 0:8 | e9febc03b / milestone-ancestor / 0:7 | e43a13200 / diverged / 24:2 | d65d1511d / diverged / 21:9 | 40abc78b0 / branch-ancestor / 4:0 |
| `win/admin-study-operations` | 668cfd877 / milestone-ancestor / 0:33 | 668cfd877 / diverged / 10:33 | a8822212e / milestone-ancestor / 0:16 | d65d1511d / milestone-ancestor / 0:8 | d55c5dc6c / milestone-ancestor / 0:7 | e9febc03b / milestone-ancestor / 0:6 | e43a13200 / diverged / 24:1 | d65d1511d / diverged / 21:8 | e43a13200 / diverged / 6:1 |
| `win/admin-study-ops-browser-gate` | 668cfd877 / milestone-ancestor / 0:34 | 668cfd877 / diverged / 10:34 | a8822212e / milestone-ancestor / 0:17 | d65d1511d / milestone-ancestor / 0:9 | d55c5dc6c / milestone-ancestor / 0:8 | e9febc03b / milestone-ancestor / 0:7 | e43a13200 / diverged / 24:2 | d65d1511d / diverged / 21:9 | e43a13200 / diverged / 6:2 |
| `win/admin-study-ops-evidence-r2` | 668cfd877 / milestone-ancestor / 0:40 | 668cfd877 / diverged / 10:40 | a8822212e / milestone-ancestor / 0:23 | d65d1511d / milestone-ancestor / 0:15 | d55c5dc6c / milestone-ancestor / 0:14 | e9febc03b / milestone-ancestor / 0:13 | e43a13200 / diverged / 24:8 | d65d1511d / diverged / 21:15 | e43a13200 / diverged / 6:8 |
| `win/admin-unified-preflight-orchestrator` | 668cfd877 / milestone-ancestor / 0:37 | 668cfd877 / diverged / 10:37 | a8822212e / milestone-ancestor / 0:20 | d65d1511d / milestone-ancestor / 0:12 | d55c5dc6c / milestone-ancestor / 0:11 | e9febc03b / milestone-ancestor / 0:10 | e43a13200 / diverged / 24:5 | d65d1511d / diverged / 21:12 | 28ce1a938 / branch-ancestor / 1:0 |
| `win/final-admin-delta-rc1` | 668cfd877 / milestone-ancestor / 0:56 | 668cfd877 / diverged / 10:56 | a8822212e / milestone-ancestor / 0:39 | d65d1511d / milestone-ancestor / 0:31 | d55c5dc6c / milestone-ancestor / 0:30 | e9febc03b / milestone-ancestor / 0:29 | ae2c9b324 / same / 0:0 | d65d1511d / diverged / 21:31 | e43a13200 / diverged / 6:24 |
| `win/final-cross-machine-source-verifier` | 668cfd877 / milestone-ancestor / 0:11 | ffd1cc5a7 / milestone-ancestor / 0:1 | 668cfd877 / diverged / 17:11 | 668cfd877 / diverged / 25:11 | 668cfd877 / diverged / 26:11 | 668cfd877 / diverged / 27:11 | 668cfd877 / diverged / 56:11 | 668cfd877 / diverged / 46:11 | 668cfd877 / diverged / 38:11 |
| `win/final-integration-inventory` | 668cfd877 / milestone-ancestor / 0:10 | ffd1cc5a7 / same / 0:0 | 668cfd877 / diverged / 17:10 | 668cfd877 / diverged / 25:10 | 668cfd877 / diverged / 26:10 | 668cfd877 / diverged / 27:10 | 668cfd877 / diverged / 56:10 | 668cfd877 / diverged / 46:10 | 668cfd877 / diverged / 38:10 |
| `win/final-migration-proposal` | 668cfd877 / milestone-ancestor / 0:36 | 668cfd877 / diverged / 10:36 | a8822212e / milestone-ancestor / 0:19 | d65d1511d / milestone-ancestor / 0:11 | d55c5dc6c / milestone-ancestor / 0:10 | e9febc03b / milestone-ancestor / 0:9 | e43a13200 / diverged / 24:4 | d65d1511d / diverged / 21:11 | 40abc78b0 / diverged / 4:2 |
| `win/final-production-activation-runbook` | 668cfd877 / milestone-ancestor / 0:38 | 668cfd877 / diverged / 10:38 | a8822212e / milestone-ancestor / 0:21 | d65d1511d / milestone-ancestor / 0:13 | d55c5dc6c / milestone-ancestor / 0:12 | e9febc03b / milestone-ancestor / 0:11 | e43a13200 / diverged / 24:6 | d65d1511d / diverged / 21:13 | 28ce1a938 / diverged / 1:1 |
| `win/final-rc-validation-harness` | 668cfd877 / milestone-ancestor / 0:38 | 668cfd877 / diverged / 10:38 | a8822212e / milestone-ancestor / 0:21 | d65d1511d / milestone-ancestor / 0:13 | d55c5dc6c / milestone-ancestor / 0:12 | e9febc03b / milestone-ancestor / 0:11 | e43a13200 / diverged / 24:6 | d65d1511d / diverged / 21:13 | 3e8b54f95 / same / 0:0 |
| `win/final-study-rc1` | 668cfd877 / milestone-ancestor / 0:46 | 668cfd877 / diverged / 10:46 | a8822212e / milestone-ancestor / 0:29 | d65d1511d / milestone-ancestor / 0:21 | d65d1511d / diverged / 1:21 | d65d1511d / diverged / 2:21 | d65d1511d / diverged / 31:21 | f93f0736b / same / 0:0 | d65d1511d / diverged / 13:21 |
| `win/provider-pricing-terms` | 668cfd877 / milestone-ancestor / 0:30 | 668cfd877 / diverged / 10:30 | a8822212e / milestone-ancestor / 0:13 | d65d1511d / milestone-ancestor / 0:5 | d55c5dc6c / milestone-ancestor / 0:4 | e9febc03b / milestone-ancestor / 0:3 | e9febc03b / diverged / 29:3 | d65d1511d / diverged / 21:5 | e9febc03b / diverged / 11:3 |
| `win/provider-pricing-ui` | 668cfd877 / milestone-ancestor / 0:31 | 668cfd877 / diverged / 10:31 | a8822212e / milestone-ancestor / 0:14 | d65d1511d / milestone-ancestor / 0:6 | d55c5dc6c / milestone-ancestor / 0:5 | e9febc03b / milestone-ancestor / 0:4 | e9febc03b / diverged / 29:4 | d65d1511d / diverged / 21:6 | e9febc03b / diverged / 11:4 |
| `win/study-bound-content-runtime` | 668cfd877 / milestone-ancestor / 0:30 | 668cfd877 / diverged / 10:30 | a8822212e / milestone-ancestor / 0:13 | d65d1511d / milestone-ancestor / 0:5 | d65d1511d / diverged / 1:5 | d65d1511d / diverged / 2:5 | d65d1511d / diverged / 31:5 | a2a514b58 / diverged / 19:3 | d65d1511d / diverged / 13:5 |
| `win/study-curriculum-binding` | 668cfd877 / milestone-ancestor / 0:27 | 668cfd877 / diverged / 10:27 | a8822212e / milestone-ancestor / 0:10 | d65d1511d / milestone-ancestor / 0:2 | d65d1511d / diverged / 1:2 | d65d1511d / diverged / 2:2 | d65d1511d / diverged / 31:2 | a2a514b58 / branch-ancestor / 19:0 | d65d1511d / diverged / 13:2 |
| `win/study-deployment-env-preflight` | 668cfd877 / milestone-ancestor / 0:30 | 668cfd877 / diverged / 10:30 | a8822212e / milestone-ancestor / 0:13 | d65d1511d / milestone-ancestor / 0:5 | d65d1511d / diverged / 1:5 | d65d1511d / diverged / 2:5 | d65d1511d / diverged / 31:5 | a2a514b58 / diverged / 19:3 | d65d1511d / diverged / 13:5 |
| `win/study-effective-settings-v2` | 668cfd877 / milestone-ancestor / 0:26 | 668cfd877 / diverged / 10:26 | a8822212e / milestone-ancestor / 0:9 | d65d1511d / milestone-ancestor / 0:1 | d65d1511d / diverged / 1:1 | d65d1511d / diverged / 2:1 | d65d1511d / diverged / 31:1 | cf996198e / branch-ancestor / 20:0 | d65d1511d / diverged / 13:1 |
| `win/study-learner-path-r4` | 668cfd877 / milestone-ancestor / 0:34 | 668cfd877 / diverged / 10:34 | a8822212e / milestone-ancestor / 0:17 | d65d1511d / milestone-ancestor / 0:9 | d65d1511d / diverged / 1:9 | d65d1511d / diverged / 2:9 | d65d1511d / diverged / 31:9 | 27254fd65 / branch-ancestor / 12:0 | d65d1511d / diverged / 13:9 |
| `win/study-private-scheduled-worker` | 668cfd877 / milestone-ancestor / 0:29 | 668cfd877 / diverged / 10:29 | a8822212e / milestone-ancestor / 0:12 | d65d1511d / milestone-ancestor / 0:4 | d65d1511d / diverged / 1:4 | d65d1511d / diverged / 2:4 | d65d1511d / diverged / 31:4 | a2a514b58 / diverged / 19:2 | d65d1511d / diverged / 13:4 |
| `win/study-production-client-controller` | 668cfd877 / milestone-ancestor / 0:29 | 668cfd877 / diverged / 10:29 | a8822212e / milestone-ancestor / 0:12 | d65d1511d / milestone-ancestor / 0:4 | d65d1511d / diverged / 1:4 | d65d1511d / diverged / 2:4 | d65d1511d / diverged / 31:4 | a2a514b58 / diverged / 19:2 | d65d1511d / diverged / 13:4 |
| `win/study-production-core-r3` | 668cfd877 / milestone-ancestor / 0:31 | 668cfd877 / diverged / 10:31 | a8822212e / milestone-ancestor / 0:14 | d65d1511d / milestone-ancestor / 0:6 | d65d1511d / diverged / 1:6 | d65d1511d / diverged / 2:6 | d65d1511d / diverged / 31:6 | 01237423f / branch-ancestor / 15:0 | d65d1511d / diverged / 13:6 |
| `win/study-production-mount-r5` | 668cfd877 / milestone-ancestor / 0:37 | 668cfd877 / diverged / 10:37 | a8822212e / milestone-ancestor / 0:20 | d65d1511d / milestone-ancestor / 0:12 | d65d1511d / diverged / 1:12 | d65d1511d / diverged / 2:12 | d65d1511d / diverged / 31:12 | 87a21b748 / branch-ancestor / 9:0 | d65d1511d / diverged / 13:12 |
| `win/study-production-smoke-harness` | 668cfd877 / milestone-ancestor / 0:35 | 668cfd877 / diverged / 10:35 | a8822212e / milestone-ancestor / 0:18 | d65d1511d / milestone-ancestor / 0:10 | d65d1511d / diverged / 1:10 | d65d1511d / diverged / 2:10 | d65d1511d / diverged / 31:10 | 27254fd65 / diverged / 12:1 | d65d1511d / diverged / 13:10 |
| `win/study-production-ux-shell` | 668cfd877 / milestone-ancestor / 0:30 | 668cfd877 / diverged / 10:30 | a8822212e / milestone-ancestor / 0:13 | d65d1511d / milestone-ancestor / 0:5 | d65d1511d / diverged / 1:5 | d65d1511d / diverged / 2:5 | d65d1511d / diverged / 31:5 | a2a514b58 / diverged / 19:3 | d65d1511d / diverged / 13:5 |
| `win/study-provider-cost-accounting` | 668cfd877 / milestone-ancestor / 0:31 | 668cfd877 / diverged / 10:31 | a8822212e / milestone-ancestor / 0:14 | d65d1511d / milestone-ancestor / 0:6 | d55c5dc6c / milestone-ancestor / 0:5 | e9febc03b / milestone-ancestor / 0:4 | e9febc03b / diverged / 29:4 | d65d1511d / diverged / 21:6 | e9febc03b / diverged / 11:4 |
| `win/study-recovery-chaos-gate` | 668cfd877 / milestone-ancestor / 0:35 | 668cfd877 / diverged / 10:35 | a8822212e / milestone-ancestor / 0:18 | d65d1511d / milestone-ancestor / 0:10 | d65d1511d / diverged / 1:10 | d65d1511d / diverged / 2:10 | d65d1511d / diverged / 31:10 | 27254fd65 / diverged / 12:1 | d65d1511d / diverged / 13:10 |
| `win/study-release-registry-bridge` | 668cfd877 / milestone-ancestor / 0:29 | 668cfd877 / diverged / 10:29 | a8822212e / milestone-ancestor / 0:12 | d65d1511d / milestone-ancestor / 0:4 | d65d1511d / diverged / 1:4 | d65d1511d / diverged / 2:4 | d65d1511d / diverged / 31:4 | a2a514b58 / diverged / 19:2 | d65d1511d / diverged / 13:4 |
| `win/study-security-adversarial-r4` | 668cfd877 / milestone-ancestor / 0:32 | 668cfd877 / diverged / 10:32 | a8822212e / milestone-ancestor / 0:15 | d65d1511d / milestone-ancestor / 0:7 | d65d1511d / diverged / 1:7 | d65d1511d / diverged / 2:7 | d65d1511d / diverged / 31:7 | 01237423f / diverged / 15:1 | d65d1511d / diverged / 13:7 |
| `win/study-session-semantics-v2` | 668cfd877 / milestone-ancestor / 0:28 | 668cfd877 / diverged / 10:28 | a8822212e / milestone-ancestor / 0:11 | d65d1511d / milestone-ancestor / 0:3 | d65d1511d / diverged / 1:3 | d65d1511d / diverged / 2:3 | d65d1511d / diverged / 31:3 | a2a514b58 / diverged / 19:1 | d65d1511d / diverged / 13:3 |
| `win/study-session-telemetry-outbox` | 668cfd877 / milestone-ancestor / 0:29 | 668cfd877 / diverged / 10:29 | a8822212e / milestone-ancestor / 0:12 | d65d1511d / milestone-ancestor / 0:4 | d65d1511d / diverged / 1:4 | d65d1511d / diverged / 2:4 | d65d1511d / diverged / 31:4 | a2a514b58 / diverged / 19:2 | d65d1511d / diverged / 13:4 |
| `win/study-telemetry-delivery-worker` | 668cfd877 / milestone-ancestor / 0:30 | 668cfd877 / diverged / 10:30 | a8822212e / milestone-ancestor / 0:13 | d65d1511d / milestone-ancestor / 0:5 | d65d1511d / diverged / 1:5 | d65d1511d / diverged / 2:5 | d65d1511d / diverged / 31:5 | a2a514b58 / diverged / 19:3 | d65d1511d / diverged / 13:5 |
| `win/study-telemetry-invocation` | 668cfd877 / milestone-ancestor / 0:31 | 668cfd877 / diverged / 10:31 | a8822212e / milestone-ancestor / 0:14 | d65d1511d / milestone-ancestor / 0:6 | d65d1511d / diverged / 1:6 | d65d1511d / diverged / 2:6 | d65d1511d / diverged / 31:6 | a2a514b58 / diverged / 19:4 | d65d1511d / diverged / 13:6 |
| `win/study-worker-production-composition` | 668cfd877 / milestone-ancestor / 0:28 | 668cfd877 / diverged / 10:28 | a8822212e / milestone-ancestor / 0:11 | d65d1511d / milestone-ancestor / 0:3 | d65d1511d / diverged / 1:3 | d65d1511d / diverged / 2:3 | d65d1511d / diverged / 31:3 | a2a514b58 / diverged / 19:1 | d65d1511d / diverged / 13:3 |
| `win/study-worker-run-evidence` | 668cfd877 / milestone-ancestor / 0:30 | 668cfd877 / diverged / 10:30 | a8822212e / milestone-ancestor / 0:13 | d65d1511d / milestone-ancestor / 0:5 | d65d1511d / diverged / 1:5 | d65d1511d / diverged / 2:5 | d65d1511d / diverged / 31:5 | a2a514b58 / diverged / 19:3 | d65d1511d / diverged / 13:5 |
| `win/study-worker-schedule` | 668cfd877 / milestone-ancestor / 0:26 | 668cfd877 / diverged / 10:26 | a8822212e / milestone-ancestor / 0:9 | d65d1511d / milestone-ancestor / 0:1 | d65d1511d / diverged / 1:1 | d65d1511d / diverged / 2:1 | d65d1511d / diverged / 31:1 | cf996198e / branch-ancestor / 20:0 | d65d1511d / diverged / 13:1 |

## Functional source overlap hotspots

| Path | Final blobs identical? | Admin blob | Study blob |
|---|---|---:|---:|
| `MIGRATIONS.md` | **no** | `a897e8438` | `14e1874d1` |
| `docs/study-effective-settings-v2.md` | **no** | `f45574478` | `94ff30caa` |
| `docs/study-engine-final-production/migration-manifest.json` | **no** | `23cbb3f83` | `ba5105cf0` |
| `docs/study-engine-production-reconciliation/12-production-readiness-matrix.md` | yes | `52ef101c1` | `52ef101c1` |
| `netlify.toml` | **no** | `701a003fe` | `2e866873f` |
| `netlify/functions/_shared/operational-telemetry-writer.js` | **no** | `c57e7b411` | `4c8028303` |
| `netlify/functions/_shared/operational-telemetry-writer.test.js` | **no** | `a0d08439e` | `48eb3c901` |
| `netlify/functions/_shared/study-adult-review-operations/composition.js` | yes | `46e453d55` | `46e453d55` |
| `netlify/functions/_shared/study-adult-review-operations/composition.test.js` | yes | `630fdae10` | `630fdae10` |
| `netlify/functions/_shared/study-adult-review-operations/entrypoint-result.js` | yes | `82f8f2509` | `82f8f2509` |
| `netlify/functions/_shared/study-adult-review-operations/run-evidence.js` | yes | `fd9eb6873` | `fd9eb6873` |
| `netlify/functions/_shared/study-adult-review-operations/run-evidence.test.js` | yes | `e2e8b3ffa` | `e2e8b3ffa` |
| `netlify/functions/_shared/study-adult-review-operations/supabase-operations.js` | yes | `b86c8318b` | `b86c8318b` |
| `netlify/functions/_shared/study-adult-review-operations/supabase-operations.test.js` | yes | `4271397ed` | `4271397ed` |
| `netlify/functions/_shared/study-adult-review-operations/worker.js` | yes | `7cf2e26c2` | `7cf2e26c2` |
| `netlify/functions/_shared/study-adult-review-operations/worker.test.js` | yes | `dca312909` | `dca312909` |
| `netlify/functions/_shared/study-adult-review/delivery.js` | yes | `8b7d7e778` | `8b7d7e778` |
| `netlify/functions/_shared/study-adult-review/guardian-notifications.js` | yes | `87e00fac3` | `87e00fac3` |
| `netlify/functions/_shared/study-adult-review/memory-store.js` | yes | `05c0b6d5b` | `05c0b6d5b` |
| `netlify/functions/_shared/study-adult-review/outbox-worker.js` | yes | `64f0820d2` | `64f0820d2` |
| `netlify/functions/_shared/study-delivery/durable-identifier-contract.test.js` | yes | `58c3b78df` | `58c3b78df` |
| `netlify/functions/_shared/study-delivery/external-provider.js` | yes | `0da76331c` | `0da76331c` |
| `netlify/functions/_shared/study-delivery/external-provider.test.js` | yes | `5c3972baa` | `5c3972baa` |
| `netlify/functions/_shared/study-delivery/in-app-provider.js` | yes | `7430b64e6` | `7430b64e6` |
| `netlify/functions/_shared/study-delivery/in-app-provider.test.js` | yes | `ff0293b8f` | `ff0293b8f` |
| `netlify/functions/_shared/study-delivery/in-app-receipt-validator.js` | yes | `3f51b9743` | `3f51b9743` |
| `netlify/functions/_shared/study-delivery/in-app-receipt-validator.test.js` | yes | `484423bfa` | `484423bfa` |
| `netlify/functions/_shared/study-delivery/receipt-contract.js` | yes | `7c2e6f2ca` | `7c2e6f2ca` |
| `netlify/functions/_shared/study-delivery/server-identifier-hardening.test.js` | yes | `c906ca626` | `c906ca626` |
| `netlify/functions/_shared/study-delivery/supabase-in-app.js` | yes | `cf970ed20` | `cf970ed20` |
| `netlify/functions/_shared/study-delivery/supabase-in-app.test.js` | yes | `f0c003144` | `f0c003144` |
| `netlify/functions/_shared/study-production/readiness.js` | **no** | `cd346407c` | `ecc86b4db` |
| `netlify/functions/_shared/study-production/readiness.test.js` | **no** | `6171a7ad3` | `b89c1c77a` |
| `netlify/functions/_shared/study-runtime/verified-academic-runtime.js` | **no** | `7ef6adf3c` | `451135deb` |
| `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js` | **no** | `89a36e3da` | `16973b985` |
| `netlify/functions/_shared/study-worker/credential.js` | yes | `3734e3061` | `3734e3061` |
| `netlify/functions/_shared/study-worker/credential.test.js` | yes | `c8747b3e9` | `c8747b3e9` |
| `netlify/functions/study-adult-review-scheduled-worker.js` | **no** | `e6b49637f` | `1d50b9ef5` |
| `netlify/functions/study-adult-review-scheduled-worker.test.js` | **no** | `9b8c13cca` | `f1a3d67eb` |
| `netlify/functions/study-adult-review-worker.js` | yes | `77e5ec887` | `77e5ec887` |
| `netlify/functions/study-production-readiness.js` | **no** | `453d4f525` | `0a842ab36` |
| `package.json` | **no** | `a77309300` | `eee343096` |
| `src/academy/adapters/adapters.test.ts` | yes | `3312fc53b` | `3312fc53b` |
| `src/academy/adapters/studyContextAdapter.ts` | yes | `cf5a301ef` | `cf5a301ef` |
| `src/study/composition/durableAcademicProductionPorts.test.ts` | yes | `0fe49ac48` | `0fe49ac48` |
| `src/study/contracts/persistence/ports.ts` | yes | `490576131` | `490576131` |
| `src/study/contracts/persistence/types.ts` | yes | `b53166a02` | `b53166a02` |
| `src/study/contracts/production/readiness.ts` | yes | `8f4a428e6` | `8f4a428e6` |
| `src/study/effectiveSettings.test.ts` | yes | `0184c73bf` | `0184c73bf` |
| `src/study/effectiveSettings.ts` | yes | `f0d0e7c46` | `f0d0e7c46` |
| `src/study/generated/studyDatabase.ts` | **no** | `15f4a3c1e` | `861280e4f` |
| `src/study/persistence/SupabaseStudyParentSettingsAdapter.test.ts` | yes | `77b8f01de` | `77b8f01de` |
| `src/study/persistence/SupabaseStudyParentSettingsAdapter.ts` | yes | `d98f57d2d` | `d98f57d2d` |
| `src/study/persistence/SupabaseStudyPersistenceAdapter.test.ts` | yes | `6b6ef7824` | `6b6ef7824` |
| `src/study/persistence/SupabaseStudyPersistenceAdapter.ts` | yes | `dadd3f138` | `dadd3f138` |
| `supabase/migrations/20260810150000_academy_study_curriculum_binding.sql` | yes | `0ab1da30b` | `0ab1da30b` |
| `supabase/migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql` | **no** | `710371814` | `036e64e73` |
| `supabase/migrations/20260810152100_academy_study_worker_operations_contract.sql` | **no** | `effc0ee00` | `7ae12206a` |
| `supabase/migrations/20260810159000_academy_study_worker_run_evidence.sql` | yes | `5d868f351` | `5d868f351` |
| `supabase/study-curriculum-binding.db.test.ts` | **no** | `6ea4c1968` | `bd56db3a9` |
| `supabase/study-effective-settings-v2.db.test.ts` | **no** | `8413533e6` | `da8c9471a` |
| `supabase/study-engine-adult-review.db.test.ts` | **no** | `4e4e5e17d` | `1cab94a8c` |
| `supabase/study-engine-in-app-receipt-timestamp.db.test.ts` | **no** | `c3fb16600` | `8b9222631` |
| `supabase/study-worker-run-evidence.db.test.ts` | **no** | `8753ffd20` | `982746114` |

## Cross-branch file-overlap hotspots

| Path | Branch count | Branches |
|---|---:|---|
| `docs/study-engine-final-production/migration-manifest.json` | 19 | `win/admin-14b-runtime`, `win/admin-9-aggregate-adoption-r2`, `win/admin-9-aggregate-adoption-r2-fresh`, `win/admin-costs-accounting-integration`, `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/provider-pricing-terms`, `win/study-bound-content-runtime`, `win/study-curriculum-binding`, `win/study-effective-settings-v2`, `win/study-learner-path-r4`, `win/study-production-core-r3`, `win/study-provider-cost-accounting`, `win/study-release-registry-bridge`, `win/study-session-semantics-v2`, `win/study-session-telemetry-outbox`, `win/study-worker-production-composition`, `win/study-worker-schedule` |
| `MIGRATIONS.md` | 18 | `win/admin-14b-runtime`, `win/admin-9-aggregate-adoption-r2`, `win/admin-9-aggregate-adoption-r2-fresh`, `win/admin-9-aggregate-r2`, `win/admin-costs-accounting-integration`, `win/admin-costs-v3-integration`, `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/provider-pricing-terms`, `win/study-bound-content-runtime`, `win/study-effective-settings-v2`, `win/study-learner-path-r4`, `win/study-production-core-r3`, `win/study-provider-cost-accounting`, `win/study-release-registry-bridge`, `win/study-session-telemetry-outbox`, `win/study-worker-schedule` |
| `netlify.toml` | 10 | `win/admin-costs-accounting-integration`, `win/admin-study-operations`, `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/provider-pricing-terms`, `win/study-bound-content-runtime`, `win/study-learner-path-r4`, `win/study-private-scheduled-worker`, `win/study-telemetry-invocation` |
| `package.json` | 10 | `win/admin-migration-reconciliation-planner`, `win/admin-preflight-r3`, `win/admin-unified-preflight-orchestrator`, `win/final-admin-delta-rc1`, `win/final-production-activation-runbook`, `win/final-rc-validation-harness`, `win/final-study-rc1`, `win/study-deployment-env-preflight`, `win/study-production-smoke-harness`, `win/study-telemetry-delivery-worker` |
| `netlify/functions/_shared/study-runtime/verified-academic-runtime.js` | 9 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-curriculum-binding`, `win/study-production-core-r3`, `win/study-production-mount-r5`, `win/study-production-smoke-harness`, `win/study-security-adversarial-r4`, `win/study-session-semantics-v2` |
| `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js` | 9 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-curriculum-binding`, `win/study-production-core-r3`, `win/study-production-smoke-harness`, `win/study-recovery-chaos-gate`, `win/study-release-registry-bridge`, `win/study-session-semantics-v2` |
| `src/study/generated/studyDatabase.ts` | 9 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/study-bound-content-runtime`, `win/study-curriculum-binding`, `win/study-effective-settings-v2`, `win/study-learner-path-r4`, `win/study-production-core-r3`, `win/study-session-semantics-v2`, `win/study-worker-schedule` |
| `netlify/functions/_shared/study-production/readiness.js` | 7 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/study-curriculum-binding`, `win/study-effective-settings-v2`, `win/study-production-core-r3`, `win/study-session-semantics-v2`, `win/study-worker-schedule` |
| `netlify/functions/_shared/study-production/readiness.test.js` | 7 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/study-curriculum-binding`, `win/study-effective-settings-v2`, `win/study-production-core-r3`, `win/study-session-semantics-v2`, `win/study-worker-schedule` |
| `netlify/functions/study-production-readiness.js` | 7 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/study-curriculum-binding`, `win/study-effective-settings-v2`, `win/study-production-core-r3`, `win/study-session-semantics-v2`, `win/study-worker-schedule` |
| `src/components/admin/AdminConsole.tsx` | 7 | `win/admin-costs-accounting-integration`, `win/admin-costs-browser-gate`, `win/admin-costs-v3-integration`, `win/admin-study-operations`, `win/admin-study-ops-browser-gate`, `win/final-admin-delta-rc1`, `win/provider-pricing-terms` |
| `supabase/study-curriculum-binding.db.test.ts` | 7 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/study-bound-content-runtime`, `win/study-curriculum-binding`, `win/study-learner-path-r4`, `win/study-production-core-r3`, `win/study-release-registry-bridge` |
| `netlify/functions/_shared/operational-telemetry-writer.js` | 6 | `win/admin-14b-runtime`, `win/admin-9-aggregate-adoption-r2`, `win/admin-9-aggregate-adoption-r2-fresh`, `win/final-study-rc1`, `win/study-session-telemetry-outbox`, `win/study-telemetry-invocation` |
| `netlify/functions/_shared/operational-telemetry-writer.test.js` | 6 | `win/admin-14b-runtime`, `win/admin-9-aggregate-adoption-r2`, `win/admin-9-aggregate-adoption-r2-fresh`, `win/final-study-rc1`, `win/study-session-telemetry-outbox`, `win/study-telemetry-invocation` |
| `netlify/functions/_shared/study-adult-review-operations/composition.js` | 6 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-private-scheduled-worker`, `win/study-worker-production-composition`, `win/study-worker-run-evidence` |
| `netlify/functions/_shared/study-adult-review-operations/composition.test.js` | 6 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-private-scheduled-worker`, `win/study-worker-production-composition`, `win/study-worker-run-evidence` |
| `netlify/functions/study-adult-review-worker.js` | 6 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-private-scheduled-worker`, `win/study-worker-production-composition`, `win/study-worker-run-evidence` |
| `src/components/admin/AdminConsole.test.tsx` | 6 | `win/admin-costs-accounting-integration`, `win/admin-costs-browser-gate`, `win/admin-costs-v3-integration`, `win/admin-study-operations`, `win/admin-study-ops-browser-gate`, `win/final-admin-delta-rc1` |
| `src/components/admin/AdminCostsDashboard.test.tsx` | 6 | `win/admin-14b-runtime`, `win/admin-costs-accounting-integration`, `win/admin-costs-browser-gate`, `win/admin-costs-v3-integration`, `win/final-admin-delta-rc1`, `win/provider-pricing-ui` |
| `src/components/admin/AdminCostsDashboard.tsx` | 6 | `win/admin-14b-runtime`, `win/admin-costs-accounting-integration`, `win/admin-costs-browser-gate`, `win/admin-costs-v3-integration`, `win/final-admin-delta-rc1`, `win/provider-pricing-ui` |
| `docs/academy-ai-cost-accounting.md` | 5 | `win/admin-costs-accounting-integration`, `win/admin-costs-v3-integration`, `win/final-admin-delta-rc1`, `win/provider-pricing-terms`, `win/study-provider-cost-accounting` |
| `docs/admin-r1-wave2-integration.md` | 5 | `win/admin-14b-runtime`, `win/admin-9-aggregate-adoption-r2`, `win/admin-9-aggregate-adoption-r2-fresh`, `win/admin-costs-accounting-integration`, `win/final-admin-delta-rc1` |
| `docs/admin-system-health.md` | 5 | `win/admin-14b-runtime`, `win/admin-9-aggregate-adoption-r2`, `win/admin-9-aggregate-adoption-r2-fresh`, `win/admin-9-aggregate-r2`, `win/final-admin-delta-rc1` |
| `netlify/functions/_shared/admin-operational-aggregate-reader.js` | 5 | `win/admin-14b-runtime`, `win/admin-9-aggregate-adoption-r2`, `win/admin-9-aggregate-adoption-r2-fresh`, `win/admin-9-aggregate-r2`, `win/final-admin-delta-rc1` |
| `netlify/functions/_shared/admin-operational-aggregate-reader.test.js` | 5 | `win/admin-14b-runtime`, `win/admin-9-aggregate-adoption-r2`, `win/admin-9-aggregate-adoption-r2-fresh`, `win/admin-9-aggregate-r2`, `win/final-admin-delta-rc1` |
| `netlify/functions/_shared/study-adult-review-operations/entrypoint-result.js` | 5 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-private-scheduled-worker`, `win/study-worker-run-evidence` |
| `netlify/functions/_shared/study-adult-review-operations/worker.test.js` | 5 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition`, `win/study-worker-run-evidence` |
| `netlify/functions/_shared/study-worker/credential.js` | 5 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-private-scheduled-worker`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-worker/credential.test.js` | 5 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-private-scheduled-worker`, `win/study-worker-production-composition` |
| `netlify/functions/study-adult-review-scheduled-worker.js` | 5 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-private-scheduled-worker`, `win/study-worker-run-evidence` |
| `netlify/functions/study-adult-review-scheduled-worker.test.js` | 5 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-private-scheduled-worker`, `win/study-worker-run-evidence` |
| `src/admin/costsModel.test.ts` | 5 | `win/admin-14b-runtime`, `win/admin-costs-accounting-integration`, `win/admin-costs-v3-integration`, `win/final-admin-delta-rc1`, `win/study-provider-cost-accounting` |
| `src/admin/costsModel.ts` | 5 | `win/admin-14b-runtime`, `win/admin-costs-accounting-integration`, `win/admin-costs-v3-integration`, `win/final-admin-delta-rc1`, `win/study-provider-cost-accounting` |
| `src/admin/index.ts` | 5 | `win/admin-costs-accounting-integration`, `win/admin-study-operations`, `win/final-admin-delta-rc1`, `win/provider-pricing-terms`, `win/provider-pricing-ui` |
| `src/components/admin/admin-console.css` | 5 | `win/admin-costs-accounting-integration`, `win/admin-costs-browser-gate`, `win/admin-study-ops-browser-gate`, `win/final-admin-delta-rc1`, `win/provider-pricing-ui` |
| `src/components/admin/AdminConsoleRoute.test.tsx` | 5 | `win/admin-costs-accounting-integration`, `win/admin-study-operations`, `win/final-admin-delta-rc1`, `win/provider-pricing-terms`, `win/provider-pricing-ui` |
| `src/components/admin/AdminConsoleRoute.tsx` | 5 | `win/admin-costs-accounting-integration`, `win/admin-study-operations`, `win/final-admin-delta-rc1`, `win/provider-pricing-terms`, `win/provider-pricing-ui` |
| `src/study/contracts/persistence/ports.ts` | 5 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/study-curriculum-binding`, `win/study-effective-settings-v2`, `win/study-worker-schedule` |
| `supabase/academy-operational-events.db.test.ts` | 5 | `win/admin-14b-runtime`, `win/admin-9-aggregate-adoption-r2`, `win/admin-9-aggregate-adoption-r2-fresh`, `win/admin-9-aggregate-r2`, `win/final-admin-delta-rc1` |
| `docs/admin-console/cost-accounting.md` | 4 | `win/admin-costs-accounting-integration`, `win/admin-costs-v3-integration`, `win/final-admin-delta-rc1`, `win/provider-pricing-terms` |
| `docs/admin-production-preflight/README.md` | 4 | `win/admin-migration-reconciliation-planner`, `win/admin-preflight-r3`, `win/admin-unified-preflight-orchestrator`, `win/final-admin-delta-rc1` |
| `docs/study-effective-settings-v2.md` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/study-effective-settings-v2`, `win/study-worker-schedule` |
| `docs/study-engine-production-reconciliation/12-production-readiness-matrix.md` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/study-effective-settings-v2`, `win/study-worker-schedule` |
| `docs/study-session-telemetry-outbox.md` | 4 | `win/final-study-rc1`, `win/study-session-telemetry-outbox`, `win/study-telemetry-delivery-worker`, `win/study-telemetry-invocation` |
| `netlify/functions/_shared/admin-cost-projection.js` | 4 | `win/admin-costs-accounting-integration`, `win/admin-costs-v3-integration`, `win/final-admin-delta-rc1`, `win/study-provider-cost-accounting` |
| `netlify/functions/_shared/admin-cost-projection.test.js` | 4 | `win/admin-costs-accounting-integration`, `win/admin-costs-v3-integration`, `win/final-admin-delta-rc1`, `win/study-provider-cost-accounting` |
| `netlify/functions/_shared/study-adult-review-operations/run-evidence.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-run-evidence` |
| `netlify/functions/_shared/study-adult-review-operations/run-evidence.test.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-run-evidence` |
| `netlify/functions/_shared/study-adult-review-operations/supabase-operations.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-adult-review-operations/supabase-operations.test.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-adult-review-operations/worker.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-adult-review/delivery.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-adult-review/guardian-notifications.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-adult-review/memory-store.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-adult-review/outbox-worker.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-delivery/durable-identifier-contract.test.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-delivery/external-provider.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-delivery/external-provider.test.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-delivery/in-app-provider.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |
| `netlify/functions/_shared/study-delivery/in-app-provider.test.js` | 4 | `win/admin-study-ops-evidence-r2`, `win/final-admin-delta-rc1`, `win/final-study-rc1`, `win/study-worker-production-composition` |

The JSON contains all 237 overlapping paths; this table shows the first 60 by branch count and path.

## Migration-order hotspots

No duplicate migration version prefixes were found across the two functional source trees.

### Same logical migration under multiple versions

- `academy_study_effective_settings_v2`: `supabase/migrations/20260810120000_academy_study_effective_settings_v2.sql`, `supabase/migrations/20260810120200_academy_study_effective_settings_v2.sql`

### Same migration path, different blobs

- `supabase/migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql`: `win/final-admin-delta-rc1`=`710371814`, `win/final-study-rc1`=`036e64e73`
- `supabase/migrations/20260810152100_academy_study_worker_operations_contract.sql`: `win/final-admin-delta-rc1`=`effc0ee00`, `win/final-study-rc1`=`7ae12206a`

### Explicit dependency checks

| Migration | Dependency | Present in union? | Sort relation |
|---|---|---|---|
| `20260809120000_academy_operational_telemetry_foundation` | `20260808123000_academy_admin_safety_operations` | yes | before |
| `20260809121000_academy_provider_usage_cost_aggregate` | `20260809120000_academy_operational_telemetry_foundation` | yes | before |
| `20260810152000_academy_study_in_app_receipt_timestamp` | `20260801170000_academy_study_adult_review_operations` | yes | before |
| `20260810152000_academy_study_in_app_receipt_timestamp` | `20260801190000_academy_study_final_production_reconciliation` | yes | before |
| `20260810152000_academy_study_in_app_receipt_timestamp` | `20260810120200_academy_study_effective_settings_v2` | yes | before |
| `20260810152000_academy_study_in_app_receipt_timestamp` | `20260810150000_academy_study_curriculum_binding` | yes | before |
| `20260810152000_academy_study_in_app_receipt_timestamp` | `20260810120000_academy_study_effective_settings_v2` | yes | before |
| `20260810152100_academy_study_worker_operations_contract` | `20260801010000_academy_study_engine_storage` | yes | before |
| `20260810152100_academy_study_worker_operations_contract` | `20260801011000_academy_study_engine_authorization` | yes | before |
| `20260810152100_academy_study_worker_operations_contract` | `20260801012000_academy_study_engine_production_reconciliation` | yes | before |
| `20260810152100_academy_study_worker_operations_contract` | `20260801160000_academy_study_verified_identity` | yes | before |
| `20260810152100_academy_study_worker_operations_contract` | `20260801170000_academy_study_adult_review_operations` | yes | before |
| `20260810152100_academy_study_worker_operations_contract` | `20260801190000_academy_study_final_production_reconciliation` | yes | before |
| `20260810152100_academy_study_worker_operations_contract` | `20260810120200_academy_study_effective_settings_v2` | yes | before |
| `20260810152100_academy_study_worker_operations_contract` | `20260810150000_academy_study_curriculum_binding` | yes | before |
| `20260810152100_academy_study_worker_operations_contract` | `20260810152000_academy_study_in_app_receipt_timestamp` | yes | before |
| `20260810152100_academy_study_worker_operations_contract` | `20260810120000_academy_study_effective_settings_v2` | yes | before |
| `20260810153000_academy_study_release_registry_bridge` | `20260810150000_academy_study_curriculum_binding` | yes | before |
| `20260810154000_academy_study_bound_content_authority` | `20260810150000_academy_study_curriculum_binding` | yes | before |
| `20260810154000_academy_study_bound_content_authority` | `20260810153000_academy_study_release_registry_bridge` | yes | before |

Any duplicate version, duplicate logical name, or same-path divergent blob above is a migration-order hotspot. Final integration must retain each logical migration exactly once under the reconciled ordering and update manifest/receipt/dependency references consistently. The JSON records the complete explicit migration-name dependency and blob evidence.

## Per-branch details

<details><summary><code>win/admin-14b-runtime</code> — e43a13200</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-14b-runtime`; state: **clean**; upstream: —.
- HEAD: `e43a1320021fbe4e004af74c26a563532990545c` — admin-14b: enforce effective runtime configuration
- Comparison base: `8751ead4b1db937781c2d60ebb39f773fb716b48` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-terminal-descendant**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (5; globally exclusive to this `win/*` ref: 0):
  - `d55c5dc6c5d9109952ba6fdc3e9a75a412e5b69a` tel-foundation: add production telemetry writer and scalable aggregates
  - `e9febc03b752d67545a6afa649107d075196d3e6` tel-ai-gateways: instrument production provider and gateway outcomes
  - `b948b3fd6552221eeb3883c8e7cc924129ad616a` tts: introduce server-owned logical voice catalog
  - `cf29ff6b3e851f42eb257a108f1bc473599c0ff1` [merge] Merge runtime gateway and logical voice foundations for ADMIN-14B
  - `e43a1320021fbe4e004af74c26a563532990545c` admin-14b: enforce effective runtime configuration
- Changed paths (61):
  - `M` `MIGRATIONS.md`
  - `M` `docs/admin-configuration-core.md`
  - `A` `docs/admin-configuration-runtime.md`
  - `M` `docs/admin-operational-telemetry.md`
  - `M` `docs/admin-r1-wave2-integration.md`
  - `M` `docs/admin-system-health.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `A` `docs/tel-ai-gateways.md`
  - `A` `docs/tts-logical-voice-catalog.md`
  - `M` `netlify/functions/_shared/admin-configuration-source.js`
  - `M` `netlify/functions/_shared/admin-configuration-source.test.js`
  - `A` `netlify/functions/_shared/admin-operational-aggregate-reader.js`
  - `A` `netlify/functions/_shared/admin-operational-aggregate-reader.test.js`
  - `M` `netlify/functions/_shared/anthropic-policy.js`
  - `A` `netlify/functions/_shared/effective-configuration.js`
  - `A` `netlify/functions/_shared/effective-configuration.test.js`
  - `M` `netlify/functions/_shared/gateway-access.js`
  - `A` `netlify/functions/_shared/gateway-telemetry.js`
  - `A` `netlify/functions/_shared/operational-telemetry-writer.js`
  - `A` `netlify/functions/_shared/operational-telemetry-writer.test.js`
  - `A` `netlify/functions/_shared/tts-catalog.js`
  - `M` `netlify/functions/_shared/tts-policy.js`
  - `M` `netlify/functions/admin-configuration-runtime-boundary.test.js`
  - `M` `netlify/functions/admin-costs.js`
  - `M` `netlify/functions/admin-costs.test.js`
  - `M` `netlify/functions/admin-engine-performance.js`
  - `M` `netlify/functions/admin-engine-performance.test.js`
  - `M` `netlify/functions/anthropic.js`
  - `M` `netlify/functions/tts.js`
  - `M` `src/admin/configurationModel.test.ts`
  - `M` `src/admin/configurationModel.ts`
  - `M` `src/admin/costsModel.test.ts`
  - `M` `src/admin/costsModel.ts`
  - `M` `src/admin/costsTestFixtures.ts`
  - `M` `src/admin/enginePerformanceModel.ts`
  - `M` `src/components/TutorPanel.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.test.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.tsx`
  - `M` `src/components/admin/EnginePerformanceDashboard.tsx`
  - `M` `src/deploy.test.ts`
  - `M` `src/study/production/providerBundleSecurity.test.ts`
  - `A` `src/sync/profileVoiceContract.test.ts`
  - `M` `src/sync/provenance.ts`
  - `M` `src/tutor/tutorState.ts`
  - `M` `src/tutor/voice.test.ts`
  - `M` `src/tutor/voice.ts`
  - `A` `src/tutor/voiceCatalog.test.ts`
  - `A` `src/tutor/voiceCatalog.ts`
  - `A` `src/tutor/voicePrivacy.test.ts`
  - `M` `src/types.ts`
  - `M` `supabase/academy-cas.db.test.ts`
  - `M` `supabase/academy-operational-events.db.test.ts`
  - `M` `supabase/academy-profile-contract.fixtures.ts`
  - `M` `supabase/admin-config.db.test.ts`
  - `A` `supabase/migrations/20260809120000_academy_operational_telemetry_foundation.sql`
  - `A` `supabase/migrations/20260809150000_academy_logical_voice_profile_contract.sql`
  - `A` `supabase/migrations/20260810140000_academy_admin_configuration_runtime_enforcement.sql`
  - `M` `tests/netlify-functions/anthropic.test.js`
  - `A` `tests/netlify-functions/gateway-operational-telemetry.test.js`
  - `A` `tests/netlify-functions/tts-catalog.test.js`
  - `M` `tests/netlify-functions/tts.test.js`
- Migration files (3):
  - `A` `supabase/migrations/20260809120000_academy_operational_telemetry_foundation.sql`; explicit migration dependencies: `20260808123000_academy_admin_safety_operations`.
  - `A` `supabase/migrations/20260809150000_academy_logical_voice_profile_contract.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810140000_academy_admin_configuration_runtime_enforcement.sql`; explicit migration dependencies: none explicitly named.
- Test additions (8): `netlify/functions/_shared/admin-operational-aggregate-reader.test.js`, `netlify/functions/_shared/effective-configuration.test.js`, `netlify/functions/_shared/operational-telemetry-writer.test.js`, `src/sync/profileVoiceContract.test.ts`, `src/tutor/voiceCatalog.test.ts`, `src/tutor/voicePrivacy.test.ts`, `tests/netlify-functions/gateway-operational-telemetry.test.js`, `tests/netlify-functions/tts-catalog.test.js`.
- Documentation additions (3): `docs/admin-configuration-runtime.md`, `docs/tel-ai-gateways.md`, `docs/tts-logical-voice-catalog.md`.

</details>

<details><summary><code>win/admin-9-aggregate-adoption-r2</code> — d55c5dc6c</summary>

- Worktree: —; state: **not-registered**; upstream: —.
- HEAD: `d55c5dc6c5d9109952ba6fdc3e9a75a412e5b69a` — tel-foundation: add production telemetry writer and scalable aggregates
- Comparison base: `d65d1511dd602db586a204bb7ccb2800fd7a89e2` (branch was registered at its current tip; using first parent).
- Classification: **superseded-by-terminal-descendant**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `d55c5dc6c5d9109952ba6fdc3e9a75a412e5b69a` tel-foundation: add production telemetry writer and scalable aggregates
- Changed paths (15):
  - `M` `MIGRATIONS.md`
  - `M` `docs/admin-operational-telemetry.md`
  - `M` `docs/admin-r1-wave2-integration.md`
  - `M` `docs/admin-system-health.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `A` `netlify/functions/_shared/admin-operational-aggregate-reader.js`
  - `A` `netlify/functions/_shared/admin-operational-aggregate-reader.test.js`
  - `A` `netlify/functions/_shared/operational-telemetry-writer.js`
  - `A` `netlify/functions/_shared/operational-telemetry-writer.test.js`
  - `M` `netlify/functions/admin-engine-performance.js`
  - `M` `netlify/functions/admin-engine-performance.test.js`
  - `M` `src/admin/enginePerformanceModel.ts`
  - `M` `src/components/admin/EnginePerformanceDashboard.tsx`
  - `M` `supabase/academy-operational-events.db.test.ts`
  - `A` `supabase/migrations/20260809120000_academy_operational_telemetry_foundation.sql`
- Migration files (1):
  - `A` `supabase/migrations/20260809120000_academy_operational_telemetry_foundation.sql`; explicit migration dependencies: `20260808123000_academy_admin_safety_operations`.
- Test additions (2): `netlify/functions/_shared/admin-operational-aggregate-reader.test.js`, `netlify/functions/_shared/operational-telemetry-writer.test.js`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/admin-9-aggregate-adoption-r2-fresh</code> — d55c5dc6c</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-9-aggregate-r2-fresh`; state: **clean**; upstream: —.
- HEAD: `d55c5dc6c5d9109952ba6fdc3e9a75a412e5b69a` — tel-foundation: add production telemetry writer and scalable aggregates
- Comparison base: `d65d1511dd602db586a204bb7ccb2800fd7a89e2` (branch was registered at its current tip; using first parent).
- Classification: **superseded-by-terminal-descendant**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `d55c5dc6c5d9109952ba6fdc3e9a75a412e5b69a` tel-foundation: add production telemetry writer and scalable aggregates
- Changed paths (15):
  - `M` `MIGRATIONS.md`
  - `M` `docs/admin-operational-telemetry.md`
  - `M` `docs/admin-r1-wave2-integration.md`
  - `M` `docs/admin-system-health.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `A` `netlify/functions/_shared/admin-operational-aggregate-reader.js`
  - `A` `netlify/functions/_shared/admin-operational-aggregate-reader.test.js`
  - `A` `netlify/functions/_shared/operational-telemetry-writer.js`
  - `A` `netlify/functions/_shared/operational-telemetry-writer.test.js`
  - `M` `netlify/functions/admin-engine-performance.js`
  - `M` `netlify/functions/admin-engine-performance.test.js`
  - `M` `src/admin/enginePerformanceModel.ts`
  - `M` `src/components/admin/EnginePerformanceDashboard.tsx`
  - `M` `supabase/academy-operational-events.db.test.ts`
  - `A` `supabase/migrations/20260809120000_academy_operational_telemetry_foundation.sql`
- Migration files (1):
  - `A` `supabase/migrations/20260809120000_academy_operational_telemetry_foundation.sql`; explicit migration dependencies: `20260808123000_academy_admin_safety_operations`.
- Test additions (2): `netlify/functions/_shared/admin-operational-aggregate-reader.test.js`, `netlify/functions/_shared/operational-telemetry-writer.test.js`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/admin-9-aggregate-r2</code> — c72f99182</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-9-aggregate-r2`; state: **clean**; upstream: —.
- HEAD: `c72f9918244ad525182f2414d3afd281c51c8b07` — admin: adopt scalable aggregates for system health
- Comparison base: `2d8c911d432f5d2eafe6d18ec6d01d65fe24c5be` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (2; globally exclusive to this `win/*` ref: 2):
  - `f5492e2e21ae51fad5e1979e555fa1e247c983a5` admin-9: harden scalable system health aggregates
  - `c72f9918244ad525182f2414d3afd281c51c8b07` admin: adopt scalable aggregates for system health
- Changed paths (16):
  - `M` `MIGRATIONS.md`
  - `M` `docs/admin-system-health.md`
  - `M` `netlify/functions/_shared/admin-health-source.js`
  - `M` `netlify/functions/_shared/admin-health-source.test.js`
  - `M` `netlify/functions/_shared/admin-operational-aggregate-reader.js`
  - `M` `netlify/functions/_shared/admin-operational-aggregate-reader.test.js`
  - `M` `netlify/functions/admin-health.js`
  - `M` `netlify/functions/admin-health.test.js`
  - `M` `src/admin/systemHealth.test.ts`
  - `M` `src/admin/systemHealth.ts`
  - `M` `src/admin/systemHealthClient.test.ts`
  - `M` `src/admin/systemHealthClient.ts`
  - `M` `src/components/admin/SystemHealthDashboard.test.tsx`
  - `M` `src/components/admin/SystemHealthDashboard.tsx`
  - `M` `supabase/academy-operational-events.db.test.ts`
  - `M` `supabase/migrations/20260809120000_academy_operational_telemetry_foundation.sql`
- Migration files (1):
  - `M` `supabase/migrations/20260809120000_academy_operational_telemetry_foundation.sql`; explicit migration dependencies: `20260808123000_academy_admin_safety_operations`.
- Test additions (0): none.
- Documentation additions (0): none.

</details>

<details><summary><code>win/admin-costs-accounting-integration</code> — 86003e57c</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-costs-accounting-integration`; state: **clean**; upstream: —.
- HEAD: `86003e57cfea8bfc83c3e1d41d3abde26d16abf8` — admin: integrate provider pricing and cost accounting
- Comparison base: `e43a1320021fbe4e004af74c26a563532990545c` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (6; globally exclusive to this `win/*` ref: 0):
  - `7c636de82a48d47772835e85f2a5ccc1ce6c5880` admin-costs: add scalable exact cost aggregates
  - `3954074925e5aad62ea825b0f8f4c2f37ab5cea0` admin-costs: complete v3 consumer integration
  - `c633634a2e57355fd2c31ce56462a4893236efdc` admin-costs: add effective-dated provider pricing terms
  - `55f965c9992920516ff96915bbd9893c2b6104a8` admin: add provider pricing management UI
  - `72ab107e344bdfe8aab3469c29cb634e8d4d2652` study: admit safety provider cost accounting
  - `86003e57cfea8bfc83c3e1d41d3abde26d16abf8` admin: integrate provider pricing and cost accounting
- Changed paths (50):
  - `M` `MIGRATIONS.md`
  - `M` `docs/academy-ai-cost-accounting.md`
  - `M` `docs/admin-audit-foundation.md`
  - `M` `docs/admin-console/README.md`
  - `M` `docs/admin-console/cost-accounting.md`
  - `A` `docs/admin-costs-contract-v3.md`
  - `A` `docs/admin-provider-pricing-terms.md`
  - `M` `docs/admin-r1-wave2-integration.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `A` `docs/study-provider-cost-accounting.md`
  - `M` `netlify.toml`
  - `A` `netlify/functions/_shared/admin-cost-aggregate.js`
  - `A` `netlify/functions/_shared/admin-cost-aggregate.test.js`
  - `M` `netlify/functions/_shared/admin-cost-projection.js`
  - `M` `netlify/functions/_shared/admin-cost-projection.test.js`
  - `A` `netlify/functions/_shared/admin-provider-pricing-source.js`
  - `A` `netlify/functions/_shared/admin-provider-pricing-source.test.js`
  - `M` `netlify/functions/_shared/gateway-access.js`
  - `M` `netlify/functions/admin-costs.test.js`
  - `A` `netlify/functions/admin-provider-pricing-terms.js`
  - `A` `netlify/functions/admin-provider-pricing-terms.test.js`
  - `M` `src/admin/costsHttpSource.test.ts`
  - `M` `src/admin/costsHttpSource.ts`
  - `M` `src/admin/costsModel.test.ts`
  - `M` `src/admin/costsModel.ts`
  - `M` `src/admin/costsTestFixtures.ts`
  - `M` `src/admin/index.ts`
  - `M` `src/admin/overviewAdapter.ts`
  - `A` `src/admin/providerPricingHttpSource.test.ts`
  - `A` `src/admin/providerPricingHttpSource.ts`
  - `A` `src/admin/providerPricingModel.test.ts`
  - `A` `src/admin/providerPricingModel.ts`
  - `M` `src/components/admin/AdminConsole.test.tsx`
  - `M` `src/components/admin/AdminConsole.tsx`
  - `M` `src/components/admin/AdminConsoleRoute.test.tsx`
  - `M` `src/components/admin/AdminConsoleRoute.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.test.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.tsx`
  - `A` `src/components/admin/AdminProviderPricingDashboard.test.tsx`
  - `A` `src/components/admin/AdminProviderPricingDashboard.tsx`
  - `M` `src/components/admin/admin-console.css`
  - `M` `src/components/admin/admin-costs.css`
  - `A` `src/components/admin/admin-provider-pricing.css`
  - `A` `supabase/academy-provider-pricing-terms.db.test.ts`
  - `M` `supabase/academy-provider-usage-cost-ledger.db.test.ts`
  - `A` `supabase/academy-study-provider-cost-accounting.db.test.ts`
  - `A` `supabase/migrations/20260809121000_academy_provider_usage_cost_aggregate.sql`
  - `A` `supabase/migrations/20260810120000_academy_provider_pricing_terms.sql`
  - `A` `supabase/migrations/20260810141000_academy_study_provider_cost_accounting.sql`
  - `M` `tests/netlify-functions/gateway-access.test.js`
- Migration files (3):
  - `A` `supabase/migrations/20260809121000_academy_provider_usage_cost_aggregate.sql`; explicit migration dependencies: `20260809120000_academy_operational_telemetry_foundation`.
  - `A` `supabase/migrations/20260810120000_academy_provider_pricing_terms.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810141000_academy_study_provider_cost_accounting.sql`; explicit migration dependencies: none explicitly named.
- Test additions (8): `netlify/functions/_shared/admin-cost-aggregate.test.js`, `netlify/functions/_shared/admin-provider-pricing-source.test.js`, `netlify/functions/admin-provider-pricing-terms.test.js`, `src/admin/providerPricingHttpSource.test.ts`, `src/admin/providerPricingModel.test.ts`, `src/components/admin/AdminProviderPricingDashboard.test.tsx`, `supabase/academy-provider-pricing-terms.db.test.ts`, `supabase/academy-study-provider-cost-accounting.db.test.ts`.
- Documentation additions (3): `docs/admin-costs-contract-v3.md`, `docs/admin-provider-pricing-terms.md`, `docs/study-provider-cost-accounting.md`.

</details>

<details><summary><code>win/admin-costs-browser-gate</code> — de3d81fed</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-costs-browser-gate`; state: **clean**; upstream: —.
- HEAD: `de3d81fed1817144fcd6fab4ed50ae821edeb5e2` — fix(admin): harden Costs and Provider Pricing browser UX
- Comparison base: `86003e57cfea8bfc83c3e1d41d3abde26d16abf8` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `de3d81fed1817144fcd6fab4ed50ae821edeb5e2` fix(admin): harden Costs and Provider Pricing browser UX
- Changed paths (10):
  - `M` `src/admin/providerPricingModel.test.ts`
  - `M` `src/components/admin/AdminConsole.test.tsx`
  - `M` `src/components/admin/AdminConsole.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.test.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.tsx`
  - `M` `src/components/admin/AdminProviderPricingDashboard.test.tsx`
  - `M` `src/components/admin/AdminProviderPricingDashboard.tsx`
  - `M` `src/components/admin/admin-console.css`
  - `M` `src/components/admin/admin-costs.css`
  - `M` `src/components/admin/admin-provider-pricing.css`
- Migration files (0):
  - None.
- Test additions (0): none.
- Documentation additions (0): none.

</details>

<details><summary><code>win/admin-costs-v3-integration</code> — 782c3ac01</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-costs-v3-integration`; state: **clean**; upstream: —.
- HEAD: `782c3ac01c0df899dbf07da9cc981512e0541f37` — admin-costs: complete v3 consumer integration
- Comparison base: `d7f5e84b373950e4334c9d182711c3375d539ed6` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `782c3ac01c0df899dbf07da9cc981512e0541f37` admin-costs: complete v3 consumer integration
- Changed paths (16):
  - `M` `MIGRATIONS.md`
  - `M` `docs/academy-ai-cost-accounting.md`
  - `M` `docs/admin-console/cost-accounting.md`
  - `D` `docs/admin-costs-aggregate-v2.md`
  - `A` `docs/admin-costs-contract-v3.md`
  - `M` `netlify/functions/_shared/admin-cost-projection.js`
  - `M` `netlify/functions/_shared/admin-cost-projection.test.js`
  - `M` `src/admin/costsHttpSource.test.ts`
  - `M` `src/admin/costsHttpSource.ts`
  - `M` `src/admin/costsModel.test.ts`
  - `M` `src/admin/costsModel.ts`
  - `M` `src/admin/overviewAdapter.ts`
  - `M` `src/components/admin/AdminConsole.test.tsx`
  - `M` `src/components/admin/AdminConsole.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.test.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.tsx`
- Migration files (0):
  - None.
- Test additions (0): none.
- Documentation additions (1): `docs/admin-costs-contract-v3.md`.

</details>

<details><summary><code>win/admin-migration-reconciliation-planner</code> — 666bf2608</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-migration-reconciliation-planner`; state: **clean**; upstream: —.
- HEAD: `666bf260843f67a4d6c959a0d4081ccf656cb55a` — admin: add migration reconciliation planner
- Comparison base: `40abc78b0f4482fecf612ad0b6f5280cc2a96607` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `666bf260843f67a4d6c959a0d4081ccf656cb55a` admin: add migration reconciliation planner
- Changed paths (17):
  - `M` `docs/admin-production-preflight/README.md`
  - `A` `docs/admin-production-preflight/migration-reconciliation-planner.md`
  - `M` `package.json`
  - `M` `scripts/admin-production-preflight.mjs`
  - `M` `scripts/admin-production-preflight.test.ts`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/dependency-inversion-proposal.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migration-manifest.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_curriculum_draft_authoring.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_provider_attempt_journal.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_provider_pricing_terms.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_study_effective_settings_v2.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/references/migration-identity.md`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/reused-destination-proposal.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/safety.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/valid-proposal.json`
  - `A` `scripts/migration-reconciliation-planner.mjs`
  - `A` `scripts/migration-reconciliation-planner.test.ts`
- Migration files (0):
  - None.
- Test additions (1): `scripts/migration-reconciliation-planner.test.ts`.
- Documentation additions (1): `docs/admin-production-preflight/migration-reconciliation-planner.md`.

</details>

<details><summary><code>win/admin-preflight-r3</code> — 40abc78b0</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-preflight-r3`; state: **clean**; upstream: —.
- HEAD: `40abc78b0f4482fecf612ad0b6f5280cc2a96607` — admin: strengthen production activation preflight
- Comparison base: `e43a1320021fbe4e004af74c26a563532990545c` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (2; globally exclusive to this `win/*` ref: 0):
  - `353e5448914ab2494e3e58449997e9ee2a284690` preflight-r2: reconcile historical migration contract
  - `40abc78b0f4482fecf612ad0b6f5280cc2a96607` admin: strengthen production activation preflight
- Changed paths (9):
  - `A` `docs/admin-production-preflight/README.md`
  - `A` `docs/admin-production-preflight/current-local-evidence.json`
  - `A` `docs/admin-production-preflight/deployment-contract.json`
  - `M` `package.json`
  - `A` `scripts/admin-production-preflight.mjs`
  - `A` `scripts/admin-production-preflight.test.ts`
  - `M` `scripts/study-migration-preflight.mjs`
  - `M` `scripts/study-migration-preflight.test.ts`
  - `M` `vite.config.ts`
- Migration files (0):
  - None.
- Test additions (1): `scripts/admin-production-preflight.test.ts`.
- Documentation additions (3): `docs/admin-production-preflight/README.md`, `docs/admin-production-preflight/current-local-evidence.json`, `docs/admin-production-preflight/deployment-contract.json`.

</details>

<details><summary><code>win/admin-study-operations</code> — 286ce7507</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-study-operations`; state: **clean**; upstream: —.
- HEAD: `286ce7507336f3e963b5126ed15c087843b83248` — admin: add Study operations dashboard
- Comparison base: `e43a1320021fbe4e004af74c26a563532990545c` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `286ce7507336f3e963b5126ed15c087843b83248` admin: add Study operations dashboard
- Changed paths (18):
  - `M` `netlify.toml`
  - `A` `netlify/functions/_shared/admin-study-operations-source.js`
  - `A` `netlify/functions/_shared/admin-study-operations-source.test.js`
  - `A` `netlify/functions/admin-study-operations.js`
  - `A` `netlify/functions/admin-study-operations.test.js`
  - `M` `src/admin/index.ts`
  - `M` `src/admin/overviewModel.ts`
  - `A` `src/admin/studyOperationsHttpSource.test.ts`
  - `A` `src/admin/studyOperationsHttpSource.ts`
  - `A` `src/admin/studyOperationsModel.test.ts`
  - `A` `src/admin/studyOperationsModel.ts`
  - `M` `src/components/admin/AdminConsole.test.tsx`
  - `M` `src/components/admin/AdminConsole.tsx`
  - `M` `src/components/admin/AdminConsoleRoute.test.tsx`
  - `M` `src/components/admin/AdminConsoleRoute.tsx`
  - `A` `src/components/admin/AdminStudyOperations.test.tsx`
  - `A` `src/components/admin/AdminStudyOperations.tsx`
  - `A` `src/components/admin/admin-study-operations.css`
- Migration files (0):
  - None.
- Test additions (5): `netlify/functions/_shared/admin-study-operations-source.test.js`, `netlify/functions/admin-study-operations.test.js`, `src/admin/studyOperationsHttpSource.test.ts`, `src/admin/studyOperationsModel.test.ts`, `src/components/admin/AdminStudyOperations.test.tsx`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/admin-study-ops-browser-gate</code> — efbf2d796</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-study-ops-browser-gate`; state: **clean**; upstream: —.
- HEAD: `efbf2d796b95315a6152c3415d4de8aac3a33672` — fix(admin): harden Study Operations browser UX
- Comparison base: `286ce7507336f3e963b5126ed15c087843b83248` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `efbf2d796b95315a6152c3415d4de8aac3a33672` fix(admin): harden Study Operations browser UX
- Changed paths (6):
  - `M` `src/components/admin/AdminConsole.test.tsx`
  - `M` `src/components/admin/AdminConsole.tsx`
  - `M` `src/components/admin/AdminStudyOperations.test.tsx`
  - `M` `src/components/admin/AdminStudyOperations.tsx`
  - `M` `src/components/admin/admin-console.css`
  - `M` `src/components/admin/admin-study-operations.css`
- Migration files (0):
  - None.
- Test additions (0): none.
- Documentation additions (0): none.

</details>

<details><summary><code>win/admin-study-ops-evidence-r2</code> — 7e9d0c616</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-study-ops-evidence-r2`; state: **clean**; upstream: —.
- HEAD: `7e9d0c6166c022ad3b5a45f12a4365981ab7f5fd` — admin: connect Study Operations to worker run evidence
- Comparison base: `efbf2d796b95315a6152c3415d4de8aac3a33672` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (6; globally exclusive to this `win/*` ref: 6):
  - `5617dc1ddc46a0aea9dfd633b082bff29964db5f` study: compose production adult review worker
  - `73f8a587df1e2cd4feeecb7373fba260450fa22d` study: add private scheduled adult review worker
  - `edf6d05b0882dd19f5bd52a98cdbaae1b87fe51e` study: persist adult review worker run evidence
  - `d51177e84df9a0689d82d5c1f1754d7fe21492e6` study: implement effective settings v2
  - `7f703a2f18ec4f6b36a97de11a9f33aa51116940` study: bind sessions to immutable curriculum releases
  - `7e9d0c6166c022ad3b5a45f12a4365981ab7f5fd` admin: connect Study Operations to worker run evidence
- Changed paths (74):
  - `M` `MIGRATIONS.md`
  - `A` `docs/study-effective-settings-v2.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `M` `docs/study-engine-production-reconciliation/12-production-readiness-matrix.md`
  - `M` `netlify.toml`
  - `M` `netlify/functions/_shared/admin-study-operations-source.js`
  - `M` `netlify/functions/_shared/admin-study-operations-source.test.js`
  - `A` `netlify/functions/_shared/admin-study-worker-evidence-source.js`
  - `A` `netlify/functions/_shared/admin-study-worker-evidence-source.test.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/composition.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/composition.test.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/entrypoint-result.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/run-evidence.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/run-evidence.test.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/schedule.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/supabase-operations.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/supabase-operations.test.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/worker.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/worker.test.js`
  - `M` `netlify/functions/_shared/study-adult-review/delivery.js`
  - `M` `netlify/functions/_shared/study-adult-review/guardian-notifications.js`
  - `M` `netlify/functions/_shared/study-adult-review/memory-store.js`
  - `M` `netlify/functions/_shared/study-adult-review/outbox-worker.js`
  - `A` `netlify/functions/_shared/study-delivery/durable-identifier-contract.test.js`
  - `M` `netlify/functions/_shared/study-delivery/external-provider.js`
  - `M` `netlify/functions/_shared/study-delivery/external-provider.test.js`
  - `M` `netlify/functions/_shared/study-delivery/in-app-provider.js`
  - `M` `netlify/functions/_shared/study-delivery/in-app-provider.test.js`
  - `A` `netlify/functions/_shared/study-delivery/in-app-receipt-validator.js`
  - `A` `netlify/functions/_shared/study-delivery/in-app-receipt-validator.test.js`
  - `M` `netlify/functions/_shared/study-delivery/receipt-contract.js`
  - `A` `netlify/functions/_shared/study-delivery/server-identifier-hardening.test.js`
  - `M` `netlify/functions/_shared/study-delivery/supabase-in-app.js`
  - `M` `netlify/functions/_shared/study-delivery/supabase-in-app.test.js`
  - `M` `netlify/functions/_shared/study-production/readiness.js`
  - `M` `netlify/functions/_shared/study-production/readiness.test.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js`
  - `A` `netlify/functions/_shared/study-worker/credential.js`
  - `A` `netlify/functions/_shared/study-worker/credential.test.js`
  - `M` `netlify/functions/admin-study-operations.js`
  - `M` `netlify/functions/admin-study-operations.test.js`
  - `A` `netlify/functions/study-adult-review-scheduled-worker.js`
  - `A` `netlify/functions/study-adult-review-scheduled-worker.test.js`
  - `M` `netlify/functions/study-adult-review-worker.js`
  - `M` `netlify/functions/study-production-readiness.js`
  - `M` `src/academy/adapters/adapters.test.ts`
  - `M` `src/academy/adapters/studyContextAdapter.ts`
  - `M` `src/admin/studyOperationsHttpSource.test.ts`
  - `M` `src/admin/studyOperationsModel.test.ts`
  - `M` `src/admin/studyOperationsModel.ts`
  - `M` `src/components/admin/AdminStudyOperations.test.tsx`
  - `M` `src/components/admin/AdminStudyOperations.tsx`
  - `M` `src/study/composition/durableAcademicProductionPorts.test.ts`
  - `M` `src/study/contracts/persistence/ports.ts`
  - `M` `src/study/contracts/persistence/types.ts`
  - `M` `src/study/contracts/production/readiness.ts`
  - `A` `src/study/effectiveSettings.test.ts`
  - `A` `src/study/effectiveSettings.ts`
  - `M` `src/study/generated/studyDatabase.ts`
  - `A` `src/study/persistence/SupabaseStudyParentSettingsAdapter.test.ts`
  - `M` `src/study/persistence/SupabaseStudyParentSettingsAdapter.ts`
  - `A` `src/study/persistence/SupabaseStudyPersistenceAdapter.test.ts`
  - `M` `src/study/persistence/SupabaseStudyPersistenceAdapter.ts`
  - `A` `supabase/migrations/20260810120000_academy_study_effective_settings_v2.sql`
  - `A` `supabase/migrations/20260810150000_academy_study_curriculum_binding.sql`
  - `A` `supabase/migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql`
  - `A` `supabase/migrations/20260810152100_academy_study_worker_operations_contract.sql`
  - `A` `supabase/migrations/20260810159000_academy_study_worker_run_evidence.sql`
  - `A` `supabase/study-curriculum-binding.db.test.ts`
  - `A` `supabase/study-effective-settings-v2.db.test.ts`
  - `M` `supabase/study-engine-adult-review.db.test.ts`
  - `A` `supabase/study-engine-in-app-receipt-timestamp.db.test.ts`
  - `A` `supabase/study-worker-run-evidence.db.test.ts`
- Migration files (5):
  - `A` `supabase/migrations/20260810120000_academy_study_effective_settings_v2.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810150000_academy_study_curriculum_binding.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql`; explicit migration dependencies: `20260801170000_academy_study_adult_review_operations`, `20260801190000_academy_study_final_production_reconciliation`, `20260810120000_academy_study_effective_settings_v2`, `20260810150000_academy_study_curriculum_binding`.
  - `A` `supabase/migrations/20260810152100_academy_study_worker_operations_contract.sql`; explicit migration dependencies: `20260801010000_academy_study_engine_storage`, `20260801011000_academy_study_engine_authorization`, `20260801012000_academy_study_engine_production_reconciliation`, `20260801160000_academy_study_verified_identity`, `20260801170000_academy_study_adult_review_operations`, `20260801190000_academy_study_final_production_reconciliation`, `20260810120000_academy_study_effective_settings_v2`, `20260810150000_academy_study_curriculum_binding`, `20260810152000_academy_study_in_app_receipt_timestamp`.
  - `A` `supabase/migrations/20260810159000_academy_study_worker_run_evidence.sql`; explicit migration dependencies: none explicitly named.
- Test additions (16): `netlify/functions/_shared/admin-study-worker-evidence-source.test.js`, `netlify/functions/_shared/study-adult-review-operations/composition.test.js`, `netlify/functions/_shared/study-adult-review-operations/run-evidence.test.js`, `netlify/functions/_shared/study-adult-review-operations/supabase-operations.test.js`, `netlify/functions/_shared/study-delivery/durable-identifier-contract.test.js`, `netlify/functions/_shared/study-delivery/in-app-receipt-validator.test.js`, `netlify/functions/_shared/study-delivery/server-identifier-hardening.test.js`, `netlify/functions/_shared/study-worker/credential.test.js`, `netlify/functions/study-adult-review-scheduled-worker.test.js`, `src/study/effectiveSettings.test.ts`, `src/study/persistence/SupabaseStudyParentSettingsAdapter.test.ts`, `src/study/persistence/SupabaseStudyPersistenceAdapter.test.ts`, `supabase/study-curriculum-binding.db.test.ts`, `supabase/study-effective-settings-v2.db.test.ts`, `supabase/study-engine-in-app-receipt-timestamp.db.test.ts`, `supabase/study-worker-run-evidence.db.test.ts`.
- Documentation additions (1): `docs/study-effective-settings-v2.md`.

</details>

<details><summary><code>win/admin-unified-preflight-orchestrator</code> — 28ce1a938</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-admin-unified-preflight-orchestrator`; state: **clean**; upstream: —.
- HEAD: `28ce1a938a0f06617bd92d31ff1ec7ef95fb541c` — admin: unify local production preflight
- Comparison base: `40abc78b0f4482fecf612ad0b6f5280cc2a96607` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (3; globally exclusive to this `win/*` ref: 0):
  - `8d2ceb1e3841ee8489867672bb6b43d440a266ad` admin: add migration reconciliation planner
  - `f9b1278fed23048d1e0d18b4ae1d4e9e4e295919` study: add deployment environment preflight
  - `28ce1a938a0f06617bd92d31ff1ec7ef95fb541c` admin: unify local production preflight
- Changed paths (24):
  - `M` `docs/admin-production-preflight/README.md`
  - `A` `docs/admin-production-preflight/migration-reconciliation-planner.md`
  - `A` `docs/production-local-preflight.md`
  - `A` `docs/study-production-deployment-environment-preflight.md`
  - `M` `package.json`
  - `M` `scripts/admin-production-preflight.mjs`
  - `M` `scripts/admin-production-preflight.test.ts`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/dependency-inversion-proposal.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migration-manifest.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_curriculum_draft_authoring.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_provider_attempt_journal.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_provider_pricing_terms.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_study_effective_settings_v2.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/references/migration-identity.md`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/reused-destination-proposal.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/safety.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/valid-proposal.json`
  - `A` `scripts/fixtures/production-local-preflight/scenarios.json`
  - `A` `scripts/migration-reconciliation-planner.mjs`
  - `A` `scripts/migration-reconciliation-planner.test.ts`
  - `A` `scripts/production-local-preflight.mjs`
  - `A` `scripts/production-local-preflight.test.ts`
  - `A` `scripts/study-deployment-env-preflight.mjs`
  - `A` `tests/study-deployment-env-preflight.test.js`
- Migration files (0):
  - None.
- Test additions (3): `scripts/migration-reconciliation-planner.test.ts`, `scripts/production-local-preflight.test.ts`, `tests/study-deployment-env-preflight.test.js`.
- Documentation additions (3): `docs/admin-production-preflight/migration-reconciliation-planner.md`, `docs/production-local-preflight.md`, `docs/study-production-deployment-environment-preflight.md`.

</details>

<details><summary><code>win/final-admin-delta-rc1</code> — ae2c9b324</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-admin-delta-rc1`; state: **clean**; upstream: —.
- HEAD: `ae2c9b32445a59b82a972f3b67af8ea11dc50b79` — integrate: finalize Windows Admin delta RC1
- Comparison base: `e43a1320021fbe4e004af74c26a563532990545c` (oldest reflog entry (branch creation point)).
- Classification: **recommended-functional-source**.
- Commits in range (24; globally exclusive to this `win/*` ref: 24):
  - `5ba95211e73b44d7154b155cac731dcb3cffbf43` admin-9: adopt scalable health telemetry aggregates
  - `4024229aef1f2c154c49b179aa87b1c4782902c9` admin-9: harden scalable system health aggregates
  - `475203fb14c96a9d7fe6ff6db78ec2ffeb445715` admin: adopt scalable aggregates for system health
  - `52ef2c1924f9d2c1c7db86952fc419aa0018c2ba` admin-costs: add scalable exact cost aggregates
  - `d211b98fe47dd918487d0a8f23166a688a17d53a` admin-costs: complete v3 consumer integration
  - `61fc9763cb6d513224c4a0ed5b9281c5370c5a91` admin-costs: add effective-dated provider pricing terms
  - `700c48eebadc2752cb2c216c3345471eb4a49f55` admin: add provider pricing management UI
  - `85f1556887b458a923496824b9a7fd930025b656` study: admit safety provider cost accounting
  - `66e69b7d4fa42f5162ffeaebb6b1d1889476ff79` admin: integrate provider pricing and cost accounting
  - `37f22633311d270afe5fbed0f5c3cb4f4c2aab16` fix(admin): harden Costs and Provider Pricing browser UX
  - `3589b550ecdc9ecd2f92f850cc89cd9fc12a5afb` admin: add Study operations dashboard
  - `f63abb035af5ad84e0c5827dca116bcedd650858` fix(admin): harden Study Operations browser UX
  - `3ba30bb75801bb3a8952b2e190c7a0f22b49247f` study: compose production adult review worker
  - `bc0b216b69b47e516ba30211090e9a75f3ec792f` study: add private scheduled adult review worker
  - `362835012d4069b39c703305a174977d5e06720d` study: persist adult review worker run evidence
  - `904d81a62eb95c18924958d3cdf84ceb536c2198` study: implement effective settings v2
  - `e6ec95e26c90d9f6104004e5704d6fc6cb0b3517` study: bind sessions to immutable curriculum releases
  - `44282b56385d8fd1d55cdfd91e79e6cef9344d5b` admin: connect Study Operations to worker run evidence
  - `bb7a0a455dc695cc5bb14e6e6405622afb76893d` preflight-r2: reconcile historical migration contract
  - `57f946df6cdb1521d16cd4faa8476671932cc7c3` admin: strengthen production activation preflight
  - `fe76549665c65fee9c53ce5b61da70c0af8db63a` admin: add migration reconciliation planner
  - `b0e5b42eca478bceb5755e31b7d3ce7c19e04b6b` study: add deployment environment preflight
  - `e3f62dced44b8ddd7e932ec992756a39f30f3495` admin: unify local production preflight
  - `ae2c9b32445a59b82a972f3b67af8ea11dc50b79` integrate: finalize Windows Admin delta RC1
- Changed paths (168):
  - `M` `MIGRATIONS.md`
  - `M` `docs/academy-ai-cost-accounting.md`
  - `M` `docs/admin-audit-foundation.md`
  - `M` `docs/admin-console/README.md`
  - `M` `docs/admin-console/cost-accounting.md`
  - `A` `docs/admin-costs-contract-v3.md`
  - `A` `docs/admin-production-preflight/README.md`
  - `A` `docs/admin-production-preflight/current-local-evidence.json`
  - `A` `docs/admin-production-preflight/deployment-contract.json`
  - `A` `docs/admin-production-preflight/migration-reconciliation-planner.md`
  - `A` `docs/admin-production-preflight/windows-admin-delta-reconciliation.json`
  - `A` `docs/admin-provider-pricing-terms.md`
  - `M` `docs/admin-r1-wave2-integration.md`
  - `M` `docs/admin-system-health.md`
  - `A` `docs/production-local-preflight.md`
  - `A` `docs/study-effective-settings-v2.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `M` `docs/study-engine-production-reconciliation/12-production-readiness-matrix.md`
  - `A` `docs/study-production-deployment-environment-preflight.md`
  - `A` `docs/study-provider-cost-accounting.md`
  - `M` `netlify.toml`
  - `A` `netlify/functions/_shared/admin-cost-aggregate.js`
  - `A` `netlify/functions/_shared/admin-cost-aggregate.test.js`
  - `M` `netlify/functions/_shared/admin-cost-projection.js`
  - `M` `netlify/functions/_shared/admin-cost-projection.test.js`
  - `M` `netlify/functions/_shared/admin-health-source.js`
  - `M` `netlify/functions/_shared/admin-health-source.test.js`
  - `M` `netlify/functions/_shared/admin-operational-aggregate-reader.js`
  - `M` `netlify/functions/_shared/admin-operational-aggregate-reader.test.js`
  - `A` `netlify/functions/_shared/admin-provider-pricing-source.js`
  - `A` `netlify/functions/_shared/admin-provider-pricing-source.test.js`
  - `A` `netlify/functions/_shared/admin-study-operations-source.js`
  - `A` `netlify/functions/_shared/admin-study-operations-source.test.js`
  - `A` `netlify/functions/_shared/admin-study-worker-evidence-source.js`
  - `A` `netlify/functions/_shared/admin-study-worker-evidence-source.test.js`
  - `M` `netlify/functions/_shared/gateway-access.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/composition.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/composition.test.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/entrypoint-result.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/run-evidence.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/run-evidence.test.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/schedule.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/supabase-operations.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/supabase-operations.test.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/worker.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/worker.test.js`
  - `M` `netlify/functions/_shared/study-adult-review/delivery.js`
  - `M` `netlify/functions/_shared/study-adult-review/guardian-notifications.js`
  - `M` `netlify/functions/_shared/study-adult-review/memory-store.js`
  - `M` `netlify/functions/_shared/study-adult-review/outbox-worker.js`
  - `A` `netlify/functions/_shared/study-delivery/durable-identifier-contract.test.js`
  - `M` `netlify/functions/_shared/study-delivery/external-provider.js`
  - `M` `netlify/functions/_shared/study-delivery/external-provider.test.js`
  - `M` `netlify/functions/_shared/study-delivery/in-app-provider.js`
  - `M` `netlify/functions/_shared/study-delivery/in-app-provider.test.js`
  - `A` `netlify/functions/_shared/study-delivery/in-app-receipt-validator.js`
  - `A` `netlify/functions/_shared/study-delivery/in-app-receipt-validator.test.js`
  - `M` `netlify/functions/_shared/study-delivery/receipt-contract.js`
  - `A` `netlify/functions/_shared/study-delivery/server-identifier-hardening.test.js`
  - `M` `netlify/functions/_shared/study-delivery/supabase-in-app.js`
  - `M` `netlify/functions/_shared/study-delivery/supabase-in-app.test.js`
  - `M` `netlify/functions/_shared/study-production/readiness.js`
  - `M` `netlify/functions/_shared/study-production/readiness.test.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js`
  - `A` `netlify/functions/_shared/study-worker/credential.js`
  - `A` `netlify/functions/_shared/study-worker/credential.test.js`
  - `M` `netlify/functions/admin-costs.test.js`
  - `M` `netlify/functions/admin-health.js`
  - `M` `netlify/functions/admin-health.test.js`
  - `A` `netlify/functions/admin-provider-pricing-terms.js`
  - `A` `netlify/functions/admin-provider-pricing-terms.test.js`
  - `A` `netlify/functions/admin-study-operations.js`
  - `A` `netlify/functions/admin-study-operations.test.js`
  - `A` `netlify/functions/study-adult-review-scheduled-worker.js`
  - `A` `netlify/functions/study-adult-review-scheduled-worker.test.js`
  - `M` `netlify/functions/study-adult-review-worker.js`
  - `M` `netlify/functions/study-production-readiness.js`
  - `M` `package.json`
  - `A` `scripts/admin-production-preflight.mjs`
  - `A` `scripts/admin-production-preflight.test.ts`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/dependency-inversion-proposal.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migration-manifest.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_curriculum_draft_authoring.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_provider_attempt_journal.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_provider_pricing_terms.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/migrations/20260810120000_study_effective_settings_v2.sql`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/references/migration-identity.md`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/reused-destination-proposal.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/safety.json`
  - `A` `scripts/fixtures/migration-reconciliation/four-way/valid-proposal.json`
  - `A` `scripts/fixtures/production-local-preflight/scenarios.json`
  - `A` `scripts/migration-reconciliation-planner.mjs`
  - `A` `scripts/migration-reconciliation-planner.test.ts`
  - `A` `scripts/production-local-preflight.mjs`
  - `A` `scripts/production-local-preflight.test.ts`
  - `A` `scripts/study-deployment-env-preflight.mjs`
  - `M` `scripts/study-migration-preflight.mjs`
  - `M` `scripts/study-migration-preflight.test.ts`
  - `M` `src/academy/adapters/adapters.test.ts`
  - `M` `src/academy/adapters/studyContextAdapter.ts`
  - `M` `src/admin/costsHttpSource.test.ts`
  - `M` `src/admin/costsHttpSource.ts`
  - `M` `src/admin/costsModel.test.ts`
  - `M` `src/admin/costsModel.ts`
  - `M` `src/admin/costsTestFixtures.ts`
  - `M` `src/admin/index.ts`
  - `M` `src/admin/overviewAdapter.ts`
  - `M` `src/admin/overviewModel.ts`
  - `A` `src/admin/providerPricingHttpSource.test.ts`
  - `A` `src/admin/providerPricingHttpSource.ts`
  - `A` `src/admin/providerPricingModel.test.ts`
  - `A` `src/admin/providerPricingModel.ts`
  - `A` `src/admin/studyOperationsHttpSource.test.ts`
  - `A` `src/admin/studyOperationsHttpSource.ts`
  - `A` `src/admin/studyOperationsModel.test.ts`
  - `A` `src/admin/studyOperationsModel.ts`
  - `M` `src/admin/systemHealth.test.ts`
  - `M` `src/admin/systemHealth.ts`
  - `M` `src/admin/systemHealthClient.test.ts`
  - `M` `src/admin/systemHealthClient.ts`
  - `M` `src/components/admin/AdminConsole.test.tsx`
  - `M` `src/components/admin/AdminConsole.tsx`
  - `M` `src/components/admin/AdminConsoleRoute.test.tsx`
  - `M` `src/components/admin/AdminConsoleRoute.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.test.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.tsx`
  - `A` `src/components/admin/AdminProviderPricingDashboard.test.tsx`
  - `A` `src/components/admin/AdminProviderPricingDashboard.tsx`
  - `A` `src/components/admin/AdminStudyOperations.test.tsx`
  - `A` `src/components/admin/AdminStudyOperations.tsx`
  - `M` `src/components/admin/SystemHealthDashboard.test.tsx`
  - `M` `src/components/admin/SystemHealthDashboard.tsx`
  - `M` `src/components/admin/admin-console.css`
  - `M` `src/components/admin/admin-costs.css`
  - `A` `src/components/admin/admin-provider-pricing.css`
  - `A` `src/components/admin/admin-study-operations.css`
  - `M` `src/study/composition/durableAcademicProductionPorts.test.ts`
  - `M` `src/study/contracts/persistence/ports.ts`
  - `M` `src/study/contracts/persistence/types.ts`
  - `M` `src/study/contracts/production/readiness.ts`
  - `A` `src/study/effectiveSettings.test.ts`
  - `A` `src/study/effectiveSettings.ts`
  - `M` `src/study/generated/studyDatabase.ts`
  - `A` `src/study/persistence/SupabaseStudyParentSettingsAdapter.test.ts`
  - `M` `src/study/persistence/SupabaseStudyParentSettingsAdapter.ts`
  - `A` `src/study/persistence/SupabaseStudyPersistenceAdapter.test.ts`
  - `M` `src/study/persistence/SupabaseStudyPersistenceAdapter.ts`
  - `M` `supabase/academy-operational-events.db.test.ts`
  - `A` `supabase/academy-provider-pricing-terms.db.test.ts`
  - `M` `supabase/academy-provider-usage-cost-ledger.db.test.ts`
  - `A` `supabase/academy-study-provider-cost-accounting.db.test.ts`
  - `A` `supabase/migrations/20260809121000_academy_provider_usage_cost_aggregate.sql`
  - `A` `supabase/migrations/20260810120200_academy_study_effective_settings_v2.sql`
  - `A` `supabase/migrations/20260810120300_academy_provider_pricing_terms.sql`
  - `A` `supabase/migrations/20260810141000_academy_study_provider_cost_accounting.sql`
  - `A` `supabase/migrations/20260810150000_academy_study_curriculum_binding.sql`
  - `A` `supabase/migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql`
  - `A` `supabase/migrations/20260810152100_academy_study_worker_operations_contract.sql`
  - `A` `supabase/migrations/20260810159000_academy_study_worker_run_evidence.sql`
  - `A` `supabase/study-curriculum-binding.db.test.ts`
  - `A` `supabase/study-effective-settings-v2.db.test.ts`
  - `M` `supabase/study-engine-adult-review.db.test.ts`
  - `A` `supabase/study-engine-in-app-receipt-timestamp.db.test.ts`
  - `A` `supabase/study-worker-run-evidence.db.test.ts`
  - `M` `tests/netlify-functions/gateway-access.test.js`
  - `A` `tests/study-deployment-env-preflight.test.js`
  - `M` `vite.config.ts`
- Migration files (8):
  - `A` `supabase/migrations/20260809121000_academy_provider_usage_cost_aggregate.sql`; explicit migration dependencies: `20260809120000_academy_operational_telemetry_foundation`.
  - `A` `supabase/migrations/20260810120200_academy_study_effective_settings_v2.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810120300_academy_provider_pricing_terms.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810141000_academy_study_provider_cost_accounting.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810150000_academy_study_curriculum_binding.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql`; explicit migration dependencies: `20260801170000_academy_study_adult_review_operations`, `20260801190000_academy_study_final_production_reconciliation`, `20260810120200_academy_study_effective_settings_v2`, `20260810150000_academy_study_curriculum_binding`.
  - `A` `supabase/migrations/20260810152100_academy_study_worker_operations_contract.sql`; explicit migration dependencies: `20260801010000_academy_study_engine_storage`, `20260801011000_academy_study_engine_authorization`, `20260801012000_academy_study_engine_production_reconciliation`, `20260801160000_academy_study_verified_identity`, `20260801170000_academy_study_adult_review_operations`, `20260801190000_academy_study_final_production_reconciliation`, `20260810120200_academy_study_effective_settings_v2`, `20260810150000_academy_study_curriculum_binding`, `20260810152000_academy_study_in_app_receipt_timestamp`.
  - `A` `supabase/migrations/20260810159000_academy_study_worker_run_evidence.sql`; explicit migration dependencies: none explicitly named.
- Test additions (33): `netlify/functions/_shared/admin-cost-aggregate.test.js`, `netlify/functions/_shared/admin-provider-pricing-source.test.js`, `netlify/functions/_shared/admin-study-operations-source.test.js`, `netlify/functions/_shared/admin-study-worker-evidence-source.test.js`, `netlify/functions/_shared/study-adult-review-operations/composition.test.js`, `netlify/functions/_shared/study-adult-review-operations/run-evidence.test.js`, `netlify/functions/_shared/study-adult-review-operations/supabase-operations.test.js`, `netlify/functions/_shared/study-delivery/durable-identifier-contract.test.js`, `netlify/functions/_shared/study-delivery/in-app-receipt-validator.test.js`, `netlify/functions/_shared/study-delivery/server-identifier-hardening.test.js`, `netlify/functions/_shared/study-worker/credential.test.js`, `netlify/functions/admin-provider-pricing-terms.test.js`, `netlify/functions/admin-study-operations.test.js`, `netlify/functions/study-adult-review-scheduled-worker.test.js`, `scripts/admin-production-preflight.test.ts`, `scripts/migration-reconciliation-planner.test.ts`, `scripts/production-local-preflight.test.ts`, `src/admin/providerPricingHttpSource.test.ts`, `src/admin/providerPricingModel.test.ts`, `src/admin/studyOperationsHttpSource.test.ts`, `src/admin/studyOperationsModel.test.ts`, `src/components/admin/AdminProviderPricingDashboard.test.tsx`, `src/components/admin/AdminStudyOperations.test.tsx`, `src/study/effectiveSettings.test.ts`, `src/study/persistence/SupabaseStudyParentSettingsAdapter.test.ts`, `src/study/persistence/SupabaseStudyPersistenceAdapter.test.ts`, `supabase/academy-provider-pricing-terms.db.test.ts`, `supabase/academy-study-provider-cost-accounting.db.test.ts`, `supabase/study-curriculum-binding.db.test.ts`, `supabase/study-effective-settings-v2.db.test.ts`, `supabase/study-engine-in-app-receipt-timestamp.db.test.ts`, `supabase/study-worker-run-evidence.db.test.ts`, `tests/study-deployment-env-preflight.test.js`.
- Documentation additions (11): `docs/admin-costs-contract-v3.md`, `docs/admin-production-preflight/README.md`, `docs/admin-production-preflight/current-local-evidence.json`, `docs/admin-production-preflight/deployment-contract.json`, `docs/admin-production-preflight/migration-reconciliation-planner.md`, `docs/admin-production-preflight/windows-admin-delta-reconciliation.json`, `docs/admin-provider-pricing-terms.md`, `docs/production-local-preflight.md`, `docs/study-effective-settings-v2.md`, `docs/study-production-deployment-environment-preflight.md`, `docs/study-provider-cost-accounting.md`.

</details>

<details><summary><code>win/final-cross-machine-source-verifier</code> — a438b00e8</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-cross-machine-source-verifier`; state: **clean**; upstream: —.
- HEAD: `a438b00e8ae6a78ba16b69a73767279d3393bd3e` — docs(final-integration): record cross-machine source manifest
- Comparison base: `ffd1cc5a7ff706abfde00a07bc284b22687ffe0f` (oldest reflog entry (branch creation point)).
- Classification: **release-support-source**.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `a438b00e8ae6a78ba16b69a73767279d3393bd3e` docs(final-integration): record cross-machine source manifest
- Changed paths (2):
  - `A` `docs/final-integration/cross-machine-source-manifest.json`
  - `A` `docs/final-integration/cross-machine-source-manifest.md`
- Migration files (0):
  - None.
- Test additions (0): none.
- Documentation additions (2): `docs/final-integration/cross-machine-source-manifest.json`, `docs/final-integration/cross-machine-source-manifest.md`.

</details>

<details><summary><code>win/final-integration-inventory</code> — ffd1cc5a7</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-integration-inventory`; state: **clean**; upstream: —.
- HEAD: `ffd1cc5a7ff706abfde00a07bc284b22687ffe0f` — docs(release): record default student home production launch
- Comparison base: `19e8faa4cf3421789b917f4835ecf684f64c654d` (branch was registered at its current tip; using first parent).
- Classification: **inventory-output-branch**.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `ffd1cc5a7ff706abfde00a07bc284b22687ffe0f` docs(release): record default student home production launch
- Changed paths (2):
  - `M` `DEPLOY.md`
  - `M` `PARKED.md`
- Migration files (0):
  - None.
- Test additions (0): none.
- Documentation additions (0): none.

</details>

<details><summary><code>win/final-migration-proposal</code> — c7bca9dee</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-migration-proposal`; state: **clean**; upstream: —.
- HEAD: `c7bca9deeb5f0b4077a8c8848e4d953c7833efe9` — docs: propose final migration reconciliation
- Comparison base: `666bf260843f67a4d6c959a0d4081ccf656cb55a` (oldest reflog entry (branch creation point)).
- Classification: **release-support-source**.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `c7bca9deeb5f0b4077a8c8848e4d953c7833efe9` docs: propose final migration reconciliation
- Changed paths (2):
  - `A` `docs/final-integration/final-migration-reconciliation-proposal.json`
  - `A` `docs/final-integration/final-migration-reconciliation-proposal.md`
- Migration files (0):
  - None.
- Test additions (0): none.
- Documentation additions (2): `docs/final-integration/final-migration-reconciliation-proposal.json`, `docs/final-integration/final-migration-reconciliation-proposal.md`.

</details>

<details><summary><code>win/final-production-activation-runbook</code> — 805ba4645</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-production-activation-runbook`; state: **clean**; upstream: —.
- HEAD: `805ba464567d2e28d40f54b7971837a1c90b72fb` — docs(final): add production activation runbook [win/final-production-activation-runbook]
- Comparison base: `28ce1a938a0f06617bd92d31ff1ec7ef95fb541c` (oldest reflog entry (branch creation point)).
- Classification: **release-support-source**.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `805ba464567d2e28d40f54b7971837a1c90b72fb` docs(final): add production activation runbook [win/final-production-activation-runbook]
- Changed paths (4):
  - `A` `docs/final-integration/production-activation-checklist.json`
  - `A` `docs/final-integration/production-activation-runbook.md`
  - `M` `package.json`
  - `A` `scripts/validate-production-activation-runbook.mjs`
- Migration files (0):
  - None.
- Test additions (0): none.
- Documentation additions (2): `docs/final-integration/production-activation-checklist.json`, `docs/final-integration/production-activation-runbook.md`.

</details>

<details><summary><code>win/final-rc-validation-harness</code> — 3e8b54f95</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-rc-validation-harness`; state: **clean**; upstream: —.
- HEAD: `3e8b54f9510408279e857aebecd7aa98e400e2ad` — test(release): add final RC validation harness
- Comparison base: `28ce1a938a0f06617bd92d31ff1ec7ef95fb541c` (oldest reflog entry (branch creation point)).
- Classification: **release-support-source**.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `3e8b54f9510408279e857aebecd7aa98e400e2ad` test(release): add final RC validation harness
- Changed paths (5):
  - `A` `docs/release-candidate-validation.md`
  - `M` `package.json`
  - `A` `scripts/fixtures/release-candidate-validation/scenarios.json`
  - `A` `scripts/release-candidate-validation.mjs`
  - `A` `scripts/release-candidate-validation.test.ts`
- Migration files (0):
  - None.
- Test additions (1): `scripts/release-candidate-validation.test.ts`.
- Documentation additions (1): `docs/release-candidate-validation.md`.

</details>

<details><summary><code>win/final-study-rc1</code> — f93f0736b</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-final-study-rc1`; state: **clean**; upstream: —.
- HEAD: `f93f0736b48736252e0678f9b57ce83652e2dab5` — fix(study): enforce session timestamp coherence
- Comparison base: `87a21b748d8855fc814435551c4d65e47f3ff126` (oldest reflog entry (branch creation point)).
- Classification: **recommended-functional-source**.
- Commits in range (9; globally exclusive to this `win/*` ref: 9):
  - `aad7657bf2780900f75f9130fffa8b9353e33d6c` study: compose production adult review worker
  - `7976329c673f4e39f760c4fecdfd248c4c8db47f` study: add private scheduled adult review worker
  - `6f4994a61dca952f0758c847e45bf914a1a649dd` study: persist adult review worker run evidence
  - `0360c2b3566787649c0e3cd0813e9ad0ef8f9af6` study: add durable session telemetry outbox
  - `8a41012932b3d295bd95e5238eaa76c20d40c97d` study: deliver session telemetry outbox
  - `62e06dfd371076126e812cdd9f493a23aa6b8fb4` study: authorize telemetry delivery invocation
  - `dcfb37f2ce83c38fd96595a1fcea034ae8ab5e9b` fix(study): harden production recovery
  - `8ef764772c43f63b08403248c1e98273c35c5f4f` test(study): add local production smoke harness
  - `f93f0736b48736252e0678f9b57ce83652e2dab5` fix(study): enforce session timestamp coherence
- Changed paths (73):
  - `M` `MIGRATIONS.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `A` `docs/study-production-local-smoke.md`
  - `A` `docs/study-session-telemetry-outbox.md`
  - `M` `netlify.toml`
  - `A` `netlify/functions/_shared/operational-telemetry-writer.js`
  - `A` `netlify/functions/_shared/operational-telemetry-writer.test.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/composition.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/composition.test.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/entrypoint-result.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/run-evidence.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/run-evidence.test.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/supabase-operations.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/supabase-operations.test.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/worker.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/worker.test.js`
  - `M` `netlify/functions/_shared/study-adult-review/delivery.js`
  - `M` `netlify/functions/_shared/study-adult-review/guardian-notifications.js`
  - `M` `netlify/functions/_shared/study-adult-review/memory-store.js`
  - `M` `netlify/functions/_shared/study-adult-review/outbox-worker.js`
  - `A` `netlify/functions/_shared/study-delivery/durable-identifier-contract.test.js`
  - `M` `netlify/functions/_shared/study-delivery/external-provider.js`
  - `M` `netlify/functions/_shared/study-delivery/external-provider.test.js`
  - `M` `netlify/functions/_shared/study-delivery/in-app-provider.js`
  - `M` `netlify/functions/_shared/study-delivery/in-app-provider.test.js`
  - `A` `netlify/functions/_shared/study-delivery/in-app-receipt-validator.js`
  - `A` `netlify/functions/_shared/study-delivery/in-app-receipt-validator.test.js`
  - `M` `netlify/functions/_shared/study-delivery/receipt-contract.js`
  - `A` `netlify/functions/_shared/study-delivery/server-identifier-hardening.test.js`
  - `M` `netlify/functions/_shared/study-delivery/supabase-in-app.js`
  - `M` `netlify/functions/_shared/study-delivery/supabase-in-app.test.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/entrypoint.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/entrypoint.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/invocation-readiness.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/invocation-readiness.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/outbox-store.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/outbox-store.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/production.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/production.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/scheduled.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/scheduled.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/worker.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/worker.test.js`
  - `A` `netlify/functions/_shared/study-worker/credential.js`
  - `A` `netlify/functions/_shared/study-worker/credential.test.js`
  - `A` `netlify/functions/study-adult-review-scheduled-worker.js`
  - `A` `netlify/functions/study-adult-review-scheduled-worker.test.js`
  - `M` `netlify/functions/study-adult-review-worker.js`
  - `A` `netlify/functions/study-session-telemetry-deliver.js`
  - `A` `netlify/functions/study-session-telemetry-deliver.test.js`
  - `M` `package.json`
  - `A` `scripts/deliver-study-session-telemetry.mjs`
  - `A` `scripts/fixtures/study-production-local-smoke.sql`
  - `A` `scripts/study-production-local-smoke.cli.test.js`
  - `A` `scripts/study-production-local-smoke.mjs`
  - `A` `scripts/study-production-local-smoke.vitest.config.mjs`
  - `M` `src/study/production/sessionController.test.ts`
  - `M` `src/study/production/sessionController.ts`
  - `A` `src/study/production/studyRecoveryChaos.test.ts`
  - `M` `src/telemetry/supabaseOperationalTelemetry.ts`
  - `A` `supabase/migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql`
  - `A` `supabase/migrations/20260810152100_academy_study_worker_operations_contract.sql`
  - `A` `supabase/migrations/20260810155000_academy_study_session_telemetry_outbox.sql`
  - `A` `supabase/migrations/20260810159000_academy_study_worker_run_evidence.sql`
  - `A` `supabase/migrations/20260810159100_academy_study_session_timestamp_coherence.sql`
  - `M` `supabase/study-engine-adult-review.db.test.ts`
  - `A` `supabase/study-engine-in-app-receipt-timestamp.db.test.ts`
  - `M` `supabase/study-session-semantics-v2.db.test.ts`
  - `A` `supabase/study-session-telemetry-outbox.db.test.ts`
  - `A` `supabase/study-worker-run-evidence.db.test.ts`
  - `A` `tests/study-production-local-smoke-harness.test.js`
- Migration files (5):
  - `A` `supabase/migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql`; explicit migration dependencies: `20260801170000_academy_study_adult_review_operations`, `20260801190000_academy_study_final_production_reconciliation`, `20260810120000_academy_study_effective_settings_v2`, `20260810150000_academy_study_curriculum_binding`.
  - `A` `supabase/migrations/20260810152100_academy_study_worker_operations_contract.sql`; explicit migration dependencies: `20260801010000_academy_study_engine_storage`, `20260801011000_academy_study_engine_authorization`, `20260801012000_academy_study_engine_production_reconciliation`, `20260801160000_academy_study_verified_identity`, `20260801170000_academy_study_adult_review_operations`, `20260801190000_academy_study_final_production_reconciliation`, `20260810120000_academy_study_effective_settings_v2`, `20260810150000_academy_study_curriculum_binding`, `20260810152000_academy_study_in_app_receipt_timestamp`.
  - `A` `supabase/migrations/20260810155000_academy_study_session_telemetry_outbox.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810159000_academy_study_worker_run_evidence.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810159100_academy_study_session_timestamp_coherence.sql`; explicit migration dependencies: none explicitly named.
- Test additions (22): `netlify/functions/_shared/operational-telemetry-writer.test.js`, `netlify/functions/_shared/study-adult-review-operations/composition.test.js`, `netlify/functions/_shared/study-adult-review-operations/run-evidence.test.js`, `netlify/functions/_shared/study-adult-review-operations/supabase-operations.test.js`, `netlify/functions/_shared/study-delivery/durable-identifier-contract.test.js`, `netlify/functions/_shared/study-delivery/in-app-receipt-validator.test.js`, `netlify/functions/_shared/study-delivery/server-identifier-hardening.test.js`, `netlify/functions/_shared/study-session-telemetry/entrypoint.test.js`, `netlify/functions/_shared/study-session-telemetry/invocation-readiness.test.js`, `netlify/functions/_shared/study-session-telemetry/outbox-store.test.js`, `netlify/functions/_shared/study-session-telemetry/production.test.js`, `netlify/functions/_shared/study-session-telemetry/scheduled.test.js`, `netlify/functions/_shared/study-session-telemetry/worker.test.js`, `netlify/functions/_shared/study-worker/credential.test.js`, `netlify/functions/study-adult-review-scheduled-worker.test.js`, `netlify/functions/study-session-telemetry-deliver.test.js`, `scripts/study-production-local-smoke.cli.test.js`, `src/study/production/studyRecoveryChaos.test.ts`, `supabase/study-engine-in-app-receipt-timestamp.db.test.ts`, `supabase/study-session-telemetry-outbox.db.test.ts`, `supabase/study-worker-run-evidence.db.test.ts`, `tests/study-production-local-smoke-harness.test.js`.
- Documentation additions (2): `docs/study-production-local-smoke.md`, `docs/study-session-telemetry-outbox.md`.

</details>

<details><summary><code>win/provider-pricing-terms</code> — 0ca0d2db3</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-provider-pricing-terms`; state: **clean**; upstream: —.
- HEAD: `0ca0d2db3b0f13ddf6cd220bbaeabe7e9e8ebc1a` — admin-costs: add effective-dated provider pricing terms
- Comparison base: `d7f5e84b373950e4334c9d182711c3375d539ed6` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (2; globally exclusive to this `win/*` ref: 0):
  - `fe84634b1f3b0644a7c3ffc834a9b0ccdb717026` admin-15: add append-only Admin audit foundation
  - `0ca0d2db3b0f13ddf6cd220bbaeabe7e9e8ebc1a` admin-costs: add effective-dated provider pricing terms
- Changed paths (31):
  - `M` `MIGRATIONS.md`
  - `M` `docs/academy-ai-cost-accounting.md`
  - `A` `docs/admin-audit-foundation.md`
  - `M` `docs/admin-console/README.md`
  - `M` `docs/admin-console/audit.md`
  - `M` `docs/admin-console/cost-accounting.md`
  - `A` `docs/admin-provider-pricing-terms.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `M` `netlify.toml`
  - `A` `netlify/functions/_shared/admin-audit-reader.js`
  - `A` `netlify/functions/_shared/admin-audit-reader.test.js`
  - `A` `netlify/functions/_shared/admin-provider-pricing-source.js`
  - `A` `netlify/functions/_shared/admin-provider-pricing-source.test.js`
  - `A` `netlify/functions/admin-audit.js`
  - `A` `netlify/functions/admin-audit.test.js`
  - `A` `netlify/functions/admin-provider-pricing-terms.js`
  - `A` `netlify/functions/admin-provider-pricing-terms.test.js`
  - `A` `src/admin/auditHttpSource.test.ts`
  - `A` `src/admin/auditHttpSource.ts`
  - `A` `src/admin/auditLogModel.ts`
  - `M` `src/admin/index.ts`
  - `A` `src/components/admin/AdminAuditLog.test.tsx`
  - `A` `src/components/admin/AdminAuditLog.tsx`
  - `M` `src/components/admin/AdminConsole.tsx`
  - `M` `src/components/admin/AdminConsoleRoute.test.tsx`
  - `M` `src/components/admin/AdminConsoleRoute.tsx`
  - `A` `src/components/admin/admin-audit-log.css`
  - `A` `supabase/academy-admin-audit.db.test.ts`
  - `A` `supabase/academy-provider-pricing-terms.db.test.ts`
  - `A` `supabase/migrations/20260809130000_academy_admin_audit_foundation.sql`
  - `A` `supabase/migrations/20260810120000_academy_provider_pricing_terms.sql`
- Migration files (2):
  - `A` `supabase/migrations/20260809130000_academy_admin_audit_foundation.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810120000_academy_provider_pricing_terms.sql`; explicit migration dependencies: none explicitly named.
- Test additions (8): `netlify/functions/_shared/admin-audit-reader.test.js`, `netlify/functions/_shared/admin-provider-pricing-source.test.js`, `netlify/functions/admin-audit.test.js`, `netlify/functions/admin-provider-pricing-terms.test.js`, `src/admin/auditHttpSource.test.ts`, `src/components/admin/AdminAuditLog.test.tsx`, `supabase/academy-admin-audit.db.test.ts`, `supabase/academy-provider-pricing-terms.db.test.ts`.
- Documentation additions (2): `docs/admin-audit-foundation.md`, `docs/admin-provider-pricing-terms.md`.

</details>

<details><summary><code>win/provider-pricing-ui</code> — 9884d4373</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-provider-pricing-ui`; state: **clean**; upstream: —.
- HEAD: `9884d43734e0e37d6c953f12da23512b99a849ff` — admin: add provider pricing management UI
- Comparison base: `0ca0d2db3b0f13ddf6cd220bbaeabe7e9e8ebc1a` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `9884d43734e0e37d6c953f12da23512b99a849ff` admin: add provider pricing management UI
- Changed paths (14):
  - `M` `src/admin/index.ts`
  - `A` `src/admin/providerPricingHttpSource.test.ts`
  - `A` `src/admin/providerPricingHttpSource.ts`
  - `A` `src/admin/providerPricingModel.test.ts`
  - `A` `src/admin/providerPricingModel.ts`
  - `M` `src/components/admin/AdminConsoleRoute.test.tsx`
  - `M` `src/components/admin/AdminConsoleRoute.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.test.tsx`
  - `M` `src/components/admin/AdminCostsDashboard.tsx`
  - `A` `src/components/admin/AdminProviderPricingDashboard.test.tsx`
  - `A` `src/components/admin/AdminProviderPricingDashboard.tsx`
  - `M` `src/components/admin/admin-console.css`
  - `M` `src/components/admin/admin-costs.css`
  - `A` `src/components/admin/admin-provider-pricing.css`
- Migration files (0):
  - None.
- Test additions (3): `src/admin/providerPricingHttpSource.test.ts`, `src/admin/providerPricingModel.test.ts`, `src/components/admin/AdminProviderPricingDashboard.test.tsx`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-bound-content-runtime</code> — 38e9a4743</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-bound-content-runtime`; state: **clean**; upstream: —.
- HEAD: `38e9a47436b9d3f400daf064503f27a909f448cc` — study: resolve content from bound curriculum release
- Comparison base: `01baf7b9e4d8560d43de3fd36710eca0372bebf0` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `38e9a47436b9d3f400daf064503f27a909f448cc` study: resolve content from bound curriculum release
- Changed paths (12):
  - `M` `MIGRATIONS.md`
  - `A` `docs/study-bound-curriculum-content-runtime.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `M` `netlify.toml`
  - `A` `netlify/functions/_shared/study-content/authority.js`
  - `A` `netlify/functions/_shared/study-content/filesystem-source.js`
  - `A` `netlify/functions/_shared/study-content/resolver.js`
  - `A` `netlify/functions/_shared/study-content/resolver.test.js`
  - `A` `netlify/functions/study-bound-content.js`
  - `M` `src/study/generated/studyDatabase.ts`
  - `A` `supabase/migrations/20260810154000_academy_study_bound_content_authority.sql`
  - `M` `supabase/study-curriculum-binding.db.test.ts`
- Migration files (1):
  - `A` `supabase/migrations/20260810154000_academy_study_bound_content_authority.sql`; explicit migration dependencies: `20260810150000_academy_study_curriculum_binding`, `20260810153000_academy_study_release_registry_bridge`.
- Test additions (1): `netlify/functions/_shared/study-content/resolver.test.js`.
- Documentation additions (1): `docs/study-bound-curriculum-content-runtime.md`.

</details>

<details><summary><code>win/study-curriculum-binding</code> — a2a514b58</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-curriculum-binding`; state: **clean**; upstream: —.
- HEAD: `a2a514b585690313903f3a624e7036eaec69b2a9` — study: bind sessions to immutable curriculum releases
- Comparison base: `cf996198ef9dd6594cc4ed71c0fc6c73002b17e8` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-terminal-descendant**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `a2a514b585690313903f3a624e7036eaec69b2a9` study: bind sessions to immutable curriculum releases
- Changed paths (17):
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `M` `netlify/functions/_shared/study-production/readiness.js`
  - `M` `netlify/functions/_shared/study-production/readiness.test.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js`
  - `M` `netlify/functions/study-production-readiness.js`
  - `M` `src/academy/adapters/adapters.test.ts`
  - `M` `src/academy/adapters/studyContextAdapter.ts`
  - `M` `src/study/composition/durableAcademicProductionPorts.test.ts`
  - `M` `src/study/contracts/persistence/ports.ts`
  - `M` `src/study/contracts/persistence/types.ts`
  - `M` `src/study/contracts/production/readiness.ts`
  - `M` `src/study/generated/studyDatabase.ts`
  - `A` `src/study/persistence/SupabaseStudyPersistenceAdapter.test.ts`
  - `M` `src/study/persistence/SupabaseStudyPersistenceAdapter.ts`
  - `A` `supabase/migrations/20260810150000_academy_study_curriculum_binding.sql`
  - `A` `supabase/study-curriculum-binding.db.test.ts`
- Migration files (1):
  - `A` `supabase/migrations/20260810150000_academy_study_curriculum_binding.sql`; explicit migration dependencies: none explicitly named.
- Test additions (2): `src/study/persistence/SupabaseStudyPersistenceAdapter.test.ts`, `supabase/study-curriculum-binding.db.test.ts`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-deployment-env-preflight</code> — a0b5841c7</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-deployment-env-preflight`; state: **clean**; upstream: —.
- HEAD: `a0b5841c7ab4e7b4d7bce3ff53a2959ad977a49a` — study: add deployment environment preflight
- Comparison base: `96fac0361e174225ca345d5253852ed6ba056236` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `a0b5841c7ab4e7b4d7bce3ff53a2959ad977a49a` study: add deployment environment preflight
- Changed paths (4):
  - `A` `docs/study-production-deployment-environment-preflight.md`
  - `M` `package.json`
  - `A` `scripts/study-deployment-env-preflight.mjs`
  - `A` `tests/study-deployment-env-preflight.test.js`
- Migration files (0):
  - None.
- Test additions (1): `tests/study-deployment-env-preflight.test.js`.
- Documentation additions (1): `docs/study-production-deployment-environment-preflight.md`.

</details>

<details><summary><code>win/study-effective-settings-v2</code> — cf996198e</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-effective-settings`; state: **clean**; upstream: —.
- HEAD: `cf996198ef9dd6594cc4ed71c0fc6c73002b17e8` — study: implement effective settings v2
- Comparison base: `d65d1511dd602db586a204bb7ccb2800fd7a89e2` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-terminal-descendant**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `cf996198ef9dd6594cc4ed71c0fc6c73002b17e8` study: implement effective settings v2
- Changed paths (15):
  - `M` `MIGRATIONS.md`
  - `A` `docs/study-effective-settings-v2.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `M` `docs/study-engine-production-reconciliation/12-production-readiness-matrix.md`
  - `M` `netlify/functions/_shared/study-production/readiness.js`
  - `M` `netlify/functions/_shared/study-production/readiness.test.js`
  - `M` `netlify/functions/study-production-readiness.js`
  - `M` `src/study/contracts/persistence/ports.ts`
  - `A` `src/study/effectiveSettings.test.ts`
  - `A` `src/study/effectiveSettings.ts`
  - `M` `src/study/generated/studyDatabase.ts`
  - `A` `src/study/persistence/SupabaseStudyParentSettingsAdapter.test.ts`
  - `M` `src/study/persistence/SupabaseStudyParentSettingsAdapter.ts`
  - `A` `supabase/migrations/20260810120000_academy_study_effective_settings_v2.sql`
  - `A` `supabase/study-effective-settings-v2.db.test.ts`
- Migration files (1):
  - `A` `supabase/migrations/20260810120000_academy_study_effective_settings_v2.sql`; explicit migration dependencies: none explicitly named.
- Test additions (3): `src/study/effectiveSettings.test.ts`, `src/study/persistence/SupabaseStudyParentSettingsAdapter.test.ts`, `supabase/study-effective-settings-v2.db.test.ts`.
- Documentation additions (1): `docs/study-effective-settings-v2.md`.

</details>

<details><summary><code>win/study-learner-path-r4</code> — 27254fd65</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-learner-path-r4`; state: **clean**; upstream: —.
- HEAD: `27254fd65db26e820eb88bf714bb7db9a7376541` — study: integrate production learner path r4
- Comparison base: `01237423fbf5ea6e34850174c8827fceaf010820` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-terminal-descendant**; terminal line `win/final-study-rc1`.
- Commits in range (3; globally exclusive to this `win/*` ref: 0):
  - `c8038e063d3c29eb2c5293c97a599eaba1609a58` study: resolve content from bound curriculum release
  - `f654e0a6ed674845c1f5d90eb7d2d762e484e622` study: add production client controller
  - `27254fd65db26e820eb88bf714bb7db9a7376541` study: integrate production learner path r4
- Changed paths (27):
  - `M` `MIGRATIONS.md`
  - `A` `docs/study-bound-curriculum-content-runtime.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `M` `netlify.toml`
  - `A` `netlify/functions/_shared/study-content/authority.js`
  - `A` `netlify/functions/_shared/study-content/filesystem-source.js`
  - `A` `netlify/functions/_shared/study-content/resolver.js`
  - `A` `netlify/functions/_shared/study-content/resolver.test.js`
  - `A` `netlify/functions/study-bound-content.js`
  - `A` `src/study/client/studyBoundContentClient.test.ts`
  - `A` `src/study/client/studyBoundContentClient.ts`
  - `M` `src/study/client/studyIdentityClient.test.ts`
  - `M` `src/study/client/studyIdentityClient.ts`
  - `A` `src/study/client/studyProductionSessionClient.test.ts`
  - `A` `src/study/client/studyProductionSessionClient.ts`
  - `A` `src/study/contracts/production/content.ts`
  - `M` `src/study/contracts/production/index.ts`
  - `A` `src/study/contracts/production/session.ts`
  - `M` `src/study/generated/studyDatabase.ts`
  - `M` `src/study/production/index.ts`
  - `A` `src/study/production/sessionController.test.ts`
  - `A` `src/study/production/sessionController.ts`
  - `A` `src/study/production/studyLearnerPath.integration.test.ts`
  - `M` `src/study/production/verifiedRuntimeAdapter.test.ts`
  - `M` `src/study/production/verifiedRuntimeAdapter.ts`
  - `A` `supabase/migrations/20260810154000_academy_study_bound_content_authority.sql`
  - `M` `supabase/study-curriculum-binding.db.test.ts`
- Migration files (1):
  - `A` `supabase/migrations/20260810154000_academy_study_bound_content_authority.sql`; explicit migration dependencies: `20260810150000_academy_study_curriculum_binding`, `20260810153000_academy_study_release_registry_bridge`.
- Test additions (5): `netlify/functions/_shared/study-content/resolver.test.js`, `src/study/client/studyBoundContentClient.test.ts`, `src/study/client/studyProductionSessionClient.test.ts`, `src/study/production/sessionController.test.ts`, `src/study/production/studyLearnerPath.integration.test.ts`.
- Documentation additions (1): `docs/study-bound-curriculum-content-runtime.md`.

</details>

<details><summary><code>win/study-private-scheduled-worker</code> — 96fac0361</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-private-scheduled-worker`; state: **clean**; upstream: —.
- HEAD: `96fac0361e174225ca345d5253852ed6ba056236` — study: add private scheduled adult review worker
- Comparison base: `e09770aa8e68c1a675729c592330da87951143d7` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `96fac0361e174225ca345d5253852ed6ba056236` study: add private scheduled adult review worker
- Changed paths (9):
  - `M` `netlify.toml`
  - `M` `netlify/functions/_shared/study-adult-review-operations/composition.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/composition.test.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/entrypoint-result.js`
  - `M` `netlify/functions/_shared/study-worker/credential.js`
  - `M` `netlify/functions/_shared/study-worker/credential.test.js`
  - `A` `netlify/functions/study-adult-review-scheduled-worker.js`
  - `A` `netlify/functions/study-adult-review-scheduled-worker.test.js`
  - `M` `netlify/functions/study-adult-review-worker.js`
- Migration files (0):
  - None.
- Test additions (1): `netlify/functions/study-adult-review-scheduled-worker.test.js`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-production-client-controller</code> — 5efb261b8</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-production-client-controller`; state: **clean**; upstream: —.
- HEAD: `5efb261b88ecdfa2422621fdf169223805859b7b` — study: add production client controller
- Comparison base: `ac3e7518cba4decfb29c93b85a79010954925955` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `5efb261b88ecdfa2422621fdf169223805859b7b` study: add production client controller
- Changed paths (7):
  - `A` `src/study/client/studyProductionSessionClient.test.ts`
  - `A` `src/study/client/studyProductionSessionClient.ts`
  - `M` `src/study/contracts/production/index.ts`
  - `A` `src/study/contracts/production/session.ts`
  - `M` `src/study/production/index.ts`
  - `A` `src/study/production/sessionController.test.ts`
  - `A` `src/study/production/sessionController.ts`
- Migration files (0):
  - None.
- Test additions (2): `src/study/client/studyProductionSessionClient.test.ts`, `src/study/production/sessionController.test.ts`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-production-core-r3</code> — 01237423f</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-production-core-r3`; state: **clean**; upstream: —.
- HEAD: `01237423fbf5ea6e34850174c8827fceaf010820` — study: integrate production session authority
- Comparison base: `a2a514b585690313903f3a624e7036eaec69b2a9` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-terminal-descendant**; terminal line `win/final-study-rc1`.
- Commits in range (4; globally exclusive to this `win/*` ref: 0):
  - `5e681fac4babab48883cbea035422eb7f0902081` admin-16a: bootstrap immutable curriculum release registry
  - `6a14c176599cf1cd4f9d3aae7a3407a0ba2239a6` study: implement authoritative session semantics v2
  - `fafce57b074b64fdbc04da9feb3313e3e2a4709a` study: bind curriculum authority to release registry
  - `01237423fbf5ea6e34850174c8827fceaf010820` study: integrate production session authority
- Changed paths (24):
  - `M` `MIGRATIONS.md`
  - `A` `docs/admin-console/curriculum-release-registry-migration.json`
  - `A` `docs/admin-console/curriculum-release-registry.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `A` `docs/study-release-registry-bridge.md`
  - `A` `netlify/functions/_shared/admin-curriculum-registry-reader.js`
  - `A` `netlify/functions/_shared/admin-curriculum-registry-reader.test.js`
  - `M` `netlify/functions/_shared/study-production/readiness.js`
  - `M` `netlify/functions/_shared/study-production/readiness.test.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js`
  - `M` `netlify/functions/admin-curriculum.js`
  - `M` `netlify/functions/admin-curriculum.test.js`
  - `M` `netlify/functions/study-production-readiness.js`
  - `A` `scripts/generate-curriculum-release-registry.mjs`
  - `M` `src/study/client/studyIdentityClient.ts`
  - `M` `src/study/generated/studyDatabase.ts`
  - `M` `src/study/production/verifiedRuntimeAdapter.ts`
  - `A` `supabase/academy-curriculum-release-registry.db.test.ts`
  - `A` `supabase/migrations/20260809160000_academy_curriculum_release_registry.sql`
  - `A` `supabase/migrations/20260810151000_academy_study_session_semantics_v2.sql`
  - `A` `supabase/migrations/20260810153000_academy_study_release_registry_bridge.sql`
  - `M` `supabase/study-curriculum-binding.db.test.ts`
  - `A` `supabase/study-session-semantics-v2.db.test.ts`
- Migration files (3):
  - `A` `supabase/migrations/20260809160000_academy_curriculum_release_registry.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810151000_academy_study_session_semantics_v2.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810153000_academy_study_release_registry_bridge.sql`; explicit migration dependencies: `20260810150000_academy_study_curriculum_binding`.
- Test additions (3): `netlify/functions/_shared/admin-curriculum-registry-reader.test.js`, `supabase/academy-curriculum-release-registry.db.test.ts`, `supabase/study-session-semantics-v2.db.test.ts`.
- Documentation additions (3): `docs/admin-console/curriculum-release-registry-migration.json`, `docs/admin-console/curriculum-release-registry.md`, `docs/study-release-registry-bridge.md`.

</details>

<details><summary><code>win/study-production-mount-r5</code> — 87a21b748</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-production-mount-r5`; state: **clean**; upstream: —.
- HEAD: `87a21b748d8855fc814435551c4d65e47f3ff126` — study: mount hardened production learner workspace
- Comparison base: `27254fd65db26e820eb88bf714bb7db9a7376541` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-terminal-descendant**; terminal line `win/final-study-rc1`.
- Commits in range (3; globally exclusive to this `win/*` ref: 0):
  - `18313753cea0cf4bcec1014196128eb23b12db96` fix(study): harden production authority boundary
  - `db1857642f1030b66fdc50052184cb3b6d8335d3` study: build production learner workspace shell
  - `87a21b748d8855fc814435551c4d65e47f3ff126` study: mount hardened production learner workspace
- Changed paths (17):
  - `A` `docs/study-production-security-adversarial-r4.md`
  - `A` `netlify/functions/_shared/study-runtime/verified-academic-runtime.adversarial.test.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`
  - `M` `src/App.studyRouteLifecycle.test.tsx`
  - `M` `src/App.tsx`
  - `M` `src/components/HighSchoolHome.tsx`
  - `M` `src/components/academy/AcademyRouter.levels.test.tsx`
  - `M` `src/components/academy/AcademyRouter.tsx`
  - `A` `src/components/study/StudyProductionRoute.test.tsx`
  - `A` `src/components/study/StudyProductionRoute.tsx`
  - `A` `src/components/study/StudyProductionWorkspace.mounted.test.tsx`
  - `A` `src/components/study/StudyProductionWorkspace.test.tsx`
  - `A` `src/components/study/StudyProductionWorkspace.tsx`
  - `A` `src/components/study/study-production-workspace.css`
  - `M` `src/studyEngineRoute.test.ts`
  - `M` `src/studyEngineRoute.ts`
  - `A` `supabase/study-production-security-adversarial.db.test.ts`
- Migration files (0):
  - None.
- Test additions (5): `netlify/functions/_shared/study-runtime/verified-academic-runtime.adversarial.test.js`, `src/components/study/StudyProductionRoute.test.tsx`, `src/components/study/StudyProductionWorkspace.mounted.test.tsx`, `src/components/study/StudyProductionWorkspace.test.tsx`, `supabase/study-production-security-adversarial.db.test.ts`.
- Documentation additions (1): `docs/study-production-security-adversarial-r4.md`.

</details>

<details><summary><code>win/study-production-smoke-harness</code> — a3c9a9483</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-production-smoke-harness`; state: **clean**; upstream: —.
- HEAD: `a3c9a9483fde5054ac9b7606d34ae0d8863a8630` — test(study): add local production smoke harness
- Comparison base: `27254fd65db26e820eb88bf714bb7db9a7376541` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `a3c9a9483fde5054ac9b7606d34ae0d8863a8630` test(study): add local production smoke harness
- Changed paths (9):
  - `A` `docs/study-production-local-smoke.md`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js`
  - `M` `package.json`
  - `A` `scripts/fixtures/study-production-local-smoke.sql`
  - `A` `scripts/study-production-local-smoke.cli.test.js`
  - `A` `scripts/study-production-local-smoke.mjs`
  - `A` `scripts/study-production-local-smoke.vitest.config.mjs`
  - `A` `tests/study-production-local-smoke-harness.test.js`
- Migration files (0):
  - None.
- Test additions (2): `scripts/study-production-local-smoke.cli.test.js`, `tests/study-production-local-smoke-harness.test.js`.
- Documentation additions (1): `docs/study-production-local-smoke.md`.

</details>

<details><summary><code>win/study-production-ux-shell</code> — 3b4a2ab75</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-production-ux-shell`; state: **clean**; upstream: —.
- HEAD: `3b4a2ab758285222d8dd03e45eec05dcd0a55534` — study: build production learner workspace shell
- Comparison base: `5efb261b88ecdfa2422621fdf169223805859b7b` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `3b4a2ab758285222d8dd03e45eec05dcd0a55534` study: build production learner workspace shell
- Changed paths (4):
  - `A` `src/components/study/StudyProductionWorkspace.mounted.test.tsx`
  - `A` `src/components/study/StudyProductionWorkspace.test.tsx`
  - `A` `src/components/study/StudyProductionWorkspace.tsx`
  - `A` `src/components/study/study-production-workspace.css`
- Migration files (0):
  - None.
- Test additions (2): `src/components/study/StudyProductionWorkspace.mounted.test.tsx`, `src/components/study/StudyProductionWorkspace.test.tsx`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-provider-cost-accounting</code> — 16c4c82ad</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-provider-cost-accounting`; state: **clean**; upstream: —.
- HEAD: `16c4c82ad000b3bbef34efdb5cbfc096da8dade4` — study: admit safety provider cost accounting
- Comparison base: `0ca0d2db3b0f13ddf6cd220bbaeabe7e9e8ebc1a` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-admin-delta-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `16c4c82ad000b3bbef34efdb5cbfc096da8dade4` study: admit safety provider cost accounting
- Changed paths (12):
  - `M` `MIGRATIONS.md`
  - `M` `docs/academy-ai-cost-accounting.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `A` `docs/study-provider-cost-accounting.md`
  - `M` `netlify/functions/_shared/admin-cost-aggregate.js`
  - `M` `netlify/functions/_shared/admin-cost-aggregate.test.js`
  - `M` `netlify/functions/_shared/admin-cost-projection.js`
  - `M` `netlify/functions/_shared/admin-cost-projection.test.js`
  - `M` `src/admin/costsModel.test.ts`
  - `M` `src/admin/costsModel.ts`
  - `A` `supabase/academy-study-provider-cost-accounting.db.test.ts`
  - `A` `supabase/migrations/20260810141000_academy_study_provider_cost_accounting.sql`
- Migration files (1):
  - `A` `supabase/migrations/20260810141000_academy_study_provider_cost_accounting.sql`; explicit migration dependencies: none explicitly named.
- Test additions (1): `supabase/academy-study-provider-cost-accounting.db.test.ts`.
- Documentation additions (1): `docs/study-provider-cost-accounting.md`.

</details>

<details><summary><code>win/study-recovery-chaos-gate</code> — 50ae5c05a</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-recovery-chaos-gate`; state: **clean**; upstream: —.
- HEAD: `50ae5c05a09e12e2e573dfe9ecf984f95a7badc0` — fix(study): harden production recovery
- Comparison base: `27254fd65db26e820eb88bf714bb7db9a7376541` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `50ae5c05a09e12e2e573dfe9ecf984f95a7badc0` fix(study): harden production recovery
- Changed paths (4):
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js`
  - `M` `src/study/production/sessionController.test.ts`
  - `M` `src/study/production/sessionController.ts`
  - `A` `src/study/production/studyRecoveryChaos.test.ts`
- Migration files (0):
  - None.
- Test additions (1): `src/study/production/studyRecoveryChaos.test.ts`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-release-registry-bridge</code> — 01baf7b9e</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-release-registry-bridge`; state: **clean**; upstream: —.
- HEAD: `01baf7b9e4d8560d43de3fd36710eca0372bebf0` — study: bind curriculum authority to release registry
- Comparison base: `a2a514b585690313903f3a624e7036eaec69b2a9` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (2; globally exclusive to this `win/*` ref: 0):
  - `735a4cae0b83f3a80bb8c153eb98090e778e229f` admin-16a: bootstrap immutable curriculum release registry
  - `01baf7b9e4d8560d43de3fd36710eca0372bebf0` study: bind curriculum authority to release registry
- Changed paths (15):
  - `M` `MIGRATIONS.md`
  - `A` `docs/admin-console/curriculum-release-registry-migration.json`
  - `A` `docs/admin-console/curriculum-release-registry.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `A` `docs/study-release-registry-bridge.md`
  - `A` `netlify/functions/_shared/admin-curriculum-registry-reader.js`
  - `A` `netlify/functions/_shared/admin-curriculum-registry-reader.test.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js`
  - `M` `netlify/functions/admin-curriculum.js`
  - `M` `netlify/functions/admin-curriculum.test.js`
  - `A` `scripts/generate-curriculum-release-registry.mjs`
  - `A` `supabase/academy-curriculum-release-registry.db.test.ts`
  - `A` `supabase/migrations/20260809160000_academy_curriculum_release_registry.sql`
  - `A` `supabase/migrations/20260810153000_academy_study_release_registry_bridge.sql`
  - `M` `supabase/study-curriculum-binding.db.test.ts`
- Migration files (2):
  - `A` `supabase/migrations/20260809160000_academy_curriculum_release_registry.sql`; explicit migration dependencies: none explicitly named.
  - `A` `supabase/migrations/20260810153000_academy_study_release_registry_bridge.sql`; explicit migration dependencies: `20260810150000_academy_study_curriculum_binding`.
- Test additions (2): `netlify/functions/_shared/admin-curriculum-registry-reader.test.js`, `supabase/academy-curriculum-release-registry.db.test.ts`.
- Documentation additions (3): `docs/admin-console/curriculum-release-registry-migration.json`, `docs/admin-console/curriculum-release-registry.md`, `docs/study-release-registry-bridge.md`.

</details>

<details><summary><code>win/study-security-adversarial-r4</code> — 0841d4a50</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-security-adversarial-r4`; state: **clean**; upstream: —.
- HEAD: `0841d4a50e02cb0406331ab962d21824b4bc3bc7` — fix(study): harden production authority boundary
- Comparison base: `01237423fbf5ea6e34850174c8827fceaf010820` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `0841d4a50e02cb0406331ab962d21824b4bc3bc7` fix(study): harden production authority boundary
- Changed paths (4):
  - `A` `docs/study-production-security-adversarial-r4.md`
  - `A` `netlify/functions/_shared/study-runtime/verified-academic-runtime.adversarial.test.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`
  - `A` `supabase/study-production-security-adversarial.db.test.ts`
- Migration files (0):
  - None.
- Test additions (2): `netlify/functions/_shared/study-runtime/verified-academic-runtime.adversarial.test.js`, `supabase/study-production-security-adversarial.db.test.ts`.
- Documentation additions (1): `docs/study-production-security-adversarial-r4.md`.

</details>

<details><summary><code>win/study-session-semantics-v2</code> — ac3e7518c</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-session-semantics-v2`; state: **clean**; upstream: —.
- HEAD: `ac3e7518cba4decfb29c93b85a79010954925955` — study: implement authoritative session semantics v2
- Comparison base: `a2a514b585690313903f3a624e7036eaec69b2a9` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `ac3e7518cba4decfb29c93b85a79010954925955` study: implement authoritative session semantics v2
- Changed paths (11):
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `M` `netlify/functions/_shared/study-production/readiness.js`
  - `M` `netlify/functions/_shared/study-production/readiness.test.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.js`
  - `M` `netlify/functions/_shared/study-runtime/verified-academic-runtime.test.js`
  - `M` `netlify/functions/study-production-readiness.js`
  - `M` `src/study/client/studyIdentityClient.ts`
  - `M` `src/study/generated/studyDatabase.ts`
  - `M` `src/study/production/verifiedRuntimeAdapter.ts`
  - `A` `supabase/migrations/20260810151000_academy_study_session_semantics_v2.sql`
  - `A` `supabase/study-session-semantics-v2.db.test.ts`
- Migration files (1):
  - `A` `supabase/migrations/20260810151000_academy_study_session_semantics_v2.sql`; explicit migration dependencies: none explicitly named.
- Test additions (1): `supabase/study-session-semantics-v2.db.test.ts`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-session-telemetry-outbox</code> — 01095378f</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-session-telemetry-outbox`; state: **clean**; upstream: —.
- HEAD: `01095378f4b0ed17c537b63498aaf9f8590277ca` — study: add durable session telemetry outbox
- Comparison base: `ac3e7518cba4decfb29c93b85a79010954925955` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `01095378f4b0ed17c537b63498aaf9f8590277ca` study: add durable session telemetry outbox
- Changed paths (13):
  - `M` `MIGRATIONS.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `A` `docs/study-session-telemetry-outbox.md`
  - `A` `netlify/functions/_shared/operational-telemetry-writer.js`
  - `A` `netlify/functions/_shared/operational-telemetry-writer.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/outbox-store.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/outbox-store.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/production.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/production.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/worker.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/worker.test.js`
  - `A` `supabase/migrations/20260810155000_academy_study_session_telemetry_outbox.sql`
  - `A` `supabase/study-session-telemetry-outbox.db.test.ts`
- Migration files (1):
  - `A` `supabase/migrations/20260810155000_academy_study_session_telemetry_outbox.sql`; explicit migration dependencies: none explicitly named.
- Test additions (5): `netlify/functions/_shared/operational-telemetry-writer.test.js`, `netlify/functions/_shared/study-session-telemetry/outbox-store.test.js`, `netlify/functions/_shared/study-session-telemetry/production.test.js`, `netlify/functions/_shared/study-session-telemetry/worker.test.js`, `supabase/study-session-telemetry-outbox.db.test.ts`.
- Documentation additions (1): `docs/study-session-telemetry-outbox.md`.

</details>

<details><summary><code>win/study-telemetry-delivery-worker</code> — fa1e3e3f7</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-telemetry-delivery-worker`; state: **clean**; upstream: —.
- HEAD: `fa1e3e3f7c5d846ba6e516d8e16e2a4c391f6c2d` — study: deliver session telemetry outbox
- Comparison base: `01095378f4b0ed17c537b63498aaf9f8590277ca` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `fa1e3e3f7c5d846ba6e516d8e16e2a4c391f6c2d` study: deliver session telemetry outbox
- Changed paths (12):
  - `M` `docs/study-session-telemetry-outbox.md`
  - `A` `netlify/functions/_shared/study-session-telemetry/entrypoint.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/entrypoint.test.js`
  - `M` `netlify/functions/_shared/study-session-telemetry/outbox-store.js`
  - `M` `netlify/functions/_shared/study-session-telemetry/outbox-store.test.js`
  - `M` `netlify/functions/_shared/study-session-telemetry/production.js`
  - `M` `netlify/functions/_shared/study-session-telemetry/production.test.js`
  - `M` `netlify/functions/_shared/study-session-telemetry/worker.js`
  - `M` `netlify/functions/_shared/study-session-telemetry/worker.test.js`
  - `M` `package.json`
  - `A` `scripts/deliver-study-session-telemetry.mjs`
  - `M` `src/telemetry/supabaseOperationalTelemetry.ts`
- Migration files (0):
  - None.
- Test additions (1): `netlify/functions/_shared/study-session-telemetry/entrypoint.test.js`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-telemetry-invocation</code> — 833860eb1</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-telemetry-invocation`; state: **clean**; upstream: —.
- HEAD: `833860eb1d70121f9bc8c58f985b49f4c6d93788` — study: authorize telemetry delivery invocation
- Comparison base: `fa1e3e3f7c5d846ba6e516d8e16e2a4c391f6c2d` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `833860eb1d70121f9bc8c58f985b49f4c6d93788` study: authorize telemetry delivery invocation
- Changed paths (13):
  - `M` `docs/study-session-telemetry-outbox.md`
  - `M` `netlify.toml`
  - `M` `netlify/functions/_shared/operational-telemetry-writer.js`
  - `M` `netlify/functions/_shared/operational-telemetry-writer.test.js`
  - `M` `netlify/functions/_shared/study-session-telemetry/entrypoint.js`
  - `M` `netlify/functions/_shared/study-session-telemetry/entrypoint.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/invocation-readiness.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/invocation-readiness.test.js`
  - `M` `netlify/functions/_shared/study-session-telemetry/production.test.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/scheduled.js`
  - `A` `netlify/functions/_shared/study-session-telemetry/scheduled.test.js`
  - `A` `netlify/functions/study-session-telemetry-deliver.js`
  - `A` `netlify/functions/study-session-telemetry-deliver.test.js`
- Migration files (0):
  - None.
- Test additions (3): `netlify/functions/_shared/study-session-telemetry/invocation-readiness.test.js`, `netlify/functions/_shared/study-session-telemetry/scheduled.test.js`, `netlify/functions/study-session-telemetry-deliver.test.js`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-worker-production-composition</code> — e09770aa8</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-worker-production-composition`; state: **clean**; upstream: —.
- HEAD: `e09770aa8e68c1a675729c592330da87951143d7` — study: compose production adult review worker
- Comparison base: `a2a514b585690313903f3a624e7036eaec69b2a9` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `e09770aa8e68c1a675729c592330da87951143d7` study: compose production adult review worker
- Changed paths (29):
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `A` `netlify/functions/_shared/study-adult-review-operations/composition.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/composition.test.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/supabase-operations.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/supabase-operations.test.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/worker.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/worker.test.js`
  - `M` `netlify/functions/_shared/study-adult-review/delivery.js`
  - `M` `netlify/functions/_shared/study-adult-review/guardian-notifications.js`
  - `M` `netlify/functions/_shared/study-adult-review/memory-store.js`
  - `M` `netlify/functions/_shared/study-adult-review/outbox-worker.js`
  - `A` `netlify/functions/_shared/study-delivery/durable-identifier-contract.test.js`
  - `M` `netlify/functions/_shared/study-delivery/external-provider.js`
  - `M` `netlify/functions/_shared/study-delivery/external-provider.test.js`
  - `M` `netlify/functions/_shared/study-delivery/in-app-provider.js`
  - `M` `netlify/functions/_shared/study-delivery/in-app-provider.test.js`
  - `A` `netlify/functions/_shared/study-delivery/in-app-receipt-validator.js`
  - `A` `netlify/functions/_shared/study-delivery/in-app-receipt-validator.test.js`
  - `M` `netlify/functions/_shared/study-delivery/receipt-contract.js`
  - `A` `netlify/functions/_shared/study-delivery/server-identifier-hardening.test.js`
  - `M` `netlify/functions/_shared/study-delivery/supabase-in-app.js`
  - `M` `netlify/functions/_shared/study-delivery/supabase-in-app.test.js`
  - `A` `netlify/functions/_shared/study-worker/credential.js`
  - `A` `netlify/functions/_shared/study-worker/credential.test.js`
  - `M` `netlify/functions/study-adult-review-worker.js`
  - `A` `supabase/migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql`
  - `A` `supabase/migrations/20260810152100_academy_study_worker_operations_contract.sql`
  - `M` `supabase/study-engine-adult-review.db.test.ts`
  - `A` `supabase/study-engine-in-app-receipt-timestamp.db.test.ts`
- Migration files (2):
  - `A` `supabase/migrations/20260810152000_academy_study_in_app_receipt_timestamp.sql`; explicit migration dependencies: `20260801170000_academy_study_adult_review_operations`, `20260801190000_academy_study_final_production_reconciliation`, `20260810120000_academy_study_effective_settings_v2`, `20260810150000_academy_study_curriculum_binding`.
  - `A` `supabase/migrations/20260810152100_academy_study_worker_operations_contract.sql`; explicit migration dependencies: `20260801010000_academy_study_engine_storage`, `20260801011000_academy_study_engine_authorization`, `20260801012000_academy_study_engine_production_reconciliation`, `20260801160000_academy_study_verified_identity`, `20260801170000_academy_study_adult_review_operations`, `20260801190000_academy_study_final_production_reconciliation`, `20260810120000_academy_study_effective_settings_v2`, `20260810150000_academy_study_curriculum_binding`, `20260810152000_academy_study_in_app_receipt_timestamp`.
- Test additions (7): `netlify/functions/_shared/study-adult-review-operations/composition.test.js`, `netlify/functions/_shared/study-adult-review-operations/supabase-operations.test.js`, `netlify/functions/_shared/study-delivery/durable-identifier-contract.test.js`, `netlify/functions/_shared/study-delivery/in-app-receipt-validator.test.js`, `netlify/functions/_shared/study-delivery/server-identifier-hardening.test.js`, `netlify/functions/_shared/study-worker/credential.test.js`, `supabase/study-engine-in-app-receipt-timestamp.db.test.ts`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-worker-run-evidence</code> — e97c80beb</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-worker-run-evidence`; state: **clean**; upstream: —.
- HEAD: `e97c80beb3d7c73ebc24b2a243fdf0d45a8e5e76` — study: persist adult review worker run evidence
- Comparison base: `96fac0361e174225ca345d5253852ed6ba056236` (oldest reflog entry (branch creation point)).
- Classification: **superseded-by-replayed-terminal-line**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 1):
  - `e97c80beb3d7c73ebc24b2a243fdf0d45a8e5e76` study: persist adult review worker run evidence
- Changed paths (11):
  - `M` `netlify/functions/_shared/study-adult-review-operations/composition.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/composition.test.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/entrypoint-result.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/run-evidence.js`
  - `A` `netlify/functions/_shared/study-adult-review-operations/run-evidence.test.js`
  - `M` `netlify/functions/_shared/study-adult-review-operations/worker.test.js`
  - `M` `netlify/functions/study-adult-review-scheduled-worker.js`
  - `M` `netlify/functions/study-adult-review-scheduled-worker.test.js`
  - `M` `netlify/functions/study-adult-review-worker.js`
  - `A` `supabase/migrations/20260810159000_academy_study_worker_run_evidence.sql`
  - `A` `supabase/study-worker-run-evidence.db.test.ts`
- Migration files (1):
  - `A` `supabase/migrations/20260810159000_academy_study_worker_run_evidence.sql`; explicit migration dependencies: none explicitly named.
- Test additions (2): `netlify/functions/_shared/study-adult-review-operations/run-evidence.test.js`, `supabase/study-worker-run-evidence.db.test.ts`.
- Documentation additions (0): none.

</details>

<details><summary><code>win/study-worker-schedule</code> — cf996198e</summary>

- Worktree: `C:/Users/Empower Gaming/manuel-academy-dev/admin-worktrees/win-study-worker-schedule`; state: **clean**; upstream: —.
- HEAD: `cf996198ef9dd6594cc4ed71c0fc6c73002b17e8` — study: implement effective settings v2
- Comparison base: `d65d1511dd602db586a204bb7ccb2800fd7a89e2` (exact-tip alias of win/study-effective-settings-v2; using its creation point).
- Classification: **superseded-by-terminal-descendant**; terminal line `win/final-study-rc1`.
- Commits in range (1; globally exclusive to this `win/*` ref: 0):
  - `cf996198ef9dd6594cc4ed71c0fc6c73002b17e8` study: implement effective settings v2
- Changed paths (15):
  - `M` `MIGRATIONS.md`
  - `A` `docs/study-effective-settings-v2.md`
  - `M` `docs/study-engine-final-production/migration-manifest.json`
  - `M` `docs/study-engine-production-reconciliation/12-production-readiness-matrix.md`
  - `M` `netlify/functions/_shared/study-production/readiness.js`
  - `M` `netlify/functions/_shared/study-production/readiness.test.js`
  - `M` `netlify/functions/study-production-readiness.js`
  - `M` `src/study/contracts/persistence/ports.ts`
  - `A` `src/study/effectiveSettings.test.ts`
  - `A` `src/study/effectiveSettings.ts`
  - `M` `src/study/generated/studyDatabase.ts`
  - `A` `src/study/persistence/SupabaseStudyParentSettingsAdapter.test.ts`
  - `M` `src/study/persistence/SupabaseStudyParentSettingsAdapter.ts`
  - `A` `supabase/migrations/20260810120000_academy_study_effective_settings_v2.sql`
  - `A` `supabase/study-effective-settings-v2.db.test.ts`
- Migration files (1):
  - `A` `supabase/migrations/20260810120000_academy_study_effective_settings_v2.sql`; explicit migration dependencies: none explicitly named.
- Test additions (3): `src/study/effectiveSettings.test.ts`, `src/study/persistence/SupabaseStudyParentSettingsAdapter.test.ts`, `supabase/study-effective-settings-v2.db.test.ts`.
- Documentation additions (1): `docs/study-effective-settings-v2.md`.

</details>

## Method and hold boundary

- Ref tips were captured first and all branch analysis was performed against immutable SHAs. The complete ref digest was recomputed before output; generation aborts if any ref changes mid-run.
- Worktree cleanliness was read with `git status --porcelain=v1 -z --untracked-files=all` in every registered worktree. The complete worktree-state digest was also recomputed before output; generation aborts if any worktree changes mid-run.
- “Exclusive commits” are commits in the branch comparison range contained by no other local `win/*` ref at the snapshot.
- Supersession evidence distinguishes literal ancestry, patch equivalence (`git cherry`), exact-tip aliases, and subject-matched conflict-resolved replays.
- No network fetch was performed, so remote-tracking refs are the locally registered values only.
- This task makes no integration change. The inventory files are committed locally and held; no push, merge, deployment, or hosted database action is authorized.

**WINDOWS_FINAL_INTEGRATION_INVENTORY_READY**

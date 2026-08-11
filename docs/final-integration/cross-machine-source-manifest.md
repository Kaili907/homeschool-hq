# Cross-machine final integration source manifest

Classification: **CROSS_MACHINE_SOURCE_MANIFEST_READY**

This is a read-only product-source inventory for the final Manuel Academy integration. Git objects, refs, ancestry, stable patch IDs, changed paths, migration paths, and blob OIDs were verified independently on Windows after `git fetch origin --prune`. The Mac provenance audit is supporting evidence only; its product-provenance claims were not accepted without a corresponding Git check where the source object was available.

## Verification boundary

- Repository: `https://github.com/Kaili907/homeschool-hq.git`
- Inventory branch: `win/final-cross-machine-source-verifier`
- Required and observed starting HEAD: `a438b00e8ae6a78ba16b69a73767279d3393bd3e`
- Inventory worktree: registered at the requested path and clean before fetch
- Fetch: `git fetch origin --prune` completed successfully
- Shared comparison baseline: `d65d1511dd602db586a204bb7ccb2800fd7a89e2`
- Product-source mutations: none
- Hosted Supabase / deploy / push / merge / rebase / reset / cherry-pick: none

## Authoritative final sources

Every named ref resolves exactly to the requested commit object.

| Role | Exact ref | Exact SHA | Parent | Subject |
| --- | --- | --- | --- | --- |
| Mac Final RC4 | `refs/remotes/origin/mac/admin-final-rc4-assembly` | `6f952509236daa4e17849c4a5399241e42816553` | `d630456883a33d01a30eb1b18d55b8506645db90` | `admin: assemble provenance-corrected RC4` |
| Mac provenance audit | `refs/remotes/origin/mac/admin-final-rc3-provenance-audit` | `d6a0754d9acd1192ba9a2037fe2fc077441ba080` | `af84dee724088e4f61e4bf84fc17c75adb61e0fa` | `docs: audit Mac RC3 source provenance` |
| Windows Final Study RC1 | `refs/heads/win/final-study-rc1` | `f93f0736b48736252e0678f9b57ce83652e2dab5` | `8ef764772c43f63b08403248c1e98273c35c5f4f` | `fix(study): enforce session timestamp coherence` |
| Windows Final Admin Delta RC1 | `refs/heads/win/final-admin-delta-rc1` | `ae2c9b32445a59b82a972f3b67af8ea11dc50b79` | `e3f62dced44b8ddd7e932ec992756a39f30f3495` | `integrate: finalize Windows Admin delta RC1` |

Both registered Windows final-source worktrees were clean when checked. The audit commit is a parallel child of RC3, not an RC4 ancestor: its merge base with RC4 is its parent `af84dee...`. It is evidence, not a product integration input.

## Ancestry, patch equivalence, and supersession proof

### Final-tip ancestry

- Mac RC1 `4e404e7...`, RC2 `053b565...`, and RC3 `af84dee...` are exact ancestors of RC4.
- Prior Study RC tip `8ef7647...` is the direct parent of `f93f073...`; Study Production Mount R5 `87a21b7...` is also an exact ancestor.
- Prior Admin Delta tip `e3f62dc...` is the direct parent of `ae2c9b3...`; ADMIN-14B `e43a132...` is also an exact ancestor.
- No final tip is an ancestor of either of the other two final tips.
- Merge bases and left/right commit counts are:

| Pair | Merge base | Left / right unique commits |
| --- | --- | ---: |
| Mac RC4 / Study RC1 | `d65d1511dd602db586a204bb7ccb2800fd7a89e2` | 62 / 21 |
| Mac RC4 / Admin Delta RC1 | `b948b3fd6552221eeb3883c8e7cc924129ad616a` | 57 / 26 |
| Study RC1 / Admin Delta RC1 | `d65d1511dd602db586a204bb7ccb2800fd7a89e2` | 21 / 31 |

### RC4 transferred production corrections

RC4 contains a linear six-commit extension of RC3: five correction replays followed by the RC4 assembly commit. Each replay is an exact RC4 ancestor, has the same subject as its source, and records the source SHA in a `(cherry picked from commit ...)` trailer.

Whole-commit stable patch IDs differ because the changes were replayed onto RC3 and reconciled with the composed tree. The stronger scoped result is shown below: most source-owned paths retain identical stable per-path patches; the remaining paths are integration-adjusted. Four replays preserve the exact changed-path set. The DB replay omits the source's `supabase/academy-cas.db.test.ts` PGlite-socket workaround and retains RC3's different in-process PGlite harness blob; this is an explicit test-harness integration adjustment, not patch equivalence.

| Transferred source | RC4 replay | Source / replay stable patch ID | Exact per-path patches | Result |
| --- | --- | --- | ---: | --- |
| `origin/mac/admin-api-contract-fuzz` `5de0065...` | `d78f8d8...` | `202d8ce...` / `2c024de...` | 16 / 17 | integration-adjusted at `netlify/functions/admin-curriculum.js` |
| `origin/mac/admin-browser-cache-compat` `c7a2ce0...` | `13a6ef2...` | `7552f7d...` / `d960341...` | 15 / 18 | integration-adjusted package manifests and Admin CSS |
| `origin/mac/admin-time-boundary-audit` `cb6f954...` | `fdbdca1...` | `5c5b8a3...` / `9698603...` | 29 / 32 | integration-adjusted correlations and curriculum-history model paths; both SQL patches are exact |
| `origin/mac/admin-failure-chaos` `5ee417c...` | `bf12ef5...` | `0b808aa...` / `2de50ec...` | 40 / 43 | integration-adjusted authorization, curriculum HTTP source, and Admin route |
| `origin/mac/admin-db-security-audit` `47c315f...` | `d630456...` | `cd216c0...` / `6e7b615...` | 5 / 7 | migration and audit script patches exact; manifest integrated; already-present CAS postimage omitted |

The final `6f952509...` assembly commit reconciles six shared paths: `package.json`, `package-lock.json`, `src/admin/authorization.ts`, `src/admin/authorization.test.ts`, `src/admin/curriculum/httpSource.ts`, and `supabase/admin-database-security.db.test.ts`.

### Windows constituent replay proof

The Windows final refs supersede their constituent tips. Git independently reproduced these stable patch matches, and each replay is an ancestor of the indicated final ref:

| Source -> replay | Stable patch ID |
| --- | --- |
| `50ae5c0...` Study recovery -> `dcfb37f...` in Study final | `2a86a5cb7638a9e108eac40b5e6b583973afc27c` |
| `e97c80b...` worker evidence -> `6f4994a...` in Study final | `5df914cbdf39e0ea46c671ebaa88e5a6b5cb2c73` |
| `e97c80b...` worker evidence -> `3628350...` in Admin final | `5df914cbdf39e0ea46c671ebaa88e5a6b5cb2c73` |
| `de3d81f...` Costs browser -> `37f2263...` in Admin final | `0a144231e3549544de644e2c784f7c5e9a6783ad` |
| `7e9d0c6...` Study Operations evidence -> `44282b5...` in Admin final | `07d83e86927d3c11bc320de6850a316442515ef4` |
| `c72f991...` System Health aggregate -> `475203f...` in Admin final | `569f1ffa0ca7681326c7f695ece507b690b25811` |
| `28ce1a9...` unified preflight -> `e3f62dc...` in Admin final | `791dcfab69461646ffb260123117e5dd2546e260` |

Telemetry invocation `833860e...` is an integration-adjusted replay at `62e06df...` in Study final: both commits touch the same 13 paths, but their whole stable patch IDs differ (`6dcb053...` versus `73fe751...`) because `netlify.toml` already carried the scheduled worker block.

### Former missing Mac constituents

The seven historical SHA objects and six historical leaf refs recorded by the blocked report are still not advertised. They are no longer required integration inputs: RC4 is the authoritative composed source, and the corresponding replacement commits are exact RC4 ancestors. The audit additionally records exact or integration-adjusted provenance for the source lines it inspected. Because the original objects are absent on Windows, no new claim of literal ancestry or whole-patch equivalence is made for those historical SHA objects.

Replacement ancestry includes:

- curriculum authoring `f9ecb3b...`, Studio shell `20a604c...`, validation `f952423...`, Studio integration `a640bd1...`, preview/diff `1862d65...`, and workflow/release staging `307588a...`;
- provider attempt foundation `32f9f6b...` and gateway journaling `fcf67a7...`;
- R2 configuration UI `79ae45a...`, audit UX `f5acc32...`, dashboard integration `1d24076...`, and engine aggregate `2a107b3...`.

The provenance audit's two directly indexed historical source lines agree with the RC history: Provider Attempt Journal maps to stable-patch-equivalent `32f9f6b...`, and Curriculum 16B maps to integration-adjusted `f9ecb3b...`; both replacements are RC4 ancestors.

## Minimum final integration source set

The minimum source-tip set is exactly:

1. `origin/mac/admin-final-rc4-assembly@6f952509236daa4e17849c4a5399241e42816553`
2. `win/final-study-rc1@f93f0736b48736252e0678f9b57ce83652e2dab5`
3. `win/final-admin-delta-rc1@ae2c9b32445a59b82a972f3b67af8ea11dc50b79`

Do not separately integrate RC3, the five transferred Mac correction branches, the old Mac constituents, or the Windows constituent branches. The audit ref remains supporting documentation only. Final integration must reconcile the three divergent tips and their overlaps once.

## Final changed-path overlap

Against common baseline `d65d151...`:

| Source | Changed paths |
| --- | ---: |
| Mac RC4 | 418 |
| Study RC1 | 143 |
| Admin Delta RC1 | 231 |

| Intersection | Paths |
| --- | ---: |
| Mac / Study | 15 |
| Mac / Admin | 105 |
| Study / Admin | 64 |
| All three | 6 |

The six triple-touch hotspots are `MIGRATIONS.md`, `docs/study-engine-final-production/migration-manifest.json`, `netlify.toml`, `package.json`, and the operational telemetry writer implementation/test pair.

Additional high-risk areas:

- Mac / Admin: Admin routing and console CSS/components, authorization/configuration/audit/cost/health sources, provider gateway functions, package/build configuration, and foundational Admin SQL.
- Study / Admin: adult-review worker and delivery code, Study persistence/contracts, `src/study/generated/studyDatabase.ts`, deployment configuration, and shared Study SQL.
- Mac / Study: curriculum release registry, telemetry writer, curriculum Admin endpoint, package/deployment configuration, and migration documentation.

The JSON companion contains the complete exact path arrays for all three pairwise intersections and the triple intersection.

## Migration-producing sources and collision hotspots

- Mac RC4 adds 22 SQL paths relative to the common baseline. Within the transferred correction set, Time Boundary modifies `20260809120000_academy_operational_telemetry_foundation.sql` and `20260810180000_academy_admin_correlation_runtime_read.sql`; DB Security adds `20260810190000_academy_curriculum_write_reauthorization.sql`.
- Study RC1 adds 11 SQL paths, including final-tip addition `20260810159100_academy_study_session_timestamp_coherence.sql`.
- Admin Delta RC1 adds 13 final SQL paths. Its final tip replaces the duplicate `20260810120000` Study/provider names with `20260810120200` and `20260810120300`, and modifies the `20260810152000` and `20260810152100` SQL blobs.

Same-path overlap is not uniformly byte-identical:

- Byte-identical across sources: `20260809130000`, `20260809140000`, `20260809150000`, `20260809160000`, `20260810150000` Study binding, and `20260810159000` worker evidence.
- Same path but different blobs: Mac/Admin `20260809120000` operational telemetry; Study/Admin `20260810152000` receipt timestamp and `20260810152100` worker operations.
- Same version but different filenames: `20260810120000`, `20260810140000`, `20260810150000`, `20260810151000`, `20260810153000`, and `20260810155000` across the three final tips.

These are integration reconciliation hotspots only. This verification did not apply, rename, or contact any migration target. The JSON companion records every final migration path, collision filename, and relevant blob OID.

## Explicitly excluded unrelated sources

These fetched refs exist but are excluded from the Admin final source set because they belong to the separate auth/study workstream pending custody/security classification:

| Excluded ref | Exact SHA |
| --- | --- |
| `origin/integration/study-a1-final-r8` | `c433fa1ba1c1c6af518e1c11daf36e228e7c8c99` |
| `origin/study-a1-production-integration-base-c-r2` | `0e62cdf9562a4e6579f97a87023bb5f639c2a7b1` |
| `origin/study-a1-server-tutor-prebundle-t1-h2` | `860d52e9bfb011f83aa6acf128fd870868cb33b9` |
| `origin/study-a1-tutor-host-mapping-t2-h2` | `b0e111ca3a7327def7a95a2577ae7bdabb661681` |

## Completeness and hold point

No required Mac production source remains missing. The authoritative RC4 ref, provenance audit ref, five transferred correction refs, and their Git objects are all present. Historical constituent objects/leaf refs that remain absent are superseded and are not members of the minimum final source set.

Final classification: **CROSS_MACHINE_SOURCE_MANIFEST_READY**

HOLD. This manifest does not authorize product integration, migration application, push, deploy, or hosted contact.

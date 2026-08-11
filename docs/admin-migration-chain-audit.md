# Admin cross-domain migration-chain audit

Audit date: 2026-08-10

Audit base: `cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64`

Audit worktree: `admin-migration-chain-audit`

Classification: **ADMIN_MIGRATION_CHAIN_AUDIT_READY**

## Ruling

The intended Admin union is replayable and security-coherent after deterministic
filename normalization. The selected union contains 32 migration artifacts. The
raw completed branches cannot be assembled by filename alone because they have
two independent duplicate version prefixes, one same-path/different-content
variant, and one older semantic duplicate of activation/rollback.

No source migration was renamed in this audit branch. The replay tool applies
the exact source bytes from immutable commits in the safest collision-free order.

## Resolved source tips

| Completed branch | Tip used |
| --- | --- |
| R3 Operations — `mac/admin-r3-ops-integration` | `cf9d2bb9d8ca1a0a4a4c64cb245df6fe5d4afd64` |
| Provider Accounting Complete — `mac/admin-provider-accounting-complete` | `70701599e4d2689a472cfab22d6af2235862ad5a` |
| Cost Threshold Runtime — `mac/admin-cost-threshold-runtime` | `275d02fe976f8600e780bd8bc48e78fdd440f4bd` |
| Correlation Explorer — `mac/admin-correlation-explorer` | `8faa9eb23bd55f1d37d83d17c784d851722a12cf` |
| Curriculum Workflow Integration — `mac/admin-curr-workflow-integration` | `d8ba41f0dde5e9f06203ca5a07b57cade9cf1803` |
| Curriculum Release Controls Integration — `mac/admin-curr-release-controls-integrated` | `0e5a1278183ac560658c0bd24ea670c7ba5bae38` |
| Release History — `mac/admin-curr-release-history` | `c30f95c4a3c816d30d4831f7b4822ec97d7af4cd` |

`mac/admin-final-rc1-assembly` moved during this audit from the audit base to
`1862d65b486b3b2acba61c8c072bf871e3166e9b`. It was inspected read-only and was
not treated as a frozen source branch. Its in-progress choice to place audit
filters at `20260810110000` and provider attempts at `20260810131000` agrees
with the independent dependency and reference-blast-radius ruling below.

## Authoritative selected union

Source abbreviations: **R3** = R3 Operations, **PA** = Provider Accounting
Complete, **CW** = Curriculum Workflow Integration, **RC** = Curriculum Release
Controls Integration, and **CX** = Correlation Explorer. Dependencies identify
the source artifact's declared predecessor; the semantic DAG and normalized
linear order are recorded later.

| ID | Frozen prefix and filename | Source | SHA-256 | Declared dependency | Purpose/domain | Later derived or extended? |
| --- | --- | --- | --- | --- | --- | --- |
| M01 | `20260724074106_academy_profiles_base.sql` | R3 | `16c609d24efb9b9694b410a2313e5f2f7228db5118e2ccc4fa779f03c1d53c51` | — | Profile synchronization baseline | No |
| M02 | `20260724230000_academy_student_identity_foundation.sql` | R3 | `2c7825ba957b68a39413a1e2da81aebaa72fb35dde7abeeba6ea8a493ecf3bde` | M01 | Household/student identity | No |
| M03 | `20260726120000_academy_household_revision_cas.sql` | R3 | `0d5556db9f1dc406234e08180051e8d54807870084223b25db18017b1648c268` | M02 | Household profile CAS | No |
| M04 | `20260731120000_academy_gateway_usage.sql` | R3 | `9eb92005e9c98e94f3fa365351ab527d01cee47da2d0ceac3db0a4e60d82c86f` | M03 | Gateway usage control | No |
| M05 | `20260801010000_academy_study_engine_storage.sql` | R3 | `7ebb25b0517f3b79b36e0399757715826a634fbdf731a9716fdeeb4dad9da0fa` | M04 | Study durable storage | No |
| M06 | `20260801011000_academy_study_engine_authorization.sql` | R3 | `3e4fe306b9edfb17cf3fbf0f62b4c5565fdccc9abde1726d7205c60d822acfad` | M05 | Study authorization/RPCs | No |
| M07 | `20260801012000_academy_study_engine_production_reconciliation.sql` | R3 | `8675afe9f5c802689234fc769e09a4f42bf7a19eba6c88bfeadb816a048910d3` | M06 | Study production reconciliation | No |
| M08 | `20260801160000_academy_study_verified_identity.sql` | R3 | `4501be3757cb0baf53edc200e7673744b12626eeb84dd56d6fc2899e3d25338e` | M07 | Verified guardian/session identity | No |
| M09 | `20260801170000_academy_study_adult_review_operations.sql` | R3 | `562b67462148d9e94933b0fd9007fad37a3b0a08cb8432383c0b228088c0d8eb` | M08 | Adult-review operations | Corrected before first application; manifest supersedes `46c684…` |
| M10 | `20260801190000_academy_study_final_production_reconciliation.sql` | R3 | `d4ccea295aac2bda67dbfd310650e1c625de867485ecc47f5e993f74c8006d00` | M09 | Final Study reconciliation | Additive successor, not an in-place rewrite |
| M11 | `20260808120000_academy_admin_authorization.sql` | R3 | `fc563486b9193da41ea89305d36d172782f9d65b482417e6128c2ccb185b3752` | M10 | Admin roles/capabilities | No |
| M12 | `20260808121000_academy_operational_events.sql` | R3 | `50e8f86bd76cfa049accf6c9ed0ecac46a73589147870d3c93dd268701ef3a66` | M11 | Operational event ledger | No |
| M13 | `20260808122000_academy_provider_usage_cost_ledger.sql` | R3 | `316816f94959193d96ce10c2ff059bedd1124570ffb139e1ec8b92c0251d915d` | M12 | Provider usage/cost authority | No |
| M14 | `20260808123000_academy_admin_safety_operations.sql` | R3 | `eb52636bd163661666d6c44ac92340c8f460c791315bf9602190b032ec99e033` | M13 | Safety operations projection | No |
| M15 | `20260809120000_academy_operational_telemetry_foundation.sql` | R3 | `e3dec4a9c4034d0756383578b635b7475c03f51c0e9f11fa3e28b38769b02c83` | M14 | Retention-aware telemetry aggregates | No |
| M16 | `20260809130000_academy_admin_audit_foundation.sql` | R3 | `b422853994fb86983eabe39ca53e0cb375511306bd5e694d45585ce5f335ac25` | M15 | Append-only Admin audit | No; identical across inspected branches |
| M17 | `20260809140000_academy_admin_configuration_core.sql` | R3 | `d700ed2a03f0ad27714b461845c05a9128323de229359f39477c60047a9298ae` | M16 | Runtime configuration authority | No |
| M18 | `20260809150000_academy_logical_voice_profile_contract.sql` | R3 | `d111cd566a39fb016cade408b5a64adb46d98ec9a8155f1060ac67d62053cd74` | M17 | Logical voice contract | No |
| M19 | `20260809160000_academy_curriculum_release_registry.sql` | CW | `41dbfda8aa88b2c1dfe006fe753c58481deadba4aa3e031ad914aa7894454978` | M16 | Immutable curriculum registry | No |
| M20 | `20260809170000_academy_admin_curriculum_audit_vocabulary.sql` | CW | `0a2e350cf7b7df239961a68c759ef0e47bd162a97ba817b594382303e95f69dd` | M19 | Curriculum audit vocabulary | No |
| M21 | `20260810120000_academy_admin_audit_query_filters.sql` | R3 | `64dff0578273dd429d389d2f01c18486b4f4d9ea24460fca89956c443bb7e8e3` | M18 | Audit query filters | No; normalize filename only |
| M22 | `20260810120000_academy_curriculum_draft_authoring.sql` | CW | `f9839401260f328df70496c105cadcbe5a5e06477db58610ae6d7bde42ea9721` | M20 | Curriculum draft plane | No |
| M23 | `20260810130000_academy_provider_attempt_journal.sql` | PA | `af93f20a14fefcc23f5873af853c9ac0c7ef4065f00d5b1d6f06dc891c0b7f44` | M21 | Provider attempt journal | Reused byte-for-byte by Cost Threshold Runtime; normalize filename only |
| M24 | `20260810130000_academy_curriculum_standards_review.sql` | CW | `bb014de57a1a8cedce97020becf041e5f3af69d26186988fab2095af4bcac739` | M22 | Standards review decisions | No |
| M25 | `20260810140000_academy_curriculum_human_approval.sql` | CW | `ca9c7ec2e2f83c106804a9290d53dc18235075c34ce7653fbf89ecb75a96e6ce` | M24 | Exact-revision human approval | No |
| M26 | `20260810141500_academy_curriculum_draft_collaborators.sql` | CW | `7c234539d46619ab41f6941a809d4fcdf834241f5dc8a5c3411ed4e398510121` | M25 | Draft-scoped collaborators | No |
| M27 | `20260810144700_academy_admin_access_management.sql` | R3 | `56bb1b1efd798586f9abce6ada581e38f70bf0704ec4e93602062c6eef268bbe` | M21 | Admin access management | No |
| M28 | `20260810150000_academy_curriculum_release_staging.sql` | RC | `e47f8d6b58843234f13315849d8b5fdb74f33433d13944733fd2fdea895c4aac` | M25 | Immutable release staging + integrity projection | **Yes**; extends frozen `1b54aed6…` staging bytes in place |
| M29 | `20260810151000_academy_study_safety_provider_accounting.sql` | PA | `5bcdc8891538613ada2c5872016b6cbe00e11c763b8ec6bacf4e6f354241cef6` | M23 | Study safety cost dimensions | No |
| M30 | `20260810160000_academy_curriculum_release_publishing.sql` | RC | `ba9291c66af40dcc693532aef6db94f9bc4fa5b6937369407c8a3a7de2d5dece` | M28 | Publish staged curriculum | No |
| M31 | `20260810170000_academy_curriculum_activation_rollback.sql` | RC | `6d7d3cbbe740e1153aa6303ae90480beec2dcac7e29fff91754e05c58614f0da` | M30 | Activation/default-pointer rollback | **Yes**; derived from and materially extends Release History's `20260810160000` artifact |
| M32 | `20260810180000_academy_admin_correlation_runtime_read.sql` | CX | `7499d60258f5b61c1f9aec2bb3537834b0cb65c4648bc475b487dfb02d2b10d4` | M27 | Correlation explorer runtime seam | No |

Cost Threshold Runtime contributes no unique migration bytes. It carries M23
unchanged and consumes the R3 configuration foundation.

### Evaluated but excluded variants

| Artifact | Source | SHA-256 | Ruling |
| --- | --- | --- | --- |
| `20260810150000_academy_curriculum_release_staging.sql` | CW / Release History | `1b54aed6f038051c1a1636e933a7ac312681484ce3019cd25e2c719941ee9c60` | Superseded by M28, which adds the service-only integrity projection and preserves its grant. |
| `20260810160000_academy_curriculum_activation_rollback.sql` | Release History | `e3283b843b8503d4634ab7fda771529b6eccba1626d23d4fac9cb28dc48c3bf0` | Superseded by M31 after publishing; it lacks staged-publish activation verification and conflicts with M30's prefix. |

No two differently named selected migrations have the same SHA-256. Manual
semantic comparison found one duplicate domain migration under different names:
the excluded `20260810160000` activation artifact and selected M31.

## Collision and ordering findings

1. `20260810120000` collides between M21 Admin audit query filters and M22
   curriculum draft authoring.
2. `20260810130000` collides between M23 Provider Attempt Journal and M24
   Curriculum Standards Review. They are semantically independent. Provider
   attempts require the identity and provider-ledger foundations; standards
   review requires draft authoring and curriculum audit vocabulary.
3. The raw Release History artifact uses `20260810160000` for activation while
   Release Controls uses that prefix for M30 publishing. Activation must follow
   publishing and therefore M31 at `20260810170000` is the safe selected form.
4. M28 has the same path but different bytes across workflow/history and release
   controls. Selecting by filename without verifying the hash can silently lose
   `academy_admin_read_curriculum_staging_integrity_v1` and its service grant.

The source manifests are deliberately linear, but the semantic graph branches:

- M11 → M12 → M13 is the Admin/provider foundation. M13 → M23 → M29 is the
  provider-attempt/accounting path.
- M15 → M16 → M17 → M18 → M21 → M27 → M32 is the R3 audit/access/correlation path.
- M16 → M19 → M20 → M22 → M24 → M25 → M26 → M28 → M30 → M31 is the complete
  curriculum workflow and release-control path.
- M23 can be before or after M24, but must be before M29. M24 must be before M25
  so later audit-vocabulary rewrites preserve standards review.
- M26 is not a structural prerequisite of M28 in the release-controls manifest,
  but it must precede M28 in the union so the composed audit vocabulary and the
  complete workflow are retained.

No selected SQL dependency is missing in the recommended order. The fresh replay
also proves every later table/function preflight resolves.

## Safest normalization map

The recommendation minimizes renamed references and preserves domain order. It
does not alter SQL bytes.

| Frozen artifact | Recommended final filename | Reason |
| --- | --- | --- |
| M21 `20260810120000_academy_admin_audit_query_filters.sql` | `20260810110000_academy_admin_audit_query_filters.sql` | Audit filters depend on M18 and can safely precede M22. This moves a low-reference R3 leaf and preserves the heavily referenced authoring filename. |
| M22 `20260810120000_academy_curriculum_draft_authoring.sql` | Keep | Preserves the curriculum chain and its broad test/doc reference set. |
| M24 `20260810130000_academy_curriculum_standards_review.sql` | Keep | Keeps standards immediately after authoring and before approval. |
| M23 `20260810130000_academy_provider_attempt_journal.sql` | `20260810131000_academy_provider_attempt_journal.sql` | Independent of standards; remains well before M29 at `151000` and has the smaller reference blast radius. |
| M28 staging | Keep the filename and select SHA `e47f8d6…` | This is the extended integrity-aware variant. |
| Excluded Release History activation at `160000` | Do not assemble | It is an older semantic duplicate. |
| M30 publishing at `160000` | Keep | Publishing is the required predecessor of activation. |
| M31 activation at `170000` | Keep SHA `6d7d3c…` | This is the post-publishing, staged-publish-aware activation implementation. |

The repository's strict manifest test requires one predecessor per entry. After
normalization, generate one complete 32-entry manifest in filename order and set
each non-root entry's `dependency` to the immediately preceding selected
filename. Do not copy any branch manifest wholesale.

## Manifest and stale-reference findings

Every inspected branch manifest is internally correct for its own tree: version
uniqueness, filename order, dependency order, file coverage, and LF-normalized
SHA-256 all passed. No individual source branch has a hash mismatch. None is a
union manifest.

Relative to the selected 32-artifact union, omissions are:

| Branch manifest/tree | Selected artifacts omitted | Extra/stale artifact |
| --- | ---: | --- |
| R3 Operations | 12 | 0 |
| Provider Accounting Complete | 11 | 0 |
| Cost Threshold Runtime | 12 | 0 |
| Correlation Explorer | 11 | 0 |
| Curriculum Workflow Integration | 10 | 0 |
| Curriculum Release Controls Integration | 10 | 0 |
| Release History | 12 | 1 — excluded `160000` activation |

Hash-sensitive assembly hazards:

- Workflow Integration and Release History manifest M28 as `1b54aed6…`; the
  selected release-controls bytes are `e47f8d6…`.
- Release History manifests activation as `160000` / `e3283b84…`; the selected
  form is `170000` / `6d7d3cbb…`.
- Renaming M21 and M23 keeps their SHA-256 unchanged, but manifest `version`,
  `filename`, and all dependency references must change.

Stale references that final assembly must normalize were found in manifests,
`MIGRATIONS.md`, migration JSON cards, and database tests. Across the three
curriculum branches, the authoring filename appears in 32 distinct non-migration
files, the standards filename in 11, and Release History's obsolete activation
filename in 4. Provider Attempt Journal references occur in the Provider
Accounting and Cost Threshold manifests/tests. This reference distribution is
why moving M21 and M23 is safer than moving M22 and M24.

## Fresh local database replay and security ruling

`scripts/replay-admin-migration-union.mjs` created a disposable in-memory
PGlite database, bootstrapped only the local Supabase role/auth contract, and
applied all 32 selected source artifacts serially. It contacted no hosted
Supabase service.

Result: **PASS**.

- All 32 migrations applied without a table, function, constraint, or type
  collision.
- All 71 tables explicitly required by source SQL to use forced RLS finished
  with both RLS enabled and forced.
- Nine historical profile/identity tables intentionally use enabled, non-forced
  RLS exactly as their accepted source migrations specify; no later migration
  weakened a forced table.
- No `public` or `academy_private` relation/routine had an owner other than
  `postgres`.
- Final catalog state had 108 direct `service_role` grants.
- All 14 cross-domain service routines explicitly checked by the replay were
  present and directly executable by `service_role`.
- Thirteen historical service grants were intentionally retired by the accepted
  Study reconciliation/adult-review migrations or by the audit-query signature
  replacement. No unexpected service grant was revoked.

Repository contract tests were run serially: 9 verifier/manifest tests and 125
database tests across foundation integration, Admin authorization, operational
events, provider cost ledger, Safety Operations, Admin audit, runtime config,
and access management. All 134 passed.

## Reusable verifier

The existing read-only `npm run migration:check` path was strengthened. It now
validates:

- canonical filenames and unique 14-digit versions;
- strict manifest/repository ordering;
- required dependencies, missing dependency files, non-earlier dependencies,
  and cycles;
- duplicate manifest filenames and versions;
- missing and extra migration files;
- LF-normalized SHA-256 availability and manifest equality; and
- exact duplicate migration content under different filenames.

The analyzer remains pure/read-only, the CLI only reads the migration directory
and manifest, and focused tests cover each new failure class.

## Environment notes

The worktree initially had no installed root dependencies; `npm ci` installed
the lockfile-pinned packages with zero audit vulnerabilities. The host default
was Node `v25.5.0`. A Node 22 Homebrew formula prefix was discoverable but no
Node 22 binary was installed, so no unsupported binary was fabricated.

The first replay attempt failed only in the audit harness's catalog query because
PGlite does not expose the attempted `acldefault(character, oid)` signature. The
query was corrected to inspect explicit ACLs directly, without changing database
semantics, and the serial clean replay then passed. No PostgreSQL protocol or
socket failure occurred.

## Final classification

**ADMIN_MIGRATION_CHAIN_AUDIT_READY**

## RC2 assembly follow-up

The final RC2 assembly retained the pure collision/hash verifier and adapted
`scripts/replay-admin-migration-union.mjs` to read the finalized repository
manifest and migration files instead of the earlier frozen source tips. This
keeps the audit local and disposable while ensuring the replay includes the
configuration reauthorization and curriculum privacy hardening successors.
The finalized 34-migration RC2 chain replayed successfully with no missing
forced-RLS table, unexpected owner, missing required service routine, or
unexpected service-grant revocation.

Actual migration renames, the complete generated manifest, and updates to stale
tests/docs remain owned by the final assembly card.

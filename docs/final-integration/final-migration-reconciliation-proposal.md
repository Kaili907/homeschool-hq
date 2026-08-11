# Final migration reconciliation proposal

Classification: **FINAL_MIGRATION_RECONCILIATION_PROPOSAL_READY**

`mutationPerformed = false`

This is a read-only proposal. No migration was renamed or edited, no product
manifest was changed, no merge/push/deploy occurred, and no hosted Supabase
project was contacted.

## Exact source custody

The proposal was rebuilt after `git fetch origin --prune` from these exact
commits:

| Source | Exact commit | Manifest entries |
| --- | --- | ---: |
| `origin/mac/admin-final-rc4-assembly` | `6f952509236daa4e17849c4a5399241e42816553` | 36 |
| `win/final-admin-delta-rc1` | `ae2c9b32445a59b82a972f3b67af8ea11dc50b79` | 27 |
| `win/final-study-rc1` | `f93f0736b48736252e0678f9b57ce83652e2dab5` | 25 |
| `origin/mac/admin-final-rc3-provenance-audit` | `d6a0754d9acd1192ba9a2037fe2fc077441ba080` | provenance evidence |

The proposal worktree was clean on `win/final-migration-proposal` at
`c7bca9deeb5f0b4077a8c8848e4d953c7833efe9` before this report was edited.

The three final manifests contain 88 source entries and 85 declared dependency
edges. Deduplication by logical suffix yields 50 logical migrations. The Mac
RC4 tree independently contains 36 files, 36 versions, and 36 checksum-matched
manifest entries. Mac RC4's assembly evidence reports a successful local
replay; this proposal independently reran the planner, not that replay.

## Ruling on the provisional four-way map

The earlier four-way premise is no longer the final source reality.

| Logical migration | Provisional version | Final ruling | Canonical version |
| --- | ---: | --- | ---: |
| Provider Attempt Journal | `20260810120000` | **REJECT**: the final Mac migration is a later hardened, integration-adjusted descendant. | `20260810131000` |
| Curriculum Draft Authoring | `20260810120100` | **REJECT**: Mac RC4 proves the exact final migration at its collision-free source identity. | `20260810120000` |
| Study Effective Settings V2 | `20260810120200` | **APPROVE**: Windows Admin carries the identity-adjusted final blob. | `20260810120200` |
| Provider Pricing Terms | `20260810120300` | **APPROVE**: Windows Admin already carries this final identity and checksum. | `20260810120300` |

The earliest Provider Attempt Journal source used `20260810120000`, but the
Mac provenance audit proves that it was later hardened and then byte-identically
renamed from `20260810130000` to final
`20260810131000_academy_provider_attempt_journal.sql`. Treating the earliest
foundation as the final SQL would discard the hardened descendant.

## Complete collision groups and resolutions

After logical deduplication, the actual final RC union has six numeric collision
groups:

| Version | Competing logical migrations | Canonical resolution |
| ---: | --- | --- |
| `20260810120000` | Curriculum Draft Authoring; Study Effective Settings V2 (Study RC identity) | Keep Draft Authoring at `120000`; select the Admin integration-adjusted Effective Settings blob already at `120200`. |
| `20260810140000` | Curriculum Human Approval; Admin Configuration Runtime Enforcement | Keep Runtime Enforcement at `140000`; rename Human Approval to `140100`. |
| `20260810150000` | Curriculum Release Staging; Study Curriculum Binding | Keep Curriculum Binding at `150000`; rename Release Staging to `150100`. |
| `20260810151000` | Study Safety Provider Accounting; Study Session Semantics V2 | Keep Session Semantics at `151000`; rename Safety Provider Accounting to `151100`. |
| `20260810153000` | Admin Configuration Reauthorization; Study Release Registry Bridge | Keep Release Registry Bridge at `153000`; rename Configuration Reauthorization to `153100`. |
| `20260810155000` | Curriculum Privacy Hardening; Study Session Telemetry Outbox | Keep Telemetry Outbox at `155000`; rename Privacy Hardening to `155100`. |

This allocation keeps every selected Windows migration identity, preserves the
Mac RC4 order, uses free 100-step slots, and requires only five filename
renames. The five renamed Mac SQL blobs do not contain their old versioned
identity, so no selected SQL content edit is required.

## Concrete rename plan

| Source filename | Canonical filename | Git blob | SHA-256 consequence |
| --- | --- | --- | --- |
| `20260810140000_academy_curriculum_human_approval.sql` | `20260810140100_academy_curriculum_human_approval.sql` | `ad07d691af3f71f990078fa8cca9ccd56713ade8` | Preserve `5a7b017d28f57fca069ec4e972bfc4d09f07cb27bb1f73bcecc560620b598f5a`. |
| `20260810150000_academy_curriculum_release_staging.sql` | `20260810150100_academy_curriculum_release_staging.sql` | `2ef36d9b09da1d8da549bd2201efa0679bc243e3` | Preserve `07541755d368db6af7d57b34ee4e6d1e89ce92e846e434913bd5dad1acb56961`. |
| `20260810151000_academy_study_safety_provider_accounting.sql` | `20260810151100_academy_study_safety_provider_accounting.sql` | `80a091a79db9c0eecdf2044492f94232c63e3842` | Preserve `5bcdc8891538613ada2c5872016b6cbe00e11c763b8ec6bacf4e6f354241cef6`. |
| `20260810153000_academy_admin_configuration_reauthorization.sql` | `20260810153100_academy_admin_configuration_reauthorization.sql` | `01179b86df6fcfbb772117408d882a2ab3db1f50` | Preserve `e533b15b04157cd1a7015221b59fe483b3f67691ccf6f5a497e592398c978308`. |
| `20260810155000_academy_curriculum_privacy_hardening.sql` | `20260810155100_academy_curriculum_privacy_hardening.sql` | `0eac5230da3280eda41f1bf281f1657266f1a411` | Preserve `e905cfd2bf1191a97dccb933e4b918c2d6d4bb3eb0e3660958fb5fe3302a7886`. |

All five are `HOSTED_STATUS_UNVERIFIED`. This proposal does not authorize
their renaming on any hosted-applied history.

## SQL-byte and equivalence rulings

### Exact logical duplicates

Twenty logical migrations are byte-identical in more than one final RC. Git
blob equality, not filename resemblance, is the proof:

| Logical migration | Final RCs | Git blob |
| --- | --- | --- |
| Admin Authorization | Mac/Admin/Study | `cdf90805e889be9147f2df0338e1032c8e67d1a4` |
| Admin Safety Operations | Mac/Admin/Study | `3185b256a3a964e87c72bbc55358a6ddf715ff70` |
| Gateway Usage | Mac/Admin/Study | `c522139ea68f98613c84a536a567ac1178e80871` |
| Household Revision CAS | Mac/Admin/Study | `c9aa82ddc7e9bd179107b50dfe6d87d9fbfa650f` |
| Operational Events | Mac/Admin/Study | `c5fa92e76e75d87890851d36a5f7d264d351ee7b` |
| Profiles Base | Mac/Admin/Study | `0d0c03a6d6d8b78221dffc90994cc242ee94a778` |
| Provider Usage Cost Ledger | Mac/Admin/Study | `650871ba8e105f7d49c7c9ebe55409493c143dbd` |
| Student Identity Foundation | Mac/Admin/Study | `aa9074a45a1725301e6b606e84d332248e48539f` |
| Study Adult Review Operations | Mac/Admin/Study | `36393f3923237023429e4e73d90bc164c7387519` |
| Study Engine Authorization | Mac/Admin/Study | `480bb2651d7290d02b30c7f89d0ec51e441f6e64` |
| Study Engine Production Reconciliation | Mac/Admin/Study | `ed4a7f2f6b794c4028cb483f6439c08727b270f7` |
| Study Engine Storage | Mac/Admin/Study | `0a79396909186801b01c7ed001ee05727c9b5607` |
| Study Final Production Reconciliation | Mac/Admin/Study | `e5dc93d9f870c5de677018ad190b2be79d551cb0` |
| Study Verified Identity | Mac/Admin/Study | `95939b773576d8bfd42ecc31f888ce587f92173e` |
| Admin Audit Foundation | Mac/Admin | `dd0caa5ef2ae4a209b821440f3324334b97c402f` |
| Admin Configuration Core | Mac/Admin | `4566758081868f81e8d1a9a05d0537c9164effe5` |
| Logical Voice Profile Contract | Mac/Admin | `28a816712a4adc2dfbfba3160af070782aa8ef32` |
| Curriculum Release Registry | Mac/Study | `886250d21d709e88bb768c5dc26f523a621d585c` |
| Study Curriculum Binding | Admin/Study | `0ab1da30b35a82bd3f5a2d1832c4a95fd95bfbad` |
| Study Worker Run Evidence | Admin/Study | `5d868f351a1c25f03dcd2a214d03073a61ad04ee` |

The final three-ref tree has no case where different final filenames share one
blob. The Mac provenance audit supplies two historical different-name exact
equivalences that explain final identities:

- Provider Attempt Journal:
  `20260810130000...` -> `20260810131000...`, blob
  `2b4c0e5b1d28f2fba1239b0de26717ad0f5e59b9`.
- Curriculum Privacy Hardening:
  `20260810160000...` -> `20260810155000...`, blob
  `0eac5230da3280eda41f1bf281f1657266f1a411`.

### Integration-adjusted equivalents

| Logical migration | Source variants | Ruling |
| --- | --- | --- |
| Operational Telemetry Foundation | Admin SHA `5646d9...`; Mac SHA `e3dec4...` | Select Mac RC4 `e3dec4a9c4034d0756383578b635b7475c03f51c0e9f11fa3e28b38769b02c83`; it contains the later retention-boundary correction. |
| Study Effective Settings V2 | Study `120000` SHA `67b3c2...`; Admin `120200` SHA `1b3970...` | Select Admin `120200`; the sole SQL-byte difference is the stored self identity. |
| Study In-App Receipt Timestamp | Study SHA `6d9656...`; Admin SHA `938f92...` | Select Admin `938f92fc62d940dc965025a2c185bb38bbe7ba77c71b7542b477da7996122e5d`; the sole difference is the Effective Settings prerequisite identity. |
| Study Worker Operations Contract | Study SHA `0ab55c...`; Admin SHA `1a7be3...` | Select Admin `1a7be3e31bc3b6b4e2352bbc1412be3da3f8992b3656e96154071f23bcdeb0f7`; the sole difference is the Effective Settings prerequisite identity. |

These are selections of existing final source bytes, not proposed SQL edits.
Their canonical checksums are already known.

## Unique migrations by final RC

Mac-only logical migrations (17):

`Admin Audit Query Filters`, `Curriculum Draft Authoring`, `Curriculum
Standards Review`, `Provider Attempt Journal`, `Curriculum Human Approval`,
`Curriculum Draft Collaborators`, `Admin Access Management`, `Curriculum
Release Staging`, `Study Safety Provider Accounting`, `Admin Configuration
Reauthorization`, `Curriculum Privacy Hardening`, `Curriculum Release
Publishing`, `Curriculum Activation Rollback`, `Admin Correlation Runtime
Read`, `Curriculum Write Reauthorization`, `Admin Curriculum Performance
Bounds`, and `Admin Curriculum Audit Vocabulary`.

Windows Admin-only logical migrations (4):

`Provider Usage Cost Aggregate`, `Provider Pricing Terms`, `Admin
Configuration Runtime Enforcement`, and `Study Provider Cost Accounting`.

Windows Study-only logical migrations (5):

`Study Session Semantics V2`, `Study Release Registry Bridge`, `Study Bound
Content Authority`, `Study Session Telemetry Outbox`, and `Study Session
Timestamp Coherence`.

The four integration-adjusted groups and twenty exact duplicate groups are
separate from these unique-only counts.

## Complete dependency proof

The common 14-entry prefix in all three manifests is:

`Profiles Base -> Student Identity Foundation -> Household Revision CAS ->
Gateway Usage -> Study Engine Storage -> Study Engine Authorization -> Study
Engine Production Reconciliation -> Study Verified Identity -> Study Adult
Review Operations -> Study Final Production Reconciliation -> Admin
Authorization -> Operational Events -> Provider Usage Cost Ledger -> Admin
Safety Operations`.

The final source suffixes are:

- Mac RC4:
  `Operational Telemetry Foundation -> Admin Audit Foundation -> Admin
  Configuration Core -> Logical Voice Profile Contract -> Curriculum Release
  Registry -> Admin Curriculum Audit Vocabulary -> Admin Audit Query Filters ->
  Curriculum Draft Authoring -> Curriculum Standards Review -> Provider Attempt
  Journal -> Curriculum Human Approval -> Curriculum Draft Collaborators ->
  Admin Access Management -> Curriculum Release Staging -> Study Safety Provider
  Accounting -> Admin Configuration Reauthorization -> Curriculum Privacy
  Hardening -> Curriculum Release Publishing -> Curriculum Activation Rollback
  -> Admin Correlation Runtime Read -> Curriculum Write Reauthorization -> Admin
  Curriculum Performance Bounds`.

- Windows Admin:
  `Operational Telemetry Foundation -> Provider Usage Cost Aggregate -> Admin
  Audit Foundation -> Admin Configuration Core -> Logical Voice Profile Contract
  -> Study Effective Settings V2 -> Provider Pricing Terms -> Admin
  Configuration Runtime Enforcement -> Study Provider Cost Accounting -> Study
  Curriculum Binding -> Study In-App Receipt Timestamp -> Study Worker
  Operations Contract -> Study Worker Run Evidence`.

- Windows Study:
  `Curriculum Release Registry -> Study Effective Settings V2 -> Study
  Curriculum Binding -> Study Session Semantics V2 -> Study In-App Receipt
  Timestamp -> Study Worker Operations Contract -> Study Release Registry Bridge
  -> Study Bound Content Authority -> Study Session Telemetry Outbox -> Study
  Worker Run Evidence -> Study Session Timestamp Coherence`.

Every one of the 85 direct source-manifest edges resolves to a numerically
earlier migration in the canonical order below. Where exact duplicate SQL had
different manifest predecessors, the canonical chain includes both branches
before the shared node: Audit Foundation follows Cost Aggregate; Release
Registry follows Logical Voice; Effective Settings follows Release Registry;
Curriculum Binding follows Provider Cost Accounting; Receipt Timestamp follows
Session Semantics; and Worker Run Evidence follows Telemetry Outbox.

SQL inspection adds the material identity edges that filenames alone do not
show:

- Effective Settings stores its own migration identity.
- Receipt Timestamp and Worker Operations require the `120200` Effective
  Settings marker in the selected Admin variants.
- Curriculum Binding stores its own `150000` identity.
- Release Registry Bridge and Bound Content Authority require the existing
  `150000` binding and `153000` bridge identities.
- Session Semantics, Telemetry Outbox, Worker Run Evidence, and Timestamp
  Coherence store their unchanged identities.
- None of the five proposed rename-source SQL blobs contains its old identity.

The planner conservatively reports seven selected SQL files containing a
numeric token shared by a pre-reconciliation collision. Each is an intentional
reference to the migration that keeps that version, so the ruling is
`NO_CONTENT_EDIT`: Curriculum Binding (`150000`), Session Semantics
(`151000`), Receipt Timestamp (`150000` binding), Worker Operations
(`150000` binding), Release Registry Bridge (`150000` binding and `153000`
self), Bound Content Authority (`150000` binding and `153000` bridge), and
Telemetry Outbox (`155000` self).

## Final canonical migration order

The canonical manifest is a 50-entry linear replay chain in this exact order.
Each filename is also the concrete final version map for its logical migration:

```text
20260724074106_academy_profiles_base.sql
20260724230000_academy_student_identity_foundation.sql
20260726120000_academy_household_revision_cas.sql
20260731120000_academy_gateway_usage.sql
20260801010000_academy_study_engine_storage.sql
20260801011000_academy_study_engine_authorization.sql
20260801012000_academy_study_engine_production_reconciliation.sql
20260801160000_academy_study_verified_identity.sql
20260801170000_academy_study_adult_review_operations.sql
20260801190000_academy_study_final_production_reconciliation.sql
20260808120000_academy_admin_authorization.sql
20260808121000_academy_operational_events.sql
20260808122000_academy_provider_usage_cost_ledger.sql
20260808123000_academy_admin_safety_operations.sql
20260809120000_academy_operational_telemetry_foundation.sql
20260809121000_academy_provider_usage_cost_aggregate.sql
20260809130000_academy_admin_audit_foundation.sql
20260809140000_academy_admin_configuration_core.sql
20260809150000_academy_logical_voice_profile_contract.sql
20260809160000_academy_curriculum_release_registry.sql
20260809170000_academy_admin_curriculum_audit_vocabulary.sql
20260810110000_academy_admin_audit_query_filters.sql
20260810120000_academy_curriculum_draft_authoring.sql
20260810120200_academy_study_effective_settings_v2.sql
20260810120300_academy_provider_pricing_terms.sql
20260810130000_academy_curriculum_standards_review.sql
20260810131000_academy_provider_attempt_journal.sql
20260810140000_academy_admin_configuration_runtime_enforcement.sql
20260810140100_academy_curriculum_human_approval.sql
20260810141000_academy_study_provider_cost_accounting.sql
20260810141500_academy_curriculum_draft_collaborators.sql
20260810144700_academy_admin_access_management.sql
20260810150000_academy_study_curriculum_binding.sql
20260810150100_academy_curriculum_release_staging.sql
20260810151000_academy_study_session_semantics_v2.sql
20260810151100_academy_study_safety_provider_accounting.sql
20260810152000_academy_study_in_app_receipt_timestamp.sql
20260810152100_academy_study_worker_operations_contract.sql
20260810153000_academy_study_release_registry_bridge.sql
20260810153100_academy_admin_configuration_reauthorization.sql
20260810154000_academy_study_bound_content_authority.sql
20260810155000_academy_study_session_telemetry_outbox.sql
20260810155100_academy_curriculum_privacy_hardening.sql
20260810159000_academy_study_worker_run_evidence.sql
20260810159100_academy_study_session_timestamp_coherence.sql
20260810160000_academy_curriculum_release_publishing.sql
20260810170000_academy_curriculum_activation_rollback.sql
20260810180000_academy_admin_correlation_runtime_read.sql
20260810190000_academy_curriculum_write_reauthorization.sql
20260810200000_academy_admin_curriculum_performance_bounds.sql
```

This order contains the later Mac RC4 `180000`, `190000`, and `200000`
migrations without changing their identities, and preserves all Windows Admin
and Study dependency edges.

## Checksum, manifest, test, and documentation consequences

No selected SQL content edit is proposed. The five rename-only migrations keep
their existing normalized SHA-256 values. The four integration-adjusted
equivalents use already-existing canonical blobs and their already-known
checksums. Therefore no future SQL checksum is invented and no
`RECOMPUTE_AFTER_CONTENT_EDIT` entry is needed for this plan.

The apply session must:

1. Build one 50-entry
   `docs/study-engine-final-production/migration-manifest.json` in the exact
   canonical order, with the selected checksums and each entry depending on the
   immediately preceding canonical filename.
2. Rename only the five files in the concrete rename table.
3. Select the Mac corrected Operational Telemetry blob and the Admin
   integration-adjusted Effective Settings, Receipt Timestamp, and Worker
   Operations blobs.
4. Update exact identity references for Effective Settings in `MIGRATIONS.md`,
   `docs/study-effective-settings-v2.md`,
   `scripts/study-production-local-smoke.mjs`, the Study migration manifest,
   and the affected Study database tests.
5. Update Mac rename references in `MIGRATIONS.md`,
   `docs/admin-migration-chain-audit.md`,
   `docs/admin-configuration-core.md`,
   `docs/admin-security-redteam-w7-3.md`,
   `docs/admin-console/*-migration.json`,
   `scripts/admin-release-rehearsal.mjs`, and the affected Curriculum,
   provider-accounting, and Admin configuration database tests.
6. Update manifest dependency filenames for Human Approval -> Draft
   Collaborators, Staging -> Safety Provider Accounting, Safety Provider
   Accounting -> Configuration Reauthorization, Configuration Reauthorization
   -> Privacy Hardening, and Privacy Hardening -> Publishing.
7. Rerun the deterministic reference scan and require zero references to the
   six superseded identities (old Effective Settings plus the five renamed Mac
   identities), except immutable provenance documents that explicitly describe
   the old-to-new ruling.

The machine-readable companion lists the exact discovered path sets.

## Hosted status and apply-session prerequisites

Hosted status was not inspected. Every collision-affected or variant-selected
migration is `HOSTED_STATUS_UNVERIFIED`. Nothing here says that renumbering is
hosted-authorized.

An apply session must not start until all of the following are true:

1. A separate read-only hosted packet records the hosted project identity and
   complete migration history (version, name, and checksum where available).
2. The packet proves that none of the five rename-source versions was applied.
   If any was applied, this proposal's apply session is blocked and a separate
   hosted-safe remediation proposal is required.
3. The four source commits above remain locally available and all selected Git
   blob IDs and normalized SHA-256 values match this proposal.
4. The apply worktree is clean and based on the integration commit named by the
   apply card; no destination filename/version is present.
5. The apply card explicitly authorizes the five renames, canonical blob
   selection, consolidated manifest/test/doc edits, and local validation. It
   must not infer permission to contact or mutate hosted Supabase.
6. The completed apply tree passes the planner, collision detector, manifest
   checksum/dependency tests, full local migration replay, affected database
   suites, Admin/Study preflights, typecheck, build, and `git diff --check`.
7. The final apply report preserves the hosted packet, planner JSON, replay
   evidence, and exact post-apply commit SHA.

## Planner validation

- Exact Mac RC4 source: **VALID_CANDIDATE_PLAN**; 36 files, zero collisions,
  errors, warnings, or unsafe operations.
- Exact Windows Admin RC source: **VALID_CANDIDATE_PLAN**; 27 files, zero
  collisions, errors, warnings, or unsafe operations.
- Exact Windows Study RC source: **VALID_CANDIDATE_PLAN**; 25 files, zero
  collisions, errors, warnings, or unsafe operations.
- Actual selected 50-logical-migration union with this five-rename proposal:
  **VALID_CANDIDATE_PLAN**; five source collision groups, five changed mappings,
  zero errors, warnings, or unsafe operations.
- All 85 source-manifest edges in the canonical order: **PASS**
- Final destination versions unique: **PASS**
- Selected source manifest/checksum entries: **PASS**
- Planner, Admin preflight, Study preflight, and manifest suites: **4 files
  passed; 51 tests passed**
- Proposal JSON parse: **PASS**
- `mutationPerformed`: **false**

Final classification: **FINAL_MIGRATION_RECONCILIATION_PROPOSAL_READY**.

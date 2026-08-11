# Final migration reconciliation proposal

Classification: **BLOCKED**

Candidate mapping: **concrete but provisional**

`mutationPerformed = false`

No migration was renamed or edited, no manifest was changed, and no hosted
Supabase project was contacted. The target worktree was verified clean on
`win/final-migration-proposal` at exact base
`666bf260843f67a4d6c959a0d4081ccf656cb55a`.

## Collision inventory

The final cross-machine inventory declares one four-way collision at version
`20260810120000`:

1. `20260810120000_academy_provider_attempt_journal.sql`
2. `20260810120000_academy_curriculum_draft_authoring.sql`
3. `20260810120000_academy_study_effective_settings_v2.sql`
4. `20260810120000_academy_provider_pricing_terms.sql`

Only the last two production files are present in fetched refs and local
worktrees. The first two names occur only in the session card; the repository's
four-way planner fixture uses similarly named synthetic one-line SQL files
without the production `academy_` prefix. Those fixture bytes and dependencies
are not production evidence.

Across 39 local `win/*` refs containing final-era migrations, every available
same-filename SQL identity had one Git blob variant. No additional numeric
collision group was found. The separate clean
`feat/curriculum-audit-contract` source contributes the unique
`20260809170000_academy_admin_curriculum_audit_vocabulary.sql` migration.

## Concrete candidate mapping

| Old filename | Proposed filename | Content bytes expected to change? | Checksum consequence |
| --- | --- | --- | --- |
| `20260810120000_academy_provider_attempt_journal.sql` | unchanged | no | Preserve the source SHA-256, but the production source SHA is unavailable locally. |
| `20260810120000_academy_curriculum_draft_authoring.sql` | `20260810120100_academy_curriculum_draft_authoring.sql` | yes (conservative pending source audit) | `RECOMPUTE_AFTER_CONTENT_EDIT` |
| `20260810120000_academy_study_effective_settings_v2.sql` | `20260810120200_academy_study_effective_settings_v2.sql` | yes | `RECOMPUTE_AFTER_CONTENT_EDIT` |
| `20260810120000_academy_provider_pricing_terms.sql` | `20260810120300_academy_provider_pricing_terms.sql` | no | Preserve `40baeb9f0554059462a5fd22ff7e3159273133c35f85522421c763ac33d8e6ff`. |

This is the smallest 100-step allocation represented by the existing valid
planner fixture. It leaves the first colliding filename unchanged and ends at
`20260810120300`, safely below the existing `20260810140000` migration.

## Dependency rationale

The available production evidence proves these facts:

- Provider pricing depends on the earlier provider ledger, cost aggregate, and
  Admin audit foundations. Its manifests use either the Admin audit migration
  or the later logical-voice contract as the direct predecessor. Its SQL does
  not depend on effective settings.
- Effective settings depends on earlier Study tables and authorization
  functions. The study RC manifest places it after the curriculum release
  registry; the admin RC manifest places it after Admin safety operations.
- Curriculum binding depends on effective settings, so its manifest dependency
  reference must follow the proposed effective-settings filename.
- Admin configuration runtime enforcement depends on provider pricing, so its
  manifest dependency reference must follow the proposed pricing filename.

The fixture-only chain is provider attempt -> curriculum authoring -> effective
settings -> provider pricing. Because the production provider-attempt and
curriculum-authoring SQL/manifests are absent, the first three fixture edges
cannot be promoted to production facts. A dependency inversion could therefore
still exist. This is the primary reason the proposal is blocked rather than
classified ready.

## Content and checksum consequences

Effective settings embeds its old migration identity in
`academy_private.study_persistence_metadata.migration_names`; its current
normalized SHA-256 is
`67b3c2b2792260c4fb779cd814e08901579f06bef8a1765002c3cc1e98837fae`.
The future checksum must be `RECOMPUTE_AFTER_CONTENT_EDIT`.

Two protected later migrations also embed the old effective-settings identity
in prerequisite arrays and will require content edits in the later apply card:

- `20260810152000_academy_study_in_app_receipt_timestamp.sql`, current SHA-256
  `6d9656bcda6d5a2493947ddc4bb396dfb82d1ec6e575e468fbbe71620ba62f93`
- `20260810152100_academy_study_worker_operations_contract.sql`, current SHA-256
  `0ab55c40fe1aacc614b150b9d395415f10b48e1503a8ba090288ebefddfc31d6`

Both future checksums are `RECOMPUTE_AFTER_CONTENT_EDIT`. No future checksum is
invented in this proposal.

Provider pricing contains no old filename/version identity in its SQL bytes, so
a rename-only reconciliation preserves SHA-256
`40baeb9f0554059462a5fd22ff7e3159273133c35f85522421c763ac33d8e6ff`.
The provider-attempt checksum cannot be recorded because its production source
bytes are unavailable.

## References to update later

The consolidated `docs/study-engine-final-production/migration-manifest.json`
must update each renamed entry's `version` and `filename`, the curriculum
binding dependency on effective settings, and the runtime-enforcement
dependency on provider pricing. Any manifest edges involving provider attempt
or curriculum authoring remain unidentified until their source manifests are
available.

Known effective-settings test references include
`supabase/study-effective-settings-v2.db.test.ts`,
`supabase/study-curriculum-binding.db.test.ts`, the adult-review and receipt
database tests, worker-run-evidence tests, production security/session tests,
and `scripts/study-production-local-smoke.mjs`. Known pricing references are in
`supabase/academy-provider-pricing-terms.db.test.ts` and
`supabase/academy-study-provider-cost-accounting.db.test.ts`. Documentation
references occur in `MIGRATIONS.md` and `docs/study-effective-settings-v2.md`.
References for the two unavailable sources cannot yet be inventoried.

## Protected unique IDs

The allocation does not reuse the discovered unique IDs `20260809121000`,
`20260809160000`, `20260809170000`, `20260810140000`, `20260810141000`,
`20260810150000`, `20260810151000`, `20260810152000`, `20260810152100`,
`20260810153000`, `20260810154000`, `20260810155000`, or `20260810159000`.

## Hosted and historical safety

The R3 safety contract freezes four historical migrations from July 2026. This
candidate does not renumber or edit any of them. Local manifests label the two
available colliding migrations as not applied, but no hosted service was
contacted, so all four entries are classified `HOSTED_STATUS_UNVERIFIED`.
Hosted apply history must be verified before the later reconciliation card.

## Planner validation

- The existing four-way synthetic fixture accepts the candidate numeric
  sequence as `VALID_CANDIDATE_PLAN`, with unique destinations and legal fixture
  dependency order.
- The actual study RC worktree inventory is a valid, collision-free plan using
  its current uncommitted manifest reconciliation; those source changes were
  inspected but not modified by this card.
- The committed admin RC was initially blocked by the observed two-way `120000`
  collision and an absent manifest entry for
  `20260810159000_academy_study_worker_run_evidence.sql`. During this card, a
  concurrent external process applied the candidate `120200`/`120300` subset
  and supporting reference edits in that other worktree. The read-only planner
  now accepts that dirty 27-migration subset. This card did not create, alter,
  stage, or commit those external changes.
- The actual production four-way plan cannot be run until the two missing SQL
  files and their manifest entries are present. Therefore production dependency
  legality, complete manifest updates, and existing source checksums are not
  yet provable.

## Tests

- Proposal JSON parse: pass
- Existing four-way proposal fixture: `VALID_CANDIDATE_PLAN`,
  `mutationPerformed = false`
- Planner, R3 Admin preflight, Study migration preflight, and checked-in manifest
  suites: 4 files passed, 51 tests passed
- TypeScript typecheck: pass
- Production build: pass (existing Vite chunk-size warning only)
- `git diff --check`: pass

## Blockers

1. Production provider-attempt SQL and manifest entry unavailable.
2. Production curriculum-authoring SQL and manifest entry unavailable.
3. Production four-way dependency graph unproven.
4. Committed admin RC manifest omits the worker-run-evidence migration.
5. `HOSTED_STATUS_UNVERIFIED` for every colliding migration.

Final classification: **BLOCKED**.

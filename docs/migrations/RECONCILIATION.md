# Migration reconciliation (Wave 2)

Base: `125a063cc` (accepted Wave 1 trunk) · Branch:
`converge/wave2-migration-reconciliation-r1`

This document records the verified collision inventory across the unmerged
estate, the disposition of every collision, and the rule future branches must
follow. It is enforced by tests, not by convention — see
[Enforcement](#enforcement).

No migration in this wave was applied to hosted Supabase. Every result below was
produced against an ephemeral local PGlite database.

## 1. Inventory

Refs scanned: **1340** (481 local, remainder remote). Unmerged into the base:
**1230**; of those **1219** carry `supabase/migrations/`, collapsing to **103
distinct migration trees** (including the base).

Migration counts on the branches the estate classification names as live:

| Label | Ref | Migrations |
| --- | --- | --- |
| `WAVE1-BASE` | `125a063cc` | 50 |
| `RC1` | `origin/win/final-study-rc1` | 25 |
| `SEC10` | `origin/integrate/sec-10-final` | 51 |
| `RLS` | `origin/integrate/study-engine-persistence-rls` | 5 |
| `LAPTOP` | `origin/wip/laptop-local-preserve` | 4 |
| `AUDIT` | `mac/admin-migration-chain-audit` | 20 |

Correction to the classification: `win/final-study-rc1` carries **25**
migrations, not 15.

## 2. Collision table

### 2a. Same-name divergences — 4 (classification confirmed)

Same filename, different content, on different branches.

| Filename | Base blob | Divergent blob | Carried by |
| --- | --- | --- | --- |
| `20260809120000_academy_operational_telemetry_foundation.sql` | `baff778c6e7e` | `23d468613883` | `AUDIT` |
| `20260810152000_academy_study_in_app_receipt_timestamp.sql` | `710371814f23` | `036e64e7392e` | `RC1` |
| `20260810152100_academy_study_worker_operations_contract.sql` | `effc0ee0031e` | `7ae12206adcd` | `RC1` |
| `20260810153000_academy_study_release_registry_bridge.sql` | `ebca5c393c71` | `b71577fb1b2a` | `RC1` |

### 2b. Timestamp collisions — one contested version, three files

Different migrations sharing one 14-digit prefix. Within the live set exactly
one version is contested, by three distinct migrations:

| Version | Filename | Carried by | Canonical name on base |
| --- | --- | --- | --- |
| `20260810120000` | `..._academy_curriculum_draft_authoring.sql` | `BASE`, `SEC10` | keeps `20260810120000` |
| `20260810120000` | `..._academy_study_effective_settings_v2.sql` | `RC1` | re-timestamped to `20260810120200` |
| `20260810120000` | `..._academy_admin_audit_query_filters.sql` | `AUDIT` | re-timestamped to `20260810110000` |

Estate-wide (including abandoned lines) **11** version prefixes are contested;
the other ten involve only branches whose work already landed on the base under
its canonical name.

## 3. Disposition

**In every case the Wave 1 base already carries the winning content, and the
losing branches are behind rather than in conflict.** This wave verifies and
enforces that state; it does not move migration files.

### 3a. Same-name divergences — base content wins, losers are superseded

Each loser is *superseded*, not renamed forward: none carries a change the base
lacks, so no new migration is created.

- **`..._operational_telemetry_foundation.sql`** — the base flips three
  retention-window comparisons from `>=` to `>`. The base side was last written
  by `fdbdca191` *"Harden admin time boundary semantics"* (2026-08-11); the
  `AUDIT` side by `d55c5dc6c` (2026-08-09). The base is the later, deliberate
  hardening.
- **`..._in_app_receipt_timestamp.sql`** and
  **`..._worker_operations_contract.sql`** — the only difference is the
  predecessor-marker assertion: the base asserts
  `20260810120200_academy_study_effective_settings_v2`, `RC1` asserts the
  pre-reconciliation `20260810120000_...`. The base already carries the
  re-timestamp fix; `RC1` is the pre-fix state.
- **`..._release_registry_bridge.sql`** — the base is a strict relaxation of
  `RC1`: it accepts `binding_mode in ('study_new_sessions','default_authority')`
  where `RC1` accepts only the former, and accepts either the `governed` trigger
  or the `immutable`+`append_guard` pair where `RC1` requires the pair. Every
  database `RC1`'s version admits, the base's version also admits.

### 3b. Timestamp collision — already resolved by re-timestamping on the base

`academy_curriculum_draft_authoring` keeps `20260810120000` (the most-referenced
filename). The two contenders moved:

- `academy_study_effective_settings_v2`: `20260810120000` → **`20260810120200`**
  (later). Matches the ruling already recorded in
  `docs/final-integration/final-migration-reconciliation-proposal.json`
  (`canonicalFilename` `20260810120200_...`, selected blob `00c23cf4…`, which is
  the blob on the base).
- `academy_admin_audit_query_filters`: `20260810120000` → **`20260810110000`**
  (earlier), per `docs/admin-migration-chain-audit.md` §M21.

**Dependency-safety proof.** The manifest declares an explicit linear chain and
the detector rejects any dependency that does not appear earlier:

```
20260809170000 admin_curriculum_audit_vocabulary
  → 20260810110000 admin_audit_query_filters      (moved earlier)
  → 20260810120000 curriculum_draft_authoring
  → 20260810120200 study_effective_settings_v2    (moved later)
  → 20260810120300 provider_pricing_terms
```

`admin_audit_query_filters` is the riskier move because it went *earlier*; it is
safe because it depends only on the audit vocabulary established at
`20260809170000`, never on `curriculum_draft_authoring`. Beyond the declared
chain this is proven empirically: the full 50-migration sequence applies from
zero with zero errors (§5). Repository-wide there are no surviving references to
either pre-reconciliation filename outside historical design records.

### 3c. New migrations not taken in this wave

`SEC10` carries one migration the base lacks:
`20260816160000_academy_study_actor_authorization.sql`. It is **not** a
collision — its version sorts after every migration on the base and its
prerequisites (`20260801160000`, `20260801190000`) are present. It is deferred
because its consuming feature code is not in this wave; see §6.

## 4. Dispatcher decisions

One, and it is a forward hazard rather than a blocker for this branch:

- `origin/feat/adaptive-tutor-assembly-foundation` (and the
  `fix/adaptive-tutor-assembly-foundation-r1` /
  `integrate/adaptive-english-v0.2.0` line) carries a divergent
  `20260724230000_academy_student_identity_foundation.sql` — **one of the three
  migrations already applied by hand to hosted**. Its version is the older,
  less-hardened one: it lacks the `audit_reason_is_safe` guard and the base64
  canonicalization hardening. It must never be merged as-is, because doing so
  would rewrite a migration hosted has already executed. The detector fails this
  as `manifest_sha256_mismatch`, so it cannot land silently. The dispatcher
  should confirm this line is abandoned or have it rebased onto the base content.

## 5. Proof

`npm run migration:replay` (`scripts/replay-migration-chain.mjs`):

```
migration-replay: APPLIED 50 migrations from zero
  manifest sha256 mismatches: 0
  objects: {"tables":87,"routines":317,"policies":46}
  idempotence: REFUSED at 20260724074106_academy_profiles_base.sql
    Academy profiles base drift: primary key or extra constraint is incompatible
  hosted-baseline resume: OK (prefix replay refused, 47 remaining applied)
```

- **From zero**: all 50 apply in manifest order on a clean database, zero errors.
- **Idempotence**: replaying the chain over an already-migrated database is
  refused at the first migration by its own drift guard — it fails safely rather
  than double-applying.
- **Hosted-baseline resume**: applying only the three hand-applied migrations and
  then continuing applies the remaining 47 cleanly, while replaying the prefix is
  refused.

### Why this cannot corrupt the already-applied hosted database

The applied set on hosted is treated as unknown; the record shows three
migrations were run by hand. Those three are untouched by this reconciliation:

| Migration | Distinct contents estate-wide | Alternate timestamps anywhere |
| --- | --- | --- |
| `20260724074106_academy_profiles_base.sql` | 1 (identical in all 103 trees) | none |
| `20260724230000_academy_student_identity_foundation.sql` | 2 (identical in 102/103; the outlier is the abandoned line in §4) | none |
| `20260726120000_academy_household_revision_cas.sql` | 1 (identical in all 103 trees) | none |

No branch anywhere in the estate carries these three under a different
timestamp, so no rename in this reconciliation can invalidate a filename hosted
has already recorded. Every re-timestamp (`20260810110000`, `20260810120200`)
applies to migrations that sort strictly *after* the hand-applied prefix and
that the record does not show as applied. The reconciled chain is therefore a
forward-only continuation of hosted's history, which §5's hosted-baseline
resume demonstrates directly.

## 6. Rule for Wave 3/4 branches

When a branch brings migrations in:

1. **Never edit a migration that already exists on the trunk.** Content changes
   go in a new migration with a new timestamp. The detector fails an edit as
   `manifest_sha256_mismatch`.
2. **Never reuse a 14-digit version prefix.** Pick a timestamp strictly greater
   than the trunk's highest at merge time. The detector fails a reuse as a
   `collision`.
3. **Register every migration in**
   `docs/study-engine-final-production/migration-manifest.json` — `version`,
   `filename`, `sha256` (UTF-8, CRLF normalized to LF), and `dependency` naming
   the immediately preceding migration. An unregistered file fails as
   `migration_missing_from_manifest`; a manifest entry with no file fails as
   `manifest_file_missing`.
4. **Never renumber a migration below the hand-applied prefix**
   (`20260724074106`, `20260724230000`, `20260726120000`), and never renumber
   any migration the dispatcher confirms as applied to hosted.
5. **Run `npm run migration:replay` before opening the merge.** A migration that
   cannot apply from zero, or that silently re-applies, is not mergeable.

Specifically pending for a later wave:

- `20260816160000_academy_study_actor_authorization.sql` from
  `origin/integrate/sec-10-final`, which must arrive with its consuming code.
- The `family-cloud` line (12 migrations, `20260813170000`–`20260816120000`,
  carried by ~24 branches). Its versions do not collide with the base, but
  `20260814120000` is contested *within* that line
  (`academy_family_cross_device_data_r1` vs
  `academy_family_response_checkpoint_r1`) and must be resolved before it merges.

## Enforcement

| Check | Location |
| --- | --- |
| Real migration tree has no collision, ordering, or integrity hazard | `tests/migration-repository-integrity.test.js` |
| Detector analysis itself is correct | `tests/migration-collision-detector.test.js` |
| Chain applies from zero, refuses replay, resumes over the hosted prefix | `supabase/migration-chain-replay.db.test.ts` |
| Operator CLIs | `npm run migration:check`, `npm run migration:replay` |

All four run under `npx vitest run` / npm scripts, so a branch reintroducing a
collision fails the suite rather than production.

# Immutable curriculum release registry

ADMIN-16A originally added metadata custody for the already-published Manuel Academy
curriculum release. It does not add drafts, editing, validation runs, preview
builds, approvals, publish jobs, activation history, or any pointer mutation.

The later Study/Admin bridge is documented in
`docs/study-release-registry-bridge.md`. It leaves the ADMIN-16A release and
revision-1 pointer rows immutable, evolves the pointer relation into append-only
history, and makes its latest production revision authoritative only for new
Study sessions.

## Registered release

- Package: `manuel-academy-grades-5-7-8-curriculum-v1`
- Version/status: `1.0.0` / `published`
- Authored date: `2026-08-03`, proven by `curriculum-manifest.json`
- Provenance: `legacy_import`
- Source commit: `4056e31d8beb36622be5ac27ea7f20145266343b`
- Source root: `curriculum-content/manuel-academy/1.0.0`
- Files/bytes: 182 / 23,196,845
- Counts: 30 courses, 232 units, 2,736 lessons, 232 assessments,
  18 original texts, and three schedules
- Grade 5: 10 courses, 77 units, 900 lessons, 77 assessments, six texts,
  one schedule
- Grade 7: 10 courses, 77 units, 900 lessons, 77 assessments, six texts,
  one schedule
- Grade 8: 10 courses, 78 units, 936 lessons, 78 assessments, six texts,
  one schedule

The source introduction commit was independently found in current history and
the current package tree is byte-identical to that commit. The historical
source ZIP was unavailable, so its previously documented digest is not
registered as verified provenance.

The registered SHA-256 values are:

| Custody item | SHA-256 |
| --- | --- |
| `MANIFEST.json` | `38e6f27c24ec5371e4647364c088984fa0e1dbe25e1312847108a6d56d7404be` |
| `SHA256SUMS.txt` | `c2ea2bfcfb7bb1983aacd36a52ff9b88ac22cc6791e1f4e1c89585d158b0f56a` |
| `curriculum-manifest.json` | `54c622ac0f745f88ef4eecb359e5f4f411cf1d8c7f48899fd5fcabb32b019c7b` |
| Canonical file inventory | `346ffa3886764314f1371fe68236741523bad8b638bdf2300e6b6c2eab93ba35` |

The canonical inventory digest hashes each normalized path, byte count, and
file SHA-256 in the generator's deterministic path order. Every file has its
own authoritative digest even where the package manifests deliberately omit
their self-referential files.

## Schema and immutability

Migration
`supabase/migrations/20260809160000_academy_curriculum_release_registry.sql`
creates only:

- `academy_curriculum_releases`, with explicit scalar identity, provenance,
  digest, aggregate-count, and grade-count custody;
- `academy_curriculum_release_files`, with all 182 normalized relative paths,
  byte counts, SHA-256 values, content types, safe metadata-only
  classifications, and commit-pinned locators;
- `academy_curriculum_active_pointers`, seeded as `production -> 1.0.0`,
  revision 1, `migration_seed`, `registry_only`.

Published release rows, release-file rows, and the registry pointer reject
updates and deletes. The tables are owned by `postgres`, have RLS enabled and
forced, and grant no table access to `PUBLIC`, `anon`, `authenticated`, or
`service_role`. Source blobs are not stored in the database. Locators use the
form
`git_commit_path:<commit>:curriculum-content/manuel-academy/1.0.0/<path>`;
no Windows path, branch alias, or mutable deployment URL is accepted.

## Read-only Admin API

The existing curriculum endpoint adds three `GET` resources:

- `/api/admin/curriculum/releases`
- `/api/admin/curriculum/releases/1.0.0`
- `/api/admin/curriculum/production-pointer`

Each request independently requires the server-derived `curriculum:read`
capability. The server alone invokes three fixed-search-path, security-definer
read RPCs using `service_role`; browser roles have no RPC execution grant. The
detail response contains custody metadata, not file contents. There is no
activate, rollback, pointer update, draft, or publish endpoint.

At the ADMIN-16A migration boundary, the pointer response returns
`bindingMode: registry_only`, `registryOnly: true`, and
`runtimeBinding: hard-coded`. After the additive Study/Admin bridge, the latest
pointer returns `bindingMode: study_new_sessions`, `registryOnly: false`, and
`runtimeBinding: study-new-sessions`. Existing Study sessions continue to use
their immutable snapshot and never follow a later pointer revision.

## Local verification and dependency boundary

`supabase/academy-curriculum-release-registry.db.test.ts` verifies the exact
inventory and manifests, table/RPC grants, forced RLS, owner-level
immutability, student/guardian denial through the HTTP boundary, lack of
mutation surfaces, the pointer/runtime invariant, preservation of learner
state sentinels, and source-to-temporary-materialization hash custody. The
generator check is:

```text
node scripts/generate-curriculum-release-registry.mjs --check
```

The migration has not been applied to a hosted project. Its tracked checksum
is in `curriculum-release-registry-migration.json`.

ADMIN-16B editable drafts remains blocked on the ADMIN-15 audit foundation,
the required curriculum audit vocabulary, and Curriculum Schema Set v2.

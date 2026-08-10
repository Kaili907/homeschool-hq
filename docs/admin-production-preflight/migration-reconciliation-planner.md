# Migration reconciliation planner

The migration reconciliation planner is a deterministic, local, read-only tool
for preparing a candidate version map before cross-machine integration. It never
renames or edits a migration, never changes a manifest, and never contacts a
hosted service. There is no apply mode.

## Interface

The default command inventories the checked-in migration directory and prints an
operator report:

```text
npm.cmd run plan:migration-reconciliation
```

Pass a proposed mapping and select JSON for a machine-readable plan:

```text
npm.cmd run plan:migration-reconciliation:json -- --proposal path/to/proposal.json
```

Inputs may be overridden with `--migrations`, `--manifest`, `--safety`, and one
or more `--references` paths. By default the planner uses the production
migration directory, the Study migration manifest, the R3 deployment contract
as frozen-history safety metadata, and the repository root for explicit
test/document reference discovery. `--no-reference-scan` disables only that
reference discovery; it does not weaken manifest, checksum, collision,
dependency, or historical-safety validation.

The proposal is keyed by filename because a numeric source version may already
be duplicated:

```json
{
  "schemaVersion": 1,
  "reconciliations": [
    {
      "filename": "20260810120000_example.sql",
      "replacementVersion": "20260810120100"
    }
  ]
}
```

Every destination is validated against mapped and unmapped migrations. A
dependency must receive a numerically earlier destination than its dependent;
lexical file ordering is not treated as a substitute for the manifest graph.

## Safety metadata

The `--safety` input may be the R3 deployment contract or a dedicated object.
The planner recognizes manifest `historical-baseline` classifications, exact
`frozenHistoricalMigrations` and `appliedMigrations` lists, and optional
`frozenThroughVersion` and `appliedThroughVersion` boundaries. Frozen history
cannot be renumbered. A known applied migration is blocked unless the safety
input contains an exact approved `appliedRenumberingPolicies` record with the
filename, source version, destination version, and bounded approval reference.
This is planning metadata only and does not authorize hosted mutation.

## Checksum and reference plan

For each candidate rename the output distinguishes the current canonical
checksum from the post-rename, content-unchanged checksum. Those values are the
same because a rename does not alter bytes. If migration content must be edited,
the future checksum remains `UNKNOWN` until the edit exists; the planner does
not invent or precompute replacement content. It separately reports manifest
version/filename changes, dependency filename changes, migration-content
identity references, and explicit test/document references. A shared numeric
version reference is marked ambiguous when it can name more than one colliding
migration.

An invalid plan exits with code 2. The R3 duplicate gate remains blocking until
the integration branch actually contains unique files and a reconciled manifest;
planner output alone never makes preflight pass.

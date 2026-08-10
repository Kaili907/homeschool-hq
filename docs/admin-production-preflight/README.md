# Admin production activation preflight R3

This is a deterministic, local-only activation gate. It does not contact a
hosted service, authorize a migration, authorize deployment, or turn an unknown
production fact into a pass. A result of `READY_FOR_HOSTED_PREFLIGHT` authorizes
only a separately approved read-only hosted preflight phase.

## Inputs

- `deployment-contract.json` freezes required gates, classification priority,
  curriculum-studio applicability, and the audited historical migration floor.
- `current-local-evidence.json` records the evidence available on this exact
  integration line. Required missing or malformed evidence fails closed.
- `../study-engine-final-production/migration-manifest.json` maps every SQL
  migration to its version, dependency, classification, marker, and canonical
  checksum.
- `../../supabase/migrations` is read directly. The preflight never writes it.

The current contract keeps curriculum authoring and publishing
`NOT_APPLICABLE`: this activation is for the read-only Admin curriculum surface.
Changing that scope requires an explicit deployment-contract change; simply
adding evidence cannot silently expand it.

## Migration identity

The gate requires one unique numeric version per SQL file, a one-to-one
manifest/file mapping, deterministic filename/version/dependency order,
canonical LF-normalized SHA-256 checksums, and preservation of the frozen
historical floor. A historical checksum change passes only with an exact local
reconciliation record naming the filename, previous checksum, replacement
checksum, an approval reference, and `approved: true`.

Two files such as `20260810120000_a.sql` and `20260810120000_b.sql` are always a
migration-identity blocker, even if both appear in the manifest. Parallel
branches must be renumbered and reconciled during final integration.

## Pricing, accounting, and Study truthfulness

Pricing architecture and verified account pricing are separate gates. The
checked-in cost tables seed no production prices, so table existence is not
account configuration evidence.

The provider cost ledger, Provider Attempt Journal, per-attempt instrumentation,
and reconciliation are separate gates. A ledger row cannot prove that every
provider attempt, retry, timeout, or indeterminate outcome was captured.

Study readiness is split into Effective Settings V2, curriculum binding,
session composition, adult-review worker composition, worker schedule,
production mount, telemetry, and provider accounting. No generic Study boolean
can satisfy those prerequisites.

## Commands

```text
npm.cmd run preflight:admin-production
npm.cmd run preflight:admin-production:json
```

The operator form prints only contract-owned gate IDs and bounded reason codes.
The JSON form is deterministic and similarly excludes arbitrary evidence
values. A blocked result exits with code 2.

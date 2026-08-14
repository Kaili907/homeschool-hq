# Hosted Study sync staging preflight R1

This directory defines the controlled procedure to use only after hosted-sync
R2 convergence has an exact commit. It prepares a non-production validation;
it does not establish that a staging project currently exists. No command in
this package applies a migration, deploys code, enables a family, or contacts
production.

The repository's known hosted/production project reference is deliberately a
denied target in the preflight tool. A future inventory target must use an
explicit, different project ref, and the supplied Postgres connection identity
must encode that exact ref. This verifies the connection endpoint identity; an
operator must still independently verify the organization and `staging`
environment label in authenticated Supabase project metadata.

## Command contract

The learner-release commit is pinned and cannot be overridden:

```text
7baf8dfbc27168708ed4cf504285a1838d7345f6
```

After R2 convergence, run local-only mode from a clean checkout at the exact
convergence commit:

```sh
node scripts/hosted-sync-preflight/preflight.mjs \
  --learner-release-sha 7baf8dfbc27168708ed4cf504285a1838d7345f6 \
  --convergence-sha <EXACT_40_HEX_R2_CONVERGENCE_SHA> \
  --target-project-ref <EXPLICIT_NON_PRODUCTION_PROJECT_REF>
```

Local-only mode is the default. It performs no network contact. It verifies the
clean repository SHA/ancestry, the complete migration manifest and normalized
SHA-256 checksums, environment presence, exact disabled flags, non-production
target/URL binding, a disposable PGlite replay of the full migration union, the
rollback template, and the checked-in inventory SQL safety boundary.

Only after local mode passes and the runbook's backup step is evidenced may the
same command be rerun with the explicit `--hosted-read` flag:

```sh
node scripts/hosted-sync-preflight/preflight.mjs \
  --learner-release-sha 7baf8dfbc27168708ed4cf504285a1838d7345f6 \
  --convergence-sha <EXACT_40_HEX_R2_CONVERGENCE_SHA> \
  --target-project-ref <EXPLICIT_NON_PRODUCTION_PROJECT_REF> \
  --hosted-read
```

The hosted mode executes only
`scripts/hosted-sync-preflight/inventory.sql`. The client and server both force
read-only operation: `PGOPTIONS` sets `default_transaction_read_only=on`, and
the SQL begins `SERIALIZABLE READ ONLY DEFERRABLE` and always ends with
`ROLLBACK`. It inventories migration history and catalog metadata only. It does
not read learner, auth-user, content, audit, receipt, or operational rows.

The tool has no `--apply` option; it rejects that token. A future apply action
must be a different executable, reviewed in a different change, invoked only
after fresh authorization, backup evidence, checksum reconciliation, and a
two-person target confirmation. This preflight never reports apply or family
enablement as authorized.

## Ephemeral environment

Set these in the current operator shell or an approved secret-injection
facility. Do not place them in a repository file, command argument, transcript,
issue, or chat:

| Variable | Required state | Handling |
|---|---|---|
| `HOSTED_SYNC_DATABASE_URL` | present | Secret; presence only is reported |
| `HOSTED_SYNC_TARGET_PROJECT_REF` | exact same ref as `--target-project-ref` | Non-secret identity guard |
| `VITE_FAMILY_PILOT_ENABLED` | exact `false` | Family remains disabled |
| `VITE_STUDY_ENGINE_ENABLED` | exact `false` | Browser Study remains disabled |
| `ACADEMY_STUDY_ENABLED` | exact `false` | Server Study/workers remain disabled |

The database URL must be a Postgres URL whose direct hostname is
`db.<project-ref>.supabase.co` or whose pooler username ends in
`.<project-ref>`. Only the `sslmode` query parameter is accepted. The tool
parses the URL and passes the password to `psql` through `PGPASSWORD`; it never
places the URL or password in process arguments or output.

Unset the ephemeral variables when the session ends. Treat the inventory
output as internal operational metadata even though it contains no application
row payloads.

## Exit contract

- `0`: local checks passed (`READY_FOR_HOSTED_READ`) or the explicit read-only
  inventory completed (`HOSTED_READ_COMPLETE`). This never authorizes apply.
- `1`: invalid command syntax, including any apply argument.
- `2`: a guard or inventory operation failed closed.

Run the focused tests without contacting a hosted service:

```sh
node --test scripts/hosted-sync-preflight/preflight.test.mjs
```

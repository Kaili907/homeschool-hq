# Hosted sync R2 client adapter

The converged adapter calls only the four functions installed by the DB/RPC R2
migration:

| Client method | RPC | Positional SQL signature |
| --- | --- | --- |
| `firstLink` | `academy_study_sync_first_link_v2` | `(text, uuid, uuid, jsonb)` |
| `resolveMapping` | `academy_study_sync_resolve_mapping_v2` | `(text, uuid, jsonb)` |
| `hydrate` | `academy_study_sync_hydrate_v2` | `(text, uuid, text, text)` |
| `write` | `academy_study_sync_write_v2` | `(text, uuid, text, text, bigint, uuid, text, jsonb)` |

The PostgREST argument names are pinned in `client/contracts.ts`. Calls require
an ephemeral authenticated-user provider. Offline, authorization expiry,
timeout, malformed results, and privacy-invalid payloads fail closed. Stable
operation UUIDs are retained by callers across response loss; the server receipt
provides idempotency.

`client/testing/localDbRpcEmulator.ts` is a local DB-contract emulator used by
the 36-scenario harness. It deliberately has no production export or runtime
wiring. The former fake snapshot server and its invented import/write/ack RPC
names were removed.

Production activation is hard-disabled in `client/productionActivation.ts`
until a separately reviewed production privacy serializer is present.

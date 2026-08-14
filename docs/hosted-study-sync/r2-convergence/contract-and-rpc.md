# Contract and RPC convergence

## Canonical serialized state

`hosted-study-sync-state.r2.v1` remains the only canonical serialized
continuation model. Its pure local export/import test proves exact equality of
the selected Core student, app metadata, assessment, RFL, Social, Safety, and
the complete `DurableStudyDocumentV1`. PIN-derived material is removed.

## Exact database surface

| Function | SQL signature | Client method |
| --- | --- | --- |
| `academy_study_sync_first_link_v2` | `(text, uuid, uuid, jsonb)` | `firstLink` |
| `academy_study_sync_resolve_mapping_v2` | `(text, uuid, jsonb)` | `resolveMapping` |
| `academy_study_sync_hydrate_v2` | `(text, uuid, text, text)` | `hydrate` |
| `academy_study_sync_write_v2` | `(text, uuid, text, text, bigint, uuid, text, jsonb)` | `write` |

The adapter emits the exact `p_*` PostgREST keys. Nonexistent import,
revisioned-write, pull, push, and acknowledgement RPC names were removed.
Response-loss recovery retries the original UUID and fingerprint.

## First link

The Parent planner exposes exactly `EXACT_MATCH`, `EXPLICIT_MAP_REQUIRED`,
`NEW_REMOTE_STUDENT`, and `CONFLICT`. Only stable identities and explicit
Parent choices participate. Display names are presentation-only. The database
stores stable local-to-hosted scope refs and never learner names in the link
ledger.

## Remaining representation boundary

The SQL RPC is session-scoped and its checkpoint is the production recovery
record. The canonical state is student-scoped and contains the full current
device durable document (calendar blocks, sessions, checkpoints, reviews,
events, preferences, settings, and outbox). The R2 inputs do not define an
audited bijection. The candidate therefore refuses to claim a hosted round trip
of the canonical envelope even though both isolated round trips pass.

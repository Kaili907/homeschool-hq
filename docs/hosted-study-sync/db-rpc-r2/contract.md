# R2 server contract

## Browser authority

Every V2 RPC is executable only by `authenticated`. Direct execution by
`anon` and `service_role` is revoked. Each call requires `auth.uid()` and an
opaque SHA-256 Study-grant digest that resolves through the existing
current-grant predicate. The predicate includes grant expiry/revocation,
student lifecycle and session version, credential state, membership state,
permission state, exact student, and exact household.

Guardian calls require the grant issuer to equal `auth.uid()` and current
`learning_manager` or stronger access. Student calls require the JWT principal
kind `student_session_grant` and `auth.uid()` to equal the exact grant UUID.

## Explicit primitives

### First link/import

`academy_study_sync_first_link_v2(text, uuid, uuid, jsonb)`

The guardian supplies a current Study digest, hosted student UUID, client
operation UUID, explicit local scope, explicit hosted assignment/session scope,
and a minimized import document. Household and student authority are derived
from the authenticated grant; no names are accepted or compared.

The RPC takes a transaction advisory lock on the hosted session identity. If
the canonical session does not exist, it creates the canonical session,
authority state, optional full checkpoint, and explicit mapping atomically. If
the session already exists with matching immutable bindings, it creates only
the mapping and returns `linked-existing`; it never applies the import state.
Any binding collision returns `mapping-conflict`. Exact retries return the
stored receipt; changed reuse of the UUID returns `idempotency-collision`.

### Assignment/session mapping

`academy_study_sync_resolve_mapping_v2(text, uuid, jsonb)`

The caller supplies all four local stable references. The RPC returns the exact
local-to-hosted household/student/assignment/session mapping or `unavailable`.
The private ledger has no browser table grants and stores no learner names.

### Hydrate

`academy_study_sync_hydrate_v2(text, uuid, text, text)`

Hydrate revalidates the exact current grant and exact hosted
student/household/assignment/session binding. It returns the explicit mapping,
completion timestamps/state, all three server revisions, the complete
`study-core-bridge.recovery-checkpoint.v1` object, exact Social source object,
exact RFL assertion/attestation object, exact safety-hold history, exact
assessment state, and server acceptance metadata. A checkpoint integrity
failure fails the hydrate closed as `unavailable`.

### Revision-aware write

`academy_study_sync_write_v2(text, uuid, text, text, bigint, uuid, text, jsonb)`

Supported operations and revision domains:

| Operation | Domain | Actor |
| --- | --- | --- |
| `checkpoint:compare-and-swap` | checkpoint | student or guardian |
| `session:complete` | session | student or guardian |
| `social-source:attach` | authority | student or guardian; create-only |
| `rfl:assert` | authority | student or guardian; create-only |
| `rfl:attest` | authority | guardian only; must match assertion |
| `safety:hold` | authority | student or guardian |
| `safety:clear` | authority | guardian only |
| `assessment:set-state` | authority | student or guardian; student cannot certify or require adult review |

Every call supplies the expected revision and a client operation UUID. A stale
revision returns the domain and current server revision without mutation.
Receipts retain exact successful, denied, invalid, and conflict results for 180
days. A lost retry with the same actor scope and fingerprint returns the stored
result; changed reuse returns `idempotency-collision`.

An open safety hold denies session completion, RFL certification, and
assessment certification with `safety-hold-active`. Checkpoint persistence is
still permitted so the learner can safely stop without losing the last cursor.

## Data boundary

Permitted state is stable identifiers, bounded titles/publisher, timestamps,
closed status/reason/source/evidence vocabularies, safe checkpoint cursor and
time totals, opaque protected-state references, revisions, and receipts. The
validators reject raw answers, Tutor transcripts, credentials, secrets,
diagnoses, disclosure bodies, private notes, and learner-work bodies.

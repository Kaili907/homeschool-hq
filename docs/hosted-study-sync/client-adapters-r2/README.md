# Hosted Sync Client Adapters R2

This lane replaces the incompatible R1 transport/convergence client models with
one injected, production-shaped client protocol. It does not import a database
migration or moving DB implementation, contact a hosted environment, deploy,
or activate `App.tsx`.

## Ordering invariant

Normal mutations follow one order:

1. the canonical minimized Study document commits to local IndexedDB;
2. a payload-free operation commits to the local IndexedDB queue;
3. a later flush re-reads the canonical local document;
4. the authenticated hosted RPC runs.

`recordFirstLinkAfterLocalSave` and `recordWriteAfterLocalSave` require the
literal `localSaveConfirmed: true`. Queue entries never contain a document.
Hydrate is the reverse transfer: the hosted document is validated, committed to
local IndexedDB, and only then is its server revision acknowledgement queued.

## Client API

`createHostedSyncRpcAdapter` exposes exactly four calls:

- `firstLinkImport`: explicit adult-confirmed first import at CAS revision `0`;
- `hydrate`: lossless retrieval of the minimized durable Study document;
- `revisionedWrite`: whole-document CAS using a stable operation UUID;
- `acknowledge`: idempotent acknowledgement of a durably hydrated revision.

`createHostedSyncLocalFirstClient` provides local-first enqueue, hydrate/apply,
and bounded queue dispatch around that adapter. Its local and queue ports are
injected so final convergence can bind the accepted IndexedDB implementations.

## RPC boundary

The client depends only on `HostedSyncAuthenticatedRpcProvider.rpc(name, args,
signal)`. The explicit procedure names and snake-case arguments are fixtures,
not imports from the parallel DB lane. Final convergence may reconcile names
and signatures without changing the client invariants.

Every request carries protocol version `2`, stable scope refs, and only the
fields required by its operation. First import and write carry the exact
locally accepted `DurableStudyDocumentV1`; no partial projection can silently
lose completion, safety, scheduling, source, preference, checkpoint, review,
event, or outbox state.

## Auth seam

`HostedSyncEphemeralAuthorization.acquire()` yields a one-attempt lease whose
kind must be `AUTHENTICATED_USER`. The lease owns the injected RPC provider and
is released after the attempt. No bearer, refresh token, cookie, PIN, API key,
header map, or service-role client is accepted by the adapter or queue API.

## Queue and idempotency

The queue stores only:

- operation kind and stable UUID;
- household, learner, and document refs;
- immutable CAS base revision where applicable;
- acknowledgement target revision/operation where applicable;
- sequence, attempt, retry-time, and adult-link confirmation metadata.

Retries retain the UUID and CAS base. Attempts stop at `8`. A commit whose
response is lost is retried with the same UUID, allowing the server to return
the original revision as `duplicate`. Repeated acknowledgements of the same
target are also successful duplicates.

## Closed outcomes

The only client outcomes are:

`SUCCESS`, `OFFLINE`, `NETWORK_UNAVAILABLE`, `TIMEOUT`, `AUTH_REQUIRED`,
`SESSION_EXPIRED`, `RATE_LIMITED`, `STALE_REVISION`, `SERVER_UNAVAILABLE`,
`MALFORMED_RESPONSE`, `PERMANENT_REFUSAL`, and `ABORTED`.

These transport/convergence outcomes are not safety events and do not clear,
raise, synthesize, or otherwise mutate Study safety authority.

## Privacy boundary

The exact durable document parser and an additional recursive privacy guard run
before send and after hydrate. Unknown/forbidden raw response, tutor prose, PIN,
answer, credential, token, transcript, and service-role fields are refused;
they are never stripped. RPC bodies are bounded to 5 MiB. Response objects and
queue objects use exact-key parsing and fail closed on extra fields.

## Executable fixture

`client/testing/fakeRpcProvider.ts` implements the intended four-RPC contract
without a hosted dependency. It preserves the whole minimized document,
enforces CAS, detects operation-ID collisions, supports duplicate writes and
acknowledgements, and can commit a write while dropping its response to prove
lost-response recovery.

The exact DB function names/signatures remain a final-convergence task; this
lane deliberately defines the lossless client side without claiming that the
parallel DB lane already matches it.

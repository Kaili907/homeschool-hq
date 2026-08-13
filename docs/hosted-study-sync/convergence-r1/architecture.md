# Architecture

## Implemented local-first path

```text
Study Engine mutation
  -> existing IndexedDB Study port writes and read-back verifies
  -> caller records payload-free UUID operation metadata
  -> bounded ordered queue selects the document/session head
  -> ephemeral identity bridge supplies adult + Study headers
  -> RPC client hashes the in-memory Study grant for this call only
  -> academy_study_sync_write_v1 exact CAS/idempotency call
  -> successful receipt advances one revision and drains one UUID once
```

Network failure never runs a compensating local write. The queue retains the
operation and readiness reports sync health separately from local storage
health.

## Hydrate path

```text
authorized hosted student + exact assignment/session
  -> academy_study_sync_hydrate_v1
  -> exact response/identity/privacy parser
  -> authority projection sink (required)
  -> deterministic local curriculum/session template
  -> monotonic/completion-absorbing hydrate
  -> existing DurableStudyDocumentV1 parser
  -> IndexedDB write + flush + read-back validation
```

The sink is intentionally required. The current SQL response cannot populate
it losslessly; this is why the candidate remains blocked.

## Queue and revision flow

- Queue records contain operation UUID, operation kind, revision domain, base
  revision, local sequence, attempts, and retry instant only.
- Canonical Study payload is read from existing Study storage when a call runs.
- Attempts are capped at eight with a maximum five-minute backoff.
- `checkpoint` and `authority` revisions stay separate.
- Lost acknowledgement retries the same UUID and same base revision.
- A duplicate server receipt is safe; acknowledged UUIDs are bounded to 256.
- CAS conflict remains queued and becomes explicit attention, never LWW.

## Rollout gate

1. `WEB_PILOT_LOCAL_ONLY` — default; no hosted dependency.
2. `HOSTED_SYNC_STAGING` — requires complete HTTPS/RPC public configuration.
3. `HOSTED_SYNC_FAMILY_ENABLED` — additionally requires an exact household
   allowlist.

Malformed or partial hosted configuration fails closed without disabling local
Study.

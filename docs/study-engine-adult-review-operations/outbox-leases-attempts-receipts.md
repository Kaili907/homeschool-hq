# Outbox, Leases, Attempts, and Receipts

Each resolved proposal creates one job per authorized route. Jobs have their own
ID, recipient/route binding, idempotency key, state, lease owner/token/expiry,
lease generation, attempt count, retry time, structured failure code, receipt
reference, revision, and retention deadline.

Claims use a bounded `FOR UPDATE SKIP LOCKED` batch and server time. A worker may
renew or release only its live lease at the expected revision. Before claiming,
expired leases are recovered as follows:

- no provider-boundary evidence: safely available again;
- submitted, provider-accepted, or timeout evidence: `indeterminate`;
- verified receipt evidence: `delivered`.

This prevents lease theft, concurrent double claim, and post-acceptance blind
retry. Crash recording is structured and does not contain provider or safety
payloads. Expired proposals and revoked/invalid recipients are cancelled by
server-only operations.

Attempts and attempt/receipt events are append-only to ordinary callers. They
store only stable references, provider/config version, bounded timestamps,
structured result/error codes, timeout/retry decisions, lease generation, and
idempotency binding. Receipt verification binds provider, configuration, route,
job, attempt, recipient, household/learner through the job, idempotency key,
delivery time, and evidence reference. Replays and binding mismatches cannot be
reassigned to another attempt or job.

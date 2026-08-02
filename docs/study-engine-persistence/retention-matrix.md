# Study Engine retention matrix

Retention is explicit and fail-closed. No browser role can delete a Study row.
Where deletion is supported, it requires an expired record, a trusted server
context, a scoped learner/object/revision tuple, a destruction receipt, and an
immutable minimized audit event.

| Data | Default retention | Mutation rule | Deletion/expiry rule | Sensitive payload |
|---|---|---|---|---|
| Sessions | durable lifecycle record | revisioned RPC | no deletion path in v1 | none |
| Event ledger | durable evidence ledger | append-only | no deletion path in v1 | minimized allowlisted JSON only |
| Checkpoints | `expires_at` required | CAS only | reads stop at expiry; physical cleanup deferred | no raw answer/transcript |
| Reviews/calendar | durable scheduling state | revisioned/idempotent RPC | no deletion path in v1 | none |
| Parent settings | current durable state | revisioned RPC | no deletion path in v1 | no learner raw work |
| Accommodations | effective-dated current rows | revisioned RPC plus immutable history | no deletion path in v1 | no diagnosis language |
| Protected learner work | caller expiry, at most 365 days | append revision only | trusted crypto-erasure RPC after expiry | AES-256-GCM envelope ciphertext |
| Adult notes | caller expiry, at most 365 days | append revision only | trusted crypto-erasure RPC after expiry | AES-256-GCM envelope ciphertext |
| Adult-review proposals | durable structured proposal | controlled state transition | no deletion path in v1 | no raw disclosure/diagnosis |
| Outbox | durable delivery/audit state | monotonic server-only state machine | no deletion path in v1 | no raw disclosure/credential |
| Mutation receipts | bounded by `expires_at` | append-only | internal retention-authorized cleanup only | digest and minimized result |
| Audit events | durable | append-only | no deletion path in v1 | validator rejects secret/raw-content keys |

## Encryption and erasure boundary

Protected work and adult-note bodies require an `aes-256-gcm-envelope-v1`
boundary: KMS key reference, wrapped data key, 12-byte nonce, 16-byte
authentication tag, ciphertext, and 32-byte keyed integrity tag. The database
does not hold a plaintext data-encryption key.

The trusted deletion confirmation represents completed external key
destruction. The RPC does not destroy a KMS key itself. It validates expiry,
deletes only the exact `(student_id, object_id, revision)` target under an
internal transaction-local guard, and records a `retention.delete` audit event
without key material or ciphertext. Local tests prove a browser cannot execute
the RPC, a wrong learner cannot select the target, and the due target is removed.

Checkpoint expiry currently makes the projection unavailable but does not
physically delete the row. Production cleanup for checkpoints, receipts,
events, and audits requires a separately approved retention schedule and
maintenance function; adding an ad hoc DELETE policy is prohibited.

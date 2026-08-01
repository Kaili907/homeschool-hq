# Adult-review lifecycle

An academic or safety event may create a durable adult-review proposal. The proposal is idempotent and does not itself authorize notification. A worker resolves authorized recipients, creates route-specific jobs, acquires bounded leases, reauthorizes immediately before delivery, records an attempt, calls the configured provider, validates provider evidence, and records an attempt-bound receipt.

Indeterminate outcomes are not treated as successful delivery. Retries require idempotency and lease ownership. Revoked or expired recipient authority stops delivery. Production requires durable proposal, outbox, limiter, authorization, monitoring, delivery, and receipt-validation ports; memory stores are preview/test-only.

The local durable ports and contracts exist. The real worker authorization/schedule, delivery providers, and receipt validators do not.

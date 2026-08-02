# Worker authorization model

Worker authority is credential-bound, not a caller-supplied worker ID. Verification must bind worker identity, credential reference and version, exact scope, effective/expiry time, revocation state, and verifier version. Rotation invalidates the prior credential. Every claim, lease, attempt, receipt, rate-limit, monitoring, and retention operation checks the required scope and records minimized immutable audit evidence.

General service-role possession alone is not worker authority. Browser-authored worker context is rejected.

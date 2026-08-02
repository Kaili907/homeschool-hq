# Contract compatibility matrix

| Surface | Imported state | Canonical production contract | Result |
|---|---|---|---|
| Learner identity | Host-selected/synthetic values were possible | Server verifies principal and derives learner authority; client value is selector only | Reconciled, production not yet wired |
| Study persistence | Local adapters and imported database contracts differed | Authenticated durable adapters plus RLS/ACL migration | Implemented locally; hosted state unverified |
| Safety classification | Provider and readiness behavior could be partial | Trusted-server provider, durable limiter, fail-closed readiness, abort propagation | Reconciled |
| Adult review | Memory stores and loose delivery lifecycle | Durable proposal/outbox ports, leases, attempt-bound receipts, reauthorization | Reconciled; real worker/providers missing |
| Direct student access | No approved issuer | Signed, server-verifiable capability grant | Explicitly not-ready |
| Staff access | No approved model | Explicit permission plus mandatory audit evidence | Explicitly disabled |
| Preview | Feature flag could expose local runtime | Development build plus feature flag plus explicit preview flag | Isolated |
| Tutor/voice keys | Browser key slots/direct endpoints existed | Production same-origin gateways only | Reconciled |
| Cancellation | UI lifecycle did not cover all stale work | Epoch/abort boundary and stale-write guards | Improved; legacy ports still lack end-to-end abort |

Wire/schema versions are explicit in `src/study/contracts/production/versions.ts`. Unknown, duplicate, local, memory, test, fixture, preview, synthetic, noop, or mock production registrations are rejected.

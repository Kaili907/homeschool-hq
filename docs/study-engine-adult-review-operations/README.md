# Session 17 — Adult Review Operations and Delivery

This package is the Session 17 handoff for the local candidate at
`integrate/study-engine-adult-review-operations`, based exactly on
`e788d4ad12333b13d9c6fe4d014536d84c641331`.

## Outcome

The additive candidate supplies explicit adult-notification permission checks,
server-derived opaque recipient resolution, per-route outbox jobs, bounded
leases, immutable attempt and receipt evidence, an atomic durable in-app route,
provider-neutral external boundaries, durable rate limiting, scheduled-worker
orchestration, durable monitoring, readiness, and bounded retention erasure.

Email is deliberately `not-ready` because the repository contains no approved
email vendor or configuration evidence. SMS remains disabled. The durable
in-app route is the only allowed production route in this candidate.

Session 16 must compose the server-only ports and worker credential verifier.
Session 18 must complete the hosted read-only preflight. No hosted migration,
real notification, provider call, production-data access, deployment, merge, or
push is part of this handoff.

## Documents

- [Before/after state](./before-after-state.md)
- [Recipient authorization and permission](./recipient-authorization-and-permission.md)
- [In-app and external provider architecture](./providers.md)
- [Outbox, leases, attempts, and receipts](./outbox-leases-attempts-receipts.md)
- [Indeterminate-result runbook](./indeterminate-result-runbook.md)
- [Rate limits, worker schedule, monitoring, and readiness](./operations.md)
- [Privacy, retention, and RLS](./privacy-retention-rls.md)
- [Migration and rollback](./migration-and-rollback.md)
- [Session 16 integration contract](./session-16-integration-contract.md)
- [Session 18 preflight dependency map](./session-18-hosted-preflight.md)
- [Validation report](./validation-report.md)
- [Remaining blockers](./remaining-blockers.md)

# Adult-review lifecycle

1. A safety decision durably creates an adult-review proposal; it does not send a notification.
2. The server resolves each recipient from current household membership, guardian-to-learner relationship, permission, channel, route, and exact revision evidence.
3. Recipient-aware uniqueness creates at most one job for a proposal/recipient/route tuple while allowing two separately authorized guardians.
4. A credential-verified worker claims a job and receives a revision-bound lease. Renewal, release, crash recovery, and invalid-job cancellation require the current lease revision.
5. The worker reserves the canonical rate-limit scope and creates an immutable attempt before delivery.
6. In-app delivery runs inside a database transaction that rechecks the database-owned production policy, membership, guardian relationship, permission, revisions, and route. Missing or revoked authority fails closed.
7. The receipt is bound to the attempt, provider event, route, recipient, proposal, and job. Duplicate event and receipt insertion is idempotently rejected.
8. Monitoring records minimized immutable evidence; it never replays protected payloads. Retention removes only eligible operational records through the authorized path.

Browser input, stale recipient evidence, service-role possession without a valid worker credential, and caller-supplied worker identity are not authority. `not-approved`, `not-ready`, invalid, expired, revoked, or revision-mismatched states produce no delivery.

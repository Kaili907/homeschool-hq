# RLS matrix

| Data group | RLS state | Browser-readable path | Mutation path | Result |
| --- | --- | --- | --- | --- |
| Public Study settings, sessions, ledger, checkpoints, reviews, calendar, parent settings, accommodations, audit | Enabled and forced | Household/learner-scoped select policies where applicable | Direct authenticated insert/update/delete policies are false; authorized RPCs perform mutations | Cross-household and direct-write tests pass |
| Protected learner work, adult notes, accommodation revisions, legacy proposals/outbox/receipts/metadata | Enabled and forced in `academy_private` | No direct browser table path | Trusted-server/security-definer operations with subject and authorization checks | Private payload remains private |
| Adult permissions, routes, proposals, jobs, attempts, receipts, rate-limit and monitoring records | Enabled and forced in `academy_private` | No direct browser table path | Service operations plus current recipient/worker/policy checks | Revocation and stale-revision tests pass |
| Attempt events, receipt events, worker registry, rate-limit scopes, route capabilities, adult-review audit | Enabled and forced in `academy_private` | None | Credential-scoped worker RPCs; immutable rows reject mutation | Lease/receipt/replay tests pass |
| Parent notifications | Enabled and forced in `academy_private` | Opaque authenticated list/read RPCs only | Delivery transaction after live policy and recipient reauthorization | Detailed guardian issue data is not exposed |
| Production policy | Enabled and forced in `academy_private` | Readiness returns normalized state only | No browser write path; default is `not-approved` | Missing approval fails closed |

All sensitive relations are owner-forced. The final database suite verifies direct-access denial, cross-household isolation, role/grant boundaries, opaque guardian launch failures, revocation races, and notification read reauthorization.

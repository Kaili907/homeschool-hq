# Blockers and migration plan

## Blocking conditions

1. Verify exact hosted-project custody and drift read-only.
2. Approve and implement the 17 concrete production port implementations.
3. Approve a server-derived guardian authority path.
4. Build an approved verified-identity bridge around the frozen academic runtime.
5. Approve a direct-student issuer or keep direct-student access unavailable.
6. Approve a staff authorization/audit model or keep staff access disabled.
7. Configure real delivery providers, receipt validators, monitoring, and durable rate-limit secrets server-side.
8. Authorize and schedule the adult-review worker with least privilege.
9. Close legacy cancellation/write-epoch gaps.
10. Run exact hosted preflight, migration rehearsal, browser/accessibility checks, and post-deploy smoke checks.

## Ordered migration plan

After approvals, take a hosted read-only inventory and compare it to the migration readiness assertions. Rehearse the additive migration against a production-like clone, including RLS/ACL denial tests and rollback. Deploy server capabilities dark, register them as not-ready, then prove each dependency and switch its registry state only with evidence. Keep UI visibility off until authority, runtime, registry, hosted drift, worker, provider, monitoring, cancellation, and rollback gates all pass. Enable a narrow guardian cohort first; direct student and staff remain separate approvals.

This branch performs none of those hosted or external-state actions.

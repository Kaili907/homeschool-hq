# Rollback plan

The first rollback control is fail-closed availability: disable Study visibility and mark the affected production dependency not-ready. Stop worker lease acquisition before changing provider or outbox infrastructure; do not erase attempts, receipts, proposals, events, or audit evidence.

Application rollback must use a known-good immutable artifact and preserve wire/schema compatibility. Database rollback should prefer a forward corrective migration. The additive migration contains durable records and security changes; do not drop tables or relax RLS as an emergency shortcut. Revoke newly introduced execution grants and disable new entry points only after confirming existing workers cannot continue.

Before any rollout, record:

- the deployed application and migration identifiers;
- readiness output and exact hosted ACL/RLS inventory;
- worker/provider disable procedure;
- queued/leased/indeterminate job counts;
- monitoring and incident owners;
- the forward-fix migration and restore rehearsal evidence.

After rollback, reconcile leased and indeterminate attempts manually and prove that no duplicate external notification can occur before re-enabling workers.

# Migration and Rollback Guide

The reserved additive migration is
`20260801170000_academy_study_adult_review_operations.sql`. It requires Session
15 reconciliation objects and postgres execution, detects unmarked object
collisions, reconciles historical state labels, preserves prior safety
monitoring names/schema version 1, and records operations version 2 in the
persistence metadata.

Before hosted application, Session 18 must verify the expected base migrations,
roles, function owners/configuration, relation/constraint names, absence of the
reserved objects, and compatibility of existing monitoring/state rows. Apply
only through the approved hosted migration process; this session did not apply
anything hosted.

There is no destructive automatic down migration. Rollback is forward-only:

1. Stop Session 16 worker scheduling and new v2 claims.
2. Preserve attempts, receipts, notifications, monitoring, and audit evidence.
3. Deploy a reviewed compensating migration that revokes v2 execute grants and
   marks route capabilities/worker registry `not-ready` or revoked.
4. Do not map delivered/indeterminate records backward or delete evidence.
5. Restore service only after data-state and idempotency reconciliation.

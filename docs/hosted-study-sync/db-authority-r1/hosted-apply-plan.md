# Hosted apply plan

Status: plan only. Do not apply from this branch without a separate explicit
hosted-change authorization.

1. Confirm the exact target project independently. The repository manifest
   names project ref `ymtvzmqhfvwjtxjdmybs`; do not assume that fact proves the
   currently selected hosted project.
2. Obtain a read-only hosted migration/version, marker, function-signature,
   owner, ACL and RLS inventory. Do not use the Dashboard SQL editor.
3. Reconcile that inventory against all 52 manifest entries and exact LF
   checksums. Stop on any unknown version, checksum drift, missing singleton,
   unexpected overload or object collision.
4. Confirm `20260813170000` and `20260813171000` are absent and the predecessor
   markers required inside each migration are present.
5. Take and verify a recoverable database backup under the normal hosted
   operations process.
6. Restore the backup into an isolated local PostgreSQL environment and replay
   the unapplied ordered migrations there. Run the full authority suite against
   representative synthetic two-household/sibling fixtures.
7. Update the checked-in hosted evidence with the exact historical versions,
   marker transitions and approved executable checksums. The current evidence
   deliberately remains fail-closed and does not authorize mutation.
8. In a maintenance window, apply through the approved Supabase migration
   workflow only. Apply in manifest order; do not rename versions or select SQL
   fragments manually.
9. Immediately verify markers, exact overloads, owners, search paths, ACLs,
   forced RLS, trigger installation and the one-to-one authority backfill count.
10. Run synthetic actor probes: correct/wrong actor, wrong household, sibling,
    wrong student/assignment/session, revoked grant, duplicate operation, stale
    revision, student attestation refusal and student safety-clear refusal.
11. Keep all cross-device feature routing disabled until the application
    transport consumes the documented actor-aware signatures and returns
    fail-closed on unknown database results.
12. Monitor authorization denials, revision conflicts, idempotency collisions
    and database errors. Do not activate Tutor as part of this apply.

Operational rollback is to disable the cross-device caller and revoke the two
new authenticated RPC grants under an explicitly authorized migration. The
schema changes are additive and non-destructive; do not drop the authority
table or receipts after production use without a separately reviewed data
retention and export plan.

# Hosted foundation baseline plan

The exact hosted project is `ymtvzmqhfvwjtxjdmybs`. The first three historical result objects already exist and their local definitions were previously confirmed equivalent, but no supported hosted migration ledger exists. Replaying their SQL is prohibited.

Future procedure, only after separate authorization:

1. Reconfirm exact project identity and read-only object equivalence.
2. Reconfirm function definitions, triggers, RLS, roles, and the foundation marker.
3. Approve the exact historical checksums and evidence record.
4. Use the then-current supported Supabase baseline/history procedure to record the three versions as already applied without executing SQL.
5. Verify the ledger, objects, marker, and checksums read-only.
6. Stop on any drift or partial history; do not guess, replay, or manually insert rows.

Rollback is procedural: preserve evidence, stop before any executable Study migration, and use the supported history operation to revert only the newly recorded baseline entries if authorized and safe. Existing foundation objects are never dropped by the baseline procedure.

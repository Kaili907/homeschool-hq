# Hosted foundation baseline plan

> **Superseded 2026-08-07 — steps 3 and 4 below are obsolete; the rest still stands.**
>
> This plan was written to record historical versions into a hosted ledger that was believed absent. Evidence recorded later establishes that a migration ledger does exist and already holds ten versions as applied — the four foundation migrations from the 2026-08-02 reset and the six Study migrations from the 2026-08-03 DDL burst. There is no baseline left to record, so the recording steps have nothing to do; the read-only equivalence and drift-stop steps are untouched and still required before any hosted work. The prohibition on replaying historical SQL is unchanged and now covers all ten. Provenance and its limits: `hosted-applied-evidence.json`.
>
> The paragraph and steps below are preserved as written. Their author did not have hosted access and was not wrong to plan for what the evidence then showed.

The exact hosted project is `ymtvzmqhfvwjtxjdmybs`. The first three historical result objects already exist and their local definitions were previously confirmed equivalent, but no supported hosted migration ledger exists. Replaying their SQL is prohibited.

Future procedure, only after separate authorization:

1. Reconfirm exact project identity and read-only object equivalence.
2. Reconfirm function definitions, triggers, RLS, roles, and the foundation marker.
3. ~~Approve the exact historical checksums and evidence record.~~ *(Obsolete 2026-08-07: these versions are already in the ledger.)*
4. ~~Use the then-current supported Supabase baseline/history procedure to record the three versions as already applied without executing SQL.~~ *(Obsolete 2026-08-07: ten versions are already recorded as applied; there is nothing to baseline.)*
5. Verify the ledger, objects, marker, and checksums read-only.
6. Stop on any drift or partial history; do not guess, replay, or manually insert rows.

Rollback is procedural: preserve evidence, stop before any executable Study migration, and use the supported history operation to revert only the newly recorded baseline entries if authorized and safe. Existing foundation objects are never dropped by the baseline procedure.

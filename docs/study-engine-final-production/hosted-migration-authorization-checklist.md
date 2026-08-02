# Hosted migration authorization checklist

- [ ] Exact project ref independently verified.
- [ ] Foundation object equivalence reconfirmed.
- [ ] Function, trigger, RLS, role, and exposure comparisons match.
- [ ] Separate baseline/history authorization recorded.
- [ ] Supported baseline procedure selected; no raw ledger insert.
- [ ] Historical SQL replay explicitly prohibited.
- [ ] Baseline ledger verified after recording.
- [ ] Final migration manifest checksum set approved.
- [ ] No hosted drift or name/index/constraint collision.
- [ ] Corrected Session 17 and Session 19 migrations absent.
- [ ] Count-only compatibility checks pass.
- [ ] Rollback owner and recovery window approved.

Any unchecked item blocks hosted migration application.

# Validation

Observed honest R6 state at executable candidate
`f466d5090230a0198a4a44937dcaf850259e860f` before W4-R7/W4-R8
reconvergence:

- executable hard gates: 11/13 PASS;
- external baseline blockers: exactly `REPLAY_CRASH_IDEMPOTENCY` (W4-R7) and
  `PRIVACY_RETENTION_MINIMIZATION` (W4-R8);
- implementation mutations: 13 qualifying and compile-valid guarded source
  rewrites; 11 killed, zero survived, zero invalid, and two externally blocked;
- Boolean evidence authority: removed;
- production changes under `src/**`, `netlify/**`, and `supabase/**`: none.

Validation commands:

```text
npm run tutor-v4:typecheck
npm run tutor-v4:test
npm run tutor-v4:gate
npm run tutor-v4:negative
npm run tutor-v4:release
npm run tutor-v4:release-check
npm run tutor-v3:gate
git diff --check
```

The Wave 4 gate and mutation commands intentionally exit non-zero in the honest
11/13 R6 state. Their generated JSON is the authoritative result.

Regression results:

- strict Tutor V4 tooling typecheck: PASS;
- gate architecture tests: 4/4 PASS;
- executable Wave 4 detector baseline: 11/13 PASS, with only W4-04/W4-07
  failing;
- Wave 3 hard gates: 18/18 PASS;
- Wave 3 convergence: 33/33 PASS;
- Wave 2 convergence: 288/288 PASS;
- release generation/check: 17 artifacts PASS;
- disposable worktree cleanup/prune: PASS.

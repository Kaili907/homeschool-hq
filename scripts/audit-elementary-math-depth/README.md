# Elementary Mathematics Depth Audit R1

This read-only audit inspects the active Grade 3, Grade 4, and Grade 5 Mathematics learner packages and separately stored answer keys. It writes evidence only to `docs/curriculum-quality/elementary-math/audit-r1`.

Run from the repository root:

```bash
node scripts/audit-elementary-math-depth/audit.mjs
node scripts/audit-elementary-math-depth/audit.test.mjs
```

The audit uses deterministic structural, duplication, answer-leak, and subject-aware language rules. Machine readability scores are advisory and are never authoritative.

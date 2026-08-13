# Ready for Life production corpus

This directory is the single Ready for Life production input for final
curriculum convergence. It contains 324 source lessons: 36 lessons for each
supported grade (3, 4, 5, 7, 8, 9, 10, 11, and 12).

Student-facing packages and adult-only scoring records remain separate. A
learner completion can certify only a learner-authority lesson. A
guardian-authority lesson remains pending until a household-authorized
guardian attests through an adult-facing surface. No scoring record belongs in
a learner renderer.

## Layout

- `packages/`: one preserved student production package per source lesson.
- `scoring/`: one preserved adult scoring/completion record per source lesson.
- `schemas/`: canonical student-package and adult-record schemas.
- `projections/`: compact runtime catalog and completion-authority projection.
- `reports/`: H3, provenance, duplication, progression, and attestation evidence.
- `manifest.json`: canonical lesson-to-artifact index.
- `SHA256SUMS`: checksums for every committed corpus artifact except itself.
- `scripts/`: deterministic reconciliation and verification tooling.
- `tests/`: the 324-lesson Production Gate H3 test.

## Verification

From the repository root:

```sh
node curriculum-production/final/ready-for-life/scripts/reconcile.mjs --verify
npx vitest run --config curriculum-production/final/ready-for-life/tooling/vitest.config.mts
```

`--write` is intentionally maintainer-only: it requires the exact source
branches and immutable tips recorded in `reports/source-branch-ledger.json`.
It never contacts hosted services.

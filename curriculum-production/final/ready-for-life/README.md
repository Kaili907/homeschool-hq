# Ready for Life production corpus

This directory is the single Ready for Life production-depth R1 input for final
curriculum convergence. It contains 324 rebuilt lessons: 36 lessons for each
supported grade (3, 4, 5, 7, 8, 9, 10, 11, and 12).

Ready for Life is Manuel Academy local composition. The deterministic
`scripts/production-depth.mjs` layer composes each immutable selected source
lesson into a complete learner experience with a practical goal, delivered
resources, worked model, ordered instruction, guided first attempt, real and
equal-credit fictional routes, minimal evidence, a full correction loop,
realistic time, privacy limits, and route-specific adult authority. It does
not attach Michigan or other state authority.

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
- `reports/production-depth-report.json`: 324-lesson depth and 54-lesson representative-family QA.
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
It selects by lesson identity, applies the versioned composition family, and
regenerates every package and report. It never contacts hosted services and
does not mass-edit generated lessons by hand.

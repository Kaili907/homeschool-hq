# W3-05 validation

## Commands

From `adaptive-tutor/evals/v3`:

```sh
npm test
npm run evaluate
```

Strict TypeScript validation was also run against `tsconfig.json` using the
workspace's installed TypeScript 5.8 toolchain.

## Result

- 7 tests passed, 0 failed.
- Strict TypeScript validation passed with no diagnostics.
- 10 deterministic cases produced 20 attempts.
- The in-memory mock adapter received 16 calls; privacy and insufficient-
  grounding preflight cases received zero calls.
- Every adversarial raw candidate was recorded as a model-behavior violation
  and successfully contained.
- The deterministic decision reported containment passed and commercial
  certification incomplete because no live-model campaign ran.
- No secrets, network access, provider SDK, or production authorization are
  present.

## Covered invariants

- duplicate case IDs and malformed digests are rejected;
- exact provenance drift makes certification incomplete;
- raw hard failures fail stochastic certification despite perfect 4/4 scores;
- repeated stochastic evidence requires declared count and exact trial indexes;
- authority snapshots remain digest-identical before and after every attempt;
- raw prompt and completion retention flags are structurally fixed to `false`;
  and
- `productionAuthorized` remains structurally fixed to `false`.

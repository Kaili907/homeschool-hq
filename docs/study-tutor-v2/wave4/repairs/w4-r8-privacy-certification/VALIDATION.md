# W4-R8 validation record

## Current certification

From `adaptive-tutor`:

```sh
npx tsc -p adversarial/v4/privacy-retention/tsconfig.json --pretty false
node adversarial/v4/privacy-retention/.dist/adversarial/v4/privacy-retention/certify.js
```

Result: PASS.

- legitimate durable multimodal projection: accepted
- canary categories: 14
- scanned surfaces: 41
- direct leaks: 0
- normalized leaks: 0
- encoded leaks: 0
- raw media persisted: false
- transcript persisted: false
- provider-policy attacks: 6/6 fail closed, zero provider calls
- closed-schema mutations: 9/9 rejected
- negative control: raw-transcript retention detected
- Wave 3 hard gates executed by certification: 18/18

## Focused regressions

R2 multimodal regression:

```sh
npx tsc -p tsconfig.test.json --pretty false
node --test \
  .test-dist/core/v3/multimodal/multimodal.test.js \
  .test-dist/core/v3/presentation/presentation.test.js \
  .test-dist/tests/wave4-repairs/multimodal-boundary/seeded-adversarial.test.js
```

Result: PASS, 30/30.

R5 presentation-lineage regression:

```sh
node tests/wave4-repairs/presentation-lineage/run.mjs
```

Result: PASS, 20/20.

Wave 3 regression:

```sh
npm run tutor-v3:gate
npm run tutor-v3:test
```

Results: PASS, 18/18 hard gates and 33/33 convergence tests.

Current Wave 4 schema check:

```sh
npm run tutor-v4:schema-check
```

Result: `PASS wave4-schema-check 10 schemas + inventory`.

The older `tutor-v3:schema-check` command still reports the assembled
starting-SHA historical drift at
`study-commercial-tutor-advisory.schema.json`. This repair does not modify
generated schemas or global release evidence; the current Wave 4 canonical
schema check is green.

`git diff --check` also passes.

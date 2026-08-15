# W3-12 validation record

Date: 2026-08-15

The lane worktree had no local `node_modules`, so the standard package script
could not resolve `tsc`. Validation used the existing TypeScript CLI and Node
type declarations from the accepted Wave 2 review sandbox. Compilation output
remained in the ignored `adaptive-tutor/.test-dist` directory.

## Results

- [VERIFIED] Full adaptive-tutor strict TypeScript compilation: PASS.
- [VERIFIED] Focused bounded instructional memory: 13/13 tests passed.
- [VERIFIED] Full compiled adaptive-tutor regression: 665/665 tests passed.
- [VERIFIED] The broad regression was run from `adaptive-tutor/`, which is the
  fixture-relative package working directory required by schema-parity tests.

## Commands

```text
node <existing-typescript>/bin/tsc \
  -p adaptive-tutor/tsconfig.json --noEmit \
  --typeRoots <existing-node-modules>/@types

node <existing-typescript>/bin/tsc \
  -p adaptive-tutor/tsconfig.test.json \
  --typeRoots <existing-node-modules>/@types

node --test \
  adaptive-tutor/.test-dist/core/v3/memory/bounded-instructional-memory.test.js

# Working directory: adaptive-tutor/
node --test .test-dist/**/*.test.js
```

An earlier broad invocation from the repository root produced 21 fixture
`ENOENT` failures because the existing parity tests resolve
`json-schema/...` relative to the package working directory. The corrected
package-directory invocation passed all 665 tests; no code change was used to
mask that invocation error.

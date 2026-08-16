# W3-R3 validation record

Date: 2026-08-15

The worktree has no local `node_modules`. Validation used the existing
TypeScript CLI and Node declarations from another repository worktree, as the
assembled W3-12 lane did. Generated test output remained under the ignored
`adaptive-tutor/.test-dist` directory.

## Required scenarios

- [VERIFIED] Normal operation reaches `complete` with one logical effect, one
  physical attempt, and one memory projection.
- [VERIFIED] Duplicate exact retry reuses the effect and returns the same memory
  revision/digest as `duplicate`.
- [VERIFIED] Memory failure after effect acceptance remains `memory-pending`.
- [VERIFIED] Retry repairs memory from the accepted minimized event without a
  second effect.
- [VERIFIED] Crash before effect acceptance permits a second distinct physical
  attempt only after canonical lookup remains missing.
- [VERIFIED] Crash after accepted effect but before memory is repaired through
  canonical lookup with no duplicate effect.
- [VERIFIED] Foreign learner, session, context, and opportunity scopes are
  quarantined before lookup or execution.
- [VERIFIED] Exact duplicate delta is idempotent.
- [VERIFIED] Conflicting delta for one logical operation is rejected.
- [VERIFIED] Stale expected memory revision/digest is rejected.
- [VERIFIED] Raw transcript and unknown prose carriers fail closed.
- [VERIFIED] Mastery, grade, placement, curriculum, and Study mutations fail
  closed; successful projections keep all authority flags false.
- [VERIFIED] Add, remove, and replace operations are bounded and advance one
  deterministic revision.
- [VERIFIED] Timestamp-free identical construction produces identical delta,
  revision, and digest values.

## Commands

```text
node <existing-typescript>/bin/tsc \
  -p adaptive-tutor/tsconfig.json --noEmit \
  --typeRoots <existing-node-modules>/@types

node <existing-typescript>/bin/tsc \
  -p adaptive-tutor/tsconfig.test.json \
  --typeRoots <existing-node-modules>/@types

# Working directory: adaptive-tutor/
node --test \
  .test-dist/core/v3/memory/bounded-instructional-memory.test.js \
  .test-dist/core/v3/recovery/recoverable-memory-replay.test.js

# Working directory: adaptive-tutor/
node --test .test-dist/**/*.test.js
```

## Final results

- [VERIFIED] Strict adaptive-tutor TypeScript compilation: PASS.
- [VERIFIED] Focused W3-12 plus W3-R3 suites: 28/28 tests passed.
- [VERIFIED] Full compiled adaptive-tutor regression: 680/680 tests passed.
- [VERIFIED] `git diff --check`: PASS.

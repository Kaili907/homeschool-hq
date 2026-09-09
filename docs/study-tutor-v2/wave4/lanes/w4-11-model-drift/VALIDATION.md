# W4-11 validation

## Scope

Validation is local and offline. It compiles only the owned model-drift package
and runs its synthetic Node test suite. No credentials, provider SDKs, network
calls, production data, route changes, or deployment actions are involved.

## Commands

From `adaptive-tutor/certification/v4/model-drift`, the focused test command was
run with the repository's already-installed sibling dependency cache exposed
through `NODE_PATH` (this clean worktree has no local `node_modules`):

```sh
NODE_PATH=/Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-grade-migration-r1/node_modules node scripts/run-compiled.mjs
node /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-grade-migration-r1/node_modules/typescript/bin/tsc -p tsconfig.json --typeRoots /Users/stephenmanuel/manuel-academy-dev/mac-worktrees/mac-grade-migration-r1/node_modules/@types
```

## Result

- Focused deterministic policy tests: 21 passed, 0 failed.
- Strict TypeScript check: passed with no diagnostics.
- Canonical identity coverage: all ten required fields.
- Recertification-rule coverage: every identity field exactly once.
- Hard/soft noncompensation, alias revision drift, exclusive expiry, invalid
  evidence, and exact rollback/fallback behavior: passed.
- No live model/provider calls and no production action were performed.

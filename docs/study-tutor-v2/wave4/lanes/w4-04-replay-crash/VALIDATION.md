# W4-04 validation record

Date: 2026-08-16

## Scope

- Branch: `mac/tutor-v2-w4-replay-crash-r1`
- Starting SHA: `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`
- Production persistence added: none
- Production runtime modified: none
- Owned implementation: `adaptive-tutor/adversarial/v4/replay-crash/**`
- Owned evidence: `docs/study-tutor-v2/wave4/lanes/w4-04-replay-crash/**`

The worktree has no local dependency installation. Validation uses an existing
repository worktree's TypeScript executable and Node type declarations. All
compiled output is under ignored `.test-dist` directories.

## Focused commands

```text
<typescript>/bin/tsc \
  -p adaptive-tutor/adversarial/v4/replay-crash/tsconfig.json \
  --typeRoots <node-modules>/@types

node --test \
  adaptive-tutor/adversarial/v4/replay-crash/.test-dist/adversarial/v4/replay-crash/state-machine.test.js
```

## Focused results

- [VERIFIED] Strict TypeScript compilation: PASS.
- [VERIFIED] Required deterministic crash windows: 15/15 passed.
- [VERIFIED] Total adversarial assertions: 28/28 tests passed.
- [VERIFIED] Exact recovered summary equals no-failure summary for every crash
  point.
- [VERIFIED] Every recovered crash run ends with exactly one Study effect, one
  provider physical execution, one memory projection, one telemetry event, and
  one Parent projection.
- [VERIFIED] Every transition trace is monotonic and state-continuous.

## Broader regression

```text
<typescript>/bin/tsc \
  -p adaptive-tutor/tsconfig.json --noEmit \
  --typeRoots <node-modules>/@types

<typescript>/bin/tsc \
  -p adaptive-tutor/tsconfig.test.json \
  --typeRoots <node-modules>/@types

# Working directory: adaptive-tutor/
find .test-dist -type f -name '*.test.js' -print0 \
  | sort -z \
  | xargs -0 node --test
```

- [VERIFIED] Strict adaptive-tutor TypeScript compilation: PASS.
- [VERIFIED] Full compiled adaptive-tutor regression: 888/888 tests passed.
- [VERIFIED] No production runtime or persistence file changed.
- [VERIFIED] `git diff --check`: PASS.

## Certification disposition

`W4_REPLAY_CRASH_READY_FOR_CONVERGENCE`

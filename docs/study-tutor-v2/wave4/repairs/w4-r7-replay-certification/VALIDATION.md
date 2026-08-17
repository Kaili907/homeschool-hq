# W4-R7 validation record

Date: 2026-08-17

## Identity and scope

- Session: `STUDY-TUTOR-V2-W4-R7`
- Starting SHA: `27bf8d544f60a7024d0b4c3f47e3d0ee71ee9b76`
- Branch: `mac/tutor-v2-w4-replay-certification-repair-r1`
- Product-code changes: none
- Historical lane evidence changes: none

## Commands

```text
npx tsc -p adaptive-tutor/adversarial/v4/replay-crash/tsconfig.json --pretty false
node --test adaptive-tutor/adversarial/v4/replay-crash/.test-dist/adversarial/v4/replay-crash/state-machine.test.js
node adaptive-tutor/adversarial/v4/replay-crash/negative-control.mjs

node adaptive-tutor/tests/wave4-repairs/commercial-integrity/run.mjs
node adaptive-tutor/tests/wave4-repairs/study-lineage/run.mjs

npx tsc -p adaptive-tutor/tsconfig.test.json
node --test \
  adaptive-tutor/.test-dist/core/v3/memory/bounded-instructional-memory.test.js \
  adaptive-tutor/.test-dist/core/v3/recovery/recoverable-memory-replay.test.js
node --test adaptive-tutor/.test-dist/tests/tutor-v3-convergence/hard-gates.test.js

git diff --check
```

## Results

| Validation | Result |
| --- | --- |
| Starting-SHA strict W4-04 reproduction | RED, missing nine current memory-lineage inputs |
| Strict current W4-04 TypeScript | PASS |
| Current replay/crash detector | PASS, 31/31 |
| Required crash windows | PASS, 15/15 |
| Original detector coverage | PASS, 28/28 represented one-for-one |
| Actual R1 single-use dispatch integration | PASS; first provider calls 1, exact replay calls 0 |
| Study-effect at-most-once | PASS across all crash recovery and focused recovery probes |
| Actual R4 exact-replay memory recovery | PASS; accepted effect reused, memory applied then duplicate |
| Different commercial scope | PASS; conflict with no added side effects |
| Disposable R1 guard negative control | PASS; 30 pass, 1 expected detector failure |
| W4-R1 single-use/commercial-integrity regression | PASS, 27/27 |
| W4-R4 Study memory/recovery regression | PASS, 9/9 |
| Wave 3 memory/recovery focused regression | PASS, 28/28 |
| Wave 3 hard gates | PASS, 18/18 families |
| `git diff --check` | PASS |

The final commit SHA, clean status, and remote push proof are reported in the
session return after commit and push.

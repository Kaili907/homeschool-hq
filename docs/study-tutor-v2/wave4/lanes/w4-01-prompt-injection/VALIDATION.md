# W4-01 validation

Validation date: 2026-08-16

Branch: `mac/tutor-v2-w4-prompt-injection-r1`

Starting SHA: `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`

Node: 22.23.2

TypeScript: 5.8.3

The worktree contained no installed dependencies. TypeScript 5.8.3 and
`@types/node` 22.15.32 were installed with `--no-save --no-package-lock` in a
temporary directory outside the repository. Commands below use `$W4_TSC` for
that compiler and `$W4_TYPES` for its `node_modules/@types` directory. No
package or lockfile changed.

## Results

| Required check | Result |
| --- | --- |
| Focused prompt-injection adversarial suite | PASS — 40/40 tests |
| Stable attack corpus | PASS — 38 cases, 17/17 families, 2/2 trust surfaces |
| Mutation-style negative controls | PASS — 6/6 killed |
| Wave 3 hard gates | PASS — 18/18 |
| Wave 3 convergence | PASS — 33/33 |
| Wave 2 anti-answer/authority regressions | PASS — 124/124 |
| Strict lane typecheck | PASS |
| Strict Tutor V3 typecheck | PASS |
| Strict Tutor V2 typecheck | PASS |
| Strict adaptive-tutor root typecheck | PASS |
| `git diff --check` | PASS |

## Executed commands

Focused lane typecheck and suite:

```sh
TUTOR_W4_TSC="$W4_TSC" TUTOR_W4_TYPE_ROOTS="$W4_TYPES" \
  node adaptive-tutor/adversarial/v4/prompt-injection/run-focused.mjs typecheck
TUTOR_W4_TSC="$W4_TSC" TUTOR_W4_TYPE_ROOTS="$W4_TYPES" \
  node adaptive-tutor/adversarial/v4/prompt-injection/run-focused.mjs test
```

The focused run produced 40 passing tests: one corpus-integrity test, 38 stable
attack cases, and one mutation campaign test that killed all six controls.

Wave 3 strict compile and convergence:

```sh
cd adaptive-tutor
node "$W4_TSC" -p scripts/tutor-v3/tsconfig.json --typeRoots "$W4_TYPES" --noEmit
node "$W4_TSC" -p scripts/tutor-v3/tsconfig.json --typeRoots "$W4_TYPES"
node --test scripts/tutor-v3/.dist/tests/tutor-v3-convergence/*.test.js
node scripts/tutor-v3/.dist/scripts/tutor-v3/run-hard-gates.js
```

The convergence run passed 33/33. The hard-gate runner printed
`PASS wave3-hard-gates 18/18` and did not change its shared release result.

Wave 2 strict compile and focused regressions:

```sh
cd adaptive-tutor
node "$W4_TSC" -p scripts/tutor-v2/tsconfig.json --typeRoots "$W4_TYPES" --noEmit
node "$W4_TSC" -p scripts/tutor-v2/tsconfig.json --typeRoots "$W4_TYPES"
node --test \
  scripts/tutor-v2/.dist/core/v2/policy/authority/authority.test.js \
  scripts/tutor-v2/.dist/core/v2/policy/anti-answer/anti-answer.test.js \
  scripts/tutor-v2/.dist/tests/tutor-v2-convergence/structural-anti-answer-adversarial.test.js \
  scripts/tutor-v2/.dist/tests/tutor-v2-convergence/global-adaptive-allowed-actions.test.js \
  scripts/tutor-v2/.dist/tests/tutor-v2-convergence/global-adaptive-safety-authority.test.js
```

The selected anti-answer and authority regressions passed 124/124.

Adaptive Tutor root strict typecheck and whitespace validation:

```sh
node "$W4_TSC" -p adaptive-tutor/tsconfig.json --typeRoots "$W4_TYPES" --noEmit
git diff --check
```

## Certification result

No real Wave 3 defect was discovered. Every attack produced only a safe
advisory, refusal, reviewed static fallback, or schema rejection. No attack
changed the authoritative Study tuple or widened a Tutor authority flag.

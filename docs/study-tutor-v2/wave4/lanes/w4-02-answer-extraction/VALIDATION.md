# W4-02 validation

Validated on 2026-08-16 with Node 22.23.2 and TypeScript 5.9.3.

## Focused certification

From the repository root:

```sh
node adaptive-tutor/adversarial/v4/answer-extraction/run-certification.mjs
```

Result: PASS.

- Baseline: 66 tests passed, 0 failed.
- Negative control `disable-active-phase-protection`: detected.
- Negative control `remove-ask-check-from-structural-set`: detected.
- Negative control `let-review-permission-bypass-active-protection`: detected.
- Negative control `authorize-completed-review-without-study-permission`: detected.

The baseline includes 46 state/vector cases (23 extraction vectors in each of
the two active protected state labels), 10 novel-prose action-family cases, 4
multi-turn composition cases, and state/control assertions. A rejected active
turn yields no learner-facing instructional proposal.

## Regression validation

From `adaptive-tutor/`:

```sh
npm run tutor-v2:typecheck
npm run tutor-v2:test
```

Result: PASS.

- Strict Tutor V2 typecheck: no diagnostics.
- Full Tutor V2 convergence suite: 288 tests passed, 0 failed.

## Scope and execution properties

- No shared product policy or runtime semantics changed.
- All authored files are under the two dispatched ownership paths.
- Fixtures use deterministic synthetic state only.
- No raw transcript persistence, network request, provider call, or live-model
  judgment occurs.
- Mutation copies and compiled artifacts are created under the operating-system
  temporary directory and removed before the runner exits.

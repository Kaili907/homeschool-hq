# W4-09 validation

## Commands

Run from `adaptive-tutor/adversarial/v4/multilingual-eval`:

```sh
npm test
npm run validate
npm run evaluate
```

## Verified result

- Node.js: `v22.23.2`.
- Tests: 10 passed, 0 failed.
- Corpus validation: 14 cases accepted at revision `2026-08-16.1`.
- Pinned corpus digest:
  `sha256:9f1bad76d86cb949d0d1abec8f81762ba625e3c345951fcb95760eb3153c70ff`.
- Offline evaluation: 14/14 reference controls passed all five dimensions.
- Refusal-weakening mutation: `FAIL_HARD_GATE` with
  `SAFETY_REFUSAL_FAILURE` while the other dimensions remained intact.
- Unicode-obscured answer mutation: `FAIL_HARD_GATE` with
  `ANSWER_BOUNDARY_FAILURE`.
- Evaluation report status:
  `W4_MULTILINGUAL_EVAL_READY_FOR_CONVERGENCE`.

The commands use only local files and Node.js built-ins. `liveModelCalls` and
`networkAccess` are fixed to `false`; `curriculumSupportAssertion` is fixed to
`none`.

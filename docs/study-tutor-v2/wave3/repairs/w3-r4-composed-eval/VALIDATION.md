# W3-R4 validation

Validation is local-only. No network or live model is used.

## Focused composed suite

- Strict eval TypeScript check: PASS.
- Compiled eval harness: PASS — 12/12 tests.
- Deterministic CLI: PASS — 10 cases, 20 attempts, 20 provider calls, 20
  post-policy grader calls.
- Decision: containment passed; commercial certification incomplete solely
  because the live-model campaign was not run; production authorization false.

The focused suite covers normal acceptance, malformed output, authority
injection, unsupported grounding, provider timeout, wrong scope, active-
assessment answer output, reviewed static fallback, closed provider refusal,
unreviewed content, privacy leakage, rejection of flat grounding lists,
post-policy grading, exact provenance/trial evidence, and score
non-compensation.

## Source-lane regressions

- Strict Adaptive Tutor typecheck: PASS.
- W3-03 grounding/refusal: PASS — 32/32 tests.
- W3-10 model-output validation: PASS — 15/15 tests.
- Existing Adaptive Tutor core suite: PASS — 21/21 tests.
- Tutor V2 strict convergence typecheck: PASS.
- Tutor V2 convergence suite: PASS — 288/288 tests (run from its required
  `adaptive-tutor/` working directory).

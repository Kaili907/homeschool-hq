# W3-10 validation

Validation is run from `adaptive-tutor/` with TypeScript 5.9.3 and Node
22.23.2.

## Focused lane checks

- Strict adaptive-tutor typecheck: PASS
- Compiled model-output suite: PASS — 15 tests, 15 passed, 0 failed

The focused suite deliberately covers accepted reference-only output, refusal,
unknown fields, malformed and over-bounded envelopes, unreviewed content,
unknown grounding, action/display escalation, post-validation mutation,
provider-defined getters, all prohibited authority classes, and answer-bearing
or free-form active-assessment output.

## Regression checks

- Adaptive Tutor core tests: PASS — 21 tests, 21 passed, 0 failed
- Adaptive Tutor build: PASS
- Tutor v2 strict typecheck: PASS
- Tutor v2 convergence tests: PASS — 288 tests, 288 passed, 0 failed

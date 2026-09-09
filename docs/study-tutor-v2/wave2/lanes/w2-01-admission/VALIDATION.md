# W2-01 validation

Validation is run from `adaptive-tutor/` with TypeScript 5.8.3 and Node 22.

## Focused lane checks

- Strict Tutor v2 typecheck: PASS
- Compiled admission suite: PASS — 43 tests, 43 passed, 0 failed

The focused suite covers exact admission; all eight deterministic capability
decisions; missing, unknown, malformed, and duplicate capability metadata;
unknown feature, action family, version, safety state, and curriculum state;
subject, curriculum, and invocation binding mismatches; safety restriction;
reviewed-content gating; explicit feature denial; authority-field smuggling;
raw-prose exclusion; no age-based inference; subject neutrality; and input
immutability.

## Wave 1 regression checks

- Accepted Tutor v2 core slice: PASS — 168 tests, 168 passed, 0 failed
- Tutor v2 convergence slice: PASS — 253 tests, 253 passed, 0 failed
- Repaired Study bridge slice: PASS — 209 tests, 209 passed, 0 failed
- Tutor v2 strict typecheck: PASS
- Study bridge typecheck: PASS

These checks exercise the existing contracts, provider boundary, authority,
grounding, anti-answer, refusal, age, memory, evidence, privacy, convergence,
and bridge behavior without changing any Wave 1 source or release evidence.

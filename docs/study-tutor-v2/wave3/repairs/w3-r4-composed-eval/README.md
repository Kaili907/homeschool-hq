# W3-R4 composed commercial evaluation repair

## Scope

This repair composes the W3-05 deterministic certification skeleton with the
actual W3-10 model-output boundary and W3-03 grounding/refusal boundary. It
changes only `adaptive-tutor/evals/v3/**` and this repair record. Production
authority code is assembled unchanged from its source-lane commits.

## Boundary repair

The former harness began with an evaluator-owned `ModelCandidate`, performed a
parallel shape check, and initialized every composed-system hard gate to pass.
The repaired harness instead:

1. builds a sealed-oracle-free provider request from `EvalCase`;
2. executes an in-memory scripted provider or provider-fault result;
3. treats the returned model envelope and grounding sidecar as `unknown`;
4. invokes `validateProviderModelOutput` from W3-10;
5. invokes `evaluateGrounding` from W3-03 with trusted Study bundle and
   requirements plus the provider's explicit claim/support sidecar;
6. derives a closed policy outcome and gate evidence from those results;
7. invokes a deterministic grader only after that policy outcome; and
8. aggregates the executed attempts for certification.

No claim/support mapping is synthesized from `groundingRefs`. A flat reference
list fails the W3-03 sidecar contract.

## Gate semantics

All gates begin `not-evaluated`; there is no optimistic composed-system
default. The executed source is recorded for authority injection, active-
assessment answer leakage, unreviewed content, grounding failure, cross-scope
results, malformed output, provider faults, and privacy failure.

Deterministic adversarial fixtures are containment tests: model behavior may be
a violation while the composed system passes only if it withholds the proposal
and returns a closed fallback/refusal. Live/stochastic model violations and any
uncontained composed violation remain non-compensable, regardless of academic
score.

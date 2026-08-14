# Tutor V2 Wave 1 evaluation framework

This package is the deterministic commercial-evaluation foundation for Tutor V2. It evaluates checked-in provider-result fixtures only; it has no provider client, network path, production wiring, or opaque model-as-judge.

Each scenario declares identity, grade/learning-stage policy, subject and concept references, assessment phase, learner attempt, allowed actions, hint ceiling, grounding, provider fixture, expected disposition/refusal/fallback, all hard-gate expectations, all soft-quality expectations, and privacy constraints. Definitions are rejected for duplicate IDs or missing/unknown dimensions.

Hard gates are exact categorical expectations. A negative scenario passes when the expected prohibited behavior is detected and rejected or routed to fallback. Any unexpected hard-gate result fails the scenario and the whole foundation classification; soft scores are reported but never average a hard failure away.

Run from this directory:

```sh
npm test
npm run evaluate
npm run --silent evaluate -- --format=json
```

The CLI exits nonzero on `FOUNDATION_GATE_FAIL`. Wave 1 deliberately emits only `FOUNDATION_GATE_PASS` or `FOUNDATION_GATE_FAIL`, and the report always carries `releaseReady: false`.

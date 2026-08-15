# W2-03 validation

## Deterministic test coverage

The lane-local suite contains 16 tests covering:

- enough evidence from distinct opportunities;
- one-response and threshold insufficiency;
- no academic signal;
- conflicting evidence;
- unknown code fail-closed behavior;
- wrong-concept and cross-concept reuse rejection;
- cross-concept registry code reuse rejection;
- stale evidence exclusion;
- duplicate evidence collapse;
- conflicting evidence-identity reuse;
- replay equality;
- cross-context and cross-learner rejection;
- psychological and diagnostic field rejection;
- raw learner/provider prose rejection; and
- deterministic equality across evidence ordering.

Every positive signal test also verifies that the result is explicitly
non-authoritative and cannot become a durable learner classification.

## Commands

Run from `adaptive-tutor/` after installing the repository lockfile
dependencies:

```sh
npm run tutor-v2:typecheck
npm run tutor-v2:test
node --test scripts/tutor-v2/.dist/core/v2/misconceptions/academic-misconceptions.test.js
```

Validation on 2026-08-14:

| Check | Result |
|---|---:|
| Tutor V2 strict typecheck | PASS |
| Existing Tutor V2 convergence suite | 253/253 PASS |
| W2-03 academic misconception suite | 16/16 PASS |

No live model, provider, learner transcript, or cross-learner dataset is used by
the implementation or fixtures.

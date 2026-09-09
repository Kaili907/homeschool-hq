# W4-03 Validation

## Environment

- Branch: `mac/tutor-v2-w4-scope-isolation-r1`
- Starting SHA: `a2fdf1858cd50c998f5da53970d36ee6c90ff31a`
- Shared product changes: none
- Network/provider calls: none; the campaign uses the deterministic in-memory transport

## Adversarial campaign

Command:

```sh
npm --prefix adaptive-tutor/adversarial/v4/scope-isolation test
```

Observed summary:

```text
tests 58
pass 36
fail 22
```

The 22 count includes three failed parent subtests whose children failed. There
are 19 distinct failing leaf assertions. The failures demonstrate:

1. valid sibling curriculum reaches provider transport;
2. sibling physical attempts receive calls, usage receipts, cost, and telemetry;
3. sibling reservations and routes receive mixed commercial settlement lineage;
4. sibling concept, opportunity, stage, and presentation refs influence the provider request or advisory;
5. a sibling concept is committed into learner A instructional memory;
6. household lineage is absent after the commercial advisory boundary;
7. telemetry and presentation acceptance are not child-scope-bound.

The campaign compiles under strict TypeScript before Node executes the tests.
The nonzero exit is the expected certification result while these blockers
remain; the tests must not be weakened to make this lane green.

## Existing Wave 3 baseline

These commands ran against unchanged shared product code:

```sh
npm --prefix adaptive-tutor run tutor-v3:typecheck
npm --prefix adaptive-tutor run tutor-v3:test
npm --prefix adaptive-tutor run tutor-v3:gate
```

Observed results:

```text
tutor-v3:typecheck: exit 0
tutor-v3:test: 33 tests, 33 pass, 0 fail
tutor-v3:gate: PASS wave3-hard-gates 18/18
```

This proves the W4 findings are not a regression introduced by this lane. They
expose commercial isolation dimensions that the existing Wave 3
`CROSS_CHILD_COMMERCIAL_ISOLATION` evidence does not exercise.

## Decision

`W4_SCOPE_ISOLATION_BLOCKER_FOUND`

Convergence is blocked until every failing foreign binding is contained or
proven non-influential by shared product changes owned by a repair lane.

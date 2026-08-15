# W3-02 validation

Validated on 2026-08-15 from branch
`mac/tutor-v2-w3-budget-resilience-r1`.

## Commands

The lane worktree did not contain installed dependencies, so its ordinary
`npm run typecheck` stopped at `tsc: command not found`. Validation used an
already-installed repository TypeScript 5.8-compatible CLI and Node type roots;
no dependency or package file was changed.

Equivalent checks, after dependencies are installed in `adaptive-tutor`, are:

```sh
npm run typecheck
node_modules/.bin/tsc -p tsconfig.test.json
node --test '.test-dist/core/v3/routing/budget-resilience/budget-resilience.test.js'
node --test '.test-dist/tests/*.test.js'
```

## Results

| Gate | Result |
| --- | --- |
| Strict TypeScript typecheck of `adaptive-tutor` | PASS |
| W3-02 targeted budget/resilience suite | PASS — 18 tests |
| Existing adaptive-tutor base suite | PASS — 21 tests |
| `git diff --check` | PASS |

The targeted suite covers:

- IntegerMicros syntax and checked-sum overflow;
- exact and one-micro-over cost ceilings;
- negative/unsafe millisecond rejection;
- exact and one-millisecond-over deadlines;
- retry and maximum-physical-attempt exhaustion;
- rate limit, provider timeout, and provider outage behavior;
- same-route and weaker-hard-constraint failover rejection;
- closed, open, and half-open circuit behavior;
- probe leasing and successful-probe recovery;
- absent failover reservation and open failover circuit;
- conservative indeterminate settlement and over-reservation anomaly; and
- reviewed static fallback selected from trusted policy.

No live provider, billing system, database, hosted service, or learner data was
used.

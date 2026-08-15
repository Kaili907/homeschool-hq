# W3-02 commercial execution budget and resilience core

Session: `STUDY-TUTOR-V2-W3-02`

This lane implements a pure, provider-independent policy core. It performs no
provider call, billing integration, database operation, or Study mutation.
Callers provide trusted routing eligibility, immutable route references, and
reviewed static-fallback references.

## Numeric boundaries

- Money crosses the contract boundary only as canonical, non-negative decimal
  IntegerMicros strings and is calculated with checked `bigint` arithmetic.
- The declared money boundary is signed 64-bit maximum
  (`9_223_372_036_854_775_807` micros). Negative, decimal, non-canonical, and
  overflowing values fail closed; unknown cost is never zero.
- Time, timeout, backoff, elapsed time, and deadlines are non-negative safe
  integer milliseconds. Checked sums reject overflow.
- Circuit failure ratios use integer cross-products, never floating-point
  division.

## Closed contracts

The exact TypeBox schemas in
`adaptive-tutor/core/v3/routing/budget-resilience/contracts.ts` reject unknown
properties and close the following structures:

| Structure | Responsibility |
| --- | --- |
| `ExecutionBudget` | Intersects operation, interaction, household-period, and platform-period ceilings and binds trusted reviewed fallback content. |
| `AttemptBudget` | Binds one physical-attempt index, route, hard-eligibility class, timeout, backoff, and maximum reserved cost. |
| `BudgetReservation` | Records the conservative cost reservation for one or two planned physical attempts. |
| `BudgetSettlement` | Releases exact settled remainder or conservatively retains the full reservation for an indeterminate outcome. |
| `LatencyBudget` | Bounds elapsed work, deterministic fallback reserve, backoff, and attempt timeout under one deadline. |
| `RetryPolicy` | Structurally caps execution at two physical attempts and zero same-route retries. |
| `CircuitState` | Represents only `closed`, `open`, or `half-open` operational state. |
| `CircuitBreakerDecision` | Returns a deterministic learner/probe access decision and exact next state. |
| `FallbackDecision` | Selects one pre-reserved commercial failover, reviewed static content, or the trusted fixed stop for malformed input. |

## Deterministic execution policy

`reserveExecutionBudget` admits a plan only when attempt indexes are contiguous,
the primary is first, a failover is a distinct equally eligible route, every
hard constraint remains satisfied, the physical-attempt cap is at most two,
and the checked sum fits the smallest cost cap. Budget exhaustion returns the
Study-bound reviewed static fallback.

`decideFallback` never retries a route. A failover is returned only when all of
the following remain true:

- the failure class is explicitly retryable;
- fewer than two physical attempts have been completed;
- retry and execution budgets both allow a second attempt;
- the failover has the same immutable hard-eligibility class as the primary;
- its route and exact cost have a distinct slot in the original reservation;
- availability is currently eligible and its circuit is closed;
- a timeout's potentially billed primary reservation remains held; and
- elapsed time, backoff, failover timeout, and deterministic fallback reserve
  fit the integer-millisecond deadline.

Any failed guard returns reviewed static content. Provider rejection, invalid
provider output, Study policy rejection, cost anomaly, and exhausted deadline
are terminal and cannot trigger retry.

`evaluateCircuitBreaker` uses a bounded window, minimum sample count, integer
failure ratio, and consecutive-failure threshold. Time passage moves `open` at
most to `half-open`; learner work is always denied there. Only one leased,
dedicated probe is admitted. The circuit closes only after the configured
successful probe count, and unavailable breaker storage fails closed.

See [VALIDATION.md](./VALIDATION.md) for executable evidence.

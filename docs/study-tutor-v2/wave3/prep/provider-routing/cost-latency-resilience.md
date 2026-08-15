# Cost, latency, and resilience model

## IntegerMicros only

All monetary rates, estimates, reservations, caps, attempt costs, and aggregate
costs use IntegerMicros. One USD is `1_000_000` micros. Runtime arithmetic uses
arbitrary-precision integers (`bigint` or database integer/numeric arithmetic),
and JSON/API boundaries use canonical non-negative decimal strings.

Forbidden representations include JavaScript `number` money, IEEE-754 floats,
decimal currency strings, binary floating-point multiplication/division, and
rounding after summing differently priced components.

Every verified effective-dated price component has:

```text
currency = USD
usageUnit = input_token | output_token | reviewed_image_unit | request
unitSize = positive integer
priceMicrosPerUnitSize = non-negative IntegerMicros
quantity = non-negative integer
```

Actual accounting follows the repository's established component rule:

```text
componentCostMicros = roundHalfUp(
  quantity * priceMicrosPerUnitSize / unitSize
)
actualCostMicros = checkedSum(componentCostMicros)
```

Each component is rounded once, then summed with checked integer arithmetic.
Historical usage snapshots the exact term/revision and component result. It is
never repriced from a current term.

Pre-dispatch control is deliberately conservative:

```text
componentReserveMicros = ceil(
  maximumQuantity * priceMicrosPerUnitSize / unitSize
)
attemptReserveMicros = checkedSum(componentReserveMicros)
planReserveMicros = checkedSum(all allowed physical-attempt reserves)
```

The planner uses the maximum input estimate (including overhead), selected
maximum output tokens, required modality units, and request charge. It reserves
for every physical attempt allowed by the plan, including failover. A lower
expected average is not sufficient for admission.

## Pricing eligibility

A commercial candidate is eligible only when every potentially positive usage
dimension has exactly one verified term at the trusted dispatch time. Missing,
ambiguous, stale, unsupported, wrong-currency, overflowed, or future-effective
pricing makes the candidate unroutable. Unknown cost is never zero.

Pricing and profile snapshots are bound into the route decision. A term change
between planning and dispatch causes re-planning or static fallback, never
execution under a silently changed rate. Provider invoices, taxes, credits,
subscriptions, included allowances, discounts, and adjustments remain outside
the routing estimate unless a future separately reviewed contract can account
for them exactly.

## Budget caps

All of the following are hard caps and use IntegerMicros:

| Cap | Purpose |
| --- | --- |
| Physical-attempt cap | Prevents one request from exceeding its reserved maximum |
| Logical-operation cap | Includes the primary and every possible retry/failover attempt |
| Interaction remaining cap | Bounds cumulative provider use in the active ephemeral Tutor interaction |
| Household-period remaining cap | Enforces trusted commercial policy without exposing household identity to the router/provider |
| Platform-period remaining cap | Provides global cost containment and incident response |

The effective ceiling is the minimum remaining cap. Budget authority may lower
or exhaust a cap; routing may never raise one. Reservation must be atomic before
dispatch. An identical replay returns the original reservation. Conflicting
reuse fails closed. Every real retry/failover has a distinct physical-attempt
index and reservation while sharing the logical operation reference.

Unknown-billing outcomes, including a timeout after dispatch may have been
accepted, keep their full reservation consumed until authoritative
reconciliation proves a smaller cost. That conservative hold prevents a retry
from exceeding a cap through double billing. A ledger write or attempt-journal
failure prevents dispatch when it occurs before dispatch; an indeterminate
post-dispatch accounting state becomes a visible gap and cannot be recast as
zero.

Budget exhaustion selects reviewed static fallback or a fixed stop. It does not
remove ordinary Study availability, reduce safety, or authorize unreviewed
content.

## Cost anomaly protection

The attempt coordinator quarantines the affected provider/model/region route
and prevents new dispatch when any of these occur:

- observed usage or actual IntegerMicros cost exceeds the immutable attempt
  reservation;
- provider usage counters are negative, non-integer, malformed, absent when
  required, or exceed request/response hard limits;
- a price term is missing, ambiguous, unexpectedly revised, outside its
  effective interval, or fails its approved-change policy;
- checked integer multiplication, addition, conversion, or serialization would
  overflow a declared boundary;
- journal and cost-ledger dimensions or physical-attempt indexes disagree;
- rolling cost per successful accepted candidate, token ratio, or failure-cost
  rate breaches a versioned integer threshold.

An anomaly cannot be suppressed by provider success. It opens or quarantines
the route through trusted operational policy, emits content-free bounded
telemetry, and uses static fallback. Automatic recovery requires a reviewed
policy condition or operator action; model output cannot clear an anomaly.

## Latency model

Time is represented only as non-negative integer milliseconds against a
monotonic execution clock. Wall-clock timestamps are used for audit windows,
not elapsed-time enforcement.

`endToEndDeadlineMs` covers planning, attempt reservation, queue/connect,
provider execution, response bounding/parsing, output policy validation, and
static-fallback reserve. The planner calculates:

```text
providerBudgetMs = endToEndDeadlineMs - deterministicReserveMs - elapsedMs
attemptTimeoutMs = min(
  providerProfile.maximumTimeoutMs,
  actionPolicy.maximumTimeoutMs,
  providerBudgetMs
)
```

If subtraction is non-positive or the selected attempt timeout is below the
provider/profile minimum, commercial routing is infeasible. The complete plan
must satisfy:

```text
sum(primary/fallback timeouts + allowed backoff) + deterministicReserveMs
  <= endToEndDeadlineMs
```

Candidate prediction uses a reviewed rolling p95 latency in integer
milliseconds for the exact provider/model/region/action service class. Missing,
stale, undersampled, or mixed-dimension latency evidence is `unknown` and
ineligible for an interactive route. The route does not claim the p95 is a
guarantee; the hard monotonic timeout remains authoritative.

Timeout cancellation is not evidence that the provider stopped processing or
will not bill. It is an untrusted/unknown post-dispatch state until journal and
accounting evidence resolve it.

## Failure, retry, and fallback policy

Interactive Tutor operations allow at most two physical attempts: one primary
and, only when preplanned, one failover. Same-route automatic retries are zero.
The goal is bounded recovery without retry storms, repeated content exposure,
or budget/latency surprise.

| Failure | Same route | Failover route | Terminal behavior |
| --- | --- | --- | --- |
| Provider outage known before dispatch | Never | Once if independently eligible and plan still fits | Static fallback if unavailable/ineligible |
| Rate limit known before dispatch | Never; honor bounded `Retry-After` as availability state | Once if plan still fits; do not sleep past deadline | Static fallback |
| Transport failure with durable `confirmed_not_dispatched` | Never | Once if plan still fits | Static fallback |
| Timeout or indeterminate dispatch/billing | Never | Only if the full primary reserve remains consumed and the pre-reserved failover still fits time/cost; otherwise none | Static fallback |
| Provider rejection/refusal | Never | No automatic failover | Static fallback |
| Malformed, oversized, wrong-schema, wrong-binding, or unsupported response | Never | No automatic failover | Static fallback and breaker signal |
| Provider response rejected by Study policy, grounding, anti-answer, age/privacy, or output safety | Never | Never | Study-selected static fallback or stop |
| Missing/ambiguous pricing or accounting precondition | Never | Only a separately eligible preplanned route | Static fallback |
| Cost or latency cap exhausted | Never | Never | Static fallback |
| Permanent adapter/configuration failure | Never | Only a separately eligible preplanned route | Static fallback and route quarantine |

Before failover, the coordinator revalidates safety clearance, authorization
binding, plan expiry, provider availability, circuit state, residency/privacy,
remaining monotonic deadline, and remaining reserved IntegerMicros. Loss of any
condition stops commercial execution. Failover receives the same or a smaller
minimized context and never weaker policy constraints.

The static fallback mechanism has no provider dependency. It selects only
Study-admitted, curriculum-authored reviewed content by a trusted server-side
reference, or a fixed learner-safe stop. Invalid or attacker-controlled input
uses trusted constants and cannot influence the fallback reference.

## Circuit breaker

Circuit state is keyed by exact provider class, model class, deployment region,
and adapter artifact version. It is operational state only and never contains
learner/content dimensions.

The versioned circuit policy contains integer `windowMs`, minimum sample count,
failure-count/ratio thresholds, consecutive-failure threshold, `openMs`, and
half-open probe count. Ratios are compared as integer numerator/denominator
cross-products, never floats.

- `closed`: ordinary eligible traffic is allowed.
- `open`: no learner dispatch is allowed; routing removes the candidate.
- `half-open`: only a dedicated content-free or approved synthetic health probe
  may execute. Learner work is never used as a probe.

Outage, repeated timeout, malformed/schema-invalid output, adapter permanent
failure, and cost anomaly are breaker signals. Caller cancellation, Study
policy rejection of otherwise valid provider content, and safety-held requests
are not provider-health failures. A single learner or attacker cannot choose a
route or submit a breaker outcome directly.

Breaker storage unavailability fails closed for commercial routing. Distributed
workers use an atomic state transition/lease so half-open concurrency cannot
produce a probe storm. Recovery closes only after the configured successful
probes and fresh availability evidence; time passage alone moves at most to
half-open.

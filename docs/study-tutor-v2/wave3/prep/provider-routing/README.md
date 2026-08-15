# Wave 3 provider routing preparation

Session: `STUDY-TUTOR-V2-W3-PREP-01`

Status: design only. Wave 3 implementation, production wiring, provider
selection, credentials, live-model calls, and deployment are not authorized by
this document.

## Decision

Wave 3 should add a server-side, provider-independent commercial routing layer
behind the existing Tutor V2 provider port. The router selects only capability
classes and bounded execution policy. A separately configured adapter registry
may later resolve a provider class and model class to a commercial product. No
vendor identifier, SDK type, credential, or provider-specific message shape
belongs in the routing contract.

Study remains the sole authority. Routing is an operational decision over an
already admitted, minimized provider request. It cannot authorize Tutor use,
create an academic action, or make an untrusted provider response effective.

```text
Study admission and detached authority snapshot
                  |
                  v
Tutor policy -> minimized ProviderExecutionRequest
                  |
                  v
        deterministic route planner
          |                    |
          | eligible route     | no eligible route
          v                    v
  provider adapter       reviewed static fallback / stop
          |
          v
   untrusted candidate response
          |
          v
Study-side exact schema, binding, grounding, anti-answer,
age/presentation, privacy, output-safety, and allowed-action validation
          |
          v
Study alone accepts an action or applies deterministic fallback
```

## Non-negotiable authority invariants

Provider routing may never:

- increase Study permissions or widen `allowedActions`;
- alter the learner's working level, grade band, accommodations, or guardian
  controls;
- alter or declare mastery, progress, completion, placement, or sequencing;
- reveal, request, derive, confirm, or transmit answer authority;
- bypass a Study safety hold, stale clearance, or missing authorization;
- turn a provider response into a Study effect;
- choose or persist curriculum, evidence, checkpoints, or adult-review state;
- convert operational availability, price, or latency into academic authority.

The router receives neither `StudyAuthorityContext` nor a full `TutorRequest`.
It receives only routing metadata derived after Study admission. The provider
continues to receive only the existing minimized, disposable provider
execution projection. Provider output remains an untrusted candidate even when
the provider or model has the highest capability class.

## Architecture components

| Component | Responsibility | Explicitly not responsible for |
| --- | --- | --- |
| Capability catalog | Holds reviewed, versioned `ProviderCapabilityProfile` and `ModelCapabilityProfile` records | Dynamic vendor discovery, academic policy, credentials |
| Availability snapshot source | Produces trusted, short-lived health, rate-limit, region, and circuit state | Accepting browser/provider self-claims as authority |
| Pricing snapshot source | Resolves exact effective-dated IntegerMicros terms | Guessing missing prices or representing money as floats |
| Budget authority | Supplies remaining request, interaction, household, and platform caps | Letting the router increase a cap |
| Deterministic route planner | Filters hard constraints, computes conservative cost/latency feasibility, and returns a closed plan | Provider I/O, prompt construction, Study mutation |
| Adapter registry | Resolves reviewed provider/model classes to server-only adapters | Exposing vendor IDs or keys to core Tutor contracts |
| Attempt coordinator | Reserves every physical attempt, enforces retry/failover, and joins outcome to accounting | Retrying unjournaled or indeterminate attempts |
| Response boundary | Bounds bytes/tokens and parses the closed response contract | Treating schema validity as academic authorization |
| Study validator | Rechecks detached authority, action, grounding, anti-answer, age/privacy, and output safety | Delegating acceptance to router or provider |
| Static fallback resolver | Selects versioned, admitted, reviewed curriculum content or a fixed stop action | Generating substitute content or using caller references |

All configuration is immutable by version for one routing decision. A decision
snapshots profile, availability, pricing, budget-policy, circuit-policy, and
static-fallback-policy versions. Mid-request configuration changes apply only
to a later logical operation.

## Routing inputs

The closed `ProviderRoutingInput` is content-free and authority-free. It
contains the following required inputs:

| Input | Meaning and trust boundary |
| --- | --- |
| `actionFamily` | Closed family derived from the already Study-allowed candidate action, never free-form provider intent |
| `learnerStage` | Coarse, non-identifying age/presentation policy class, not birth date, grade authority, or working level |
| `subjectCapability` | Closed capability code such as symbolic reasoning, prose explanation, source-grounded analysis, or visual interpretation; not raw curriculum |
| `contextSize` | Conservative integer input-token estimate plus fixed overhead and required output allowance |
| `safetyRequirement` | Current Study-admitted routing constraint and output-control class; held, missing, stale, or contradictory state makes every commercial route ineligible |
| `latencyTarget` | Integer-millisecond end-to-end deadline and service class, supplied by trusted policy |
| `costCeiling` | Canonical non-negative IntegerMicros decimal string for the entire logical operation, intersected with all broader remaining caps |
| `reviewedContentRequirement` | Closed requirement for admitted grounding and/or reviewed-only static fallback |
| `multimodalRequirement` | `none` or a reviewed media-input class with explicit sanitization and retention rules |
| `providerAvailability` | Trusted, expiring snapshot of deployment, region, health, rate-limit, maintenance, and circuit state |

It also carries opaque operation/profile version references, the remaining
physical-attempt count, and the remaining interaction/platform budget needed to
prove the plan. It contains no learner name or identifier, household data, raw
learner response, transcript, prompt, answer/scoring data, private note,
guardian route, credential, or authority object.

Detailed schemas and eligibility semantics are in
[`capability-profiles.md`](./capability-profiles.md).

## Routing output

The closed `ProviderRouteDecision` returns:

- `providerClass`;
- `modelClass`;
- `maxTokens`, an integer output-token ceiling;
- `timeoutMs`, an integer physical-attempt timeout bounded by the logical
  deadline;
- `retryPolicy`, including the maximum physical attempts, same-route retry
  count, allowed failure classes, integer backoff, and deadline/cost guards;
- `fallbackProviderClass` and `fallbackModelClass`, or `null` when commercial
  failover is not safely feasible, plus its independently bounded tokens and
  timeout;
- an allowed execution-region code and opaque reviewed registry binding; and
- `staticFallbackRule`, which is always present and selects only a trusted,
  versioned reviewed fallback or fixed stop.

The decision also records stable reason codes, plan expiration, and the exact
catalog/pricing/availability/budget/circuit policy versions used. It contains
no vendor product ID, credential, prompt, response, academic decision, or
mutable metadata bag.

`no-commercial-route` is a successful routing outcome, not an exception. It
returns no provider/model class and immediately invokes the static fallback
rule. The rule never accepts a fallback or content reference from the rejected
request or provider response.

## Deterministic selection

For the same canonical inputs and configuration versions, the planner must
produce the same decision and reason codes:

1. Reject routing if Study safety is not currently admitted or if the input is
   malformed, stale, contradictory, or over any hard cap.
2. Join provider and model profiles only through reviewed catalog references.
3. Remove candidates that fail region/residency, retention/training, minor-data,
   safety-control, action, learner-stage, subject, context, reviewed-content,
   structured-output, or multimodal requirements.
4. Remove unavailable, disabled, rate-limited, open-circuit, expired-profile,
   or unpriced candidates.
5. Compute conservative worst-case IntegerMicros cost for each physical attempt
   and for the full failover plan. Remove plans that exceed any remaining cap.
6. Remove plans whose predicted integer-millisecond latency or sum of timeouts
   and backoffs cannot fit the end-to-end deadline.
7. Rank eligible candidates lexicographically by mandatory privacy/residency
   class, capability fit, lowest worst-case cost, lowest reviewed p95 latency,
   and finally stable class reference. No random or provider-generated rank is
   permitted.
8. Select at most one primary and one independently eligible fallback route.
   A fallback must meet every original hard constraint; failover never
   downgrades privacy, residency, safety, context, multimodal, or reviewed-
   content requirements.
9. Bind the plan to the logical operation and immutable snapshots. On any
   execution-time mismatch, expiry, or loss of eligibility, do not dispatch;
   re-plan from trusted current inputs or use static fallback.

## Existing-contract impact for future Wave 3

Wave 1 deliberately uses generic `integer-cost-unit` fields and a future
`TutorProviderRoutePort`. Commercial Wave 3 must introduce an additive,
versioned routing contract whose money fields are IntegerMicros. It must not
reinterpret `maximumCostUnits` as currency, silently change the Wave 1 schema,
or convert between units through floating point. A compatibility adapter may
reject a legacy generic-unit request or receive an explicitly approved exact
integer conversion policy; there is no implicit `1 cost unit = 1 micro` rule.

This preparation adds no runtime contract and grants no implementation
authority.

## Design set

- [`capability-profiles.md`](./capability-profiles.md) defines provider/model
  profiles and the closed routing decision.
- [`cost-latency-resilience.md`](./cost-latency-resilience.md) defines exact
  IntegerMicros budgeting, latency, failure, failover, circuit-breaker, and
  anomaly behavior.
- [`privacy-threat-model.md`](./privacy-threat-model.md) defines provider
  privacy/residency constraints and the threat model.
- [`future-test-matrix.md`](./future-test-matrix.md) is the acceptance matrix
  required before any later implementation can be accepted.

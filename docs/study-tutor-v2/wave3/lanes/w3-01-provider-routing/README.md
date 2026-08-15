# W3-01 provider-independent routing core

Session: `STUDY-TUTOR-V2-W3-01`

This lane adds a deterministic, provider-independent route planner. It does
not register an adapter, call a provider, carry credentials, or make a Study
decision.

## Runtime surface

The implementation is isolated at
`adaptive-tutor/core/v3/routing/provider-routing/` and exports five closed
contracts:

- `ProviderCapabilityProfile`
- `ModelCapabilityProfile`
- `RoutingRequest`
- `RoutingDecision`
- `ProviderAvailabilityState`

Every runtime schema rejects unknown properties. All routing strings are
closed enum values, canonical non-negative integer-micro strings, or bounded
opaque references. The contracts contain no prompt, response, learner prose,
vendor endpoint, SDK value, account identifier, or credential field.

## Hard eligibility filters

`routeProviderModel` validates the complete request and both profile catalogs
before selection. A candidate is eligible only when all of these conditions
hold:

1. provider/model lifecycle and reviewed bindings are active and unambiguous;
2. action family and subject capability match;
3. learner stage matches;
4. input plus required output fits context and output limits;
5. the exact safety requirement is supported;
6. the exact multimodal requirement is supported;
7. reviewed grounding is supported when required;
8. the provider contains the requested privacy/provider-policy eligibility
   reference;
9. exactly one trusted availability entry exists and is `AVAILABLE`;
10. estimated latency, attempt timeout, and provider timeout bounds fit the
    request ceiling; and
11. canonical integer-micro worst-case cost fits the request ceiling.

`STATIC_REVIEWED_ONLY` never permits a provider route.

## Deterministic selection

Eligible candidates are ranked by exact worst-case integer-micro cost,
estimated integer-millisecond latency, provider class, provider reference,
model class, model reference, and route reference. Catalog insertion order is
never a tie-breaker.

The selected plan has one primary and at most one independently eligible
fallback. The fallback is included only if combined worst-case cost and
combined attempt time still fit the original ceilings. Same-route retry count
is fixed at zero.

## No-route behavior

If no candidate satisfies every hard requirement, the decision status is
`NO_ELIGIBLE_PROVIDER_ROUTE`. Provider, model, route, output-token, timeout,
fallback, retry, and reserved-cost fields are null or zero, and
`staticReviewedFallbackRequirement` is `REQUIRED_IMMEDIATELY`.

Invalid contract input also fails closed. It uses fixed trusted invalid-request
and static-fallback references rather than reading attacker-supplied fallback
data.

## Study authority boundary

The request carries only a bounded Study permission reference and one already
authorized action family. A mismatch between that family and the routing action
returns no route. Every decision preserves the permission reference and action
family in a `ROUTING_ONLY` boundary whose permissions, mastery, grade, working
level, and curriculum mutation flags are literal `false`.

The router has no Study mutation port. It cannot choose curriculum, declare
mastery, alter grades or working level, clear safety, widen permissions, or
make provider output effective. Any future provider output remains an
untrusted candidate for Study-side validation.

## Deliberate exclusions

- no provider adapters or live calls;
- no vendor registry or vendor-specific identifiers;
- no credentials, endpoints, SDK dependencies, or environment reads;
- no pricing discovery, dynamic health checks, persistence, accounting, or
  telemetry;
- no shared `core/v3` index changes; and
- no Tutor V2 source, schema-release, or package changes.

The Wave 3 preparation commit
`b87fcffe1bdbf93c9b6e2a8dfb583fa10f7be1e6` was read as design reference only
and was not cherry-picked.

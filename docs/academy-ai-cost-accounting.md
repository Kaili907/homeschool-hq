# Academy AI and TTS usage/cost accounting

This server-only contract records privacy-safe Anthropic and ElevenLabs usage
without changing learner responses, gateway security, quota ordering, or
provider retry behavior. The canonical ledger row remains
`AdminUsageCostRecord` version 2; the authorized Admin Costs aggregate response
is contract version 3.

## Canonical usage and identity

Every row has a trusted platform execution key, occurrence and bounded latency,
one request, mandatory verified `accountRef`, and a household attribution state.
`householdRef` is present only for `resolved`; it is null for
`no_active_household`, `ambiguous`, and `lookup_unavailable`. A learner may be
attributed only through a trusted resolved household relationship. Current
gateway calls do not carry such a learner grant, so `learnerRef` remains null.

The server snapshots the engine, required application version, optional
independently versioned engine version, and curriculum version only when a
trusted curriculum binding exists. Browser problem/context data is never used
to reconstruct a curriculum version.

Anthropic rows retain the server-selected provider product and model IDs, a
required Academy logical tier, and separate input, output, cached-input-read,
and cached-input-write counters. ElevenLabs rows retain provider product/model
IDs and exact submitted Unicode code-point count; their logical tier is null
because no Academy tier exists. No tier is invented.

There are no columns or RPC parameters for prompts, messages, conversations,
assessment answers, provider responses or request IDs, audio, or raw usage.

## Pricing and exact calculation

`academy_provider_pricing_catalogs` contains immutable, non-overlapping USD
catalog versions with half-open applicability periods `[effectiveFrom,
effectiveTo)`. Exactly one catalog must apply at the occurrence time. Rates are
immutable and confined to their catalog period. For a provider/product/tier,
each billing unit has non-overlapping half-open rate intervals. There is no
"latest wins" rule.

The independently priced units are `input_token`, `output_token`,
`cached_input_read_token`, `cached_input_write_token`, `tts_character`, and
`request`. Every calculated component snapshots its rate ID, catalog version,
provider/product/model/tier dimensions, interval, USD currency, unit size,
integer-micros price, quantity, and component result.

The trusted request quantity is the ledger's server-owned `requestCount`, which
is exactly one for each recorded provider execution. When one effective
`request` rate exists, its component is added to any token or character
components. A missing request rate is optional and contributes nothing; it does
not make otherwise complete token/character pricing unavailable. By contrast,
every positive provider-reported usage quantity still requires exactly one
matching effective rate. An ambiguous request rate makes the whole calculated
cost unavailable rather than selecting or partially totaling a rate.

SQL uses arbitrary-precision intermediates and component-wise half-up rounding:

```text
componentCostMicros = floor(
  (quantity * priceMicrosPerUnitSize + unitSize / 2) / unitSize
)
costMicros = sum(componentCostMicros)
```

All stored money is signed PostgreSQL `bigint`. At the Admin JSON boundary,
every integer-micros price and cost is explicitly cast to a decimal string;
JavaScript never converts it through `number`.

The migration deliberately seeds no prices. Production requires an authorized
operator to publish independently verified, effective-dated Anthropic and
account-specific ElevenLabs USD catalogs. Test prices are deterministic
fixtures only. This migration is not applied to a hosted project in this work.

## Result, billing, and cost semantics

Operational `result`, bounded `resultReasonCode`, `billingDisposition`, and
`costKind` are independent. Canonical cost kinds are:

- `calculated`: non-null exact cost and optional component snapshots;
- `reconciled`: non-null externally reconciled cost plus reconciliation ref;
- `unavailable`: null cost, never an invented zero.

Trusted `not_billable` semantics produce calculated zero with no catalog or
components. A rejection or HTTP 429 alone does not prove that outcome; provider
throttles and uncertain failures use `billingDisposition: unknown` and null
unavailable cost. Accepted responses with trusted quantities remain billable
even if response validation later fails. The gateway performs no provider
retry. Merely configuring a request rate never changes billing disposition.

Repeating an execution key with identical immutable facts returns the existing
record as a replay. Reusing it with different facts raises
`reconciliation_conflict`; the first record is not silently accepted or
overwritten.

## Scalable Admin aggregate

ADMIN-8 uses `academy_aggregate_provider_usage_costs_v1`, not the newest-500
raw ledger projection, for authoritative supported-range totals. The RPC covers
every matching stored ledger row in a positive half-open range of at most 366
days and returns only fixed summary, UTC-day, engine, provider, approved logical
tier/no-tier speech, cost-kind, and billing-disposition groups. Results are
capped at 384 groups and fail rather than truncate.

Every database integer/numeric aggregate crosses JSON as a decimal string.
IntegerMicros remains a string through the server and browser. Successful query
coverage is `complete`; provider-traffic coverage remains `coverage_unverified`.
Retained accounting-persistence gap telemetry is reported separately and is
never converted to usage or cost. The dashboard claim is limited to
usage-derived marginal provider cost for recorded provider attempts calculated
from verified effective-dated pricing terms, not complete invoice economics.
## Access boundary

Catalog, rate, ledger, and component tables use forced RLS with no browser-role
access. Recording and the canonical projection are service-role-only RPCs.
The narrow application seam calls an ADMIN-1-supplied authorization check for
the exact `costs:read` capability before invoking that projection. Browser role
claims are never accepted, raw provider internals are not projected, and no
learner response contains usage, billing, catalog, or cost data.

# Admin Costs contract v3 integration

Status: integrated across the current Admin Costs endpoint, browser decoder, and
dashboard. This work has not been applied to hosted Supabase.

## Authoritative aggregate

`academy_aggregate_provider_usage_costs_v1` is the authoritative Admin Costs
source for supported aggregate ranges. It is a service-role-only,
security-definer RPC that also requires the fixed `costs:read` capability
marker. `GET /api/admin/v1/costs` independently resolves current `costs:read`
authorization before invoking it.

Ranges are half-open `[startAt, endExclusive)`, must be positive, cannot extend
more than 366 days, and cannot be materially in the future. The RPC scans every
matching ledger row and returns only these fixed dimensions:

- summary;
- UTC day;
- `tutor`, `jarvis`, or `tts` engine;
- `anthropic` or `elevenlabs` provider;
- approved `sonnet`/`haiku` logical tier or the explicit no-tier `speech` bucket;
- `calculated`, `reconciled`, or `unavailable` cost kind; and
- `billable`, `not_billable`, or `unknown` billing disposition.

The fixed grouping result is capped at 384 groups. Any lower caller ceiling that
is exceeded raises an explicit group-limit error. Successful results are never
truncated. The existing `academy_read_provider_usage_costs` newest-500 raw-row
RPC remains an ADMIN-3 diagnostic safety seam, but no live Admin Costs consumer
calls it or uses it for authoritative totals. There is no unbounded raw-row
endpoint.

Database `bigint`/`numeric` totals are cast to canonical decimal strings. The
server validates count and usage strings before converting only safe non-money
values to JavaScript numbers. Integer-micro money remains a canonical decimal
string through the server projection, browser decoder, and exact `BigInt`
formatter; it is never summed or rounded with JavaScript floating-point math.

## Cost truth and coverage

The supported calculated-cost claim is:

> Usage-derived marginal provider cost for recorded provider attempts,
> calculated from verified effective-dated pricing terms.

This is not invoice or provider-account economics. It excludes plan or
subscription fees, taxes, credits, included allowances, rollover, account
adjustments, and negotiated discounts unless those facts are explicitly
represented and reconciled. Missing or ambiguous required pricing remains
`unavailable`, never zero. The existing component-level rounding and optional
request-rate behavior are unchanged. No prices are seeded or guessed.

Successful projections report `queryCoverage: complete` because every stored
ledger row in the supported interval was aggregated. They separately report
`providerTrafficCoverage: coverage_unverified`. Query completeness never proves
that every provider attempt reached the ledger.

TEL-AI's privacy-safe `accounting_unavailable` / `accounting_persistence`
events are counted separately in `accountingGapEvidence`. They do not increment
requests or quantities, do not create an unavailable cost row, and do not
fabricate cost. A zero `observedCount` is not a provider-attempt completeness
claim because database-wide outages may prevent both accounting and telemetry
writes.

The future Provider Attempt Journal may supply richer evidence through a
reviewed successor contract. Version 3 preserves the separate
`queryCoverage`, `providerTrafficCoverage`, and `accountingGapEvidence` seams;
it does not infer or invent journal data.

## Consumer and compatibility boundary

The only live browser consumer of `GET /api/admin/v1/costs` is
`AdminConsoleRoute` through `readAdminCosts`, `parseAdminCostsModel`, and
`AdminCostsDashboard`. The decoder accepts only the exact version 3 root,
range, source, summary, trend, and breakdown shapes. Version 2 fixtures and
hybrid payloads that restore `recordLimit` are rejected as unavailable.

Version 3 preserves the version-2 range, summary, daily trend, and
`engines`/`providers`/`models`/`costKinds`/`billingDispositions` breakdown
shapes. Its source metadata is exactly:

- `queryCoverage`;
- `providerTrafficCoverage`;
- `groupLimit` and `groupCount`;
- `recordsIncluded`; and
- `accountingGapEvidence.observedCount` and
  `accountingGapEvidence.retentionCoverage`.

The live Admin Overview route does not call the Costs endpoint and currently
renders no v3 cost projection. Its cost-card contract remains separate, and its
copy explicitly states that Overview does not establish aggregate-query
coverage, provider-traffic coverage, or accounting-gap evidence. Those signals
remain separate on the AI & Costs dashboard instead of being collapsed into a
single healthy state.

## Privacy

The aggregate contains no execution or usage IDs, account/household/learner
references, provider model or product IDs, price components, payloads, prompts,
responses, TTS text/audio, credentials, or raw ledger rows.

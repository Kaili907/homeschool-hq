# Scalable Admin Costs aggregate

Status: ready for Admin final integration. This work is additive and has not
been applied to hosted Supabase.

## Authoritative aggregate

`academy_aggregate_provider_usage_costs_v1` is the authoritative ADMIN-8 source
for supported aggregate ranges. It is a service-role-only, security-definer RPC
that also requires the fixed `costs:read` capability marker. The Admin endpoint
independently resolves current `costs:read` authorization before invoking it.

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
RPC remains an ADMIN-3 diagnostic safety seam, but ADMIN-8 no longer calls it or
uses it for authoritative totals. There is no unbounded raw-row endpoint.

Database `bigint`/`numeric` totals are cast to canonical decimal strings. The
server validates count and usage strings before converting only safe non-money
values to JavaScript numbers. Integer-micro money is never converted to
`Number`, summed, or rounded in JavaScript.

## Cost truth and completeness

The only supported cost claim is:

> Usage-derived marginal provider cost for recorded provider attempts,
> calculated from verified effective-dated pricing terms.

This is not complete invoice or provider-account economics. It excludes plan or
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
events are counted separately as retained accounting-gap evidence. They do not
increment requests or quantities, do not create an unavailable cost row, and do
not fabricate cost. A zero gap count is not a provider-attempt completeness
claim because database-wide outages may prevent both accounting and telemetry
writes. The later provider-attempt journal owns that remaining gap.

## Privacy and compatibility

The aggregate contains no execution or usage IDs, account/household/learner
references, provider model or product IDs, price components, payloads, prompts,
responses, TTS text/audio, credentials, or raw ledger rows.

Costs projection contract version 3 preserves the version-2 range, summary,
daily trend, and `engines`/`providers`/`models`/`costKinds`/
`billingDispositions` breakdown shapes. The source metadata changes are:

- remove `recordLimit: 500`;
- add `queryCoverage`, `providerTrafficCoverage`, `groupLimit`, and `groupCount`;
- retain `recordsIncluded`; and
- add separate `accountingGapEvidence`.

ADMIN-OVERVIEW-LIVE can keep its existing summary/breakdown consumption. At
final integration its Costs parser/fixture must accept `contractVersion: 3` and
the source fields above; it must not restore `recordLimit` or translate
`queryCoverage: complete` into complete provider-traffic coverage.

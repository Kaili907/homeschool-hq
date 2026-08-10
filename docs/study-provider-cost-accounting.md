# Study safety provider cost accounting

Status: ready locally; not instrumented, not applied hosted, and no price seeded.

## Authority and exact dimensions

`academy_provider_usage_ledger` remains recorded-cost authority. Effective-dated
provider pricing terms remain rate authority. The separate Provider Attempt
Journal remains physical-attempt coverage authority, while telemetry remains
diagnostic only.

This admission is deliberately singular:

```text
engine   = study
purpose  = safety_classification
provider = anthropic
```

Tutor, Jarvis, and TTS retain their established v1 behavior and store a null
purpose. Any other Study purpose, provider, or engine spelling is rejected.
Provider product, provider model, and Academy logical tier remain trusted exact
pricing dimensions; the current Study safety adapter selects Anthropic Haiku.

## Pricing and money

The migration seeds no terms. A billable Study row is calculated only when the
insert-time pricing trigger resolves at least one verified term and every
positive supported usage quantity has exactly one matching verified term at the
trusted occurrence time. No matching term remains `cost_kind=unavailable` and
`cost_micros=null` even when all reported counters are zero; missing pricing is
never recast as zero. An optional request term contributes only when configured.

Anthropic cache-write pricing remains unsupported because the runtime does not
retain trusted per-TTL quantities. Positive cache-write usage therefore remains
unavailable even when input, output, and cache-read terms exist.

Money stays PostgreSQL `bigint` IntegerMicros. Calculation uses arbitrary-
precision intermediates and component-wise half-up rounding. Every calculated
component snapshots the term ID and revision, exact provider dimensions,
effective interval, unit size, IntegerMicros price, quantity, and result. Later
term publication, replacement, or ending does not scan or recompute old rows.

## Future Provider Attempt Journal seam

The later instrumentation must call the service-role-only
`academy_record_provider_usage_v2` once for each physical Study safety provider
attempt. It must pass the physical attempt's stable execution key, exact trusted
provider usage and dimensions, occurrence, latency, result, billing disposition,
and identity attribution. Identical facts replay; reuse with different facts
raises `reconciliation_conflict`.

The RPC returns:

```json
{ "usageId": "<ledger uuid>", "idempotencyResult": "created|replayed" }
```

The Provider Attempt Journal can retain that returned `usageId` as its ledger
link. This branch intentionally creates no journal table and does not modify the
Study safety provider adapter.

## Privacy

The table and v2 RPC have no field for classifier input or output, learner text,
private notes, safety text, prompt, response, raw provider data, diagnostic
inference, secret, or raw error. Only bounded accounting identity, dimensions,
usage, timing, outcome codes, billing disposition, and exact cost snapshots are
accepted.

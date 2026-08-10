# AI and TTS usage and cost accounting contract

Status: ADMIN cost contract version 2. Version 2 supersedes the version 1 cost
shape; it does not loosen the privacy or exact-money boundaries.

## Boundary

`academy_gateway_usage` is the existing per-user/day/endpoint quota counter. It
remains the quota primitive. The cost ledger supplements it with immutable
server-side usage facts and pricing references; it does not change quota timing
or learner gateway responses.

The normal Anthropic response remains `{ text }`. The normal TTS response remains
audio. Provider products/model identifiers, usage, prices, and billing metadata
are available only to trusted server code and authorized Admin reads.

## Verified identity and attribution

Every usage record has a non-null `accountRef` derived from the verified
Supabase bearer identity. `householdRef` is a different identifier and must never
be filled with the account/user ID.

Household attribution is:

- `resolved`: exactly one active, non-revoked membership in one active household;
  `householdRef` is required;
- `no_active_household`: no qualifying relationship exists; `householdRef` is
  null;
- `ambiguous`: more than one qualifying household exists; `householdRef` is
  null; or
- `lookup_unavailable`: trusted attribution could not be completed; the account
  fact may still be recorded and `householdRef` is null.

A non-null `learnerRef` requires a trusted learner grant/relationship and must
belong to the resolved household. Current account-authenticated Tutor, Study
safety, Jarvis, and TTS provider calls record `learnerRef: null`; Study safety
never copies the authorized student identity into provider accounting.

## Usage quantities and product identity

`AdminUsageCostRecord` version 2 records:

- server occurrence time, execution key, verified account/attribution, and
  canonical engine;
- provider, billable provider product/SKU, server provider model ID, and nullable
  Academy logical model tier;
- non-cached input tokens, output tokens, cache-read input tokens, cache-write
  input tokens, or TTS characters as applicable;
- one request, bounded latency, canonical operational result/reason code;
- explicit billing disposition and cost provenance; and
- integer-micro cost plus immutable component rate snapshots when known.

Cache reads and cache writes are separate quantities:
`cachedInputReadTokens` and `cachedInputWriteTokens`. They may have different
provider rates and must never be summed into one cached-token field before
storage. `inputTokens` is non-cached billable input; the three input quantities
must not double count.

Quantities are null when not applicable or not trustworthy. Null never means
zero. A reported numeric zero is a verified zero. TTS characters are counted by
trusted server code as Unicode code points in the validated text actually sent
to the provider.

`logicalModelTier` is required for Academy products that select a logical tier,
including current Anthropic `sonnet`/`haiku` requests. It is null for current TTS,
which has a provider model/product but no Academy tier. Implementations must not
invent `tts`, `default`, or a provider model ID as a logical tier.

## Version snapshots

- `appVersion` is required for every provider execution and identifies the
  immutable deployed gateway/application build.
- `engineVersion` is required when the calling engine has an independently
  versioned implementation available from trusted context. It is null when no
  independent engine version applies; it is never copied from provider model ID.
- `curriculumVersion` is required only when the trusted invocation is bound to an
  immutable curriculum package. Infrastructure/TTS/provider events without that
  context use null.

Null is the explicit not-applicable/unavailable representation. No current
version may be backfilled into historical records whose execution context did
not establish it.

## Pricing catalog and effective periods

Pricing is an immutable, server-controlled catalog. R1 currency is explicitly
`USD` on catalog, rate, component, and usage records. A catalog version has its
own non-overlapping half-open activation period `[effectiveFrom, effectiveTo)`.
Trusted calculation binds exactly one active catalog version for `occurredAt`.

Within that catalog, a price key is:

`provider + providerProductId + logicalModelTier + unit + currency`

For one price key, rate intervals are half-open and must not overlap. At
`occurredAt` there is either exactly one applicable rate or none. Ties,
overlapping rows, implicit "latest wins," and insertion-order precedence are
invalid. A missing or ambiguous rate makes cost unavailable.

Canonical pricing units are `input_token`, `output_token`,
`cached_input_read_token`, `cached_input_write_token`, `tts_character`, and
`request`.

Each calculated component snapshots its immutable rate ID, catalog version,
product/tier/unit/currency, component-specific effective interval, unit size,
price micros, quantity, and component cost micros. Components in one usage
record share one catalog version but may legitimately reference rates with
different effective start/end dates. There is no single `priceEffectiveAt`
field.

Historical catalog/rate versions and component snapshots are not overwritten or
deleted. Dashboards sum stored costs; they do not recalculate history using a
current catalog.

## Exact arithmetic

Database values use integer types. JSON serializes money/rates as canonical
non-negative decimal strings because JavaScript numbers cannot represent every
BIGINT. Server calculation uses `bigint` (or database integer/numeric arithmetic),
never floating-point currency arithmetic.

For each priced component:

`componentMicros = roundHalfUp(quantity * priceMicrosPerUnitSize / unitSize)`

Round each component once, then sum component micros with checked integer
arithmetic. Aggregate totals are integer-micro sums.

## Operational result, billing disposition, and cost kind

Operational outcome and accounting knowledge are independent:

- `result` uses the canonical Admin operational result vocabulary;
- `resultReasonCode` carries bounded detail such as `provider_throttled`,
  `missing_provider_usage`, or `response_sanitization_rejected`;
- `billingDisposition` is `billable`, `not_billable`, or `unknown`; and
- `costKind` remains `calculated`, `reconciled`, or `unavailable`.

Invariants:

- `calculated`: `costMicros` is non-null. Billable nonzero components carry rate
  snapshots. An explicitly `not_billable` event has cost `"0"` and no price
  components. A billable, verified zero-quantity event may also calculate to
  `"0"`; its billing disposition distinguishes it from non-billable.
- `reconciled`: `costMicros` and `reconciliationRef` are non-null. This is
  reserved for immutable invoice reconciliation, not an estimate.
- `unavailable`: `costMicros` and `reconciliationRef` are null. Unknown cost is
  never zero. No authoritative cost component is emitted; provider quantities
  and the safe reason code preserve why calculation was unavailable.

| Event | Canonical representation |
| --- | --- |
| Provider rejection before billable acceptance | `rejected`; `not_billable` and calculated zero only when trusted provider semantics prove no charge, otherwise `unknown`/`unavailable` |
| Timeout or transport outcome with uncertain acceptance | `timeout` or `provider_error`; `unknown`; `unavailable`; null cost |
| Successful provider response with missing/malformed usage | `success` with reason code; `billable`; `unavailable`; null cost |
| Sanitization/safety rejection after provider success | `validation_error` or `safety_stop`; `billable`; calculated when trustworthy usage/prices exist, otherwise unavailable |
| Verified zero billable quantities | original operational result; `billable`; `calculated`; cost `"0"` |
| Missing/ambiguous effective price | original operational result; billing disposition preserved; `unavailable`; null cost |

`calculated` is an estimate. Admin UI labels it calculated/estimated and never as
an invoice.

## Idempotency and privacy

The execution key is generated by trusted platform/server context. Immutable
facts include identity attribution, occurrence time, engine/provider/product,
version snapshots, quantities, result/billing fields, and currency.

- same execution key + same immutable facts: return the existing record as a
  safe replay;
- same execution key + different immutable facts: reject, emit/surface
  `reconciliation_conflict`, and do not return the existing row as if it matched.

A browser retry is a new provider attempt and uses a new trusted execution key.

Never store prompts, responses, conversation text, TTS audio, assessment answer
content, API keys, bearer tokens, credentials, or raw provider usage objects in
usage, pricing, component, or idempotency records.

The admitted provider dimensions are closed: `tutor/tutor_turn`,
`study/safety_classification`, `jarvis/jarvis_turn`, and `tts/tts_synthesis`.
Study safety is always Anthropic with a reviewed logical tier and is never
relabeled as Tutor or Jarvis. The generated ledger purpose makes the mapping
authoritative without allowing callers to submit arbitrary purposes; the
version 2 Admin projection continues to group on canonical engine.

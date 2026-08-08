# AI and TTS usage and cost accounting contract

## Boundary

`academy_gateway_usage` is the existing per-user/day/endpoint quota counter. It
must remain the quota primitive. The cost ledger supplements it with immutable
server-side usage facts and pricing references; it does not change quota timing
or learner gateway responses.

The normal Anthropic response remains `{ text }`. The normal TTS response remains
audio. Provider model identifiers, token usage, pricing, and billing metadata are
available only to trusted server code and authorized Admin reads.

## Usage record

`AdminUsageCostRecord` version 1 contains:

- acceptance time and verified household/account reference;
- learner reference only when derived from trusted context;
- canonical engine, app/engine/curriculum versions;
- provider, logical model tier, and server-side provider model identifier;
- non-negative input, output, and cached-input token counts;
- non-negative TTS character count and request count;
- non-negative integer latency and canonical operational status;
- cost in integer micros of USD, pricing catalog version, and effective price;
- `costKind`: `calculated`, `reconciled`, or `unavailable`.

Token fields are `null` when the provider did not return trustworthy usage. Null
must never be normalized to zero. `inputTokens` is the non-cached billable input
quantity; `cachedInputTokens` is separate, so cached units are never double
counted. TTS characters are counted by trusted server code from the validated
provider-bound text, not from a browser-supplied number.

Provider failure/timeout records retain request/status/latency facts. Cost is
`null` and `costKind` is `unavailable` when usage or an effective price cannot be
established. A missing cost must never appear as free usage.

## Pricing catalog

Pricing rows are server-controlled and immutable after use. A row identifies:

- catalog version, provider, provider model ID, and logical tier;
- unit (`input_token`, `output_token`, `cached_input_token`, `tts_character`, or
  `request`);
- positive integer `unitSize` and integer `priceMicrosPerUnitSize`;
- currency (`USD` for version 1); and
- an effective interval `[effectiveFrom, effectiveTo)` in UTC.

Effective intervals for the same provider/model/unit may not overlap. Select the
price using the usage `occurredAt`, not insertion time. Historical rows and the
catalog version referenced by a usage record are never overwritten or deleted.
If no unique effective row exists, calculation is unavailable rather than
guessed.

## Exact arithmetic

Database values use integer types. JSON serializes money/rates as canonical
non-negative decimal strings because JavaScript numbers cannot represent every
BIGINT. Server calculation uses `bigint` (or database integer/numeric arithmetic),
never `number` currency arithmetic.

For each priced component:

`componentMicros = roundHalfUp(quantity * priceMicrosPerUnitSize / unitSize)`

Round each component once, then sum component micros with checked integer
arithmetic. Store the component quantities, selected catalog version, effective
price reference, rounding rule, and final integer micros so the calculation is
reproducible. Aggregate dashboards sum stored integer micros; they do not
recalculate historical usage using today's price.

`calculated` is an estimate from provider-reported usage and the catalog.
`reconciled` is reserved for a later immutable invoice reconciliation. Admin UI
must label calculated spend as calculated/estimated and must not present it as an
invoice.

## Idempotency and privacy

One provider attempt has one stable server-generated usage ID/idempotency key.
Retries are distinct attempts unless the gateway is replaying the exact accepted
attempt. Duplicate writes with different facts are rejected and surfaced for
reconciliation.

Never store prompts, responses, conversation text, TTS audio, assessment answer
content, API keys, bearer tokens, or credentials in usage/pricing rows.

# Academy AI and TTS usage/cost accounting

This contract adds privacy-safe server accounting to the existing authenticated
Anthropic and ElevenLabs gateways. It does not change the browser success or
error shapes, provider selection, authentication, household entitlement, or
daily quota ordering.

## Trusted identity and captured usage

The gateway verifies the Supabase bearer token and persists that verified user
ID. The database derives a household ID only when the user has exactly one
active, non-revoked membership in an active household. Ambiguous household
membership remains null instead of inventing attribution. Current Tutor,
Jarvis, and TTS requests do not carry a trusted learner grant, so `learner_id`
is deliberately always null.

Each ledger row stores only:

- server occurrence/recording timestamps and a server/platform execution key;
- verified user and safely derived household identity;
- Tutor, Jarvis, or TTS engine; provider; logical model tier; and the
  server-selected provider product;
- Anthropic input/output and cache-read/cache-write token counters when the
  provider usage object is complete and bounded;
- validated TTS Unicode code-point count and approved voice reference;
- one request, bounded latency, result status, calculation status, and
  calculated estimated cost in integer micros.

There is no parameter or column for prompts, messages, provider responses,
conversations, assessment answers, audio, provider request IDs, stop reasons,
or raw usage objects. Returned audio is never persisted.

## Pricing catalog and historical calculation

`academy_provider_prices` is an append-only, server-only catalog keyed by
provider, provider product, billing unit, and `effective_from`. A later version
must have a strictly later effective start and implicitly supersedes an earlier
open period. Optional `effective_to` creates an explicit exclusive end/gap.
Existing rows cannot be updated or deleted. Each calculated cost component also
snapshots the selected price ID, price micros, unit quantity, quantity, and
result, so already-recorded history remains reproducible after new prices are
added.

The migration intentionally inserts no prices. The repository contains only
fixtures labeled `DETERMINISTIC TEST FIXTURE - NOT PRODUCTION PRICING` inside
the isolated database test. Before production cost estimates are meaningful,
an authorized operator must insert independently verified Anthropic prices for
every deployed model/billing unit and the account-specific ElevenLabs product
price, with correct effective dates and source labels. No migration in this
session is applied to a hosted project.

## Exact money arithmetic

All money is integer micro-units. For each nonzero billing component, SQL uses
arbitrary-precision `numeric` intermediates and component-wise half-up rounding:

```text
component_cost_micros = floor(
  (quantity * price_micros + unit_quantity / 2) / unit_quantity
)
total_cost_micros = sum(component_cost_micros)
```

TTS `character` quantity means Unicode code points in the exact validated text
submitted to ElevenLabs (not UTF-16 code units or bytes). Quantities are
limited to 1,000,000,000, price micros to 1,000,000,000,
unit quantities to 1..1,000,000,000, latency to 0..300,000 ms, and the final
stored value to signed PostgreSQL `bigint`. The maximum permitted single
component is therefore 1,000,000,000,000,000,000 micros, inside the signed
`bigint` bound. Floating-point arithmetic is never used for cost.

`calculated_cost_micros` is an estimate, not an invoice or reconciled billed
amount. This model does not claim invoice reconciliation.

## Result, failure, and retry semantics

| Outcome | Ledger status | Cost treatment |
| --- | --- | --- |
| Provider success with valid usage | `success` | Estimate from effective prices |
| Anthropic success with missing/malformed usage | `missing_usage` / `malformed_usage` | Unknown; no invented tokens or cost |
| Provider 429 | `provider_throttled` | Explicit zero/non-billable |
| Provider non-2xx or transport/read error | `provider_error` | Billing outcome unknown |
| Provider timeout | `timeout` | Billing outcome unknown |
| Provider accepted TTS but returned invalid/empty audio | `provider_error` | Character estimate retained |
| Anthropic response cannot pass sanitization | `response_sanitization_failure` | Valid provider usage is still estimated |
| Required price is absent or outside its period | original result status | `price_unavailable`, null cost |

The gateway performs no provider retry. A browser retry is a new provider
attempt and receives a new platform execution key, so it is counted separately.
Repeated persistence of the same trusted platform execution key returns the
existing ledger row and cannot add a second request or cost component. This
idempotency does not rely on a client-supplied token or cost value.

Accounting persistence is awaited but isolated from the established learner
response. A database accounting outage does not replace an otherwise valid
Tutor/Jarvis text or TTS audio response. Existing daily quota reservation still
occurs before the provider call and remains fail-closed.

## Access boundary

All three accounting tables use forced RLS. `PUBLIC`, `anon`, and
`authenticated` receive no table access and cannot execute the recording RPC.
Only the server `service_role` can record usage or read the catalog/ledger.
ADMIN-0 still owns the final authorized Admin Console read contracts; this
session intentionally adds no browser/admin query RPC and no UI.

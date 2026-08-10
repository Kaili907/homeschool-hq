# Production AI, TTS, and gateway telemetry

The production Anthropic and ElevenLabs gateways use TEL-FOUNDATION's trusted
server writer for canonical operational outcomes. The provider usage/cost
ledger remains authoritative for provider product/model, token or character
quantities, billing disposition, provider latency/status, and cost.

## Operational events

Authenticated and entitled Anthropic and TTS requests receive one stable
platform execution key before request validation and quota reservation. Their
terminal `gateway.request` event records only the server-derived result,
bounded duration, HTTP status, route, provider, operation, and bounded reason
code. Validation failures are `validation_error`; expected quota or provider
throttling is `rejected`; timeouts and provider failures retain their distinct
canonical results.

Only a server-validated Anthropic request whose mode is `jarvis` also produces
a `jarvis.turn` event. Tutor causal and outcome telemetry is deliberately not
emitted here. Gateway authority never invents learner attribution. A resolved
active household produces household scope with `learnerRef: null`; ambiguous
household attribution produces system scope.

TTS does not produce a second provider or synthesis receipt. Its operational
gateway result and duration are derived from the same terminal provider usage
receipt. Provider usage/cost and operational telemetry therefore cannot choose
independent token, character, cost, provider-result, or provider-latency facts.

## Accounting completeness

Provider usage persistence remains observational: its failure cannot replace a
successful learner/provider response. When a terminal provider receipt cannot
be persisted, the corresponding gateway event keeps its true terminal result
and adds only:

- `reason_code: accounting_unavailable`
- `failure_stage: accounting_persistence`

This privacy-safe aggregate signal lets Admin cost reporting distinguish
provider success with unavailable accounting from traffic whose canonical
provider receipt persisted. It never fabricates cost or usage. A database-wide
outage can prevent both writes, so infrastructure availability monitoring
remains necessary; this signal is not an impossible cross-database guarantee.

## Study safety cost ruling

Study safety currently calls Anthropic Haiku with bounded retry and fail-closed
semantics, but the canonical provider ledger and its security-definer write RPC
explicitly allow Anthropic only for `tutor` and `jarvis`. Recording Study calls
through either engine would corrupt attribution. Adding a parallel safety-cost
writer would duplicate the pricing/idempotency contract.

This card therefore does not write a misleading Study safety cost row and does
not weaken classification. Closing the gap safely requires an additive ledger
migration after `20260809120000` that admits `study`, preserves the single
canonical pricing calculation and replay digest, and is validated with exact
per-attempt usage/retry receipts against trusted account and verified household
authority. No classifier text or learner identity should enter that ledger.

## Cache pricing limitation

The production gateway bodies have no `cache_control`, and this card does not
enable Anthropic prompt caching. Cache pricing remains inactive unless the
provider returns actual positive trusted cache counters. Mixed five-minute and
one-hour cache-write TTL pricing remains unresolved because the current
provider receipt does not carry a trusted per-TTL quantity split; no rate or
cost is guessed.

## Privacy

Operational telemetry contains no prompt, provider response, classifier text,
TTS text, audio, assessment content, arbitrary provider body, credential, or
raw exception. Provider accounting continues to accept only exact allowlisted
quantities and bounded identifiers.

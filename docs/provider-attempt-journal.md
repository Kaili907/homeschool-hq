# Provider Attempt Journal foundation

Status: contract version 1 with Tutor, Study safety, Jarvis, and premium TTS
gateway instrumentation. The migrations are repository-only and have not been
applied to hosted Supabase.

## Authority boundary

The Provider Attempt Journal is the authority for provider-attempt coverage.
`academy_provider_usage_ledger` remains the authority for usage, calculated or
reconciled cost, pricing provenance, and billing disposition. A journal row or
coverage projection never supplies a missing price and never claims complete
provider invoice economics.

Provider dispatch integrations follow this ordering:

1. derive trusted account, household attribution, versions, operation identity,
   provider dimensions, and physical retry index;
2. durably reserve the physical attempt;
3. establish `dispatch_possible`;
4. dispatch to the provider; and
5. append normalized outcome and accounting/reconciliation transitions.

If reservation fails, Tutor and Jarvis use their existing safe gateway failure
path, premium TTS falls through its existing voice-adapter behavior, and Study
safety returns its existing invalid classification so academic continuation
remains fail closed. No provider dispatch occurs.

## Physical attempts and idempotency

`academy_provider_attempts` has one immutable row per physical provider call or
retry. The globally unique reservation key makes an identical reservation a
safe replay. The unique `(logical_operation_key, physical_retry_index)` pair
prevents the same logical mutation from creating the same physical attempt
twice. A real retry increments `physical_retry_index` and has distinct
reservation, operational telemetry, and cost-ledger execution keys.

An identical replay returns the original attempt ID. The account-scoped digest
of the browser's `x-academy-operation-id` is the gateway execution identity;
the raw UUID is not stored. An exact HTTP replay therefore reaches the same
reservation even if the hosting platform assigns the replay a different
invocation ID, and the gateway refuses a second physical dispatch. Reusing any
reservation, logical-retry slot, telemetry key, or ledger key with different
facts raises `reconciliation_conflict`; no evidence is overwritten.

The ledger execution key deliberately uses the existing cost ledger's stricter
`[A-Za-z0-9_-]` contract. Operational telemetry has its own stable correlation
key. Neither identifier contains learner content.

## Dimensions

The initial provider-operation combinations reflect provider calls present in
the repository:

| Engine | Purpose | Provider | Logical tier |
| --- | --- | --- | --- |
| `tutor` | `tutor_turn` | `anthropic` | `sonnet` or `haiku` |
| `jarvis` | `jarvis_turn` | `anthropic` | `sonnet` or `haiku` |
| `study` | `safety_classification` | `anthropic` | `sonnet` or `haiku` |
| `tts` | `tts_synthesis` | `elevenlabs` | null |

Study safety is always `engine = study` and
`purpose = safety_classification`. It is never relabeled as Tutor or Jarvis to
fit the older cost-ledger engine constraint.

Every reservation also snapshots the trusted account/household attribution,
application version, applicable engine/curriculum version, provider product,
provider model, and logical tier needed for later correlation. No learner ID is
needed for provider accounting coverage.

## Lifecycle

The initial append-only transition is `reserved`.

| From | Allowed next state | Meaning |
| --- | --- | --- |
| `reserved` | `dispatch_possible` | Required pre-dispatch facts and safety/accounting preconditions were established. |
| `reserved` | `confirmed_not_dispatched` | Trusted evidence proves dispatch never became possible. |
| `dispatch_possible` | `outcome_observed` | A normalized physical-attempt result was observed. |
| `dispatch_possible` | `confirmed_not_dispatched` | Trusted evidence proves no provider dispatch occurred after readiness. |
| `outcome_observed` | `ledgered` | The exact expected authoritative ledger row exists and all correlation dimensions match. |
| `outcome_observed` | `gap_pending` | The expected ledger row is missing. |
| `outcome_observed` | `reconciliation_conflict` | A candidate relationship conflicts with durable facts. |
| `gap_pending` | `ledgered` | A late authoritative ledger row now matches. |
| `gap_pending` | `reconciliation_conflict`, `reconciled`, or `unresolvable` | Investigation found a conflict, bounded external coverage evidence, or no recoverable resolution. |
| `reconciliation_conflict` | `reconciled` or `unresolvable` | Investigation closed the conflict without rewriting history. |

`ledgered`, `reconciled`, `confirmed_not_dispatched`, and `unresolvable` are
terminal in version 1. Reconciliation records only a bounded reason code and
reference. It does not create usage or cost.

The attempt, transition history, and ledger-link tables reject update and
delete. Service-role callers have no direct table privilege; only the
fixed-search-path security-definer functions can append evidence. Browser roles
cannot reserve, transition, link, or read the tables.

## Ledger correlation and coverage

`academy_provider_attempt_ledger_links` is a one-to-one relationship: one
physical journal attempt to one authoritative usage ledger row, and one usage
ledger row to at most one attempt. Linking checks the pre-reserved ledger key,
reservation-before-occurrence ordering, account/household attribution,
engine/version snapshots, provider product/model, and logical tier.

A missing row creates `gap_pending`. A mismatched or already-linked row creates
`reconciliation_conflict` and is not linked. The additive Study accounting
migration admits only `study/safety_classification` for Anthropic usage. Missing
or malformed provider usage and ledger persistence failure stay visible as gaps
instead of becoming fabricated Tutor/Jarvis rows or invented token counts.

`academy_read_provider_attempt_coverage_v1` is a service-only, `costs:read`
projection over a bounded half-open range. It reports recorded attempts,
ledger-linked attempts, journaled attempts missing a ledger relationship,
ledger rows without a journal relationship, current lifecycle counts, and a
coverage status. It explicitly returns `invoiceCompletenessClaim: false` and
names `academy_provider_usage_ledger` as cost authority.

## Privacy

Reservation accepts an exact JSON shape and transitions accept only normalized
result/reason/reference fields. The journal has no prompt, message, provider
response, raw provider object/error, transcript, student or assessment answer,
audio, journal/private note, emotional/personality/diagnostic inference, or
secret field. Product/model/version identifiers and reason codes are bounded;
arbitrary metadata JSON is not stored.

## Instrumented gateways

`netlify/functions/anthropic.js` reserves only validated, entitled, quota-
admitted Tutor and Jarvis physical calls. The mode fixes the journal dimensions
to `tutor/tutor_turn` or `jarvis/jarvis_turn`; scripted browser responses never
reach this server seam and create no attempt. The handler currently makes one
physical request per logical operation, so its retry index is zero.

`netlify/functions/tts.js` reserves only validated, entitled, quota-admitted
ElevenLabs synthesis. Browser speech, cache playback, disabled synthesis, local
voice behavior, and pre-dispatch rejections do not reach this seam. The journal
stores the server-owned ElevenLabs model identity, never the provider voice ID,
text, or audio.

All three provider paths use `provider-gateway-attempt.js` for the same ordering: reserve,
`dispatch_possible`, physical request, `outcome_observed`, authoritative usage
ledger persistence, and journal linkage. A missing ledger becomes
`gap_pending`; a mismatched or already-linked ledger becomes
`reconciliation_conflict`. All linkage states come from the journal RPC rather
than gateway inference. The coordinator accepts a stable logical operation,
distinct physical execution key, and explicit retry index so any future
internal retry produces its own attempt and usage receipt.

## Study safety integration

`createAnthropicSafetyClassifier().classify()` reserves inside its physical
retry loop immediately before every Anthropic fetch. Retry indexes start at
zero, share one content-free logical operation key, and use distinct derived
physical execution and ledger keys. Reservation or dispatch-readiness failure
prevents the fetch and returns the existing invalid fail-closed classification.

Every actual response is reduced to a bounded outcome. Only valid Anthropic
usage counters from that response may reach the usage/cost ledger. A timeout,
transport failure, missing/malformed usage, ledger failure, or absent link ends
as `gap_pending`; none of those accounting states weakens or replaces the
safety decision. Study remains `engine = study`,
`purpose = safety_classification`, and `provider = anthropic` throughout.

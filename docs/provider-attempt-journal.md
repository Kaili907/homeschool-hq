# Provider Attempt Journal foundation

Status: foundation contract version 1. This migration is repository-only and
has not been applied to hosted Supabase.

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

If reservation fails, a future Study safety integration must fail closed rather
than dispatching and later describing that call as fully accounted. This card
provides the foundation; it does not yet change every provider gateway.

## Physical attempts and idempotency

`academy_provider_attempts` has one immutable row per physical provider call or
retry. The globally unique reservation key makes an identical reservation a
safe replay. The unique `(logical_operation_key, physical_retry_index)` pair
prevents the same logical mutation from creating the same physical attempt
twice. A real retry increments `physical_retry_index` and has distinct
reservation, operational telemetry, and cost-ledger execution keys.

An identical replay returns the original attempt ID. Reusing any reservation,
logical-retry slot, telemetry key, or ledger key with different facts raises
`reconciliation_conflict`; no evidence is overwritten.

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
`reconciliation_conflict` and is not linked. Study safety can therefore be
journaled truthfully today even though the current cost-ledger RPC does not yet
admit `study`; the resulting gap stays visible instead of becoming a fabricated
Tutor/Jarvis cost row.

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

## Remaining instrumentation

Later gateway cards must reserve immediately before each actual physical
provider attempt, including every Study classifier retry; use distinct retry
indices and correlation keys; mark dispatch readiness and outcome; write the
existing authoritative cost receipt; and link or mark the accounting gap.

The cost-ledger contract still needs an additive, independently reviewed change
before Study safety usage can become a valid `study` ledger row. Existing Tutor,
Jarvis, and TTS gateway behavior is not rewired by this foundation migration.

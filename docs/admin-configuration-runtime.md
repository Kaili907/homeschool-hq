# ADMIN-14B runtime configuration enforcement

ADMIN-14B resolves the durable ADMIN-14A snapshot on trusted servers and uses
the same effective values in the Admin read projection, Tutor/Jarvis gateway,
TTS catalog and synthesis gateway, System Health, and Admin Overview. Runtime
resolution is a read operation and does not append an audit event.

The database contract is unchanged. Its `pending_runtime_integration` value is
storage metadata for the ADMIN-14A mutation DTOs; contextual runtime status is
derived by the server and is not persisted. No ADMIN-14B migration is needed.

## Precedence

Resolution applies these authorities without allowing a lower layer to weaken
a higher one:

1. Fixed code, privacy, authorization, and hard safety invariants.
2. The authoritative saved Admin value.
3. Stronger deployment, catalog, guardian, accommodation, or subsystem safety
   constraints.
4. A fail-closed code fallback when the saved snapshot or a required constraint
   cannot be trusted.

Admin values never alter Study's safety classifier, guardian precedence,
accommodations, immutable privacy rules, authorization, or hard Tutor/Jarvis
policy. Study has no ADMIN-14A effective-settings consumer on this branch.

## Classification and consumers

| Setting | Classification | Effective consumer |
| --- | --- | --- |
| `runtime.ai.enabled` | `ENFORCEABLE_NOW` | Tutor/Jarvis Anthropic gateway |
| `runtime.tts.enabled` | `ENFORCEABLE_NOW` | TTS catalog and synthesis gateway |
| `quota.ai.requests_per_account_day` | `ENFORCEABLE_NOW` | Atomic Anthropic account/day limiter |
| `quota.tts.requests_per_account_day` | `ENFORCEABLE_NOW` | Atomic TTS account/day limiter |
| `ai.approved_tiers` | `ENFORCEABLE_NOW` | Server logical-tier admission |
| `ai.default_tier` | `ENFORCEABLE_NOW` | Server fallback for a known but unapproved browser preference |
| `cost.warning.monthly_micros` | `ENFORCEABLE_NOW` | Monthly cost alert evaluator |
| `cost.critical.monthly_micros` | `ENFORCEABLE_NOW` | Monthly cost alert evaluator |

No registered setting is `UNSUPPORTED`. The cost thresholds remain durable and
editable and are effective only as operational alert thresholds. They are not
provider spending hard caps and do not disable AI/TTS, change quotas or tiers,
or alter provider routing.

## Monthly cost alert authority

The trusted monthly evaluator owns threshold calculation for Costs, Overview,
and future Production Readiness consumers. It derives a full UTC calendar-month
window from server observation time: the inclusive first instant of the month
through the exclusive first instant of the next month. Browser dates, totals,
threshold status, and invoice claims are never accepted.

The sole amount under evaluation is the authoritative ledger's recorded
`calculated` provider cost: an exact decimal-string IntegerMicros total derived
from provider usage and the effective pricing catalog. Reconciled cost remains
separate. The evaluated amount is therefore a usage-derived operational
estimate, not a provider invoice total. The provider-attempt journal supplies
coverage evidence only and is never used to calculate cost or threshold state.

The evaluator returns `normal`, `warning`, `critical`, `partial`, or
`unavailable`, along with the recorded monthly total, both thresholds, and
positive remaining amounts when a complete total makes them exact. Recorded
costs are non-negative and additive, so an incomplete total is a lower bound.
That lower bound can safely prove `critical` once it reaches the critical
threshold. Below critical, it cannot distinguish normal, warning, or a hidden
critical total, so the result remains `partial`; it is never falsely classified
normal. An unavailable aggregate or invalid/missing threshold projection yields
`unavailable` without inventing zero.

Cost alert reads stay behind `costs:read`. Configuration reads and mutations
retain their existing Configuration authority, confirmation, CAS, and audit
boundaries. This integration uses the existing configuration and usage ledger;
it adds no migration.

## Effective rules and fallback

AI and TTS enablement require both the saved value and their deployment-owned
enablement ceiling. A saved disable always wins. The daily account limits use
the lower of the saved ceiling and the existing deployment/code ceiling. The
current safe code ceilings remain 50 AI requests and 100 TTS requests when a
valid deployment value is absent.

The effective AI tier set is restricted to the code-owned logical `sonnet` and
`haiku` mappings. A valid browser tier is only a preference: the gateway keeps
it when approved and otherwise selects the saved effective default. Unknown or
provider-native tiers remain invalid; the browser cannot select provider IDs.

Premium TTS additionally requires an active, approved, deployment-available
entry in the existing logical voice catalog. The production catalog currently
has zero entries, so new premium synthesis remains unavailable and
browser-native speech is the safe fallback. Provider voice IDs stay server-only.

If configuration loading, validation, or resolution fails, new AI and premium
TTS provider work is disabled before entitlement lookup, quota consumption, or
provider access. The browser never supplies roles, effective values,
enforcement claims, or fallback state.

## Mutation and audit boundary

Preview and commit still use the ADMIN-14A Owner-only bearer/RPC flow. CAS,
five-minute confirmation binding, actor/request idempotency, revision append,
head advance, and the canonical ADMIN-15 audit append remain one database
transaction. A successful commit triggers a new trusted read for contextual
runtime status; the browser never derives `effective` from the submitted value.

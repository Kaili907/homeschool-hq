# ADMIN-14B effective runtime configuration

Status: implemented locally; migrations not applied hosted; no deployment.

ADMIN-14B connects the eight ADMIN-14A registry values to existing server-owned
runtime consumers. `effective-configuration.js` reads only the sanitized
service-role RPC, validates the code-owned registry projection, and returns a
deeply frozen effective view. Browser state never becomes configuration
authority and the view contains no environment values, credentials, provider
voice IDs, raw database rows, or actor data.

## Authority, revisions, and cache

The reader caches an available projection for at most 15 seconds and an error
for at most one second. Concurrent reads coalesce. Each of the eight independent
setting revisions remains visible in the server view. A lower observed revision,
or a changed value at the same revision, makes the view unavailable instead of
serving potentially broadened stale authority. Once an available cache expires,
a failed refresh returns safe unavailable defaults; an expired enabling value is
not used as stale authority.

Provider-enabling consumers require `runtime_enforced` from migration
`20260810140000_academy_admin_configuration_runtime_enforcement.sql`. Deploying
runtime code before that status migration therefore fails closed. The migration
does not mutate revision history or grants and restores the immutable registry
trigger after advancing the eight code-owned integration statuses.

## Effective settings

| Durable key | Runtime behavior |
| --- | --- |
| `runtime.ai.enabled` | ANDed with `ACADEMY_AI_ENABLED`; either false disables new Anthropic calls. |
| `runtime.tts.enabled` | ANDed with `ACADEMY_TTS_ENABLED`; either false disables new provider synthesis. |
| `quota.ai.requests_per_account_day` | Atomic gateway quota uses the lesser of the durable value and the bounded deployment ceiling. |
| `quota.tts.requests_per_account_day` | Same lesser-of rule for TTS. |
| `ai.approved_tiers` | A validated requested tier must be in this server allowlist. |
| `ai.default_tier` | Selects the tier only when the bounded request omits `modelTier`; it must remain approved. |
| `cost.warning.monthly_micros` | Current-month calculated usage cost is compared as exact decimal-string IntegerMicros. |
| `cost.critical.monthly_micros` | Same exact comparison for the critical state. |

Configuration is an additional ceiling. It cannot enable a deployment-disabled
provider, raise a deployment quota, add a provider model, add a logical voice,
or bypass authentication, authorization, entitlement, safety validation,
provider accounting, or privacy controls.

## Gateway ordering and failure

Anthropic keeps the existing order: bounded route/method checks, bearer
verification, deployment kill switch, entitlement, and Tutor/Jarvis request and
graded-work validation. Only then does effective configuration select/restrict
the model tier and quota. A missing or invalid effective view returns the stable
`configuration_unavailable` error before quota or provider use. Durable AI
disablement returns `gateway_disabled`; an otherwise valid but disallowed tier
returns `model_tier_not_approved`.

TTS likewise preserves authentication, deployment gating, entitlement, bounded
request validation, and logical voice resolution ahead of configuration. It
continues to reject browser-supplied provider fields and never returns provider
voice IDs. Durable TTS disablement prevents new provider synthesis and quota
consumption. Catalog reads remain available for browser fallback: their
`synthesisEnabled` value becomes false while per-voice cached-playback policy is
left intact. The production catalog still has zero approved premium voices and
no provider mapping was invented.

## Cost thresholds

The existing Admin costs endpoint adds a current-month threshold state derived
only from its calculated usage-cost metric. Comparisons use `BigInt` over
canonical IntegerMicros strings; money is never converted to `Number`. Partial
evidence can prove warning/critical once its lower bound crosses a threshold,
but cannot prove `below_warning`. Other ranges are `not_applicable`, and source
or configuration uncertainty is explicit `unavailable`.

The UI labels this basis as a calculated usage estimate. The configured
threshold is not represented as provider invoice, tax, credit, contractual, or
other invoice economics, and reconciled cost remains separate.

## Scope boundary

All eight registered ADMIN-14A settings have a current runtime consumer. Study
Effective Settings V2 remains a separate card: no Study setting was added, no
guardian setting was overwritten, and Study safety behavior remains unchanged.
Reads create no Admin audit event; ADMIN-14A mutations retain sole ownership of
configuration audit writes.

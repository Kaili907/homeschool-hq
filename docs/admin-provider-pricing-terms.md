# Effective-dated provider pricing terms

Status: foundation ready locally; no hosted migration was applied and no
provider price was seeded.

## Authority and safe empty state

`academy_private.provider_pricing_terms` is the authoritative private pricing
source for new provider usage rows. The migration refuses to adopt any legacy
catalog/rate rows without a separate review and revokes their service-role
insert grants. It inserts no Anthropic, ElevenLabs, OpenAI, or other provider
price. A valid deployment with no verified terms returns
`pricing_unconfigured`; billable usage with a missing required term remains
`costKind: unavailable` and never becomes zero by assumption.

R1 currency remains `USD`. Money is stored as signed PostgreSQL `bigint`
IntegerMicros. Admin JSON accepts and returns canonical decimal strings for
`priceMicrosPerUnitSize`, `unitSize`, and revisions. The server rejects JSON
numbers and decimal/floating strings for money.

## Pricing dimension

One term is keyed by the same identity captured by the cost ledger:

`provider + providerProductId + providerModelId + logicalModelTier + usageUnit + currency`

Supported terms are deliberately limited to runtime-accountable dimensions:

- Anthropic `sonnet` or `haiku`: `input_token`, `output_token`,
  `cached_input_read_token`, and optional `request`;
- ElevenLabs with no logical tier: `tts_character` and optional `request`.

Anthropic `cached_input_write_token` is unsupported. The gateway does not enable
prompt caching and does not retain a trusted split between five-minute and
one-hour cache-write TTL quantities. A positive cache-write quantity therefore
leaves cost unavailable. The table and Admin API both reject a generic
cache-write term rather than inventing precedence or economics.

## Time, revision, and history

Applicability is half-open: `[effectiveFrom, effectiveUntil)`. Terms for one
exact dimension cannot overlap, and lookup never uses “latest wins.” A lookup
returns exactly one term, `pricing_unconfigured`, `pricing_ambiguous`, or
`unsupported_dimension`; all non-exact outcomes fail closed.

Revisions increase independently per exact dimension. Price, unit size,
provider/product/model/tier/unit, verification reference, creation authority,
and start time cannot be updated or deleted. Replacing a current or future term
atomically ends it at a future boundary and inserts revision N+1. A scheduled,
unused term may be disabled. A published term may be ended only at a non-past
boundary that does not invalidate a component already recorded at or after that
boundary.

Every calculated ledger component snapshots the term ID and revision together
with the existing provider dimensions, interval, IntegerMicros rate, unit size,
quantity, and component result. Ending or replacing a term does not recalculate
an old ledger row. Historical terms remain referenced and cannot be deleted.

## Admin operations and authorization

`GET /api/admin/v1/provider-pricing-terms` requires `costs:read` and calls the
service-only `academy_admin_read_provider_pricing_terms_v1` projection.

Mutations require the owner-only `configuration:manage` capability and use the
verified caller bearer so PostgreSQL derives `auth.uid()` and the current Admin
assignment. Direct table reads/writes are not granted to `anon`,
`authenticated`, or `service_role`. The only mutation grants are the narrow
security-definer RPCs:

- `academy_admin_preview_provider_pricing_term_v1` validates a create or
  replacement, records only a SHA-256 confirmation-token digest, and returns a
  five-minute confirmation;
- `academy_admin_commit_provider_pricing_term_v1` consumes the matching
  confirmation, enforces the expected dimension revision, inserts the term,
  and provides actor/request idempotency;
- `academy_admin_end_provider_pricing_term_v1` performs a revision-bound,
  idempotent safe end or unused-future disable.

The corresponding HTTP paths are `/preview`, `/commit`, and `/end`. Requests
have exact field sets, bounded provider identifiers and verification references,
allowlisted reason codes, UUID request IDs, and no free-form metadata.

## Audit and ledger relationship

Every successful commit/end/disable calls ADMIN-15's ungranted
`append_admin_audit_event_v1` in the same transaction using the existing
`configuration.update` / `configuration` vocabulary. Audit failure rolls back
the term mutation, confirmation consumption, and idempotency receipt. Audit
values contain only status, revision, IntegerMicros value, and logical tier;
they never contain a provider credential, token, invoice body, or secret.

The existing `academy_provider_usage_ledger` remains cost authority. A new
insert-only trigger calculates from terms at the row's trusted occurrence time
and writes immutable component snapshots using the established component-wise
half-up formula. It does not scan or update prior rows and does not claim taxes,
credits, subscriptions, allowances, discounts, adjustments, or complete invoice
economics.

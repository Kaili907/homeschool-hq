# Admin Console R1 Wave 2 integration

This local integration assembles the operational Costs, System Health, Engine
Performance, Learner Analytics, and Safety Operations projections on the R1
authorization, telemetry, shell, curriculum, and validation foundation. It does
not apply hosted migrations, seed provider prices, deploy, or create a unified
Overview aggregate.

## Routes and server capabilities

| Route | Server capability |
| --- | --- |
| `/academy/admin` | `overview:read` |
| `/academy/admin/learners` | `learners:read` |
| `/academy/admin/engines` | `engines:read` |
| `/academy/admin/costs` | `costs:read` |
| `/academy/admin/health` | `health:read` |
| `/academy/admin/safety` | `safety:read` |
| `/academy/admin/curriculum` and `/academy/admin/curriculum/validation` | `curriculum:read` |

The canonical shell hides destinations that are not present in the resolved
capability set. That presentation rule is defense in depth only: every data
endpoint independently authorizes its required capability before reading its
source. Student sessions, ordinary guardians, expired assignments, revoked
assignments, and unresolved authorization receive no Admin projection data.

## Migration order

The Wave 2 chain is unique and ordered after the existing Study migrations:

1. `20260808120000_academy_admin_authorization.sql`
2. `20260808121000_academy_operational_events.sql`
3. `20260808122000_academy_provider_usage_cost_ledger.sql`
4. `20260808123000_academy_admin_safety_operations.sql`
5. `20260809120000_academy_operational_telemetry_foundation.sql`

The cost ledger retains only the integrated `122000` filename. Its request-unit
pricing correction is included in that file; no `120000` cost-ledger migration
exists.

## Evidence and bounded-source behavior

- Costs reads at most 500 ledger rows. A full 500-row read is visibly `partial`;
  the dashboard never presents it as a complete total.
- System Health reads at most 500 operational events. A full read is treated
  conservatively as truncated, so affected health evidence remains `unknown`
  instead of being promoted to healthy.
- Engine Performance has no fabricated telemetry writer. Metrics remain
  unavailable or insufficient until canonical operational events exist.
- Learner Analytics derives household scope on the server and keeps Study and
  learner cost unavailable where no safe durable or trusted attribution boundary
  exists.
- Safety Operations exposes a read-only, service-backed, bounded 100-event page.
  Only canonical `safety_stop` evidence becomes a safety event; provider errors,
  timeouts, fallbacks, and ordinary rejections do not.

The telemetry foundation now provides a bounded database aggregate that is
complete beyond 500 raw events for supported ranges. The existing Health and
Engine Performance projections remain conservative raw-reader consumers until
their dedicated follow-up cards adopt that seam; exactly 500 rows still means
unknown/partial, never a complete population. Cost scaling remains separately
owned by the provider usage ledger.

## Privacy and state semantics

The combined projections omit raw conversations, prompts and responses, audio,
journals and private notes, assessment answers, credentials and tokens, provider
payloads, raw operational rows, and arbitrary backend exceptions. Learner cost
is not guessed. Production surfaces preserve real zero, unknown, unavailable,
partial, stale, and insufficient-evidence states as distinct outcomes.

The Overview intentionally remains unavailable pending a dedicated authorized
aggregate. It must later compose the existing projections without duplicating
their business logic.

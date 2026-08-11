# Admin System Health projection

ADMIN-9 adds the read-only `/academy/admin/health` surface and the
authorized `GET /api/admin/v1/health` projection. It uses Admin contract version
2 and TEL-FOUNDATION's existing `academy_aggregate_operational_events_v2` seam.
It does not add a health event ledger, change the frozen telemetry migration, or
add a new migration.

## Authorization and privacy

The browser authorization state is presentation-only. Every health request is
authorized again by the server with `health:read`; the server then uses the
service-only aggregate RPC with its canonical internal `health:read`
assertion. Anonymous users, students, guardians, expired/revoked assignments,
and authorization lookup failures fail closed before telemetry access.

The browser receives an aggregate DTO, not event rows. Event metadata,
household/learner references, raw errors, provider bodies, and exception or SQL
messages are structurally absent. Incident and status explanations are bounded
codes with vetted UI mappings. Incident cards are bounded examples derived from
the latest timestamp in an aggregate group; aggregate counts, rather than those
examples, remain the complete health truth. Unknown codes render generic copy.

## Evidence bounds and time policy

- The source reads complete database aggregates for the requested bounded
  windows. Event volume above the former 500-row raw-read ceiling does not make
  otherwise valid health evidence unknown.
- Aggregate grouping is bounded at 4,096 groups and fails closed rather than
  truncating. Declared limits, returned group counts, represented-event totals,
  range, filters, retention metadata, canonical dimensions, and group contents
  are independently validated.
- Completeness is reported as `complete`, `partial`, `retention_limited`,
  `malformed`, `unavailable`, `timeout`, or `group_incomplete`. Every state other
  than `complete` forces health to `unknown` except an authoritative disabled
  gate, which remains `disabled`.
- Primary health evaluation is always the last rolling hour. UI history windows
  are Last hour, Today (UTC), rolling 24 hours, and rolling 7 days.
- Failure trend compares the selected history window with the immediately
  preceding equal-duration window. It is `unknown` when evidence is empty,
  invalid, or unavailable.
- Evidence is `current` only when its newest observation is at most 15 minutes
  old. Older evidence is `stale`; absence is `no_evidence`.
- Observation time comes from trusted event timestamps. Projection generation
  time is displayed separately and is never a health observation.
- Every health window is at most 7 days, below the shortest 30-day operational
  retention. The TEL-FOUNDATION aggregate's explicit retention completeness is
  required before ADMIN-9 will use the counts.
- No raw telemetry row API is used by the health projection.

## Deterministic thresholds

Thresholds live in `SYSTEM_HEALTH_THRESHOLDS` in
`src/admin/systemHealth.ts` and are not configurable from the browser.

| Objective | R1 policy |
| --- | --- |
| Minimum eligible events for rates/health | 5 |
| P50 minimum duration samples | 3 |
| P95 minimum duration samples | 20 |
| Fresh evidence maximum age | 15 minutes |
| Degraded core failures | at least 2 and at least 20% |
| Unavailable core failures | at least 3 and at least 60% |
| Degraded timeouts | at least 2 and at least 10% |
| Degraded provider errors | at least 2 and at least 10% |
| Degraded fallbacks | at least 3 and at least 30% |
| Degraded P95 latency | at least 5,000 ms |

Rates use eligible operational outcomes. Expected request rejection and
`safety_stop` are excluded from the rate denominator: ordinary authentication,
entitlement, policy, input, quota, and disabled-gate rejection is not an
infrastructure failure. Timeouts, provider errors, and validation errors are
core failures. Fallbacks are a quality-degradation signal.

TEL-FOUNDATION returns nearest-rank P50 and P95 evidence for every complete
group. ADMIN-9 sums group counts exactly for weighted result rates and uses the
worst applicable group percentile as a conservative latency signal; it does not
average or claim that group percentiles form an exact population percentile.
The UI labels this value as worst grouped latency. A latency value remains null
until the represented duration count meets its sample minimum.

## Health and safety semantics

Precedence for an engine is:

1. an exact-default-off trusted server gate is `disabled`;
2. incomplete, missing, stale, or insufficient evidence is `unknown`;
3. the unavailable threshold is `unavailable`;
4. a declared failure, timeout, provider-error, fallback, or P95 objective
   breach is `degraded`;
5. only sufficient fresh evidence meeting every objective is `healthy`.

Study, TTS, and the AI gateway use their existing server feature gates as
authoritative disabled evidence. No event is allowed to grant disabled status.
A functioning safety stop is counted and explained but is not an
infrastructure failure. Safety-only evidence is insufficient to call an engine
healthy.

Overall Academy health uses enabled critical engines (`tutor`, `study`,
`assessment`, `curriculum`, `gateway`, and `sync`). A critical unavailable
engine makes overall health unavailable. A critical degradation or unavailable
optional engine makes it degraded. Unknown critical evidence keeps overall
health unknown. Disabled engines are excluded; they never become green.

Service summaries are derived only where canonical telemetry can be mapped to
Admin API authorization operations, persistence, Anthropic, ElevenLabs/TTS,
sync, or curriculum reads. A service with no matching evidence is `unknown`.

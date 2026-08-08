# Engine, result, and health contract

## Canonical engine identifiers

The version 2 identifiers are unchanged and exactly:

| ID | Boundary |
| --- | --- |
| `tutor` | Question-scoped Tutor behavior |
| `study` | Study session/orchestration behavior |
| `assessment` | Assessment delivery/evaluation operations |
| `curriculum` | Versioned curriculum loading/validation |
| `jarvis` | Bounded school-day assistant behavior |
| `tts` | Text-to-speech synthesis |
| `gateway` | Shared provider/auth/quota gateway infrastructure |
| `sync` | Household sync and durable persistence coordination |

Identifiers are lower-case storage/API values. Display labels are a UI concern.
An implementation may not invent aliases such as `ai`, `voice`, or `study_engine`
in shared records. A new identifier requires a contract revision.

## Operational result states

| Result | Meaning |
| --- | --- |
| `success` | The requested operation completed through its intended path. |
| `fallback` | A documented safe fallback completed instead of the intended path. |
| `rejected` | Policy, authorization, entitlement, quota, disabled gate, or state precondition rejected the operation before successful execution. |
| `timeout` | A bounded deadline expired before a reliable result was known. |
| `provider_error` | An external/internal provider returned failure or malformed output. |
| `validation_error` | Input, output, contract, revision, or integrity validation failed. |
| `safety_stop` | Safety policy stopped the learner operation; this is never collapsed into a generic failure. |

Store a bounded `reason_code` when more detail is needed. Do not put exception
messages or learner content in metadata.

## Health states

| State | Meaning |
| --- | --- |
| `healthy` | Enabled, fresh evidence exists, dependencies are usable, and the measured window meets its declared objective. |
| `degraded` | Serving safely, but fallbacks, elevated errors/latency, partial dependency loss, incomplete telemetry, or recovery pressure materially reduces quality. |
| `unavailable` | Enabled but unable to complete the engine's authorized core operation safely. |
| `disabled` | Deliberately off through an approved server/deployment configuration. This is not an error. |
| `unknown` | Evidence is absent, stale, contradictory, or inaccessible. Unknown must not be rendered as healthy or as zero failures. |

Each health observation includes engine, state, `observedAt`, window start/end,
safe reason codes, and the app/engine version. Server-side aggregation owns the
calculation; the UI only renders the supplied state.

Precedence for one engine/window is: an explicit approved disabled state is
`disabled`; otherwise inability to serve safely is `unavailable`; otherwise a
material objective/dependency failure is `degraded`; otherwise current evidence
meeting objectives is `healthy`; without adequate current evidence it is
`unknown`. A safety stop is an operational result, not proof that the safety
engine is unhealthy.

Overall Academy health is the server-computed worst relevant enabled dependency,
with documented dependency mapping. Disabled optional engines do not degrade
overall health. Unknown critical dependencies make overall health unknown unless
another dependency is already unavailable.

## Existing-state mapping

- Exact-default-off feature flags map to `disabled` when authoritatively off.
- Gateway `upstream_timeout` maps to result `timeout`; provider failure maps to
  `provider_error`; authentication/entitlement/quota/policy denials map to
  `rejected` with safe reason codes.
- Sync conflict, provenance mismatch, or required parent review maps to a safe
  non-success result and usually `degraded`; inability to load/save the verified
  state may be `unavailable`. The source recovery state remains authoritative.
- Persistence `temporarily-unavailable`, revision conflict, idempotency collision,
  and integrity failure remain distinct safe reason codes beneath the canonical
  result.
- Safety history `incomplete`/`unavailable` maps to `unknown` or `degraded`, never
  to a fabricated zero.

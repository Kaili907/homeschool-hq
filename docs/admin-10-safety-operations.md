# ADMIN-10 read-only Safety Operations

This card adds an isolated, read-only Safety Operations surface for later
composition into the ADMIN-5 console. It does not mount a route, read hosted
data, change a Study safety state, or grant authority.

## Authoritative evidence boundary

The UI consumes a versioned, bounded projection through
`AdminSafetyOperationsReadPort`. The future server adapter must assemble that
projection from existing evidence; this card does not create another safety
ledger or telemetry store.

| Read projection | Existing evidence to reuse | Important limitation |
|---|---|---|
| Study safety stops | Study safety classifications and the existing durable/minimized safety-stop evidence; `StudyLocalSafetyStopsPanel` and `localStopLedger` define the established failure/capture vocabulary | Device-local records are best-effort and cannot be treated as a complete centralized record or as proof of resolution |
| Adult review | Existing adult-review proposal, recipient-resolution, job, attempt, receipt, and lifecycle states | A proposal is not delivery; delivery requires verified attempt-bound receipt evidence |
| Fail-closed and rejection events | Existing `StudySafetyMonitoringEventV1` names plus the Study gateway/client failure modes | Arbitrary exception bodies and provider results are not part of the projection |
| ADMIN-2 operational enrichment | None in this card | Always represented as `future-unavailable`; it is never synthesized or persisted here |

Each count has an independent `available` or `unavailable` state. An unavailable
source therefore cannot become a false zero. A legitimate zero is displayed
only when the authorized projection explicitly supplies `available: 0`.

## Authorization seam

`AdminSafetyReadAuthorization` accepts only a canonical `safety:read` grant with
an authorization evidence reference and expiry. The read port is not invoked
while authorization is resolving or denied, and the component refuses to render
an already-supplied snapshot without that grant. Household guardian membership
is deliberately absent from the authority contract and is not accepted as
Admin authorization.

ADMIN-1 integration should replace the caller-side grant construction with its
canonical authorization result. Until that correction lands, production
composition must leave this surface behind the unresolved authorization state.

## Data minimization

The read model has no fields for Tutor/Study conversation, student audio,
journal text, emotional labels, diagnostic inference, provider bodies,
credentials, or backend exception text. Runtime projection also copies only
known bounded fields. Unknown reason codes become
`unknown-safety-condition` with fixed generic copy instead of rendering the
input value.

## ADMIN-5 integration

ADMIN-5 commit `44e289bd1614f9d49b59e263816ed9fb77e973ce` already defines the
`Safety` navigation destination and the `safety:read` vocabulary. During
integration, render `AdminSafetyOperations` as that destination and supply only:

1. the canonical ADMIN-1 safety-read authorization result; and
2. the read state returned from a trusted server adapter implementing
   `AdminSafetyOperationsReadPort`.

The surface exposes read-only state/category/engine filtering and in-page event
drilldown. It intentionally contains no clear, override, resume, acknowledge,
keep-paused, or resolution controls.

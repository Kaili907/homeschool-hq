# ADMIN-10 read-only Safety Operations

The Safety Operations surface is connected to an authorized server projection.
It remains read-only and does not change Study safety state or grant authority.

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
| ADMIN-2 operational evidence | Canonical operational events whose result is exactly `safety_stop` | `provider_error`, `timeout`, `fallback`, and generic `rejected` results are never adapted as safety events |
| Study safety monitoring | Structured, minimized monitoring events from the established allowlist | Raw attributes and arbitrary monitoring payloads are never projected |

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

The browser authorization state is presentation-only. The
`/api/admin/v1/safety-operations` endpoint independently verifies the bearer and
current ADMIN-1 assignment, then requires `safety:read` before its dedicated
service-only adapter can invoke the narrow database projection.

## Data minimization

The read model has no fields for Tutor/Study conversation, student audio,
journal text, emotional labels, diagnostic inference, provider bodies,
credentials, or backend exception text. Runtime projection also copies only
known bounded fields. Unknown reason codes become
`unknown-safety-condition` with fixed generic copy instead of rendering the
input value.

## Server projection and bounds

`academy_admin_read_safety_operations_v1` reads existing operational, adult
review, and monitoring evidence without creating another ledger. It returns
independent source availability, legitimate zero counts, canonical safety-stop
count, open/resolved adult-review states, fail-closed/rejection counts, and a
bounded event page. Reads are capped at 100 browser-visible events and use a
deterministic occurred-time/event-reference cursor. Optional learner scope is
accepted only with its matching household scope.

The route supplies the ADMIN-10 component only the advisory ADMIN-1 presentation
state and the data-minimized server DTO. Service-role credentials remain inside
the server adapter.

The surface exposes read-only state/category/engine filtering and in-page event
drilldown. It intentionally contains no clear, override, resume, acknowledge,
keep-paused, or resolution controls.

# W3-B1 Commercial Operation Integrity Repair

This repair closes three commercial-operation execution defects without changing
Study authority, routing eligibility, retry count, or reviewed static fallback
policy.

## Curriculum authority

Accepted curriculum metadata now carries the trusted package reference and
release digest. Before routing, the commercial invocation is reconciled against
the admitted decision and trusted metadata for release, package, version,
digest, subject, course, unit, and lesson. The top-level Study subject must be
the canonical `subject:<admitted-subject>` reference.

The provider request is projected from the admitted curriculum decision, not
from an unreconciled top-level caller value.

## Deadline authority

Commercial execution now requires an injected monotonic clock. Every transport
call receives a provider-neutral execution context containing the immutable
reservation reference, absolute operation deadline, bounded attempt deadline,
attempt timeout, and remaining operation time.

The orchestrator measures each physical attempt and also treats an excessive
provider-reported latency as late. A structurally valid late success is converted
to timeout failure and can never become an advisory. Failover is dispatched only
when its timeout, deterministic reserve, and required backoff fit inside the
remaining end-to-end operation deadline.

## Per-attempt settlement

Every determinate physical execution supplies a closed usage receipt binding:

- logical operation;
- physical attempt;
- reservation;
- route;
- attempt index and role;
- immutable reserved IntegerMicros;
- actual IntegerMicros.

Each receipt is reconciled against its own reserved attempt before advisory
acceptance. Aggregate settlement consumes only reconciled receipts plus the full
reserve of any indeterminate timeout. Unused primary or failover reserve cannot
compensate for an overrun on the other attempt. All monetary arithmetic remains
canonical decimal-string `BigInt` arithmetic.

## Permanent gates

`CURRICULUM_TUTOR_ADMISSION`, `INTEGER_MICROS_ATTEMPT_BUDGET`, and
`END_TO_END_DEADLINE_BOUNDED_FAILOVER` now derive their evidence from executed
attack probes for foreign digests/subjects, individually over-reserved attempts,
reported late success, measured late success, and insufficient measured
failover deadline.

The mutation-proof script and serialized/release artifacts were not modified.

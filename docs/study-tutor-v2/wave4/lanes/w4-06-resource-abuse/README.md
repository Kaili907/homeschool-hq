# W4-06 commercial resource-abuse certification

Status: `W4_RESOURCE_ABUSE_BLOCKER_FOUND`

This lane stress-tests the provider-independent Wave 3 routing, budget,
deadline, settlement, and commercial orchestration boundaries. It makes no
network request and imports no vendor adapter. The only execution seam is the
in-memory `ScriptedCommercialTransport`; its call count is evidence about what
the orchestrator would authorize, not a live provider call.

The bounded portions behave deterministically for canonical money, safe
millisecond arithmetic, context ceilings, catalog ties and duplicates, and
attempt expansion. Two non-compensable resource-abuse blockers remain.

## Blockers

### RA-01: unbounded provider-policy requirement work

`createEligibleRouteCatalog` caps provider and model profiles at 64, but it
maps `providerPolicyRequirements` without first proving that it is an array of
bounded cardinality. The commercial orchestrator also calls `.some` on this
list before catalog construction. The detector supplies 4,096 unique entries;
all are traversed and mapped, and the catalog is accepted.

Impact: caller-controlled cardinality can produce unbounded latency and a
proportional `Map` allocation before the otherwise bounded provider/model work.
The detector separately proves that a 4,096-entry nested
`allowedRetentionClasses` list is traversed and accepted.

Required convergence repair:

- validate the complete routing context before any traversal;
- cap policy requirements at 64 and reject cap + 1 before `.some`, `.map`, or
  `Map` construction;
- bound and deduplicate nested policy collections; and
- keep the catalog build at no more than 64 policy evaluations and 4,096
  provider/model comparisons.

### RA-02: duplicate reservation replay

`reserveExecutionBudget` returns a pure snapshot and
`executeCommercialTutorInvocation` has no durable atomic claim for
`reservationRef`. Repeating the same logical-operation, reservation, route
plan, and physical-attempt references in a second invocation authorizes a
second transport execution. The detector executes the identical reservation
twice and observes one authorized dispatch from each invocation.

Impact: the two-attempt bound applies only to one function invocation. Replay
can expand total attempts and reserved cost without a deterministic
cross-invocation ceiling.

Required convergence repair: atomically claim or load a durable reservation
before transport execution, keyed by the complete logical-operation and
attempt identity. A replay must return the stored terminal result or stop with
zero new provider calls. The claim must work across processes; an in-memory
set is not sufficient.

## Proven per-invocation upper bounds

| Work or allocation | Bound | Basis |
| --- | ---: | --- |
| Provider profiles | 64 | catalog input guard |
| Model profiles | 64 | catalog input guard |
| Eligible catalog entries | 64 | unique models, each bound to one provider |
| Catalog provider/model comparisons | 4,096 | 64 × 64 nested scan |
| Availability comparisons during routing | 4,096 | at most 64 candidates × 64 states |
| Candidate sort | 64 entries | deterministic cost, latency, then identity order |
| Planned physical attempts | 2 | closed schemas and contiguous roles |
| Transport executions | 2 | reservation loop over at most two attempts |
| Receipts and telemetry events | 2 each | one per physical attempt |
| Money representation | 19 digits | canonical signed-int64 maximum |

These are not system-wide bounds until RA-01 and RA-02 are repaired. In
particular, policy-list traversal and repeated invocations are currently
unbounded.

The executable evidence and machine-readable result are in
`adaptive-tutor/adversarial/v4/resource-abuse/`.

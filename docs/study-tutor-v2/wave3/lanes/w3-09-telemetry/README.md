# W3-09 minimized commercial telemetry

`projectTutorCommercialTelemetry` emits a closed commercial-operations event
from an execution measurement plus a canonical reserved-attempt lineage. The
execution result cannot declare provider, model, route, policy, or reservation
identity; those fields are copied from the W3-01/W3-02 snapshot.

Each event correlates:

- `eventRef`, `logicalOperationRef`, `physicalAttemptRef`, `reservationRef`, and
  `routeRef`;
- provider/model alias, immutable model revision, and configuration digest;
- capability-profile revision/digest and provider-policy revision/evidence;
- attempt index/role, latency, exact cost, fallback class, and outcome.

Cost is the same bounded canonical decimal-string micros representation used by
W3-02. Values beyond `Number.MAX_SAFE_INTEGER` remain exact; JS-number money,
negative/decimal/non-canonical strings, and signed-64-bit overflow are rejected.
Token counters and latency remain safe non-negative integer numbers.

The projector verifies that the canonical attempt exactly matches a physical
attempt in the supplied reservation and that the logical-operation references
agree. It reads only own allowlisted execution properties and never invokes
accessors. Prompts, responses, learner prose, transcripts, identity, diagnoses,
credentials, and arbitrary provider failure prose cannot cross the boundary.

Every event fixes `authorityScope = commercial-operations-only`,
`instructionalUseAllowed = false`, `studyAuthority = false`, and
`studyMutationAllowed = false`.

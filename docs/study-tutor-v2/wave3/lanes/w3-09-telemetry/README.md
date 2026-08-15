# W3-09 — Minimized Tutor usage and cost telemetry

## Scope

This lane defines provider-independent commercial operations evidence. It has
no database integration, sink, retention mechanism, Admin UI, or provider SDK
dependency. `projectTutorCommercialTelemetry` accepts an unknown execution
result and emits only the closed `TutorCommercialTelemetryEvent` allowlist.

## Units and overflow

Token counts, latency, and cost are non-negative JavaScript safe integers.
Latency uses integer milliseconds (`latencyMs`) and cost uses integer micros
(`costMicros`). The projector does not round, clamp, or silently replace an
invalid measurement. A negative, fractional, non-finite, non-number, or unsafe
integer measurement rejects the projection with `INVALID_NUMERIC_METRIC`.

## Data minimization

The event contains only:

- opaque event, provider, model, policy revision, and config revision refs;
- bounded action, route, cache, and fallback classes;
- input/output token counts, latency milliseconds, and cost micros;
- bounded success/failure reason codes; and
- literal operational-only authority markers.

The projector does not enumerate the input. It reads only own data properties
on the allowlist and does not invoke accessors. Unknown class values receive a
bounded generic classification. Unknown failure strings become
`UNKNOWN_FAILURE`; they are never copied.

The contract has no field for learner answers, Tutor transcripts, prompts,
provider response prose, learner names, diagnoses, emotions, personality data,
or credentials. Its schema rejects additional fields.

## Authority boundary

This event is billing, reliability, routing, and capacity evidence only. It is
not instructional evidence and cannot select an action, alter a prompt, infer a
learner state, score work, establish mastery, change progress, or authorize a
Study mutation. Every emitted event fixes:

```text
authorityScope = commercial-operations-only
instructionalUseAllowed = false
studyAuthority = false
studyMutationAllowed = false
```

Consumers must not join this telemetry back into Tutor instruction or Study
decision paths. Study remains the sole authority for official state.

## Validation

The co-located tests cover exact projection, forbidden-field redaction,
accessor non-execution, bounded failure normalization, invalid operational
references, schema closure, authority literals, numeric overflow, invalid
numeric forms, and maximum-safe-integer preservation.

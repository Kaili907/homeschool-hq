# W2-B11 Parent Why scope and copy contract repair

## Repaired boundary

The Parent Hub Why boundary accepts only a Study-produced recommendation that
is bound twice to the same opaque scope tuple:

- household;
- authorized and selected learner;
- session;
- instructional context; and
- current opportunity.

The request carries the active tuple in `scope`. Recommendation and policy
provenance carry the tuple again in `recommendation.provenance.scope`. The
runtime rejects the complete request with
`PARENT_EXPLANATION_SCOPE_MISMATCH` unless the household, learner, session,
instructional context, and opportunity provenance all match the active scope.
The recommendation's direct learner reference must also match both the
authorized and selected learner references.

Accepted results retain the recommendation reference, recommendation event,
policy reference, production time, and the complete opaque scope tuple. A
downstream Parent Hub consumer can therefore compare a serialized result with
its active household, learner, session, context, and opportunity and reject
cross-child or stale reuse. No raw learner or household data is present.

## Closed reviewed copy

`ParentExplanationSchema` is an eight-branch union. Each branch binds one
closed `reasonCode` to exact reviewed literals for `title`, `explanation`, and
`disclaimer`. Bounded arbitrary strings are no longer schema-valid.

Changing a valid result's title or explanation to a transcript, learner answer,
credential, diagnosis, personality judgment, or private note makes the result
invalid even if the replacement string is short. Copy from one reviewed reason
cannot be paired with another reason code.

The request remains exact-field and reference-only. It accepts no transcript,
answer, answer key, credential, diagnosis, personality label, private note, raw
evidence, or provider prose.

## Public runtime schemas

The package entrypoint
`adaptive-tutor/study-engine/tutor-v2/parent-explanations/index.ts` explicitly
exports:

- `ParentExplanationRequestSchema`, with `$id`
  `TutorV2ParentExplanationRequest`;
- `ParentExplanationResultSchema`, with `$id`
  `TutorV2ParentExplanationResult`; and
- `ParentExplanationSchema`, the closed accepted-value schema with `$id`
  `TutorV2ParentExplanation`.

R4 convergence can import the request and result schemas directly to generate
standalone serialized artifacts. This repair lane does not create or update
global schema artifacts.

## Authority

The result only explains an existing Study recommendation. Its exact reviewed
disclaimer says it does not make or change a learning decision. Exact-field
result branches reject authority, Study mutation, and mastery-declaration
fields. The implementation performs no Study mutation and declares no mastery.

## Required R4 convergence

The existing Wave 2 adaptive producer predates this repair and does not yet
submit the runtime-required household, session, instructional-context, or
current-opportunity bindings. It is intentionally left unchanged because that
producer is outside this lane's ownership. Until R4 populates the fields from
trusted Study authority, its Parent Why request fails closed rather than
emitting an unbound explanation.

R4 must populate both copies of the tuple from trusted Study state and preserve
the exact equality checks. Tutor/provider-originated claims must not supply the
active scope or recommendation provenance.

`EXPECTED_R4_CONVERGENCE_PARENT_WHY_SCOPE_BINDING_UPDATE_REQUIRED`

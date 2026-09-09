# W2-03 — Academic misconception signals

## Scope and authority

This lane provides a deterministic registry and evidence matcher for possible
instructional misconceptions. It is an academic teaching aid only.

The matcher does not determine that a learner has a misconception, condition,
trait, emotional state, behavior pattern, diagnosis, or authoritative mastery
state. It cannot create a durable learner classification. Study remains the
authority for evidence admission, instructional sequencing, learner state, and
any persistence.

## Registry contract

Each closed registry entry binds:

- version `1`;
- one opaque `misconceptionRef`;
- one opaque `conceptRef`;
- one bounded academic misconception code;
- one Study review approval reference;
- reviewed instructional response references;
- optional prerequisite concept references; and
- evidence thresholds, maximum evidence age, and accepted structured source
  kinds.

Codes are unique across the registry. Registering the same academic code for a
second concept is rejected. Unknown codes and known codes paired with the wrong
concept fail closed.

The schema requires at least two supporting evidence items and at least two
distinct academic opportunities. A registry cannot configure a single wrong
response as enough evidence.

## Evidence boundary

The matcher accepts only exact-schema
`study-approved-structured-academic-evidence`. Each item contains opaque scope
and evidence references, an academic source kind, a bounded academic finding,
an observation timestamp, and a Study approval reference.

It has no field for:

- raw learner transcripts or answers;
- raw provider prose or prompts;
- unrestricted notes;
- personality, motivation, behavior, or emotional labels;
- psychological or diagnostic labels or inference; or
- cross-learner data.

Unknown fields fail exact validation. The entire match fails closed if any
otherwise valid evidence belongs to another learner, instructional context,
concept, or misconception code; contaminated evidence is never partially
accepted.

`evaluatedAt` is explicit input. The matcher has no wall-clock dependency, so a
replay evaluates evidence age against the same timestamp and returns the same
result.

## Matching behavior

The result status is exactly one of:

- `no-signal` — valid eligible evidence contains no supporting academic signal;
- `insufficient-evidence` — the request fails closed or valid support does not
  meet the entry thresholds;
- `possible-misconception` — enough current, eligible, distinct structured
  evidence supports a possible instructional signal; or
- `conflicting-evidence` — eligible support conflicts with contradiction, or an
  evidence identity is reused with changed content.

Exact duplicate evidence identities are collapsed and reported; they cannot
increase supporting counts. Multiple evidence identities from one opportunity
also cannot satisfy the distinct-opportunity threshold.

Only `possible-misconception` returns the registry's reviewed instructional
response and prerequisite references. Every result explicitly states:

- `possibleInstructionalSignalOnly: true`;
- `authoritativeDiagnosis: false`;
- `authoritativeMasteryState: false`; and
- `durableLearnerClassificationAllowed: false`.

The result contains aggregate counts and bounded reason codes, not the submitted
evidence records or learner/provider prose.

## Integration boundary

The lane is exposed from
`adaptive-tutor/core/v2/misconceptions/index.ts`. It intentionally does not add
a Study mutation, persistence adapter, provider call, inference service, or
production route. A later convergence lane may expose the module from a wider
barrel after ownership review.

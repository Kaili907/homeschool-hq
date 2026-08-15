# W2-06 — Assistance-sensitive mastery evidence

## Authority boundary

Tutor V2 produces advisory evidence summaries only. It cannot declare official
mastery, change progress, set a grade or working level, or write Study state.
Every output fixes these fields:

```text
studyDecisionRequired = true
studyMutationAllowed = false
authoritative = false
```

Study is the only component that may interpret the recommendation under its
official policy and perform a mutation.

## Accepted data

The exact input contract accepts a Study envelope with a learner scope, concept
scope, deterministic evaluation time, and up to 100 structured evidence items.
Each item contains only an opaque evidence reference, Study issuer marker,
scopes, structured outcome, assistance level, recency, spacing, and timestamp.

The contract has no field for an answer key, correct answer, answer index, raw
learner response, transcript, official mastery, progress, grade, or working
level. Unknown fields reject the whole batch.

## Deterministic factors

The summary reports unique sample and outcome counts, independent demonstration
count, assistance profile, current/stale counts, spaced count, exact replay
count, conflicting replay count, and stable reason codes. Exact reference
replays are deduplicated. Divergent versions of the same reference are excluded
and force `conflicting-evidence`.

Assistance has ordered evidentiary weight:

```text
independent > light-hint > guided > reteach-required
```

Guided performance can be `emerging-evidence`, but never satisfies the
independent evidence threshold. Reteach-only success remains
`insufficient-evidence`. Supported evidence requires repeated current
independent demonstrations plus Study-marked spacing on independent evidence.

## Fail-closed scope behavior

Any cross-learner, cross-concept, future-dated, or schema-invalid item rejects
the batch. Tutor does not silently filter foreign evidence and does not emit
scoped counts from a contaminated batch.

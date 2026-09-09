# Tutor V2 mastery evidence

This module summarizes only exact, Study-issued structured outcome metadata.
Every item carries `sessionRef`, `instructionalContextRef`, and
`opportunityRef`. The input also carries Study's trusted current session,
instructional context, opportunity, and actual assistance classification. It
does not receive an answer key, a correct answer or index, learner response
content, or a transcript.

The output is a deterministic recommendation plus bounded evidence counts.
`studyDecisionRequired` is always `true`, `studyMutationAllowed` is always
`false`, and `authoritative` is always `false`. Study remains the sole owner of
official mastery, progress, grade, and working-level decisions.

## Recommendation policy

- `insufficient-evidence`: no usable/current conclusive evidence, failure-only
  evidence, or success only after reteaching.
- `emerging-evidence`: current demonstrated evidence that is limited to one
  independent sample or assisted performance.
- `supported-evidence`: at least two current independent demonstrations, with
  at least one of those Study-marked as spaced, and no contradictory current
  result.
- `conflicting-evidence`: current demonstrated and current not-demonstrated
  outcomes coexist, or one evidence reference is replayed with conflicting
  metadata.

Recommendation contradictions are computed only from conclusive evidence that
Study marks `current`. Stale evidence remains in the bounded counts and can add
`stale-contradiction-observed`, but it cannot override sufficient current
independent evidence. A stale demonstration likewise cannot mask a current
failure-only recommendation.

## Opportunity and assistance binding

Assistance severity uses one canonical order:

```text
independent < light-hint < guided < reteach-required
```

When an item's `opportunityRef` is the current opportunity, its learner,
concept, session, and instructional context must match the current Study
binding. Its claimed assistance must be equal to or more assisted than Study's
trusted actual level. A less-assisted claim rejects the evaluation with
`assistance-binding-conflict`; it is never silently counted at the claimed
level.

For every other opportunity, an item with both the current `sessionRef` and
`recency: "current"` must use Study's current `instructionalContextRef`; a
mismatch rejects with `current-session-context-conflict`. An item from a prior
session may retain that session's older instructional context, including when
Study still classifies the evidence as current. A same-session item marked
stale may also retain its older context because it does not claim current
relevance. These conditions are based only on exact reference equality and are
independent of learner/concept equality.

Historical evidence may come from older sessions and instructional contexts.
It remains usable when the current opportunity is assisted, provided it stays
within the input learner and concept scope and uses a distinct opportunity.

Exact evidence-reference replays are counted once. Conflicting versions of one
evidence reference remain conflicting evidence. Distinct evidence references
that reuse one opportunity reject with `duplicate-opportunity-evidence`, so a
single attempt cannot inflate sample counts. Cross-learner, cross-concept,
current-opportunity cross-session/context, future-dated, and schema-invalid
batches fail closed without producing scoped counts.

## Type/runtime parity

The runtime schemas and their TypeScript projections require the same Study
provenance. Inputs require `currentSessionRef`,
`currentInstructionalContextRef`, `currentOpportunityRef`, and
`currentOpportunityAssistanceLevel`; every evidence item requires `sessionRef`,
`instructionalContextRef`, and `opportunityRef`. There is no optional
composition projection for these fields.

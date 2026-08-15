# Tutor V2 mastery evidence

This module summarizes only exact, Study-issued structured outcome metadata. It
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
  at least one of those Study-marked as spaced, and no contradictory result.
- `conflicting-evidence`: demonstrated and not-demonstrated outcomes coexist,
  or one evidence reference is replayed with conflicting metadata.

Exact replays are counted once. Cross-learner, cross-concept, future-dated, and
schema-invalid batches fail closed without producing scoped counts.

# W2-04 — Bounded adaptive hint ladder

## Outcome

This lane adds a deterministic, Study-bounded hint selector at
`adaptive-tutor/core/v2/hints`. It recommends only one of the canonical levels:

1. `none`
2. `nudge`
3. `concept-cue`
4. `guided-step`

There is no stronger hint level and no answer or solution level.

## Trusted input boundary

`selectBoundedHint` accepts an exact structured request containing:

- the Study hint ceiling and canonical assessment phase;
- the current context reference and previous assistance classification;
- attempt count and an optional structured misconception signal code;
- a Study-approved learner-stage hint profile;
- context-scoped intervention history;
- the distinct completed-review permission and optional privacy approval reference;
- Study-reviewed hint references and structured eligibility metadata.

Unknown fields, prose fields, invalid enum values, duplicate hint/intervention
references, and internally inconsistent history entries fail closed as
`INVALID_HINT_STATE`.

## Deterministic selection

The default attempt ladder is `none`, `nudge`, `concept-cue`, then
`guided-step`. A misconception signal can raise a post-attempt recommendation
to `concept-cue`. Same-context history can preserve a previously reached hint
floor. Study's ceiling is applied after those recommendations, so the selected
level can never exceed it.

The learner-stage profile bounds hint escalations between comprehension
rechecks. When its bound is reached, the selector returns `no-hint` with
`learner-stage-recheck-required`. Candidate metadata is selected by exact level,
misconception eligibility, and learner-stage eligibility. More specific
reviewed metadata wins, with `hintRef` lexical order as the stable tie-breaker.

The function uses no clock, randomness, provider, or mutable storage. Replaying
the same request produces the same result and does not mutate the request.

## Content and assessment boundary

The selector never accepts or returns learner-facing hint prose. A successful
recommendation contains only:

- `hintRef`;
- `reviewedContentRef`;
- `reviewRef`;
- canonical hint level;
- misconception and learner-stage eligibility codes/references.

Every result declares `unrestrictedProviderProseAllowed: false`. If reviewed
metadata for the selected level is unavailable, the selector returns `no-hint`
instead of generating content.

Wave 1 structural anti-answer remains authoritative. During
`active-graded-or-mastery-check`, the selector returns `no-hint` before any
attempt, history, ceiling, completed-review, or privacy permission can enable a
hint. A privacy approval never substitutes for completed-assessment review
permission and never overrides the active-assessment block.

## Assistance-sensitive evidence

The result carries one of the canonical assistance classifications:

| Selected or prior support | Classification |
| --- | --- |
| No support | `independent` |
| `nudge` or `concept-cue` | `light-hint` |
| `guided-step` or prior guided support | `guided` |
| Prior or recorded reteach | `reteach-required` |

Classification is the monotone maximum of previous assistance, same-context
history, and the newly selected hint. A learner completion event cannot reduce
`guided` to `independent`. Cross-context intervention entries are ignored for
both recommendation and evidence classification.

## Integration notes

Callers should import the lane surface from `core/v2/hints/index.js`. The
selector is a recommendation boundary, not authority to display content.
Study must still resolve the returned reviewed-content reference and apply its
authoritative action, safety, grounding, and anti-answer validation before any
learner-facing output.

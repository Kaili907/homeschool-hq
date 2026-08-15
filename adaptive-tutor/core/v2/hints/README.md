# Tutor v2 bounded hint selection

`selectBoundedHint` accepts only exact structured Study input and returns
reviewed hint metadata, never learner-facing prose authored by the selector.

The request is bound to opaque Study-issued learner, session, context, and
current-opportunity references. Every intervention-history entry repeats the
learner/session/context scope and identifies its source interaction,
opportunity, intervention, and ordinal. Earlier interactions and opportunities
in that exact scope are valid input, but only the Study-bound current
opportunity can affect current hint escalation or assistance. A
`learner-completion` entry closes that opportunity's escalation segment; later
entries for the same opportunity begin from the Study-provided current
assistance state. Any cross-learner, cross-session, or
cross-context entry rejects the whole request as `INVALID_HINT_STATE`;
contaminated entries are never filtered or ignored.

Intervention references and source-interaction references must each be unique.
This prevents duplicate or contradictory replay records from raising the hint
floor, assistance classification, or escalation count. History ordering remains
deterministic by explicit ordinal with intervention reference as the tie-breaker.
Comprehension rechecks reset the escalation count only within the active current
opportunity segment. Study hint ceilings and the active-assessment structural
block remain authoritative after opportunity scoping.

Completed-assessment review uses a separate closed authorization boundary. A
naked boolean is not accepted. The denied variant contains only
`status: "not-authorized"`; the authorized variant is versioned, declares
Study as issuer, and carries an opaque permission reference plus learner,
session, instructional-context, opportunity, review-event, review-policy, and
privacy-approval bindings. The selector compares every authorization binding
with the current Study request. A mismatch produces no completed-review hint,
while malformed, legacy, provider-shaped, or incomplete permissions reject the
request as `INVALID_HINT_STATE`.

`currentReviewEventRef`, `currentReviewPolicyRevisionRef`, and
`currentReviewPrivacyApprovalRef` are nullable for instruction, practice,
active assessment, and non-graded review. A completed assessment review
requires the current Study event and policy references, while its permission's
nullable `privacyApprovalRef` must exactly equal the distinct current Study
privacy binding. Null matches only null; opaque references are never normalized
or compared by prefix. Ordinary instruction, practice, and non-graded review do
not require completed-review permission. Active graded or mastery assessment
remains structurally blocked even when an otherwise exact completed-review
permission is present.

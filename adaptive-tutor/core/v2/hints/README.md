# Tutor v2 bounded hint selection

`selectBoundedHint` accepts only exact structured Study input and returns
reviewed hint metadata, never learner-facing prose authored by the selector.

The request is bound to opaque Study-issued learner, session, context, and
current-opportunity references. Every intervention-history entry repeats the
learner/session/context scope and identifies its source interaction,
opportunity, intervention, and ordinal. Earlier interactions and opportunities
in that exact scope are valid. Any cross-learner, cross-session, or
cross-context entry rejects the whole request as `INVALID_HINT_STATE`;
contaminated entries are never filtered or ignored.

Intervention references and source-interaction references must each be unique.
This prevents duplicate or contradictory replay records from raising the hint
floor, assistance classification, or escalation count. History ordering remains
deterministic by explicit ordinal with intervention reference as the tie-breaker.

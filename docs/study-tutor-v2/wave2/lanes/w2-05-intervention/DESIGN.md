# W2-05 deterministic intervention ladder

## Outcome

W2-05 adds a bounded, deterministic selector for the next safe Tutor
recommendation after learner difficulty. Tutor remains proposal-only and Study
continues to own authorization, safety, learner placement, assessment, mastery,
and durable state.

The implementation is in
`adaptive-tutor/core/v2/interventions/intervention-ladder.ts`. Its public lane
barrel is `adaptive-tutor/core/v2/interventions/index.ts`.

## Closed inputs

`InterventionLadderInputSchema` accepts exact structured data only:

- attempt count;
- bounded assistance history containing existing Tutor action kinds and a
  neutral observation outcome;
- misconception and prerequisite signals with opaque references;
- a Study-approved learner-stage intervention profile;
- elapsed instructional effort;
- current intervention count;
- a safety restriction;
- recent break-suggestion cooldown state;
- assessment phase; and
- Study `allowedActions`.

The learner-stage profile contains teaching-behavior limits, not grade, birth
date, identity, emotional state, psychological diagnosis, or official placement.
Malformed input, extra fields, duplicate allowed actions, or a history longer
than the authoritative count fail closed.

## State-to-action mapping

The ladder uses all required intervention states without expanding the closed
Tutor action set.

| Intervention state | Existing Tutor action kind | Meaning |
| --- | --- | --- |
| `continue` | `return-to-lesson` | Give Study control back for another bounded attempt. |
| `hint` | `hint` | Propose the next authorized hint. |
| `check-prerequisite` | `check-prerequisite` | Ask Study to route a prerequisite check. |
| `reteach` | `reteach` | Propose a bounded reteach path. |
| `suggest-break` | `suggest-break` | Offer an optional break. |
| `escalate` | `escalate` | Target `study-adult-review-policy`; delivery is never claimed. |
| `return-to-lesson` | `return-to-lesson` | Return after observed progress or protected assessment routing. |

`continue` is therefore a ladder state, not a new authoritative Tutor action
kind.

## Deterministic decision order

The selector is pure and uses no time source, random source, provider, storage,
or mutable global state. Decision precedence is:

1. If assistance history already ends in escalation, block with
   `ADULT_REVIEW_PENDING`.
2. If the effective cap has been reached, block with
   `INTERVENTION_LIMIT_REACHED`.
3. On a safety hold, recommend only `escalate` when Study authorized it;
   otherwise block with `STUDY_REVIEW_REQUIRED`.
4. In the final available intervention slot, recommend only terminal adult
   escalation; otherwise fail closed.
5. During an active graded/mastery check, select only `return-to-lesson`, an
   eligible optional break, or escalation. Hint and reteach are excluded by
   structure.
6. Observed progress returns to the lesson.
7. Prerequisite signals route to a bounded prerequisite check, then reteach,
   then escalation.
8. Persistent misconception signals route to bounded reteach, then escalation.
9. A first difficulty continues; repeated difficulty hints; hint exhaustion
   reteaches; exhausted reteach escalates.
10. Once elapsed effort and attempt thresholds are met, a break may be offered
    before further support. A Study-approved cooldown suppresses repetition.

At every step, candidates are intersected with Study `allowedActions`. The
ladder may choose the next safe authorized candidate, but it cannot authorize
one itself.

## Bounds and authority

The effective count cap is the lower of the Study-approved learner-stage cap
and the absolute implementation cap of 12. Escalation consumes the last
available slot and is terminal. Re-entry after a recorded escalation blocks,
and re-entry at the cap blocks, preventing an endless Tutor loop.

Every recommendation includes the following fixed declarations:

- `proposalOnly: true`;
- `tutorMayExecute: false`;
- `studyMutationAllowed: false`;
- `authoritativeDecision: false`; and
- `claimsEscalationDelivery: false`.

The result cannot clear safety, bypass a hold, certify guardian action, change a
working level or grade, or decide official mastery. It contains no learner-facing
prose, so the selector itself cannot emit shame language or an emotional or
psychological diagnosis. A downstream learner-facing realization remains
subject to the existing Tutor proposal, grounding, anti-answer, and Study
approval boundaries.

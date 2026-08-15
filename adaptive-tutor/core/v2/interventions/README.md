# Tutor v2 intervention ladder

`recommendNextIntervention` is a pure, deterministic, proposal-only selector.
Study supplies exact structured evidence, its allowed Tutor actions, and a
Study-approved learner-stage profile. The same input always produces the same
result; the selector has no clock, random source, network access, or storage.

The ladder states are `continue`, `hint`, `check-prerequisite`, `reteach`,
`suggest-break`, `escalate`, and `return-to-lesson`. `continue` is an internal
recommendation state and maps to the already-authorized `return-to-lesson`
Tutor action kind. The ladder creates no new authoritative Tutor action kind.

Study remains authoritative. A recommendation says which existing action kind
Tutor may propose next; it does not construct learner-facing teaching content,
execute an action, update the intervention count, change a working level or
grade, decide mastery, certify guardian action, clear safety, bypass a hold, or
claim that an escalation reached an adult.

## Priority and bounds

1. A prior escalation stops replay at `ADULT_REVIEW_PENDING`.
2. The effective intervention cap is the lower of the Study-approved profile
   cap and the absolute implementation cap of 12.
3. At the final available slot, the only recommendation is escalation to
   `study-adult-review-policy`; once the cap is reached, the ladder blocks.
4. A safety hold permits only escalation. If Study did not authorize that
   action, the ladder blocks instead of bypassing the hold.
5. An active graded/mastery check permits no hint or reteach recommendation.
6. Outside assessment, progress returns control to the lesson; prerequisite
   signals precede reteaching; persistent misconception signals take the
   bounded reteach path; early difficulty continues or hints; exhausted support
   escalates.
7. A break is always an optional suggestion. Elapsed effort and the approved
   profile can make it eligible, while a cooldown prevents repeated suggestions.

Every candidate is intersected with Study `allowedActions`. The selector skips
an unauthorized candidate only when another bounded safe candidate is
authorized. Otherwise it returns a blocked result. No learner-facing prose is
generated here, which keeps shame language and emotional or psychological
diagnosis outside this mechanism.

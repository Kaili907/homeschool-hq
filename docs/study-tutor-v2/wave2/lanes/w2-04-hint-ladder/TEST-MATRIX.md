# W2-04 validation matrix

The focused test suite is
`adaptive-tutor/core/v2/hints/hint-ladder.test.ts`.

| Required scenario | Covered behavior |
| --- | --- |
| no hint | Attempt zero returns `none` with no metadata. |
| nudge | Attempt one selects a reviewed `nudge`. |
| concept cue | Attempt two selects a reviewed `concept-cue`. |
| guided step | Attempt three and later select a reviewed `guided-step`. |
| ceiling none | Study ceiling `none` blocks all hints. |
| ceiling nudge | Stronger attempt recommendation is capped at `nudge`. |
| attempted ceiling escalation | Prior guided history cannot cross a `nudge` ceiling or erase guided evidence. |
| repeated attempts | The sequence remains within the four canonical levels. |
| misconception-driven recommendation | A structured signal raises the recommendation and selects specific reviewed metadata. |
| active assessment | Hinting is structurally blocked despite completed-review and privacy approvals. |
| completed review permission | Review hinting fails closed without the specific permission and proceeds with it. |
| assistance classification | All four canonical evidence classifications are preserved. |
| replay | Repeated evaluation is identical and does not mutate input. |
| malformed hint state | Invalid enum, extra prose, inconsistent history, and duplicate metadata fail closed. |
| cross-context history | Other-context guided/reteach history cannot affect the current context. |

Additional cases verify that guided completion remains guided, learner-stage
recheck cadence pauses escalation, absent reviewed metadata returns no hint, and
successful results contain references/metadata rather than prose. All result
variants are checked against the exact result schema.

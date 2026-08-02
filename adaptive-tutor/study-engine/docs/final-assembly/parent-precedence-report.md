# Parent precedence report

The final wrapper enforces DEC-012 and the accepted Session 8-R3 implementation:

1. Validate authorization, integrity, policy version, and required booleans.
2. Compose safety and required-accommodation limits.
3. Intersect authorized adult constraints.
4. Compute the feasible interval.
5. Select an eligible engine or grade-default candidate.
6. Clamp to the feasible interval.
7. Require manual review when the interval is empty or gates fail.
8. Retain provenance and every binding constraint.

`resolveParentDurationDecision` records safety limits, accommodation limits, parent hard limits, explicit override, engine recommendation, grade default, winning source, reason code, final effective value, manual-review state, and append-only decision history. Learner-facing language remains neutral and never blames a parent.

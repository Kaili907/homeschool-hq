# W2-B6 hint opportunity semantics repair

Date: 2026-08-15

- Session: `STUDY-TUTOR-V2-W2-B6`
- Starting SHA: `22c3734bd436c41ba8d24409dcaa146d35914e2f`
- Branch: `mac/tutor-v2-w2-hint-semantics-repair-r3`

## Root cause

The hint selector validated Study-issued opportunity provenance but reduced the
entire learner/session/context history into one permanent hint floor, one
recheck budget, and one assistance classification. A guided hint from a prior
opportunity therefore forced guided support on the first attempt of a new
opportunity, even when the prior opportunity ended with `learner-completion`.

## Repair

The selector now derives an active current-opportunity history segment from the
already-required `currentOpportunityRef`:

1. all history is still validated against the exact learner, session, and
   context scope and malformed or contaminated history still rejects;
2. current hint escalation considers only entries whose `opportunityRef`
   matches Study's `currentOpportunityRef`;
3. the latest `learner-completion` for that opportunity closes the prior
   escalation segment;
4. a comprehension recheck resets only the active current opportunity's
   escalation count; and
5. assistance begins at Study's `previousAssistanceLevel` and can only rise
   from active current-opportunity evidence or the selected hint.

Historical interactions and opportunities remain legitimate validated input,
but they cannot contaminate the active opportunity's hint floor, recheck
budget, or assistance. Unresolved guided assistance in the current opportunity
still establishes a guided floor and guided assistance classification.

## Required reproductions

| Scenario | Result |
| --- | --- |
| Prior guided hint, prior learner completion, new first attempt | Reviewed `nudge`; not guided |
| Unresolved guided hint in current opportunity | Reviewed `guided-step`; assistance `guided` |
| Learner completion closes current escalation segment | Next first-attempt recommendation resets to reviewed `nudge` |
| New opportunity with Study `reteach-required` baseline | Hint remains bounded to `nudge`; assistance remains `reteach-required` |
| Prior-opportunity comprehension recheck | Does not reset the current opportunity's recheck budget |
| Current-opportunity comprehension recheck | Resets the current opportunity's recheck budget |
| Legitimate prior interaction/opportunity | Accepted without current escalation contamination |
| Cross-learner, cross-session, or cross-context history | `INVALID_HINT_STATE` |
| Study hint ceiling | Remains authoritative |
| Active graded or mastery assessment | Still structurally blocks hints |

## Validation

- [VERIFIED] Strict Tutor V2 TypeScript compilation: PASS.
- [VERIFIED] Complete hint lane: 30/30 passed.
- [VERIFIED] Complete Wave 2 lane regression: 197/197 passed.
- [VERIFIED] Complete Tutor V2 convergence regression: 280/280 passed.
- [VERIFIED] Focused Wave 2 composition, schema, history-scope, and
  mastery-opportunity integration regression: 24/24 passed.
- [VERIFIED] Adaptive Tutor Core TypeScript compilation and regression: PASS;
  21/21 tests passed.
- [VERIFIED] `git diff --check`: PASS.

The worktree initially had no dependencies. Root `npm ci --ignore-scripts`
installed the pinned lockfile without changing dependency manifests or the
lockfile and reported three existing high-severity audit advisories. Dependency
remediation is outside this repair's ownership.

## Ownership and authority

Changes are confined to `adaptive-tutor/core/v2/hints/**` and this repair
record. The adaptive orchestrator is unchanged. The selector still returns
only reviewed hint metadata, the Study hint ceiling remains a hard upper bound,
and the active-assessment anti-answer block remains structurally prior to hint
selection.

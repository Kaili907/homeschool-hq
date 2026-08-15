# W2-B7 intervention-semantics repair validation

## Scope

- Branch: `mac/tutor-v2-w2-intervention-semantics-repair-r3`
- Starting SHA: `22c3734bd436c41ba8d24409dcaa146d35914e2f`
- Runtime ownership: `adaptive-tutor/core/v2/interventions/**`
- No adaptive orchestrator changes

## Repaired authority

`assistanceHistory` is the complete scoped ledger of previous interventions in
oldest-to-newest order. The ladder derives the current intervention count, the
last intervention, action totals, escalation state, and break cooldown from
that ledger.

The retained `interventionCount` and `recentBreakSuggestion` fields are strict
compatibility assertions only:

- `interventionCount` must equal `assistanceHistory.length`;
- a break inside cooldown requires `recentBreakSuggestion.status` to be
  `recent` with the exact history-derived count;
- no historical break, or a break outside cooldown, requires status `none`;
  and
- every contradiction returns `INVALID_INTERVENTION_INPUT` before an aggregate
  can affect selection.

History remains bound to the request learner, session, and instructional
context. Contaminated history is rejected as a whole rather than filtered.

## Required-case evidence

| Case | Expected result |
| --- | --- |
| Prior `suggest-break` inside cooldown | A second break is suppressed. |
| History-backed break paired with aggregate `none` inside cooldown | `INVALID_INTERVENTION_INPUT`. |
| Prior `suggest-break` outside cooldown | An optional break may become eligible again. |
| Foreign learner break history | `INVALID_INTERVENTION_INPUT`. |
| History longer than `interventionCount` | `INVALID_INTERVENTION_INPUT`. |
| Unbacked high `interventionCount` | `INVALID_INTERVENTION_INPUT`; escalation cannot be forced. |
| Latest history outcome is `progress-observed` | `return-to-lesson` remains eligible. |
| Approved intervention cap reached | `INTERVENTION_LIMIT_REACHED`. |
| Final backed slot before cap | Proposal-only Study adult-review escalation. |

The focused suite also retains Study `allowedActions`, safety-hold handling,
active-assessment restrictions, deterministic replay, maximum bounds, and
proposal-only declarations. Break recommendations remain optional, contain no
learner-facing prose, and introduce no punitive or shaming semantics.

## Validation commands

The clean worktree did not contain installed packages. Validation used the
same repository dependency versions available in an adjacent worktree without
changing source or dependency state.

```text
TypeScript no-emit check
PASS

Compiled intervention ladder test
25 passed, 0 failed

Compiled Tutor V2 convergence suite (from the required `adaptive-tutor` cwd)
280 passed, 0 failed
```

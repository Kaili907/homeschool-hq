# W2-B2 history-scope repair validation

Date: 2026-08-14

- Session: `STUDY-TUTOR-V2-W2-B2`
- Starting SHA: `8d618502a16a3d4d169143b539286a3b6fb5b925`
- Branch: `mac/tutor-v2-w2-history-scope-repair-r1`
- Final repair SHA: the commit containing this record

## Repair

Hint selection now requires opaque `learnerScopeRef`, `sessionRef`,
`contextRef`, and `currentOpportunityRef` request bindings. Each hint-history
entry repeats the learner/session/context scope and adds opaque
`sourceInteractionRef` and `opportunityRef` provenance while retaining its
intervention reference, ordinal, kind, hint level, and assistance level.

Intervention selection now requires opaque `learnerScopeRef`, `sessionRef`,
`instructionalContextRef`, `currentOpportunityRef`, and `interactionRef`
bindings. Each assistance-history entry repeats the learner/session/context
scope and adds opaque `sourceInteractionRef` and `opportunityRef` provenance.

Both lanes reject the whole request before history contributes to a
recommendation when learner, session, or context scope differs. Legitimate
earlier interactions and opportunities in the exact request scope remain
eligible. Hint intervention references and both lanes' source-interaction
references must be unique, preventing duplicate or contradictory replay from
being counted twice. Hint history remains ordered deterministically by ordinal
and then intervention reference.

## Required reproductions

| Scenario | Result |
| --- | --- |
| Learner B hint history injected into learner A request | `INVALID_HINT_STATE` |
| Same learner, wrong hint session | `INVALID_HINT_STATE` |
| Same learner/session, wrong hint context | `INVALID_HINT_STATE` |
| Prior hint interaction/opportunity in exact scope | Accepted; reviewed nudge recommended |
| Learner B prerequisite history injected into learner A intervention input | `INVALID_INTERVENTION_INPUT` |
| Same learner, wrong intervention session | `INVALID_INTERVENTION_INPUT` |
| Same learner/session, wrong intervention context | `INVALID_INTERVENTION_INPUT` |
| Prior intervention interaction/opportunity in exact scope | Accepted; prerequisite reteach path selected |
| Duplicate hint intervention reference | Rejected |
| Duplicate or contradictory source-interaction provenance | Rejected in both lanes |
| Invalid opportunity or malformed source-interaction reference | Rejected in both lanes |
| Deterministic replay | Identical result; input remains unmodified |

## Validation

- [VERIFIED] Strict focused TypeScript compilation for schema, V2 contracts,
  hints, and interventions: PASS.
- [VERIFIED] Complete hint lane suite: 25/25 passed.
- [VERIFIED] Complete intervention lane suite: 19/19 passed.
- [VERIFIED] Isolated Wave 1 strict TypeScript compilation: PASS.
- [VERIFIED] Wave 1 convergence hard-gate suite: 253/253 passed.
- [VERIFIED] Wave 1 Study bridge regression: 209/209 passed.
- [VERIFIED] Isolated Tutor Core strict TypeScript compilation: PASS.
- [VERIFIED] Tutor Core regression: 21/21 passed.
- [VERIFIED] Tutor Core build and static prototype smoke: PASS.
- [VERIFIED] `git diff --check`: PASS.

The worktree had no dependency installation. `npm ci --ignore-scripts` at the
repository root installed the pinned lockfile and reported three existing
high-severity audit advisories. Dependency manifests and lockfiles are outside
this repair's ownership and remain unchanged.

## Expected R2 integration work

`npm run tutor-v2:typecheck` and the aggregate `npm test` compilation stop only
at the existing `tests/tutor-v2-convergence/wave2-fixtures.ts` compositions:
their hint fixture lacks `learnerScopeRef`, `sessionRef`, and
`currentOpportunityRef`, and their intervention fixture lacks those fields plus
`instructionalContextRef`. This repair is not authorized to edit the adaptive
orchestrator or convergence fixtures.

`EXPECTED_R2_CONVERGENCE_ADAPTER_UPDATE_REQUIRED`

W2-09R2 must issue and propagate the opaque scope/opportunity bindings when it
updates the composition fixtures and adapter. No mastery logic or opportunity
inference belongs in this lane repair.

## Privacy and ownership

Only opaque references were added. No learner name, household-private prose,
transcript, diagnosis, or psychological label is stored or processed by these
contracts. Modified files are confined to:

- `adaptive-tutor/core/v2/hints/**`
- `adaptive-tutor/core/v2/interventions/**`
- `docs/study-tutor-v2/wave2/repairs/w2-b2-history-scope/**`

The adaptive convergence orchestrator, mastery lane, and Wave 1 source are
unchanged.

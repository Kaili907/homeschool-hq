# W2-B13 completed-review permission validation

Date: 2026-08-15

- Session: `STUDY-TUTOR-V2-W2-B13`
- Starting SHA: `67d11f4ba0382c8cf7c6091a20a67a4b6ef1a76c`
- Branch: `mac/tutor-v2-w2-review-permission-repair-r3`

## Required reproductions

| Scenario | Result |
| --- | --- |
| Exact Study-issued completed-review permission | Normal reviewed hint policy applies |
| Same permission, new review event | `completed-review-not-authorized` |
| Same permission, new opportunity | `completed-review-not-authorized` |
| Same permission, wrong learner/session/context | `completed-review-not-authorized` |
| Copied privacy approval, new review event | `completed-review-not-authorized` |
| Copied permission ref, new learner | `completed-review-not-authorized` |
| Stale review-policy revision | `completed-review-not-authorized` |
| Boolean, missing ref, unknown kind/version, or provider issuer | `INVALID_HINT_STATE` |
| Active assessment with exact review permission | `active-assessment-structural-block` |
| Exact completed-review request replay | Identical deterministic result |
| Instruction/practice or non-graded review without permission | Normal reviewed hint policy applies |

## Validation results

- [VERIFIED] Isolated strict Tutor V2 hint compilation: PASS.
- [VERIFIED] Complete hint suite: 42/42 passed.
- [VERIFIED] Compatible Wave 2 lane regression (all lane suites except the
  out-of-scope adaptive orchestrator): 200/200 passed.
- [VERIFIED] Wave 1 anti-answer unit and structural convergence regression:
  114/114 passed.
- [VERIFIED] Pinned dependency install with lifecycle scripts disabled: PASS;
  npm reported three existing high-severity audit advisories. Dependency
  manifests and the lockfile were unchanged.
- [VERIFIED] `git diff --check`: PASS.

## Expected R4 convergence stop

Aggregate strict Tutor V2 compilation reaches the intentionally stale
`tests/tutor-v2-convergence/wave2-fixtures.ts:173` fixture, where the legacy
`completedAssessmentReviewAllowed` field is no longer assignable to the closed
permission union. Consequently aggregate Tutor V2 and Wave 2 composition lanes
cannot run until R4 performs the adapter and fixture work listed in the README.
No compatibility alias was added to hide this required convergence work.

`EXPECTED_R4_COMPLETED_REVIEW_PERMISSION_ADAPTER_REQUIRED`

## Ownership

Tracked changes are confined to:

- `adaptive-tutor/core/v2/hints/**`
- `docs/study-tutor-v2/wave2/repairs/w2-b13-review-permission/**`

No adaptive orchestrator, intervention, mastery, generated schema, release
artifact, Wave 1 source, production/security file, or `src/**` path was
modified.

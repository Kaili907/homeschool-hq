# W2-B14 completed-review privacy binding validation

Date: 2026-08-15

- Session: `STUDY-TUTOR-V2-W2-B14`
- Starting R4 SHA: `2e846e33dffe493ab5cc05fc4fd1d5618ee4a311`
- Branch: `mac/tutor-v2-w2-review-privacy-binding-repair-r4`

## Required reproductions

| Scenario | Result |
| --- | --- |
| Exact non-null current privacy approval | Normal reviewed hint policy applies |
| Change only permission privacy approval | `completed-review-not-authorized` |
| Permission non-null, current null | `completed-review-not-authorized` |
| Permission null, current non-null | `completed-review-not-authorized` |
| Permission null, current null | Privacy dimension matches |
| Wrong learner/session/context/opportunity | `completed-review-not-authorized` |
| Wrong review event or review-policy revision | `completed-review-not-authorized` |
| Active assessment with exact permission | `active-assessment-structural-block` |
| Legacy boolean authority | Schema and runtime reject |
| Exact completed-review replay | Identical deterministic result |
| Instruction/practice or non-graded review | Completed-review privacy permission ignored |

## RED proof

Before the repair, the exact starting source was compiled at
`2e846e33dffe493ab5cc05fc4fd1d5618ee4a311`. A valid completed-review request
returned a recommended nudge with `privacy-approval:current`. Changing only the
permission field to `privacy-approval:foreign` returned the same recommended
nudge with the same `attempt-count-recommendation` reason. This reproduced the
W2-10R4 blocker.

## Validation results

- [VERIFIED] Pinned dependency install with lifecycle scripts disabled: PASS;
  149 packages installed and npm reported three existing high-severity audit
  advisories. Dependency manifests and the lockfile are unchanged.
- [VERIFIED] Strict isolated hint typecheck: PASS.
- [VERIFIED] Complete hint suite: 46/46 passed.
- [VERIFIED] Focused B13/completed-review suite: 17/17 passed.
- [VERIFIED] New changed-only and nullable privacy mismatch attacks: 3/3
  passed.
- [VERIFIED] B6 current-opportunity completion reset regression: 1/1 passed;
  the complete hint suite also retains the prior-opportunity reset coverage.
- [VERIFIED] Compatible Wave 2 direct-lane regression (adaptive composition
  excluded for R5): 245/245 passed.
- [VERIFIED] Wave 1 anti-answer unit and structural convergence regression:
  114/114 passed.
- [VERIFIED] Wave 1 provider-context and reviewed-content privacy regression:
  91/91 passed.
- [VERIFIED] `git diff --check`: PASS.

## Expected R5 compatibility stop

Aggregate strict Tutor V2 compilation stops at the intentionally stale
`tests/tutor-v2-convergence/wave2-fixtures.ts:157` composition fixture because
`currentReviewPrivacyApprovalRef` is now required by `HintSelectionRequest`.
The compiler reports exactly that the property is missing. R5 owns this fixture,
the adaptive composition adapter, generated schemas, convergence gates, and
release artifacts, so no compatibility alias or out-of-scope fixture edit was
added. Adaptive composition suites depending on that fixture remain deferred to
R5; direct Wave 2 lanes are green.

## Ownership

Tracked changes are confined to:

- `adaptive-tutor/core/v2/hints/**`
- `docs/study-tutor-v2/wave2/repairs/w2-b14-review-privacy/**`

No adaptive orchestrator, generated Wave 2 schema, convergence gate, release
artifact, Wave 1 source, production/security code, or `src/**` path is modified.

`EXPECTED_R5_REVIEW_PRIVACY_BINDING_ADAPTER_REQUIRED`

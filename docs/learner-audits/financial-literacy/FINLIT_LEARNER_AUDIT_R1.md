# Financial Literacy learner completeness audit R1

Classification: **FINLIT_LEARNER_AUDIT_COMPLETE**

Corpus decision: **FAIL — NOT SAFE TO BEGIN MATRIX**

Audited base: `c81ddb6e04bc1c3629212327d47817c1b5677477`

## Outcome

All 504 Financial Literacy lessons were audited at three layers: canonical production package, H3/scoring binding, and the exact generated browser learner payload plus final learner UI. The canonical lesson bodies are substantive and complete: 504/504 contain fictional financial scenarios, 3,632 authored prompts, visible task directions and parameters, and an open judgment deliverable. Existing oracle evidence was reused for fixed-item arithmetic.

The learner experience is not complete. The browser projector preserves prompt text but drops every structured choice array and every H3 response-scoring mode. The final lesson surface then forces `responseKind: 'none'`, so no numeric or open response can be entered. It also projects Remediation and Extension ahead of the tasks, disclosing fixed answers in 201 lessons, and leaves a Financial Literacy `/scoring/` resource locator in all 504 browser rows.

## Grade results

| Grade | Audited | Source pass | Browser pass | Choice loss | Answer leak | Result |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | 36 | 36 | 0 | 27 | 10 | FAIL |
| 4 | 36 | 36 | 0 | 10 | 3 | FAIL |
| 5 | 36 | 36 | 0 | 7 | 3 | FAIL |
| 7 | 36 | 36 | 0 | 4 | 3 | FAIL |
| 8 | 72 | 72 | 0 | 2 | 1 | FAIL |
| 9 | 72 | 72 | 0 | 45 | 15 | FAIL |
| 10 | 72 | 72 | 0 | 38 | 51 | FAIL |
| 11 | 72 | 72 | 0 | 56 | 56 | FAIL |
| 12 | 72 | 72 | 0 | 34 | 59 | FAIL |

## Scoring-mode preservation

| Mode | Expected | Source/H3/binding | Browser | Result |
| --- | --- | --- | --- | --- |
| JUDGMENT_APPLICATION | 36 | 36 | 0 | FAIL |
| MIXED | 468 | 468 | 0 | FAIL |

H3 is READY for 504/504, and all 504 source packages, scoring records, H3 records, and production bindings agree on mode and item inventory. The learner browser payload preserves 0/504 modes.

## Finding counts

| Flag | Lessons |
| --- | --- |
| ZERO_ACTIONABLE_WORK | 0 |
| MISSING_NUMERIC_PROBLEM | 0 |
| MISSING_VISIBLE_PARAMETER | 0 |
| MISSING_JUDGMENT_TASK | 0 |
| MIXED_HALF_MISSING | 0 |
| FLATTENED_CHOICES | 223 |
| UNSUPPORTED_NUMERIC_RESPONSE | 468 |
| UNSUPPORTED_OPEN_RESPONSE | 504 |
| ANSWER_LEAK | 201 |
| PRIVATE_FINANCIAL_DATA_REQUEST | 0 |
| PERSONALIZED_ADVICE | 0 |
| PROJECTION_LOSS | 504 |
| PLACEHOLDER | 0 |

Additional protected-authority finding: 504/504 generated browser lesson rows retain a `/scoring/` resource locator even though the safe-row filter claims to remove adult answer/scoring locators.

## Projection proof

- Browser text preservation: 504 scenarios, 1,740/1,740 task directions, and 3,632/3,632 authored prompt texts.
- Numeric visibility: zero lessons lost a required source number token; existing oracle evidence covers the fixed-answer authority.
- Choice loss: 237 fixed-choice items in 223 lessons lose all 700 labels as structured choices.
- Response loss: 2967 H3 fixed items and 666 H3 open items have no learner input control.
- Direct answer leakage: 369 fixed-answer matches appear in pre-task Remediation/Extension across 201 lessons.
- Safety: no task requests real family financial data or real account/card/SSN credentials, and no personalized financial advice request was found.

## Negative controls

| Control | Expected detection | Result |
| --- | --- | --- |
| hide-required-number | MISSING_VISIBLE_PARAMETER | DETECTED |
| delete-open-task | MISSING_JUDGMENT_TASK | DETECTED |
| delete-fixed-task-from-mixed | MIXED_HALF_MISSING | DETECTED |
| flatten-choices | FLATTENED_CHOICES | DETECTED |
| answer-leak | ANSWER_LEAK | DETECTED |
| request-real-account-number | PRIVATE_FINANCIAL_DATA_REQUEST | DETECTED |

## Matrix decision

**SAFE_TO_BEGIN_MATRIX: NO.** First preserve response modes and choice arrays in the browser material contract, render numeric and open inputs, keep adult remediation and scoring locators out of learner payloads, then rerun this audit.

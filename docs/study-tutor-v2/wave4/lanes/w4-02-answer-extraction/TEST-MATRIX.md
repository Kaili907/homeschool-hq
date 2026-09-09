# W4-02 test matrix

## Active protected states

Every extraction vector runs in both states below. Both map to the canonical
Tutor V2 `active-graded-or-mastery-check` phase, while separate fixture labels
prove that graded assessment and mastery reassessment are represented.

| Synthetic state | Required result |
| --- | --- |
| Active graded assessment | Reject every free-form instructional action by structural action shape |
| Mastery reassessment | Reject every free-form instructional action by structural action shape |

The vector inventory covers correct answer, `answerIndex`, `expectedAnswer`,
answer key, grading rubric, protected scoring locator, direct and near-direct
solutions, encoded/first-letter/reversed/base64-like answers, elimination,
guess confirmation, captions, diagrams, speech presentation, Parent
explanation, grounding, retry/replay, completed-review permission pivoting, and
requested action-family pivoting.

## State and behavior controls

| Control | Required result |
| --- | --- |
| Completed review without Study permission | Rejected |
| Completed review with explicit Study permission | Normal policy permits reviewed instructional output |
| Active state with completed-review permission still set | Rejected; permission cannot reopen active assessment |
| Ordinary instruction | All five authorized instructional families remain functional |
| Active neutral structured controls | Navigation/safety/static control actions remain eligible |
| Answer/scoring fields hidden in structured controls | Rejected before learner-facing output |

## Repeated attacks

Four deterministic multi-turn sequences cover incremental multiple-choice
elimination, split encoding, rotation through all five free-form action
families, and completed-review permission carryover into active graded and
mastery states. No active turn yields an instructional proposal, so safe
responses cannot combine into an answer.

## Detector-quality mutations

The runner applies four implementation mutations to disposable compiled copies:

1. disable active-phase protection;
2. remove `ask-check` from the structural free-form set;
3. let completed-review permission bypass active protection; and
4. authorize completed review without Study permission.

Each mutant must cause the unchanged certification suite to fail.

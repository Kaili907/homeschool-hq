# Enum and Event Mapping Tables

Only the Session 1 state/event vocabulary is persisted. The complete machine mapping is [`enum-event-mappings.v1.json`](../../reconciliation/enum-event-mappings.v1.json).

## Grade bands

| Source | Source value | Canonical |
|---|---|---|
| S2 provisional/focus | `elementary` | `elementary-3-5` |
| S2 provisional | `middle` | `middle-6-8` |
| S2 focus | `middle_school` | `middle-6-8` |
| S2 provisional | `high` | `high-9-12` |
| S2 focus | `high_school` | `high-9-12` |

## Study-UX segments

| S3 fixture slug | Canonical task type | ID rule |
|---|---|---|
| `warm-up` | `retrieval-practice` | Replace with real `LessonSegment.id` |
| `visual-lesson` | `direct-instruction` | Replace with real `LessonSegment.id` |
| `guided-practice` | `guided-practice` | Replace with real `LessonSegment.id` |
| `independent-attempt` | `independent-practice` | Replace with real `LessonSegment.id` |
| `self-check` | `reflection` | Replace with real `LessonSegment.id` |
| `exit-ticket` | `mastery-check` | Replace with real `LessonSegment.id` |

## Session 2/3 event mapping

| Source event/intent | Canonical event(s) or projection |
|---|---|
| `session_started` | `session-started` |
| `check_in_completed` | Planned check-in only: `active-response-recorded`, `segment-completed`; otherwise UX-local |
| `prior_retrieval_completed` | `active-response-recorded`, `segment-completed` on retrieval segment |
| `visual_teaching_completed` | `segment-completed` on direct-instruction/worked-example |
| `guided_practice_completed` | `active-response-recorded`, `segment-completed` |
| `independent_attempt_completed` | `active-response-recorded`, `segment-completed` |
| `confidence_check_completed` | Response/completion only for planned reflection; never a Core outcome |
| `core_instruction_completed` | `tutor-intervention-recorded`; segment lifecycle only when planned |
| `review_scheduled` | Update `StudentSkillReview`, queue projection; **no session event** |
| Pacing `break` | `break-requested` → `break-approved` → `break-started` as separate policy permits |
| Pacing `continue` | `segment-started` or `session-resumed`, depending state |
| Pacing `finish` | `session-completed` after canonical completion rule |
| Break return/confirm | `break-ended`, then `session-resumed` |
| `technical_interruption` | `technical-interruption-started`; end only after confirmed recovery |
| `intentional_save_exit` | `pause-started` plus canonical ResumePoint |
| S4 calendar created/rescheduled/edited/continued | Calendar audit only, linked to command/event |

`segment-completed` means its submission/completion rule succeeded; it never means correct or mastered.

## Timer reconciliation

The canonical reconciled model has two axes:

| Source | Source value | Visibility | Metric |
|---|---|---|---|
| S1 | `hidden` | hidden | none |
| S1 | `count-up` | shown | count-up |
| S1 | `count-down` | shown | count-down |
| S1 | `progress-bar` | minimal | progress-bar |
| S1 | `milestones-only` | minimal | milestones-only |
| S3 | `visible` | shown | count-down |
| S3 | `minimal` | minimal | progress-bar |
| S3 | `hidden` | hidden | none |
| S4 | `shown` | shown | retain effective learner metric |
| S4 | `hidden` | hidden | none |

## Breaks

Activity type: `planned`, `student-requested`, `movement`, `water`, `screen-rest`, `quiet-reset`, `parent-configured`.

Reason category: `pacing`, `student-request`, `wellbeing`, `accessibility-need`, `technical-recovery`, `parent-teacher-direction`.

These are orthogonal. A water break can be student-requested or accommodation-required; neither fact should be lost.

## Review intervals

| Days | Canonical interval |
|---:|---|
| 0 | `same-day` |
| 1 | `one-day` |
| 3 | `three-day` |
| 7 | `seven-day` |
| 14 | `fourteen-day` |
| 30 | `thirty-day` |
| Other approved positive integer | `custom` |

## Calendar block mapping

| `StudyTaskType` | S4 block type |
|---|---|
| `direct-instruction`, `worked-example` | `new_instruction` |
| `guided-practice` | `guided_practice` |
| `independent-practice` | `independent_practice` |
| `retrieval-practice`, `prerequisite-remediation` | `review` |
| `reading` | `reading` |
| `writing` | `writing` |
| `project-work` | `project_work` |
| `mastery-check` | `assessment` |
| `problem-solving`, `discussion`, `reflection`, `custom` | Explicit plan value required; do not guess |


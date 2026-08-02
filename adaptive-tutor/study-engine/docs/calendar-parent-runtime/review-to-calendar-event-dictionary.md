# Review-to-calendar event dictionary

This dictionary is the Session 8 translation seam. Canonical Card 1 IDs and
verified Session 4 source identities are preserved byte-for-byte. Card 8
adapter values remain local and never become external authority.

## End-to-end events

| Runtime event | Canonical input/output | Calendar or queue effect | Idempotency identity | Parent-visible evidence |
| --- | --- | --- | --- | --- |
| `review-recommended` | Engine `ReviewRecommendation` becomes canonical `StudentSkillReview` | Creates or updates one caller-identified pending queue entry | source recommendation ID + canonical review ID + revision + stable queue ID | Due date, instructional purpose, estimate |
| `review-prioritized` | Canonical review plus explicit runtime priority | Orders due work within hard item/minute limits | canonical review ID | Priority and limit reason, never a learner label |
| `review-capacity-held` | Queue decision only | Leaves review pending; does not crowd out reserved required instruction | canonical review ID + learner-local date | Exact item/minute or instruction-reserve reason |
| `review-calendar-placed` | Pending queue entry plus authorized scheduler/adult slot | Creates one learner-local review block; no time is inferred from a date | stable internal block ID + source identity | Local window, estimate, queue position |
| `review-attempt-started` | Canonical planned session | Marks the calendar block active | canonical session ID | Start time and visible activity title |
| `review-attempt-completed` | Canonical `SessionResult` and evidence references | Completes the block and queue entry | canonical session-result ID | Aggregate attempt result and next step |
| `review-result-returned` | Aggregate `RetrievalEvidence` in `review-result-return-command.v1` | Enqueues one memory-only outbox value for the Session 2 scheduler | command ID + outbox ID + idempotency key + review/result/attempt/evidence IDs | Interval action and evidence refs |
| `review-reteach-requested` | Canonical reteaching trigger | Creates reteaching work before same-day retrieval | review ID + trigger evidence IDs | “Reteaching first” without blame language |
| `review-remediation-requested` | Canonical prerequisite-remediation trigger | Creates prerequisite work ahead of retrieval | review ID + prerequisite skill ID | Confirmed prerequisite support and source evidence |
| `review-interval-expanded` | Canonical `IntervalAdjustment` | Updates next local review date; no duplicate queue item | review ID + updated revision | Previous interval, next interval, basis evidence |

Same-day `retryNotBefore` remains null until an authorized policy supplies the
offset-bearing instant and the required preparation plus break/session boundary
are complete. Cooldown values are compatibility input only and never create a
time.

## All 13 calendar block mappings

| Session 4 block type | Canonical `StudyTaskType` | Custom task type ID when used | Required-work default |
| --- | --- | --- | --- |
| `new_instruction` | `direct-instruction` | — | yes |
| `guided_practice` | `guided-practice` | — | yes |
| `independent_practice` | `independent-practice` | — | yes |
| `reading` | `reading` | — | yes |
| `writing` | `writing` | — | yes |
| `memorization` | `retrieval-practice` | — | yes |
| `assessment` | `mastery-check` | — | yes |
| `project_work` | `project-work` | — | yes |
| `review` | `retrieval-practice` | — | yes |
| `physical_education` | `custom` | `physical-education` | configurable; demo marks required |
| `outside_activity` | `custom` | `outside-activity` | no |
| `romeo_virtual_academy_activity` | `custom` | `romeo-virtual-academy-activity` | configurable from assignment plan |
| `parent_created_activity` | `custom` | `parent-created-activity` | explicit parent choice |

Completion bars use the count of required segments (or required blocks in a
roll-up), not elapsed time. Estimated minutes forecast workload; actual active
minutes are reported separately and never substitute for required completion.

## Break and interruption mapping

| Runtime category | Canonical state/event | Meaning |
| --- | --- | --- |
| `planned-break` | scheduled pause / approved break with `scheduled-break` | Known before the work block |
| `requested-break` | `break-requested`, then optional `break-approved` | Learner explicitly requested a pause |
| `outside-interruption` | paused/abandoned operational record with approved category | Family, appointment, or other nontechnical interruption |
| `technical-interruption` | canonical technical-interruption state and start/end events | Device, network, input, audio, or restart problem |

None of these categories is treated as an academic failure or hidden behavior
signal.

# Focus Algorithm Agent Notes

## Scope and authority

The focus engine makes only a session-duration recommendation:
`increase`, `maintain`, `decrease`, `insufficient_data`, or `manual_review`.
It does not determine mastery, explain mistakes, infer diagnoses, or describe a
learner's permanent capacity. The tutor core remains authoritative for academic
outcomes and misconception handling.

An upstream adapter must supply `coreOutcome`. A low or inconclusive core outcome
alone never causes a focus-duration decrease. Automatic decreases require repeated,
direct `too_long` feedback. Approved breaks remain usable evidence; interruption
and technical-issue sessions are excluded.

## Algorithm

1. Validate the bounded configuration and parent override.
2. Select reliable sessions with normalized exact subject and task-type matches and
   a planned duration within the configured similarity tolerance.
3. Sort newest first with a deterministic content tie-break and evaluate the most
   recent window.
4. Require at least five comparable sessions for every evidence-based automatic
   recommendation. The default window is five.
5. Escalate trusted review flags or repeated conflicting duration feedback.
6. Decrease one conservative step after at least two direct `too_long` responses.
7. Increase only when at least 80% of the evaluated sessions succeeded (four of the
   default five), no session says `too_long`, the parent permits increases, and a
   cap leaves room.
8. Grade-band preferred increases are 2 minutes for elementary, 3 minutes for
   middle school, and 4 minutes for high school. The actual increase is floored to
   the configured granularity and cannot exceed 10% of the current duration.
9. Otherwise maintain. Sparse evidence returns `insufficient_data`.

Parent `hold`, `reduce`, and `manual_review` directives do not require five
sessions. A parent or configured maximum below the current duration is enforced
without claiming anything about the learner.

## Privacy and determinism

The local input type deliberately has no learner ID, name, free-form notes,
diagnosis, or profile data. The result contains only an enumerated recommendation,
enumerated reason codes, durations, and aggregate counts. Extra runtime fields are
never copied. Returned objects are frozen.

No clock or random source is used. Sessions are ordered by epoch milliseconds and
a canonical content tie-break, so input permutations produce the same result.

## Provisional adapter reconciliation

Study-engine contracts were not available when this module was built. Integration
must reconcile these exact fields:

| Local field | Required authoritative source / mapping |
| --- | --- |
| `coreOutcome` | Tutor-core session result; do not derive locally from raw accuracy |
| `subject` | Canonical subject identifier or stable normalized label |
| `taskType` | Canonical activity/task identifier |
| `plannedDurationMinutes` | Planned active work minutes, excluding break time |
| `completedDurationMinutes` | Completed active work minutes, excluding break time |
| `durationResponse` | Direct session-scoped learner/adult feedback; never inferred from correctness |
| `disruption` | Contract disruption code mapped to `none`, `approved_break`, `interruption`, or `technical_issue` |
| `quality` | Contract evidence-validity assessment |
| `manualReviewRequested` | Trusted parent, teacher, or upstream safety escalation |
| `occurredAtEpochMs` | Valid UTC epoch milliseconds |

The future adapter should reject unknown enum values, keep personally identifying
data outside this engine, and translate this result into the shared study-engine
recommendation envelope without converting reason codes into blaming or diagnostic
language.

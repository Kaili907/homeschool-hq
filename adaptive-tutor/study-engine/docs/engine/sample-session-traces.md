# Deterministic sample session traces

These traces use synthetic opaque references and fixed timestamps. The
corresponding executable fixtures are in
`tests/engine/traces/sample-traces.test.ts`.

## Trace 1: conservative duration increase

Input summary: high-school mathematics independent practice, current duration
40 minutes, five comparable sessions, four tutor-core successes, one
non-success, no too-long feedback, parent cap 45 minutes.

```json
{
  "recommendation": "increase",
  "currentDurationMinutes": 40,
  "recommendedDurationMinutes": 44,
  "adjustmentMinutes": 4,
  "reasonCodes": ["evidence_supports_small_increase"],
  "evidence": {
    "availableComparableSessions": 5,
    "evaluatedComparableSessions": 5,
    "successfulSessions": 4,
    "tooLongResponses": 0,
    "tooShortResponses": 0,
    "approvedBreakSessions": 0
  }
}
```

The four-minute change is the high-school preferred step, exactly ten percent
of the current block, and below the parent cap.

## Trace 2: conflicting duration and pause signals

Input summary: five comparable 40-minute sessions with two too-long responses,
two too-short responses, and one comfortable response.

```json
{
  "recommendation": "manual_review",
  "recommendedDurationMinutes": 40,
  "adjustmentMinutes": 0,
  "reasonCodes": ["conflicting_duration_feedback"]
}
```

A separate session has 90% accuracy and three unexplained pauses:

```json
{
  "category": "Insufficient evidence",
  "conclusion": "insufficient",
  "dataQuality": "conflicting",
  "alternatives": ["Fatigue", "Interruption"]
}
```

The engine does not turn the pause pattern into a diagnosis or a duration
change.

## Trace 3: repeated requested break and retrieval failure

Input summary: the learner requests water after two approved breaks in the
configured repeat window.

```json
{
  "action": "start_break",
  "breakType": "water",
  "durationMinutes": 3,
  "approved": true,
  "countsAsFailure": false,
  "review": "parent_or_teacher",
  "reasons": [
    "student_request",
    "repeated_break_pattern",
    "approved_break_not_failure"
  ]
}
```

The immediate safe request remains approved; the repeated pattern adds adult
review rather than learner blame.

The retrieval at baseline index 3 then fails with low accuracy and low
independence:

```json
{
  "reviewedOn": "2026-07-28",
  "dueOn": "2026-07-28",
  "intervalDays": 0,
  "baselineIntervalDays": 3,
  "cadenceAction": "shorten",
  "preparation": "reteach_before_retrieval",
  "reasons": [
    "retrieval_failure",
    "low_retrieval_accuracy",
    "limited_independence"
  ]
}
```

This is a same-day calendar recommendation after reteaching, not an immediate
retry command. The orchestrator and break policy must prevent rapid retry
loops.

## Trace 4: tutor-core reteach and premature interleaving prevention

The full phase sequence receives `reteach` from the tutor core, schedules a
same-day review date, and finishes:

```json
{
  "phase": "finished",
  "coreDirective": "reteach",
  "scheduledReviewDate": "2026-07-28",
  "transitionCount": 9
}
```

The target skill has only two independent attempts even though its observed
accuracy is high. A mastered review candidate is available:

```json
{
  "mode": "blocked",
  "itemCount": 8,
  "targetItemCount": 8,
  "contextSwitches": 0,
  "selectedReviewSkillIds": [],
  "reasons": [
    "initial_blocked_practice",
    "premature_interleaving_prevented",
    "insufficient_independent_attempts"
  ]
}
```

High accuracy alone cannot erase the initial blocked-practice evidence floor.

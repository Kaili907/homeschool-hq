# Break and Fatigue Agent Notes

## Scope delivered

This slice provides two dependency-free, strict TypeScript APIs:

- `classifyEvidence(signals)` in `engine/evidence`
- `recommendBreak(context)` in `engine/breaks`

The tutor core remains authoritative for mastery, misconceptions, and
instructional decisions. These APIs only classify session-level evidence and
manage bounded break pacing.

## Evidence classifier

The classifier has the exact required closed category set:

- Concept difficulty
- Missing prerequisite
- Fatigue
- Interruption
- Technical issue
- Frustration
- Low confidence
- Support removed too quickly
- Possible disengagement
- Insufficient evidence

Every affirmative assessment has `conclusion: "possible"`. The engine never
asserts that an explanation is certain and never infers a diagnosis or
permanent trait.

The rules use conservative minimum evidence:

- Low accuracy plus at least four attempts and steady effort can suggest concept
  difficulty.
- Two checked prerequisite observations at or below 50% can suggest a missing
  prerequisite.
- Strong guided performance followed by weak independent performance only
  suggests support removal when each phase has at least two attempts and the
  transition is explicitly marked abrupt.
- Rapid random-like responses require at least five attempts, a response median
  at or below three seconds, and at least a 60% rapid-answer ratio. The result is
  still only possible disengagement.
- High accuracy with repeated unexplained pauses is deliberately ambiguous
  between interruption and fatigue and returns insufficient evidence.
- Similarly ranked conflicting explanations return insufficient evidence.
- An observed technical event is surfaced first and marks the evidence
  contaminated, preventing a performance pattern from becoming the primary
  conclusion.
- Approved breaks are excluded from negative evidence.

Malformed runtime data, out-of-range ratios, non-integer counts, invalid enum or
boolean values, null/non-object input, and completed attempts greater than total
attempts all return a fixed `invalid_signal` result without throwing.

## Break recommender

Supported types are planned, student-requested, movement, water, screen-rest,
quiet reset, and allowlisted parent-configured activities.

New-break selection prioritizes an explicit student request, then water,
movement, requested screen rest, requested quiet reset, a possible fatigue
signal, the configured screen-rest threshold, and finally a planned-break
threshold. This ordering is deterministic.

The resume workflow supports:

- timer-based resume;
- learner-ready resume;
- a short checkpoint after a refused recommendation;
- resume-or-finish when the extension cap is reached.

Break duration, extension increment, maximum extension, maximum total break,
screen-rest threshold, repeated-break window, refusal checkpoint, and session
maximum are configurable and validated. Extensions are bounded by both the
extension cap and total-break cap. Requests after an already elapsed timer do
not reopen an expired break; requests at the timer boundary can receive only
the remaining configured extension.

A repeated break pattern adds `review: "parent_or_teacher"` while preserving
the immediate requested break. Every output has the literal
`countsAsFailure: false`; approved breaks, refused break suggestions,
extensions, and escalation are never learner failures.

The engine uses elapsed session minutes rather than wall-clock timestamps, so
break decisions do not change at local-midnight or daylight-saving boundaries.

## Provisional contract assumptions

Shared study-engine contracts were not available when this slice began, so the
types are local and require adapter reconciliation:

1. Accuracy, confidence, prerequisite accuracy, and rapid-answer ratios are
   normalized numbers from 0 through 1.
2. Attempt and event counts are non-negative integers. `completedAttempts`
   cannot exceed `attempts`.
3. Technical issues and interruptions are observed events supplied by trusted
   telemetry, not inferred from low performance.
4. Free-form learner text, identity, diagnoses, and parent activity labels stay
   outside this boundary. Parent activities use opaque, allowlisted IDs, and
   those IDs are not reflected in recommendations.
5. Presence of `studentRequest` means the learner requested a break; an empty
   object selects the generic student-requested type.
6. `endedAtSessionMinute` and all current-break timing values share the same
   elapsed-session-minute origin.
7. The orchestration adapter should use `resume.returnTo` to restore the prior
   work step. It must not ask this module to decide mastery or reteaching.
8. Contract reconciliation should preserve the closed output vocabularies,
   `countsAsFailure: false`, conservative `possible`/`insufficient`
   conclusions, runtime validation, and static non-reflective safety messages.

## Validation

- Focused break/evidence tests plus adversarial break/evidence tests: 75 passed,
  0 failed across 5 files.
- Strict study-engine TypeScript check:
  `npx tsc -p adaptive-tutor/study-engine/engine/tsconfig.json --noEmit` passed.
- Coverage includes all categories and break types, sparse and conflicting
  signals, numeric boundaries, malformed runtime shapes, extension-loop
  prevention, repeated-break escalation, maximum duration, refusal, deterministic
  seeded sweeps, privacy non-reflection, and forbidden safety language.

## Known limitations

- Thresholds are conservative starting heuristics and should be configurable
  through the reconciled contract after product validation.
- Aggregate signals cannot establish why a learner paused or answered rapidly;
  ambiguous cases intentionally remain insufficient.
- The repeated-break review flag does not persist state. The caller must supply
  valid session history.
- Only one active break is modeled at a time.
- Parent/teacher review is a routing flag; this module does not contact anyone,
  persist records, or make clinical, disciplinary, or instructional decisions.

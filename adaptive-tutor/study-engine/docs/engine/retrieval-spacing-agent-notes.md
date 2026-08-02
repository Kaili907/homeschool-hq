# Retrieval and Spacing Agent Notes

## Scope delivered

This agent implemented two framework-independent strict TypeScript engines:

- `engine/review`: configurable review cadence, evidence adjustment, and
  time-zone-safe calendar-date utilities.
- `engine/interleaving`: blocked-to-mixed practice transition, explicit
  mastered-skill retrieval insertion, difficulty balancing, and hard
  context-switch limits.

No core, contract, schema, UI, integration, parent, storage, identity,
database, deployment, or GitHub files were changed.

## Review scheduling algorithm

The default starting sequence is calendar-day offsets `0, 1, 3, 7, 14, 30`.
`createStartingReviewPlan` materializes those dates. The sequence is explicitly
configurable and every recommendation includes this safety guidance:

> This configurable sequence is a starting point, not a claim that one fixed
> spacing schedule is optimal for every learner.

`scheduleNextReview` accepts the last baseline index plus current retrieval
evidence. It advances at most one baseline step after successful retrieval with
adequate accuracy and independence. It holds on insufficient or mixed evidence,
and moves back one baseline step for material difficulty. Evidence can modestly
adjust the selected interval:

- Strong accuracy, strong independence, high confidence, and repeated retrieval
  success can support small extensions.
- Low confidence shortens rather than overrides measured performance.
- A successful reteaching outcome schedules reconsolidation sooner.
- Retrieval failure, a prerequisite gap, or unsuccessful reteaching dominates
  optimistic/conflicting fields and schedules same-day follow-up after the
  indicated instructional preparation.
- The default extension factor is capped at `1.2`; configuration above `1.5` is
  rejected. A separate maximum interval cap is supported.
- Null measurements mean "not observed," never a score of zero.

The tutor core remains authoritative for deciding whether a prerequisite gap
exists, whether reteaching succeeded, and what to teach. This engine only
selects timing and returns reason codes.

### Calendar-date behavior

Due dates use validated `YYYY-MM-DD` calendar dates, not elapsed-hour
arithmetic. Whole-day operations are independent of daylight-saving changes.
`calendarDateInTimeZone` converts an absolute instant only when the caller
provides an explicit IANA time zone; the engine does not infer a time zone from
locale, IP address, or personal data.

## Interleaving algorithm

`scheduleInterleavedPractice` returns abstract skill slots. It never selects the
actual question or changes instructional mastery.

Interleaving is blocked unless the target has:

- prerequisite readiness;
- at least the configured count of independent attempts;
- observed independent accuracy at or above the transition threshold; and
- mastery evidence at or above the transition threshold.

After those gates pass, the engine uses a conservative transition mix until the
stronger mixed-practice thresholds pass. Only candidates explicitly marked
previously mastered and supported by independent attempts, accuracy, mastery,
and prerequisite readiness can be inserted. Candidate difficulty must be
within the configured distance from the target and from the prior skill block.

The target always receives a strict majority of slots. Review skills are
grouped into blocks to bound context switches. A zero-switch configuration
returns blocked practice; a one-switch configuration uses mastered retrieval
as a warm-up and ends on the target. `rotationOffset` provides deterministic
candidate rotation without randomness or learner identifiers.

## Sample deterministic traces

### Review

| Input | Result |
| --- | --- |
| No prior schedule, no evidence, reviewed `2026-04-10` | index `0`, same-day due `2026-04-10` |
| Prior index `2`, accuracy `0.95`, independence `0.90`, confidence `0.85`, three successful retrievals | advance to baseline `7` days, modestly adjusted to `8`, due `2026-04-18` |
| Prior index `4`, retrieval failure | regress to baseline index `3`, same-day follow-up after reteaching |
| Prior index `3`, high scores plus prerequisite-gap flag | conflict resolved conservatively, regress to index `2`, same-day follow-up after prerequisite support |

### Interleaving

| Input | Result |
| --- | --- |
| Four independent target attempts where five are required, 8 slots | blocked, 8 target slots, 0 switches |
| Transition-ready target, two eligible mastered skills, 10 slots | transition, 8 target + 2 mastered-retrieval slots, 3 switches |
| Mixed-ready target, 10 slots, maximum 1 switch | mixed, 6 target + 4 mastered-retrieval slots, 1 switch, ends on target |

## Validation

Focused Vitest result: **7 files passed, 113 tests passed**.

Focused strict TypeScript compile result: **passed with no diagnostics**.

Coverage includes:

- default and configured review sequences;
- retrieval accuracy, independence, confidence, repeated success, failure,
  prerequisite gaps, and reteaching outcomes;
- sparse and conflicting evidence;
- maximum interval and maximum extension boundaries;
- real calendar dates, leap years, DST boundaries, explicit time zones, and
  years below 100;
- deterministic fixture behavior;
- blocked, transition, and mixed practice;
- premature-interleaving prevention;
- explicit mastered-skill eligibility;
- difficulty boundaries;
- item, skill, and context-switch caps;
- bounded property-style score and schedule exploration;
- non-echoing of unexpected identifying input; and
- safety-language checks.

Unsafe cases verified as rejected or conservatively handled include invalid
proportions, non-integer attempt/state values, malformed dates, unsupported time
zones, non-monotonic starting sequences, over-aggressive extension-factor
configuration, optimistic scores combined with explicit failure, unobserved
independent accuracy, guided-only readiness, unmastered review candidates,
large difficulty jumps, and excessive context-switch requests.

## Provisional adapter and contract reconciliation report

Study-engine contracts were absent when this work was created. Local types were
therefore added only within the owned engine directories. Integration should
make these mappings explicitly:

1. Map the contract's retrieval event to `RetrievalEvidence`. Accuracy,
   independence, and confidence must preserve `null` for "not observed."
2. Persist or derive `ReviewProgressState.lastBaselineIndex`. The valid initial
   value is `-1`; later values index the configured baseline sequence.
3. Pass an explicit learner-local `CalendarDate` for scheduling. If the
   contract stores instants, use the learner's configured IANA time zone before
   calling the scheduler. Do not silently truncate UTC timestamps.
4. Map tutor-core prerequisite and reteaching decisions to
   `prerequisiteGap` and `reteachingOutcome`; do not duplicate misconception or
   mastery logic in an adapter.
5. Map parent/program settings to the scheduler config fields after validating
   whether the final contract treats them as hard caps or defaults. Engine hard
   caps must remain hard caps.
6. Persist reason-code unions or map them exhaustively to contract reason
   enums. Do not discard `preparation`, because a same-day date is conditional
   on prerequisite support or reteaching when indicated.
7. Map course difficulty into the local `1..5` scale, or revise the adapter and
   config together if the contract uses a different bounded scale.
8. Set `previouslyMastered` only from tutor-core authoritative mastery state.
   Do not infer it from one high guided score.
9. Let the orchestrator provide and persist `rotationOffset` if mastered-skill
   rotation across sessions is desired.
10. Keep actual content selection in tutor core. Interleaving `PracticeSlot`
    values are pacing intents, not question IDs.

## Known limitations

- Same-day recommendations are calendar dates, not exact times. The session
  orchestrator must avoid rapid retry loops and coordinate breaks before
  same-day retrieval.
- Evidence quality and event aggregation are caller responsibilities.
- Baseline progress state and deterministic rotation state are not persisted by
  these pure functions.
- IANA conversion depends on the JavaScript runtime's `Intl` time-zone data.
- Interleaving emits skill-level slots and uses a bounded local difficulty
  scale; tutor core must select suitable instructional items.
- No production contract was available for compile-time integration testing.

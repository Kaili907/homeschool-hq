# Study-engine algorithm explanation

## Authority boundary

This package owns pacing, break selection, review timing, and practice-order
recommendations. It does **not** determine mastery, diagnose a learner, or
classify misconceptions. The session orchestrator cannot move through its
`correct_or_reteach` phase until it receives a `correct` or `reteach` directive
from the tutor core.

All recommendations are advisory. Parent configuration and configured maximums
are hard constraints, and mixed or structurally invalid evidence routes to
manual review instead of an automatic change.

## Session orchestration

The state machine implements this sequence:

1. Check in
2. Retrieve prior knowledge
3. Teach visually
4. Guided practice
5. Independent attempt
6. Confidence check
7. Correct or reteach, as directed by the tutor core
8. Schedule future review
9. Break, continue, or finish

Transitions are explicit and chronological. A break resumes at a new check-in
cycle. Continuing also starts a new cycle; finishing is terminal. Callers
supply offset-qualified timestamps, so replaying the same events yields the
same state and does not depend on the machine clock.

## Focus recommendation

Focus evidence is filtered to the same subject and task type before evaluation.
Fewer than five comparable valid sessions cannot produce an automatic duration
change. The recent comparable window is deliberately small and conservative:
an increase normally needs at least four successful sessions in the latest
five, while conflicting or unsafe inputs stop automation.

Grade-band step sizes are bounded:

- Elementary: normally one or two minutes
- Middle school: normally about three minutes
- High school: normally three to five minutes

An increase is additionally limited to approximately ten percent of the
current duration and cannot pass a configured or parent-set cap. A parent
override can hold, reduce, or require review. Recommendations describe only the
next comparable block; they never label a permanent capacity.

## Evidence classification

The classifier evaluates combinations, not isolated events. Examples include:

- Low accuracy with steady effort: possible concept difficulty
- Correct guided work followed by failed independent work: support may have
  been removed too quickly
- High accuracy with repeated pauses: possible interruption or fatigue
- Fast, patternless answers: possible disengagement, never a diagnosis

Technical signals, known interruptions, and missing-prerequisite evidence take
precedence over speculative explanations. Ties and weak evidence remain
`insufficient_evidence`; the engine does not manufacture certainty.

## Break recommendation

Break decisions model planned and learner-requested breaks, movement, water,
screen rest, quiet resets, and parent-configured activities. The recommendation
also communicates whether to offer, resume, extend within limits, respect a
refusal, or escalate a repeated loop for adult review.

Approved breaks are represented as approved pacing events and are never
converted into session failure. Extension count and total extension duration
are capped. Repeated requests eventually route to review rather than producing
an unbounded break loop.

## Review scheduling

The default starting ladder is same day, one day, three days, seven days,
fourteen days, and thirty days. It is configurable and is a starting policy,
not a claim of universal optimality.

Retrieval accuracy, independence, confidence, repeated retrieval success,
retrieval failure, prerequisite gaps, and reteaching outcome move the next
review earlier, hold it, or move it later within policy bounds. Calendar dates
are calculated in the learner's configured IANA time zone rather than by adding
fixed 24-hour millisecond blocks, avoiding daylight-saving date drift.

## Interleaving

New or unstable skills begin in blocked practice. A skill becomes eligible for
mixed practice only after sufficient evidence of independent stability.
Previously mastered skills can then be inserted for retrieval. Difficulty is
balanced, and a configured context-switch limit prevents a plan from changing
skills too frequently. If the available evidence or candidate set cannot
satisfy those constraints, the scheduler prefers a simpler blocked plan.

## Jarvis coaching

Jarvis messages are deterministic templates rendered after an engine decision.
They offer choices, explain a small next step, treat breaks neutrally, and route
mixed evidence to an adult. A shared language guard rejects blame, diagnostic
claims, permanent-capacity claims, punitive break language, and coercive
duration language before a message can be returned.

Free-text context is normalized and length-limited. The prompt API has no field
for a learner's name, email, diagnosis, raw answer, or transcript.

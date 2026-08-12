# Mastery and Evidence Model — High School Mathematics 9-12

This package inherits the Manuel Academy mastery model already in force for Grades 5, 7, and 8. It
does not weaken it, and it does not introduce a competing model.

## The rule

**One correct answer never establishes mastery.** Every one of the 720 lessons carries this rule
verbatim in its `mastery_rule` field, and validation check 10 enforces its presence:

> Do not mark mastery from one answer. Use worked examples, explanation, error analysis,
> application, and a second occasion of evidence; require accurate independent evidence and
> successful transfer or retrieval on at least two occasions when feasible.

## The evidence chain, preserved in every lesson

Validation check 11 enforces that all 720 lessons carry this five-segment flow in order:

| Segment | Purpose | Evidence produced |
| --- | --- | --- |
| Welcome and retrieval | Surface prior thinking before instruction | Diagnostic, ungraded |
| Model or mini-lesson | Explicit instruction with reasoning made visible | None — instruction |
| Guided practice | Two supported examples, prompts faded on the second | Supported evidence |
| Independent application | New application, result **and** reasoning recorded | Independent evidence |
| Exit ticket and next step | One concise response plus a self-check | Formative evidence |

Instruction, guided practice, and independent evidence are therefore structurally guaranteed, not
left to the facilitator to remember.

## Multiple occasions

A single unit produces evidence on at least four distinct occasions:

1. **Guided practice days** (unit days 3 and 6) — supported evidence.
2. **Independent application and transfer days** (days 4 and 14) — independent evidence in a new
   representation or constraint.
3. **Performance task** (days 11-12) — applied evidence, with the product itself as the record.
4. **Unit assessment** (day 16) — seven prompts spanning concept, representation, application, error
   analysis, connection, performance evidence, and reflection.

The unit assessment is explicitly denied sole authority. Every assessment carries:

> A unit score is one evidence source, not the sole basis for long-term mastery.

## Reassessment

Every unit assessment in all four courses carries a `reassessment` block, enforced by validation
check 9:

- **Trigger** — any result below Secure, or any standard without independent evidence on a second occasion.
- **Sequence** — targeted reteaching of the smallest identified gap, then **fresh items** assessing
  the same standards with different contexts and numbers.
- **Evidence required** — accurate independent application plus explanation on a later occasion. The
  original attempt is never the sole record.
- **Recording** — record the improved evidence. **A reassessment is never averaged against the
  original attempt.**

Unit day 17 (`Targeted correction`) is reserved in the pacing of every unit in all four courses, so
reassessment has scheduled instructional time rather than depending on spare capacity.

## Reporting

Suggested reporting is **Secure / Developing / Not Yet**, supported by evidence rather than a single
percentage. Assessment interpretation bands are defined per unit:

- **Secure** — at least 85% with accurate independent application and adequate evidence/reasoning.
- **Developing** — 70-84% or inconsistent explanation; assign targeted review and a fresh transfer check.
- **Not Yet** — below 70% or a missing prerequisite; reteach the smallest gap and reassess with new evidence.

## What is never recorded

Validation check 16 enforces that every lesson's guardian-visibility field excludes raw learner
answers. Reporting shows the target, completion state, evidence type, and next instructional step. It
excludes raw private reflections, raw answers, voice recordings, and diagnosis language. There is no
requirement anywhere in this package to persist raw learner answers.

Access supports may change format, pacing, quantity, setting, or response mode **without changing the
standard being assessed**. An approved break, accommodation, voice/no-voice choice, or alternate
response mode is never recorded as a failure.

## Study Engine and Tutor

Lessons are Study-adaptable through the existing structure: each lesson is resumable by segment, and
each carries five `adaptive_tutor_routes` keyed to the same five controlled signals already used by
the Grade 8 corpus — prerequisite gap, procedure without understanding, correct but low confidence,
repeated error pattern, and mastery evidence. Validation check 18 confirms the signal vocabulary is
identical to Grade 8's and that no shared Tutor Core or Study Engine source was modified.

Where a high-school topic exceeds current Tutor capability, the lesson still carries its full static
support: worked example, guided practice, success criteria, accessibility options, and a readable
media fallback. No lesson depends on Tutor availability to be teachable.

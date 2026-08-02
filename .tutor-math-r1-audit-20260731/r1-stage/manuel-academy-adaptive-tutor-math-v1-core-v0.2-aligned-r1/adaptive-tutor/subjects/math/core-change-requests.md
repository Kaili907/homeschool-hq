# Math Subject — Core v0.2 Change-Request Classification

Tutor Core v0.2 is Director-frozen. This file records disposition only; it
does not request or make a Core change.

## MATH-CORE-001 — Grade 5

**Disposition:** Resolved by Core v0.2; withdraw.

`GradeBandSchema` accepts integer `min` and `max` values from 0 through 12.
The Math adapter emits the approved 4–6 band directly, so Grade 5 is not
remapped to Grade 4.

## MATH-CORE-002 — Extensible visual commands

**Disposition:** Nonblocking enhancement.

The subject adapter maps number lines and fraction bars to native Core
primitives, step diagrams to `reveal-step`, and all other subject visuals to
bounded `add-text` plus `aria-announce` fallbacks that retain the complete
alternative text. Native high-fidelity renderers may be added in a future Core
release but are not required for instructional continuity.

## MATH-CORE-003 — Adaptive sequence contract

**Disposition:** Substantially resolved by Core v0.2.

`TutorProgram`, misconception, teaching, guided, independent, reassessment,
reteach, uncertainty, and escalation contracts cover the executable cycle.
The subject runtime represents prerequisite remediation as a subject-owned
subphase of Core `reteach`, without changing the frozen phase union.

## MATH-CORE-004 — Evidence persistence

**Disposition:** Deferred assembly/progress concern; nonblocking here.

The subject runtime requires session-tagged evidence from at least two
sessions before mastery. It does not add storage or progress synchronization.
Persistence remains the responsibility of a separately authorized assembly
or progress layer.

## MATH-CORE-005 — Trusted graded-activity mode

**Disposition:** Open, nonblocking for this ungraded package.

All delivered activities are ungraded, every emitted tutor response sets
`givesFinalGradedAnswer: false`, and the Core safety guard redirects academic
integrity requests. A trusted application activity-mode signal remains a
future defense-in-depth enhancement.

## MATH-CORE-006 — Response-mode capabilities

**Disposition:** Partially resolved; nonblocking.

Core supports typed and selected responses and requires
`noCameraRequired: true` plus `identifyingInformationRequested: false`.
Formal adult-scribing, optional-speech, and preference capability metadata
remain possible future enhancements. Voice is never required by this package.

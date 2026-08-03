# Core Contracts Reference

## Assessment item

Supports multiple-choice, short-answer, and sequencing items. Each item declares its purpose, skill, grade band, locale, attempt limit, and privacy guarantees. Items cannot request camera access or identifying information.

## Prerequisite skill graph

A directed graph of skills and prerequisite edges. Runtime validation rejects unknown nodes, self-dependencies, duplicate edges, and cycles.

## Misconception classification

Represents ranked learning hypotheses, evidence, counterevidence, and uncertainty. The contract explicitly marks the output as non-diagnostic.

## Confidence and uncertainty

Combines weighted observations using a bounded beta-style estimate. Output includes a value, uncertainty, interval, evidence count, effective evidence, distinct contexts, and a band. Placement decisions are always disallowed.

## Tutor response

A single learner-visible turn with one useful step, a spoken-text equivalent, visual-board commands, expected input, uncertainty statement, alternate-explanation availability, and escalation data.

## Visual-board command

A discriminated union of bounded, accessible drawing and teaching primitives. Arbitrary HTML, script, and external media execution are not part of the contract.

## Spoken turn

Contains exact visible text, locale, pace, emphasis hints, interruptibility, caption/transcript requirements, and an explicit false human-identity claim.

## Narration, caption, and transcript

Keeps audio optional. Captions and transcript remain required and learner-visible. Transcript turns declare that identifying information is absent.

## Guided practice

Includes items, a hint ladder, attempt limits, feedback timing, participation expectations, and alternate-explanation support.

## Independent mastery

Requires at least three items, multiple contexts, reassessment, a score threshold, and bounded uncertainty. One response can never establish mastery.

## Parent and teacher review

Summarizes evidence, strengths, support needs, next steps, disputes, persistent difficulty, uncertainty, and escalation. It cannot diagnose or make placement decisions.

## Safety decision

Records bounded safety triggers, redacted input, rule IDs, whether adult escalation is needed, and whether academic flow must stop.

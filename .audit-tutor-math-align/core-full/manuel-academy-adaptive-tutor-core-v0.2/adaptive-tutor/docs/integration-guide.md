# Integration Guide

## Purpose

This package is a subject-neutral adapter boundary for the future Manuel Academy application. It should be integrated only after the Academy foundation, identity, and approved AI/TTS boundary are ready. Until then, it runs entirely in a local browser.

## Recommended application adapter

1. Import `AdaptiveTutorEngine` from `core/engine`.
2. Load a subject-owned `TutorProgram` through an application adapter.
3. Validate the program with `TutorProgramSchema` before constructing the engine.
4. Render `TutorResponse.learnerMessage` and `TutorResponse.boardCommands`.
5. Keep `spokenTurn.text`, captions, and transcript visible even when audio plays.
6. Pass learner input to `engine.submit()` only after local safety evaluation.
7. Use `engine.getReview()` for adult review; do not interpret it as placement authority.
8. Persist nothing from this package until an approved authenticated progress contract exists.

## Subject package contract

Final subject teams should provide:

- Stable skill and item IDs
- A valid prerequisite graph
- Diagnostic items that distinguish likely misconceptions
- Misconception definitions with supporting and contradicting evidence signals
- At least one visual teaching sequence and an alternate explanation
- Guided practice with a non-answer-revealing hint ladder
- At least three independent items across at least two contexts
- Fresh reassessment items
- Missing-media and unavailable-voice fallback text

## Rendering visual-board commands

The command union is intentionally bounded. An application renderer should support unknown-command failure safely by ignoring the command, logging a non-identifying error, and showing the command’s `ariaLabel` or fallback text.

Supported primitives include:

- Clear board and set title
- Add text
- Draw fraction models
- Draw number lines
- Show sentence parts
- Reveal one step
- Compare two representations
- Highlight a token
- Announce accessible text

## AI provider boundary

The included prompt templates are provider-neutral source material. Do not send raw learner identity, private profile data, or unrestricted conversation history to a model. A future server policy should bound inputs, outputs, timeouts, retries, quotas, safety routing, and transcript retention.

## Progress boundary

`TutorEngineSnapshot` is an in-memory state representation, not a database contract. Do not use its IDs as household, learner, enrollment, submission, or synchronization identifiers.

# Limitations and Deferred Integration Work

## Shared-core gaps

1. **Grade 5 is absent from the current canonical core grade union.** The subject package preserves Grade 5 in its own metadata and provides a temporary rendering adapter. That adapter must not rewrite or persist a Grade 5 learner as Grade 4.
2. **The current visual walkthrough union does not include every requested representation.** Unsupported visual commands degrade to accessible equation-ledger or text descriptions until a versioned renderer registry exists.
3. **The shared core has no first-class adaptive-sequence state machine.** This package supplies a subject-owned contract and fixtures, but application navigation and session state remain future integration work.
4. **Immutable evidence events and derived mastery are not yet integrated.** The package defines the evidence needed for routing and mastery, but it deliberately stores no learner progress.
5. **Graded-mode enforcement still needs a trusted core boundary.** Content policies prohibit graded-homework completion, and the demo is ungraded, but a production tutor must receive an authoritative activity mode and deny answer-generating help during graded response entry.

## Content and media limitations

- Narration is delivered as scripts/transcripts plus WebVTT captions; no synthesized audio binary is included.
- Visuals are delivered as deterministic visual-board commands and text alternatives; no rendered image or video binaries are included.
- The standalone demo exercises one representative place-value intervention route. The other three sequences are complete in content and fixtures but are not mounted into a production application here.
- The package has not undergone classroom field testing, external standards certification, psychometric calibration, or accessibility testing with every assistive technology.
- Parent/teacher review notes are instructional guidance, not a diagnosis, formal evaluation, or official gradebook record.

## Integration constraints

- Preserve stable IDs and version `1.0.0` when mounting the package.
- Keep `lesson.md` authoritative for human-readable content and the JSON/TypeScript sequence files authoritative for machine behavior.
- Do not connect persistence until Academy identity, learning-record, and safe-sync contracts are approved.
- Keep no-media fallbacks available and never make mastery depend on media, camera input, or an identifiable learner image.

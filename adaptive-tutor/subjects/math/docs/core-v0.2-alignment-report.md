# Tutor Math v1 → Frozen Core v0.2 Alignment Report

## Artifact custody

- Original Math v1 upstream SHA-256:
  `a2b8df07e1f15655c909fddfd204b3c095aeb6d8796d106b6aed1da41f5c7b2f`
- Failed aligned input SHA-256:
  `665be680aaf4492a556399feaf81177f3740714604332fc2fa8939cdbe181777`
- Frozen Core v0.2 SHA-256:
  `38205667d56cb4fcc5a8360f1f94098b5fa1d35ae71d22334aa1bc8d43ecc276`
- The failed aligned input and frozen Core hashes matched the supplied expected
  values.
- Neither authoritative ZIP and no Core file was changed.
- The derived release changes only `adaptive-tutor/subjects/math/**`.

## Contract compatibility

| Frozen Core v0.2 contract | Result | Subject-owned mapping |
|---|---|---|
| TutorProgramSchema | PASS_PROVISIONAL_ADAPTER | One program per approved sequence; direct 4–6 grade band |
| AssessmentItemSchema | PASS_PROVISIONAL_ADAPTER | 72 source items mapped; rubric-style responses retain acceptable evidence |
| TutorResponseSchema | PASS_PROVISIONAL_ADAPTER | One useful step, no graded final answer, uncertainty retained |
| SpokenTurnSchema | PASS_PROVISIONAL_ADAPTER | Text fallback, captions, transcript, non-human identity |
| GuidedPracticeContractSchema | PASS_PROVISIONAL_ADAPTER | Non-answer-revealing hint ladder and explanation requirement |
| IndependentMasteryContractSchema | PASS_PROVISIONAL_ADAPTER | Repeated evidence, multiple contexts, reassessment, no placement authority |
| VisualBoardCommandSchema | PASS_PROVISIONAL_ADAPTER | Every source command emits valid Core primitives |
| MediaFallbackSchema | PASS_PROVISIONAL_ADAPTER | Missing visual/audio text; lesson continues |

Core v0.2 directly supports Grade 5 because its grade band is an integer range
from 0 through 12. The adapter emits `min: 4, max: 6`; it never substitutes
Grade 4 for Grade 5.

## Visual inventory

The unchanged content supplies 20 commands:

| Source kind | Count | Core v0.2 treatment |
|---|---:|---|
| number-line | 4 | `draw-number-line` |
| fraction-bar | 2 | `draw-fraction` and `compare` |
| step-diagram | 4 | ordered `reveal-step` and announcement |
| area-model | 2 | accessible text and announcement |
| array | 2 | accessible text and announcement |
| place-value-chart | 2 | accessible text and announcement |
| base-ten-blocks | 1 | accessible text and announcement |
| column-arithmetic | 1 | accessible text and announcement |
| equal-groups | 1 | accessible text and announcement |
| word-problem-organizer | 1 | accessible text and announcement |

As delivered in the authoritative v1 ZIP, 0 commands directly validate and all
20 are unsupported by the legacy adapter for Core v0.2. In this derived
release, all 20 are adapter-supported and 0 remain unsupported.

## Executable flow

The actual frozen Core engine was exercised for:

1. assessment;
2. misconception hypothesis with uncertainty;
3. visual teaching;
4. guided practice;
5. independent attempt;
6. reassessment;
7. advance with review available; and
8. repeated reteaching followed by persistent-difficulty escalation and a
   contract-valid parent/teacher review.

The subject trace additionally represents approved prerequisite remediation as
a subject-owned subphase of Core `reteach`. Cross-session mastery requires at
least five independent/reassessment observations across at least two sessions
and two contexts; no single response can establish mastery.

## Safety and accessibility

- Exactly one current question or useful step.
- Reasoning/attempt required before answer discussion.
- No graded-homework completion; all emitted responses prohibit a graded final
  answer.
- Uncertainty is present in every phase and review.
- No diagnosis or placement decision.
- Persistent difficulty and disputed grading route to adult review.
- Parent/teacher review remains available after advancement.
- Every assessment forbids a camera and identifying-information request.
- No child image is collected or required.
- Missing media uses text alternatives.
- Unavailable voice uses displayed text with captions and transcript.
- Reduced-motion styling, native keyboard controls, semantic focus handoffs,
  and visible focus indicators are verified in the corrected standalone demo.

## Validation

- Original strict TypeScript: PASS.
- Original behavioral tests: 9/9 PASS.
- Original content validator: 214/214 PASS.
- Alignment tests: 8/8 PASS.
- Actual frozen Core schema validation: four programs, 72 source items, 96
  emitted assessment contracts, and all 20 visuals PASS.
- Invalid Core fixtures rejected: 5/5.
- Actual Core engine advance and persistent-escalation traces: PASS.
- Demo JavaScript syntax and 10 focused state/evidence regressions: PASS.
- Working-tree browser acceptance: 4/4 PASS with Playwright 1.62.0 on bundled
  Chromium 151.0.7922.34, headless at 1280x900. The keyboard-only path reached
  guided practice, independent attempt, reassessment, and the appropriately
  qualified checkpoint; uncertainty, reasoning isolation, focus continuity,
  fallbacks, console/resources, and reduced motion passed.
- Final sealed-ZIP results are recorded externally after clean extraction so
  this internal report does not mutate the artifact after acceptance.

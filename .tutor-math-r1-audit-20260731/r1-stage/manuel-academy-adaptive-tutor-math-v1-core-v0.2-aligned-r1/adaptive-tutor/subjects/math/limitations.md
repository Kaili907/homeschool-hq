# Limitations and Deferred Integration Work

## Nonblocking limitations

1. The frozen Core has native renderers for number lines and fractions but not
   every Math representation. The subject adapter uses structured step or
   complete text/ARIA fallbacks for the remaining commands.
2. Core's short-answer evaluator is exact-answer based. The adapter retains the
   Math `acceptableEvidence` criteria, but an authorized production assembly
   should use the subject rubric when evaluating open explanations.
3. Cross-session mastery is implemented as a pure subject decision over
   session-tagged evidence. This package deliberately adds no persistence or
   progress synchronization.
4. Prerequisite remediation is a subject-owned subphase mapped to Core
   `reteach`; the frozen Core phase union is not extended.
5. The package is ungraded and every Core response prohibits final graded-answer
   completion. A trusted application activity-mode signal remains a future
   defense-in-depth enhancement.

## Media and validation limitations

- Narration is delivered as text/transcript plus WebVTT; voice is optional.
- No rendered image, video, or learner image is required.
- The standalone demo mounts one representative place-value route.
- Static demo inspection and JavaScript syntax validation passed, but actual
  browser interaction could not run because the controlled browser service
  reported no available backend.
- Classroom field testing, psychometric calibration, and exhaustive
  assistive-technology testing remain outside this package gate.

## Integration constraints

- Keep lesson and sequence content version `1.0.0` and stable IDs unchanged.
- Keep media optional and preserve all text alternatives.
- Do not connect persistence without separate authorization.
- Treat parent/teacher review as instructional evidence, never a diagnosis,
  official grade, or high-stakes placement decision.

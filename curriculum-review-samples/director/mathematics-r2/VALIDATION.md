# Mathematics Director Samples R2 validation

Validation date: 2026-08-16

## Per-grade proof

The focused validation suite reads the manifest, parses every JSON sample,
loads its named canonical source package, compares grade/course/lesson/standard
identity, maps the nested learner material through the learner-response runtime,
and creates the real Rich Study render model.

| Grade | Parses and source mapping matches | Rich mode (no legacy fallback) | Worked example is read-only | Supported learner controls | Feedback + fresh reteach | Review + no answer authority |
| --- | --- | --- | --- | --- | --- | --- |
| 3 | Pass | Pass | Pass | Pass | Pass | Pass |
| 4 | Pass | Pass | Pass | Pass | Pass | Pass |
| 5 | Pass | Pass | Pass | Pass | Pass | Pass |
| 7 | Pass | Pass | Pass | Pass | Pass | Pass |
| 8 | Pass | Pass | Pass | Pass | Pass | Pass |
| 9 | Pass | Pass | Pass | Pass | Pass | Pass |
| 10 | Pass | Pass | Pass | Pass | Pass | Pass |
| 11 | Pass | Pass | Pass | Pass | Pass | Pass |
| 12 | Pass | Pass | Pass | Pass | Pass | Pass |

The same suite separately asserts that the Grade 3 worked example contains
`3,000` and `300`, is projected as `READ`, and is followed by a numeric learner
response using a fresh `4,000` comparison. It also rejects duplicate directions,
the reported duplicated diagnostic instruction, normal-lesson diagnostic
labels, response items without an existing supported response kind, flattened
choice controls, missing feedback branches, and answer/scoring fields in the
learner material. It also proves a one-to-one protected-authority entry for
every required response and verifies that authority-only fields never enter the
Rich render model.

## Commands and results

- `npx vitest run` over the five Math R2/player/response files: **PASS**, 5
  files and 91 tests.
- `npm run typecheck`: **PASS**.
- `npm run build`: **PASS**; 632 modules transformed. The browser-answer audit
  was `NOT_APPLICABLE` because the Family Pilot build flag was disabled.
- `npm run audit:learner-release`: **PASS** and
  `CLASSIFICATION LEARNER_RELEASE_READY`; 8,292 lessons and 699 assessments
  ready, zero blocked.
- `npm test`: **NOT FULLY GREEN**; 561 files / 6,902 tests passed and four tests
  skipped. One existing deployment-environment fixture assertion failed in
  `tests/study-deployment-env-preflight.test.js`, and the independent PostgreSQL
  suite failed to initialize because its installed native package could not
  load `libicudata.77.dylib`. This branch does not modify either failing path.

Manual age/readability findings are recorded in `READABILITY-REVIEW.md`.

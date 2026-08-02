# Session 7 validation report

Validation date: 2026-07-29  
Runtime version: `manuel-academy-study-student-runtime@0.7.1`  
Environment: Windows, Node `v24.14.1`, local desktop and mobile Chromium

## Result

All automated release gates pass in the workspace and from a clean,
self-contained staging copy. The lab exchanges typed Session 2 engine data
and Session 3 UI actions through Session 1 canonical records. Card 5
`DEC-012` governs preference reconciliation. Progress remains canonical
segment completion.

## Package verification

| Package | Expected and observed SHA-256 | Workspace parity | Result |
| --- | --- | --- | --- |
| Card 1 canonical contracts | `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41` | 70/70 files byte-identical | Pass |
| Session 2 Study Engine | `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770` | 58/58 files byte-identical | Pass |
| Session 3 Study UX | `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11` | 64/64 files byte-identical | Pass |
| Card 5 reconciliation audit | `2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7` | 36/36 files byte-identical | Pass |

Every non-directory ZIP entry was independently hashed and compared with its
working-tree counterpart. There were zero missing or different files. No
missing package was reconstructed from a summary.

Tutor Core v0.2 and a genuine Session 6 bridge were not found after the
documented search. The lab therefore uses the explicitly temporary,
local-only `student-runtime.session6-bridge.v2` boundary and withholds mastery
and misconception authority. Its receipt binds the session, canonical
`SegmentId` task identity, draft reference, revision, request, occurrence
time, directive, and reason.

The five required specialist workstreams completed canonical integration,
engine-adapter retirement, Student UX integration, persistence/idempotency,
and accessibility/adversarial testing. Their reports are under `agents/`.

## Workspace release gate

The following commands completed successfully:

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 10 test files, 44 tests, 0 failures |
| `npm run test:browser` | 14 scenarios, 0 failures |
| `npm run build` | Pass, 101 modules transformed |

Production output:

- HTML: 0.67 kB; 0.39 kB gzip.
- CSS: 62.37 kB; 12.81 kB gzip.
- JavaScript: 449.52 kB; 126.94 kB gzip.
- Source map: 1,761.04 kB.

## Clean-package portability gate

A curated source-package tree was copied to an isolated temporary directory
with no inherited `node_modules`.

| Check | Result |
| --- | --- |
| `npm ci` | Pass: 139 packages installed, 140 audited, 0 vulnerabilities |
| `npm run build` | Pass: 101 modules transformed |
| `npm test` | Pass: 10 files, 44 tests |
| `npm run test:browser` | Pass: 14 scenarios |

The package owns explicit TypeScript module paths and supplies Vite runner
configuration plus transform and dependency-optimizer `tsconfigRaw` guards.
This prevents an extracted package from inheriting an unrelated ancestor
TypeScript configuration.

## Unit and deterministic coverage

The 44 unit tests cover:

- Card 1 plan, controls, focus, session, evidence, and review conformance;
- stable opaque IDs and `SegmentId` as the single task identity;
- v2 UI vocabulary parity with canonical event names;
- math and reading state-machine transitions;
- Card 5 gates, constraint composition, manual review, selection, clamping,
  and reason-coded provenance;
- safety, accommodation, parent duration, and excessive-increase caps;
- visible, minimal, and hidden timer modes;
- required, requested, and repeated non-punitive breaks;
- technical interruptions kept separate from learner breaks;
- duplicate event idempotency and conflicting duplicate rejection;
- exact local drafts and resume position;
- v2 SHA-256 resume envelopes, stale revision rejection, tampering,
  cross-session copies, unsupported versions, and quarantine;
- forged completion/history rejection;
- PII, prompt-injection, transcript, and raw-answer exclusion;
- supportive language enforcement;
- Tutor Core authority withholding;
- comparable-evidence thresholds and learner-local review output.

The trace generator was run twice. Both files retained identical bytes:

| Trace | SHA-256 |
| --- | --- |
| `math-water-break.trace.json` | `853FDD32290F9619566C30FFBA11810C774287F2DBE73D3D4D6DA9C267A46101` |
| `reading-save-resume.trace.json` | `1C5F5BCBF732E7849E0CC14A7421441132E00911D17BFB901B143C7901AAC65A` |

The first-session traces correctly report insufficient comparable pacing
evidence rather than fabricating history. Review output is learner-local and
does not claim Tutor Core mastery evidence.

## Browser and accessibility coverage

Fourteen Playwright scenarios passed serially:

- 12 desktop Chromium scenarios;
- 2 Pixel 7 mobile Chromium scenarios at 390 × 844;
- Grade 5 math through water break, exact resume, exit, evidence, review, and
  finish;
- Grade 5 reading through low-confidence support, save, refresh, exact
  resume, exit, and review;
- timer anxiety in visible, minimal, and hidden modes;
- random answers, repeated breaks, three-refresh loops, stale tokens,
  tampered or forged state, prompt injection, and unsupported versions;
- keyboard-only navigation, focus restoration, skip navigation, and direct
  break access;
- reduced motion, 130% text, no audio, unavailable speech, and missing media;
- 44 × 44 touch targets, no page-level mobile overflow, and a focused
  320 × 667 interaction regression;
- all seven adversarial demonstration results;
- Axe scans with zero serious or critical findings in exercised states.

Two responsive defects were discovered and fixed: a scalable inherited
minimum page width, and a later two-column rule that collapsed the 320px
check-in form beneath Jarvis. Details and the accurately untested manual
assistive-technology matrix are in `accessibility-report.md`.

## Demonstration acceptance

| Required demonstration | Result |
| --- | --- |
| Math: warm-up → visual → guided → independent → water break → exact resume → exit → review | Pass |
| Reading: retrieval → teaching → guided → independent → low confidence → support → save → refresh → exact resume | Pass |
| Forged completion rejected | Pass |
| Duplicate event ignored | Pass |
| Raw name, email, and answer omitted | Pass |
| Unsupported version quarantined | Pass |
| Blame language rejected | Pass |
| Excessive increase capped | Pass |
| Repeated breaks remain non-punitive and may flag adult review | Pass |

## Scope audit

All project changes are confined to:

- `integration-labs/student-runtime/**`
- `tests/student-runtime/**`
- `docs/student-runtime/**`

No calendar/parent runtime was integrated. No Wave 1 package, canonical
contract, Tutor Core, subject package, calendar/parent package, production
system, GitHub state, Supabase resource, database, authentication, identity,
storage service, or deployment was changed.

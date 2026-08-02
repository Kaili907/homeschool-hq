# Session 7-R2 final validation report

Validation date: 2026-07-30  
Runtime version: `manuel-academy-study-student-runtime@0.7.2`  
Environment: Windows, Node `v22.22.3`, local desktop and mobile Chromium

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
| Accepted Session 5-R2 reconciliation | `39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41` | Exact archive hash | Pass |
| Accepted Session 6-R2 bridge | `0847B14EC8FEFA79E85210ED1565CE8302DC3F81331BC04FCBD895F05B7AD571` | Package 1.0.1 / contract 1 | Pass |
| Frozen Tutor Core v0.2 | `38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276` | Exact archive hash | Pass |

Every non-directory ZIP entry was independently hashed and compared with its
working-tree counterpart. There were zero missing or different files. No
missing package was reconstructed from a summary.

Tutor Core v0.2 and the genuine Session 6-R2 bridge were verified exactly.
The lab uses `@manuel-academy/study-core-bridge` version `1.0.1`, bridge
contract `1`, and preserves Tutor Core mastery and misconception authority.
Its ledger receipt binds the session, canonical
`SegmentId` task identity, draft reference, revision, request, occurrence
time, directive, and reason.

The five required specialist workstreams completed canonical integration,
engine-adapter retirement, Student UX integration, persistence/idempotency,
and accessibility/adversarial testing. Their reports are under `agents/`.

## Final workspace release gate

The following commands completed successfully:

| Command | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 15 test files, 77 tests, 0 failures, including release-evidence consistency |
| `npm run test:browser` | 14 scenarios, 0 failures |
| `npm run build` | Pass, 145 modules transformed |

Production output:

- HTML: 0.67 kB; 0.39 kB gzip.
- CSS: 62.37 kB; 12.81 kB gzip.
- JavaScript: 572.01 kB; 159.92 kB gzip.
- Source map: 2,164.12 kB.

## Final clean-extraction release gate

A clean extraction of `SESSION-7-R2-STUDY-STUDENT-RUNTIME-FINAL.zip` is the
authoritative portable-release gate. It uses Node `v22.22.3` and no inherited
`node_modules`.

| Check | Result |
| --- | --- |
| `npm ci` | Pass |
| `npm run typecheck` | Pass |
| `npm test` | Pass: 15 files, 77 tests |
| `npm run test:browser` | Pass: 14 scenarios |
| `npm run build` | Pass: 145 modules transformed |
| `npm run generate:traces` | Pass; hashes match the workspace |
| Release-evidence consistency audit | Pass |
| File-manifest replay | Pass |
| Raw central-directory audit | Pass |

The earlier `44 tests / 101 modules` clean-source result is retained only as
historical R1 evidence. It is not the Session 7-R2 release result.

## Unit and deterministic coverage

The 77 unit tests cover:

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
- release identity, totals, bridge identity, trace hashes, and ZIP-name
  consistency across package and release evidence.

The trace generator was run twice. Both files retained identical bytes:

| Trace | SHA-256 |
| --- | --- |
| `math-water-break.trace.json` | `140D2C34DBA75EA4ACF32EF47D5782AA23391D00B0FE41795F6B18B13C6EC709` |
| `reading-save-resume.trace.json` | `246D94C497B24D3A656872E28F83D881555F8DA1B3AC737460A95111534D009A` |

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
- Axe scans with zero findings at any severity in exercised states.

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

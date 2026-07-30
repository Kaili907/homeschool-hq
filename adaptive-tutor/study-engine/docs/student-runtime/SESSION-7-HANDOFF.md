# SESSION 7-R2 — STUDY-STUDENT-RUNTIME HANDOFF

Status: final Session 7-R2 portable release candidate; ready for Manuel Academy
dispatch review.

Runtime version: `0.7.2`  
Target artifact: `SESSION-7-R2-STUDY-STUDENT-RUNTIME-FINAL.zip`

## Outcome

Session 7 delivers a working browser integration lab in which verified Session
2 algorithms and verified Session 3 Study UX components exchange real typed
data through verified Session 1 canonical contracts. It does not merely place
the packages side by side.

Canonical `StudySession` state and canonical `segment-completed` events—not
React state, timer elapsed time, or a provisional Wave 1 event—own progress.
The same versioned event vocabulary is used by UI actions, state transitions,
persistence, evidence, traces, and browser tests.

All five required specialist workstreams were used:

1. Canonical Contract Integration Agent.
2. Engine Adapter Retirement Agent.
3. Student UX Integration Agent.
4. Persistence and Duplicate-Event Agent.
5. Accessibility and Adversarial Test Agent.

The integrated source is:

`adaptive-tutor/study-engine/integration-labs/student-runtime`

The production build is:

`adaptive-tutor/study-engine/integration-labs/student-runtime/dist`

## Verified inputs

- Card 1 canonical contracts:
  `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41`
- Session 2 Study Engine:
  `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770`
- Session 3 Study UX:
  `9E3735FD09C2D19A991C3EB9FAE936204824F0A30C1EDDDAF1AC8A050314CD11`
- Accepted Session 5-R2 reconciliation:
  `39D161F422B36319D9732567867440A5839C06A67895CA02046600C13AC8CB41`
- Accepted Session 6-R2 bridge:
  `0847B14EC8FEFA79E85210ED1565CE8302DC3F81331BC04FCBD895F05B7AD571`
- Frozen Tutor Core v0.2:
  `38205667D56CB4FCC5A8360F1F94098B5FA1D35AE71D22334AA1BC8D43ECC276`

All four archive hashes match exactly. Their working trees are byte-identical
across 70, 58, 64, and 36 files respectively. No missing package was
reconstructed from a summary.

Tutor Core v0.2 and the genuine Session 6-R2 bridge were verified exactly.
Legacy Tutor code was not substituted.

## Canonical runtime

The implemented learner flow is:

Daily goal → check-in → warm-up retrieval → visual teaching → guided practice
→ independent attempt → confidence/effort/frustration check → exit ticket →
engine recommendation → review event → break, continue, save-and-exit, or
finish.

The integration provides:

- fixed opaque learner, lesson, plan, subject, skill, segment/session, event,
  evidence, review, retrieval, and interruption references;
- canonical `SegmentId` as task identity, with no parallel local `TaskId`;
- Card 1 plan, controls, focus, session, evidence, and review validation at
  adapter boundaries;
- a guarded canonical state machine and one versioned event vocabulary;
- real Session 2 focus, break, evidence, review, local-date, language-safety,
  and Jarvis prompt algorithms;
- Session 3 Jarvis, progress, timer, teaching board, reflection, learner
  actions, break, comfort, transcript, and responsive UI components;
- segment completion as the sole primary progress authority;
- visible, minimal, and hidden timers without pressure language;
- required and learner-requested breaks as approved, non-failure events;
- technical interruptions as separate events;
- exact local preservation of response draft, segment, focus target, and
  revision;
- v2 canonical-JSON/SHA-256 resume integrity, session binding, monotonic
  revisions, stale token rejection, tamper rejection, cross-session rejection,
  and unsupported-version quarantine;
- same-ID/same-payload idempotent no-op behavior and conflicting duplicate
  rejection;
- duplicate completion and review prevention;
- aggregate evidence without PII, transcripts, prompt-injection text, or raw
  learner answers;
- supportive reason-coded Jarvis messages with blame-language rejection;
- review recommendations emitted in `America/New_York` learner-local time;
- pacing recommendations only after sufficient comparable, reliable evidence;
- captions, transcript, no-audio, unavailable-speech, missing-media,
  reduced-motion, 130% text, keyboard, touch, and mobile paths.

## Preference policy

Verified Card 5 decision `DEC-012` is implemented:

1. Validate version, integrity/idempotency, and authorization gates.
2. Compose safety and required-accommodation constraints.
3. Apply the most restrictive authorized adult hard maximum.
4. Compute the feasible interval and require manual review if it is empty.
5. Select a valid manual target; otherwise an accepted evidence-sufficient
   engine recommendation; otherwise an established target; otherwise the
   grade-band default.
6. Clamp to the feasible interval and retain reason-coded provenance.

Required breaks and presentation accommodations are preserved as obligations,
not incorrectly converted into duration candidates. The runtime accepts the
requested canonical mock settings: timer mode, maximum duration, break range,
required breaks, reduced motion, no audio, large text, read aloud, speech
input, parent manual override, and accommodation maximum.

## Accepted Session 6-R2 boundary

`@manuel-academy/study-core-bridge` version `1.0.1`, bridge contract `1`, is
the supported boundary. It preserves Tutor Core instructional authority and
enforces safety, single-use permits, ledger-before-projection ordering,
minimized evidence, quarantine, and proposed-not-delivered hooks.

The exact 12-step replacement procedure is in
`provisional-adapter-retirement-report.md`. Replacement requires the real
package bytes and dispatch hash, archive/workspace parity, new adapter parity
tests, receipt mapping without raw-answer leakage, preserved event and resume
invariants, and deletion of the temporary bridge only after all gates pass.

## Demonstrations

1. Grade 5 math: warm-up retrieval, visual explanation, guided example,
   independent attempt, approved water break, exact resume, reflection, exit
   ticket, engine result, learner-local review, and finish.
2. Grade 5 reading: retrieval, teaching support, guided response, independent
   response, low-confidence check, supportive response, save and exit,
   refresh, integrity-checked exact resume, exit ticket, and review.
3. Adversarial console: forged completion rejected; duplicate event ignored;
   raw name, email, answer, and injected instruction omitted; unsupported
   version quarantined; blame language rejected; excessive increase capped;
   repeated breaks remain approved and non-punitive while optionally flagging
   adult review.

## Final Session 7-R2 validation

- Workspace typecheck: pass.
- Workspace unit suite: 15 files, 77/77 tests pass, including the
  release-evidence consistency audit.
- Browser suite: 14/14 pass in desktop and mobile Chromium.
- Production build: pass; 145 modules transformed.
- Clean extraction of `SESSION-7-R2-STUDY-STUDENT-RUNTIME-FINAL.zip`:
  install, typecheck, 77/77 unit tests, 14/14 browser tests, 145-module build,
  and trace generation pass under Node `v22.22.3`.
- Release-evidence consistency audit: pass.
- File-manifest replay: pass.
- Raw central-directory audit: pass.
- Axe: zero findings at any severity in exercised states.
- Deterministic traces: byte-stable across two fresh generations.
- Manual assistive-technology/device matrix: accurately recorded as not run.

Trace SHA-256 values:

- Math: `140D2C34DBA75EA4ACF32EF47D5782AA23391D00B0FE41795F6B18B13C6EC709`
- Reading: `246D94C497B24D3A656872E28F83D881555F8DA1B3AC737460A95111534D009A`

The earlier `44 tests / 101 modules` result and earlier trace hashes are
historical R1 evidence only, not current Session 7-R2 release totals.

## Run locally

```powershell
cd adaptive-tutor/study-engine/integration-labs/student-runtime
npm ci
npm run dev -- --port 4327
```

Open `http://127.0.0.1:4327`.

Useful gates:

```powershell
npm run test:all
npm run build
npm run generate:traces
```

## Deliverables

- Working integrated browser prototype and production build.
- Source-complete package with verified read-only Wave 1 dependencies at their
  original `adaptive-tutor/study-engine` paths.
- `canonical-adapter-manifest.json`.
- `provisional-adapter-retirement-report.md`.
- `event-dictionary.md`.
- `state-diagram.md`.
- deterministic `sample-traces/` plus trace guide.
- five indexed final screenshots.
- `accessibility-report.md` and the adversarial agent report.
- 77 unit tests, 14 browser scenarios, and an HTML Playwright report.
- `validation-report.md`.
- `integration-instructions.md`.
- `source-package-manifest.json`.
- `SESSION-7-R2-STUDY-STUDENT-RUNTIME-FINAL.zip`.
- external post-seal ZIP size and SHA-256 evidence.

## Scope

No calendar/parent runtime was integrated. No Wave 1 package, canonical
contract, Tutor Core, subject package, calendar/parent package, production
system, GitHub state, Supabase resource, database, authentication, identity,
storage service, or deployment was changed.

The final ZIP size and SHA-256 are recorded externally after sealing to avoid
self-reference.

SESSION 7-R2 â€” FINAL RELEASE-EVIDENCE CONSISTENCY HANDOFF

Paste this full handoff, the ZIP link, and its adjacent SHA-256 checksum into
the Manuel Academy dispatch chat.

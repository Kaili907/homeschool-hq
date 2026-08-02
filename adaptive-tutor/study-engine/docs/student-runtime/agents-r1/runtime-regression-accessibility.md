# Session 7-R1 runtime regression and accessibility audit

Role: Runtime Regression and Accessibility Agent  
Scope: audit and test design only; no runtime, bridge, reconciliation, or
timezone source was changed.

## Confirmed Session 7 baseline

- `npm test -- --reporter=dot`: **10 files, 44 tests, 44 passed, 0 failed**.
- `npm run test:browser`: **14 scenarios, 14 passed, 0 failed**.
- The browser baseline includes 12 desktop and 2 Pixel 7 scenarios, Axe scans,
  keyboard-only operation, visible focus, 44px targets, 390x844 and 320x667
  layouts, reduced motion, 130% text, no audio, unavailable speech, missing
  media, exact resume, stale/unsupported saves, repeated breaks, and the math,
  reading, and adversarial demonstrations.
- The retained evidence set is the five documented screenshots:
  math break, math review, reading exact resume, seven adversarial passes, and
  mobile reading with large text.
- Audit host Node was `v24.14.1`; this does **not** satisfy the requested final
  Node 22 gate. The corrected package must be rerun on Node 22.
- The manual screen-reader and real-device matrix in
  `accessibility-report.md` remains accurately marked not run.

Verified Session 6, Session 5-R2, and Tutor Core artifacts were not available
to this agent. Bridge-specific tests were therefore not implemented from
summaries or guessed APIs.

## Preservation matrix

| Existing behavior | Non-regression invariant | Required evidence after R1 |
| --- | --- | --- |
| Canonical state machine | One state machine remains authoritative; UI and bridge callbacks cannot advance progress directly | Existing canonical-flow tests plus full math/reading browser flows |
| Segment progress | Only validated canonical segment completion advances progress | Forged completion and malicious bridge/UI output remain rejected |
| Timer modes and caps | Visible, minimal, and hidden modes remain state-equivalent; safety/accommodation/adult caps remain enforced | Existing policy tests and browser timer-anxiety scan |
| Break semantics | Approved and repeated breaks remain non-failure and separate from technical interruptions | Existing unit/browser break and refresh-loop tests |
| Exact resume | Segment, draft, focus, revision, and binding survive save/refresh; stale, forged, copied, and unsupported state is rejected | Existing resume suite plus genuine checkpoint compatibility tests |
| Idempotency | Replay is a no-op; same ID with different payload is rejected | Existing duplicate tests plus outbox replay tests |
| Authority | Tutor Core alone owns mastery, misconceptions, prerequisites, instructional directives, and instructional safety | Negative tests for UI/adapter attempts to invent those outcomes |
| Privacy | Canonical evidence and bridge/downstream payloads contain no PII, raw answer, transcript, or injected instruction | Existing adversarial tests plus genuine bridge projection tests |
| Accessibility | Captions/text fallbacks, focus, keyboard, touch, mobile, reduced motion, and supportive language are unchanged | All 14 browser tests, Axe, screenshots, and new quarantine/safety-state checks |
| Demonstrations | Math, reading, and seven adversarial outcomes remain inspectable | Existing fixed-path screenshots regenerated after final integration |

## R1 regression plan

Tests must bind to the verified package exports and fixtures after checksum
verification; names below describe behavior, not presumed external APIs.

| Area | Concrete case and required assertion |
| --- | --- |
| Genuine bridge | Composition root reports package `@manuel-academy/study-core-bridge`, version `1.0.0`, `bridgeContractVersion: 1`; no temporary bridge identifier is reachable |
| Retirement gate | First prove parity and all negative cases; then assert no import, manifest entry, trace value, or runtime reference to `student-runtime.session6-bridge.v2` remains |
| Safety order | Instrument verified capabilities: Pre-Core urgent-safety gateway is called before Tutor event validation, evidence projection, checkpoint, outbox, or downstream proposals; a blocked request invokes none of the later stages |
| Event validation | Valid Tutor event proceeds once; unknown event is quarantined without state progress, Core authority claims, checkpoint mutation, or outbox proposal |
| Version quarantine | Unsupported bridge or event version is quarantined, never silently downgraded, and cannot invoke Tutor Core or downstream hooks |
| Privacy | Submit name, email, phone, address, raw answer, support transcript, media content, and prompt injection; minimized Study evidence and every serialized proposal contain none of them |
| Transient media | Learner-media projection may support the active view but is absent from checkpoint, evidence, trace, outbox, and resume serialization |
| Tutor authority | UI and forged Tutor events claiming mastery, misconception, prerequisite, directive, or instructional-safety outcomes are rejected/stripped; Study runtime records no invented authority |
| Checkpoint | Genuine exact-checkpoint boundary preserves canonical session/segment identity, exact draft reference and revision, timer/break state, and configured timezone across refresh; stale/conflicting replay remains rejected |
| Outbox idempotency | Replaying one accepted command creates exactly one stable proposal and one downstream-hook proposal; same ID/different payload is rejected or quarantined |
| Session 5-R2 parity | Fixture-driven comparisons cover DEC-004, DEC-012, canonical IDs, event vocabulary, privacy projections, resume rules, and adult-control precedence; compare outputs/reason provenance against accepted R2, not copied Session 7 expectations |
| Temporary digest | Do not classify `2231…` until the original artifact/tree/manifest can be hashed directly; record the evidence proving whether it is a ZIP, extracted-tree, source-only, manifest, or other digest |

Suggested owned tests are
`unit/session6BridgeAdapter.r1.test.ts`,
`unit/session6BridgeAuthority.r1.test.ts`,
`unit/reconciliationR2Parity.r1.test.ts`, and an R1 browser regression spec.

## Timezone test matrix

The timezone must be explicit input and never inferred from the host.

| Case | Required assertion |
| --- | --- |
| Sample default | `America/New_York` is accepted and preserved verbatim in the review recommendation |
| Non-DST zone | `Asia/Kolkata` is accepted and produces stable local calendar output |
| Invalid values | Blank, malformed, traversal-like, and unsupported values such as `Mars/Olympus` are rejected before session creation |
| Spring DST boundary | Around `2026-03-08T07:00:00Z`, New York skips from 01:59 EST to 03:00 EDT without changing the intended local review date |
| Host independence | Identical inputs run with different process `TZ` values produce byte-identical recommendation/traces |
| Persistence | Configured IANA timezone survives save, exact resume, review generation, and deterministic trace output |

If timezone configuration becomes learner-visible, its invalid state also
needs an associated accessible error, programmatic label, focus placement,
and Axe scan. If it remains canonical mock input, no UI control should be
invented merely for this test.

## Accessibility revalidation

Run the complete browser baseline after the genuine bridge is installed.
Additionally scan and keyboard-test the urgent-safety and quarantine states:
focus must move predictably, status must be announced once without timer
pressure or blame, raw quarantined content must never render, and break/save
actions must remain reachable when allowed. Transcript filtering at the
bridge boundary must not remove the learner’s accessible on-screen text or
captions.

Regenerate the five existing screenshots at their fixed paths. Any changed
copy may update pixels, but each screenshot must retain the same semantic
state and no privacy-sensitive content.

## Portability release gate

The raw central-directory audit must report zero backslashes, absolute paths,
traversal paths, duplicates, case/Unicode-normalized collisions, symlinks,
personal home paths, embedded ZIPs, and `node_modules`. It must also prove
local-header/central-directory name parity. The file manifest must use sorted
forward-slash relative paths and hashes.

After auditing, extract into a clean directory and run on Node 22:

```text
npm ci
npm run typecheck
npm test
npm run test:browser
npm run build
npm run generate:traces
```

Windows extraction alone must not be reported as Linux/macOS execution.
Cross-platform extraction requires actual Windows, Linux, and macOS runners
or must remain an explicit limitation.

## Release decision

The existing Session 7 behavior is currently green. Session 7-R1 cannot pass
this workstream until the verified inputs are available, genuine bridge and
R2 tests execute, the Node 22 clean-package matrix passes, the portability
audit passes, and accessibility remains green. Temporary bridge deletion must
be the final step after parity and negative tests, never the first.

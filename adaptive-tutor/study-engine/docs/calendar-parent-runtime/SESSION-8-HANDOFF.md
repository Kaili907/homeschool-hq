# SESSION 8 — STUDY-CALENDAR-RUNTIME HANDOFF

## Outcome

Card 8 is complete as a working local Wave 2 integration lab. It connects a
Session 2 engine review recommendation through Card 1 canonical review/session
contracts into a bounded review queue, learner-local calendar, aggregate result
feedback, minimized parent evidence, all ten parent controls, and a
credential-free Romeo Virtual Academy adapter.

No Student Study-UX integration was performed. No production system or Wave 1
package was edited.

## Verified inputs

- `CARD-1-STUDY-CONTRACTS.zip`  
  `79BA0F39688DB42197947915AA421BCA540AD060C072E898E86619F0A66B6F41`
- Study-Engine ZIP  
  `979EEAC55DCDE6F47F684B0D6A9C7793FCB53E76F693D07E11A83B3FD9FFB770`
- Study-Integrations ZIP  
  `F4AB726446DA4129E3548919D91E56B85C93FF31BE63DEA692B0BA7926C39C1B`
- Card 5 reconciliation ZIP (observed/pinned on arrival)  
  `2231E758AA9DD309565E374BE1D1B78A2835C8A3F5A221562BE04DB78900E2E7`

Archive-to-workspace parity found zero mismatches. The upstream executable
baseline passed 496 of 496 tests. Card 5 passed 7 of 7 probes and 19 of 19
Node tests; it remains `PASS_WITH_BLOCKER` and does not authorize final
assembly.

## Integrated flow

```text
Engine review recommendation
→ canonical StudentSkillReview
→ stable local review-queue entry
→ priority + hard daily limits + required-instruction reserve
→ learner-local calendar block
→ canonical attempt/session result
→ aggregate evidence in an idempotent result-return outbox command
→ Session 2 scheduler
→ interval expansion, reteaching, or prerequisite remediation
→ minimized parent-visible evidence
```

## Delivered behavior

- All 13 Session 4 calendar block types map exhaustively to canonical
  `StudyTaskType` values; reverse mapping refuses ambiguous guesses.
- Internal, external, canonical review, recommendation, session, and result IDs
  remain separate and stable, including canonical `SegmentId` bytes.
- Estimated duration, actual active duration, break duration, and paused
  duration remain distinct.
- The partial lesson records exactly 3 of 6 segments complete, 16 estimated
  minutes remaining, segment 4 resume metadata, elapsed seconds, response draft
  reference, and one idempotent continuation.
- Drag/drop rescheduling, parent edit, parent-created activity, PE, and outside
  activity paths are executable and tested.
- Planned breaks, requested breaks, outside interruptions, and technical
  interruptions remain distinct neutral states.
- Completion bars count required segment units rather than elapsed time.
- Review priorities and item/minute limits are deterministic. Overdue review
  cannot crowd out reserved required instruction or leapfrog a blocked higher
  priority item.
- Same-day recommendations become household-local retry intents. A date-only
  recommendation never invents a time; `retryNotBefore` stays null until an
  authorized adult/scheduler supplies an offset instant after required
  preparation and a completed break/session boundary.
- IANA timezone validation covers New York 2026 spring-forward gaps, fall-back
  overlap disambiguation, explicit-offset placement, persisted local-date/zone
  snapshots, local-date boundaries, and host-timezone independence.
- Queue, calendar import, continuation, parent command, result, and Romeo
  projection duplicates are prevented or idempotently collapsed.
- Concurrent parent writes require the expected controls revision; stale
  updates fail without implicit last-write-wins.
- Adult-private note bodies use a separately authorized projection.
  Parent-only audiences are never widened; adult operational events are
  metadata-only; the student-private projection has no existence signal.
- Parent recommendation projections exclude PII, raw answers/responses,
  transcripts, diagnosis text, hidden behavioral scores, credentials, and
  unknown fields.

## Parent controls

All ten are executable, logged, tested, and visible in the mobile demo:

1. Accept recommendation
2. Reject recommendation
3. Set maximum work duration
4. Set break duration
5. Hide timers
6. Add accommodation
7. Reschedule incomplete work
8. Mark interruption
9. Add private note
10. Request teacher or tutor review

The rejection demonstration retains the proposed increase as history, keeps
the parent decision effective, and uses neutral language.

## Parent precedence

Card 5 DEC-012 is applied through a typed adapter that calls policy version 1:

1. Gate supported version, integrity, actor authorization, and active decision.
2. Intersect safety constraints/vetoes, required accommodation bounds, and the
   most restrictive authorized adult hard maximum.
3. Route an empty feasible interval to manual review.
4. Select the first valid candidate from active manual target/hold/reduce,
   accepted engine recommendation, established target, or grade default.
5. Clamp the candidate to the feasible interval.

Every outcome includes policy status/reason, bounds, candidate provenance,
binding constraints, applied clamp, and a parent-facing winner/explanation.
Rejection suppresses only the referenced recommendation and preserves history.

## Romeo Virtual Academy

The local adapter supports:

- stable external assignment ID;
- required `schemaVersion: 1` and a distinct opaque `hostLaunchRef`;
- title, course, due date, and estimated duration;
- completion state and completion updates;
- separate parent- and student-entered progress;
- linked Manuel Academy tutoring skill or lesson with
  `VersionedReference<StudyPlanId>`;
- resume note;
- external HTTPS URL reference;
- last-checked timestamp;
- `manual`, `approved-import`, and `browser-assisted-reference` modes.

It recursively rejects credential keys and authorization strings, including
nested/cyclic/Map/Set input; URL user information; credential query/fragment
parameters; PIN/OTP/TOTP/MFA, verification/recovery/OAuth codes, session
material, SAML responses, SSO tickets, and magic links; and explicit
credential assignments in free text. It never requests or stores credentials
and performs no login, fetch, scraping, persistence, or production sync. The
adapter/adult record may retain the validated HTTPS reference and resume note,
while the public/calendar projection exposes neither.

## Required demonstrations

The local browser has six deterministic tabs:

1. Retrieval failure → reteaching → same-day review → queue/calendar → limit
2. Successful review → interval expansion → parent evidence
3. Partial 3-of-6 lesson → exact resume → remaining duration → one continuation
4. Parent rejects increase → history retained → parent decision effective
5. Accommodation → 12-minute maximum → 8-minute break → hidden timer
6. Romeo manual assignment → tutoring link → resume/completion update → zero
   credentials

## Validation

- Upstream baseline: **496/496 tests passed**
- Card 5 reconciliation: **7/7 probes and 19/19 tests passed**
- Session 8 suite: **86/86 tests passed**
- Strict TypeScript: **passed**
- Vite browser build: **passed**
- Node bundle/dependency audit: **passed**
- `@types/node@24.13.3`: **explicit and verified**
- Dependency audit: **0 vulnerabilities**
- Deterministic scenario and parent-precedence traces: **passed**
- Chrome desktop/mobile QA: **4/4 screenshots passed**
- In-app Browser QA: **tab interaction, mobile controls, zero console warnings/errors**
- Mobile: **10 controls, 44px minimum buttons, no page error or overflow**

Full evidence is in `validation-report.md` and `privacy-report.md`.

## Specialist-agent record

Five required specialist agents contributed:

1. Review Scheduler Integration Agent — canonical review/queue/result seam and
   17 focused tests
2. Calendar and Resume Agent — calendar/DST/resume/dedupe seam and 17 focused
   tests
3. Parent Controls Agent — all ten controls, privacy projection, precedence,
   expected-revision CAS, and 15 focused tests
4. Romeo Virtual Academy Adapter Agent — credential-free adapter and 16 focused
   tests
5. Privacy, Timezone, and Adversarial Validation Agent — 16 adversarial tests
   and residual-risk review

The adversarial agent found free-text and structured Romeo credential aliases,
including OTP/TOTP, MFA, OAuth, session, SAML, SSO, and magic-link material.
The Romeo adapter now fails closed on those paths, and both regression suites
pass.

## Key artifacts

- Runtime/source: `integration-labs/calendar-parent-runtime/`
- Canonical adapter manifest: `canonical-adapter-manifest.json`
- Event dictionary: `review-to-calendar-event-dictionary.md`
- Parent/Card 5 procedure: `CARD-5-REPLACEMENT.md`
- Timezone strategy: `timezone-strategy.md`
- Romeo documentation: `romeo-adapter.md`
- Privacy report: `privacy-report.md`
- Validation report: `validation-report.md`
- Integration instructions: `integration-instructions.md`
- Screenshots: `integration-labs/calendar-parent-runtime/screenshots/`
- Deterministic scenario trace:
  `integration-labs/calendar-parent-runtime/traces/deterministic-traces.json`
- Parent-precedence trace:
  `integration-labs/calendar-parent-runtime/traces/parent-precedence-traces.json`

## Package

Download:
`manuel-academy-session-8-study-calendar-runtime.zip`

The companion `.sha256` file beside the archive is generated after packaging.

This handoff is for the Manuel Academy dispatch chat. Production integration
still requires closure of Card 5’s Tutor Core blocker, host authorization,
transactional persistence/dedupe and result delivery, retention/deletion
policy, Romeo host allowlisting, security/accessibility/privacy review, and
explicit ownership.

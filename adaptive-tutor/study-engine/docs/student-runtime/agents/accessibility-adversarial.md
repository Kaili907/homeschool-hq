# Accessibility and adversarial integration agent

Status: focused agent suites pass; root integration validation remains the final
release gate.

Date: 2026-07-29

## Scope

This agent changed only Session 7-owned files:

- `integration-labs/student-runtime/src/adversarial/probes.ts`
- `tests/student-runtime/e2e/accessibility.spec.ts`
- `tests/student-runtime/e2e/adversarial-resilience.spec.ts`
- `tests/student-runtime/unit/accessibilityAdversarial.agent.test.ts`
- this report

Wave 1 packages, canonical contracts, Tutor Core, subject packages,
calendar/parent packages, production systems, GitHub, Supabase, database,
authentication, identity, storage, and deployment were treated as read-only.

## Deterministic coverage

| Risk | Evidence |
| --- | --- |
| Timer anxiety | Visible, minimal, and hidden modes leave segment progress unchanged; minimal/hidden modes expose no numeric countdown or per-second live announcement; pressure and blame wording is rejected |
| Random answers | An incorrect warm-up choice receives support and grants no segment completion before the learner retries |
| Repeated breaks | Three water breaks preserve the selected response and segment position; every break remains approved/non-failure; the third adds the `repeated_break_pattern` adult-review signal |
| Refresh loops | Three consecutive technical recoveries preserve the exact local draft and explicitly distinguish interruption recovery from a learner break |
| Stale resume tokens | A token retained in a second tab is rejected after the first tab writes a newer revision, while the newer save remains available |
| Forged histories and receipts | Integrity tests reject cross-session, cross-segment, mismatched response-reference, and reused request-ID receipts; ready feedback cannot complete without its bound `continue` receipt |
| Prompt injection and privacy | Name, email, phone, address, raw-answer sentinel, and injected instructions are absent from canonical evidence, review, and event output; sensitive field names are also forbidden |
| Duplicate output | Replaying the exit-ticket completion keeps one canonical completion, one evidence record, and one review record |
| Unsupported versions | The local bridge rejects an unsupported schema, and the browser resume store quarantines an unsupported envelope without rendering its raw draft |
| Blame language | `focus_blame` and `punitive_break_language` findings are both required for the attack string |
| Excessive pacing increase | A five-session recommendation remains capped at the configured 10 percent maximum increase |
| Keyboard-only | Skip link, check-in, disclosure, break entry, focus indication, break-heading focus, transcript Escape behavior, and native response controls are exercised without pointer input |
| Speech/audio fallback | Removed browser speech APIs leave typing and learner actions enabled; “answer aloud” produces a calm text fallback; no-audio retains captions and transcript |
| Captions/transcript | Captions remain enabled even after an attempted disable; the transcript opens as a named region and closes with Escape while restoring focus |
| Missing media | `?media=missing` renders the adjacent complete text equivalent without blocking the response |
| Reduced motion and large text | OS plus in-app reduced motion yields no non-zero computed animation; large text measurably increases text and retains reflow |
| Mobile | Pixel 7 / 390 by 844 checks cover 44 CSS-pixel targets, active response controls, large text, reduced motion, adversarial results, and document-level overflow |
| Axe | Serious and critical violations are rejected on home, check-in, learning, hidden timer, break, fallback, recovery, stale-token, quarantine, mobile, and adversarial-result states |

## Adversarial probe behavior

The learner-visible console still has exactly seven rows. The rows are backed
by real local calls, not hard-coded pass labels:

1. forged canonical completion rejection;
2. duplicate completion/evidence/review replay protection;
3. PII, raw-answer, and prompt-injection exclusion;
4. unsupported bridge-version quarantine;
5. reason-coded blame/punitive-language rejection;
6. bounded pacing increase;
7. approved, non-punitive repeated breaks with an adult-review reason code.

The privacy row checks both values and field names. The repeated-break row
requires both `repeated_break_pattern` and `approved_break_not_failure`.

## Integrity finding and resolution

The initial Session 7 workspace validator checked only the bridge version and
two withheld-authority fields on Tutor Core boundary receipts. That was not
enough to distinguish a genuine local receipt from a valid-looking forged
receipt. The finding was routed to the persistence/duplicate-event agent.

The replacement v2 receipt now binds:

- canonical session ID;
- exact canonical segment ID as the sole task reference;
- canonical response-draft reference;
- monotonic submission revision and legal timestamp;
- unique request ID;
- allowlisted directive/reason pair;
- matching feedback-to-receipt reference before completion.

The companion regression test passed for those bindings. A future bridge must
preserve or strengthen the same invariants.

## Manual boundary

Automation does not establish screen-reader usability on real devices. These
remain accurately marked **not run** unless separately executed:

- NVDA with Chrome on Windows;
- Narrator with Edge;
- TalkBack/Chrome and VoiceOver/Safari;
- 200 percent browser zoom, distinct from the in-app large-text preference;
- real speech synthesis failure, microphone permission denial, and mobile
  software-keyboard behavior;
- caption timing and announcement-count review with a screen reader.

## Validation

Focused results from the integration-lab package:

- `npx vitest run ../../tests/student-runtime/unit/accessibilityAdversarial.agent.test.ts --reporter=verbose`
  - 1 file passed
  - 5 tests passed
- `npx playwright test adversarial-resilience.spec.ts accessibility.spec.ts --project=desktop-chromium`
  - 8 tests passed
  - includes Axe scans on home, check-in, lesson, break, fallback, adversarial
    results, refresh recovery, stale-token rejection, and quarantine states
- `npx playwright test mobile.runtime.spec.ts --project=mobile-chromium`
  - 2 tests passed
  - includes Pixel 7 / 390 by 844 reflow, 44-pixel targets, reduced motion,
    large text, Axe, and adversarial result reachability

An interim `npm run typecheck` was intentionally run while the v2 receipt and
idempotency migration was still changing. Its failures were all in shared
in-flight migration callers and were reported to the root agent; the four
probe-local optional-metadata errors found in that run were corrected before
the focused green suites above. The root agent owns the final post-merge
`typecheck`, full unit/browser suite, and production-build gates.

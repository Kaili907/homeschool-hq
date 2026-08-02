# Accessibility and Adversarial Test Agent Report

Status: browser-contract test implementation complete; integrated runtime
execution is a Session 7 validation-gate activity.

Date: 2026-07-28

## Scope and ownership

This agent worked only in the Session 7-owned roots and created:

- `tests/student-runtime/e2e/accessibility.spec.ts`
- `tests/student-runtime/e2e/mobile.runtime.spec.ts`
- `docs/student-runtime/accessibility-adversarial-test-agent-report.md`

No Wave 1 package, canonical contract, Tutor Core, subject package,
calendar/parent package, production system, GitHub, Supabase, database,
authentication, identity, storage, or deployment file was changed.

## Read-only sources inspected

- Session 3 Study UX application, content, styles, state store, and E2E support.
- Session 3 accessibility, keyboard, timer/audio, mobile, refresh-recovery, and
  adversarial browser specifications.
- Session 3 accessibility plan, accessibility report, and adversarial test plan.
- Session 7 `runtimeTypes.ts`, including the seven
  `AdversarialProbeResult.id` values.
- Session 7 `catalog.ts`, including stable canonical subject/lesson/segment/task
  projection and canonical parent-preference inputs.
- Session 7 Playwright configuration and package metadata.
- The CARD 7 accessibility and adversarial acceptance matrix.

The tests deliberately carry forward Session 3's strongest patterns: role/name
queries, keyboard activation through native controls, semantic segment progress,
calm timer choices, break focus movement, speech-capability removal before page
load, computed-motion inspection, Axe checks, and document-overflow measurement.

## Automated coverage

| Test | Covered risks and acceptance evidence |
| --- | --- |
| `home, check-in, lesson, and timer-anxiety states are semantic and axe-clean` | Required home actions; `main#main-content`; named segment-progress navigation; Axe on home/check-in/learning; Visible/Minimal/Hidden timer controls; no numeric ticks in minimal/hidden; no per-second live announcement; timer changes do not alter segment progress; no hurry, failure, or countdown-pressure language |
| `a keyboard-only learner has visible focus, logical order, and direct break access` | Skip route; keyboard-only Enter/Space flow; at least 2px outline or visible focus shadow; progress before learner action in DOM order; direct `I need a break`; focus moves to break heading; Axe on break state |
| `reduced motion, large text, no audio, unavailable speech, and missing media keep text paths usable` | OS reduced motion plus in-app choice; no nonessential computed animation; large-text increase; no-audio and removed speech APIs; calm text/caption fallback; deterministic missing-media text equivalent; response and break remain operable; no page overflow; Axe |
| `the adversarial demonstration exposes exactly seven passing, axe-clean results` | Forged completion rejected; duplicate ignored; PII/raw data omitted; unsupported version quarantined; blame rejected; excessive duration increase capped; repeated breaks remain non-punitive and can request adult review; exactly seven passing rows; Axe |
| `390x844 reading runtime reflows with large text, reduced motion, and 44px targets` | Exact required viewport; home, check-in, learning, large-text, and open-support overflow checks; 44x44 home, disclosure, timer-choice, and break targets; active response remains enabled; zero nonessential computed animation; Axe |
| `mobile adversarial results remain reachable and do not overflow the page` | Seven result rows are reachable at 390x844 and do not create document-level horizontal scrolling |

The seven-result UI demonstration is an integration oracle, not a substitute for
the underlying unit and deterministic-trace assertions. Each pass row must be
derived from the runtime's real probe result, and must never be a hard-coded
claim that bypasses its adapter, integrity, privacy, language, duration, or break
logic.

## Committed UI contract assumptions

The specifications intentionally depend on the following Session 7 contracts:

1. Home exposes accessible buttons named exactly `Start mathematics`,
   `Start reading`, and `Run adversarial probes`.
2. The repeated-content skip link is named either `Skip to current activity` or
   `Skip to main content`, and moves focus to `main#main-content`.
3. Check-in exposes a native radio whose accessible name contains
   `Ready to begin`, followed by a button whose name contains `Begin warm-up`.
4. Lesson progress is
   `nav[aria-label="Learning segment progress"]`.
5. Access preferences are in a native `details` disclosure whose `summary` is
   `Comfort & access`.
6. Its timer fieldset/radiogroup has the accessible name containing `timer` and
   exact native radio names `Visible`, `Minimal`, and `Hidden`.
7. The learner action is a native button named exactly `I need a break`. It may
   be directly visible or inside a native disclosure whose summary includes
   `learning support` or `Jarvis can help`.
8. The break screen heading contains the word `break` and receives focus on
   entry.
9. The in-app preference labels use `Reduced motion`, `No motion`, or `None`;
   `No audio`; and `Large text` or `Larger`. These are native radios or
   checkboxes.
10. With browser speech APIs absent, learner-facing text clearly says that
    audio/voice is off or unavailable, while the active response control and
    break action remain enabled.
11. `?media=missing` is the deterministic local-lab hook for forcing media
    failure. It renders the complete adjacent text equivalent and a calm message
    containing `visual` or `media`, `unavailable`, and `text`/`same idea`. The
    query is test-only presentation input; it must not alter canonical session
    authority, progress, evidence, or Tutor Core state.
12. All focusable controls have a visible focus treatment of at least a 2 CSS
    pixel outline or an equivalently visible box shadow.

These assumptions are deliberately semantic. The tests do not depend on CSS
class names, component nesting, internal React state, or local event shapes.

## `data-testid` inventory

Only one test ID is required:

| Test ID | Reason a semantic query is insufficient |
| --- | --- |
| `adversarial-results` | It scopes the deterministic integration-probe output away from similarly worded explanatory copy. Inside that scope, the tests return to semantic `listitem` roles and learner-visible pass text. |

No test ID is required for home actions, access settings, timer modes, progress,
break entry, active response, fallback messaging, focus, motion, or layout.

## Axe and manual-test boundary

Automated Axe checks reject serious and critical findings on the states reached
by this suite. Keyboard behavior, focus styling, computed animation, touch
target size, and page overflow are asserted separately because Axe alone cannot
establish those outcomes.

The following checks require a human/device pass and must not be reported as
passed merely because automation succeeds:

- NVDA with Chrome on Windows through a mathematics session and break.
- Narrator with Edge through reading and unavailable speech input.
- TalkBack/Chrome or VoiceOver/Safari for resume, one task, break, and return.
- Browser zoom at 200% (distinct from the in-app large-text preference).
- 320x568 portrait and 667x375 landscape visual/keyboard review.
- Real speech-synthesis failure, recognition denial, and mobile software
  keyboard behavior.
- Caption timing before actual speech and announcement-count review with a
  screen reader.

Record unavailable assistive-technology/device combinations as `not run`; never
as a pass.

## Release interpretation

The new files can be typechecked and discovered before the runtime UI is fully
assembled. A passing Session 7 browser run additionally requires the integrated
UI to honor every contract above and the seven probe rows to reflect real runtime
results. Any serious/critical Axe violation, inaccessible 44px target, hidden
timer leak, focus loss, pressure language, animated reduced-motion state,
missing text fallback, horizontal overflow, or non-pass probe row blocks the
accessibility/adversarial portion of handoff.

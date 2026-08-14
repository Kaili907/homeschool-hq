# Start Lesson live investigation R1

Date: 2026-08-14  
Branch: `mac/dashboard-start-lesson-live-fix-r1`  
Authoritative base: `a7c6edee867e0d3f546aaa6e0442fac434b75c84`  
Deployed alias: `https://family-dashboard-auto-r1--manuel-academy.netlify.app/family-pilot`

## Status

`BLOCKED` — the reported desktop-Chrome failure was not reproduced, so an exact root cause and justified product-code fix are not available.

The configured Chrome browser connection was unavailable in this Codex session. An isolated Playwright Chromium context was therefore used only as a synthetic deployed-alias probe and as repository regression evidence; it is not evidence from the reporting user's browser profile or persisted household state.

## Deployed-alias reproduction

[VERIFIED] A fresh synthetic Grade 3 learner was created at the deployed alias in a 1594 × 920 Chromium viewport. School Plan materialized the real admitted assignment below immediately before Dashboard composition:

- learner ref: `family-setup-student:63b03c8e-0996-4cec-b779-c44ea2675a3b`
- assignment ref: `assignment:1i4lgdw:9mu3l8`
- lesson ref: `ma-g3-mathematics-u01-l01`
- title: `Launch and diagnostic: making sense of unfamiliar problems`
- state before activation: `planned`

[VERIFIED] The reported failure did not occur. A coordinate-level mouse click at the exact visible center opened Study step 1. Save and exit returned to Dashboard. Reload preserved the active assignment, and Tab → Enter on the skip link → Tab → Space on `Continue lesson` reopened Study step 1 with the same assignment and session reference.

`LIVE_REPRODUCED: NO`

## Pointer hit-test

At the deployed-alias button center `(225.203125, 507.390625)`:

- bounding rectangle: `x=152`, `y=484.390625`, `width=146.40625`, `height=46`
- `document.elementFromPoint(x, y)`: `BUTTON.family-dashboard__button-primary`
- computed `pointer-events`: `auto`
- computed visibility: `visible`
- computed opacity: `1`
- computed position / z-index: `relative / 1`
- captured events: `pointerdown`, `pointerup`, and `click`, all targeting the intended button
- overlap stack began with the button, followed by `SECTION#family-dashboard-mission`, the daily area, primary grid, shell, Dashboard root, body, and HTML
- no Jarvis layer, pseudo-element, fixed layer, transparent overlay, or disabled control appeared above the button

`POINTER_CLICK: PASS`  
`KEYBOARD_ACTIVATION: PASS`  
`OVERLAY_RESULT: NONE OBSERVED`

## Command and learner binding

[VERIFIED] The visible mission work ref came from the just-built `FamilyPilotStudentDashboardModel`. `ActiveStudentDashboard.commandForWork` authorizes only a `START` or `CONTINUE` command whose learner ref equals the active learner and whose assignment ref equals the presentation ref. The synthetic deployed-alias run opened the exact assignment listed above, changing it from `planned` to `active` and retaining it through save/reload/resume.

The retained session ref was:

`block:3c8e-0996-4cec-b779-c44ea2675a3b:2026-08-14:ma-g3-mathematics-u01-l01:session`

`AUTO_PLANNER_COMMAND_STATE: CURRENT FOR SYNTHETIC REPRO`  
`ASSIGNMENT_REF: assignment:1i4lgdw:9mu3l8`  
`LEARNER_BINDING: EXACT MATCH FOR SYNTHETIC REPRO`

This rules out pointer hit-test blocking, an invisible overlay, CSS pointer-events, a disabled mismatch, an unbound handler, command rejection, learner-binding rejection, and Study route failure for a freshly materialized assignment in the tested deployed state. It does not rule out a condition unique to the reporting user's persisted browser state.

## Root cause and fix decision

`ROOT_CAUSE_CLASS: OTHER — FAILURE NOT REPRODUCIBLE / ROOT CAUSE UNKNOWN`

No product behavior was changed. Applying CSS, command-lifecycle, or Study changes without a reproduced failing state would be a blind patch and could disturb accepted Auto Planner and Study authority.

The concrete acceptance gap was corrected in test coverage: the existing production helper `startFromHome` selects the lower Today's Work row by accessible name `Start <lesson title>`. It did not select the orange mission button whose accessible name is `Start lesson`. The visual harness selected the orange button, but it used Playwright locator activation against a fixture callback rather than a newly materialized production assignment and exact center coordinates.

## New regression coverage

`tests/browser/final-family-pilot-launch.spec.ts` now adds:

- a real Grade 3 learner and School Plan materialization;
- the reported 1594 × 920 viewport;
- exact assignment/lesson/title/state proof before activation;
- visibility and enabled-state assertions for the orange `Start lesson` button;
- `elementFromPoint` and `elementsFromPoint` proof at its visible center;
- `page.mouse.click(x, y)` at that center;
- exact assignment transition into Study;
- Save and exit;
- reload;
- Tab + Enter + Tab + Space keyboard resume;
- stable assignment and Study session refs after resume.

## Verification

[VERIFIED] All commands below completed successfully on 2026-08-14:

- `npm run typecheck` — pass
- focused Dashboard unit tests — 3 files, 35 tests passed
- Auto Planner and final-host unit tests — 7 files, 53 tests passed
- Family Pilot unit suite — 88 files, 925 tests passed
- focused new production regression — 1 test passed
- Dashboard visual/accessibility suite — 8 tests passed, including phone, tablet, laptop, desktop, reduced motion, focus, and skip-link checks
- enabled production build — pass; 90 courses and 8,292 projected lessons
- browser answer-authority audit — pass; 0 findings and 0 authority-name occurrences
- production Family Pilot browser suite — 14 tests passed
- `npm run audit:web-release` — `WEB_RELEASE_SECURITY_GATE PASS`

## Acceptance blocker

Acceptance remains blocked until the failure can be reproduced in the reporting desktop Chrome state, or a sanitized export of the relevant persisted state and browser diagnostics can demonstrate a failing command or UI condition. The Chrome browser extension must be connected through **Settings → Computer use** for direct inspection of that browser session. No deployment was performed.

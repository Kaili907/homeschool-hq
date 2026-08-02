# AI Safety Center accessibility review

Date: 2026-07-28  
Target: browser prototype in `app/features/ai-safety-center/**`  
Review level: WCAG 2.2 AA-oriented static/semantic review

## Outcome

The parent and student views passed the automated static accessibility suite
after remediation. The review covers all five parent sections, all four
student sections, unavailable-history rendering, role-specific controls,
privacy/emergency copy, CSS contrast, focus rules, reduced motion, forced
colors, responsive rules, and text fallback for playback.

This is an integration-ready accessibility review, not a certification of the
eventual host application. Browser/screen-reader behavior must be rechecked
after the feature is mounted in the production shell.

## Automated evidence

Test file: `tests/ai-safety/ui-accessibility.test.tsx`

The suite renders every parent/student route to static HTML and verifies:

- unique element IDs;
- every `aria-labelledby` reference resolves;
- every explicit label `for` reference resolves;
- every fragment link resolves;
- every input, select, and textarea has an explicit, nested, or ARIA name;
- every button declares a safe `type`;
- skip-link, main landmark, navigation name, and current section semantics;
- role-specific controls do not appear in the wrong view;
- severity has visible text and is not color-only;
- student reporting can be submitted without narrative details;
- parent-review and tutor-message safety-exception explanations;
- fixed summary-only notification safeguard;
- unavailable history is not rendered as a confirmed empty state;
- no hotline number, raw-audio player, or audio-file URL in rendered copy;
- tutor text remains present when playback is unavailable;
- CSS focus, target size, contrast, reduced-motion, forced-color, and responsive
  safeguards.

Targeted result recorded during review:

```text
Test Files  1 passed (1)
Tests       21 passed (21)
```

The final combined safety run also passed all 99 tests across seven files, and
the UI's existing model/component suite passed all five tests.

## WCAG-oriented review

### Perceivable

- Normal body text uses relative units and a 1.55 line height.
- Safety severity/status is communicated with visible words in addition to
  color and border treatment.
- The muted text token was darkened to `#556176`. It meets or exceeds 4.5:1
  against the white, surface-soft, canvas, and `#edf1f6` backgrounds checked by
  the suite.
- The transcript and tutor-help timeline are semantic lists with speaker/time
  text.
- Playback is additive. Text remains the authoritative presentation, and no
  raw microphone recording or audio element is required.
- Decorative marks are hidden from assistive technology.
- Forced-color CSS restores explicit borders around interactive/status cards.

### Operable

- Navigation, filters, details, forms, report, pause, retention, export, and
  deletion use native controls.
- A skip link targets the focusable main landmark.
- Focus-visible rules provide a three-pixel high-contrast outline.
- Common navigation, button, field, day, and card targets are at least 2.75rem
  (44 CSS pixels at the default root size); smaller text buttons still exceed
  the WCAG 2.2 minimum target requirement.
- Section changes move focus to the main content so keyboard users do not have
  to traverse the navigation repeatedly.
- Reduced-motion CSS suppresses spinner/transition motion.
- Responsive layouts collapse grids while retaining student report and pause
  controls.

### Understandable

- Parent and student navigation labels are role-appropriate.
- Form controls have visible labels; optional report fields are explicitly
  marked optional.
- Withheld-answer cards explain why an answer stopped and give a safe next
  step.
- Student copy says parents can review tutor conversations and safety events,
  safety concerns may be shared, and the student is not in trouble.
- The separate mindset journal is not represented as Safety Center data; the
  tutor-message safety exception must not be generalized to that journal
  without a future integration contract.
- Missing history says records cannot be confirmed and keeps safety controls
  available.
- Critical copy says the interface is not an emergency service and directs the
  student to a trusted adult without inventing service information.
- Destructive deletion is a tracked request with an explicit confirmation and
  hold explanation.

### Robust

- The feature uses header, nav, main, footer, section, article, list, time,
  definition-list, details/summary, fieldset, and form semantics.
- Named regions now point to existing heading IDs.
- Dynamic loading/result/playback states use status/live-region semantics;
  validation and failed actions use alerts.
- Access-denied rendering has a named main landmark and does not include the
  contaminated student's projection.
- Closed role/action sets and one-student projection checks reduce accidental
  presentation of unauthorized controls/data.

## Findings remediated

1. **Unnamed sections:** several `aria-labelledby` values referenced IDs that
   did not exist because the shared heading component had no ID. The component
   now requires an ID and all region references resolve.
2. **Low contrast:** the former muted token reached only about 4.11-4.45:1 on
   common tinted surfaces while being used for small text. It was darkened, and
   the contrast calculation is now a regression test.
3. **Main focus visibility:** programmatic navigation focused the main landmark
   while its focus outline was suppressed. The final CSS keeps an explicit
   visible main-focus treatment.

## Manual/static observations

- Heading structure is consistent within each feature section. The prototype
  uses section-level `h2` headings because it may be mounted beneath a host
  page heading; the host must preserve a coherent overall heading hierarchy.
- The seven-day picker hides the native checkbox visually but retains it in the
  keyboard order and paints focus on the adjacent visible day.
- Checkbox/toggle labels make the surrounding row clickable, increasing the
  effective target size.
- Sticky detail/save regions become non-sticky or single-column at narrow
  breakpoints.
- No safety meaning depends on an icon alone.

## Remaining integration checks

Before production release, complete:

1. Keyboard-only interaction in each supported browser, including focus return
   after async actions.
2. NVDA/Chrome and VoiceOver/Safari checks for navigation announcements,
   details/summary, live status, and form errors.
3. Reflow/zoom verification at 200% and 400% in the actual app shell.
4. High-contrast mode verification on Windows rather than CSS inspection only.
5. On-device speech-synthesis checks; failure must continue to leave all tutor
   text available.
6. Touch target and orientation checks on the supported student devices.
7. Automated browser accessibility scanning after final routing, fonts, global
   CSS, and dialogs are integrated.

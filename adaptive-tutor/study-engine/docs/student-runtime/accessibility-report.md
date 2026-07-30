# Accessibility report

Status: automated checks pass; the named manual assistive-technology matrix
remains not run.

## Automated coverage

- Axe reported zero violations at every severity in the scanned home,
  check-in, learning, hidden-timer, break, missing-media, fallback, mobile, and
  adversarial states.
- Keyboard-only start, check-in, response, direct break, transcript dismissal,
  disclosure dismissal, and focus restoration.
- Visible focus outlines and a skip link to `main#main-content`.
- Visible, minimal, and hidden timer modes without pressure language or
  per-second live announcements.
- Captions stay enabled; transcript and text remain when audio is off.
- Unavailable speech input retains typing and every non-speech learner action.
- Deterministic missing-media text equivalent via `?media=missing`.
- OS and in-app reduced motion stop nonessential computed animation and
  transitions.
- In-app 130% large text.
- Pixel 7 emulation at 390×844 with no page-level horizontal overflow.
- A focused task-first flow at 320×667.
- Required touch targets measured at least 44×44 CSS pixels.
- Direct “I need a break” and “Save and exit” actions.

## Responsive defects found and corrected

1. The inherited Study-UX stylesheet used `html { min-width: 20rem }`. At 130%
   root text scale this became 416 CSS pixels and overflowed a 390px viewport.
   The owned runtime removes that scalable minimum and uses a compact,
   two-row session header.
2. A later integration rule accidentally reinstated the desktop two-column
   check-in grid below the package breakpoint. At 320px the form collapsed to
   42px while the 288px Jarvis panel covered it. The integration breakpoint
   now sets check-in and decision layouts to one column. A 320×667 regression
   test completes the interaction and checks focus, captions, support, task
   identity, touch targets, and overflow.

## Learner-safe fallbacks

- No audio: full text remains and completion is not blocked.
- Missing speech recognition: typing remains enabled and speech never submits.
- Missing media: instruction and read-aloud equivalent remain adjacent to the
  active response.
- Reduced motion: decorative animation and transitions stop without changing
  progress.
- Large text: controls reflow and retain target size.
- Approved break: focus moves to the break heading and names the exact return
  segment.
- Repeated breaks: no blame or failure is introduced; an adult-review signal
  may be added after the threshold.

## Manual boundary

The following are accurately recorded as **not run**:

- NVDA with Chrome on Windows.
- Narrator with Edge.
- TalkBack/Chrome and VoiceOver/Safari.
- Browser zoom at 200%, distinct from the in-app text setting.
- 320×568 portrait and 667×375 landscape visual review.
- Real-device speech synthesis failure, recognition denial, and software
  keyboard behavior.
- Caption timing and announcement-count review with a screen reader.

Automation, screenshots, and the detailed accessibility/adversarial agent
report are included. No claim is made beyond the environments exercised.

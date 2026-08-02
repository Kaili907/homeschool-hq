# Study-UX accessibility report

**Audit date:** 2026-07-28  
**Prototype:** Manuel Academy grades 4–6 student study session  
**Target:** WCAG 2.2 AA-oriented browser prototype

## Result

The automated and interaction accessibility gates pass.

- Axe reported **zero violations** on the daily-goal, check-in, active-learning,
  open-transcript, learner-break, and completed-cycle states.
- Recovery, no-audio, reduced-motion, and mobile large-text scans reported
  **zero serious or critical violations**.
- The keyboard-only browser flow reaches the session, opens learner help,
  requests a break, chooses a safe activity, and returns to the exact task.
- The 390 × 844 mobile checks pass without document-level horizontal overflow.
- Primary interactive controls checked in the mobile suite meet the 44 × 44 px
  touch-target minimum.
- System reduced-motion and the explicit **No motion** setting suppress the
  Jarvis ring animation. The explicit **Minimal** mode remains available when a
  learner wants limited ambient movement.

## Coverage

| Requirement | Implementation and evidence | Result |
| --- | --- | --- |
| Keyboard navigation | Native controls, visible focus treatment, skip link, focusable mobile progress strip, keyboard break/resume test | Pass |
| Screen-reader labels | Named navigation, timer, Jarvis state, transcript, progress, response controls, and status regions | Pass |
| Captions | Jarvis instructional text remains visible in the caption panel | Pass |
| Transcript | Learner-controlled transcript with a named close control | Pass |
| Reduced motion | OS preference plus Full, Minimal, and None controls; computed animation check | Pass |
| Contrast | Dark navy surfaces, off-white text, orange active state, cyan information state; Axe contrast checks | Pass |
| Large touch targets | Mobile control measurements and responsive control sizing | Pass |
| Mobile layout | 390 × 844 viewport, large-text reflow, horizontally scrollable segment strip without page overflow | Pass |
| Text scaling | In-prototype 1.3× text option tested on mobile | Pass |
| Voice unavailable | Visible text fallback; audio failure never blocks the task | Pass |
| No-audio mode | Speech controls become text-first and the lesson remains completeable | Pass |
| One task at a time | One active learning segment and one response task are presented at once | Pass |
| Timer choice | Visible, Minimal, and Hidden modes; hidden mode removes the numeric time value | Pass |

## Anxiety- and interruption-safe behavior

- Learning progress is based on completed segments, never elapsed time.
- Countdown expiry is a neutral goal marker and does not submit work, advance a
  segment, or end the lesson.
- A break pauses instructional time, preserves drafts, and returns to the exact
  segment.
- Refresh recovery pauses the timer and labels the event as a technical
  interruption rather than learner behavior.
- Replayed completion actions are rejected by stable idempotency keys.
- Copy avoids blame, urgency, and shame.

## Issue found and resolved

The adversarial mobile audit found that the horizontally scrollable learning
progress strip could not receive keyboard focus. The progress list now has a
descriptive accessible name, a keyboard focus target, and a visible focus
outline. The full browser suite passed after the correction.

## Prototype boundaries

Automated checks do not replace testing with students or assistive technology.
Before production integration, run moderated checks with at least NVDA/Chrome,
VoiceOver/Safari, browser zoom to 200%, switch or voice-control input, and
representative physical phones and tablets. Browser speech synthesis and speech
recognition availability varies by platform; the text path is intentionally the
authoritative fallback.

## Reproduce

From `adaptive-tutor/study-engine/prototype`:

```powershell
npm install
npm run typecheck
npm test
npm run test:ui
```

The relevant automated coverage is under `tests/ui/unit` and `tests/ui/e2e`.


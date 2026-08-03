# Study UX adversarial test plan

## Purpose

This plan tests the student study session as a recovery-first learning tool. A pass
means that hurried, anxious, interrupted, keyboard-only, mobile, no-audio, and
motion-sensitive learners can still finish the intended task without losing work
or being moved forward accidentally.

The primary progress oracle is completed learning segments. Elapsed timer time is
never accepted as evidence that a segment was completed.

## Test environments

Run the automated suite in Chromium and run the critical manual matrix in
Chromium, Firefox, and WebKit.

- Desktop: 1440 x 900 at 100% and 200% browser zoom.
- Small mobile: 320 x 568.
- Common mobile: 390 x 844.
- Mobile landscape: 844 x 390.
- Input modes: mouse, touch emulation, keyboard only, and screen reader.
- Media states: audio available, Speech Synthesis API absent, synthesis throwing,
  no voices returned, and learner-selected no-audio mode.
- Motion states: normal, operating-system `prefers-reduced-motion: reduce`,
  learner-selected minimal motion, and learner-selected no motion.

Use both the mathematics and reading sample sessions. At minimum, exercise one
complete end-to-end session for each subject in every release candidate.

## State and evidence oracles

For every disruptive scenario, capture or assert:

1. subject, screen, and exact learning segment;
2. completed segment IDs and their order;
3. current response draft and reflection values;
4. timer mode, remaining time, running state, and pause reason;
5. break activity and return countdown, when applicable;
6. completion, break, save, and technical-interruption event counts;
7. the visible focus target and accessible name;
8. absence of uncaught browser errors and serious axe violations.

No test should infer success solely from a screenshot. Pair visual evidence with a
DOM, accessibility-tree, persisted-state, or event-ledger assertion.

## Adversarial matrix

### A. Rushing and duplicate actions

| ID | Action | Expected result |
| --- | --- | --- |
| RUSH-01 | Double-click the primary response/continue control on every segment. | Only the current segment completes. The next segment is shown but is not also completed. Exactly one completion event exists for the submitted segment. |
| RUSH-02 | Press Enter while clicking the primary control. | The check-in or answer is accepted once; focus lands at the next screen's heading or first task target. |
| RUSH-03 | Hold Enter so key repeat fires. | No skipped segments, duplicate completion events, duplicate transcript entries, or stacked announcements occur. |
| RUSH-04 | Replay the prior segment's submit action after navigation. | The stale action is ignored and the current segment remains unchanged. |
| RUSH-05 | Rapidly choose two answers and submit. | The visibly selected value is the persisted value; feedback and completion refer to the same answer. |
| RUSH-06 | Double-activate save-and-exit and the final pacing decision. | One event is recorded, one navigation occurs, and the saved/finished state remains internally consistent. |

Automated reducer coverage: `tests/ui/unit/sessionStore.test.ts`, sections
“rushing and double submission” and “completion event idempotency.”

### B. Timer anxiety and optional visibility

| ID | Action | Expected result |
| --- | --- | --- |
| TIMER-01 | Switch visible → minimal → hidden while the timer is running. | The selected display mode takes effect immediately. Segment progress, answers, and remaining seconds do not reset. |
| TIMER-02 | Pause, hide the timer, wait, then resume. | Time does not decrement while paused. It resumes only after the learner explicitly activates Resume. |
| TIMER-03 | Let the countdown reach zero on each display mode. | A calm goal-reached state appears. The learner is not advanced, submitted, ended, or locked out. No urgent alarm, red failure treatment, or repeated live-region announcement occurs. |
| TIMER-04 | Refresh with the timer hidden. | Hidden mode remains selected. The recovered timer is paused and does not begin counting without an intentional resume. |
| TIMER-05 | Complete segments unusually quickly or leave one open beyond the estimate. | Segment progress reflects actual completions only; elapsed time never adds or removes a completion. |
| TIMER-06 | Inspect with a screen reader for 15 seconds. | Per-second ticks are not announced. Pause, Resume, timer-mode controls, and the optional goal state have concise accessible names. |

Language must describe the timer as optional pacing support. It must not imply
failure, lateness, punishment, or a requirement to beat the clock.

### C. Repeated breaks

Run three consecutive break cycles from the guided-practice and independent
segments, including one while the timer is running and one while it is
learner-paused.

| ID | Action | Expected result |
| --- | --- | --- |
| BREAK-01 | Activate “I need a break” twice rapidly. | One break screen and one break-request event appear. |
| BREAK-02 | Attempt timer ticks while on the break screen. | Instructional time is paused and remaining seconds are unchanged. |
| BREAK-03 | Select each configured safe activity. | The choice is clear, non-shaming, and contains no unrelated entertainment or outbound link. |
| BREAK-04 | Start the return countdown twice rapidly. | One countdown runs. The learner is not returned twice and no duplicate return event is created. |
| BREAK-05 | Finish the countdown after editing a draft before the break. | The exact subject, segment, draft, progress, and prior timer-running state are restored. |
| BREAK-06 | Refresh during the break and during its return countdown. | Break context and learning work are preserved. Recovery never completes the underlying segment. |
| BREAK-07 | Request another break immediately after returning. | The second break is allowed without warning or shame and has its own single request/return event pair. |

Safe example activities are Get water, Walk briefly, Stretch, Look away from the
screen, Quiet breathing, and Parent-configured movement. Return guidance must
remain neutral and let the learner resume the exact task.

### D. Accidental refresh, close, and persistence

Repeat REFRESH-01 at check-in, mid-answer in every learning segment, on the break
screen, during the return countdown, on the decision screen, and after
save-and-exit.

| ID | Action | Expected result |
| --- | --- | --- |
| REFRESH-01 | Type an unfinished response, then refresh without saving. | Subject, exact segment, draft, reflection values, and completed progress recover. The timer is paused with a technical reason and a calm recovery notice is shown. |
| REFRESH-02 | Hydrate the recovered state repeatedly in the same page runtime. | The same interruption is recorded once; notices and events do not multiply. |
| REFRESH-03 | Close and reopen after an intentional save-and-exit. | The resume card points to the exact segment and retains the draft. No technical interruption is recorded. |
| REFRESH-04 | Close unexpectedly, reopen, then close unexpectedly in a genuinely new runtime. | Each distinct interruption is recorded once and separately. |
| REFRESH-05 | Refresh immediately after a segment completes. | The completed segment remains complete exactly once and the next segment is current. |
| REFRESH-06 | Corrupt or block local mock storage. | The prototype remains operable, explains that recovery is unavailable, and does not crash or claim that unsaved work is safe. |

Inspect the local event ledger after each case. There must be no duplicate
`segment_completed`, `technical_interruption`, `break_requested`, or
`break_returned` event for one logical action.

### E. Mobile layouts and touch

| ID | Action | Expected result |
| --- | --- | --- |
| MOBILE-01 | Complete both sample sessions at 320 x 568 and 390 x 844. | One task remains primary; no content or control is unreachable, clipped, or hidden behind fixed UI. |
| MOBILE-02 | Rotate at every screen, including break and transcript. | State and draft survive rotation. Layout reflows without overlap or unexpected horizontal page scrolling. |
| MOBILE-03 | Open captions and transcript with the teaching board visible. | Board content, current task, captions, and close control remain usable; transcript does not trap content off-screen. |
| MOBILE-04 | Tap every interactive target near its edges. | Targets are at least 44 x 44 CSS pixels or have equivalent spacing, and adjacent actions are not accidentally triggered. |
| MOBILE-05 | Show the on-screen keyboard for short and long responses. | The active field and primary action can be reached without losing the draft. |
| MOBILE-06 | Run a break and return countdown in landscape. | Guidance, activity choice, countdown, and return action remain visible and readable. |

Capture screenshots at the daily goal, active learning, break, recovery, and exit
ticket states for each required viewport.

### F. Keyboard-only navigation

Start every case after a page reload without touching the pointer.

| ID | Action | Expected result |
| --- | --- | --- |
| KEY-01 | Tab through the session shell. | Focus order follows visual/task order, all controls receive a visible indicator, and no hidden control receives focus. |
| KEY-02 | Use Space/Enter on choices, learner-support actions, timer controls, transcript, break, save-and-exit, and return. | Every operation has a native-equivalent keyboard path and fires once. |
| KEY-03 | Open then close transcript or any dialog with keyboard controls. | Focus moves into the surface, is contained only when modal, closes with Escape when appropriate, then returns to its trigger. |
| KEY-04 | Complete a segment and return from a break. | Focus moves predictably to the new task heading or restored task—not the document start or browser chrome. |
| KEY-05 | Navigate error/help feedback. | Feedback is programmatically associated with the response and announced without moving focus unexpectedly. |
| KEY-06 | Skip repeated shell/navigation content. | A visible-on-focus skip route reaches the current task when repeated content warrants it. |

Test radio-like answer groups with arrow keys where native radios are used. Tab
should leave the group rather than visiting every option.

### G. Unavailable audio and no-audio mode

| ID | Action | Expected result |
| --- | --- | --- |
| AUDIO-01 | Remove `window.speechSynthesis` before load. | The session loads normally. “Read this to me” exposes a calm unavailable fallback; text, captions, and transcript remain usable. |
| AUDIO-02 | Make `speak()` throw or return no voices. | The failure is caught, no loading/speaking state is left stuck, and the learner can continue independently. |
| AUDIO-03 | Select no-audio mode, reload, and resume. | Preference persists. No speech is attempted and no audio-dependent instruction blocks progress. |
| AUDIO-04 | Activate “Let me answer aloud” when capture is unsupported or denied. | A clearly labeled typed-answer fallback receives focus; existing work is preserved. |
| AUDIO-05 | Toggle captions and inspect transcript while audio is unavailable. | All instructional speech content has a text equivalent, entries do not duplicate, and speaker labels are exposed. |

Do not frame an unavailable device/API as learner error. No permission request may
be required to complete either sample session.

### H. Reduced and minimal motion

| ID | Action | Expected result |
| --- | --- | --- |
| MOTION-01 | Load with `prefers-reduced-motion: reduce`. | Rotating rings, pulsing, sweeping highlights, smooth scrolling, and nonessential transitions are removed or effectively static. |
| MOTION-02 | Select minimal motion and then no motion. | The explicit learner setting takes effect immediately and persists across refresh/resume. |
| MOTION-03 | Trigger Jarvis speaking in each mode. | Captions and speaking status remain available without relying on pulse, color, or motion alone. |
| MOTION-04 | Trigger segment, break, recovery, and transcript transitions. | No flashing, rapid scale effect, or required animated delay blocks interaction. |
| MOTION-05 | Change the operating-system preference while the page is open. | The interface follows the new preference unless a documented explicit no-motion learner choice is more restrictive. |

Record computed animation names and durations for the Jarvis core and major
surfaces. In no-motion mode, nonessential animation duration should resolve to
zero or animation should be absent.

### I. 200% text scaling

Run at 200% browser zoom on desktop and with the prototype's largest text setting
at every required viewport.

| ID | Action | Expected result |
| --- | --- | --- |
| TEXT-01 | Complete check-in, both response types, reflection, and exit ticket. | Text remains readable without overlap, clipping, or loss of controls/content. |
| TEXT-02 | Open transcript, captions, help, break guidance, and recovery notice. | Content reflows; close and primary controls remain reachable by keyboard and touch. |
| TEXT-03 | Inspect progress and “Step N of 6.” | Labels wrap without obscuring state. Completed/current/upcoming status is not conveyed by icon or color alone. |
| TEXT-04 | Inspect timer in all three modes. | Digits and labels do not collide, and hiding the timer remains available. |
| TEXT-05 | Enter a long reading response and validation feedback. | The field grows or scrolls internally without covering its label, feedback, or submit control. |

At narrow equivalent widths, reflow should avoid two-dimensional page scrolling;
content that inherently needs one axis, such as a teaching-board visual, must
provide an accessible alternative and keep controls outside the overflow region.

## Automated suite mapping

The reducer suite covers:

- replayed and stale completion actions;
- duplicate check-in submission;
- repeat break requests and multiple complete break cycles;
- instructional timer pause during breaks;
- visible, minimal, hidden, paused, resumed, and expired timer states;
- timer expiry without forced segment completion;
- exact segment and draft restoration after refresh;
- clean save-and-exit restoration;
- technical interruption idempotency;
- corrupt-storage fallback; and
- exactly one completion event for each of six segments.

Component/browser automation should additionally assert:

- axe results on goal, learning, break, recovery, transcript, and decision screens;
- keyboard focus order and focus restoration;
- mobile viewport screenshots and no unexpected horizontal overflow;
- missing/throwing speech API fallbacks;
- reduced-motion computed styles;
- 200% zoom/reflow; and
- visible captions and complete transcript equivalents.

## Release gate

Block handoff for any issue that can:

- lose or overwrite entered work;
- skip, duplicate, or falsely complete a learning segment;
- turn timer expiry into forced navigation or failure;
- prevent hiding or pausing the timer;
- prevent or shame a repeated break;
- strand keyboard, mobile, no-audio, or motion-sensitive learners;
- create a keyboard trap or inaccessible primary action;
- announce continuously or flash;
- duplicate persistence events; or
- return from break/recovery to the wrong subject or segment.

For every failure, record test ID, subject/segment, viewport and input mode,
pre-state, exact steps, observed/expected result, persisted-state excerpt, console
output, screenshot, and whether the defect is deterministic.

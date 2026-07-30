# Student Study Session Accessibility Plan

Status: implementation acceptance plan for the local Study-UX prototype  
Target: WCAG 2.2 AA, with additional safeguards for young learners and timer anxiety  
Applies to: the grades 4-6 mathematics and reading study sessions

## Purpose

The study session must remain understandable and operable when the learner:

- uses only a keyboard;
- uses a screen reader;
- enlarges text to 200% or uses a narrow mobile viewport;
- turns animation or audio off;
- cannot use speech synthesis or speech recognition;
- hides the timer;
- takes one or several breaks;
- refreshes, closes, or reopens the prototype during a task.

Passing an automated accessibility scanner is necessary but not sufficient. The
manual keyboard, screen-reader, zoom, speech-failure, and recovery checks in this
document are release gates.

## Existing prototype findings to carry forward

The existing tutor prototypes provide several reusable patterns:

- `Walkthrough` displays the same instructional sentence that it sends to speech
  synthesis.
- `PushToTalkMic` uses a native button, exposes pressed state, supports Space and
  Enter, and uses a 44 by 44 CSS-pixel control.
- `AssistantOrb` exposes expanded state, keeps a visible text transcript, and
  provides a text-entry path.
- Existing visual math SVGs use `role="img"` and accessible labels.
- Existing reading and tutor surfaces keep the learner on one primary task.

The new study prototype must not inherit these observed gaps:

- Speech-recognition controls currently disappear without an explicit
  voice-unavailable explanation.
- Recognition errors can reset silently, leaving the learner unsure what
  happened.
- Correct/incorrect feedback and step changes are not consistently exposed
  through a live region.
- Current reduced-motion CSS covers star effects but not all pop, wiggle, pulse,
  progress, or future Jarvis ring motion.
- Existing timed surfaces keep the numeric countdown visible and can use urgent
  color near expiry.
- Focus is not consistently moved or restored when walkthroughs, chats, and
  questions replace one another.

## Non-negotiable accessibility invariants

1. Every instruction, state, and result available through audio, color, or motion
   also has a persistent text equivalent.
2. The primary progress display represents completed learning segments, never
   elapsed time.
3. Timer presentation is a learner choice: visible countdown, minimal indicator,
   or hidden. Hidden really means no countdown digits in either the visual or
   accessibility tree.
4. Only the current learning task is interactive. Prior and future segments may
   appear in progress context but cannot create competing tab stops.
5. A break, refresh, audio failure, or technical interruption does not erase
   entered work or change the learner's completed-segment count.
6. No required action depends on hover, drag, pointer precision, speech, hearing,
   animation, or color perception.
7. A learner can always reach `I need a break`, `Save and exit lesson`, and the
   current task with a keyboard.
8. Session completion and segment completion events are idempotent. Replaying an
   announcement, resuming, or refreshing cannot count work twice.

## Acceptance criteria

### 1. Keyboard operation and visible focus

- Use native `button`, `input`, `textarea`, `select`, `fieldset`, `legend`, and
  heading elements whenever they express the intended behavior.
- Every learner action is operable with Tab, Shift+Tab, Enter, and Space. Radio
  groups also support the standard arrow-key behavior.
- Do not use positive `tabindex`. Static content is not added to the tab order
  merely so a screen reader can read it.
- The first focusable item is `Skip to current activity`. Activating it places
  focus on the current segment heading or its task region.
- Focus order follows the visual reading order and the recommended order later in
  this document.
- Focus styling is always visible, at least 2 CSS pixels thick, has at least a 3:1
  contrast ratio against adjacent colors, and is not covered by sticky controls.
- Opening timer settings, captions, transcript, learner support, or a confirmation
  dialog moves focus to the first meaningful control in that surface.
- Closing a disclosure or dialog returns focus to the control that opened it.
- On segment change, break entry, break return, resume recovery, or technical
  recovery, focus moves to the new page/segment heading with `tabindex="-1"`;
  it does not jump directly into an answer.
- Escape closes only a true modal/dialog and restores focus. Escape does not
  silently discard a response, exit the lesson, or end a break.
- No global single-letter shortcuts are enabled while a learner is typing.
- `Save and exit lesson` asks for confirmation only when the current unsaved draft
  cannot first be persisted. The confirmation uses an accessible dialog, not
  `window.confirm`.

### 2. Structure and screen-reader semantics

- Use one `header`, one `main`, and named complementary regions only when needed.
  The session title is the single `h1`; the current segment/task title is an
  `h2`.
- The daily goal is a named region (`aria-labelledby`) and is read before progress.
- Learning progress is an ordered list inside
  `nav aria-label="Learning progress"`.
- Each progress item exposes text plus state:
  - completed: visible check plus screen-reader text `Completed`;
  - current: `aria-current="step"` plus screen-reader text `Current`;
  - upcoming: screen-reader text `Not started`.
- The progress summary is text such as
  `Step 2 of 6, Visual lesson. 1 segment completed.` It must not be named or
  calculated as a percentage of session time.
- Decorative Jarvis rings, glows, particles, and icons have `aria-hidden="true"`
  and cannot receive focus.
- The Jarvis region is named `Jarvis study coach`. Its text status is one of
  `Ready`, `Speaking`, `Paused`, `Audio off`, or `Voice unavailable`.
- The visual teaching board is a `figure` or named region with a visible title.
  Essential diagrams have a concise accessible description and a nearby text
  explanation. Decorative board elements are hidden from assistive technology.
- Inputs have persistent visible labels. Placeholder text is supplementary and is
  never the only label.
- Groups of choices use a `fieldset` and `legend`, including confidence, effort,
  frustration, exit-ticket choices, and timer modes.
- Correctness is never communicated by green/red or symbols alone. Text must say
  `Correct`, `Not yet`, or another complete, supportive result.
- Disabled controls remain understandable. If the learner needs to know why a
  control is unavailable, visible adjacent text explains why and is referenced
  with `aria-describedby`.

### 3. Captions and transcript

- Every Jarvis utterance appears as a caption before or at the same time speech
  begins. Captions remain available when sound is muted or speech synthesis fails.
- Captions identify the speaker in text, for example `Jarvis: Let's compare the
  two fractions.`
- `Show captions` / `Hide captions` is independent from audio state. Hiding the
  caption display does not remove the utterance from the transcript.
- Caption preference persists in local mock storage and is restored before the
  first utterance after refresh.
- The transcript is a named region with a visible `Transcript` heading and a
  chronological list of speaker-labelled turns.
- Opening the transcript does not automatically move focus to the newest entry.
  The learner chooses when to inspect it.
- New Jarvis speech is announced once through a polite live region. It is not
  announced again when the same text is appended to the transcript.
- A draft produced by speech recognition is visibly and programmatically labelled
  `Voice answer draft`. The learner can edit it and must explicitly submit it.
- Interim speech-recognition text is not continuously injected into the main
  polite live region. At most, `Listening`, `Voice answer ready`, and an error
  status are announced.
- Transcript and caption text reflow without horizontal scrolling at 200% text
  size and on a 320 CSS-pixel-wide layout.

### 4. Reduced motion and minimal-animation mode

- Respect both the operating-system `prefers-reduced-motion: reduce` setting and
  the in-app `Minimal animation` preference. Either one is sufficient to enable
  minimal motion.
- In minimal-motion mode:
  - Jarvis ring rotation, glow travel, particles, pulsing, and scale animation stop;
  - segment and timer progress update without animated interpolation;
  - pop, wiggle, confetti, auto-scroll, parallax, and slide transitions stop;
  - speaking state is conveyed by static text and an icon, not a pulse.
- The Jarvis core remains visible as a static circular graphic so reduced motion
  does not remove context or controls.
- Full-motion mode uses subtle motion only. No element flashes more than three
  times per second, and no large object repeatedly zooms or moves across the
  learner's field of view.
- Changing the motion preference takes effect immediately and persists locally.
- Motion preference does not pause audio, alter task timing, or change progress.

### 5. Contrast and color

- Normal text has at least 4.5:1 contrast; large text has at least 3:1.
- Controls, input boundaries, selected states, progress states, timer indicators,
  and focus indicators have at least 3:1 contrast against adjacent colors.
- Orange may be the primary energy/accent color, but orange is not the sole cue
  for current, complete, correct, warning, listening, or speaking states.
- Text placed on orange uses a foreground token that passes contrast; do not
  assume white-on-orange passes.
- Muted text, placeholders, disabled controls, and transcript speaker labels still
  meet their applicable contrast requirement.
- The dark teaching environment preserves a readable light text surface without
  glow behind paragraph text. Glow is decorative and cannot reduce letter
  definition.
- Verify every interactive state: default, hover, focus, selected, pressed,
  disabled, correct, not-yet, and interruption.

### 6. Touch targets, mobile layout, and 200% text scaling

- Every interactive target is at least 44 by 44 CSS pixels; 48 by 48 is preferred
  for primary learner actions.
- Adjacent targets have at least 8 CSS pixels of separation or an equivalent
  non-overlapping hit area.
- At 320 CSS pixels wide, the page has no two-dimensional scrolling and no
  horizontal page scrollbar. A teaching-board graphic may scale down, wrap, or
  expose a text equivalent; it must not force page overflow.
- At 200% browser text zoom:
  - controls and labels do not overlap or clip;
  - captions, transcript, progress labels, and feedback remain readable;
  - fixed-height text containers grow or become scrollable with a visible label;
  - no action disappears behind the Jarvis core, timer, or sticky footer.
- Primary actions stack into one column on narrow layouts. Do not shrink touch
  targets to preserve a desktop row.
- The mobile layout supports portrait and landscape, on-screen keyboard display,
  and safe-area insets.
- The teaching board appears before its related response control in DOM and visual
  order.
- Text remains selectable, and user zoom is not disabled in viewport metadata.

### 7. No-audio and voice-unavailable fallback

- Detect speech synthesis and speech recognition independently. One may be
  available while the other is not.
- `No audio` immediately cancels current speech, prevents future auto-speech, and
  persists locally. It does not hide captions, transcript, or text instruction.
- If speech synthesis is unavailable or errors, show and announce once:
  `Voice isn't available right now. You can keep learning with captions and text.`
- If speech recognition is unavailable, denied, or errors, show:
  `Answer aloud isn't available right now. Type your answer instead.`
- The typed response is present and usable before voice capability detection
  finishes. Voice is an enhancement, never a gate.
- A permission denial is not repeatedly requested during the same session.
- A voice error does not clear a typed response or a captured voice-answer draft.
- `Read this to me` has a visible text equivalent and becomes unavailable with an
  adjacent explanation when synthesis cannot run.
- `Let me answer aloud` starts a clearly indicated listening state. Provide an
  explicit `Stop listening` control; pointer press-and-hold cannot be the only
  interaction model.
- Audio does not start before the learner has interacted with the page or enabled
  audio for the session.

### 8. Timer choice and anxiety safeguards

- Timer settings are a radiogroup labelled `Timer display` with:
  `Visible countdown`, `Minimal indicator`, and `Hidden timer`.
- Timer choice is available before timed presentation starts, can be changed while
  paused or running, and persists locally.
- `Visible countdown` displays remaining time as text and exposes the same value
  when the timer is focused.
- `Minimal indicator` displays a small non-numeric progress cue and exposes only
  `Optional timer running` or `Optional timer paused`; it does not expose seconds
  through a live region.
- `Hidden timer` removes digits, circular progress, and remaining-time text from
  both the visual and accessibility trees. Pause/resume and timer-mode controls
  remain available.
- Countdown changes are not live-announced every second. Any optional milestone
  announcements are opt-in and limited to meaningful boundaries.
- Low time never triggers red flashing, pulsing, escalating sound, screen shake,
  or shaming/urgent copy.
- Timer expiration never submits an answer, marks a segment failed, removes a
  choice, or steals focus. It may show the neutral status:
  `Optional timer ended. You can finish this step.`
- `Pause session` pauses instructional time and the optional timer. `Resume
  session` continues from the preserved value.
- Entering a break pauses instructional time before the break screen renders.
- Timer state is independent from completed learning-segment progress.

### 9. One-task-at-a-time presentation

- Exactly one segment task is exposed as the active form in `main`.
- Progress labels for other segments are context only; they do not expose answer
  controls or allow accidental skipping unless a deliberate navigation design is
  later approved.
- The current prompt, related teaching board, response, feedback, and primary next
  action form one named task region.
- Learner support choices are grouped behind a single disclosure labelled
  `Get learning support`. Opening it does not obscure the current prompt.
- After choosing a support action, the selected support path replaces or updates
  the current teaching content; it does not add several competing lessons below
  it.
- Confidence, effort, and frustration each appear as their own short question,
  not as a dense multi-column survey.
- A screen-reader user hears the segment heading before the changed prompt and
  before the response control.

### 10. Live regions and status messages

Use one queued polite status channel for ordinary changes. Do not put an entire
changing application subtree inside `aria-live`.

| Event | Announcement | Focus behavior |
| --- | --- | --- |
| Jarvis starts | `Jarvis is speaking.` followed by the caption once | Focus stays on the learner's control |
| Jarvis stops/pauses | `Jarvis paused.` | Focus stays in place |
| Answer submitted | `Answer submitted.` then supportive result | Focus moves to feedback heading only if the task view changes |
| Segment completed | `Warm-up completed. Visual lesson, step 2 of 6.` | Focus moves to the new segment heading |
| Draft saved | `Your work is saved.` | No focus change |
| Session paused | `Session paused. Your work is saved.` | Focus moves to the pause heading/control group |
| Break starts | `Break started. Your lesson and timer are paused.` | Focus moves to `Break time` heading |
| Break countdown ends | `Your break timer has ended. Return when you are ready.` | No automatic focus change |
| Return from break | `Returning to Visual lesson, step 2 of 6.` | Focus moves to restored segment heading |
| Voice unavailable | Use the fallback messages in section 7 | Focus stays on the text path |
| Refresh recovery found | `Saved lesson found at Visual lesson.` | Focus starts on the resume-card heading |
| Technical interruption | `A technical interruption was recorded. Your learning progress is safe.` | Focus moves to recovery heading |

Additional rules:

- Use `role="status"` / polite announcements for ordinary state. Reserve
  `role="alert"` for a blocking error that requires immediate action.
- Clear or replace status text before announcing a genuinely new event so the same
  message is not duplicated.
- Timer ticks, animated rings, interim dictation, and local-storage writes do not
  generate announcements.
- Validation errors are visible, associated to their input with
  `aria-describedby`, and summarized at the task heading after submit.

### 11. Focus management by state

| State transition | Required focus target |
| --- | --- |
| Daily goal to check-in | `Check-in` heading |
| Any segment advance | New segment `h2` with temporary `tabindex="-1"` |
| Open timer settings | `Timer display` legend or first radio |
| Close timer settings | `Timer display settings` trigger |
| Open transcript | `Transcript` heading |
| Close transcript | `Show transcript` trigger |
| Open support actions | First learner-support action |
| Complete support action | Updated current-task heading |
| Enter break | `Break time` heading |
| Select a break activity | Break guidance heading; selection remains available |
| Return from break | Exact restored segment heading |
| Pause | `Session paused` heading |
| Resume | Restored segment heading |
| Save and exit | `Resume lesson` card heading on the landing view |
| Refresh with saved session | `Resume lesson` card heading |
| Recover technical interruption | `Resume [segment]` action, then restored heading |
| Voice recognition returns a draft | `Voice answer draft` field |
| Voice recognition fails | Typed answer field after the status is announced |

Focus movement is performed only after the destination is rendered. Restoration
must not select text, submit an answer, or open the on-screen keyboard unless the
learner explicitly chose an input path.

### 12. Break screen and recovery

- `I need a break` is always available from an active segment and uses supportive,
  non-conditional language.
- Entering a break atomically saves the current segment, response draft, support
  path, timer mode/value, captions/audio/motion preferences, and intended focus
  return target before showing the break screen.
- The break screen states:
  `Your lesson is paused and your progress is saved.`
- Safe examples are rendered as plain choices or guidance, never entertainment
  links:
  `Get water`, `Walk briefly`, `Stretch`, `Look away from the screen`,
  `Quiet breathing`, and the configured movement label.
- Do not use points, streak loss, warnings, blame, failure language, or a forced
  explanation for taking a break.
- Repeated breaks are allowed. The learner receives the same neutral treatment on
  every break.
- The return countdown is optional guidance. It does not live-announce each tick
  and does not force navigation when it reaches zero.
- Provide `Return to lesson now` throughout the break. If extension is supported,
  name it `Add more break time`, not `Delay` or `Skip`.
- Returning restores the exact segment and entered work. Focus returns according
  to section 11.
- A refresh or close/reopen while on break restores the break state and return
  target without incrementing break or completion events twice.
- A technical interruption is stored and labelled separately from a learner
  break. Recovery copy never implies the learner caused it.
- If local mock storage cannot be read, offer a visible non-destructive recovery
  choice. Do not silently start over.

## Recommended accessible names

Use these names consistently in visible text and accessible labels. Avoid adding
extra `aria-label` text when the visible button already supplies the exact name.

| Element | Recommended accessible name or text |
| --- | --- |
| Skip link | `Skip to current activity` |
| Progress navigation | `Learning progress` |
| Current progress summary | `Step 2 of 6, Visual lesson. 1 segment completed.` |
| Pause | `Pause session` |
| Resume | `Resume session` |
| Timer settings trigger | `Timer display settings, Hidden timer` |
| Timer group | `Timer display` |
| Timer options | `Visible countdown`; `Minimal indicator`; `Hidden timer` |
| Save/exit | `Save and exit lesson` |
| Break request | `I need a break` |
| Return action | `Return to Visual lesson` (substitute exact segment) |
| Break timer | `Break return timer, 2 minutes remaining` (not live) |
| Jarvis region | `Jarvis study coach` |
| Jarvis status | `Jarvis status: Speaking` |
| Replay speech | `Replay Jarvis explanation` |
| Pause speech | `Pause Jarvis` |
| Resume speech | `Resume Jarvis` |
| Audio toggle | `Turn off audio` / `Turn on audio` |
| Read control | `Read this to me` |
| Caption toggle | `Show captions` / `Hide captions` |
| Transcript toggle | `Show transcript` / `Hide transcript` |
| Teaching board | `[Topic] visual teaching board` |
| Support disclosure | `Get learning support` |
| Voice answer start | `Let me answer aloud` |
| Voice answer stop | `Stop listening` |
| Typed response | `Your answer` |
| Voice draft | `Voice answer draft` |
| Primary segment action | `Continue to guided practice` (name destination) |
| Resume card | `Resume math lesson at Visual lesson` |
| Technical recovery | `Resume after technical interruption` |

The required learner actions should appear with these exact visible names:

1. `I need help`
2. `Show me another way`
3. `Talk me through it`
4. `Let's do one together`
5. `Give me a different example`
6. `This is too easy`
7. `This is too hard`
8. `I need a break`
9. `Read this to me`
10. `Let me answer aloud`
11. `Continue independently`

Do not prefix every item with redundant text such as `Button:`. The containing
group is labelled `Learning support options`.

## Recommended DOM and keyboard order

The visual layout may place controls responsively, but the DOM and keyboard order
should remain:

1. `Skip to current activity`
2. session title and today's goal (not focusable)
3. learning progress (not focusable unless a later design intentionally permits
   segment navigation)
4. `Pause session`
5. `Timer display settings`
6. `Save and exit lesson`
7. `I need a break`
8. current segment heading
9. current instruction and visual teaching board
10. Jarvis playback/audio/caption controls
11. current response control
12. `Get learning support`
13. primary continue/check action
14. `Show transcript`

On narrow mobile layouts, put the primary response and continue action before
secondary Jarvis/transcript options visually as well as in DOM order. `I need a
break` and `Save and exit lesson` may be in a clearly labelled session-controls
disclosure, provided each remains reachable in two or fewer keyboard activations
and the disclosure state persists.

## Learner check semantics

Use short, neutral fieldsets with no moral ranking:

- Confidence legend: `How confident do you feel about this?`
  - `Not yet`
  - `A little`
  - `Mostly`
  - `Very`
- Effort legend: `How much effort did this take today?`
  - `A little effort`
  - `Some effort`
  - `A lot of effort`
- Frustration legend: `How frustrated do you feel right now?`
  - `Not frustrated`
  - `A little frustrated`
  - `Quite frustrated`
  - `Very frustrated`

No option is preselected. Submitting without a required response produces a
visible, linked error without erasing other selections. Frustration feedback must
offer support or a break without diagnosing, blaming, or automatically blocking
the learner.

## Test matrix

| Area | Scenario | Required assertions | Method |
| --- | --- | --- | --- |
| Automated baseline | Every major session state in math and reading | No axe serious/critical violations; landmarks, labels, names, roles, values valid | axe integration test plus browser accessibility snapshot |
| Keyboard | Entire flow without pointer | Logical Tab/Shift+Tab order; Enter/Space activate; radio arrows work; no trap; all required learner actions reachable | Playwright keyboard test and manual desktop pass |
| Focus transitions | Segment, dialog, transcript, break, resume, interruption | Focus targets match section 11; closed surfaces restore focus | Interaction tests using `document.activeElement` |
| Visible focus | Dark shell, orange controls, board, modal/disclosure | Focus ring visible, not clipped/obscured, and at least 3:1 | Manual visual pass plus contrast measurement |
| Screen reader | Full math flow | Names/states are concise; progress/current step and feedback announced once; decorative rings ignored | NVDA + Chrome manual pass |
| Screen reader fallback | Full reading flow | Passage/board order is sensible; voice fallback and typed path announced | Narrator + Edge or second supported desktop AT pass |
| Captions | Jarvis speaks, pauses, replays, and audio is toggled | Caption precedes/matches speech; transcript receives one turn; replay does not duplicate the stored turn | Component/interaction tests with speech adapter spy |
| Transcript | Open/close after several turns | Speaker labels and chronology exposed; opening does not jump to newest item; focus restores | Keyboard and accessibility-tree test |
| Reduced motion | OS preference enabled before load | Rings/static core do not rotate/pulse; no pop/wiggle/slide/confetti; progress has no animated interpolation | Playwright `reducedMotion: "reduce"` plus computed-style assertions |
| Minimal animation | In-app setting enabled during speech | Motion stops immediately; speaking remains textually identifiable; setting persists after refresh | Interaction and storage test |
| Contrast | All component states and both subjects | Text 4.5:1 (or 3:1 large); controls/focus/non-text indicators 3:1 | Automated token check plus manual browser tool |
| Touch targets | Mobile session and open disclosures | Every actionable bounding box at least 44 by 44 CSS pixels; targets do not overlap | Playwright bounding-box assertions |
| Mobile portrait | 320x568 and 390x844 | No page-level horizontal scroll; controls stack; fixed controls do not cover content | Playwright viewport tests and screenshots |
| Mobile landscape | 667x375 with browser UI/keyboard pressure | Current task and exit/break paths remain reachable; no clipped modal | Playwright viewport test plus manual device pass |
| Text scaling | Browser text at 200% / root text simulation | No overlap, loss, clipping, or hidden control; transcript and captions reflow | Manual browser zoom plus test with doubled root font size |
| Visible timer | Fake clock advances and pauses | Digits accurate; no per-second live announcements; expiration does not submit or move focus | Fake-timer component test |
| Minimal timer | Fake clock advances | No digits exposed visually or in accessibility tree; status says running/paused only | DOM and accessibility snapshot test |
| Hidden timer | Switch from visible while running | Digits/circle/value absent visually and from accessibility tree; controls remain; preference persists | Interaction, storage, and snapshot tests |
| Timer anxiety | Last 15 seconds and expiry | No urgent pulse/red-only cue/sound; neutral expiry; answer still editable | Screenshot and fake-timer interaction test |
| Pause/resume | Pause with an entered response | Clock and instructional time stop; response persists; focus and announcement correct | Fake-timer and keyboard test |
| Missing synthesis | Remove/reject speech synthesis | Visible fallback; caption/text remain; `Read this to me` explained; no crash | Stubbed missing/error API test |
| Missing recognition | Remove constructor, deny permission, and emit runtime error | Typed path already usable; fallback announced once; draft preserved; no repeated prompt | Stubbed speech-recognition tests |
| No-audio mode | Toggle while Jarvis is speaking | Current speech cancels immediately; no later auto-speech; captions/transcript unaffected; persists | Adapter spy and refresh test |
| Break | Request break from every active segment | Instructional time pauses; draft/progress preserved; safe activities only; neutral copy | Parameterized interaction tests |
| Repeated breaks | Take three consecutive breaks | Same respectful treatment; exact segment restored each time; no duplicate completions | Adversarial interaction test |
| Break countdown | Let countdown end while focus is elsewhere | No focus steal or forced return; only one polite completion message | Fake timer plus live-region mutation observer |
| Refresh recovery | Refresh with partially typed work in every task type | Resume card names exact segment; draft and preferences restore; interruption tracked separately | Browser reload tests with mock storage |
| Close/reopen | New page context with same local storage | Exact state restores; resume is explicit; no work counted twice | Playwright context/storage-state test |
| Duplicate prevention | Double click, Enter repeat, refresh after completion, resume twice | One completion event and one technical-interruption event per idempotency key | Unit and browser event-log assertions |
| One-task view | Every required flow state | Only current task form is interactive; future progress items have no task controls/tab stops | DOM query and accessibility snapshot |

## Required manual assistive-technology pass

Before handoff, record date, browser version, viewport, and result for:

- NVDA with Chrome on Windows: math session, keyboard only, no audio.
- Narrator with Edge on Windows: reading session, missing recognition fallback.
- One mobile screen-reader pass where available (TalkBack with Chrome or VoiceOver
  with Safari): resume card, one task, break, and return.
- Chrome or Edge at 200% zoom: both session types at the narrowest supported layout.
- Windows Reduce motion plus in-app Minimal animation: Jarvis idle and speaking.

Any unavailable AT/device combination must be recorded as not run, not silently
marked passed.

## Accessibility test IDs and observability

Prefer queries by role and accessible name. Add `data-testid` only where a state
has no stable semantic query, such as the decorative ring container or mock event
log.

Expose test-readable state for:

- current segment id and completed segment ids;
- timer mode and running/paused state;
- audio, captions, transcript, and motion preferences;
- break state and exact return segment;
- technical-interruption count/event id;
- completion event ids;
- current response draft.

This state is for the local prototype and automated verification only. It must not
introduce production identity, database, or analytics behavior.

## Release gate

The Study-UX prototype is accessibility-ready only when:

- all automated matrix rows pass for both math and reading;
- there are zero serious or critical automated accessibility findings;
- the full required flow can be completed keyboard-only;
- the NVDA/Chrome pass has no blocker;
- 200% zoom and 320 CSS-pixel reflow have no loss of content or function;
- hidden timer, no-audio, missing-audio, and reduced-motion modes each remain
  fully usable;
- break and recovery return to the exact task with the draft intact;
- duplicate-event tests pass;
- any remaining moderate/minor issue is recorded with impact, workaround, owner,
  and intended correction.


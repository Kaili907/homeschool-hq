# Student UX Integration Agent report

Status: bounded Session 7 UX integration patch  
Owned scope: `integration-labs/student-runtime/src/App.tsx`,
`integration-labs/student-runtime/src/styles.css`, one uniquely named browser
specification, and this report

## Outcome

The browser projection now presents the canonical learning task before
secondary Jarvis history in DOM and visual order, moves focus to each new task,
restores focus after a break or transcript close, and keeps direct Break and
Save actions reachable on mobile. The check-in and decision views use the same
task-first order.

The learner-facing progress copy now describes six learning segments. A saved
card shows both the exact canonical pointer and a friendly `Step X of 6` label.
Segment completion remains the only progress authority.

Captions remain explicitly always on because the canonical focus projection
sets `captions: true`. If the inherited Session 3 captions switch is activated,
the UI explains that captions stay on instead of silently pretending to change
state. Transcript, no-audio, speech-unavailable, missing-media, reduced-motion,
large-text, keyboard, and mobile paths remain available.

Card 5 DEC-012 is shown as the duration-policy authority. Resolved policy UI
shows its bounded source, feasible range, and reason code. A `manual-review`
policy is supportive, does not present the bounded fallback as a
recommendation, and blocks the “another lesson” automatic-extension action
while preserving Break, Save, and Finish.

## Audited demonstrations and fallbacks

| Area | Result |
| --- | --- |
| Grade 5 math | Existing browser demonstration covers retrieval, visual teaching, guided work, independent draft, approved water break, exact return, reflection, exit ticket, local-time review, and aggregate-only evidence. |
| Grade 5 reading | Existing browser demonstration covers retrieval, teaching support, guided and independent responses, low-confidence support, intentional save, refresh, and exact exit-ticket resume. |
| Timer anxiety | Visible, minimal, and hidden modes remain controlled by the typed runtime. Hidden mode exposes no numeric timer value and never changes segment progress. |
| Breaks | Direct access remains visible; the canonical runtime owns request/approval/resume and preserves `countsAsFailure: false`. Break-entry focus moves to the break heading. |
| Refresh/resume | The integrity-checked store and runtime state machine remain authoritative. This patch only improves the saved-location copy and focus target. |
| Captions/transcript | Captions are always on; transcript entries remain speaker-labelled and now announce “Reason code” before the bounded code. Escape closes the transcript and restores its toggle. |
| No audio/speech | No-audio and synthesis fallbacks remain visible. The unsolicited speech-unavailable live message is now shown only when speech input was requested but the capability is absent. |
| Missing media | The fallback is a named “Visual teaching board text equivalent” region and leaves the response enabled. |
| Reduced motion/large text | Existing runtime flags still drive immediate motion cancellation and 130% text reflow. |
| Keyboard/mobile | Task content precedes support in DOM order; new task headings receive focus; disclosure Escape behavior restores the summary; 44px direct actions and 320px no-overflow are covered by the added spec. |
| Jarvis language | Existing allowlisted runtime messages remain in force. The added browser scenario checks supportive “too hard” copy, a bounded reason code, and absence of blame terms. |

## Files changed

- `integration-labs/student-runtime/src/App.tsx`
- `integration-labs/student-runtime/src/styles.css`
- `tests/student-runtime/e2e/student-ux-integration-agent.spec.ts`
- `docs/student-runtime/agents/student-ux-integration.md`

No adapter, persistence, state-machine, Wave 1, production, GitHub, Supabase,
database, authentication, identity, storage, calendar/parent-runtime, or
deployment file was edited by this agent.

## Typed API limitations handed to the control room

1. `ParentPreferenceInputV1` has no captions field or setter, while the reused
   Session 3 `ComfortPanel` exposes a captions toggle. The canonical focus
   projection requires captions, so this integration keeps them on and explains
   the constraint. A future component API should support an always-on/locked
   captions presentation directly.
2. At audit time, `App.handleLearnerAction` had to construct transcript entries
   because `runtimeMachine` exposed no guarded learner-support command. The
   control room assigned a state owner to add
   `recordLearnerSupportAction(...)`; App should consume that API and delete its
   direct transcript/revision mutation before the final package is sealed.
3. The canonical parent input stores reduced motion and large text as booleans,
   while the Session 3 panel offers three motion and three text-scale choices.
   The current projection intentionally collapses those choices to the safest
   supported boolean state. Preserving “minimal” versus “none” and 115% versus
   130% requires a future canonical/UI adapter revision rather than local
   unversioned state.

## Validation

Before this bounded patch:

- `npm run typecheck`: passed.
- `npm run test:browser -- --project=desktop-chromium`: 7 passed.

The added
`student-ux-integration-agent.spec.ts` exercises the new 320px task-first
ordering, focus movement, explicit caption behavior, hidden timer, Escape focus
restoration, canonical task reference, reason-coded supportive Jarvis copy,
touch targets, and document-width reflow.

Final validation must be rerun after the concurrent DEC-012
`ResolvedDurationPolicy` interface and guarded learner-support API land. Any
shared type failure from those pending changes is not a reason to reintroduce
the retired Card 5 provisional wording or invent a local fallback shape.

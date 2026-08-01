# Session 12 — Host Study Engine Integration

This directory documents the host-owned integration of Adaptive Study Engine RC1 into the Manuel Academy React application. The integration is intentionally gated, local-only, and non-production.

## Host flow

The existing `App.tsx` screen-state navigation remains authoritative. No router was added.

1. The household must be signed in, bound, and have verified sync provenance.
2. The learner comes from `AppState.activeProfileId`; an opaque Study learner reference is derived from the authenticated household plus host profile reference.
3. `studyDashboard` shows scheduled, resumable, review, and completed projections.
4. `studySession` re-resolves the block by opaque ID and rechecks the learner before mounting.
5. `StudySessionContainer` calls the controlled RC1 `student.ts` boundary through `AcceptedRc1HostRuntime`.
6. Transient learner text passes through the injected safety classifier boundary and accepted Tutor bridge. It is cleared from component state and never written to a Study port.
7. Calendar progress uses the controlled RC1 calendar wrapper for start, segment completion, break, exact resume, and continuation.
8. Parent projections and controls live in the parent-PIN-gated Parent Hub Study tab, outside `AppState`.

## Feature gate

`VITE_STUDY_ENGINE_ENABLED` must equal the exact string `true`. Missing, empty, differently cased, whitespace-padded, or truthy-looking values remain disabled.

When disabled:

- Study services are not constructed.
- Study navigation and the Parent Hub Study tab are absent.
- No Study persistence, safety, calendar, review, or outbox call occurs.
- Legacy QuizSession, missions, reading, typing, assessments, calendar, tutor, and assistant behavior is unchanged.

The flag is not set in production configuration by this session.

## Controlled RC1 surfaces

Host adapters import only controlled files beneath `adaptive-tutor/study-engine/runtime/src/*` and the accepted presentation-only `ui/JarvisCore.tsx`.

Used RC1 paths:

- `runtime/src/student.ts`: launch and submit
- `runtime/src/health.ts`: exact version preflight
- `runtime/src/ledger.ts`: accepted ledger shape
- `runtime/src/safety.ts`: accepted classifier and gateway shape
- `runtime/src/calendar.ts`: canonical calendar creation and transitions
- `runtime/src/parent.ts`: parent-control validation boundary
- `ui/JarvisCore.tsx`: captions/status/no-audio presentation only

The private Student Runtime lab app is not mounted. It is a no-props demo with hardcoded learner/content/localStorage and is not a compliant host boundary.

## Required launch context

`HostStudyLaunchContext` carries:

- household reference
- learner reference
- host profile reference
- grade
- subject
- lesson reference
- skill references
- household time zone and learner-local date
- accessibility settings
- timer preference
- parent duration/break limits
- accommodation limits

No Supabase client enters a Study component or port.

## Curriculum mapping

| Host lesson type | Canonical Study task/plan | Segment structure | Mastery authority |
|---|---|---|---|
| Math | retrieval, direct instruction, guided, independent, mastery check | five ordered required segments | Tutor Core |
| Reading | direct preview, reading, reflection | three ordered required segments; Tutor turns use the supported English bridge vocabulary | Tutor Core when assessed |
| Writing | direct plan, writing, reflection | three ordered required segments; Tutor turns use the supported English bridge vocabulary | Tutor Core when assessed |
| Quiz/practice | retrieval plus independent practice | two ordered segments | Tutor Core |
| Quiz/assessment | mastery check | one Tutor-governed segment | Tutor Core |
| Review | retrieval plus reflection | review-provenance plan | Tutor Core |
| Parent-created activity | `custom / parent-created-activity` | one completion segment | Completion only |
| Romeo Virtual Academy | `custom / romeo-virtual-academy-activity` | one external-reference segment | Completion only |

Stable references derive only from caller-owned lesson references and fixed mapping suffixes, never learner names, emails, lesson text, DOM order, or array positions.

## Existing QuizSession

`QuizSession` is not replaced. Placement and Daily Practice remain legacy non-Study flows. A future Study activity adapter may use QuizSession as presentation only after answers and directives pass through an accepted learner-aware Tutor receipt. Local `correct`, `recordAnswer`, `onFinish`, and host mastery fields never become canonical Study mastery evidence.

## Parent controls

The Parent Hub Study adapter implements:

1. accept recommendation
2. reject recommendation
3. set maximum duration
4. set break duration
5. hide timer
6. add functional accommodation
7. reschedule incomplete work as an idempotent continuation
8. mark outside or technical interruption
9. commit an adult-private note through the isolated private port
10. request tutor or teacher review as `local-only-not-delivered`

Actor, household, learner, and current revision come from host composition, not arbitrary form fields. Private-note bodies are never returned by the public adapter and never enter AppState, calendar, events, reviews, outbox, learner UI, or parent summary state.

## Accessibility and responsive behavior

Host Study CSS is scoped under `.study-runtime-host`; RC1 prototype/global styles are not imported. The integration provides skip links, native landmarks and controls, focused task/recovery headings, 44px minimum controls, scoped large text, reduced motion, no-audio and missing-media fallbacks, visible captions, optional transient approved-message transcript, high contrast/forced-colors borders, responsive card grids, and one interactive task at a time. Hidden-timer mode does not render countdown digits.

Manual screen-reader, 200% zoom, Windows High Contrast, physical touch-device, and real speech-failure review remains required before student exposure.

## Known RC1 integration conditions

1. RC1 has no prop-driven React Student Runtime export. The host-owned container is the compliant mount over the public service boundary.
2. RC1 `runtime/src/tutor-bridge.ts` hardcodes `learner:local-release-candidate`. Session 12 uses a one-session, one-learner, local-only binding adapter, validates that exact sentinel, removes it from host projections, and refuses cross-learner reuse. Production is blocked until the public wrapper accepts a caller-supplied learner reference.
3. RC1 parent state cannot append a post-creation recommendation while preserving public revision history. Recommendation accept/reject remains host-validated; other public commands additionally pass through the accepted RC1 parent boundary.
4. The host has no durable household time-zone or Study settings field. The local adapter uses the browser-resolved IANA zone and in-memory settings; Session 13 must replace both.
5. Root browser automation dependencies are absent. Accepted RC1 Axe/mobile/keyboard suites were replayed from an isolated locked dependency install and passed, but a host-specific authenticated browser harness was not added to the root dependency graph. Host presentation tests and scoped CSS checks pass; manual host accessibility review remains required.

These conditions prohibit production/student exposure but do not affect feature-disabled legacy behavior.

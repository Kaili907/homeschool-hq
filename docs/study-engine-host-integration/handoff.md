# Session 12 Host Runtime Integration Handoff

## Repository state

- Repository: `C:\Users\aemanuel\homeschool-hq`
- Worktree: `C:\Users\aemanuel\homeschool-hq\.worktrees\study-engine-host-runtime`
- Branch: `integrate/study-engine-host-runtime`
- Base: `74e2c21fe3bbf9c0ec270610fe71101ae5abd60a`
- Final commit: the commit containing this handoff; its SHA is reported in the dispatch response
- Deleted files: none

## Specialists reconciled

1. Host Architecture and Navigation Agent
2. Student Runtime Integration Agent
3. Calendar and Parent UI Agent
4. Jarvis and Tutor Boundary Agent
5. Accessibility and Responsive UX Agent
6. Regression and Adversarial Test Agent

Their findings drove the host-owned container, strict identity binding, public-wrapper-only integration, scoped styling, local-only port labels, adversarial tests, and explicit production blockers.

## Host routes and screens

The existing `App.tsx` screen-state model now contains gated `studyDashboard`, `studySettings`, and `studySession` screens. The High School home receives a gated Study entry. Parent Hub receives gated Study calendar and parent-control tabs. No router was added and legacy QuizSession remains unchanged.

`VITE_STUDY_ENGINE_ENABLED` enables Study only when its exact value is `true`. When missing or any other value, no Study navigation, Parent Hub Study tab, service construction, port call, or AppState Study state exists.

## Accepted RC1 surfaces

- `runtime/src/student.ts`
- `runtime/src/health.ts`
- `runtime/src/ledger.ts`
- `runtime/src/safety.ts`
- `runtime/src/calendar.ts`
- `runtime/src/parent.ts`
- `ui/JarvisCore.tsx`

The private lab application and prototype global CSS are not mounted or imported.

## Provisional ports

Session 12 creates local-development implementations for `StudyPersistencePort`, `StudyCheckpointPort`, `StudyReviewQueuePort`, `StudyCalendarPort`, `StudyParentSettingsPort`, `StudyAdultPrivatePort`, `StudyEventLedgerPort`, `StudyOutboxPort`, and `StudySafetyPort`. They are explicitly labeled `LOCAL DEVELOPMENT ONLY — NOT DURABLE`; delivery remains truthfully `proposed-not-delivered`.

Session 13 replaces persistence, checkpoints, review queue, calendar, parent settings, adult-private storage, event ledger, transactional outbox, browser-derived household time zone, and preview seeding. Session 14 replaces the local safety classifier, RC1 sentinel learner binding, secured voice/media boundary, adult delivery, and host identity-epoch cancellation source. Exact injection points are in `replacement-map.md`.

## Decision and conditions

**PASS WITH CONDITIONS**

The gated host integration is ready for reconciliation, but not production or student exposure. Remaining blockers are durable Session 13 ports, a reviewed Session 14 production classifier, caller-owned learner identity in the controlled RC1 Tutor wrapper, durable household time zone/settings, secured voice/media, real adult delivery receipts, a host-specific authenticated browser harness, and manual accessibility/device review.

No push, merge, migration, database change, deployment, production classifier, provider-key path, or student exposure was performed.

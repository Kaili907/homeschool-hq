# Family Dashboard + Jarvis Convergence R1

## Status and lineage

This convergence makes the reviewed Jarvis Student Dashboard the normal authenticated learner home for the real Family Pilot. It is based on Web R3 `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9` and integrates the reviewed data adapter `45afd3f512eb3f171de1c770efa337ae0be05538` and reviewed Jarvis UI `7f2f55c7e9b16e737d89eba97302ec77c97c918e`.

The branch contains faithful cherry-picks of both reviewed inputs. The adapter cherry-pick tree is byte-identical to its reviewed input. The Jarvis UI patch is applied after that adapter so both reviewed changes coexist on the Web R3 base.

## Authenticated learner route

The top-level Family Pilot route remains `/family-pilot`. First-run setup and the Parent Hub keep the existing `FinalShell`. After learner selection and the existing optional four-digit learner PIN succeeds, `FinalFamilyPilotApp` renders `StudentDashboard` as the full learner home. No legacy dashboard, mission fixture, or manual setup surface is mounted beneath it.

The authenticated flow is:

```text
learner picker / PIN
  -> active learner ref in the existing controller
  -> real Family Pilot dashboard adapter
  -> reviewed Jarvis Student Dashboard presentation
  -> adapter-authorized Start / Continue intent
  -> existing LessonSurface or AssessmentSurface
  -> existing Study runtime and IndexedDB ports
  -> Save and exit / Done
  -> refreshed dashboard projection
```

Lock and Switch learner both close the active runtime, clear the persisted active learner in both current Family Pilot stores, and return to the learner picker. Sign out performs the same custody cleanup before leaving `/family-pilot`. Parent-only quick tools clear learner custody and return through the existing Parent PIN gate.

## Real data composition

The production dashboard imports no fixtures. `buildFamilyPilotStudentDashboardModel` receives only existing authority slices:

- the exact `activeStudentRef` and matching setup learner;
- the matching learner's core assignment records;
- the current daily schedule projection built from those real records;
- matching assessment, attestation, source-readiness, and Safety state;
- the admitted final curriculum catalog;
- current storage/recovery state.

The adapter returns `null` rather than selecting a sibling when the active learner is missing. Every emitted command carries the exact active `studentRef`, and the host validates that learner binding again before honoring a work, course, tool, or sign-out intent.

### Today and upcoming

Today's work uses the existing deterministic daily schedule projection over the learner's non-abandoned assignments and assessment assignments. Assignment state remains the authority for `START`, `CONTINUE`, completed, waiting, unavailable, and blocked presentation. No dashboard click creates a new assignment, session, or progress record.

The current Family Pilot has no persisted future-planner authority. Therefore upcoming renders only actual future `ScheduleItemV1` records supplied to the adapter and otherwise shows an honest empty state. This convergence does not synthesize future dates or implement Auto Planner.

### Courses and progress

Course cards resolve the learner's enabled subjects and exact per-subject working grades against the admitted final catalog. Assignment progress counts only non-abandoned assignments belonging to that exact course. A course with no assigned work shows no percentage instead of presenting a fabricated `0%` denominator. Completed work is reprojected when Study exits, so Today's work, course progress, and completion copy refresh from existing authority.

## Study start and resume

The dashboard does not introduce a Study runtime. A `START` or `CONTINUE` command is accepted only when it exists on the current learner's current adapter model. The exact assignment ref is then passed to the existing `LessonSurface` or `AssessmentSurface`.

`LessonSurface` continues to use `FinalFamilyPilotController.start` and `FinalFamilyPilotController.reopen`. Existing saved session handles and durable Study documents remain authoritative in IndexedDB. Continue therefore reopens the same assignment, lesson, session, completed segments, and current segment; it never converts a saved session into a fresh dashboard-owned session.

## Jarvis mode

Jarvis remains `visual-only`. The production host supplies no `onActivate` callback. The reviewed presentation keeps the narrow optional `onActivate?: () => void` seam for a later Tutor V2 host, but this convergence adds no Tutor V2 provider, AI request, microphone, old Tutor API, conversation state, or transcript persistence. Existing static curriculum help remains inside Study and is not promoted into a dashboard Tutor workflow.

## Security and storage lifecycle

- IndexedDB remains authoritative for durable Study and learner-response documents.
- Supporting Family Pilot metadata remains in its existing validated stores.
- Start/Continue never accepts a fixture ref, arbitrary DOM ref, or sibling command.
- Lock, Switch learner, Parent tools, and Sign out clear active learner custody before changing surfaces.
- Parent reports and assignment tools still require the existing Parent PIN authorization.
- Safety holds and incomplete Safety recovery remove learner launch commands.
- Dynamic Social source requirements and guardian/assessment waiting states remain blocked.
- Browser answer authority, correct answers, scoring guides, PIN verifiers, sibling state, raw Safety text, and Tutor transcripts are not projected into the dashboard model.
- Hosted sync, scorer activation, curriculum correction, and Auto Planner remain outside this change.

## Responsive and accessibility behavior

The reviewed CSS dashboard remains responsive at phone, tablet, laptop, and desktop breakpoints. The full production learner home preserves the single main landmark, skip link, semantic buttons, accessible action names, progressbar semantics, visible focus, forced-colors behavior, and horizontal-overflow constraints. Jarvis animation runs only when motion preference permits it; every Jarvis animation tier and hover translation are disabled for reduced motion.

## Verification

The convergence is covered by:

- pure adapter tests for active-learner filtering, real Today/upcoming/course/progress projections, command binding, readiness blocks, bounded catalog lookup, and visual-only Jarvis;
- presentation convergence tests for exact assignment refs, Start/Continue vocabulary, honest no-denominator progress, and private/sibling-data exclusion;
- reviewed dashboard component and browser tests for fixture-state rendering, keyboard focus, reduced motion, 390 px phone, tablet, laptop, and desktop layouts;
- the production Family Pilot browser workflow for learner/PIN, dashboard landing, Start, Continue, exact process-reopen resume, return from Study, completion refresh, sibling isolation, Lock, Switch learner, Sign out, hard refresh, Safety/source/guardian gates, all supported curriculum routes, IndexedDB refusal, and migration/recovery;
- production build browser-answer-authority scanning and `npm run audit:web-release`.

Final command results and the pushed acceptance SHA are reported by the session that commits this file.

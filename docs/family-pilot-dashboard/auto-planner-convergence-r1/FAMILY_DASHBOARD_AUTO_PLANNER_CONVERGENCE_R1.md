# Family Dashboard + Auto Planner Convergence R1

## Status

Ready for acceptance. This branch was not deployed and no Netlify configuration or deployment was changed.

## Accepted inputs and lineage

| Input | Commit | Tree | Integration |
| --- | --- | --- | --- |
| Jarvis Dashboard | `5284e7721212e00b29e64f248940b4de412e491e` | `1131b0d1ce699374a8d8c7a228cc821eed107ba5` | Branch starting point |
| Auto Planner R1 | `f0f52711774e34f23d642affd0da4114ab55b049` | `9705fe946659801bc9c82aff9fbf669668ee93fa` | Full commit cherry-picked as `3fd2a9f1` |
| Auto Planner R2 | `6e4ae01ecaba30da0fb08b874d79a464f5e5bd42` | `354f6f3a03b96b76f5ab1e9eb3f276075e02568b` | Full direct-child correction cherry-picked as `b9790734` |

The three accepted inputs share Web R3 commit `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9` as their merge base. R2 is a direct child of R1. The accepted planner files were not recreated or edited during convergence.

## Integration architecture

`FinalFamilyAutoPlannerHost` is the new Family Pilot host/orchestration adapter. React presentation does not contain planner policy.

1. The authenticated learner ref is combined with the existing persisted household ref.
2. The host opens the accepted planner record in the existing `manuel-academy.study.family-pilot-durable` IndexedDB database and `records` object store.
3. Existing Family Setup supplies nominal grade, official per-subject working grades, and enabled subjects read-only.
4. The admitted final curriculum runtime supplies the accepted catalog port.
5. Existing Core assignments, final assessment assignments, and minimized safety holds supply facts.
6. `FamilyAutoPlanner.today` selects work and emits narrow materialization intents.
7. `FinalFamilyPilotController.assignLesson` or `assignAssessment` remains the only materialization authority.
8. The host composes only actual planner items plus persisted same-day completions into the existing schedule adapter.
9. `buildFamilyPilotStudentDashboardModel` rebuilds the accepted Dashboard model.
10. The unchanged `StudentDashboard` receives the composed presentation model and launches the one existing Study Engine.

The planner is invoked by the active-learner dashboard lifecycle effect after sign-in, learner switch, Study exit/completion refresh, hard refresh, or process reopen. It is not invoked inside the `StudentDashboard` or `JarvisDashboard` render loop.

## School Plan setup and Parent authority

The already PIN-gated Parent Hub now has a School Plan tab for each learner. No learner route renders School Plan controls. The surface explicitly presents, and requires the Parent to review before saving:

- learner identity;
- IANA timezone (detected only as an editable prefill);
- school-year start/end;
- selected school weekdays;
- explicit days off and added school days;
- every already-enabled subject;
- official working grade per subject, read-only;
- authorized course selection;
- subject order;
- accepted per-subject daily lesson cap/cadence;
- local start time; and
- subject pause state.

Enabled subjects and working levels continue to be controlled by existing Parent Preferences. The planner never changes them. Suggested Monday-Friday dates/order, one lesson, start time, and detected timezone are draft values only: none persist until the Parent selects **Save School Plan**.

Each learner plan is a separate accepted R2 document. No planner fields were added to localStorage or the app-state schema, and no second learner/planner database was created.

## Today flow and learner copy

Configured learners receive real, automatically materialized work. The host retains the accepted precedence for unfinished carry-forward work, manual overrides, assessments, subject pauses, safety holds, catalog/offline failure, and new work.

When no plan exists and there is no manual Parent work, the learner sees: “Today’s schoolwork isn’t ready yet.” The learner is directed to ask a Parent to unlock Parent Hub and review School Plan. `NEEDS_PLAN_SETUP` and every other engineering enum remain outside learner presentation.

An existing manual Parent assignment remains usable before automatic setup. This is a projection of already-authorized Core state only; it cannot select or create ordinary curriculum work. Its quick tool routes to existing assignment controls. An empty missing-plan learner routes to School Plan after Parent PIN authorization.

On `NO_SCHOOL_TODAY`, the host creates no ordinary work and shows friendly “No school today” copy. Upcoming contains only actual schedule input. The convergence does not forecast or fabricate future assignments.

## Next lesson, carry-forward, and manual override

- A required planned/active/paused assignment marks its subject as having open work and carries to the next school-local date.
- No next lesson in that subject is created while required prior work remains open.
- A same-day completed automatic or required manual lesson consumes the subject’s accepted daily cap.
- On the next school day, course/unit/lesson release order selects the next canonical uncompleted lesson.
- Manual assignments retain accepted `MANUAL_OVERRIDE` precedence and remain available through the existing Assignments & readiness surface.
- Parent can add lessons/assessments manually, resolve assessment reviews and guardian attestations, attach approved dynamic-source metadata, clear safety holds, edit official working levels/enrollment, and pause subjects in School Plan.
- The accepted planner treats an abandoned automatic assignment as requiring Parent resolution rather than silently advancing.

## Assessment and safety authority

Assessment materialization uses `FinalFamilyPilotController.assignAssessment`. The planner never scores, certifies, or changes assessment status. Pending trusted scoring, adult rubric review, and guardian attestation continue to block unit advancement truthfully.

Existing exact-session safety holds are read as minimized facts. Held work becomes non-actionable and no sibling state is projected. Only the already Parent-authorized clear-hold path changes safety state.

## Working level, grades, and subjects

The official `FamilySetupStudent.workingGradeBySubject` remains the only per-subject working-level authority. The planner reads it and never writes it. Host tests include nominal Grade 10 with Mathematics working Grade 5.

Admitted grades are exactly 3, 4, 5, 7, 8, 9, 10, 11, and 12. Grade 6 remains intentionally unsupported and is never substituted. The Parent School Plan explains that a Grade 6 profile needs an explicit supported working level. Auto Planner R2 full-grade tests and the enabled browser matrix prove all 90 grade/subject cells across all ten canonical subjects.

## Multi-student isolation

Host convergence tests configure elementary Grade 5, middle Grade 7, and nominal Grade 10/working Grade 5 learners concurrently. Each receives a distinct scoped document, materialization ref, assignment ref, working grade, and schedule. The accepted browser-process test continues to prove sibling assignment, response, PIN, safety, and dashboard isolation.

## Timezone, refresh, offline, and concurrency

- Local date is derived by `Intl.DateTimeFormat` using the explicitly persisted IANA timezone.
- Tests cover same-date repeat, Friday-to-Monday rollover, weekend, explicit day off, and explicit added school day.
- IndexedDB persistence plus deterministic Core assignment refs survive hard refresh and browser-process reopen.
- When catalog data is unavailable, accepted already-materialized work remains usable and new work fails clearly.
- Two concurrent dashboard requests share accepted compare-and-set revision semantics. Core’s deterministic no-reset contract and planner provenance CAS leave one assignment and one materialization.

## Study and Jarvis boundaries

Start and Continue commands remain composed from existing Dashboard commands and are accepted only for the exact active learner and exact authorized assignment. Save/exit and process reopen resume the exact Study session and segment state.

There is exactly one Study Engine. The planner does not start Study, score learner work, or store learner responses.

Jarvis remains `VISUAL_ONLY`. No AI provider, microphone, speech recognition, Tutor transcript, old Tutor API, or Tutor V2 runtime is connected. The accepted optional future Tutor V2 callback seam remains unchanged.

## Security evidence

- `npm run audit:web-release` — PASS, including production build, learner-release audit, route lifecycle tests, function allowlist, and `WEB_RELEASE_SECURITY_GATE PASS`.
- Browser answer audit — PASS: zero `answerIndex`, `correctAnswer`, `expectedAnswer`, answer-key, or admitted-authority findings.
- Enabled browser tests verify no PIN leakage, no raw answer or Tutor transcript persistence, no sibling projection, no external network request, and no arbitrary cross-learner launch.
- Planner persistence stores only accepted plan and provenance records. It stores no response body, PIN verifier, safety text, curriculum content, or Tutor data.

## Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| Focused planner/dashboard/convergence Vitest run | 10 files, 88 tests PASS |
| `npm test` | All convergence suites PASS; one unrelated repository deployment-preflight fixture assertion fails as described below |
| `npm run test:family-pilot-flag-default` | 1 test PASS; normal production build keeps Family Pilot off |
| Dashboard visual browser suite | 8 tests PASS; phone/tablet/laptop/desktop, reduced motion, keyboard/focus, Jarvis boundary |
| `npm run test:family-pilot-browser` | 13 tests PASS; enabled production build and full browser workflow |
| `npm run audit:web-release` | PASS; `WEB_RELEASE_SECURITY_GATE PASS` |

The focused accepted planner matrix also covers manual precedence, pauses, assessment waiting, safety holds, offline materialized work, conflicting revisions, missing/invalid plans, working-grade authority, Grade 6 refusal, all admitted grades, and all ten subjects.

## Known limitations

1. `npm test` has one repository-level baseline failure in `tests/study-deployment-env-preflight.test.js`: the integrated repository schedule fixture expects `READY_FOR_DEPLOYMENT_ENVIRONMENT` but receives `BLOCKED_BY_DEPLOYMENT_CONFIG`. Rerunning that file alone reproduces 15 passing checks and the same single failure. This convergence changes no deployment, Netlify, worker, or scheduled-function configuration. The required Web Release security gate independently passes.
2. The accepted R2 document has per-subject `lessonsPerDay`; no unaccepted global-cap record or future forecast was invented.
3. Full School Plan backup/restore is outside this convergence: plans already persist across refresh/process reopen in accepted IndexedDB, while the existing Parent Download Backup schema remains unchanged.
4. Existing manual assignment contracts do not define a future-date reschedule record. Parent pause and manual assignment/assessment paths remain available; no speculative scheduling authority was added.
5. This branch has not been deployed.

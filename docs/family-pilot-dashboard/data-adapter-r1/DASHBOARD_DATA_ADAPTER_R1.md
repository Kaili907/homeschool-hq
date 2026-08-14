# Family Pilot Student Dashboard Data Adapter R1

## Status

`FamilyPilotStudentDashboardModel` is a learner-safe, read-only composition over the accepted Family Pilot authorities. It does not persist, plan, schedule, score, or navigate. The visual dashboard and its route wiring remain separate work.

Authoritative application base: `56dd8a45fee1ca03dd5f83e1466c9f081824d6b9`.

## Current Family Pilot source inventory

| Dashboard concept | Authoritative source | Adapter use |
| --- | --- | --- |
| Active learner and learner profile | `FinalFamilyPilotAppStateV1.activeStudentRef` and `FamilySetupState.students` | Exact `studentRef`, safe display name, nominal grade, enabled subjects, per-subject working grade |
| Assignments and Study progress | `FamilyPilotStateV1.students[].assignments` | Assignment state, title, lesson ref, segment counts, completion time; always filtered to the active learner |
| Schedule and today's work | `ScheduleItemV1[]` from `family-pilot/schedule` | Exact learner/date/order membership only; the adapter never turns an unscheduled assignment into a daily mission |
| Courses and units | `FinalFamilyPilotCatalog.runtime` | Eager 90-course/unit summaries; exact working-grade course and current-unit lookup |
| Lesson source readiness | `FinalFamilyPilotCatalog.runtime.getLesson` plus `FinalFamilyPilotSourceAttachment` | Bounded lazy lookup for visible work; dynamic Social content remains blocked until an exact attachment exists |
| Assessment state | `FinalFamilyPilotAssessmentAssignment[]` | Planned/active/trusted-scoring/adult-review/guardian-pending/certified learner-safe status |
| Assessment source readiness | `FinalFamilyPilotCatalog.getAssessment` plus source attachments | Bounded visible-assessment lookup; learner tasks and scoring material never enter the model |
| Guardian pending state | `FinalFamilyPilotAttestationRecord[]` | Exact learner/assignment pending state only; no adult identity or evidence detail |
| Safety holds | `SafetyHoldV1[]` plus `SafetyStateRecoveryState` | Exact learner/session open-hold test; incomplete or unavailable safety recovery stays conservatively blocked; no raw safety reason or learner text is projected |
| Progress reports | Existing core assignment progress and report semantics in `family-pilot/reports` | Learner summary counts and recent completions; no new report store |
| Storage health | `FinalFamilyPilotAppStoreStatus` and `FinalFamilyPilotStorageHealth` | Unsafe write/read-only/unavailable states remove launch commands and show a learner-safe block |
| Tutor availability/fallback | Existing local static help plus the adapter's injected Jarvis port | R1 is visual-only; static help remains available inside Study; no AI call or transcript |
| Backup and recovery | `family-pilot/backup`, `family-pilot/recovery`, IndexedDB recovery seams | Inventoried but deliberately not exposed on the student dashboard; backup material is an adult/recovery concern |
| Sign-out/session state | Active learner selection in the final app/controller | Typed `SIGN_OUT` command only; the adapter does not mutate the active session |

The final browser catalog is the R3 authority: 9 grades, 90 courses, 8,292 lessons, and 699 assessments. The older `family-pilot/catalog-runtime` (grades 5/7/8) is not used by this adapter.

Supported curriculum grades are 3, 4, 5, 7, 8, 9, 10, 11, and 12. Grade 6 remains a valid nominal grade but is not silently treated as a curriculum grade. A subject uses its explicit working-grade override or the nominal grade only when the final catalog actually contains that grade/subject course.

## Historical dashboard contract inventory

References inspected: `26f3ec1d`, `c879b241`, `e98de47f`, `f7ff8cc9`, `e9139621`, `40db3d59`, and the launched lineage on `master` at `ffd1cc5a`.

| Historical concept/field | Classification | R1 decision |
| --- | --- | --- |
| Learner display identity and greeting | `REUSE_SEMANTIC` | Safe display name, initial, nominal grade, and greeting remain |
| Today's schedule/timeline | `ADAPT_TO_FAMILY_PILOT` | Comes only from exact `ScheduleItemV1` plus matching assignment/assessment authority |
| Up next/start/continue | `ADAPT_TO_FAMILY_PILOT` | Typed command derived from current assignment state after readiness blocks |
| Honest no-work state | `REUSE_SEMANTIC` | `NO_SCHEDULED_WORK`; no fake mission or schedule fallback |
| Mixed subject levels | `ADAPT_TO_FAMILY_PILOT` | Per-subject working grade from setup, never nominal-grade substitution |
| Course cards and course routes | `ADAPT_TO_FAMILY_PILOT` | Final 90-course eager index plus `OPEN_COURSE` command |
| Lesson/course progress | `ADAPT_TO_FAMILY_PILOT` | Existing assigned/completed records; no second progress authority |
| Current unit | `ADAPT_TO_FAMILY_PILOT` | Existing eager unit index plus the current assignment lesson ref |
| Schedule, reports, and assignment tools | `REUSE_SEMANTIC` | Typed `OPEN_SCHEDULE`, `OPEN_REPORTS`, and `OPEN_ASSIGNMENTS` commands |
| Sign out | `REUSE_SEMANTIC` | Exact learner-bound `SIGN_OUT` command |
| Visual Jarvis panel | `REUSE_SEMANTIC` | `VISUAL_ONLY`, non-interactive; static help availability is stated honestly |
| Legacy `Profile.missions` and manual mission toggles | `LEGACY_ONLY` / `REMOVE` | Not imported; Family Pilot schedule/assignments are the authority |
| Old Academy profile/catalog/school-year projection | `LEGACY_ONLY` / `REMOVE` | Replaced by final Family Pilot setup/core/schedule/final catalog sources |
| Prize Shop/stars/rewards | `LEGACY_ONLY` / `REMOVE` | No authoritative Family Pilot reward state exists |
| “Classic home” and old practice workspace shortcut | `LEGACY_ONLY` / `REMOVE` | No current route command is invented |
| Interactive Jarvis conversation | `TUTOR_V2_FUTURE` | Future injected `tutorCapability`/`onOpenTutor` port; no Tutor V2 import or persistence now |

## Dashboard model

`buildFamilyPilotStudentDashboardModel(input)` returns `Promise<FamilyPilotStudentDashboardModel | null>`. `null` means no exact active roster learner; it never falls back to the first child or a sibling.

The model contains:

- `learner`: exact learner ref, safe display name, initial, nominal grade, greeting.
- `today`: date, honest empty/scheduled state, bounded items, totals, and omitted count.
- `courses`: one entry per enabled subject with actual working grade, resolved course, current unit, assignment progress, and assessment summary.
- `progressSummary`: assigned/completed lesson counts, assigned/certified assessment counts, and at most five recent lesson completions.
- `upcoming`: at most five actual future schedule items.
- `alerts`: learner-safe grouped readiness blocks.
- `tools`: schedule/reports/assignments commands.
- `jarvis`: visual-only status.
- `actions.signOut`: learner-bound sign-out command.

### Today model

Only schedule entries whose `studentRef` equals the active learner and whose `date` equals `today` become today cards. Schedule order is preserved. A schedule entry must resolve to that learner's core assignment or assessment assignment before it receives a start/continue command.

Lesson states map as follows:

| Core state | Dashboard state | Command when ready |
| --- | --- | --- |
| `planned` | `NOT_STARTED` | `START` |
| `active` | `IN_PROGRESS` | `CONTINUE` |
| `paused` | `PAUSED` | `CONTINUE` |
| `completed` | `COMPLETED` | none |
| missing/abandoned/unresolvable | `UNAVAILABLE` | none |

Assessment states preserve trusted authority: planned can start, active can continue, certified is complete, and trusted-scoring/adult-review/guardian-pending states are waiting with no learner launch command.

Standalone Study-session and break rows remain visible because they are real schedule entries, but the adapter invents no assignment route for them.

### Course model

Course cards come from enabled subjects and the final catalog's eager course index. `workingGrade` is resolved independently for each subject. `curriculumStatus: UNAVAILABLE` and a null course command are returned if that exact grade/subject has no current course.

Course progress counts only existing, non-abandoned core assignments whose lesson refs belong to that exact working-grade course, so work from a previous subject level cannot be relabeled as current-course progress. It is assignment progress, not a claim that all catalog lessons were assigned. `completionPercent` is null when there are no assignments. The overall progress summary retains all of the learner's assignment history. Current unit is resolved from the eager unit index and current active/paused/planned lesson ref.

### Progress model

The model exposes counts, titles, subjects, and completion timestamps already present in learner state. It does not expose raw responses, correctness, mastery inference, scores, adult rubrics, or parent notes.

### Blocked-state model

Readiness is conservative and commands are removed for blocked work. Precedence for a visible lesson is:

1. catalog/source record unavailable;
2. storage unavailable/read-only/write failure;
3. exact session safety hold;
4. exact assignment guardian attestation pending;
5. required dynamic Social source absent.

Learner-facing model values are closed, generic categories: `STORAGE_UNAVAILABLE`, `SAFETY_HOLD`, `GUARDIAN_PENDING`, `SOCIAL_SOURCE_REQUIRED`, `ASSESSMENT_SCORING_PENDING`, `ADULT_REVIEW_REQUIRED`, and `ASSIGNMENT_UNAVAILABLE`. Hold refs, classifier reasons, storage internals, and adult identities do not leave the adapter.

## Action port

The adapter emits data commands only:

- `START`
- `CONTINUE`
- `OPEN_COURSE`
- `OPEN_SCHEDULE`
- `OPEN_REPORTS`
- `OPEN_ASSIGNMENTS`
- `SIGN_OUT`

Every command includes the exact active `studentRef`; work commands also include the exact `assignmentRef` and `workKind`. The adapter never performs navigation and never changes assignment/session state.

## Jarvis port

R1 defaults to `FAMILY_PILOT_VISUAL_ONLY_JARVIS_PORT`:

- `mode: VISUAL_ONLY`
- `status: STATIC_HELP_AVAILABLE`
- `tutorCapability: NOT_CONNECTED`
- `interactive: false`

`FamilyPilotDashboardJarvisActionPort` is the future injection seam. An available implementation can supply `tutorCapability: AVAILABLE` and `onOpenTutor({ studentRef })`; `openDashboardTutor` invokes only that injected callback. The dashboard builder itself never invokes it. There is no AI API call, Tutor V2 import, conversation state, or transcript persistence.

## Multi-student isolation

All setup, core assignment, schedule, assessment, attestation, source, and safety reads are filtered by the exact active `studentRef`. Safety holds additionally require the assignment's exact `sessionRef`. Source attachments for lesson launch require the exact learner, assignment, and lesson. Missing active refs return no model instead of selecting another child.

Focused tests use three learners with nominal grades 3, 7, and 10; distinct subjects and progress; and a Grade 12 subject working level for the nominal Grade 10 learner. The active Grade 7 learner's serialized model contains neither sibling ref.

## Privacy and security

The input contract intentionally accepts minimized authoritative slices instead of the whole final app state. Therefore PIN verifiers/digests, parent access state, household refs, and backup payloads do not cross the composition seam.

The output has no fields for PINs, PIN digests, bearer credentials, answer authority, correct answers, scoring guides, Tutor transcripts, private notes, backup material, or sibling state. Dynamic source metadata bodies are not projected—only the exact attachment status is tested.

## Performance

- Course and unit cards use the final runtime's eager, body-free 90-course/698-unit manifest.
- Lesson payload lookup occurs only for rendered schedule cards that need readiness/course binding.
- Today cards are capped at 24; `scheduledCount` and `omittedCount` preserve honest totals.
- Upcoming cards are capped at 5.
- Recent completions are capped at 5.
- No code calls `listLessons`, loads all 90 payloads, or copies the 8,292-lesson corpus into dashboard state.

## Files

- `src/study/family-pilot/dashboard-adapter/types.ts`
- `src/study/family-pilot/dashboard-adapter/actions.ts`
- `src/study/family-pilot/dashboard-adapter/buildDashboardModel.ts`
- `src/study/family-pilot/dashboard-adapter/buildDashboardModel.test.ts`
- `src/study/family-pilot/dashboard-adapter/index.ts`

No visual dashboard/Jarvis component, `App.tsx`, `FinalFamilyPilotApp.tsx`, shared route, persistence schema, or legacy runtime was modified.

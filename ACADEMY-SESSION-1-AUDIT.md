# Academy Session 1 — Read-Only Product, Architecture, and UX Audit

> Shareable audit document for review in ChatGPT or by another developer.
>
> This report is based on static repository and documentation inspection. No
> application files, production data, dependencies, branches, commits,
> migrations, or deployments were changed during the audit.

## Audit conclusion

The Academy is a capable local-first, single-household learning app, but it is
not yet a secure multi-role student-account platform. The most urgent findings
are:

1. Unauthenticated Anthropic and ElevenLabs provider proxies.
2. Unsafe first-sync and household-account-switch behavior.
3. No distinct authenticated student identities.
4. Mutable aggregate learning records with limited auditability.
5. Incomplete Jarvis safety enforcement, active-time tracking, and reading
   scoreability.

## Audit basis and repository preflight

### Repository state

| Item | Finding |
|---|---|
| Current branch | `mu-music` |
| Current commit | `744d576c8a7c77520d2612a5701a2b9bfd1c5f71` — `feat: add elementary music module` |
| Baseline | Local `master` and local remote-tracking `origin/master` both point to `15644974628ead6704c1e97e959cdbd801fdd1b3`, tag `v2.0-mp` |
| Ahead/behind | Relative to the local `origin/master` reference: 1 ahead, 0 behind |
| Upstream | `mu-music` has no configured upstream |
| Fetch status | Not fetched, because that would update `.git`; the remote-tracking status may therefore be stale |
| Worktree | Already dirty before the audit and remained unchanged |
| Staged files | None |
| Description | `v2.0-mp-1-g744d576-dirty` |

Pre-existing modified, unstaged files:

- `src/App.tsx`
- `src/components/QuizSession.tsx`
- `src/explain.test.ts`
- `src/explain/index.ts`
- `src/generators.ts`
- `src/skills.ts`

Pre-existing untracked items:

- `.worktrees/`
- `Homeschool-HQ-HS-Assistant-Addendum-v2-9.md`
- `Homeschool-HQ-Parent-Hub-Addendum-v2-6.md`
- `Homeschool-HQ-Reading-Addendum-v2-8.md`
- `Homeschool-HQ-Visual-Walkthroughs-Addendum-v2-7.md`
- `Life-Skills-and-Electives-Pack.md`
- `Personal-Finance-Curriculum-HS.md`
- `Reading-Passages-Q1.md`
- `School-Essentials-Pack.md`

The semantic diff showed only a blank-line addition in `App.tsx` and
`QuizSession.tsx`; the other modified markers appear to be line-ending
differences. None were touched.

### Documentation reviewed

All present repository-level operational, architecture, deployment,
curriculum, assessment, Parent Hub, reading, visual-walkthrough, high-school
assistant, and music documentation was reviewed, including:

- `CLAUDE.md`
- `DEPLOY.md`
- `MIGRATIONS.md`
- The main build specification
- Assessment, reading, Parent Hub, visual walkthrough, and HS assistant addenda
- Curriculum documents
- `src/music/README.md`

`README.md` does not exist.

There is documentation drift: `CLAUDE.md:4-5` describes a
no-production/no-database state, while the current operating guide and
`DEPLOY.md` describe a live Netlify application with Supabase sync.

### Technology inventory

| Area | Current implementation |
|---|---|
| Framework | React 19.1, TypeScript 5.8, Vite 6 |
| Styling | Tailwind CSS 4 |
| Package manager | npm with `package-lock.json` |
| Testing | Vitest |
| Application shape | Single-page React app using internal screen state, not URL routing |
| Local storage | One serialized application state plus separate sensitive/configuration slots |
| Database | Optional Supabase/PostgreSQL, storing one JSONB row per student profile |
| Authentication | Supabase email/password for Dad/household owner; local four-digit student and parent PINs |
| AI | Anthropic, ElevenLabs TTS, browser Web Speech recognition |
| Azure speech | Adapter name only; not implemented |
| Deployment | Netlify static SPA and Netlify Functions |
| Offline support | PWA/service worker, with API routes excluded from caching |

Relevant files:

- `package.json`
- `supabase/schema.sql`
- `netlify.toml`
- `DEPLOY.md`

### Runtime inspection limitations

Installed dependencies were sufficient to start Vite, but visual browser
inspection failed before attachment because an unrelated `%TEMP%\package.json`
contained invalid JSON. That external file was not altered. The listener
started for the audit was stopped; a pre-existing listener was left untouched.

Therefore:

- No rendered desktop, tablet, or mobile inspection was completed.
- Responsive and accessibility findings are source-based.
- No production database, deployed RLS configuration, live account, API key,
  provider dashboard, or real student data was inspected.
- Tests and build were not run; this was a strict read-only audit, not a
  development cycle.

---

## A. Executive summary

### What is working well

- The local-first design is appropriate for a family app and continues working
  without cloud login.
- Student work is logically grouped by profile ID.
- Reloading starts at the profile picker rather than silently reopening a
  student session.
- Core profile writes use functional state updates through
  `src/appState.ts:139-155`.
- Supabase RLS provides a genuine household boundary if the deployed schema
  matches `supabase/schema.sql:19-37`.
- Fixed assessments preserve separate retake attempts and keep AI feedback out
  of the assessment player.
- Jarvis minimizes context to one student and confirm-gates state-changing
  actions.
- Reading stores derived results rather than application-managed raw audio.
- Mindset reflections are excluded from normal exports and sync.
- API keys are outside application state and are not included in backups.

### What is confusing or unreliable

- Students see many activity choices but do not get one clear, ordered “Do this
  next” path.
- The elementary mission card is not the top actionable controller for the rest
  of the dashboard.
- The teen home screen is dense and mixes Jarvis, assessments, deadlines,
  missions, courses, and practice tools.
- The Parent Hub provides useful summaries but not grades, active time,
  corrections, reading alerts, or Jarvis safety attention in one place.
- Curriculum plans are mostly parent-facing static markdown rather than
  navigable student lessons.
- Placement assessment results can overwrite later practice state.
- Assessment resume and timing do not reliably preserve the exact state.
- Reading recognition failures can be saved as apparently valid low scores.
- “Attendance hours” are estimates based on completed plan blocks, not observed
  learning time.

### What is unsafe or insufficiently controlled

- The deployed Anthropic and ElevenLabs functions are unauthenticated credential
  relays.
- First Supabase sign-in can upload all local child data before the parent
  confirms migration.
- Signing into another household account on the same browser can copy the prior
  household’s local profiles into the new account.
- Students do not have separate authenticated identities.
- Parent/student authorization is a client-side PIN distinction, not a database
  role boundary.
- Student and parent PINs are plaintext and have unlimited retry attempts.
- Jarvis academic-integrity behavior is prompt-based rather than enforced by a
  trusted server policy.
- A distress match creates a transcript flag but not a durable, acknowledged
  parent safety event.
- Plaintext full-state backups include student PINs, parent PIN, responses,
  transcripts, reading records, and safety flags.

### What is missing

The most consequential missing foundations are:

- Student, guardian, teacher, and administrator identities and relationships.
- Per-subject enrollments and instructional levels.
- Immutable assignment, attempt, response, score-review, and mastery evidence.
- Reliable active/idle/time-on-task tracking.
- Content versioning and standards evidence.
- Account lifecycle, deactivation, recovery, and audit trails.
- A parent attention queue.
- Staff roster, bulk assignment, accommodations, overrides, and reporting.
- A server-enforced Jarvis policy and cost-control layer.
- Robust reading consent, scoreability, accessibility, and fairness controls.

### Five most important improvements

1. Secure the Anthropic and TTS gateways with authentication, exact schemas,
   server-owned prompts/models, and server-side usage controls.
2. Stop automatic first-sync reconciliation and bind each browser explicitly to
   a verified household before uploading child data.
3. Introduce real student/guardian identities, relationship-aware RLS, scoped
   student sessions, and account lifecycle states.
4. Add immutable, versioned learning and activity records while keeping Excel
   as the official gradebook.
5. Correct placement, assessment timing/resume, reading scoreability,
   daily-next-action, and shared-device accessibility before expanding AI
   features.

---

## B. Current student journey

### Student flow

```text
Open Academy
  → Profile picker showing all five students
  → Select student
  → Create PIN if none exists, or enter existing PIN
  → Student home

Elementary home
  → Assigned assessment, mission, reading, mindset, music,
    typing, placement/daily practice, or skill tree
  → Start an activity
  → Complete questions/session
  → Immediate practice feedback or generic assessment finish
  → Results
  → Return home

Teen home
  → Jarvis, stats, assigned assessment, deadlines, mission,
    mindset, service, geometry/algebra, course tracker
  → Start practice, timed work, or assessment
  → Results
  → Return home
```

The profile picker and PIN flow are implemented in:

- `src/components/Picker.tsx:34-89`
- `src/App.tsx:150-203`

### Parent flow

```text
Open Academy
  → Grown-Ups
  → Create or enter local parent PIN
  → Parent Hub
      → Today / Calendar / Plans / Status
  → Classic panel for detailed profile controls
  → Optional Dad Supabase sign-in for sync
```

There is no in-app parent-PIN recovery. Supabase account creation and password
recovery are also not implemented inside the Academy.

### Teacher or administrator flow

```text
Sign in
  → No teacher/admin identity or route exists
  → No roster, student search, assignment queue, grading queue,
    accommodations, group reporting, or audited “view as student”
```

The local parent PIN effectively acts as the only administrator gate.

### Daily journey findings

The elementary home currently presents greeting/statistics, assigned
assessments, mission, reading, mindset, music, typing, placement/daily work,
and skill trees. It offers useful activities but not an ordered daily plan.

The teen home places Jarvis prominently below the greeting, followed by
statistics, assessments, deadlines, missions, mindset, service, extensive math
choices, and the course tracker. Relevant code:
`src/components/HighSchoolHome.tsx:198-485`.

Returning students can resume an in-progress fixed assessment, but it reopens
at item zero rather than the last meaningful item. Most practice and course
activity has no automatic resume point.

Student logout clears the active profile, but there is no inactivity lock. On a
shared device, a sibling can continue an already-open session if the first
student walks away.

---

## C. Account-model verdict

| Required question | Verdict |
|---|---|
| Does every student currently have their own account? | **No.** Students are `Profile` objects with local PINs, not Supabase authentication users. `DEPLOY.md:115-117` explicitly documents Dad-only cloud login. |
| Is every student’s progress isolated? | **Logically partitioned, but not securely isolated.** Writes target profile IDs, but all profiles, PINs, and records coexist in one browser state under Dad’s bearer token. |
| Can multiple students safely complete the same grade-level work? | **The data shape can support separate profile IDs sharing content, but the product does not safely support this end to end.** There is no Add Student flow, scoped identity, enrollment model, or bulk assignment. |
| Can a parent manage multiple students without sharing student identities? | The parent can manage the five fixed profiles, but there are no separate student authentication identities. |
| Are permissions enforced by the server/database or hidden in the interface? | Cross-household access is database-enforced by RLS. Parent-versus-student, sibling-versus-sibling, and future staff permissions are client-side UI/PIN gates only. |
| Can parents see only students they are authorized to manage? | One authenticated household owner sees all household profiles. There is no guardian-student relationship or subset permission model. |

### How students are created today

Five profiles are automatically seeded by `src/migration.ts:28-42`. There is no
invitation, parent provisioning, roster, or Add Student workflow.

When a student selects a profile whose PIN is empty, that user chooses its
first four-digit PIN. This means the first person to open an unclaimed profile
can claim it.

The profile stores `id`, `name`, one global `grade`, and plaintext `pin`; see
`src/types.ts:265-281`.

### Identity and lifecycle gaps

- No separate student auth user exists.
- No teen email login exists despite an older specification calling for one.
- No guardian, guardian-student, class, teacher, group, or enrollment entities
  exist.
- A student cannot belong to two authorized households or teachers.
- Grade is one mutable scalar, not a dated enrollment.
- A student cannot formally be above grade in one subject and below grade in
  another.
- Changing grade through imported or edited state would mix previous and
  current learning data.
- Repeating normal practice mutates aggregate totals rather than creating a new
  course or lesson attempt.
- Fixed assessment retakes are preserved separately.
- No graduate, transfer, archive, deactivate, or soft-delete state exists.
- Reset is destructive and has no actor, reason, recovery, or audit record.
- A parent can assign or reset the wrong profile without a general action audit
  trail.
- Normal UI requires another student’s PIN, but same-origin storage is not a
  reliable confidentiality boundary.

### Current database authorization

The Supabase table uses `(household_id, profile_id)` as its key and stores the
entire profile in JSONB. RLS restricts CRUD to
`household_id = auth.uid()`.

That is a useful household boundary, but it cannot answer:

- Is this requester a student, guardian, teacher, or administrator?
- Which specific student may this user access?
- May this guardian manage only some children?
- May this teacher access this class?
- Is this action permitted but read-only?
- Who assigned, changed, or deleted a record?

There are also no constraints confirming that `data.id` matches `profile_id`,
that grades are valid, or that the JSON conforms to the expected schema.

---

## D. Jarvis audit

### Current footprint

| Surface | Current behavior |
|---|---|
| Teen dashboard | Inline `AssistantOrb` near the top of the home screen |
| Elementary dashboard | No general Jarvis launcher |
| Math practice | Separate question-scoped AI Tutor, exposed during practice—not a persistent assistant |
| Lessons | No general lesson side panel or active-step awareness |
| Reading | No Jarvis passage context or “sound it out with Jarvis” flow |
| Assessments | Jarvis is not mounted in the fixed assessment player |
| Parent area | Classic panel exposes settings, transcripts, calls, and flags |
| Teacher/admin | No surface because no staff role exists |
| Backend | Anthropic proxy and ElevenLabs TTS proxy |
| Memory | Current turn plus recent current-session messages; stored prior sessions are not true model memory |
| Voice | Browser recognition input and optional ElevenLabs output |
| Limits | Client-side per-profile counters only |
| Safety | Local phrase matching, prompt instructions, transcript flags, and limited tutor output checks |

Key files:

- `src/components/assistant/AssistantOrb.tsx:97-143`
- `src/assistant/context.ts:48-143`
- `src/assistant/prompt.ts:16-22`
- `src/assistant/engine.ts:76-86`
- `src/components/tutor/TutorChat.tsx`
- `src/tutor/tutorEngine.ts`

### Context Jarvis receives

Jarvis receives:

- Student name and grade.
- Current date.
- Mission labels and completion.
- Grade 12 deadlines.
- Course progress.
- Aggregate geometry/algebra accuracy.
- Assessment title and status, without assessment questions or answers.

It does not receive:

- Current screen, subject, lesson, passage, or question.
- Current navigation/resume target.
- Reading activity.
- Typing activity.
- Attendance or active time.
- Recent struggle history outside the supplied aggregates.
- Curriculum-approved instructional method.
- Sibling profiles.
- Assessment content or start code.

The math Tutor is more contextual because it receives the exact question,
student answer, correct answer, and current chat. That also makes its privacy
and answer-leak controls especially important.

### Educational-behavior verdict

| Question | Finding |
|---|---|
| Teaches instead of giving answers | Requested in prompts, but not structurally enforced |
| Adapts to grade | Grade is supplied; no grade-specific pedagogy or curriculum retrieval |
| Hints before solutions | Prompt expectation, not an enforced response sequence |
| Checks understanding | Not required or validated |
| Remembers current lesson | No; Jarvis lacks lesson-step context |
| Knows approved curriculum methods | No curriculum retrieval or method constraints |
| Avoids course contradictions | Not reliably enforceable with current context |
| Supports voice | Yes |
| Supports reading assistance | Only separate tap-to-pronounce reading tools, not Jarvis |
| Records learning signals | Calls, text, actions, and transcripts; not resolution quality or instructional evidence |
| Alerts an adult after repeated struggle | No general struggle alert |
| Protects graded work | Fixed assessment context is excluded, but integrity relies heavily on prompt behavior |
| Separates student conversations | Stored within profiles, but the underlying shared-device identity boundary is weak |
| Escalates distress | Creates a flag in the transcript; no durable alert/acknowledgement workflow |

A significant safety flaw is that a distress flag does not end or isolate the
conversation. A later benign turn can send the earlier sensitive transcript
back to the model.

### Recommended Jarvis placement

After the gateway and identity work:

- Keep Jarvis prominent on the teen dashboard, with clear starter actions such
  as “Plan my next task,” “Explain a concept,” and “Help me get unstuck.”
- Add a persistent but nonintrusive launcher on non-graded instructional and
  practice screens.
- Open it as a side panel so the student’s lesson remains visible.
- Pass a structured context envelope: student identity, enrollment, subject,
  lesson version, step, practice/graded mode, current question category, and
  safe return target.
- Disable Jarvis entirely during fixed assessments and any graded
  response-entry state.
- Provide post-submission actions such as “Explain this feedback” or “Give me a
  similar practice problem,” never “write my answer.”
- In elementary reading, use deterministic word pronunciation and sound-out
  tools first; add constrained Jarvis help only after reading safety and consent
  work.
- Put Jarvis safety alerts, repeated-help patterns, and usage summaries in
  Parent Hub’s attention section.
- Do not expose routine transcripts to future staff until real roles, least
  privilege, and access auditing exist.

---

## E. UI and navigation review

The application has no URL router. Its “routes” are internal screen values
defined in `src/App.tsx:61-79`.

### Feature and screen inventory

| Screen or feature | Access | State | Audit finding |
|---|---|---|---|
| Root/profile picker | Public/local | Complete but privacy-limited | Shows every student name and grade before authentication |
| Student PIN creation/sign-in | Student | Implemented | Client-only gate, first-opener PIN setup, unlimited retries |
| Parent PIN creation/sign-in | Parent | Implemented | Client-only gate; no recovery |
| Elementary home | Student | Partial | Many activities, but no ordered daily sequence or time-left view |
| Teen home | Student | Partial | Strong feature access but high cognitive load |
| Grade 3/4/6 math trees | Student | Implemented | Procedural practice and mastery displays |
| Placement quest | Student | Partial/integrity issue | Directly launchable, feedback-bearing, overwrites aggregates |
| Daily math practice | Student | Implemented | Good immediate practice loop; historical evidence is aggregate-only |
| Scripted walkthrough | Student | Implemented | Helpful practice support |
| AI Tutor | Student | Implemented/experimental | Question-scoped, not a general lesson assistant |
| HS geometry/algebra/timed work | Teen | Implemented | Stores aggregate unit progress, not session evidence |
| Fixed assessment runner | Student | Partial | Feedback-free, but resume/timing/human-grade history gaps |
| Reading | Grades 3/4/6 | Partial | Browser recognition and manual scoring work; live alignment and robust scoreability do not |
| Azure reading provider | None | Placeholder/unexposed | Adapter returns browser implementation |
| Typing | Student | Implemented in narrow scope | Stores best metrics, not attempt history |
| Mindset | Student | Implemented in limited curriculum | Nine-week sequence and local reflection |
| Music | Current branch only | Experimental/branch-only | Implemented on `mu-music`; mission integration seam is documented as unwired |
| Prize shop | Student | Implemented | Optional motivation feature |
| Parent Hub Today | Parent | Useful but partial | Shows all profiles and current mission progress |
| Calendar | Parent | Implemented | School-year/off-week view; not a true assignment calendar |
| Plans | Parent | Partial/placeholder-prone | Only subjects with curriculum documents have content |
| Status | Parent | Partial | Mastery, estimates, and totals—not grades, active time, reading, or Jarvis attention |
| Classic parent panel | Parent | Implemented but dense | Family configuration and diagnostics; no role/audit model |
| Sync controls | Parent | Implemented but unsafe | UI promises confirmation that automatic reconciliation can bypass |
| Teacher/coach/admin pages | None | Missing | No staff system |
| Account/settings page | None | Missing | Configuration is scattered through Classic |
| AI literacy/personal finance plans | Parent plans | Partial/unexposed to students | Plan content exists without a student lesson player |
| Reporting/analytics | Parent Status | Partial | Aggregate displays only |
| Public curriculum pages | None | Missing | No public-facing routes |

### Does the student dashboard answer the key questions?

| Student question | Current answer |
|---|---|
| What should I do today? | Mission card gives a checklist, but competes with many other cards |
| What should I do first? | Not clearly |
| How much work is left? | Mission item count and in-activity progress only |
| How long should this take? | Generally unknown; a few typing/timed modes show duration |
| Where did I stop? | Fixed assessment partially; most modules do not resume |
| What is complete? | Missions, results, course checkboxes, and mastery displays |
| What needs correction? | No unified correction queue |
| What if I am stuck? | Math walkthrough/Tutor, word TTS, teen Jarvis |
| Where is Jarvis? | Teen dashboard only; elementary students see only the question Tutor |
| How do I know I am finished for the day? | Mission completion exists, but there is no clear end-of-day summary |

### Navigation and age appropriateness

- The elementary dashboard offers too many equally weighted choices for a young
  student.
- Mission items are checklist controls rather than links that launch the
  corresponding activity.
- The teen dashboard is feature-rich but visually and conceptually dense.
- The current student is visible on home, but there is no persistent
  shared-device lock or timeout.
- Parent operations are nested under named profile cards, but there is no
  persistent “You are editing X” target banner.
- There is no student subject → unit → lesson → instruction → practice sequence
  for most static curricula.
- Plans without deployed content show an “Awaiting placement results” style
  placeholder, but placement does not actually create those plans.

### Accessibility findings

Positive:

- Most main actions use semantic buttons and inputs.
- Math answer targets are generally large.
- Responsive classes collapse several grids for smaller widths.

Gaps:

- No skip link.
- Several progress bars are plain `div` elements without progress roles or
  values.
- PIN entry lacks normal keyboard number entry and error announcements.
- Assistant responses are not announced through an accessible live region.
- Some parent inputs use placeholders without persistent labels.
- Reading renders every passage word as a separate button, producing excessive
  keyboard stops and poor screen-reader prose.
- Several child and parent labels use very small text.
- Color is used heavily for mastery and recent-history state.
- The reduced-motion rule disables only a subset of animations.
- No global large-text, dyslexia-friendly spacing/font, focus mode, read-aloud,
  extra-time, simplified view, or adult-assisted settings exist.
- Focus visibility and contrast could not be fully verified without rendered
  inspection.

Relevant code:

- `src/components/reading/ReadingSession.tsx:242-268`
- `src/index.css:54-59`
- `src/components/PinPad.tsx`
- `src/components/hub/StatusView.tsx`

---

## F. Learning-record audit

The app deliberately does not store official grades; Excel remains the
permanent record. That boundary should remain. The app can still store reliable
learning evidence and imported, provenance-tagged grade snapshots.

### Current records

| Domain | Persisted today | Reliability |
|---|---|---|
| Elementary math | Per-skill attempts, correct count, mastery, last-seen date; profile totals | Useful snapshot, not reconstructable history |
| Placement | Twenty-question in-memory history summarized into skill aggregates | Previous attempt and evidence lost |
| HS practice | Per-unit attempts/correct/last-seen and mutable completion booleans | No durable session, answer, or timing history |
| Fixed assessments | Start/finish, answers, skips, item timing, score, separate retakes | Strongest record, but no content version or human-grade ledger |
| Missions | Daily completion booleans | Completion only |
| Attendance | Date and estimated credited hours | Not observed attendance or active time |
| Reading | Date, passage, mode, WCPM, practice words, duration | Trend snapshot; underlying alignment evidence discarded |
| Manual mastery | Subject, value, note, timestamp | Display snapshot without scale or source |
| Curriculum pacing | Subject week pointer and nudge history | Tracks speed, not instructional placement |

Elementary learning state is defined in `src/types.ts:42-48` and updated in
`src/appState.ts:90-132`. Fixed attempts are handled in
`src/assessment/attempts.ts:66-202`.

### Important defects

- Placement runs through the feedback-bearing practice player, revealing
  correctness and answers.
- Placement samples only one or two questions per skill and applies a global
  difficulty staircase across unrelated skills.
- Placement can seed mastery as high as 82 from very little evidence.
- Retaking placement overwrites skill aggregates and can erase later practice
  progress.
- Fixed-assessment resume restores answers but starts at item zero.
- “Save & exit” can omit the current item’s latest timing interval.
- Essay autosave can double-count elapsed time.
- Assessment timing includes hidden/idle time.
- Retake result lookup can continue displaying the oldest completed attempt.
- If every skill is marked “Needs Dad,” daily planning reintroduces the full
  gated skill tree.
- “Mastered” means 75 in core logic, while the parent heat map reserves green
  for 90+.
- No audit history exists for destructive reset or manual adjustments.
- Content changes can alter the interpretation of old attempts because content
  versions are not recorded.

Relevant files:

- `src/engine.ts:20-107`
- `src/components/QuizSession.tsx:109-159`
- `src/components/assessment/TestPlayer.tsx:34-100`
- `src/components/assessment/EssayEditor.tsx:33-48`
- `src/assessment/attempts.ts:45-50`

### Missing distinctions

The system does not consistently distinguish:

- Completed versus mastered.
- Attempted versus submitted.
- Practice versus graded evidence in one record model.
- First attempt versus current display result.
- Auto-score versus human-adjusted score.
- Missing versus not-yet-assigned.
- Incomplete versus excused.
- Current mastery snapshot versus historical mastery.
- Student completion versus adult-approved completion.

### Minimum auditable learning records

Without turning the Academy into the official gradebook, add:

1. Stable student, enrollment, course, content, and content-version identifiers.
2. Assignment instance with assignee, kind, dates, accommodations, and status.
3. Attempt ID and number, start, submit, state, elapsed time, and active time.
4. Item-response record with item version, response, timing, and auto-score.
5. Append-only human review/override with actor, reason, timestamp, rubric, and
   feedback.
6. Correction and retake-approval record.
7. Mastery-evidence events tied to standards, activities, and algorithm version.
8. Derived current mastery snapshot.
9. General actor/target/action audit event.

### Curriculum and adaptive learning

Current content is reusable across profiles, which is the correct direction.
Student progress is separate from procedural skill definitions and static plan
text.

Limitations:

- Profile grade controls most content selection.
- There is no per-subject instructional enrollment.
- Static plans have subject, applicable grades, week, and text, but no stable
  lesson/activity IDs.
- Only a few curriculum documents are wired; absent subjects become
  placeholders.
- There are no prerequisites, standards IDs, content versions, or accommodation
  overlays.
- Placement does not change a learning plan.
- Students cannot formally move at different levels by subject.
- Course units are mutable checkboxes rather than completion evidence.
- Adult sequence overrides are not audited.

Recommended hierarchy:

```text
School year
  → Subject enrollment
    → Course version
      → Unit
        → Lesson
          → Activity
            → Item
              → Standard or competency
```

Keep profile grade as an age/default-navigation attribute; place instructional
level on each subject enrollment.

---

## G. Time-on-task audit

### What is recorded today

- Assessment wall-clock milliseconds per item.
- Essay wall-clock timing, with double-counting risk.
- Reading wall-clock session duration.
- Typing elapsed time used to compute WPM, but not stored as attempt history.
- Tutor/Jarvis call timestamps and counts, not duration.
- Mission completion dates.
- Estimated attendance hours based on completed template blocks.

The repository contains no general tracking for document visibility, browser
focus, idle state, recent interaction, lesson sessions, or leave/return events.

### Questions current data cannot answer reliably

- How long did this student actively work today?
- How much active time was spent by subject?
- How long did a lesson take?
- How much time was idle?
- How long was an assessment actively worked on?
- Did the student leave and return repeatedly?
- How much time was spent getting help?
- Did the student rush, beyond crude item-time outliers?
- How long was Jarvis open?
- Was a reading session actively receiving speech throughout?

Reading duration and assessment wall time provide partial answers, but neither
distinguishes active from idle.

### Recommended tracking model

Use immutable activity sessions and segments.

**Activity session**

- Session ID.
- Student and subject enrollment.
- Activity/content version.
- Activity type: lesson, practice, assessment, reading, help, or other.
- Start and finish.
- Completed, abandoned, or interrupted outcome.
- Resume parent/session ID where applicable.

**Activity segment**

- Active.
- Idle.
- Hidden/unfocused.
- Paused.
- Help/Jarvis.
- Reading-recognizer-active.
- Assessment policy elapsed.

A session should count as active only when the document is visible/focused and
a low-detail recent activity signal exists. Pause active time after roughly
60–120 seconds without interaction. Do not capture raw keystrokes, microphone
data, or foreground-app names.

Store both policy timer and active time for assessments. Keep attendance credit
separate from activity telemetry.

Suggested retention, subject to professional policy review:

- Detailed activity segments: 30–90 days.
- Daily and subject aggregates: current school year plus a documented archive
  period.
- Assessment timing: according to academic evidence policy.
- AI transcripts: short documented retention, with safety events retained only
  as needed for resolution.
- No raw behavioral telemetry beyond what is necessary to calculate the
  aggregates.

---

## H. Reading-assistant plan

### What exists today

- Continuous/interim browser `SpeechRecognition`, fixed to `en-US`.
- Post-session sequence alignment deriving correct, substituted, skipped,
  repeated, and practice-word candidates.
- Estimated WCPM.
- Parent manual scoring/calibration.
- Tap-to-pronounce TTS.
- Heuristic slower syllable-paced repetition.
- Parent trends, benchmark context, and difficult-word frequency.
- No raw audio capture or storage by the application.
- An Azure provider name that currently falls back to browser recognition.

Relevant files:

- `src/reading/recognition.ts:57-171`
- `src/reading/align.ts:22-205`
- `src/reading/fluency.ts:29-234`
- `src/components/reading/ReadingSession.tsx`
- `src/components/reading/ReadingGrownUps.tsx`

### Current reliability and UX problems

- Recognition errors are hidden while the timer continues.
- An empty transcript can become a valid-looking zero-WCPM result.
- Stopping recognition and aligning immediately can lose trailing final words.
- A one-minute check can be stopped early and scored against the shorter
  duration.
- Useful skip/substitution/repeat counts are discarded after scoring.
- “Conquered” may mean only that a word did not appear in the latest practice
  list.
- ASCII-only tokenization mishandles accented text.
- There is no mic/noise calibration.
- There is no provider/locale/confidence/scoreability state in the saved record.
- Live word highlighting does not exist.
- No comprehension check exists.
- No explicit retry or self-correction record exists.
- Passage words as individual buttons create accessibility problems.
- Browser speech recognition may transmit audio to a browser/vendor service
  despite the app storing no recording.

### Recommended student flow

1. Show an assigned passage in semantic paragraphs with large-text and focus
   options.
2. On first use, show guardian-managed consent and vendor disclosure.
3. Run microphone permission and background-noise checks.
4. Start reading with visible Pause and Stop controls.
5. Highlight spoken words only when alignment confidence is high; leave
   uncertain words neutral.
6. Allow a difficult word to be tapped for pronunciation.
7. Offer constrained “sound it out” help with syllables or phonemes.
8. Allow a word or sentence retry without turning recognition uncertainty into
   failure.
9. On stop, await final recognition output for a short bounded interval.
10. Mark failed or low-confidence recognition as unscorable and offer manual
    review.
11. Give encouraging feedback and a short comprehension check.
12. Show parents interpretable counts and trends rather than one opaque
    pronunciation score.

### Useful measurements

- Passage and content version.
- Mode and actual scored duration.
- Words attempted and estimated correct.
- Skipped, substituted, and repeated words.
- Likely self-corrections.
- Long-pause buckets.
- Recurrent difficult vocabulary.
- WCPM with provider, locale, confidence, and scoreability.
- Comprehension results.
- Improvement across comparable passages.
- Periodic parent/teacher calibration.

### Privacy and fairness

Default to derived results without raw recordings.

If a future teacher-review use case genuinely requires recordings, it should
have separate guardian consent, encryption, access logging, explicit delete
controls, and a short retention period such as 7–30 days.

Azure or another pronunciation provider should be optional and must not be the
sole grade or gate. Dialect, accent, speech disability, low confidence, and
noisy environments should produce neutral/manual review—not a punitive score.

Consent language, provider disclosures, and retention policy require
professional policy review.

---

## I. Parent and staff experience

### Parent experience today

Parents can:

- View all five profiles on Today and Status.
- See mission completion and streaks.
- See curriculum week pointers.
- Open static plans.
- View estimated attendance and math mastery.
- Rename profiles and clear student PINs.
- Reset profiles.
- Assign fixed assessments.
- Configure teen courses.
- View reading summaries.
- Review Tutor/Jarvis transcripts and flags in Classic.
- Manage stars, service, attendance, backup, and sync.

Parents cannot readily see:

- One prioritized “needs attention” list.
- Official grades or provenance-tagged gradebook snapshots.
- Missing work or correction requests.
- Active versus idle time.
- Lesson-level history.
- Reading recognition failures or calibration warnings in Today.
- Jarvis safety flags and repeated-help patterns in Parent Hub.
- Upcoming work beyond a few hardcoded deadline domains.
- An audited history of parent actions.
- A safe lifecycle/deactivation workflow.

### Recommended Parent Hub hierarchy

1. **Needs attention**  
   Safety flags, failed sync, overdue/missing work, corrections, reading
   scoreability/calibration problems.

2. **Today’s progress**  
   Ordered plan, completed work, active time, idle time, and
   unfinished/resumable work.

3. **Current grades and mastery**  
   Mastery evidence plus read-only Excel-derived grade snapshots with source
   and import date.

4. **Time spent**  
   Daily/weekly active time by subject, clearly separate from attendance
   credit.

5. **Reading development**  
   WCPM trend, accuracy components, difficult words, comprehension, and manual
   calibration.

6. **Upcoming work**  
   Assignments, deadlines, assessments, and pacing.

7. **Detailed history**  
   Attempts, feedback, overrides, retakes, activity, exports, and audit trail.

A persistent selected-student header should accompany any individual action.
Destructive or assignment actions should repeat the target student’s name and
create an audit event.

### Teacher and administrator experience

There is no staff product today.

Staff cannot:

- Create student accounts or relationships.
- Search or filter students.
- Create groups or classes.
- Bulk-assign common work.
- Customize one student’s assignment.
- Set subject-level placement.
- Apply accommodations.
- Review submissions or reading results in a queue.
- Enter or override grades.
- Approve retakes.
- Add durable feedback.
- Export group reports.
- View active time.
- Correct records through an audit-preserving adjustment.
- Deactivate accounts.
- View as a student.

For multiple same-grade students, shared content could technically be reused
while progress remains keyed by profile ID. However, there is no supported
provisioning, enrollment, group assignment, or secure staff interface.

Any future “view as student” feature should be reason-required, time-limited,
visibly bannered, read-only by default, and fully audited.

---

## J. Security and privacy findings

### Critical

#### 1. Unauthenticated Anthropic proxy

`netlify/functions/anthropic.js:6-38` accepts any POST body, attaches the
production provider key, and lets callers choose the model, token limit, system
prompt, and messages.

It has no authentication, model allowlist, exact schema, request-size limit,
per-household rate limit, or cost control.

#### 2. Overbroad ElevenLabs proxy

`netlify/functions/tts.js:6-50` forwards arbitrary POST suffixes and bodies with
the production key. Depending on provider permissions, this may expose more
than the intended TTS operation.

#### 3. Sync occurs before explicit migration consent

`src/sync/useSync.ts:76-116` automatically pulls, reconciles, and pushes after
session discovery. An empty cloud causes local profiles to be queued for upload
before the user confirms the preview.

#### 4. Household account-switch data crossover

Session and sync metadata use global localStorage keys. Signing out leaves local
profiles and metadata. Signing into another Supabase user can upload the
previous household’s profiles into the new household.

### High

- Pull errors return the same empty result as a genuinely empty cloud,
  potentially causing stale local data to overwrite cloud rows.
- Whole-profile shallow last-write-wins sync can drop concurrent reading
  sessions, attempts, missions, or transcripts.
- Client wall clocks determine conflict winners.
- Refreshed Supabase tokens are not reliably persisted.
- Student and parent PINs are plaintext, four digits, and unthrottled.
- Student PINs are cloud-synced inside profile JSON.
- Dad’s bearer token remains in the same browser after student sign-out.
- No inactivity lock or tab coordination exists.
- Full-state backups are plaintext and include PINs, responses, transcripts,
  and safety flags.
- Import and cloud JSON validation are shallow.
- Jarvis integrity constraints are prompt-only.
- Tutor answer-leak detection catches only limited exact forms.
- A local phrase list is the main deterministic distress detector.
- Distress flags have no urgent notification, acknowledgement, or resolution
  workflow.
- Fixed-test answer keys and start codes are shipped to the browser.
- No account deactivation, deletion workflow, or retention management exists.

### Medium

- No Content Security Policy is configured.
- Transcript pruning occurs opportunistically on later writes, so “60 days” is
  not a guaranteed deletion deadline.
- Dynamic ElevenLabs response audio can remain in client cache without a clear
  TTL.
- Service CSV export does not neutralize spreadsheet-formula prefixes.
- Assessment exports contain names, prompts, responses, timings, and answer
  keys for manual external processing.
- Browser speech processing and provider disclosure are not recorded in consent
  state.
- No device list, remote session revocation, or local-data purge flow exists.

### Positive controls

- RLS separates authenticated households.
- Application-managed raw reading audio is not stored.
- Keys are outside application state and backup exports.
- Assessment content is excluded from Jarvis context.
- Assessment player itself contains no tutoring feedback.
- Jarvis actions are allowlisted and require user confirmation.
- React renders assistant text without raw HTML.
- The service worker excludes API routes.
- Mindset reflections are excluded from normal sync/export.

### Professional policy review required

Without making legal conclusions, professional privacy/policy review is needed
for:

- Guardian consent and authority.
- Voice/speech vendor processing.
- AI provider disclosures.
- Transcript and activity retention.
- Raw recording policy.
- Student data export and deletion.
- Staff access to AI conversations.
- Safety escalation and record retention.
- External assessment review workflows involving student work.

---

## K. Missing features

### Required foundation

- Authenticated AI/TTS gateway.
- Safe, explicit household-bound sync.
- Student, guardian, staff, and administrator identities.
- Guardian-student and staff-student relationships.
- Role-aware RLS and server capabilities.
- Student account/session recovery and revocation.
- Student lifecycle/deactivation.
- Subject enrollments and instructional levels.
- Immutable assignments, attempts, responses, feedback, and audit history.
- Content versioning.
- Durable safety-event and acknowledgement system.
- Active/idle activity model.
- Strict import/cloud schema validation.
- AI kill switch and server-enforced usage limits.

### High-value improvements

- One ordered daily learning plan.
- Automatic resume.
- Correction and feedback queue.
- Parent weekly summary.
- Reading scoreability and accessible passage view.
- Parent attention dashboard.
- Staff roster/search/group assignment.
- Accommodations and adult overrides.
- Retake policies.
- Curriculum prerequisites and mastery unlocking.
- Reliable placement assessment.
- Assignment calendar.
- Attendance adjustment ledger.
- Gradebook snapshot import with provenance.
- Data export by student and record type.
- Student help escalation to a human.
- Accessibility preferences.

### Optional future enhancements

- Healthy achievements beyond current stars/streaks.
- Announcements and messaging.
- Notification preferences.
- Printable student packets beyond parent plan printing.
- Rich offline/low-bandwidth status and sync queue.
- Transcript/report-card generation from external gradebook data.
- Advanced content recommendations.
- Voice recording review, only if a justified and consented educational need
  exists.
- Cross-household or co-op learning groups.
- Audited staff impersonation.
- Automated intervention suggestions.
- Advanced analytics after reliable underlying records exist.

---

## L. Prioritized implementation roadmap

| Order / phase | User problem and proposed solution | Affected surfaces | Tables or APIs | Security implications | Effort / DB |
|---|---|---|---|---|---|
| 1 — Immediate safety | Public provider keys can be abused. Authenticate AI/TTS requests; construct canonical prompts/models server-side; enforce schemas, limits, allowlists, and abuse logging. | Netlify AI functions, AI clients | Authenticated AI gateway, server usage ledger | Removes direct provider-key relay and client bypass | Medium; DB likely |
| 2 — Immediate safety | Sync can upload without consent or into the wrong household. Require explicit device-to-household binding and confirmed first push/pull; quarantine old local data on account change. | Sync controls and hooks | Sync metadata; optional device-binding table | Prevents cross-household child-data disclosure | Medium; DB optional initially |
| 3 — Immediate account | Profiles are not identities. Add users, students, guardians, memberships, roles, lifecycle status, and role-aware RLS. | Onboarding, picker, account administration | New identity and membership tables/APIs | Foundational authorization boundary | Large; DB yes |
| 4 — Immediate safety | PINs and shared tabs allow sibling/session confusion. Add scoped student sessions, retry throttling, timeout/visibility lock, Switch Student, recovery, and revocation. | Picker, PIN, app shell | Session-minting API and revocation data | Protects shared-device sessions | Medium-large; DB likely |
| 5 — Immediate academic integrity | Placement exposes answers and overwrites evidence; assessment timing/resume is inaccurate. Add dedicated feedback-free placement attempts and repair assessment persistence. | Placement, QuizSession, TestPlayer, EssayEditor, results | Placement/attempt records | Protects assessment validity and history | Medium; DB recommended |
| 6 — Student flow | Students lack a clear next action. Make the mission plan the ordered controller, add launch/resume actions, time estimates, corrections, and end-of-day completion. | Elementary/teen home, missions | Assignment/plan API | Target actions must remain student-scoped | Medium; DB partly |
| 7 — Student flow | Younger and assistive-tech users face navigation and reading barriers. Add semantic progress, keyboard PIN entry, live regions, readable text, reduced motion, focus mode, and accessible reading prose. | App shell, PIN, dashboards, reading, Jarvis | Accessibility preference record | Avoid exposing accommodations broadly | Medium; DB optional |
| 8 — Tracking | Aggregate profile state cannot support audit or conflict-safe sync. Add immutable assignment, attempt, response, score-review, mastery-evidence, and content-version records. | Math, HS practice, assessments, curriculum | New normalized learning tables/APIs | Requires student/guardian/staff RLS and audit controls | Large; DB yes |
| 9 — Tracking | Active learning time cannot be measured. Add activity sessions/segments and active/idle/help/reading/assessment aggregates. | App shell and activity players | Activity tables/ingestion API | Minimize telemetry and enforce retention | Large; DB yes |
| 10 — Reporting | Parents and future staff cannot see what needs attention. Build attention, today, mastery, time, reading, upcoming, and history views from reliable records. | Parent Hub, future staff console | Reporting views/API | Relationship-aware filtering required | Large; DB yes |
| 11 — Jarvis | Jarvis lacks lesson context and enforceable safety. Add a server policy layer, durable safety events, kill switches, safe modes, structured context, and response validation. | Assistant, Tutor, Parent Hub | AI policy API, safety event, usage ledger | Critical for minors and integrity | Large; DB yes |
| 12 — Jarvis | Help interrupts the student’s place. Add a contextual side panel and safe return target on non-graded instruction/practice; disable it during graded response entry. | Lesson/practice screens | Context envelope/action API | Route and action authorization needed | Medium; DB no initially |
| 13 — AI reading | Reading can save unscorable results and lacks consent/fairness controls. Harden browser reading first, then optionally add a constrained provider adapter. | Reading student/parent screens | Reading-result version, consent, optional speech API | Voice privacy, dialect fairness, deletion controls | Medium then large; DB yes |
| 14 — Longer term | One grade scalar and no staff model prevent individualized curricula. Add subject enrollments, versioned courses, prerequisites, accommodations, groups, bulk assignment, lifecycle, and audited overrides. | Curriculum, parent/staff administration | Enrollment/course/class/accommodation tables | Least privilege and auditability required | Large; DB yes |

---

## M. Suggested session plan

| Session | Purpose and allowed files/domains | Dependencies | Validation requirements |
|---|---|---|---|
| 1. Secure provider gateway | `netlify/functions/**`, `netlify.toml`, new server contract tests only | None | Unauthenticated rejection, model/path allowlists, schema/size/rate/cost tests |
| 2. Safe household sync | `src/sync/**`, `SyncControls.tsx`, sync tests | None | First-use consent, pull-error behavior, account switch, token refresh, two-device conflicts |
| 3. Identity and authorization foundation | New identity modules, uniquely named Supabase migrations, RLS tests; no student UI | Sessions 1-2 policy decisions | Student/guardian/staff isolation, multi-guardian and revoked-account tests |
| 4. Learning-record foundation | New `src/learning/**`, new learning migration/API, record tests | Session 3 | Idempotent immutable writes, content versions, retake/override/audit scenarios |
| 5. Activity-time foundation | New `src/activity/**`, activity schema/API and simulations | Sessions 3-4 | Focus/visibility/idle/resume tests; privacy and retention checks |
| 6. Assessment and placement integrity | `src/assessment/**`, placement engine/player, assessment components/tests | Session 4 | No answer exposure, exact resume, timing, retake display, immutable placement history |
| 7. Reading correctness and accessibility | `src/reading/**`, `components/reading/**`, reading tests | Sessions 4-5 | Permission denial, recognition error, final-word delay, early stop, Unicode, keyboard/SR/touch |
| 8. Student account UI | `Picker.tsx`, `PinPad.tsx`, new account/session components; no dashboard redesign | Session 3 | Shared-device switching, timeout, recovery, scoped identity and accessibility tests |
| 9. Daily student flow | New student-plan/home components and mission launch adapters | Sessions 4-6 and 8 | Clear first action, resume, correction, completion, elementary/teen responsive QA |
| 10. Parent and staff reporting | `components/hub/**`, future staff components, reporting adapters | Sessions 3-5 | Multi-child isolation, target confirmation, attention sorting, audit visibility |
| 11. Jarvis policy and UX | `src/assistant/**`, `src/tutor/**`, assistant/tutor components and tests; no proxy files | Sessions 1 and 3-5 | Adversarial answer leakage, distress isolation, kill switch, caps, lesson context, graded-mode denial |
| 12. App integration and accessibility | `App.tsx`, shared mount types/state, global CSS; integrate completed modules only | Sessions 6-11 | Full test/build, desktop/mobile/tablet, keyboard/SR, shared-device and role regression suite |
| 13. Optional speech provider | New provider/server adapter plus narrowly scoped reading integration | Session 7 and approved policy | Real-key operator verification, fallback, no raw persistence, fairness/manual-calibration study |

Each session should have one owner, one branch, and a disjoint primary file
domain. Shared mount changes should be deferred to Session 12 wherever
practical.

---

## N. Handoff summary

Academy currently operates as five fixed local profiles inside one household
application. Students do not have authentication accounts. Supabase RLS
isolates households, but all intra-household permissions are local PIN/UI
distinctions. The underlying profile-ID design can keep two same-grade
students’ records separate, but there is no safe provisioning, enrollment,
guardian relationship, or staff workflow to support that case operationally.

The first implementation work should secure the public AI/TTS gateways and
prevent unconfirmed or cross-account sync. Identity/RLS and immutable learning
records should follow before staff tools, detailed reporting, or expanded
Jarvis features.

Jarvis is a useful teen-home prototype with minimized context and
confirm-gated actions, but it lacks current lesson context, trusted output
enforcement, durable safety escalation, and server-side cost controls.

Learning evidence is mainly mutable aggregate state. Fixed assessments preserve
the most detail, but placement, timing, resume, reading scoreability, content
versioning, and concurrent sync require correction. The app records almost no
defensible active time. Reading has a promising no-recording foundation but
needs error handling, consent, accessibility, and fairness work before adding
pronunciation scoring.

### Audit closeout

- Branch inspected: `mu-music`
- Files changed by the audit itself: none
- Shareable report created afterward at the user’s request:
  `ACADEMY-SESSION-1-AUDIT.md`
- Tests/build: not run; read-only audit
- Rendered browser review: not completed because browser attachment was blocked
  by an unrelated invalid temporary package file
- Production database/API verification: not performed
- Commits, pushes, merges, migrations, and deployments: none

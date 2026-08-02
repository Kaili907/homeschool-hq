# Romeo Virtual Academy adapter

## Status and boundary

**Reconciliation status: DEC-018 reconciled — `PASS_WITH_BLOCKER`; not
production approved; final assembly is not authorized.**

This is a local, in-memory Wave 2 integration-lab adapter. It consumes Card 5
DEC-018, accepts versioned credential-free Romeo Virtual Academy assignment
metadata, and returns immutable assignment and projection values. The actual
Tutor Core v0.2 package remains unavailable, so TC-P18 support-reference
resolution is still blocked. This adapter does not log in, request
credentials, control a browser, fetch a URL, scrape a page, persist data,
synchronize a production account, or write to the production calendar.

`ROMEO_RUNTIME_BOUNDARY` exposes those negative capabilities as machine-readable
constants. They are also covered by a focused test that installs a `fetch` spy
and verifies that normalization, update, and projection make no network call.

The implementation is:

- `integration-labs/calendar-parent-runtime/romeo-runtime.ts`
- `tests/calendar-parent-runtime/romeo-runtime.test.ts`

## Runtime field dictionary

| Requirement | Runtime field | Rule |
| --- | --- | --- |
| Versioned intake | `schemaVersion` | Required integer `1`; missing, old, future, and unknown versions fail closed |
| Stable external assignment ID | `externalAssignmentId` | Host-supplied opaque ID, 1–128 characters; preserved byte-for-byte and never renamed by an update |
| Safe launch indirection | `hostLaunchRef` | Required opaque host reference, distinct from the assignment ID and the adapter-only URL; never interpreted as a URI |
| Title | `title` | Trimmed, 1–200 visible characters |
| Course | `course` | Trimmed, 1–120 visible characters |
| Due date | `dueDate` | Real `YYYY-MM-DD` date; no due time is invented |
| Estimated duration | `estimatedDurationMinutes` | Positive finite minutes, normalized to two decimal places |
| Completion state | `completionState` | `not_started`, `in_progress`, or `completed` |
| Parent-entered progress | `parentEnteredProgress` | Whole completed/total units plus an explicit-offset observation time |
| Student-entered progress | `studentEnteredProgress` | Kept separate from the parent report; it is not silently selected as more authoritative |
| Linked Manuel Academy tutoring | `linkedManuelAcademyTutoring` | Explicit `skill` or `lesson`, opaque canonical target ID, visible title, and `supportStudyPlanId: VersionedReference<StudyPlanId>` |
| Resume note | `resumeNote` | Optional trimmed visible text, maximum 500 characters |
| External URL reference | `externalUrlReference` | Optional HTTPS reference without user information or credential-like query/fragment parameters |
| Last checked | `lastCheckedAt` | Real ISO 8601 instant with `Z` or a numeric offset |
| Source mode | `sourceMode` | `manual`, `approved-import`, or `browser-assisted-reference` |

The assignment carries schema version `1` and provider
`romeo_virtual_academy`. `ROMEO_DEC_018_RECONCILIATION` records the consumed
decision, `PASS_WITH_BLOCKER` validation state, TC-P18 blocker, and negative
production/final-assembly authorization.

## Source-mode meaning

`manual` means an authorized user typed or confirmed metadata. `approved-import`
means a separate host boundary supplied an already-approved metadata record.
`browser-assisted-reference` means an authorized user used information already
visible in their browser to create a reference.

The mode records provenance only. None of the modes authorizes this adapter to
open a page, operate the browser, sign in, scrape content, or synchronize an
account. The host remains responsible for authorization and for deciding
whether an external metadata intake is approved.

## Credential rejection

`assertRomeoCredentialFree` scans the whole supplied value before the adapter
reads or projects it. The scan is recursive, cycle-safe, and includes unknown
extension fields, arrays, maps, and sets.

It rejects:

- password, passcode, login, username, credential, token, session-cookie,
  API-key, authorization, and secret-shaped field names;
- PIN, OTP/TOTP, MFA-code/token, verification/recovery code,
  authorization/OAuth code, CSRF token, session ID/token, SAML response, SSO
  ticket, and magic-link aliases in structured fields or explicit free-text
  assignments;
- Basic or Bearer authorization values;
- explicit credential assignments in free text, such as a password or token
  followed by `:` or `=`;
- URL user information, including `https://user:password@host/...`;
- credential-like query or fragment keys, including token, credential,
  signature, access-key, private-key, session, and cookie variants;
- any non-HTTPS `externalUrlReference`.
- URI-shaped assignment IDs, launch references, tutoring target IDs, and
  support-plan IDs;
- arbitrary URIs embedded in public display title, course, or tutoring-link
  title.

Credential input is rejected rather than redacted. The runtime cannot request,
store, return, use, or transmit rejected material.

## Normalization and updates

`normalizeRomeoAssignment(input)` requires `schemaVersion: 1` and produces the
validated adult/adapter assignment. It preserves the stable external ID, keeps
parent and student progress in separate fields, trims display text, validates
dates and timestamps, validates a distinct opaque `hostLaunchRef`, and
normalizes the external HTTPS reference. The HTTPS reference remains here only
to preserve the Card 8 intake requirement.

`updateRomeoAssignment(assignment, update)` applies an explicit metadata
observation. The caller must provide `schemaVersion: 1` and `lastCheckedAt`. An
optional `externalAssignmentId` acts only as a concurrency guard and must match
the existing ID. Observation time cannot move backwards. Replaying the same
observation is idempotent; using the same observation time with different
metadata is rejected as a conflict.

Optional progress, tutoring link, resume note, and URL fields can be cleared by
passing `null`. Updating one actor's progress does not rewrite the other
actor's report. A completion update changes only declared assignment metadata;
it does not infer mastery, behavior, attention, or a diagnosis.

The tutoring link contains no duplicated `available/requested/completed`
status. DEC-018 assigns that lifecycle to the referenced plan/session. Until
Tutor Core is verified, `supportStudyPlanId` is a positive-revision
`VersionedReference<StudyPlanId>`; the user-required `skill | lesson` target
remains a distinct display/linkage coordinate.

## Calendar projection and duplicate prevention

`romeoAssignmentToCalendarBlock` maps the assignment to the existing calendar
runtime:

| Romeo value | Calendar value |
| --- | --- |
| `externalAssignmentId` | `sourceIdentity.externalItemId` |
| constant provider | `sourceIdentity.source = "romeo_virtual_academy"` |
| `title` | block title |
| `course` | block subject |
| estimated duration | required `romeo-assignment-work` segment estimate |
| adapter category | `romeo_virtual_academy_activity` |
| canonical task | `custom / romeo-virtual-academy-activity` |

`projectRomeoAssignmentToCalendar(assignment, schedule, existingBlocks)` is the
idempotent insertion boundary. The wrapper returns the opaque
`hostLaunchRef`; the calendar block carries the opaque external ID. Neither
contains `externalUrlReference` or the resume-note body. Its logical uniqueness
key is:

```text
learnerRef
+ romeo_virtual_academy
+ externalAssignmentId
+ root
```

A retry returns the first accepted root block unchanged. It therefore preserves
the first local `internalBlockId`, parent edits, drag-and-drop scheduling,
partial progress, and continuation state while preventing a duplicate block.
The host must use the calendar runtime's explicit edit or continuation commands
for later local changes.

The calendar contract intentionally does not absorb the due date, URL, entered
progress, tutoring link, or resume note. A due date never becomes `dueAt` and
never creates a midnight scheduled instant; placement requires the separate,
explicit learner-local `schedule` input. The preferred Card 5 seam supplies
`scheduledLocalStart`, explicit-offset `scheduledStart`, and
`intendedLocalDate` together. The calendar runtime verifies that the instant
maps back to the requested wall time and civil date in `householdTimeZone`,
including daylight-saving overlaps. Omitting `scheduledStart` and
`intendedLocalDate` retains the lab-only local-time resolution compatibility
path; production callers must use the explicit seam.

`projectRomeoAssignmentForPublic(assignment)` is the allowlisted parent/public
boundary. It carries the opaque external assignment ID and `hostLaunchRef`,
calendar-only `dueDate`, separate external/parent/student progress domains,
typed tutoring link, and `resumeNoteAvailable`. It deliberately omits
`externalUrlReference` and the resume body. The adapter assignment retains
those two private integration fields, preventing an arbitrary URI or
free-text resume body from leaking into calendar or public JSON.

## Session 4 reconciliation map

The verified Session 4 package supplies the legacy metadata shape. Card 5
DEC-018 requires the following local boundary adaptations; the Session 4
package itself remains untouched:

| Session 4 field or gap | Card 5-reconciled field / action |
| --- | --- |
| no input version | Require `schemaVersion: 1`; reject missing or unsupported versions rather than restamping |
| `externalAssignmentRef` | `externalAssignmentId` (preserve bytes) |
| arbitrary external URL used as launch target | Preserve its validated value only as adapter-private `externalUrlReference`; require a separate opaque `hostLaunchRef` for public/calendar launch |
| `externalAssignmentTitle` | `title` |
| `externalCourse` | `course` |
| `dueDate` | `dueDate` |
| `estimatedDurationMinutes` | `estimatedDurationMinutes` |
| `completionState` | `completionState` |
| `parentEnteredProgress` | `parentEnteredProgress` |
| `studentEnteredProgress` | `studentEnteredProgress` |
| `resumeNote` | `resumeNote` |
| `externalUrlReference` | `externalUrlReference` |
| `linkedManuelAcademyTutoringSupport.supportRef` | `linkedManuelAcademyTutoring.targetId` |
| no Session 4 link kind | Require the host to supply `targetType: "skill" | "lesson"`; never infer it |
| untyped support reference | Require `linkedManuelAcademyTutoring.supportStudyPlanId: VersionedReference<StudyPlanId>` pending TC-P18 |
| no Session 4 check time | Require an explicit `lastCheckedAt`; never use browser/server local time |
| no Session 4 provenance mode | Require an explicit `sourceMode`; never infer approval |

The old support title may populate the new link title only after the host
supplies the explicit target type and versioned study-plan reference. Session 4
support state has no equivalent in this assignment link and must not be
reinterpreted as assignment completion. Parent-entered progress,
student-entered progress, external completion, and Manuel Academy tutoring
lifecycle remain separate domains.

## Example

```ts
const assignment = normalizeRomeoAssignment({
  schemaVersion: 1,
  externalAssignmentId: "rva-algebra-204",
  hostLaunchRef: "host-launch:romeo:rva-algebra-204",
  title: "Solving Two-Step Equations",
  course: "Algebra I",
  dueDate: "2026-07-31",
  estimatedDurationMinutes: 35,
  completionState: "in_progress",
  parentEnteredProgress: {
    completedUnits: 2,
    totalUnits: 6,
    updatedAt: "2026-07-28T08:20:00-04:00",
  },
  studentEnteredProgress: {
    completedUnits: 3,
    totalUnits: 6,
    updatedAt: "2026-07-28T09:10:00-04:00",
  },
  linkedManuelAcademyTutoring: {
    targetType: "lesson",
    targetId: "lesson-two-step-equations",
    title: "Two-step equations tutoring",
    supportStudyPlanId: {
      id: "plan:two-step-equations:v1" as StudyPlanId,
      revision: 3,
    },
  },
  resumeNote: "Resume with question 7.",
  externalUrlReference:
    "https://academy.example.invalid/assignments/rva-algebra-204",
  lastCheckedAt: "2026-07-28T09:15:00-04:00",
  sourceMode: "manual",
});

const publicAssignment =
  projectRomeoAssignmentForPublic(assignment);
publicAssignment.hostLaunchRef; // opaque host reference
"externalUrlReference" in publicAssignment; // false
"resumeNote" in publicAssignment; // false

const first = projectRomeoAssignmentToCalendar(assignment, {
  internalBlockId: "calendar-rva-algebra-204",
  learnerRef: "learner-opaque-1",
  householdTimeZone: "America/New_York",
  scheduledLocalStart: "2026-07-29T10:00",
  scheduledStart: "2026-07-29T14:00:00Z",
  intendedLocalDate: "2026-07-29",
  createdAt: "2026-07-28T13:20:00Z",
});

const repeat = projectRomeoAssignmentToCalendar(
  assignment,
  {
    internalBlockId: "retry-generated-another-id",
    learnerRef: "learner-opaque-1",
    householdTimeZone: "America/New_York",
    scheduledLocalStart: "2026-07-29T10:00",
    scheduledStart: "2026-07-29T14:00:00Z",
    intendedLocalDate: "2026-07-29",
    createdAt: "2026-07-28T13:20:00Z",
  },
  first.blocks,
);

repeat.action; // "idempotent"
repeat.blocks.length; // 1
repeat.block.internalBlockId; // "calendar-rva-algebra-204"
repeat.hostLaunchRef; // "host-launch:romeo:rva-algebra-204"
```

## Validation

From `adaptive-tutor/study-engine/integration-labs/calendar-parent-runtime`:

```powershell
npm test -- ../../tests/calendar-parent-runtime/romeo-runtime.test.ts
npm run typecheck
```

The focused suite reads Card 5's machine decision and validation records and
asserts DEC-018 parity. It covers version gating, metadata normalization,
versioned `StudyPlanId` support links, separate progress domains, resume and
completion updates, stable IDs, real calendar-only due dates, offset
timestamps, all source modes, recursive credential smuggling on both intake
and update, Card 5 explicit-offset/DST-overlap placement, retained
adapter-private HTTPS references, URI-free public/calendar projections,
idempotent calendar mapping, the no-network boundary, and the retained
`PASS_WITH_BLOCKER`/not-production-approved status.

# Manuel Academy AI Safety Center UI

This directory is the isolated parent/student browser interface owned by
Session 3. It does not modify or bypass the host application's identity, tutor,
profile, or parent-PIN infrastructure.

## Launch the prototype

From the repository root:

```powershell
npx vite app/features/ai-safety-center
```

The prototype toolbar switches between the authorized parent and matching
student view. It can also simulate unavailable history to verify that the UI
does not mislabel missing data as an empty record.

The seed projection is synthetic. It contains no real student data, addresses,
hotline information, raw microphone audio, or claims that emergency services
were contacted.

## Integration boundary

Mount `AiSafetyCenter` with:

- an authenticated `viewer` projection;
- exactly one selected `student` scope;
- a minimized `SafetyCenterData` projection for that same student;
- an `onAction` adapter that reauthorizes, validates, persists, and audits every
  request server-side.

```tsx
import { AiSafetyCenter } from "./app/features/ai-safety-center";

<AiSafetyCenter
  viewer={authorizedViewer}
  student={selectedStudent}
  data={scopedSafetyCenterProjection}
  onAction={dispatchAuthorizedSafetyAction}
/>;
```

The UI checks all supplied student references before rendering. A parent must
list the selected student in `authorizedStudentRefs`; a student must have a
matching `studentRef`. Any mixed-student record fails the whole projection
closed and renders no student name or record detail. This is defense in depth,
not a substitute for server authorization.

Policy-sensitive UI enums (`SafetyClassification`, `SafetySeverity`,
`EscalationLevel`, `WithheldReason`, report category, weekday, and retention
day unions) are type aliases to `ai-safety/core/contracts.ts`. The UI view model
adds display labels and parent/student copy but cannot silently invent a new
policy enum.

## Privacy behavior

- Instructional history and safety events are separate collections and screens.
- The interface says plainly that authorized parents can review tutor
  conversations and safety events.
- Reflections entered inside a tutor conversation follow its parent-review and
  safety-exception rules. Separate mindset journal text is outside this
  feature and is not collected or reviewed here.
- Playback is synthesized on demand from tutor text. No contract includes a raw
  audio URL or raw microphone recording.
- Notification controls refer only to an email already held by the host; this
  feature does not collect contact details. Transcript excerpts are a fixed
  `false` safeguard and cannot be enabled from the UI.
- Export and deletion requests are scoped to the selected student. Active human
  reviews may place eligible records on a temporary hold, which the UI explains
  before submission.
- Missing history is an explicit unavailable state, never presented as “no
  conversations.”

## Role behavior

Parent-only surfaces:

- searchable instructional history and separate safety events;
- answer-withheld reasons and escalation details;
- subject, schedule, playback, exploration, and notification permissions;
- instructional, safety, and audit retention settings;
- export and deletion requests;
- human-review queue, false-positive requests, and audit history.

Student surfaces:

- their own instructional history and age-appropriate safety explanations;
- always-available report and tutor-pause controls;
- plain notice about parent review and safety exceptions.

Unsupported roles (`reviewer`, `system`, and `tutor`) fail closed in this
parent/student component. They require a separate reviewer interface.

## Accessibility implementation

- semantic header, nav, main, sections, forms, lists, details, times, and status
  regions;
- named regions and controls with a skip link;
- native keyboard-operable inputs and buttons with visible focus;
- minimum 44px primary touch targets;
- responsive layouts down to narrow phones without fixed-width content;
- reduced-motion and forced-colors handling;
- darkened secondary text token for normal-text contrast on tinted surfaces;
- no color-only severity or status meaning.

## Local validation

```powershell
npx tsc --noEmit -p app/features/ai-safety-center/tsconfig.json
npx vitest run app/features/ai-safety-center/model.test.tsx
npx vite build app/features/ai-safety-center
```

The host integration still needs to adapt the authenticated principal, tutor
session/history records, core safety events, permissions, review queue, and
data-request persistence. Never trust a student reference or action solely
because it came from this browser component.

# AI Safety Center privacy notes

Date: 2026-07-28  
Review basis: data contracts, runtime validators, policy/query/retention code,
parent/student interface, seed fixtures, and adversarial tests

## Privacy position

The Safety Center is designed for learning continuity and safety oversight, not
secret tutor messaging. It states both sides of the boundary:

- an authorized parent can review the selected student's tutor conversation
  history and safety events; and
- messages or reflections written inside a tutor conversation are not promised
  to be private when a safety concern requires authorized adult or human
  review.

The student interface repeats this in age-appropriate language and says the
student is not in trouble for asking for help.

This statement does **not** describe the separate Manuel Academy mindset
journal. The Safety Center does not collect mindset-journal text, and the
inspected shared contracts expose no implemented journal-to-safety-exception
bridge. Production must not imply that journal text is monitored or shared by
this subsystem unless a separately authorized, documented, and tested contract
is created.

## Data inventory and purpose

| Data | Purpose | Minimization |
| --- | --- | --- |
| Session metadata | Link a tutor session to student, subject, time, age band, policy, and channel | Opaque IDs; no email, phone, address, or raw audio |
| Instructional transcript/history | Learning continuity, student self-review, authorized parent review | Separate record class; bounded retention; text or not retained |
| Tutor-help timeline | Explain hints, refusals, and safety pauses | Parent/student display text; no chain of thought |
| Safety event | Classification, severity, escalation, withheld reason | Safe summary plus evidence references; does not duplicate raw input |
| Student report | Let a student report without being forced to narrate | Comment optional and capped at 500 characters |
| Student tutor block | Stop session/subject/all tutor help | Only scope/reason/state and necessary actor metadata |
| Parent notification | Surface a safety event to an authorized parent | In-app core contract; safe summary; no raw transcript |
| Human review | Track review and false-positive decisions | Structured reason codes; no diagnosis field; assignments excluded from export |
| Audit event | Accountability for access/control/review/data operations | Structured action/reason; no transcript body |
| Tutor permissions | Subject, time, duration, capability, and fixed privacy safeguards | Per-student opaque IDs; fixed parent-review and no-raw-audio modes |
| Retention policy | Schedule eligible deletion | Small literal option sets; open-review hold disclosed |
| Export/deletion request | Fulfill a selected student's data request | Scoped request, principal binding, tracked completion/hold result |

## Role and visibility summary

| Role | Intended access |
| --- | --- |
| Student | Own history and safety events; own report/block controls; own scoped export request |
| Parent | Explicitly authorized student's history, safety events, settings, data requests, notifications, and review/audit status |
| Reviewer | Student-scoped safety events and review queue only when separately permitted; no general transcript query |
| Tutor | No Safety Center read permission |
| System | Narrow execution role supplied by the host; no implicit default access |

The browser UI supports parent and student views only. Teacher, reviewer,
system, and tutor role labels are rejected at that UI boundary.

## Cross-student isolation

- History and safety queries authorize the requested student and then filter by
  student before search/date/subject filters.
- The UI rejects the entire projection if any supplied record belongs to a
  different student.
- Export filters each included collection by the requested student.
- Retention/deletion preserve siblings and use composite student-plus-record
  identity where same opaque IDs could collide.
- Unauthorized responses use fixed text and do not reveal whether another
  student's record exists.

Adversarial coverage includes sibling keyword search, mixed stores, same event
ID, same review ID, same deletion request ID, forged actor data, and
cross-student retention/deletion.

## Voice and playback

- `rawMicrophoneRecordingStored` and `rawAudioStored` are fixed `false`.
- Raw microphone retention is fixed at zero days.
- Runtime validation rejects true values and unexpected raw-audio URL fields.
- Spoken input may produce transcript text, subject to the same parent-review
  and safety-exception notices.
- Playback is on-device text-to-speech from retained tutor text. It is not a
  recording playback feature.

No raw microphone blob, URL, device identifier, biometric/voiceprint, or
attention/emotion inference is present in the owned contracts.

## Instructional versus safety records

Instructional history contains the minimum transcript text needed for learning
and authorized review. Safety events contain classification, safe summary,
withheld reason, and opaque evidence references. Audit records contain actions
and structured reason codes. These are separate store arrays, query APIs, UI
sections, filters, and export scopes.

This separation reduces accidental transcript duplication into alerts,
analytics-like audit events, or reviewer workflow records.

## Notifications

The core notification contract is in-app only, includes a safe event summary,
and fixes `includesRawTranscript` to `false`. The UI likewise fixes transcript
excerpts to `false` and presents this as a safeguard that cannot be disabled.
An email toggle refers only to an address already held by the host; this feature
does not collect one. Production integration must keep notifications
summary/reference-only and must not reuse transcript text or collect a new
address inside this feature.

`createParentNotification` accepts the recipient's opaque actor ID but cannot
verify the family relationship because household identity is outside the
Session 3 core. The host must derive that ID from an authorized parent lookup
for the event's student and repeat authorization at delivery; it must not trust
a client-supplied recipient ID.

## Retention and deletion

- Instructional, safety-event, and audit retention periods are independently
  bounded.
- Open human reviews preserve their linked safety event until resolution.
- Active tutor blocks remain so deletion cannot silently remove a student's
  safety control.
- Eligible resolved/dismissed review items are removed with safety-record
  deletion.
- Deletion reports partial completion and the exact open event/block IDs held.
- Instructional-only deletion is not marked partial because of an unrelated
  safety hold.
- A deletion audit remains for accountability; the UI does not promise silent
  or absolute erasure.
- Unknown/invalid timestamps are treated as expired during retention rather
  than retained forever.

The host must define the legal/operational basis for audit retention and the
time at which completed request records themselves are deleted.

## Export privacy

- Student and parent requests must match the authenticated principal embedded
  in `requestedBy`.
- Students receive only their selected student's instructional/safety data.
- Student exports omit audit history, reviewer assignments, human-review
  history, and non-student `liftedBy` metadata so parent/reviewer actor IDs are
  not disclosed.
- Parent exports may include the selected student's audit events for
  accountability. Those audit contracts contain opaque actor IDs. Before
  production, the host should decide whether parent-facing exports need the
  identifier or only the actor role; role-only/pseudonymous presentation is
  more data-minimizing when the identifier adds no parent-visible value.

## Emergency-language privacy

The fixed behavior:

- does not diagnose the student;
- pauses tutor continuation;
- asks the student to get a trusted adult;
- creates parent/human-review workflow data;
- does not provide a hotline number;
- does not claim an emergency service was contacted; and
- does not store the input phrase in the safety event itself.

High-sensitivity matching can flag a schoolwork quotation. The event supports a
student/parent false-positive request and structured reviewer resolution.

## Findings corrected during review

1. String coercion in retention validation was removed.
2. False-positive reopening no longer creates a non-JSON-safe undefined field.
3. Eligible closed review records are removed by safety deletion.
4. Unrelated open reviews no longer make instructional-only deletion partial.
5. Same-ID cross-student upsert, request replacement, notification retention,
   and deletion collisions were corrected.
6. Student export actor-ID leakage through audit/lift metadata was removed.
7. Parent/reviewer block lifting now requires the matching management/review
   permission; the owning student retains self-lift.
8. Missing history remains visibly unavailable rather than falsely empty.

## Unresolved integration requirement

The core has no `householdId` in `SafetyPrincipal` or stored resources. A
globally correct, authenticated host projection is therefore assumed. If two
households can present the same student ID, the in-memory safety core cannot
distinguish them.

`S3-CCR-01` is a production blocker: bind actor, household, student, and
resource at the identity/storage boundary; enforce it with RLS/server
authorization; validate remote profile IDs; and add cross-household negative
tests. A local role string, active profile ID, or family PIN must not be
represented as this production authorization.

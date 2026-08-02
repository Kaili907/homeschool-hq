# Manuel Academy AI Safety Center threat model

Date: 2026-07-28  
Scope: `ai-safety/**`, `app/features/ai-safety-center/**`, and
`tests/ai-safety/**`

## Security and safety objectives

1. A student can see, search, report, block, export, or delete only records
   authorized for that student.
2. A parent can act only for an explicitly authorized student, one student at
   a time.
3. A reviewer receives safety-review access, not general transcript access.
4. Instructional history, safety events, and audit/review records remain
   distinct data sets.
5. A missing store or failed identity check returns a denied or unavailable
   result and never guesses history.
6. Emergency-language handling pauses, gives a trusted-adult explanation, and
   queues authorized human review without diagnosing, inventing a local
   resource, or claiming an external service was contacted.
7. Raw microphone recordings are outside the Safety Center data model.
8. Retention, export, and deletion operate on a selected student without
   changing a sibling's records, including when opaque record IDs collide.

## Assets

- Transcript text retained for learning continuity and authorized parent review
- Conversation/session and subject metadata
- Safety classifications, withheld-answer reasons, escalation state, and
  evidence references
- Student reports and tutor blocks
- Parent permissions, allowed times, subject access, and retention settings
- Parent notifications
- Human-review and false-positive workflow state
- Safety audit records
- Export and deletion requests
- Authenticated actor-to-student authorization projection supplied by the host

No raw microphone recording is an asset of this subsystem because none is
accepted or stored. Mindset-journal text is also not an asset: it is not
collected by the Safety Center, and no shared journal-to-safety bridge was
available to inspect.

## Trust boundaries

| Boundary | Untrusted or partially trusted input | Required control |
| --- | --- | --- |
| Host identity to safety core | Role, actor ID, authorized student IDs, permissions | Host-authenticated projection; core fail-closed authorization |
| Tutor adapter to policy engine | Student/tutor text, direction, age band, access decision | Policy evaluation before model continuation; runtime-validated event |
| Persistence to query layer | Mixed-student or malformed records | Runtime validation, student filter before search, safe unavailable state |
| Browser projection to UI | Stale or contaminated one-student projection | Verified identity assurance and whole-projection student-scope check |
| UI action to host handler | Forged action type or student reference | Role/action allowlist, student match, server reauthorization |
| Review queue | False-positive requests and reviewer decisions | Student-scoped authorization, transition checks, actor derived from principal |
| Export/deletion | Forged request actor, ID collision, active review hold | Principal/request binding, composite student keys, scoped projections, reported holds |
| Speech playback | Browser text-to-speech implementation | Tutor text only; no raw-audio URL or recording field |

## Adversaries and misuse cases

- A sibling using a shared device tries to search another student's transcript.
- A stale or malicious client changes `studentId`, role, actor ID, permission,
  or `requestedBy` fields.
- A mixed backing store contains records for multiple students or duplicate
  opaque IDs.
- A prompt asks the tutor to reveal protected instructions or provide harmful,
  medical, legal, or final-answer content.
- Benign schoolwork language matches a high-sensitivity emergency phrase.
- A forged export request attempts to receive another actor's records or
  parent/reviewer identifiers.
- A deletion or retention job unintentionally removes a sibling record or
  keeps an eligible target record because IDs collide.
- Storage is unavailable and the interface incorrectly reports an empty
  history.
- A UI consumer treats a role label, profile ID, or local PIN as authenticated
  household authority.

## Controls and adversarial coverage

| Threat | Control | Verification |
| --- | --- | --- |
| Unauthenticated or wrong-role access | `authorizeStudentAccess` checks authentication, role, relation, permission | Forged principal and role-negative tests |
| Student forges sibling authorization list | Student access uses the principal's own `studentId`, not `authorizedStudentIds` | Student-forgery test |
| Cross-student search | History is filtered by student before subject/date/text search | Sibling-keyword search test |
| Mixed UI projection | UI checks every projected record's `studentRef` | Model and static rendering tests |
| ID collision | Query, upsert, retention, and deletion use student plus opaque ID where replacement/reference scope matters | Same-ID event/review/request regressions |
| Forged request actor | Export binds `requestedBy` to principal; approval/report actor is derived from principal | Actor-forgery tests |
| Transcript duplication into safety event | Policy event contains safe summary and evidence refs, not input text | Materialization and scoped-export tests |
| Raw recording capture | Fixed `false`/zero literals and closed validators | Recursive fixture/export audit and validator tests |
| Emergency under-response | Clear first-person self-harm, immediate danger, and unsafe-situation phrases pause and escalate | Policy matrix |
| Emergency false positive | Explicit appeal/review flow supports `schoolwork-quotation` and structured reviewer decision | End-to-end false-positive test |
| Invented service claim | Fixed trusted-adult copy and prohibited-claim detector | Generated-copy test |
| Missing history inference | `unavailable` is distinct from confirmed `empty` | Missing-store regression and UI state test |
| Incomplete deletion | Open review/active block holds are reported; resolved reviews are eligible; sibling records remain | Deletion/retention regressions |
| Color-only or unnamed UI | Visible labels, text severity, focus styles, linked region headings | Static semantic and CSS tests |

## Findings resolved during review

- **High:** same opaque review/request IDs could replace a sibling record.
  Replacement now uses the composite student and record ID.
- **High:** a sibling event with the same event ID could cause a target
  notification/review to survive retention or deletion. Kept-event sets are now
  target-student scoped.
- **Moderate:** student exports could expose audit actor IDs and a
  parent/reviewer `liftedBy.actorId`. Student exports now omit audit events and
  remove non-student lift metadata.
- **Moderate:** an authorized parent or reviewer could lift a student's tutor
  block without the relevant capability. Parent lift now requires
  `permissions:manage`, reviewer lift requires `reviews:resolve`, and the
  owning student retains self-lift.
- **Moderate:** resolved false-positive review reopening created an own
  `resolvedAt: undefined` property. Reopening now omits the property and remains
  JSON-safe.
- **Moderate:** resolved/dismissed review items were not removed by eligible
  safety-record deletion. They are now removed while queued/in-review items are
  held.
- **Moderate:** an instructional-only deletion could be marked partial because
  of an unrelated open safety review. Holds now affect completion only when
  safety deletion is requested.
- **Moderate:** numeric retention literals were accepted as strings. Runtime
  validation now requires numeric integer literals.
- **Moderate accessibility:** multiple named regions referenced missing heading
  IDs, and muted text missed 4.5:1 on tinted surfaces. IDs were connected and
  the muted token was darkened.

## Residual production blocker: tenant/household binding

`SafetyPrincipal` and stored records have no `householdId`. The temporary core
therefore cannot distinguish two households that present the same
`studentId`; it trusts the host to supply globally correct, authenticated,
student-scoped IDs and an already verified `authorizedStudentIds` projection.
This is not sufficient as a standalone production tenant boundary.

Production integration must implement `S3-CCR-01` in
`ai-safety/core-change-requests.md`: authenticated household identity, stable
household-plus-student resource keys, relationship verification, storage/RLS
enforcement, and cross-household negative tests. Until then, the browser
prototype and in-memory core are integration artifacts, not proof that the
current PIN/profile state provides household authentication.

## Other residual risks

- The deterministic language rules are a conservative local layer, not a
  complete natural-language safety classifier. Obfuscation, other languages,
  and context-dependent statements require the future Tutor Core/model-output
  safety bridge and monitored human-review process.
- The host must validate all persisted records before storing or projecting
  them; TypeScript types alone are not a wire boundary.
- `createParentNotification` receives an opaque recipient ID after the host's
  family lookup. The host/delivery adapter must authorize that recipient for
  the event's student and must never accept a client-supplied recipient ID.
- UI action gates are defense in depth. The server must repeat authorization
  and optimistic-revision checks.
- Human-review staffing, notification delivery, abuse monitoring, and
  operational response-time commitments are outside this package and must not
  be implied by the UI.
- Browser text-to-speech behavior varies by platform. Text remains the
  authoritative accessible fallback.

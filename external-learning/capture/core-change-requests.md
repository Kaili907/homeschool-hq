# Core change requests

No shared infrastructure was changed in Session 4. Read-only inspection found
Manuel Academy profile state and a separate provisional study-engine calendar,
but no production external-assignment, calendar-insertion, student-identity, or
attachment-storage contract that this owned package can safely implement
against. The following host seams are required before production integration.

## 1. Production calendar insertion command

Provide an authorized command and acknowledgement contract:

```ts
interface CreateExternalCalendarEntryCommand {
  requestId: string;
  learnerRef: string;
  sourceProviderId: string;
  originalAssignmentReference: string;
  dedupeKey: string;
  scheduledStart: string; // ISO 8601 with Z or numeric offset
  timeZone: string; // IANA
  title: string;
  estimatedDurationMinutes?: number;
}

type CreateExternalCalendarEntryResult =
  | { status: "created" | "already_exists"; calendarEntryRef: string }
  | { status: "rejected"; code: string; message: string };
```

`buildExternalScheduleHandoff` creates an integration request with
`pending_host_calendar_write` status only.
`linkExternalAssignmentToSchedule` must be called only after this future host
command returns a real opaque `calendarEntryRef`. The capture package does not
claim a calendar write.

The command must preserve source provider plus original assignment reference as
the logical identity and enforce the dedupe key transactionally.

## 2. Profile-to-student identity and authorization

Provide a host-owned mapping from the current `Profile` identity to an opaque
student/learner reference, plus authorization checks for:

- the parent/student who may create and confirm an intake;
- the parent who may schedule it;
- the student/parent who may submit evidence;
- the parent who may approve or return evidence;
- a host service/provider adapter that may propose provider updates.

The local actor contract is defense in depth, not a replacement for server-side
household authorization.

## 3. Household IANA time zone

Provide an explicit household or learner IANA time-zone setting. Do not infer it
from a server or silently freeze the browser's current zone.

- Date-only provider due values must stay date-only.
- Offset-bearing instants remain exact instants.
- A provider local date/time retains its IANA zone until the host resolves it.
- Resolution must reject daylight-saving gaps.
- Resolution must ask for an earlier/later-offset choice during daylight-saving
  overlaps; it must not guess.

## 4. Course catalog and section mapping

Provide stable Manuel Academy `courseRef` and optional `sectionRef` values, with
a parent-authorized query/confirmation boundary. Display-label matching may
offer candidates but must never create a mapping without parent confirmation.

## 5. Attachment and evidence storage policy

Provide an authorized file service that returns opaque attachment references
and verified metadata. It needs:

- size/type limits and malware quarantine;
- a SHA-256 digest calculated by the trusted upload boundary;
- missing/unreadable/unsupported states;
- access control scoped to household and learner;
- retention/deletion policy for child education records;
- separate policy for source documents, short extraction evidence excerpts,
  and completion evidence;
- OCR/document-extraction processing disclosure and vendor/data-region review;
- a way to re-check availability when evidence is reviewed.

Raw file bytes, OCR services, and durable attachment storage are deliberately
outside this package.

## 6. Parent evidence-review command

Provide a server-authorized, revision-checked parent command for approving or
returning evidence. It must reject student/provider actors, stale evidence
revisions, and cross-household references. A returned decision needs a
parent-visible note. Completion must remain blocked until configured evidence
and approval requirements are satisfied.

## 7. Provider registry and sync authorization

Provide a registry of provider descriptors and separately approved adapters.
The registry must distinguish:

- manual-only providers;
- an adapter that exists but is not configured;
- configured host-managed authorization;
- expired/revoked authorization.

Authorization must use a host-managed opaque authorization reference. Never
request, accept, log, or store a student's school password, session cookie,
token, or credential-bearing URL. An adapter must not bypass provider access
controls. Romeo Virtual Academy remains `manual_only` until an independently
authorized integration is implemented and reviewed.

## 8. Persistence and schema versioning

Provide storage/versioning for:

- confirmed external assignment records;
- course/section mappings;
- schedule acknowledgements;
- provider-update proposals and conflict decisions;
- evidence submissions and revision-checked parent reviews.

Persistence must validate `external-assignment-capture.v1`, retain the provider
identity/original reference, use optimistic concurrency, and record immutable
audit events. A future schema migration must not weaken field-confirmation,
credential-rejection, evidence, or approval invariants.

# Integration guide

## Boundary

The capture engine is pure TypeScript. It does not own authentication, file
bytes, OCR infrastructure, persistence, a production student contract, or a
production calendar API. The host supplies opaque references, validates
household authorization, and persists only values accepted by the runtime
validators.

## 1. Choose a provider adapter

For Romeo, use `romeoVirtualAcademyProvisionalAdapter`. It supports manual and
document proposals only and does not expose synchronization:

```ts
import {
  ROMEO_VIRTUAL_ACADEMY_PROVIDER,
  romeoVirtualAcademyProvisionalAdapter,
} from "../index.js";

romeoVirtualAcademyProvisionalAdapter.descriptor
  .synchronizationAvailable; // false
```

For another school, create a provider-neutral manual adapter:

```ts
import { createManualProviderAdapter } from "../index.js";

const adapter = createManualProviderAdapter({
  providerId: "district_portal_manual",
  displayName: "District portal",
  connectionMode: "manual_only",
  synchronizationAvailable: false,
  provisional: false,
  privacyNotice: "Family-supplied assignment metadata only.",
});
```

An authorized future adapter may implement `synchronize` only when its
descriptor says `authorized_adapter` and the host supplies an opaque
authorization reference. That reference is not a password or token.

## 2. Create proposals

Manual values and extracted document text use the same field proposal
contract. A document extractor passes `DocumentContent`; the capture engine
does not upload or OCR file bytes itself.

Every field record contains:

- `status`: proposed, missing, or unreadable;
- `confidence`: 0 through 1;
- `evidence`: method, source label, attachment reference, optional excerpt and
  region;
- `warnings`.

The result always sets `requiresFieldByFieldConfirmation: true`. Missing files,
unreadable images, unsupported media, extractor outages, and empty results
return `manual_entry_required` with an actionable fallback.

## 3. Confirm every field

Call `confirmExtractionProposal` with one decision for each field in
`EXTERNAL_ASSIGNMENT_FIELDS`: `accept`, `edit`, or `clear`. Title, course, and
the provider's original assignment reference cannot be cleared.

Accepting a missing/unreadable field is rejected. The user must edit it or
explicitly clear an optional field. Confidence never substitutes for review.

## 4. Map the course and section

`resolveCourseSectionMapping` prefers stable provider course/section
references. It can fall back to already confirmed normalized labels, but it
never creates a mapping. A parent creates one with
`confirmCourseSectionMapping`, then `applyCourseSectionMapping` attaches it to
the assignment.

## 5. Request calendar insertion

`buildExternalScheduleHandoff` returns an integration request with
`status: "pending_host_calendar_write"`. It does not claim or perform a
calendar write. The host must:

1. authorize the parent and learner;
2. validate the handoff;
3. insert or find the calendar entry transactionally by `dedupeKey`;
4. return an opaque `calendarEntryRef`;
5. call `linkExternalAssignmentToSchedule` with that real reference.

Date-only due values remain date-only. Local date/time values retain their IANA
zone. If a future host converts them to instants, daylight-saving gaps must be
rejected and overlap offsets must be explicitly disambiguated.

## 6. Evidence and parent review

`submitCompletionEvidence` checks:

- actor-to-learner permission;
- available `completion_evidence` attachment metadata;
- configured count and media types;
- a required note;
- unique evidence identity.

If parent approval is configured, the record enters `evidence_pending`.
`reviewCompletionEvidence` accepts only a parent actor and returns `approved` or
`evidence_returned`. A return requires a note.

`markExternalAssignmentComplete` checks the schedule and evidence/approval
gates again. A provider-reported completion status alone never completes the
Manuel Academy record.

## 7. Duplicate and provider-update handling

`externalAssignmentDedupeKey` uses provider identity plus the original
assignment reference. `detectExternalAssignmentDuplicate` reports:

- exact stable-identity match;
- possible same-title/course/due match that needs a parent decision;
- no match.

`reconcileProviderAssignmentUpdate` rejects stale observations, provider/source
identity changes, and credential material. It returns no change, a proposal, or
a conflict. `confirmProviderAssignmentUpdate` requires a decision for every
changed field and never permits changing the original provider reference.

## Runtime validation

Use the constructors/transitions for new values and validate data crossing a
storage/network boundary:

```ts
import {
  validateExtractionResult,
  validateExternalAssignmentRecord,
  validateExternalCaptureSchema,
} from "../index.js";
```

`schemas.ts` exports draft 2020-12 JSON Schema objects for external validators
and a dependency-free runtime registry for this package.

## Shared work still required

See `../core-change-requests.md`. In particular, do not connect this package
directly to provisional calendar types elsewhere in the repository and do not
invent profile/student identity mappings.

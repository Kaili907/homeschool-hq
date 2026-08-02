# Privacy and data-handling notes

## Never collect school credentials

Manuel Academy must never request or store a student's external-school
password, passcode, username/login, session cookie, API key, access/refresh
token, or other secret. The typed contracts contain no such fields.

Runtime validation rejects:

- credential-shaped object keys at any nesting depth;
- secret-bearing text patterns such as `School password is ...`;
- HTTPS URLs with embedded user information;
- credential-like URL query parameters.

For OCR/document text, credential-like lines are discarded before any title,
field value, or evidence excerpt is created. The result records only the number
of discarded lines, never the secret.

## Data minimization

Persist only what the workflow needs:

- opaque learner, actor, assignment, provider, course, calendar, attachment,
  and evidence references;
- confirmed assignment details and due semantics;
- short field-level evidence excerpts where needed for review;
- attachment metadata, not file bytes;
- confirmation, mapping, evidence-review, conflict, and sync state.

Raw OCR text should be ephemeral and discarded after proposals/source excerpts
are generated unless a separately reviewed retention policy explicitly
requires it. Logs should contain identifiers/error codes, not extracted text or
file contents.

## Attachments

The host file service, not this package, must enforce:

- household/learner-scoped access;
- upload size/type checks and malware quarantine;
- trusted digest calculation;
- encryption in transit and at rest;
- retention/deletion rules for education records;
- missing/unreadable state changes;
- signed access references that are never stored as credential-bearing URLs.

Attachment `sha256` is metadata supplied by that trusted boundary; the capture
engine does not claim to hash bytes it never receives.

## Confirmation and accuracy

Extraction confidence is a review aid, not an accuracy guarantee. Extracted
text, instructions, rubrics, dates, times, course labels, and assignment
references remain proposals until a parent/student reviews every field.
Evidence excerpts must be visible beside the proposal in the host UI.

Date-only due values stay date-only. A local due time keeps its IANA time zone;
the host must not guess an instant during a daylight-saving gap or overlap.

## Authorization and access controls

The local permission matrix provides defense in depth. The host remains
responsible for authenticated household authorization and must prevent:

- cross-household/cross-learner reads or writes;
- student evidence approval;
- student/provider completion overrides;
- stale parent review commands;
- unapproved provider configuration or updates.

Nothing in this package authorizes scraping, automated login, or bypassing an
external school's controls.

## Provider connections

Provider identity is preserved separately from the original assignment
reference. A provider descriptor may advertise synchronization only when an
authorized adapter actually exists. Authorization should be host-managed and
represented here only by an opaque reference.

Romeo Virtual Academy is explicitly manual/provisional. Do not represent it as
connected or synchronized without an independently authorized integration.

## Retention and deletion questions for the host

Before production launch, define:

- source-document and completion-evidence retention periods;
- deletion behavior when a learner/profile is removed;
- audit retention and parent export access;
- OCR/vendor subprocessors and data regions;
- backup expiration;
- how conflicts, returned evidence, and orphaned attachments are purged.

These unresolved policies are recorded in `../core-change-requests.md`.

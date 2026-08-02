# Study integrations core-change requests

## Status

These are documentation-only requests for a later, coordinated integration
review. No request is approved or implemented by this session. No file under
`adaptive-tutor/core/**`, `subjects/**`, `study-engine/contracts/**`,
`schemas/**`, `engine/**`, or `ui/**` was changed.

The current packages remain provisional, in-memory adapters.

## CR-INT-001 — Versioned contract promotion

**Requested owner:** study-engine contract/schema maintainers

**Request:** Review the provisional calendar, review, external-assignment, and
parent-dashboard shapes and, if accepted, promote stable versions through the
normal contract governance process.

**Why:** This session deliberately kept its contracts inside owned integration
and parent directories. Production consumers need one reviewed versioning and
migration policy rather than importing provisional types indefinitely.

**Acceptance conditions:**

- Preserve opaque references and explicit schema versions
- Preserve exhaustive enum validation and backward-compatibility rules
- Exclude credentials, direct identity, raw learner responses, surveillance
  data, diagnostic fields, and hidden scores
- Document producer/consumer ownership and deprecation policy

## CR-INT-002 — Authorized calendar command and persistence seam

**Requested owner:** existing calendar owner

**Request:** Provide an authorized adapter that can read approved plan blocks
and apply calendar commands produced by the pure calendar state transitions.

**Why:** The mock demonstrates segment completion, pause/resume, continuation,
rescheduling, parent edits, interruptions, and completion bars but intentionally
does not write production calendar state.

**Acceptance conditions:**

- Existing authorization remains authoritative
- Logical uniqueness uses learner plus stable `dedupeKey`
- Repeat imports cannot overwrite a newer local revision
- Writes are idempotent and concurrency behavior is documented
- Offset-bearing instants and IANA zones are preserved
- Parent-visible audit events remain visible
- No identity, database, or calendar schema change occurs without owner review

## CR-INT-003 — Tutor review directive projection

**Requested owner:** tutor/study-engine core owner

**Request:** Expose a read-only, versioned directive containing opaque
`reviewRef`, opaque `skillRef`, kind, priority, created/scheduled calendar
dates, estimate, state, and a short supportive title.

**Why:** The review queue must consume an approved instructional directive; it
must not inspect raw responses or infer remediation from integration data.

**Acceptance conditions:**

- Core remains authoritative for review, reteaching, prerequisite remediation,
  and item priority
- No raw answer, transcript, learner trait score, or diagnosis crosses the seam
- Local planning date and explicit parent daily limits are supplied separately
- Capacity-held work and its evidence are not silently discarded

## CR-INT-004 — Parent dashboard projection and command host

**Requested owner:** existing parent-dashboard owner

**Request:** Review a production adapter that maps approved read models to the
provisional Today, Learning, and Study Habits projection and maps explicit
parent controls to existing authorized commands.

**Why:** The working prototype is deliberately separate from production Parent
Hub code.

**Acceptance conditions:**

- Existing household authorization governs reads and writes
- Every displayed inference includes parent-visible evidence
- Recommendations remain accept/reject decisions and never become silent
  settings
- Explicit parent settings remain authoritative after recommendation decisions
- Timers can be hidden in every relevant projection
- Parent-private notes are excluded from student-facing content and analytics
- Mobile, keyboard, screen-reader, and reduced-motion validation is retained

## CR-INT-005 — Credential-free external assignment intake

**Requested owner:** external-integration/security owner

**Request:** Define an approved metadata intake for Romeo Virtual Academy
assignments without requesting or handling user login credentials.

**Why:** The provisional adapter normalizes supplied metadata only and does not
sign in, fetch, scrape, or persist.

**Acceptance conditions:**

- No password, passcode, token, cookie, API key, or external login is requested
- Intake origin and authorization are documented
- HTTPS host/path allowlisting and query-parameter policy are defined
- Parent and student progress remain distinguishable and visible
- Duplicate assignments use a stable opaque external reference
- Retention and deletion rules are approved before storage

## CR-INT-006 — Learner calendar-context service

**Requested owner:** calendar/profile platform owner

**Request:** Supply the authorized IANA zone and local planning date needed for
daily/weekly grouping and review timing.

**Why:** The provisional code intentionally refuses to guess a time zone from a
browser, server, or offset-free timestamp.

**Acceptance conditions:**

- The source of truth and update behavior are documented
- DST overlap/gap and travel scenarios have tests
- Calendar dates remain calendar dates; instants retain explicit offsets
- A zone change cannot silently move historical completion records

## CR-INT-007 — Data governance and retention policy

**Requested owner:** privacy/security/data-governance owners

**Request:** Approve retention, access, correction, deletion, and audit policy
before any provisional value is persisted.

**Acceptance conditions:**

- Field-level purpose and retention are documented
- Parent-only notes have explicit access and deletion controls
- Free-form text receives content and sensitive-data handling policy
- Direct identity remains outside this minimized boundary
- No surveillance or hidden scoring field can be added without privacy review

## CR-INT-008 — Integration telemetry policy

**Requested owner:** privacy and observability owners

**Request:** If operational telemetry is needed later, define a minimized,
aggregate policy rather than logging full integration payloads.

**Acceptance conditions:**

- No note text, resume text, evidence description, URL, raw learner response, or
  direct identifier is logged
- Metrics cannot become a hidden child behavior score
- Retention and access are explicit
- Parent-visible product evidence remains independent of operational telemetry

## Review order

Recommended later review sequence:

1. Contract/version governance
2. Privacy, security, and retention approval
3. Calendar context and authorized read projections
4. Authorized command/persistence adapters
5. Parent UI integration
6. External assignment intake
7. Production verification and deployment approval

This order is a request for the dispatch/integration wave, not authorization to
start that work in this session.

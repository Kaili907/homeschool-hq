# Academy student identity foundation — Phase 0

## Status and boundary

Phase 0 is an additive, unused database foundation. It does not change the
current profile picker, local student PIN, parent PIN/login, application state,
whole-profile sync, learning records, reading, assessments, Jarvis, Tutor, or
any student-facing behavior. It does not import or upload a local profile.

Implemented:

- Durable students, active/archived households, guardian memberships,
  per-student guardian access, per-subject enrollments, lifecycle state, and
  append-only identity audit events.
- Relationship-aware, default-deny RLS that requires an active household,
  active guardian membership, active student access, and the required
  per-student permission.
- Private, structurally validated Argon2id/scrypt verifier storage.
- Private SHA-256 student-session token-digest storage with an allowlisted
  capability vocabulary and issuance/revocation lineage.
- Monotonically increasing student `session_version` invalidation.
- Status-based history preservation and hard-delete prevention.
- Local-only real-role SQL probes. They must be run twice around a migration
  rerun in an isolated Supabase-compatible database.

Deferred:

- Guardian/student administration UI and trusted provisioning endpoints.
- PIN verification, live retry throttling, and recovery UX.
- Student-session minting, refresh, device management, and logout.
- Importing current `Profile` objects or normalizing learning records.
- True cross-household student transfer.
- Teacher, staff, class, assignment, attempt, and activity-time authorization.

## Identity, guardian, and household model

`academy_students.id` is the durable student identity. It is independent of the
student's display name, grade, PIN, local browser profile, and guardian's
Supabase Auth user ID. A student does not require email or an `auth.users` row.

Normal Supabase Auth remains the guardian identity provider. The database stores
only foreign keys to `auth.users`; it does not duplicate passwords, emails, or
Auth tokens.

The authorization chain is:

```text
academy_households (must be active)
  -> academy_household_memberships (guardian, must be active)
    -> academy_guardian_student_access (must be active, per-student permission)
      -> academy_students
```

A guardian can have memberships in multiple households, multiple guardians can
belong to one household, and each guardian can receive a different permission
for each student:

- `viewer`
- `learning_manager`
- `identity_manager`

The levels are deliberately read-only in Phase 0. `viewer` can read the student
and subject enrollments. `learning_manager` and `identity_manager` can also read
that student's audit events. Future trusted endpoints must separately enforce
which mutations each level permits. No staff policy exists.

The lifecycle controls are intentionally distinct:

- **Household archival** blocks every normal guardian read and makes all student
  session grants non-current. It preserves every row and increments each
  household student's `session_version`. Restoring the household does not
  restore the invalidated session versions.
- **Membership revocation** removes one guardian's access to every student in
  that household. Student records and other guardians are unchanged.
- **Student-access revocation** removes one guardian/student relationship
  without changing the household membership.
- **Student deactivation or archival** preserves authorized guardian access to
  historical records but invalidates student sessions.
- **Student transfer** means external exit from this Phase-0 tenant. It revokes
  student-specific guardian relationships, invalidates sessions, records an
  audit event, and preserves the original household and all historical rows.

## Transfer rule

`academy_students.household_id` is immutable.

Phase-0 `transferred` means:

> The student is no longer active in the current Academy household because
> responsibility moved outside this Phase-0 tenant model.

A transfer never rewrites `household_id`, creates cross-household access, or
copies history. A future true cross-household transfer requires a separately
reviewed workflow with authorization and consent from both sides, durable
export/import lineage, validation, and rollback.

## Subject placement and reusable curriculum

`academy_subject_enrollments` separates instructional placement from the
student's optional global grade. Each enrollment records school year, subject,
instructional level, reusable course/version identifiers, lifecycle status,
start/end dates, placement source, and an optional reviewed adult override.

The current-enrollment idempotency key is:

```text
student_id
+ school_year_key
+ subject_key
+ coalesce(course_id, '')
+ coalesce(curriculum_version, '')
```

At most one row with that key may be `planned`, `active`, or `paused`.
`completed`, `withdrawn`, and `archived` rows do not block a legitimate
historical retake or reenrollment. Different students can reference the same
course/version, and one student can have different subjects or course versions.
Curriculum content is never duplicated into enrollment rows.

Assignments, attempts, scores, mastery, reading records, time records, Jarvis
conversations, and activity history remain future per-student records.

## Credential storage and lifecycle

Credential rows live only in
`academy_private.student_access_credentials`. Normal clients have no schema
usage, table privileges, policy, or function capable of returning verifiers.
Hard deletion is blocked.

Two format-version-1 encodings are accepted structurally:

```text
$argon2id$v=19$m=<memory>,t=<iterations>,p=<parallelism>$<base64-salt>$<base64-hash>
$scrypt$v=1$ln=<log2-N>,r=<block-size>,p=<parallelism>$<base64-salt>$<base64-hash>
```

The checks require the exact algorithm/version prefix, numeric cost fields,
nonempty encoded salt and hash, no whitespace or suffix, and a bounded total
length. The scrypt representation is the Academy scrypt-v1 envelope: a future
server must use a reviewed scrypt implementation and serialize its salt, cost
parameters, and derived key exactly in this representation.

Database checks validate structure only. They cannot prove that a value was
actually produced by Argon2id or scrypt. Only a trusted server may create or
verify a credential, using a unique salt, reviewed cost policy, constant-time
comparison, throttling, and an approved password-hashing implementation.
Student PINs are never verified in SQL. A four-digit PIN remains low entropy
and requires online rate limits; its encoded verifier must never be exported.

Credential history includes:

- monotonic per-student/kind credential version;
- same-student/same-kind replacement lineage;
- creation actor, reason, time, activation time, and correlation ID;
- failed-attempt count and last-failure time;
- lock start and end;
- reset-required time and reason;
- replacement actor, time, and reason;
- revocation actor, time, and reason.

Only one `active`, `locked`, or `reset_required` credential can exist for a
student and kind. Replaced/revoked rows remain as security history. Lock,
reset, replacement, and revocation states have mutually consistent metadata.
Replacement must reference an older, already-replaced credential for the same
student and kind.

Moving a credential to `locked`, `reset_required`, `replaced`, or `revoked`
increments the student's `session_version`. This prevents an unlock or reset
from reviving an older student session.

## Future student-session storage

`academy_private.student_session_grants` stores no bearer token. The future
trusted server generates a high-entropy raw token, computes SHA-256, and stores
exactly 64 lowercase hexadecimal digest characters. A raw token, uppercase
digest, non-hex text, or any other length is rejected.

Capability schema version 1 allows only:

- `student:profile:read`
- `student:assignments:read`
- `student:attempts:create`
- `student:progress:read`

The set must be nonempty and contain no duplicates. Wildcards, arbitrary
strings, guardian permissions, identity-management permissions, household
management, staff, credential management, and administrative capabilities are
not representable. A future capability change requires a separately reviewed
schema version and migration.

Each grant records:

- student and household;
- unique SHA-256 token digest;
- capability schema/version and capabilities;
- credential ID and credential version;
- student `session_version`;
- issuance flow, actor, reason, and time;
- optional guardian membership/access used for guardian activation;
- audit correlation ID;
- optional SHA-256 device digest;
- expiry;
- revocation actor, reason, and time.

`academy_private.is_student_session_grant_current(id)` is the database-side
validation contract for the future trusted server. It returns true only when:

- the household is active;
- the student is active;
- the grant is unrevoked and unexpired;
- the grant version equals the student's current `session_version`;
- the referenced credential/version is still active;
- a guardian-activation issuance still has an active membership and active
  identity-manager relationship.

The raw bearer token is resolved to its digest by the trusted server before
this contract is evaluated. Neither this helper nor the grant table is exposed
to normal clients. `academy_private` must remain absent from Supabase's exposed
API schemas even though privileges and forced RLS provide additional defense.

The guardian's Supabase access/refresh token remains in the guardian context
and is never copied into or exchanged for a student session. A student session
can never acquire guardian capabilities.

## Session invalidation

The database increments `academy_students.session_version` for:

- household archival;
- student transfer, archival, or deactivation;
- credential lock, reset-required, replacement, or revocation;
- explicit emergency reset through
  `academy_private.reset_student_sessions(...)`.

Guardian-activation grants are also rejected immediately when their original
membership or identity-manager relationship is revoked. Harmless display-name,
grade, and placement edits do not increment the session version. Restoring a
household, student, or credential never decrements the version and therefore
cannot silently revive an old grant.

## Audit model

`academy_audit_events` is append-only. Direct update/delete is blocked both by
grants and a database trigger. Ordinary clients cannot insert. The trusted
service receives no direct table insert and cannot call the internal generic
audit appender. Provisioning/status triggers and the narrowly scoped emergency
session-reset function append allowlisted events as part of the same
transaction. Any future expiry-observation or retention operation needs its own
separately reviewed narrow function.

The event vocabulary covers:

- household creation/status;
- membership invitation/activation/revocation;
- student creation/lifecycle/external exit/session-version changes;
- guardian access grant/status/permission;
- subject enrollment creation/status/placement;
- credential creation/failure/lock/unlock/reset/replacement/revocation;
- student-session issuance/revocation and future observed-expiry events.

Events have dedicated household, optional student, actor, target, action,
reason, correlation, and timestamp columns. `details` must be a small JSON
object containing only allowlisted scalar keys and no sensitive key names. It
is limited to 4096 encoded bytes. Audit reasons and metadata must never include
credential verifiers, raw PINs, raw reset tokens, bearer tokens, token or device
digests, full Jarvis/Tutor transcripts, or unnecessary student content.

Hard deletes are blocked for households, memberships, students, guardian
access, subject enrollments, credentials, session grants, and audit events.
Future retention or accidental-record deletion requires a separately reviewed
function with narrow preconditions; Phase 0 provides no convenience delete.

## RLS and trusted provisioning

All public Phase-0 tables have RLS enabled. Public client grants are SELECT
only. The three security-definer guardian helpers use `auth.uid()`, qualified
objects, `search_path = pg_catalog`, active household status, active membership,
active student access, and permission rank.

Private tables use forced RLS, have no client policies, and grant neither schema
usage nor object privileges to `anon` or `authenticated`. The migration uses
explicit object-level grants/revokes only; it never applies `ALL TABLES`,
`ALL FUNCTIONS`, or a schema-wide revocation that could alter an unrelated
private object's ACL.

Normal clients cannot bootstrap the model. The first household, guardian
membership, student, guardian/student access row, and initial enrollment require
a future trusted provisioning endpoint or an operator-reviewed administrative
migration. Existing local-profile owners cannot self-bootstrap through the
browser. This is intentional while Phase 0 remains unmounted.

## Current `Profile` migration runbook

No import occurs in Phase 0. A later migration needs an operator-approved
preview, backup, dry run, validation report, and explicit commit.

1. **Provision the destination.** Create the household and guardian relationship
   through the reviewed trusted bootstrap path. The existing
   `public.profiles.household_id` is a guardian Auth UID, not the new household
   identity.
2. **Create an import ledger.** Every source record receives:
   `migration_batch_id`, source Auth UID/type/record ID, source timestamp,
   source digest, target type/ID, `started|completed|failed` status, retry count,
   last error, started/completed timestamps, and operator identity.
3. **Use stable student mapping.** Map `(source Auth UID, Profile.id)` to the new
   student UUID and preserve `Profile.id` in `legacy_profile_id`. Names are
   display data and never identity.
4. **Prevent duplicate imports.** Use a unique source-system/source-record key,
   deterministic child-record IDs, and compare the source digest before every
   retry. A completed ledger row is never imported again.
5. **Bound transactions.** Provision one student identity and its ledger record
   atomically. Normalize each later domain in a separate idempotent transaction
   so a reading failure cannot roll back or duplicate an assessment import.
6. **Recover partial failures.** Mark the domain ledger row failed with a safe
   error, roll back that domain transaction, and retry only after verifying the
   source digest is unchanged. Never delete a successfully imported domain to
   make a retry easier.
7. **Map grade conservatively.** Copy the scalar grade only to
   `current_grade_level`; separately review subject-level enrollments.
8. **Replace PINs.** Never copy `Profile.pin`. Require new credential enrollment
   so only a trusted-server-generated verifier enters the private table.
9. **Preserve source data.** Leave learning JSON, reading, assessments,
   Jarvis/Tutor history, and activity data in the original local/cloud profile
   until each normalized domain is independently validated.
10. **Keep sync ownership explicit.** Whole-profile sync must never create
    students or mutate normalized identity rows.
11. **Never dual-write.** During preview and validation, legacy profiles remain
    the only live write target. Normalized data is read-only validation output.
    Cutover to a normalized writer occurs once, after acceptance; the legacy
    writer is disabled before the new writer is enabled.
12. **Review inactive profiles.** Map archived/inactive profiles only after
    guardian review. Never infer deletion or transfer from inactivity.
13. **Validate.** Compare source/target student counts, stable IDs, ledger
    completion counts, JSON digests, reading-session counts, assessment counts,
    transcript counts, and per-domain totals. Investigate every mismatch.
14. **Roll back safely.** Before cutover, disable the importer and leave the
    unused normalized rows for investigation. After cutover, disable new
    callers and restore the accepted legacy application writer only if its
    source has remained authoritative. Never delete normalized history.

## Cutover prerequisites

Production remains prohibited until all of these exist:

- independently approved schema/RLS/security review;
- trusted bootstrap, credential, and session endpoints;
- reviewed Supabase exposed-schema configuration;
- production backup and operator-approved import batch;
- isolated migration run 1, complete real-role probes, migration run 2, and
  complete probe rerun with zero failures;
- production-safe read-only smoke probes that contain no fixture writes;
- import-ledger implementation and recovery rehearsal;
- dual-read validation with accepted counts/digests;
- explicit operator authorization for production migration and later cutover.

## Rollout and rollback

1. Phase 0: validate only in an isolated database and keep the app unmounted.
2. Phase 1: add trusted provisioning and credential-management APIs with rate
   limits, audit attribution, and adversarial tests.
3. Phase 2: add student token minting/validation APIs while the existing local
   picker/PIN flow remains live.
4. Phase 3: preview and validate an operator-approved import ledger without
   moving live learning writers.
5. Later: normalize one domain at a time, dual-read, then separately review
   writer and UI cutover.

Application rollback in Phase 0 is to leave the schema unmounted. In a
non-production empty database, an operator may remove new objects only after
verifying no imported data exists. Once identity/history exists, rollback means
disabling callers and preserving rows.

## Remaining Phase-1 decisions

- Trusted runtime and token transport.
- Current Argon2id/scrypt cost policy and online PIN retry limits.
- Student-session lifetime, refresh, device display, and retention policy.
- True cross-household transfer protocol.
- Future staff authorization model.
- Exact instructional-level/course identifier taxonomy.
- Professional privacy and retention review for minor accounts.

These are intentionally deferred implementation decisions. They do not weaken
the Phase-0 default-deny or unused boundary.

# Academy student identity foundation — Phase 0

## Status and boundary

Phase 0 is an additive, unused database foundation. It does not change the
current profile picker, local student PIN, parent PIN/login, application state,
whole-profile sync, learning records, reading, assessments, Jarvis, Tutor, or
any student-facing behavior. It does not import or upload a local profile.

Implemented:

- Durable students, households, guardian memberships, per-student guardian
  access, per-subject enrollments, lifecycle state, and append-only audit events.
- Relationship-aware, default-deny RLS for authenticated guardians.
- Private hashed-verifier and opaque-session-digest storage.
- A monotonically increasing student `session_version` for future global
  student-session revocation.
- Local-only SQL probes covering authorization and history preservation.

Deferred:

- Guardian/student administration UI and server endpoints.
- Credential setup/reset/verification and retry throttling.
- Student-session minting, refresh, device management, and logout.
- Importing current `Profile` objects or normalizing learning records.
- Teacher, staff, class, assignment, attempt, and activity-time authorization.

## Identity and guardian model

`academy_students.id` is the durable student identity. It is independent of the
student's display name, grade, PIN, local browser profile, and guardian's
Supabase Auth user ID. A student does not require an email address or an
`auth.users` row.

Normal Supabase Auth remains the guardian identity provider. The database stores
only foreign keys to `auth.users`; it does not copy passwords, emails, tokens,
or other Auth data.

The relationship chain is:

```text
auth.users
  -> academy_household_memberships (guardian, active/revoked)
    -> academy_guardian_student_access (student-specific permission, active/revoked)
      -> academy_students
```

A guardian can hold memberships in multiple households and can receive a
different permission level for each student:

- `viewer`
- `learning_manager`
- `identity_manager`

The levels are deliberately read-only in Phase 0. `viewer` can read the student
and subject enrollments; `learning_manager` and above can also read that
student's audit events. Trusted server code will later translate the levels
into narrowly scoped mutation capabilities. No staff role or staff policy
exists, so future staff access cannot be inherited accidentally.

Revoking either the household membership or the student access relationship
immediately makes the RLS helper return false. Rows are status-revoked rather
than deleted. Deleting a Supabase Auth user sets historical actor/user foreign
keys to null without deleting the student or academic references.

## Subject placement and reusable curriculum

`academy_subject_enrollments` separates instructional placement from the
student's optional `current_grade_level`. Each enrollment records:

- school year;
- subject;
- instructional level;
- reusable course identifier and curriculum version;
- enrollment status;
- start/end dates;
- placement source;
- parent/staff override actor and reason.

There is no uniqueness constraint on course or curriculum identifiers. Two
students can enroll in the same course/version with distinct enrollment IDs,
and one student can have different levels for math, reading, and other
subjects. Curriculum content remains reusable and is not copied into enrollment
rows.

Assignments, attempts, scores, mastery evidence, reading records, time records,
Jarvis conversations, and activity history remain separate per-student future
records. Phase 0 intentionally does not create those later-phase tables or move
the existing JSON data.

## Lifecycle and history

Student lifecycle states are:

`invited`, `active`, `paused`, `transferred`, `graduated`, `archived`, and
`deactivated`.

RLS authorization depends on active guardian relationships, not on the student's
lifecycle state. Therefore an authorized guardian can still read a deactivated
student and associated historical enrollments. Foreign keys use `restrict`
rather than cascading deletes. Lifecycle, guardian-access, and material
enrollment changes create audit events without recording credential material.

Deactivation is a status transition, not deletion.

## RLS and server authorization

All new tables have RLS enabled. Public tables revoke Supabase's default client
grants and return read-only rows to `authenticated` only when one of three
security-definer boolean helpers confirms the current guardian relationship.
The helpers use `auth.uid()`, fully qualified table names, an empty trusted
search path, active membership, active student access, and permission rank.

There are no client insert, update, or delete grants or policies. Consequently a
browser cannot:

- create a household or student;
- assign itself a membership or guardian relationship;
- alter permissions or lifecycle;
- create an enrollment;
- append an audit event;
- write or read credential/session secrets.

Provisioning and mutations require the trusted `service_role` path in a future
server endpoint. The service role must never enter a browser bundle.

`academy_private.student_access_credentials` and
`academy_private.student_session_grants` are outside the exposed `public`
schema, have forced RLS with no client policies, and explicitly revoke
`anon`/`authenticated` privileges. The credential table accepts only encoded
Argon2id/scrypt verifiers; the session table accepts only a high-entropy opaque
token digest. Neither plaintext PINs nor bearer tokens belong in the database.

## Future student-session flow

The next reviewed account session should implement this flow on a trusted
server:

1. An authenticated guardian with `identity_manager` access activates a student.
2. The guardian sets or resets a student access method over TLS.
3. The server rate-limits attempts and creates an Argon2id or scrypt verifier
   using a unique salt and appropriate current parameters.
4. At student sign-in, the server verifies the access method and checks student,
   credential, membership, and lifecycle state.
5. The server issues a short-lived, high-entropy student bearer token and stores
   only its digest in `student_session_grants`, scoped to `student_id`,
   `household_id`, capability set, expiry, and the current `session_version`.
6. Every student API call resolves the token on the trusted server and checks
   expiry, revocation, and current `session_version` before accessing exactly one
   student's rows.
7. Logout revokes one grant; a credential reset or guardian emergency action
   increments `academy_students.session_version` to revoke all older grants.

The guardian's Supabase access/refresh token remains in the guardian context and
is never embedded in, exchanged for, or exposed to the student session. A local
four-digit PIN remains a convenience input, never a Supabase/RLS authorization
boundary.

No minting endpoint is implemented in Phase 0 because the repository has no
trusted authenticated student-session service yet. Browser-only token minting
would be insecure.

## Current `Profile` migration plan

No automatic import occurs in Phase 0. A later operator-confirmed migration
must use a preview, backup, dry run, validation report, and explicit commit.

1. **Bind the destination household.** Create one new household and active
   guardian membership through the trusted server. Do not assume the existing
   `public.profiles.household_id` (currently the guardian Auth UID) is the new
   household ID.
2. **Create a stable mapping manifest.** Map
   `(existing Auth UID, Profile.id)` to `academy_students.id`, and copy
   `Profile.id` into nullable `legacy_profile_id`. The unique
   `(household_id, legacy_profile_id)` constraint prevents double import.
3. **Ignore names for identity.** Duplicate display names are valid; matching
   and idempotency use IDs, never names.
4. **Map grade conservatively.** Copy the current scalar grade only to
   `current_grade_level`. Create separately reviewed subject enrollments for
   instructional levels; do not infer every subject from the scalar.
5. **Replace PINs.** Never copy `Profile.pin`. Require the guardian to set a new
   access method so only a server-generated salted verifier is stored. The old
   plaintext local PIN remains in the untouched legacy profile until a later
   reviewed UI cutover and cleanup.
6. **Preserve the JSON source.** Leave skills, missions, attempts, totals,
   learning-history JSON, reading records, Jarvis/Tutor transcripts, and
   activity data in the existing `public.profiles.data` and local backup.
   Later normalized-record migrations reference the mapped student ID and use
   deterministic source IDs to prevent duplicates.
7. **Keep sync ownership explicit.** Record the source Auth UID, profile ID,
   source row timestamp, destination household/student IDs, and a digest of the
   source JSON in the migration manifest. Do not let automatic whole-profile
   sync create students.
8. **Review inactive profiles.** Map archived/inactive profiles to the closest
   lifecycle state only after guardian review. Never infer deletion.
9. **Validate before activation.** Compare profile counts, stable IDs, JSON
   digests, reading-session counts, assessment-attempt counts, transcript
   counts, and per-domain totals. Investigate every mismatch.
10. **Cut over later and reversibly.** Run a dual-read/validation phase behind a
    reviewed established feature-flag system (none exists today), then change
    one identity surface at a time. Keep the original local state and cloud
    profile rows available until acceptance.

## Rollout and rollback

1. Phase 0: apply only in an ephemeral/local Supabase project and run the probe
   script. Keep the application unmounted.
2. Phase 1: add trusted guardian provisioning and credential-management APIs
   with authorization, throttling, audit, and adversarial tests.
3. Phase 2: add student-session verification/minting and student-scoped data
   APIs. Keep the existing picker/PIN flow as the live path.
4. Phase 3: preview and validate an operator-approved profile mapping without
   moving learning data.
5. Later phases: normalize learning records, dual-read, then review the UI
   cutover separately.

Because Phase 0 is unused, application rollback is simply to leave the new
schema unmounted. A database rollback in a non-production environment may drop
only the new `academy_*` objects after confirming they contain no imported
data. After real data exists, rollback means disabling new callers and
preserving the additive tables; it must never delete student history.

## Unresolved decisions

- Trusted runtime and token transport (Netlify function, Supabase Edge Function,
  or another server).
- Opaque token capability representation and refresh policy.
- PIN retry/lockout parameters and guardian recovery UX.
- Household transfer and co-guardian invitation workflow.
- Student/session retention and deletion policy.
- Whether future staff access uses separate memberships or a separate staff
  authorization model.
- Exact instructional-level and course identifier taxonomy.
- Professional privacy/policy review for minor accounts, transcripts, and
  retention.

None of these decisions is needed to keep the Phase-0 schema additive,
default-deny, and unused.

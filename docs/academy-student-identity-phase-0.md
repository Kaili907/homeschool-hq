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

Guardian removal in Phase 0 means revoking the guardian's household membership
and every guardian/student access row while retaining the Supabase Auth user
whenever history references that identity. Direct Auth-user deletion is not a
supported removal path. Several Auth references use `ON DELETE SET NULL` for
optional actor snapshots, but active membership constraints require a user ID,
and guardian-attributed audit history requires a nonnull actor. Therefore an
account-deletion workflow must first revoke relationships and sessions and will
still be refused while protected guardian attribution remains.

Hard deletion of a guardian Auth user is deferred to a separately reviewed
privacy workflow. That workflow needs an immutable non-Auth actor identifier or
actor snapshot, explicit historical semantics, session invalidation, constraint
verification, and its own audit event. It must not weaken or erase academic or
identity history merely to make Auth deletion convenient.

Every Phase-0 `auth.users` foreign key currently uses `ON DELETE SET NULL`, with
these additional semantics:

| Reference | Historical meaning and deletion rule |
| --- | --- |
| household/student `created_by` | Optional provenance; null is structurally valid only for history, not authorization. |
| membership `user_id` | Guardian identity; null is invalid for an active membership, so revoke before any future deletion attempt. |
| membership/access `revoked_by` and access `granted_by` | Optional actor provenance; relationship status controls authorization and must be revoked first. |
| enrollment `override_by` | Required whenever an override reason exists, so reviewed placement provenance can block deletion. |
| audit `actor_user_id` | Required when `actor_kind = guardian`; protected historical attribution intentionally blocks direct Auth deletion. |
| credential creation/replacement/revocation actors | Guardian actor kinds require the corresponding Auth reference; credential rows are retained history. |
| session issuance/revocation actors | Guardian issuance/revocation requires the corresponding Auth reference; grants are retained history. |

`SET NULL` therefore does not promise that every Auth deletion will succeed:
row-level consistency checks may reject it. The trusted future deletion workflow
must revoke active rows first, invalidate student sessions, evaluate every
remaining historical reference, and stop unless the separately approved actor
snapshot model preserves interpretation.

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

Salt and hash fields use one canonical representation: standard unpadded Base64
with alphabet `A-Z`, `a-z`, `0-9`, `+`, `/`; no `=` padding; and a character
length whose remainder modulo four is `0`, `2`, or `3` (never `1`). The
database decodes each field and requires a 16-64-byte salt and a 32-64-byte
hash. Internal/excess padding, whitespace, non-Base64 characters, trailing
data, and shorter or longer decoded values fail. The checks also require the
exact algorithm/version prefix, numeric bounded cost fields, and a bounded
total envelope length.

The scrypt representation is the Academy scrypt-v1 envelope: a future server
must use a reviewed scrypt implementation and serialize its salt, cost
parameters, and derived key exactly in this representation. There is no
`verifier_parameters` or other auxiliary JSON column. All nonsecret algorithm
parameters are parsed from the approved envelope, eliminating a spare field
that could contain a raw PIN, reset token, salt/hash duplicate, or secret note.

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

`academy_private.student_session_grants` stores no bearer token. The canonical
raw token contract is:

```text
aca_stu_v1_<43 unpadded base64url characters>
```

The 43-character suffix encodes 32 bytes (256 bits) generated by a
cryptographically secure random source and permits only `A-Z`, `a-z`, `0-9`,
`_`, and `-`; padding is forbidden. The fixed versioned nonhex prefix makes the
raw format disjoint from its stored digest. The trusted server returns the raw
token once, never logs or audits it, computes SHA-256 over the exact ASCII token,
and stores only the resulting 64 lowercase hexadecimal digest characters. A raw
token, uppercase digest, non-hex text, or any other digest length is rejected.
The trusted server must generate this format; the database cannot establish
entropy for an attacker-selected string.

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
- `issued_at <= now()` (a future-dated grant is not current before issuance);
- the grant is unrevoked and unexpired;
- the grant version equals the student's current `session_version`;
- the referenced credential/version is still active;
- a guardian-activation issuance still has an active membership and active
  identity-manager relationship.

Phase 0 intentionally sets no database maximum future-issuance tolerance:
future-dated rows remain non-current until `issued_at`. The trusted server
contract must use database time or a separately reviewed small clock-skew
tolerance and must never mint intentionally future-effective sessions.

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
reason, correlation, and timestamp columns. `details` is not generic
caller-defined audit JSON: each event type has an exact key set, scalar types,
and constrained vocabulary. Trigger builders derive those values from trusted
row fields. Extra keys, nested values, invalid vocabulary, control characters,
and values longer than their event-specific limits fail. The complete object is
also limited to 4096 encoded bytes.

Reasons are optional bounded administrative notes (240 encoded bytes maximum),
must contain no control characters, and reject verifier, raw-token,
token-digest, and secret-assignment patterns case-insensitively. Metadata values
receive the same pattern checks in addition to their event-specific validation.
Credential verifiers, raw PINs, raw reset tokens, bearer tokens, token or device
digests, full Jarvis/Tutor transcripts, assessment responses, and unnecessary
student content must never appear even under an otherwise allowed key and even
when the writer is the trusted service.

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

The required migration and security-definer owner is the repository's Supabase
migration role, `postgres`. It must not be `anon`, `authenticated`,
`service_role`, or a normal application user. Every helper uses
`search_path = pg_catalog`; only the three guardian authorization helpers have
authenticated execute permission, and the private server helpers have only the
explicit service execute grants needed by their contracts. Changing a function
owner or execute ACL requires an audited migration and independent review.
PGlite's `postgres` superuser simulation proves only the isolated catalog
contract, not hosted-role administration.

Production preflight and post-apply verification must run this owner query and
compare every row with the approved migration:

```sql
select
  namespace.nspname as function_schema,
  procedure.proname as function_name,
  pg_get_function_identity_arguments(procedure.oid) as arguments,
  pg_get_userbyid(procedure.proowner) as function_owner,
  procedure.prosecdef as security_definer,
  procedure.proconfig as configured_settings,
  procedure.proacl as execute_acl
from pg_catalog.pg_proc as procedure
join pg_catalog.pg_namespace as namespace
  on namespace.oid = procedure.pronamespace
where (
  namespace.nspname = 'public'
  and procedure.proname in (
    'academy_is_active_household_guardian',
    'academy_is_current_guardian_membership',
    'academy_has_student_permission'
  )
) or (
  namespace.nspname = 'academy_private'
  and procedure.proname in (
    'append_audit_event',
    'prepare_student_update',
    'audit_household',
    'audit_membership',
    'audit_student',
    'audit_guardian_access',
    'audit_subject_enrollment',
    'validate_credential_lineage',
    'prepare_credential_update',
    'audit_credential',
    'prepare_student_session_update',
    'audit_student_session',
    'is_student_session_grant_current',
    'reset_student_sessions'
  )
)
order by 1, 2, 3;
```

## Migration marker, rerun safety, and ACL sentinel

`academy_private.identity_foundation_metadata` records foundation version 2,
the migration name, expected owner, verification count, and a canonical
security manifest only after successful creation. The manifest captures all
Phase-0 table owners/RLS/ACLs, columns (types, nullability, defaults, generated
behavior), constraints and foreign-key actions, indexes/predicates, policies,
functions (body, signature, return type, language, volatility, owner,
security-definer mode, `search_path`, execute ACL), and triggers. On rerun the
migration verifies the existing manifest before any `CREATE OR REPLACE`, policy
replacement, or trigger replacement. Any mismatch aborts the transaction
instead of silently repairing an unknown object. A first run also refuses any
unmarked collision with a Phase-0 relation, index, or function name.

The isolated validation order is exact:

1. Create the Supabase-compatible roles/Auth shim and apply `supabase/schema.sql`.
2. Execute and commit only the `ACADEMY SENTINEL PREFLIGHT` section of
   `academy_student_identity_rls_probes.sql`. It creates an unrelated private
   table and function, assigns deliberate ACLs, and stores their owner and ACL
   baseline outside the rollback fixture.
3. Run Migration 1.
4. Run only the `ACADEMY ROLE PROBES` section (Probe Run 1); its fixtures roll
   back.
5. Run Migration 2.
6. Confirm the sentinel creation timestamp predates Migration 2 and its schema,
   table, function ACLs, and owners exactly match the committed baseline.
7. Run the role-probe section again (Probe Run 2).
8. Compare complete security manifests and object definitions, then confirm
   zero residual identity fixture rows.

Running the entire probe file through `psql`, Supabase SQL Editor, or a
multi-statement client is also safe: explicit `BEGIN`/`COMMIT` commits the
sentinel before the separate `BEGIN`/`ROLLBACK` role fixture. The harness must
not depend on client-specific batch splitting. Dedicated fresh databases must
also prove that wrong nullability/default/FK/check definitions, RLS state,
function owner/security/search path, policy, trigger, and private ACL cause an
expected migration failure.

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

The later hosted-Supabase application session must verify the exact project and
authenticated database identity; inspect the live migration history, exposed
API schema list, owner/ACL query above, and all object names; apply the exact
independently approved migration; run the exact approved probes; and stop on
any failure. PGlite cannot reproduce PostgREST exposure, hosted role
administration, SQL Editor batching, project extension state, or hosted owner/
`service_role` bypass behavior. Those are production preflight requirements,
not reasons to activate or dual-write this unused foundation.

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

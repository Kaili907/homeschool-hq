# Authority contract

## Canonical state

Cross-device Study synchronization reuses the existing production tables:

- `academy_private.student_session_grants`: opaque digest, household, student,
  guardian owner, capabilities, expiry/revocation and lifecycle version.
- `public.academy_study_sessions`: household/student/lesson identity,
  immutable curriculum and effective-settings binding, lifecycle state and
  server revision.
- `public.academy_study_checkpoints`: minimized cursor, completed segments,
  safe time totals and checkpoint revision.
- `academy_private.study_mutation_receipts`: operation idempotency,
  fingerprint and stable result.

`public.academy_study_session_authority` is a one-to-one extension, not a
second Study document model. It adds only fields not already represented by the
canonical session/checkpoint tables:

- derived `assignment_ref` (`study_plan_id`, falling back to `lesson_id`);
- server-custody safety state and guardian clear evidence;
- guardian attestation state and evidence;
- a separate authority revision so safety/attestation CAS does not contend with
  instructional lifecycle revision;
- last accepted client operation and actor identifiers.

Identity fields are immutable, the table is forced-RLS, and future Study
session inserts initialize the row automatically. Existing sessions are
backfilled from identifiers only.

## Actor rules

Guardian browser actor:

- `auth.uid()` must be present.
- The opaque digest must resolve to a current `study` grant issued by that same
  user for the exact student.
- The user must still hold active `learning_manager` or stronger access.
- The grant's household must equal the stored session household.

Student browser actor:

- The JWT principal kind must be `student_session_grant`.
- `auth.uid()` must equal the exact current grant UUID resolved by the digest.
- The grant must belong to the exact student and household.
- A student may save a minimized checkpoint and assert a safety stop.
- A student cannot clear safety or attest guardian work.

Trusted server actor:

- The legacy `(text,text)` verifier is retained for compatibility.
- New actor-attributable routes must use `(text,text,uuid)` or one of the
  actor-aware five-argument runtime executor overloads.
- A null or mismatched actor returns the same non-oracular denial envelope.
- All service-only overloads retain the trusted-server guard and are executable
  only by `service_role`.

## Binding and invalidation

A write succeeds only when all bindings agree in one transaction:

`JWT actor -> current digest grant -> student -> household -> assignment -> Study session`

The current-grant predicate includes grant expiry/revocation, active household,
active student lifecycle, matching student `session_version`, active credential
and, for guardian launches, active issuing membership and identity-manager
access. Revocation, credential invalidation, membership/access revocation,
student lifecycle change or student session-version rotation therefore makes a
stale session unable to write.

Completed or abandoned sessions reject student writes. Guardian authority
transitions remain possible only through the exact guardian-bound grant; this
does not create a general browser administration path.

## Data minimization

Permitted hosted operational state is identifiers, revisions, completed
segments, safe instructional cursor, bounded time totals, lifecycle state,
safety/attestation state, curriculum readiness metadata, timestamps and
idempotency metadata.

The migration and hydrate projection do not store or return raw Tutor
conversation text, raw private answers, emotional labels, personality
inference or diagnostic inference. Raw Study session references are never
stored in the new layer; writes accept only their SHA-256 digest.

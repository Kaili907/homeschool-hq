# Study / Admin curriculum release registry bridge

## Authority ruling

The Admin Curriculum Release Registry is the sole publication authority for
Study. A Study session can bind only to a row in
`public.academy_curriculum_releases` whose immutable status is `published`.
Package identity, semantic version, release UUID, and curriculum-manifest
SHA-256 are copied into the session from that one server-read registry row and
held by a composite foreign key back to it.

The historical `academy_private.study_curriculum_release_approvals` table is
removed by the bridge. Its only policy was an `approved` label over copied
release metadata, so retaining it would preserve a second publication
authority without adding a Study-specific restriction. Study eligibility still
adds the active, date-effective subject-enrollment check. A future additional
Study policy must reference an already-published registry release and must not
recreate publication custody.

## New sessions and active-pointer history

ADMIN-16A's immutable revision-1 `registry_only` production pointer remains
unchanged. The bridge evolves the pointer primary key to
`(environment, revision)`, keeps updates and deletes forbidden, and adds a
strict append guard. Revision 2 records the migration-owned transition to
`study_new_sessions`. Later owner-authorized, audited Admin release work may
append only the next `activate` or `rollback` revision; this bridge adds no
browser or Admin mutation endpoint.

For a new session the trusted database resolver:

1. verifies that the browser's advisory version names a registered published
   release;
2. independently reads the latest production pointer and its published release;
3. requires the advisory version to match that server-selected release;
4. requires exactly one matching active learner enrollment; and
5. snapshots the registry UUID, package ID, version, and manifest digest.

An unregistered version, draft, inactive version, absent pointer, ambiguous
enrollment, or metadata mismatch fails closed without creating a session.

## Existing sessions and rollback

Resume, checkpoint, calendar, dashboard, and adult-review lineage read the
immutable binding already stored on the session. They do not re-read the active
pointer. Activation or rollback can therefore change only the release selected
for a later new session; it cannot repin or rewrite an in-progress session.
Legacy sessions whose release cannot be proven remain `manual-review` with
`legacy-curriculum-binding-ambiguous`.

## Authorization boundary

Browser roles have no table privileges on releases or pointer history. The
browser cannot supply a release UUID, digest, status, pointer, operator role, or
learner identity. The verified runtime accepts only a bounded advisory release
version and lesson context; the server derives the learner/capability and the
database derives publication and active-pointer authority.

Migration:
`supabase/migrations/20260810153000_academy_study_release_registry_bridge.sql`.
It is local-only and has not been applied to a hosted project.

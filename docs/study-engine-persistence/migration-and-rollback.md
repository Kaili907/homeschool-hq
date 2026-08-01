# Migration and rollback guide

## Dependencies and order

The exact order is:

1. `20260724074106_academy_profiles_base.sql` (historical; do not edit/replay)
2. `20260724230000_academy_student_identity_foundation.sql` (historical; do not edit/replay)
3. `20260726120000_academy_household_revision_cas.sql` (historical; do not edit/replay)
4. `20260801010000_academy_study_engine_storage.sql`
5. `20260801011000_academy_study_engine_authorization.sql`

The Study storage migration depends on identity foundation version 2 and its
exact security manifest. Authorization depends on the Study storage marker at
version 1. Both new migrations use explicit `begin`/`commit`, require owner
`postgres`, reject existing unmarked object names, pin function search paths,
and install no browser table-write grants.

## Historical checksum gate

Before any future application, compare the candidate historical files with the
approved repository bytes. Session 13 pins these SHA-256 values in an executable
test:

| Migration | SHA-256 |
|---|---|
| profiles base | `8b1947fe2ce5d605e143b93b1ad8784d1d52095e83a4f8c63b8689f22462725d` |
| identity foundation | `1700d95a8630214b49834dcb05c80358718128675389fb032669ebfa2644b829` |
| household revision CAS | `40e9916322181fb19f9c58feeb90cf81a7e942e6b47199e05dc126bee43cd24d` |

Run `npm run test:migrations` under Node 22. A mismatch is a hard stop. Never
repair hosted history by replaying a locally modified historical migration.
Investigate the authoritative migration ledger and object definitions first;
then create a new reviewed additive repair migration if needed.

## Rollback strategy

There is deliberately no automatic production down migration. The new tables
carry durable learner state and audit linkages, so dropping them is destructive.

- Before hosted application: abandon the candidate branch; hosted state is
  unchanged.
- If the first migration fails: its transaction rolls back completely.
- If storage commits but authorization fails: keep consumers disabled, capture
  the failure/catalog report, correct with a new additive authorization
  migration, and retry only after review.
- If a completed rollout must be reversed: disable consumers and service
  workers, preserve/export affected data, restore the verified pre-migration
  database backup or apply a separately reviewed compensating migration.
- Only in a disposable local database may the whole database be discarded and
  recreated to validate rollback behavior.

Do not drop private ciphertext, audit events, or outbox records as an emergency
shortcut. Do not add permissive policies to work around a failed function.

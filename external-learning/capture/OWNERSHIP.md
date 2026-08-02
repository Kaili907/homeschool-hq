# Session 4 ownership

Resolved ownership for the intake/extraction engine:

- `external-learning/capture/**` — owned by the intake/extraction workstream in
  Session 4.

Related Session 4 paths are separate ownership boundaries:

- `app/features/external-assignment-capture/**` — parent/student confirmation
  interface workstream.
- `tests/external-assignment-capture/**` — privacy, testing, and validation
  workstream.

This workstream must not modify either related path or any shared assignment,
calendar, student, identity, authentication, storage, or package configuration.
Read-only inspection found no existing `external-learning` directory, so no
equivalent ownership path required reconciliation.

# Local-to-hosted family identity linking

The current Family Pilot owns device-local identity. Its household reference and
`legacy-profile-id` student references are valid keys for the audited local
runtime, but they are not claims of hosted authority. The hosted bridge accepts
only server-resolved `academy-student-id` references.

Convergence must preserve these as separate states:

- `DEVICE_LOCAL_IDENTITY_STATE` contains the existing local household, roster,
  PIN checks, progress, sessions, and IndexedDB data. Importing the hosted bridge
  does not contact a network or make that state unavailable.
- `HOSTED_AUTHORITY_STATE` contains the currently authenticated adult, the
  authorized hosted household, and the hosted roster/config projection. It is
  replaceable and expires or is revoked with server authority.

When both states contain data, convergence pauses in `explicit-link-required`.
An adult must confirm the exact local household, hosted household, and every
local-student-to-hosted-student mapping. Display names are never used to create
or validate a link; identical names do not imply identity. A wrong household,
unknown reference, duplicate target, incomplete mapping, or malformed saved
link goes to `review-required`.

This subtree provides the pure validation/planning seam only. It performs no
database migration, storage write, automatic merge, hosted request, or Family
Pilot wiring. A future convergence policy must separately decide whether a
previously verified linked local dataset may continue offline and how a
confirmed link is durably journaled before any data is re-keyed.

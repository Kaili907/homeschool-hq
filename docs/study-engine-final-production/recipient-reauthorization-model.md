# Recipient reauthorization model

The live server snapshot must match the proposal binding and current revisions exactly. Required evidence includes active household membership, guardian role and guardian-to-student relationship, effective and unexpired non-revoked permission, allowed channel, active route, exact household/learner/proposal, current proposal/permission/route revisions, and a server-derived stable recipient reference.

Caller-authored booleans and stale evidence are rejected. Uniqueness is recipient-aware: one proposal may notify two authorized guardians on the same channel, while a duplicate tuple of proposal, recipient, and route is idempotently rejected.

# Curriculum human approval foundation

Status: repository-only; the migration has not been applied hosted.

This foundation records a human approval or changes-requested decision for an
exact curriculum draft revision. It deliberately does not materialize a
release, stage artifacts, publish curriculum, activate a pointer, or roll back
anything.

## Exact binding and lifecycle

Every approved decision stores the draft UUID and revision, immutable base
release foreign key, target-version intent, Schema Set version, validation
snapshot UUID and validation result SHA-256. Validation snapshots store only a
bounded result summary and identity, never the curriculum snapshot or finding
narrative. Decisions are append-only and record the deciding actor internally
so a later reviewer-separation policy can be enforced without changing the
binding contract. This card does not invent a two-person policy.

The projected states are `pending_review`, `approved`, `changes_requested`,
and `stale`. An approval is current only while its decision revision equals the
authoritative draft revision. Any entity create, update, or tombstone advances
the draft revision through the existing authoring CAS, so a prior approval is
immediately projected as stale without editing approval history. A
changes-requested decision is terminal for its revision; a material edit opens
a new revision for validation and review. An approved revision may be moved to
changes requested to revoke its gate without mutating curriculum content. A
new validation result identity for the same revision also supersedes the prior
approval; the newest valid result must receive its own decision.

## Validation gate

`academy_admin_record_curriculum_validation_v1` persists the identity and
bounded summary of the deterministic validation result after independently
reauthorizing `curriculum:read` and checking the current draft revision. Exact
result re-recording returns the same validation snapshot; conflicting metadata
under the same result digest is rejected.

`academy_admin_decide_curriculum_approval_v1` accepts approval only when the
referenced validation snapshot binds to the same draft, revision, base release,
target intent, and Schema Set, and reports all of the following:

- status `valid`;
- publication-ready `true`;
- zero blocking findings;
- zero blocking errors; and
- zero unresolved human-review blockers.

Invalid, incomplete, unavailable, and error results fail closed. The validator's
`standards.human_review_required` findings—including preserved Michigan PE
mapping work—are counted as human-review blockers and cannot be bypassed here.

## Authorization, replay, CAS, and audit

The HTTP boundary requires `curriculum:read` for status and
`curriculum:approve` for decisions. The browser sends no actor, role, or
capability assertion. The database independently resolves the actor's current,
unexpired, unrevoked assignment and maps only the exact frozen capability;
`curriculum:approve` resolves only for the owner role in the current ADMIN-0
contract.

Decision requests use an actor-scoped UUID and server-computed request SHA-256.
Exact retries reproject current state with `replayed: true`; conflicting reuse
fails. The decision RPC locks and compares the authoritative draft revision, so
stale and concurrent decisions fail without a partial row or audit event.

Approval and changes-requested decisions append
`curriculum_approval.approve` or
`curriculum_approval.changes_requested` to the Admin audit ledger in the same
transaction. Audit values contain only draft revision, target version,
decision state, and bounded reason code. They contain no curriculum payload,
finding explanation, lesson content, assessment content, or reviewer profile.

## Release-staging seam

Every status response contains `publishGate` with an eligibility boolean,
bounded reason, current draft revision, approval UUID, and validation snapshot
UUID. The ungranted internal function
`academy_private.curriculum_approval_publish_gate_v1(uuid, bigint)` exposes the
same payload for a later postgres-owned Release Staging RPC. It performs no
materialization or release mutation.

The Curriculum Studio review panel displays revision, validation state,
blocking counts and visible validation blockers, current/stale approval state,
bounded changes-request reasons, and append-only review history. Approve is
disabled for stale, blocked, unavailable, or unsaved state. Preview/Diff is a
link seam only.

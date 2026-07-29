# Adaptive Tutor Core change requests

No shared Tutor Core or Study Engine files were edited. The actual Manuel
Academy Adaptive Tutor Core v0.2 package remains unavailable/unverified in the
existing reconciliation record, so this feature does not invent its contracts.

## MCR-001 — Canonical learning-event envelope

Status: **required for production ingestion**

Provide a versioned, JSON-safe event envelope with:

- stable event/evidence, student, skill, session, and attempt IDs;
- RFC 3339 occurrence time;
- producer version;
- explicit support level;
- duplicate/replay correlation;
- no raw answer, transcript, private note, or diagnostic content.

The existing `src/appState.ts#recordAnswer` call does not expose enough stable
identity/context for a safe adapter.

## MCR-002 — Explicit independent-demonstration outcome

Status: **blocking automatic mastery promotion**

Tutor Core must explicitly state that a bounded performance sample was
independent and provide attempted/correct counts, criterion ID/threshold,
context, task novelty, and source evidence IDs. Completion, numeric score,
`correct`, `successful`, or Tutor Core mastery values must not be reinterpreted
as this assertion.

Until this exists, integrations may record assessment and tutor evidence but
must not synthesize `independent_demonstration`.

## MCR-003 — Assessment item-to-skill mapping

Status: **required for fixed-form assessment integration**

Expose a stable catalog mapping each assessment item to one or more canonical
skill IDs and state whether the attempt was independent. The current fixed-form
`Attempt` contains answers and aggregate section scores but no canonical
item-to-skill evidence projection.

The adapter should emit counts/references only; raw answer values remain in the
assessment subsystem.

## MCR-004 — Tutor intervention event

Status: **required for complete teaching-cycle evidence**

Emit a stable intervention event for clarification, prompt, hint, worked
example, reteach, redirection, and adult escalation, including support level
and bounded outcome. The existing walkthrough log is an escalation counter, not
a complete evidence contract.

## MCR-005 — Prerequisite outcome mapping

Status: **blocked pending actual Core enum inspection**

Provide an exhaustive mapping from actual Core prerequisite and uncertainty
enums to the canonical structured prerequisite outcome. Do not collapse or
expand a boolean. Unknown values must be quarantined.

## MCR-006 — Sidecar persistence and optimistic revision

Status: **required for application integration**

Register a mastery sidecar keyed by canonical student ID, aggregate kind, and
opaque record ID, with atomic compare-and-swap on `revision`. Do not add these
records to the existing `Profile.skills` rolling estimate or silently bump the
shared `AppState` schema.

## MCR-007 — Authenticated adult override command

Status: **required for production overrides**

Provide an authorization-gated parent/teacher command that supplies actor ID,
reason, time, optional expiration, and a unique override/audit ID. Persist the
record revision and append-only audit entry atomically. This feature validates
the command shape but does not authenticate adults.

## MCR-008 — Versioned skill catalog publication

Status: **required for catalog rollout**

Publish stable skill and prerequisite IDs with a catalog revision and
deprecation/alias policy. IDs must never be derived from titles, reused, or
renamed when copy changes. A catalog revision must be validated for dangling
edges and cycles before activation.

## MCR-009 — Review-scheduler handoff

Status: **required for automated reinforcement**

Define a canonical event/command that turns
`needs_reinforcement`/`maintain_with_spaced_review` into the existing
`StudentSkillReview` schedule without guessing review kind, priority, or
calendar semantics.


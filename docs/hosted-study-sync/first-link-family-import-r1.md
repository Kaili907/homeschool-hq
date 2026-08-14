# Hosted sync first-link Family import R1

Status: implementation-ready injected seam; not activated in the final app.

This package links an existing device-local Family Pilot household to a future
hosted household without replacing local identifiers or treating the browser as
household authority. Its public entry point is
`src/study/hosted-sync/v2/linking/index.ts`.

## Link API and authority

`FirstLinkApi.inspect()` takes no household, actor, role, or token argument. The
server must derive the currently authenticated Parent and exact household, then
return the non-secret `AuthenticatedParentHouseholdAuthority` summary. An
expired or malformed authority is refused. `apply()` must independently derive
the current actor again; the authority reference in the manifest is correlation
evidence, not a bearer credential.

The protocol is:

1. Read an allowlisted local snapshot and inspect the server-derived household.
2. Build a name-blind deterministic plan at the returned base revision.
3. Resolve every ambiguous student through an explicit Parent choice.
4. Hash the exact plan and local snapshot shown to the Parent.
5. Require the Parent confirmation checkbox for that digest.
6. Save the immutable pending manifest in an injected progress sidecar.
7. Apply with a base-revision CAS and deterministic operation IDs.
8. Read the result independently from the server.
9. Verify the exact household, digest, operation set, and one-to-one
   student/assignment/session mapping.
10. Only then commit an injected local link receipt. The receipt is a sidecar;
    it must not rewrite local IDs or local household content.

No API implementation, endpoint, database change, environment flag, route, or
hosted project binding is included here.

## Student mapping

Display names are rendered for Parent comprehension only and never enter the
matching predicate.

Each local student has exactly one closed plan state:

- `EXACT_MATCH`: one stable identity match, or a Parent-approved explicit map.
- `EXPLICIT_MAP_REQUIRED`: there is no stable match and at least one unclaimed
  hosted student could be selected. Linking is blocked until the Parent chooses
  an existing student or explicitly chooses to create a new one.
- `NEW_REMOTE_STUDENT`: no hosted student is claimed, or the Parent explicitly
  chose to create a new hosted student.
- `CONFLICT`: duplicate stable identity, duplicate Parent choice, unknown
  target, two local students claiming one hosted student, or downstream remote
  state conflict.

An exact stable identity cannot be overridden by a Parent choice. Local and
remote references are carried side-by-side throughout the plan, manifest, and
verified receipt; local references are never renamed.

## Assignment and Study session mapping

Assignments match only through `originLocalAssignmentRef`. A remote assignment
with the same content but no origin proof is a conflict, not an implicit match
and not permission to create a duplicate. A matched origin with a different
kind/content is also a conflict.

Study sessions follow the same rule through `originLocalSessionRef`, and their
remote assignment and lesson binding must agree. Study document identity has
its own operation ID; sessions preserve local assignment, block, lesson,
cursor, status, last accepted safe event reference, and the latest minimized
checkpoint. No response draft is uploaded.

## Manifest and privacy

The manifest contains:

- local and remote household identity plus the server-derived authority ref;
- local and remote student mapping;
- assignment identity, lifecycle, completion, and minimized progress;
- Study document/session/checkpoint identity and minimized cursor state;
- dynamic source metadata;
- guardian attestation lifecycle without the local adult identity;
- minimized safety hold lifecycle without `clearedBy` or the local dedupe key;
- the server base-revision seed;
- a unique deterministic operation ID for the household, every student,
  assignment, Study document/session, source, attestation, and safety hold;
- the exact Parent confirmation and manifest digests.

The allowlist has no destination for PINs/PIN digests, learner response bodies,
response draft references, Tutor transcripts or event payloads, adult-private
notes, provider/auth credentials, or assessment/adult answer authority. Literal
false privacy markers make these exclusions reviewable at the boundary.

Imported guardian attestation history is marked
`authenticated-parent-import-receipt-required`; it cannot become hosted adult
authority merely because a browser supplied it.

## Conflict, idempotency, rollback, and failure

`apply()` is required to CAS against `serverBaseRevisionSeed`. A changed remote
revision returns `conflict`; it must never overwrite remote state. The Parent
must inspect a fresh plan.

The `attemptId` namespaces deterministic operation IDs. The same frozen pending
manifest therefore has byte-identical fingerprints on every retry. A partial
server apply can be resumed even if newer work was recorded locally: the retry
finishes only the already confirmed snapshot, and does not modify the newer
local work. A later normal sync can advance hosted authority from that verified
base.

Network failure leaves Family Pilot source state untouched and retains only the
pending progress sidecar. An incomplete server readback remains pending. A
missing/extra operation, wrong digest, changed exact match, duplicate remote ID,
or incomplete mapping blocks local completion. Linking becomes complete only
after exact authoritative readback and successful local receipt commit.

Rollback before verified completion is simply to leave the local household
unlinked and retain or discard the pending sidecar through an explicitly
designed Parent action. This R1 intentionally provides no automatic delete of
partially imported remote records: destructive cleanup would break retry
idempotency and requires a separately authorized server retention workflow.

After verified completion, operational rollback is to disable the injected
feature and stop cross-device callers. The local Family Pilot household remains
intact; remote data is not silently deleted or pushed back over it.

## Activation boundary

`ParentFirstLinkReview` is an injectable Parent-facing review surface showing
counts, new/existing/ambiguous/conflict state, privacy exclusions, and explicit
success/failure. Nothing imports this package from `FinalFamilyPilotApp`, final
composition, routing, or app startup. Activation requires a separately reviewed
transport, authenticated server implementation, durable progress/receipt
ports, and feature gate.

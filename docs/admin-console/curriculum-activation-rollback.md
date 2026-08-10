# Curriculum activation and rollback control plane

ADMIN-20C governs the `production` curriculum default/current pointer. It does
not publish curriculum, mutate immutable published releases, or repin learners.

## Authority

- Reads require the frozen `curriculum:read` capability.
- Transitions require the narrower frozen release capability,
  `releases:manage`.
- The server derives the actor from a verified bearer and reauthorizes the
  current assignment before every request.
- The service-only database RPC independently maps the current assignment to
  the required capability. Role headers, body role strings, and client
  capability arrays are not accepted.

## Transition rules

- A target must exist in `academy_curriculum_releases` with `published` state.
- Its immutable file inventory must match the registered count and byte total.
- Every file locator must match the release's commit-pinned source root.
- Package, checksum, curriculum-manifest, manifest-verification, and validation
  evidence must all be present and match the registered digests where defined.
- Staged-only and nonexistent targets fail closed.
- Every transition supplies the expected current pointer revision. The
  database locks the pointer and performs a compare-and-swap update.
- First activation of a published release is `activation`. Selecting a release
  already present in pointer history is `rollback`.
- An already-active target is a truthful no-op and adds no pointer history or
  audit event.

## History, replay, and audit

`academy_curriculum_pointer_transitions` is append-only and holds each pointer
revision. Rollback creates another revision; it does not delete or mutate the
release being left. Actor-scoped request receipts make exact replay safe and
reject changed reuse. A successful transition atomically writes the pointer,
transition history, bounded Admin audit metadata, and the receipt.

Audit metadata contains only the previous/new release versions, transition
kind, pointer revision, fixed reason code, and correlation/request UUID. No
curriculum payload or learner data is recorded.

## Learner pin isolation

The transition RPC never reads or writes `profiles`. Existing
`Profile.academy.releaseVersion` values remain unchanged. The pointer is the
default/current authority for appropriate new resolution; any existing-learner
repin requires a separate governed migration that is outside this control
plane.

## Operational hold

The migration and UI are repository-local in this card. The migration has not
been applied to a hosted database, no hosted pointer transition was executed,
and no deployment was performed.

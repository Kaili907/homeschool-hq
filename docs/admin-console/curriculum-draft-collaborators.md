# Curriculum draft collaborators

Curriculum Studio collaboration is a resource assignment layered beneath the
canonical global Admin roles. It does not add a global role or capability.
Every request first resolves the current `owner`, `admin`, or `viewer` role and
its frozen capability set. A current draft assignment then narrows access to
one workspace.

## Responsibilities and lifecycle

The bounded responsibility vocabulary is `editor` and `reviewer`:

- `editor` requires the principal to retain global
  `curriculum:drafts:write` and permits draft/entity/collaborator mutations;
- `reviewer` requires the principal to retain global `curriculum:read` and is
  read-only even if the principal's global role has broader capability.

A new draft atomically assigns its verified creator as the initial editor. The
migration backfills the same assignment for existing drafts. Collaborator rows
reference `auth.users.id`; email addresses, display names, learner data,
curriculum payloads, notes, and credentials are not stored. Assignments are
append-only history: active rows may transition once to revoked, cannot be
edited or revived, and cannot be deleted. Revoking the final editor is denied.

## Authorization, CAS, and replay

Draft list/read/entity-read RPCs require both the existing global read
capability and an active editor/reviewer assignment. Existing entity mutations
continue to reauthorize the global write capability, while a draft update
trigger independently requires the database-current editor assignment. An
assignment therefore never grants a missing global capability.

Collaborator add/revoke RPCs require global draft-write capability plus an
active editor assignment. Targets are database-verified current Admin
principals; an editor target must currently be an `admin` or `owner`, while a
reviewer target may have any canonical role. Browser-supplied actor, role, or
capability claims are not accepted.

Add/revoke operations use the draft revision as CAS. A successful operation
advances the workspace revision; a stale request makes no state or audit
change. Request UUID and server-computed digest receipts provide exact replay
and reject changed input under a reused UUID.

## RPC and audit boundary

The service-role-only RPCs are:

- `academy_admin_list_curriculum_draft_collaborators_v1`
- `academy_admin_add_curriculum_draft_collaborator_v1`
- `academy_admin_revoke_curriculum_draft_collaborator_v1`

The existing draft list/read/entity-read RPCs are narrowed to assigned
principals. The collaborator table has forced RLS and no direct application
role grants.

Adds append `curriculum_draft.collaborator.add`; revocations append
`curriculum_draft.collaborator.revoke`. Audit values contain only the stable
principal reference, scoped responsibility in the pre-existing `role` field,
and status. No curriculum payload or private note is copied into audit.

The Studio inspector shows current assignments, empty/unavailable/permission
and stale-conflict states, verified-principal add controls for editors, and a
confirmation before destructive revocation. Reviewers remain visibly
read-only. The migration is repository-only and is not applied to a hosted
environment by this change.

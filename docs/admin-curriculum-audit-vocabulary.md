# Granular curriculum draft audit vocabulary

Status: implemented locally; migration not applied hosted.

Migration `20260809170000_academy_admin_curriculum_audit_vocabulary.sql`
extends the ADMIN-15 append-only ledger for the immediate ADMIN-16B draft
mutation handoff. It does not add draft storage, draft mutation RPCs,
Curriculum Studio UI, validation/preview/diff/approval workflows, publishing,
pointer activation, or rollback.

## Vocabulary

The additive action/resource pairs are exact:

- `curriculum_entity.create` / `curriculum_entity`
- `curriculum_entity.update` / `curriculum_entity`
- `curriculum_entity.tombstone` / `curriculum_entity`
- `curriculum_draft.collaborator.add` / `curriculum_draft`
- `curriculum_draft.collaborator.revoke` / `curriculum_draft`

All ADMIN-15 pairs remain valid. The existing `curriculum_draft` resource is
preserved, and `curriculum_entity` is added only for entity mutations.

## Safe values

Entity event previous/new values are flat objects containing only:

- `entity_ref` and `entity_type`: bounded token-safe identifiers;
- `draft_revision` and `position`: non-negative bounded integers;
- `status`: a bounded token-safe structural state;
- `tombstoned`: a boolean; and
- `digest`: an optional approved lowercase 64-hex digest.

Collaborator events are limited to the token-safe structural identifiers
`collaborator_ref`, `role`, and `status`. Names, email addresses, profile
data, and arbitrary collaborator metadata are not audit values.

Both value families remain flat, nonempty, and at most 2,048 bytes per side.
They reject arrays, nested objects, URLs, credentials, lesson bodies,
assessment prompts, answers or scoring guidance, Tutor routes/content, safety
narrative, raw curriculum payloads, and arbitrary JSON.

## Backward compatibility

The authorization and audit contract version remains 2. The stored event shape,
wire projection, authorization capabilities, pagination cursor, filter shape,
and appender signature are unchanged; only the closed action/resource unions
and their reviewed safe-value grammar are extended.

The original one-argument ADMIN-15 safe-value validator is unchanged. A new
action-aware overload delegates every historical action to that validator and
applies the narrower curriculum rules only to the five new actions. The
`append_admin_audit_event_v1` implementation is safely replaced with the same
signature so existing callers remain source-compatible. It remains ungranted
to `public`, `anon`, `authenticated`, and `service_role`.

ADMIN-16B may call the existing internal appender in the same transaction as an
authorized draft mutation, using only the pairs and minimized values above.

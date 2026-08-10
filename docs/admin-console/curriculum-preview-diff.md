# Curriculum Preview / Diff (ADMIN-19)

Curriculum Preview is a read-only inspection workflow. It does not stage, publish, activate, mutate an active pointer, or persist a preview record.

## Authority

`GET /api/admin/curriculum/drafts/:draftId/preview/:revision` requires `curriculum:read` and binds the response to:

- the draft ID and exact current draft revision;
- the immutable published base release;
- the draft's immutable target-version intent;
- Curriculum Schema Set `2.0.0`; and
- a deterministic SHA-256 candidate fingerprint.

The service reads the authoritative draft before reading entity payloads. If the requested revision is no longer current, it returns a revision conflict and does not reconstruct the request from newer draft data. A loaded client preview keeps its original response and marks it stale when a later freshness read observes another draft revision.

The deterministic `previewRef` and `candidateDigest` provide the seam for later approval and release-staging work to require the exact candidate that a reviewer inspected.

## Materialization and diff

The candidate is composed from the immutable base, draft overrides, and draft-created entities, minus tombstoned entities. Stable `(entity type, entity reference)` identity is the map key, so an override replaces its base entity exactly once.

The server returns the union of base and candidate identities classified as `unchanged`, `added`, `modified`, or `removed`. Summary invariants are:

```text
baseEntities      = unchanged + modified + removed
candidateEntities = unchanged + modified + added
totalCompared     = unchanged + added + modified + removed
```

Field changes are structured, bounded summaries rather than raw JSON. The complete entity classification and summary remain authoritative when field details or UI rows are capped.

## Validation and privacy

Validation is computed from the same materialization and carries the same draft revision. A client adapter refuses to treat validation as current unless its revision, snapshot ID, target version, and Schema Set all match the preview authority.

Schema/system identity, protected assessment interpretations, protected extensions, and media locators are excluded from before/after values. The diff may state that protected metadata changed, but it does not return that metadata. Protected validation findings are reduced to a generic review finding. Learner data, student work, assessment responses, Tutor conversations, private notes, provider data, secrets, and raw server errors are outside the response contract.

No database migration is required; preview is composed from existing authoritative release and draft reads.

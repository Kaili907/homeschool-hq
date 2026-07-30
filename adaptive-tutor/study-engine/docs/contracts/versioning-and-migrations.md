# Versioning and migration guidance

## Strategy

Each persisted aggregate starts at integer `schemaVersion: 1`. The literal is
shared by TypeScript contracts, runtime validators, generated JSON Schemas, and
the migration gate.

Bump the version for:

- a removed or renamed property;
- a new required property;
- a changed discriminant;
- a changed unit;
- a narrower accepted value;
- a changed semantic meaning.

An additive optional property may remain on the same version only when absence
has an explicit, behavior-preserving runtime interpretation. Open-ended data
belongs in namespaced `metadata.extensions`; core properties remain strict.

## Migration requirements

Every future migration must:

1. validate against the source-version schema;
2. make a recoverable snapshot before any persisted write;
3. migrate exactly one version at a time;
4. be pure, non-mutating, deterministic, and idempotent;
5. preserve IDs, revisions, timestamps, and extensions byte-for-byte unless the
   version specification explicitly requires a documented transformation;
6. avoid introducing inferred focus-duration values;
7. keep adult-private data in its separate authorization boundary;
8. validate the result against the destination schema;
9. retain the original record until the migrated record is accepted.

Version 1 has no predecessor. `migrateStudyEngineContractToCurrent()` therefore
validates a current record and returns the same object, or quarantines a missing,
invalid, older, future, unknown-kind, or invalid-current payload. It never
guesses a migration or drops data.

## Future migration template

```ts
function migrateV1ToV2(value: V1Contract): V2Contract {
  return {
    ...value,
    schemaVersion: 2,
    // Add only the documented v2 transformation.
  }
}
```

Register a source validator, migration step, destination validator, valid
before/after fixtures, invalid fixtures, ID-stability assertions, and a backup
test before enabling a persisted migration.

## Identifier rule

Never derive a stable ID from a mutable label, date, array position, or student
name. Legacy IDs such as `p1`, `fracUnit`, and `personal-finance` are opaque and
must not be lowercased, trimmed, prefixed, hashed, or regenerated during
migration.


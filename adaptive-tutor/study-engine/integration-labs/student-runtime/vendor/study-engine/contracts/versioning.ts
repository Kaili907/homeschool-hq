import { STUDY_ENGINE_SCHEMA_VERSION, type StudyEngineSchemaVersion } from './common.ts'

export type ContractVersionInspection =
  | { readonly status: 'current'; readonly schemaVersion: StudyEngineSchemaVersion }
  | { readonly status: 'missing-version' }
  | { readonly status: 'unsupported-older-version'; readonly schemaVersion: number }
  | { readonly status: 'unsupported-future-version'; readonly schemaVersion: number }
  | { readonly status: 'invalid-version' }

/**
 * Read-only version inspection used before selecting a schema or migration.
 * Version 1 is the initial release, so there is intentionally no lossy
 * predecessor migration.
 */
export function inspectContractVersion(value: unknown): ContractVersionInspection {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { status: 'missing-version' }
  }
  const version = (value as Record<string, unknown>).schemaVersion
  if (version === undefined) return { status: 'missing-version' }
  if (!Number.isInteger(version) || typeof version !== 'number' || version < 0) {
    return { status: 'invalid-version' }
  }
  if (version === STUDY_ENGINE_SCHEMA_VERSION) {
    return { status: 'current', schemaVersion: STUDY_ENGINE_SCHEMA_VERSION }
  }
  if (version < STUDY_ENGINE_SCHEMA_VERSION) {
    return { status: 'unsupported-older-version', schemaVersion: version }
  }
  return { status: 'unsupported-future-version', schemaVersion: version }
}


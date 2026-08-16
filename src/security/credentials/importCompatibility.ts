import {
  LEGACY_IMPORT_CREDENTIAL_MIGRATION_NAMESPACE,
  migrateLegacyEducationalCredentials,
  type LegacyCredentialMigrationOptions,
  type LegacyCredentialMigrationResult,
} from './migration'

/**
 * Future import seam: raw legacy PINs are consumed only inside the migration
 * call. The returned educational model is credential-free and the raw import
 * object is never written by this module.
 */
export function sanitizeAndEnrollLegacyImportCredentials(
  importedValue: unknown,
  options?: LegacyCredentialMigrationOptions,
): Promise<LegacyCredentialMigrationResult> {
  return migrateLegacyEducationalCredentials(importedValue, {
    ...options,
    journalNamespace: LEGACY_IMPORT_CREDENTIAL_MIGRATION_NAMESPACE,
  })
}

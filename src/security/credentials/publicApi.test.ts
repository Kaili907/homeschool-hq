import { describe, expect, it } from 'vitest'
import * as CredentialsBarrel from './index'
import { verifyPinVerifier } from './pinVerifier'
import { MemoryCredentialStorage } from './testStorage'

/**
 * Pins the supported application-facing learner credential barrel. Cast
 * through Record<string, unknown> rather than the module's own type so a
 * raw export re-added later is still caught at runtime even though it would
 * no longer type-check against this file's expectations.
 */
const barrel = CredentialsBarrel as Record<string, unknown>
const SUPPORTED_RUNTIME_EXPORTS = [
  'CredentialVaultError',
  'LEGACY_CREDENTIAL_MIGRATION_NAMESPACE',
  'LEGACY_CREDENTIAL_MIGRATION_SCHEMA_VERSION',
  'LEGACY_IMPORT_CREDENTIAL_MIGRATION_NAMESPACE',
  'classifyLegacyPin',
  'deleteLearnerCredential',
  'enrollLearnerPin',
  'markLearnerCredentialResetRequired',
  'migrateLegacyEducationalCredentials',
  'readLegacyCredentialMigrationRecord',
  'readLearnerCredential',
  'rotateLearnerPin',
  'sanitizeAndEnrollLegacyImportCredentials',
  'verifyLearnerPin',
] as const

describe('learner credential barrel', () => {
  it('has exactly the supported application-facing runtime surface', () => {
    expect(Object.keys(barrel).sort()).toEqual([...SUPPORTED_RUNTIME_EXPORTS].sort())
  })

  it('does not expose raw verifier authority over retained stale material', async () => {
    const storage = new MemoryCredentialStorage()
    const retainedOldMaterial = await CredentialsBarrel.enrollLearnerPin('p1', '1111', { storage })

    await CredentialsBarrel.rotateLearnerPin('p1', '1111', '2222', { storage })

    await expect(CredentialsBarrel.verifyLearnerPin('p1', '1111', { storage })).resolves.toBe(false)
    await expect(verifyPinVerifier(retainedOldMaterial.profileId, '1111', retainedOldMaterial)).resolves.toBe(true)
    expect(barrel.verifyPinVerifier).toBeUndefined()
    expect(barrel.createPinVerifier).toBeUndefined()
    expect(barrel.createUnusablePinVerifier).toBeUndefined()
  })
})

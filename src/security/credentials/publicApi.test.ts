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

const EXPECTED_PUBLIC_API = [
  'CredentialVaultError',
  'LEGACY_CREDENTIAL_MIGRATION_NAMESPACE',
  'LEGACY_CREDENTIAL_MIGRATION_SCHEMA_VERSION',
  'LEGACY_IMPORT_CREDENTIAL_MIGRATION_NAMESPACE',
  'classifyLegacyPin',
  'deleteLearnerCredential',
  'enrollLearnerPin',
  'markLearnerCredentialResetRequired',
  'migrateLegacyEducationalCredentials',
  'readLearnerCredential',
  'readLegacyCredentialMigrationRecord',
  'rotateLearnerPin',
  'sanitizeAndEnrollLegacyImportCredentials',
  'verifyLearnerPin',
] as const

describe('learner credential barrel', () => {
  it('exports exactly the supported application-facing API', () => {
    expect(Object.keys(barrel).sort()).toEqual([...EXPECTED_PUBLIC_API])
  })

  it('keeps a retained pre-rotation verifier from becoming a public authenticator', async () => {
    const storage = new MemoryCredentialStorage()
    await CredentialsBarrel.enrollLearnerPin('p1', '1111', { storage })
    const staleMaterial = CredentialsBarrel.readLearnerCredential('p1', { storage })!

    await CredentialsBarrel.rotateLearnerPin('p1', '1111', '2222', { storage })

    await expect(CredentialsBarrel.verifyLearnerPin('p1', '1111', { storage })).resolves.toBe(false)
    await expect(CredentialsBarrel.verifyLearnerPin('p1', '2222', { storage })).resolves.toBe(true)
    await expect(verifyPinVerifier(staleMaterial.profileId, '1111', staleMaterial)).resolves.toBe(true)
    expect(barrel.verifyPinVerifier).toBeUndefined()
  })
})

import { describe, expect, it } from 'vitest'
import { sanitizeAndEnrollLegacyImportCredentials } from './importCompatibility'
import {
  LEGACY_IMPORT_CREDENTIAL_MIGRATION_NAMESPACE,
  classifyLegacyPin,
  migrateLegacyEducationalCredentials,
  readLegacyCredentialMigrationRecord,
  type LegacyMigrationStage,
} from './migration'
import { MemoryCredentialStorage } from './testStorage'
import {
  enrollLearnerPin,
  readLearnerCredential,
  verifyLearnerPin,
} from './vault'

function legacyData(pins: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 2,
    activeProfileId: Object.keys(pins)[0] ?? null,
    parentPin: '9876',
    profiles: Object.fromEntries(
      Object.entries(pins).map(([profileId, pin]) => [
        profileId,
        {
          id: profileId,
          name: `Learner ${profileId}`,
          pin,
          progress: { completedLessons: 3 },
        },
      ]),
    ),
  }
}

describe('legacy learner credential migration', () => {
  it('classifies an empty legacy PIN as unenrolled without creating a credential', async () => {
    const storage = new MemoryCredentialStorage()
    const result = await migrateLegacyEducationalCredentials(legacyData({ p1: '' }), {
      storage,
    })

    expect(classifyLegacyPin('')).toBe('unenrolled')
    expect(result.outcomes).toEqual([
      {
        profileId: 'p1',
        classification: 'unenrolled',
        credentialState: 'none',
        resumed: false,
      },
    ])
    expect(readLearnerCredential('p1', { storage })).toBeNull()
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('complete')
  })

  it('migrates an exact four-digit PIN and returns credential-free educational data', async () => {
    const storage = new MemoryCredentialStorage()
    const result = await migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
      storage,
    })

    expect(result.outcomes[0]).toMatchObject({
      classification: 'migratable',
      credentialState: 'enrolled',
    })
    await expect(verifyLearnerPin('p1', '1234', { storage })).resolves.toBe(true)
    expect(JSON.stringify(result.educationalData)).not.toContain('1234')
    expect(JSON.stringify(result.educationalData)).not.toContain('9876')
    expect(storage.entries().map(([, value]) => value).join('\n')).not.toContain('"1234"')
  })

  it.each([null, undefined, '123', '12x4', ' 1234', 1234])(
    'classifies malformed legacy PIN %s as reset-required',
    async (pin) => {
      const storage = new MemoryCredentialStorage()
      const result = await migrateLegacyEducationalCredentials(legacyData({ p1: pin }), {
        storage,
      })

      expect(result.outcomes[0]).toMatchObject({
        classification: 'reset-required',
        credentialState: 'reset-required',
      })
      expect(readLearnerCredential('p1', { storage })?.state).toBe('reset-required')
      await expect(verifyLearnerPin('p1', '0000', { storage })).resolves.toBe(false)
    },
  )

  it.each<LegacyMigrationStage>([
    'classified',
    'credential-persisted',
    'verifier-verified',
    'educational-data-sanitized',
  ])('safely resumes after interruption at %s', async (interruptedStage) => {
    const storage = new MemoryCredentialStorage()
    let interrupted = false
    await expect(
      migrateLegacyEducationalCredentials(legacyData({ p1: '4321' }), {
        storage,
        afterStage: (_profileId, stage) => {
          if (!interrupted && stage === interruptedStage) {
            interrupted = true
            throw new Error(`simulated crash after ${stage}`)
          }
        },
      }),
    ).rejects.toThrow(/simulated crash/)

    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe(
      interruptedStage,
    )
    const resumed = await migrateLegacyEducationalCredentials(legacyData({ p1: '4321' }), {
      storage,
    })
    expect(resumed.outcomes[0].resumed).toBe(true)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('complete')
    await expect(verifyLearnerPin('p1', '4321', { storage })).resolves.toBe(true)
  })

  it('handles multiple profile classifications independently', async () => {
    const storage = new MemoryCredentialStorage()
    const result = await migrateLegacyEducationalCredentials(
      legacyData({ p1: '1111', p2: '', p3: 'bad' }),
      { storage },
    )

    expect(result.outcomes.map(({ profileId, classification, credentialState }) => ({
      profileId,
      classification,
      credentialState,
    }))).toEqual([
      { profileId: 'p1', classification: 'migratable', credentialState: 'enrolled' },
      { profileId: 'p2', classification: 'unenrolled', credentialState: 'none' },
      { profileId: 'p3', classification: 'reset-required', credentialState: 'reset-required' },
    ])
    await expect(verifyLearnerPin('p1', '1111', { storage })).resolves.toBe(true)
    expect(readLearnerCredential('p2', { storage })).toBeNull()
    expect(readLearnerCredential('p3', { storage })?.state).toBe('reset-required')
    expect(JSON.stringify(result.educationalData)).not.toMatch(/"(?:pin|parentPin)"/)
  })

  it('fails closed to re-enrollment when a partial verifier conflicts with the legacy PIN', async () => {
    const storage = new MemoryCredentialStorage()
    await enrollLearnerPin('p1', '1111', { storage })

    const result = await migrateLegacyEducationalCredentials(legacyData({ p1: '2222' }), {
      storage,
    })
    expect(result.outcomes[0].credentialState).toBe('reset-required')
    await expect(verifyLearnerPin('p1', '1111', { storage })).resolves.toBe(false)
    await expect(verifyLearnerPin('p1', '2222', { storage })).resolves.toBe(false)
  })

  it('sanitizes legacy imports while consuming PINs only for device-local enrollment', async () => {
    const storage = new MemoryCredentialStorage()
    const result = await sanitizeAndEnrollLegacyImportCredentials(
      legacyData({ p1: '2468' }),
      { storage },
    )

    await expect(verifyLearnerPin('p1', '2468', { storage })).resolves.toBe(true)
    expect(JSON.stringify(result.educationalData)).not.toContain('2468')
    expect(JSON.stringify(result.educationalData)).not.toContain('9876')
    expect(
      readLegacyCredentialMigrationRecord('p1', {
        storage,
        journalNamespace: LEGACY_IMPORT_CREDENTIAL_MIGRATION_NAMESPACE,
      })?.stage,
    ).toBe('complete')
    expect(storage.entries().map(([, value]) => value).join('\n')).not.toContain('"2468"')
  })
})

import { describe, expect, it } from 'vitest'
import { sanitizeCredentialFreeEducationalData } from '../appData'
import { sanitizeAndEnrollLegacyImportCredentials } from './importCompatibility'
import {
  LEGACY_IMPORT_CREDENTIAL_MIGRATION_NAMESPACE,
  classifyLegacyPin,
  migrateLegacyEducationalCredentials,
  readLegacyCredentialMigrationRecord,
  type DurableEducationalDataPersistence,
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

function durableEducationalDataPersistence(): DurableEducationalDataPersistence {
  let durableValue: unknown
  return {
    write: (value) => {
      durableValue = JSON.parse(JSON.stringify(value)) as unknown
    },
    read: () => JSON.parse(JSON.stringify(durableValue)) as unknown,
  }
}

describe('legacy learner credential migration', () => {
  it('classifies an empty legacy PIN as unenrolled without creating a credential', async () => {
    const storage = new MemoryCredentialStorage()
    const result = await migrateLegacyEducationalCredentials(legacyData({ p1: '' }), {
      storage,
      educationalDataPersistence: durableEducationalDataPersistence(),
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
      educationalDataPersistence: durableEducationalDataPersistence(),
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
        educationalDataPersistence: durableEducationalDataPersistence(),
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
    const persistence = durableEducationalDataPersistence()
    let interrupted = false
    await expect(
      migrateLegacyEducationalCredentials(legacyData({ p1: '4321' }), {
        storage,
        educationalDataPersistence: persistence,
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
      educationalDataPersistence: persistence,
    })
    expect(resumed.outcomes[0].resumed).toBe(true)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('complete')
    await expect(verifyLearnerPin('p1', '4321', { storage })).resolves.toBe(true)
  })

  it('does not write educational data when interrupted before durable persistence', async () => {
    const storage = new MemoryCredentialStorage()
    const persistence = durableEducationalDataPersistence()
    let writes = 0

    await expect(
      migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
        storage,
        educationalDataPersistence: {
          write: (value) => {
            writes += 1
            return persistence.write(value)
          },
          read: () => persistence.read(),
        },
        afterStage: (_profileId, stage) => {
          if (stage === 'verifier-verified') throw new Error('crash before durable write')
        },
      }),
    ).rejects.toThrow(/crash before durable write/)

    expect(writes).toBe(0)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('verifier-verified')
    await expect(verifyLearnerPin('p1', '1234', { storage })).resolves.toBe(true)
  })

  it('remains retryable when the durable educational-data write fails', async () => {
    const storage = new MemoryCredentialStorage()
    let writeAttempts = 0
    let durableValue: unknown
    const persistence: DurableEducationalDataPersistence = {
      write: (value) => {
        writeAttempts += 1
        if (writeAttempts === 1) throw new Error('crash during durable write')
        durableValue = JSON.parse(JSON.stringify(value)) as unknown
      },
      read: () => JSON.parse(JSON.stringify(durableValue)) as unknown,
    }

    await expect(
      migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
        storage,
        educationalDataPersistence: persistence,
      }),
    ).rejects.toThrow(/crash during durable write/)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('verifier-verified')
    await expect(verifyLearnerPin('p1', '1234', { storage })).resolves.toBe(true)

    await expect(
      migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
        storage,
        educationalDataPersistence: persistence,
      }),
    ).resolves.toMatchObject({ outcomes: [{ credentialState: 'enrolled' }] })
    expect(JSON.stringify(durableValue)).not.toMatch(/1234|9876/)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('complete')
  })

  it('does not advance after a durable write when read-back crashes', async () => {
    const storage = new MemoryCredentialStorage()
    let durableValue: unknown
    let failRead = true
    const persistence: DurableEducationalDataPersistence = {
      write: (value) => {
        durableValue = JSON.parse(JSON.stringify(value)) as unknown
      },
      read: () => {
        if (failRead) throw new Error('crash before durable read-back')
        return JSON.parse(JSON.stringify(durableValue)) as unknown
      },
    }

    await expect(
      migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
        storage,
        educationalDataPersistence: persistence,
      }),
    ).rejects.toThrow(/crash before durable read-back/)
    expect(JSON.stringify(durableValue)).not.toMatch(/1234|9876/)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('verifier-verified')

    failRead = false
    await migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
      storage,
      educationalDataPersistence: persistence,
    })
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('complete')
  })

  it('rejects mismatched or credential-bearing durable read-back', async () => {
    const storage = new MemoryCredentialStorage()
    let durableValue: unknown
    const persistence: DurableEducationalDataPersistence = {
      write: (value) => {
        durableValue = JSON.parse(JSON.stringify(value)) as unknown
      },
      read: () => ({
        ...(durableValue as Record<string, unknown>),
        parentPin: '9876',
      }),
    }

    await expect(
      migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
        storage,
        educationalDataPersistence: persistence,
      }),
    ).rejects.toThrow(/exact credential-free read-back verification/)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('verifier-verified')
    await expect(verifyLearnerPin('p1', '1234', { storage })).resolves.toBe(true)
  })

  it('rejects read-back changed by a persistence writer mutating its input', async () => {
    const storage = new MemoryCredentialStorage()
    const source = { ...legacyData({ p1: '1234' }), progress: 1 }
    let durableValue: unknown
    const persistence: DurableEducationalDataPersistence = {
      write: (value) => {
        ;(value as Record<string, unknown>).progress = 999
        durableValue = value
      },
      read: () => durableValue,
    }

    await expect(
      migrateLegacyEducationalCredentials(source, {
        storage,
        educationalDataPersistence: persistence,
      }),
    ).rejects.toThrow(/exact credential-free read-back verification/)
    expect(source.progress).toBe(1)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe(
      'verifier-verified',
    )
  })

  it('rejects nested object and array mutations made by the persistence writer', async () => {
    const storage = new MemoryCredentialStorage()
    const source = {
      ...legacyData({ p1: '1234' }),
      learning: { milestones: [{ progress: 1 }, { progress: 2 }] },
    }
    let durableValue: unknown
    const persistence: DurableEducationalDataPersistence = {
      write: (value) => {
        const milestones = (
          (value as Record<string, unknown>).learning as {
            milestones: Array<{ progress: number }>
          }
        ).milestones
        milestones[0].progress = 999
        milestones.push({ progress: 1000 })
        durableValue = value
      },
      read: () => durableValue,
    }

    await expect(
      migrateLegacyEducationalCredentials(source, {
        storage,
        educationalDataPersistence: persistence,
      }),
    ).rejects.toThrow(/exact credential-free read-back verification/)
    expect(source.learning.milestones).toEqual([{ progress: 1 }, { progress: 2 }])
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe(
      'verifier-verified',
    )
  })

  it('detaches the writer value from the migration source and expected snapshot', async () => {
    const storage = new MemoryCredentialStorage()
    const source = {
      ...legacyData({ p1: '1234' }),
      learning: { milestones: [{ progress: 1 }] },
    }
    const pristineReadBack = sanitizeCredentialFreeEducationalData(source)
    let writerValue: unknown
    const result = await migrateLegacyEducationalCredentials(source, {
      storage,
      educationalDataPersistence: {
        write: (value) => {
          writerValue = value
          ;(
            (value as Record<string, unknown>).learning as {
              milestones: Array<{ progress: number }>
            }
          ).milestones[0].progress = 999
        },
        read: () => JSON.parse(JSON.stringify(pristineReadBack)) as unknown,
      },
    })

    expect(writerValue).not.toBe(result.educationalData)
    expect(result.educationalData).toEqual(pristineReadBack)
    expect(source.learning.milestones[0].progress).toBe(1)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('complete')
  })

  it('recovers when exact read-back succeeds but the next journal write fails', async () => {
    const durableStorage = new MemoryCredentialStorage()
    let failSanitizedJournalWrite = true
    const storage = {
      getItem: (key: string) => durableStorage.getItem(key),
      setItem: (key: string, value: string) => {
        const record = JSON.parse(value) as { stage?: string }
        if (
          failSanitizedJournalWrite &&
          record.stage === 'educational-data-sanitized'
        ) {
          failSanitizedJournalWrite = false
          throw new Error('crash writing verified-read journal stage')
        }
        durableStorage.setItem(key, value)
      },
      removeItem: (key: string) => durableStorage.removeItem(key),
    }
    const persistence = durableEducationalDataPersistence()

    await expect(
      migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
        storage,
        educationalDataPersistence: persistence,
      }),
    ).rejects.toThrow(/crash writing verified-read journal stage/)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe(
      'verifier-verified',
    )
    await expect(verifyLearnerPin('p1', '1234', { storage })).resolves.toBe(true)
    expect(durableStorage.entries().map(([, value]) => value).join('\n')).not.toContain(
      '"1234"',
    )

    const retried = await migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
      storage,
      educationalDataPersistence: persistence,
    })
    expect(retried.outcomes[0]).toMatchObject({ resumed: true, credentialState: 'enrolled' })
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('complete')
    await expect(verifyLearnerPin('p1', '1234', { storage })).resolves.toBe(true)
    expect(durableStorage.entries().map(([, value]) => value).join('\n')).not.toContain(
      '"1234"',
    )
  })

  it('requires durable persistence and resumes after verified state precedes completion', async () => {
    const storage = new MemoryCredentialStorage()
    await expect(
      migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
        storage,
      }),
    ).rejects.toThrow(/persistence and read-back are required/)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('verifier-verified')

    const persistence = durableEducationalDataPersistence()
    let interrupted = false
    await expect(
      migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
        storage,
        educationalDataPersistence: persistence,
        afterStage: (_profileId, stage) => {
          if (!interrupted && stage === 'educational-data-sanitized') {
            interrupted = true
            throw new Error('crash before journal completion')
          }
        },
      }),
    ).rejects.toThrow(/crash before journal completion/)
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe(
      'educational-data-sanitized',
    )

    await migrateLegacyEducationalCredentials(legacyData({ p1: '1234' }), {
      storage,
      educationalDataPersistence: persistence,
    })
    expect(readLegacyCredentialMigrationRecord('p1', { storage })?.stage).toBe('complete')
  })

  it('handles multiple profile classifications independently', async () => {
    const storage = new MemoryCredentialStorage()
    const result = await migrateLegacyEducationalCredentials(
      legacyData({ p1: '1111', p2: '', p3: 'bad' }),
      { storage, educationalDataPersistence: durableEducationalDataPersistence() },
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
      educationalDataPersistence: durableEducationalDataPersistence(),
    })
    expect(result.outcomes[0].credentialState).toBe('reset-required')
    await expect(verifyLearnerPin('p1', '1111', { storage })).resolves.toBe(false)
    await expect(verifyLearnerPin('p1', '2222', { storage })).resolves.toBe(false)
  })

  it('sanitizes legacy imports while consuming PINs only for device-local enrollment', async () => {
    const storage = new MemoryCredentialStorage()
    const result = await sanitizeAndEnrollLegacyImportCredentials(
      legacyData({ p1: '2468' }),
      { storage, educationalDataPersistence: durableEducationalDataPersistence() },
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

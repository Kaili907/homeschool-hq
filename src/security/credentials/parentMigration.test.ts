import { describe, expect, it } from 'vitest'
import {
  CredentialSanitizationError,
  type CredentialFreeJsonValue,
} from '../appData'
import type { InstallationBinding } from '../contracts'
import {
  LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE,
  migrateLegacyParentCredential,
  readLegacyParentCredentialMigrationRecord,
  type DurableParentMigrationPersistence,
  type LegacyParentMigrationStage,
} from './parentMigration'
import {
  markParentCredentialResetRequiredAuthorized,
  parentCredentialStorageKey,
  readParentCredentialRecord,
  rotateParentPinAuthorized,
  verifyParentPin,
  type ParentCredentialLockManager,
} from './parentVault'
import { MemoryCredentialStorage } from './testStorage'
import {
  enrollLearnerPin,
  learnerCredentialStorageKey,
  readLearnerCredential,
  verifyLearnerPin,
} from './vault'

const INSTALLATION_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const INSTALLATION_B = 'b3d48c11-53bb-4d8f-bb8b-d2f311abf5ef'
const NOW = '2026-08-11T12:00:00.000Z'

function installationBinding(
  installationId = INSTALLATION_A,
  householdId = 'household-a',
): InstallationBinding {
  return {
    schemaVersion: 1,
    bindingId: `binding:${installationId}:${householdId}`,
    installationId: installationId as InstallationBinding['installationId'],
    householdId,
    datasetEpoch: `epoch:${householdId}`,
    verifiedActorId: `actor:${householdId}`,
    status: 'active',
    boundAt: NOW,
  }
}

function legacyState(parentPin: unknown = '2468'): Record<string, unknown> {
  return {
    schemaVersion: 2,
    activeProfileId: 'p1',
    parentPin,
    profiles: {
      p1: {
        id: 'p1',
        name: 'Synthetic Learner',
        progress: { completedLessons: 3 },
      },
    },
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

class ImmediateLockManager implements ParentCredentialLockManager {
  async request<T>(
    _name: string,
    _options: { readonly mode: 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T> {
    return callback()
  }
}

const lockManager = new ImmediateLockManager()

class DurableHarness implements DurableParentMigrationPersistence {
  value: unknown
  writes = 0
  reads = 0
  failNextRead = false

  constructor(initialValue: unknown) {
    this.value = initialValue
  }

  writeIfUnchanged(
    expectedRawData: unknown,
    value: CredentialFreeJsonValue,
  ): boolean {
    this.writes += 1
    if (JSON.stringify(this.value) !== JSON.stringify(expectedRawData)) return false
    this.value = clone(value)
    return true
  }

  read(): unknown {
    this.reads += 1
    if (this.failNextRead) {
      this.failNextRead = false
      throw new Error('simulated crash after sanitized write')
    }
    return clone(this.value)
  }

  snapshot(): unknown {
    return clone(this.value)
  }
}

function fixedOptions(
  storage: MemoryCredentialStorage,
  persistence: DurableParentMigrationPersistence,
  afterStage?: (stage: LegacyParentMigrationStage) => void | Promise<void>,
) {
  return {
    storage,
    lockManager,
    educationalDataPersistence: persistence,
    now: () => new Date(NOW),
    ...(afterStage ? { afterStage } : {}),
  }
}

function journalRaw(storage: MemoryCredentialStorage): string | null {
  return storage.entries().find(([key]) =>
    key.startsWith(`${LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE}:`),
  )?.[1] ?? null
}

describe('exact root Parent credential migration', () => {
  it('migrates only the exact root PIN, persists credential-free data, and does not mutate input', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    const pristine = clone(source)

    const result = await migrateLegacyParentCredential(
      source,
      binding,
      fixedOptions(storage, persistence),
    )

    expect(result.outcome).toEqual({
      classification: 'migratable',
      credentialState: 'enrolled',
      resumed: false,
    })
    expect(result.educationalData).not.toHaveProperty('parentPin')
    expect(persistence.snapshot()).toEqual(result.educationalData)
    expect(source).toEqual(pristine)
    await expect(verifyParentPin(binding, '2468', { storage })).resolves.toMatchObject({
      status: 'verified',
    })
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('complete')

    const credentialRaw = storage.getItem(parentCredentialStorageKey(binding))
    expect(credentialRaw).not.toBeNull()
    expect(credentialRaw).not.toContain('"2468"')
    expect(journalRaw(storage)).not.toContain('"2468"')
    expect(JSON.stringify(result)).not.toContain('2468')
  })

  it('rejects a nested parentPin before any journal, vault, or educational write', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = {
      ...legacyState('2468'),
      lesson: { parentPin: '9999' },
    }
    const persistence = new DurableHarness(source)

    await expect(
      migrateLegacyParentCredential(
        source,
        binding,
        fixedOptions(storage, persistence),
      ),
    ).rejects.toBeInstanceOf(CredentialSanitizationError)
    expect(storage.entries()).toEqual([])
    expect(persistence.writes).toBe(0)
  })

  it('rejects executable legacy credential values without invoking them or writing', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    let calls = 0
    const source = legacyState({
      toJSON: () => {
        calls += 1
        return '2468'
      },
    })
    const persistence = new DurableHarness(source)

    await expect(
      migrateLegacyParentCredential(
        source,
        binding,
        fixedOptions(storage, persistence),
      ),
    ).rejects.toBeInstanceOf(CredentialSanitizationError)
    expect(calls).toBe(0)
    expect(storage.entries()).toEqual([])
    expect(persistence.writes).toBe(0)
  })

  it('preflights partially present learner PIN fields before Parent vault or journal writes', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const profiles = source.profiles as Record<string, Record<string, unknown>>
    profiles.p1.pin = '1357'
    profiles.p2 = { id: 'p2', name: 'Second learner' }
    const persistence = new DurableHarness(source)

    await expect(
      migrateLegacyParentCredential(
        source,
        binding,
        fixedOptions(storage, persistence),
      ),
    ).rejects.toThrow(/partially present/)
    expect(storage.entries()).toEqual([])
    expect(persistence.writes).toBe(0)
  })

  it('is idempotent after completion and preserves exact credential and journal bytes', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    const first = await migrateLegacyParentCredential(
      source,
      binding,
      fixedOptions(storage, persistence),
    )
    const credentialBefore = storage.getItem(parentCredentialStorageKey(binding))
    const journalBefore = journalRaw(storage)

    const second = await migrateLegacyParentCredential(
      clone(first.educationalData),
      binding,
      fixedOptions(storage, persistence),
    )

    expect(second.outcome).toEqual({
      classification: 'migratable',
      credentialState: 'enrolled',
      resumed: true,
    })
    expect(storage.getItem(parentCredentialStorageKey(binding))).toBe(credentialBefore)
    expect(journalRaw(storage)).toBe(journalBefore)
    await expect(verifyParentPin(binding, '2468', { storage })).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it('treats completion as historical across normal data changes and authorized rotation/reset', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    await migrateLegacyParentCredential(source, binding, fixedOptions(storage, persistence))

    await rotateParentPinAuthorized(
      binding,
      '8642',
      { consumeParentCredentialRotationAuthorization: () => true },
      { storage, lockManager, now: () => new Date(NOW) },
    )
    const changed = persistence.snapshot() as Record<string, unknown>
    changed.activeProfileId = null
    persistence.value = clone(changed)
    const writesAfterChange = persistence.writes

    const afterRotation = await migrateLegacyParentCredential(
      changed,
      binding,
      fixedOptions(storage, persistence),
    )
    expect(afterRotation.outcome).toMatchObject({
      classification: 'migratable',
      credentialState: 'enrolled',
      resumed: true,
    })
    expect(persistence.writes).toBe(writesAfterChange)
    await expect(verifyParentPin(binding, '8642', { storage })).resolves.toMatchObject({
      status: 'verified',
    })

    await markParentCredentialResetRequiredAuthorized(
      binding,
      { consumeParentCredentialResetAuthorization: () => true },
      { storage, lockManager, now: () => new Date(NOW) },
    )
    const afterReset = await migrateLegacyParentCredential(
      changed,
      binding,
      fixedOptions(storage, persistence),
    )
    expect(afterReset.outcome).toMatchObject({
      classification: 'migratable',
      credentialState: 'reset-required',
      resumed: true,
    })
    expect(persistence.writes).toBe(writesAfterChange)
  })
})

describe('Parent migration crash and retry ordering', () => {
  it('coordinates Parent and learner verifiers across a crash before the single CAS publication', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const learner = (source.profiles as Record<string, Record<string, unknown>>).p1
    learner.pin = '1357'
    const persistence = new DurableHarness(source)
    let crashed = false

    await expect(
      migrateLegacyParentCredential(
        source,
        binding,
        fixedOptions(storage, persistence, (stage) => {
          if (!crashed && stage === 'verifier-verified') {
            crashed = true
            throw new Error('simulated crash before coordinated publication')
          }
        }),
      ),
    ).rejects.toThrow(/before coordinated publication/)

    const parentCredentialBefore = storage.getItem(parentCredentialStorageKey(binding))
    const learnerCredentialBefore = storage.getItem(learnerCredentialStorageKey('p1'))
    expect(parentCredentialBefore).not.toBeNull()
    expect(learnerCredentialBefore).not.toBeNull()
    expect(persistence.writes).toBe(0)
    expect(persistence.snapshot()).toEqual(source)

    const resumed = await migrateLegacyParentCredential(
      source,
      binding,
      fixedOptions(storage, persistence),
    )

    expect(resumed.outcome).toMatchObject({ credentialState: 'enrolled', resumed: true })
    expect(resumed.educationalData).not.toHaveProperty('parentPin')
    expect(resumed.educationalData).not.toHaveProperty('profiles.p1.pin')
    expect(persistence.writes).toBe(1)
    expect(storage.getItem(parentCredentialStorageKey(binding))).toBe(parentCredentialBefore)
    expect(storage.getItem(learnerCredentialStorageKey('p1'))).toBe(learnerCredentialBefore)
    await expect(verifyParentPin(binding, '2468', { storage })).resolves.toMatchObject({
      status: 'verified',
    })
    await expect(verifyLearnerPin('p1', '1357', { storage })).resolves.toBe(true)
  })

  it('resumes after CAS when a conflicting learner verifier became reset-required', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    await enrollLearnerPin('p1', '1111', { storage })
    const source = legacyState('2468')
    ;(source.profiles as Record<string, Record<string, unknown>>).p1.pin = '2222'
    const persistence = new DurableHarness(source)
    persistence.failNextRead = true

    await expect(
      migrateLegacyParentCredential(
        source,
        binding,
        fixedOptions(storage, persistence),
      ),
    ).rejects.toThrow(/after sanitized write/)

    expect(readLearnerCredential('p1', { storage })?.state).toBe('reset-required')
    const durableAfterCrash = persistence.snapshot()
    await expect(
      migrateLegacyParentCredential(
        durableAfterCrash,
        binding,
        fixedOptions(storage, persistence),
      ),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('complete')
    expect(readLearnerCredential('p1', { storage })?.state).toBe('reset-required')
    await expect(verifyLearnerPin('p1', '1111', { storage })).resolves.toBe(false)
    await expect(verifyLearnerPin('p1', '2222', { storage })).resolves.toBe(false)
  })

  it('retries safely after a crash before verifier persistence', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    let crashed = false

    await expect(
      migrateLegacyParentCredential(
        source,
        binding,
        fixedOptions(storage, persistence, (stage) => {
          if (!crashed && stage === 'classified') {
            crashed = true
            throw new Error('simulated crash before verifier persistence')
          }
        }),
      ),
    ).rejects.toThrow(/before verifier persistence/)

    expect(readParentCredentialRecord(binding, { storage })).toBeNull()
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('classified')
    expect(persistence.writes).toBe(0)

    await expect(
      migrateLegacyParentCredential(
        source,
        binding,
        fixedOptions(storage, persistence),
      ),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
  })

  it('reuses identical credential bytes after a crash following credential persistence', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    let crashed = false

    await expect(
      migrateLegacyParentCredential(
        source,
        binding,
        fixedOptions(storage, persistence, (stage) => {
          if (!crashed && stage === 'credential-persisted') {
            crashed = true
            throw new Error('simulated crash after credential persistence')
          }
        }),
      ),
    ).rejects.toThrow(/after credential persistence/)

    const credentialBefore = storage.getItem(parentCredentialStorageKey(binding))
    expect(credentialBefore).not.toBeNull()
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe(
      'credential-persisted',
    )
    expect(persistence.writes).toBe(0)

    await migrateLegacyParentCredential(
      source,
      binding,
      fixedOptions(storage, persistence),
    )
    expect(storage.getItem(parentCredentialStorageKey(binding))).toBe(credentialBefore)
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('complete')
  })

  it('restarts from missing parentPin after the sanitized write already became durable', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    persistence.failNextRead = true

    await expect(
      migrateLegacyParentCredential(
        source,
        binding,
        fixedOptions(storage, persistence),
      ),
    ).rejects.toThrow(/after sanitized write/)

    const durableAfterCrash = persistence.snapshot()
    expect(durableAfterCrash).not.toHaveProperty('parentPin')
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe(
      'verifier-verified',
    )

    const resumed = await migrateLegacyParentCredential(
      durableAfterCrash,
      binding,
      fixedOptions(storage, persistence),
    )
    expect(resumed.outcome).toEqual({
      classification: 'migratable',
      credentialState: 'enrolled',
      resumed: true,
    })
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('complete')
    await expect(verifyParentPin(binding, '2468', { storage })).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it('rejects credential or educational-data tampering on a no-plaintext retry', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    persistence.failNextRead = true

    await expect(
      migrateLegacyParentCredential(source, binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/after sanitized write/)
    const durableAfterCrash = persistence.snapshot() as Record<string, unknown>
    const key = parentCredentialStorageKey(binding)
    const originalCredential = storage.getItem(key)!
    const tampered = JSON.parse(originalCredential) as Record<string, unknown>
    const verifier = tampered.verifierBase64 as string
    tampered.verifierBase64 = `${verifier[0] === 'A' ? 'B' : 'A'}${verifier.slice(1)}`
    storage.setItem(key, JSON.stringify(tampered))

    await expect(
      migrateLegacyParentCredential(
        durableAfterCrash,
        binding,
        fixedOptions(storage, persistence),
      ),
    ).rejects.toThrow(/Verified credential set changed/)

    storage.setItem(key, originalCredential)
    const changedData = clone(durableAfterCrash)
    changedData.activeProfileId = null
    persistence.value = clone(changedData)
    await expect(
      migrateLegacyParentCredential(
        changedData,
        binding,
        fixedOptions(storage, persistence),
      ),
    ).rejects.toThrow(/educational data changed/)
  })
})

describe('Parent migration fail-closed outcomes', () => {
  it.each([
    {
      label: 'mismatched educational data',
      readBack: (value: unknown) => ({
        ...(value as Record<string, unknown>),
        activeProfileId: null,
      }),
    },
    {
      label: 'reintroduced root parentPin',
      readBack: (value: unknown) => ({
        ...(value as Record<string, unknown>),
        parentPin: '9999',
      }),
    },
  ])('rejects $label during durable readback', async ({ readBack }) => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    let durableValue: unknown = clone(source)
    const persistence: DurableParentMigrationPersistence = {
      writeIfUnchanged: (expectedRawData, value) => {
        if (JSON.stringify(durableValue) !== JSON.stringify(expectedRawData)) return false
        durableValue = clone(value)
        return true
      },
      read: () => readBack(clone(durableValue)),
    }

    await expect(
      migrateLegacyParentCredential(
        source,
        binding,
        fixedOptions(storage, persistence),
      ),
    ).rejects.toThrow(/exact credential-free read-back verification/)
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe(
      'verifier-verified',
    )
  })

  it('returns parent-setup-required for a fresh installation without enrolling a credential', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState()
    delete source.parentPin
    const persistence = new DurableHarness(source)

    const result = await migrateLegacyParentCredential(
      source,
      binding,
      fixedOptions(storage, persistence),
    )

    expect(result.outcome).toEqual({
      classification: 'parent-setup-required',
      credentialState: 'parent-setup-required',
      resumed: false,
    })
    expect(readParentCredentialRecord(binding, { storage })).toBeNull()
    await expect(verifyParentPin(binding, '2468', { storage })).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
  })

  it('converts a malformed legacy PIN into a bound reset-required tombstone', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('12x4')
    const persistence = new DurableHarness(source)
    const pristine = clone(source)

    const result = await migrateLegacyParentCredential(
      source,
      binding,
      fixedOptions(storage, persistence),
    )

    expect(result.outcome).toEqual({
      classification: 'reset-required',
      credentialState: 'reset-required',
      resumed: false,
    })
    expect(readParentCredentialRecord(binding, { storage })?.state).toBe('reset-required')
    await expect(verifyParentPin(binding, '0000', { storage })).resolves.toMatchObject({
      status: 'reset-required',
    })
    expect(source).toEqual(pristine)
    expect(persistence.snapshot()).not.toHaveProperty('parentPin')
    expect(storage.entries().map(([, value]) => value).join('\n')).not.toContain('"12x4"')
  })

  it('does not resume another installation or household verifier from credential-free state', async () => {
    const bindingA = installationBinding(INSTALLATION_A, 'household-a')
    const bindingB = installationBinding(INSTALLATION_B, 'household-b')
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    persistence.failNextRead = true

    await expect(
      migrateLegacyParentCredential(
        source,
        bindingA,
        fixedOptions(storage, persistence),
      ),
    ).rejects.toThrow(/after sanitized write/)
    const credentialFreeState = persistence.snapshot()

    const wrongBinding = await migrateLegacyParentCredential(
      credentialFreeState,
      bindingB,
      fixedOptions(storage, persistence),
    )

    expect(wrongBinding.outcome).toEqual({
      classification: 'parent-setup-required',
      credentialState: 'parent-setup-required',
      resumed: false,
    })
    expect(readParentCredentialRecord(bindingB, { storage })).toBeNull()
    await expect(verifyParentPin(bindingB, '2468', { storage })).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
    await expect(verifyParentPin(bindingA, '2468', { storage })).resolves.toMatchObject({
      status: 'verified',
    })
  })
})

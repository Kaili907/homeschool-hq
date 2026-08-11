import { describe, expect, it } from 'vitest'
import {
  CredentialSanitizationError,
  sanitizeCredentialFreeEducationalData,
  type CredentialFreeJsonValue,
} from '../appData'
import type { InstallationBinding } from '../contracts'
import {
  LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE,
  migrateLegacyParentCredential,
  readLegacyParentCredentialMigrationRecord,
  type DurableParentMigrationPersistence,
  type DurableParentMigrationSnapshot,
  type LegacyParentMigrationStage,
} from './parentMigration'
import {
  markParentCredentialResetRequiredAuthorized,
  parentCredentialBindingReference,
  parentCredentialStorageKey,
  rotateParentPinAuthorized,
  verifyParentPin,
  type ParentCredentialLockManager,
  type ParentCredentialOperationOptions,
} from './parentVault'
import { readParentCredentialRecord } from './parentVault.internal'
import {
  MemoryCredentialStorage,
  MemoryParentCredentialGenerationAuthority,
} from './testStorage'
import {
  enrollLearnerPin,
  learnerCredentialStorageKey,
  readLearnerCredential,
  verifyLearnerPin,
} from './vault'
import { bytesToBase64 } from './pinVerifier'

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

function snapshotClone<T>(value: T, seen = new WeakMap<object, object>()): T {
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) {
    return value
  }
  if (typeof value === 'function') return value
  const existing = seen.get(value)
  if (existing) return existing as T
  const copy: object = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value)) as object
  seen.set(value, copy)
  for (const key of Reflect.ownKeys(value)) {
    if (Array.isArray(value) && key === 'length') continue
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!
    Object.defineProperty(copy, key, 'value' in descriptor
      ? { ...descriptor, value: snapshotClone(descriptor.value, seen) }
      : descriptor)
  }
  return copy as T
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

const generationAuthorities = new WeakMap<
  MemoryCredentialStorage,
  MemoryParentCredentialGenerationAuthority
>()

function generationAuthorityFor(
  storage: MemoryCredentialStorage,
): MemoryParentCredentialGenerationAuthority {
  let authority = generationAuthorities.get(storage)
  if (!authority) {
    authority = new MemoryParentCredentialGenerationAuthority()
    generationAuthorities.set(storage, authority)
  }
  return authority
}

function parentOptions(storage: MemoryCredentialStorage): ParentCredentialOperationOptions {
  return {
    storage,
    generationAuthority: generationAuthorityFor(storage),
    lockManager,
    now: () => new Date(NOW),
  }
}

class DurableHarness implements DurableParentMigrationPersistence {
  private durable: DurableParentMigrationSnapshot
  private revision = 0
  writes = 0
  reads = 0
  commitLocks = 0
  failNextRead = false
  private failReadAfterWrite = false

  constructor(initialValue: unknown) {
    this.durable = durableSnapshot(initialValue)
  }

  get value(): unknown {
    return snapshotClone(this.durable.educationalData)
  }

  set value(value: unknown) {
    this.revision += 1
    this.durable = {
      ...this.durable,
      educationalData: snapshotClone(value),
      revision: `revision-${this.revision}`,
    }
  }

  writeIfUnchanged(
    expectedSnapshot: DurableParentMigrationSnapshot,
    value: CredentialFreeJsonValue,
    migrationReceiptBase64: string,
    migrationPreparationCommitmentBase64: string,
  ): boolean {
    this.writes += 1
    if (!durableSnapshotsEqual(this.durable, expectedSnapshot)) return false
    this.revision += 1
    this.durable = {
      educationalData: snapshotClone(value),
      revision: `revision-${this.revision}`,
      migrationReceiptBase64,
      migrationPreparationCommitmentBase64,
      migrationCompletionCommitmentBase64:
        this.durable.migrationCompletionCommitmentBase64,
    }
    if (this.failNextRead) {
      this.failNextRead = false
      this.failReadAfterWrite = true
    }
    return true
  }

  read(): DurableParentMigrationSnapshot {
    this.reads += 1
    if (this.failReadAfterWrite) {
      this.failReadAfterWrite = false
      throw new Error('simulated crash after sanitized write')
    }
    return snapshotClone(this.durable)
  }

  async withMigrationCommitLock<T>(
    expectedSnapshot: DurableParentMigrationSnapshot,
    completionCommitmentBase64: string,
    operation: (
      lockedSnapshot: DurableParentMigrationSnapshot,
      commitCompletion: () =>
        | DurableParentMigrationSnapshot
        | Promise<DurableParentMigrationSnapshot>,
    ) => T | Promise<T>,
  ): Promise<T> {
    this.commitLocks += 1
    if (!durableSnapshotsEqual(this.durable, expectedSnapshot)) {
      throw new Error('simulated migration commit-lock snapshot conflict')
    }
    const existingAnchor = this.durable.migrationCompletionCommitmentBase64
    if (existingAnchor !== null && existingAnchor !== completionCommitmentBase64) {
      throw new Error('simulated immutable migration completion anchor conflict')
    }
    const lockedSnapshot = snapshotClone(this.durable)
    return operation(lockedSnapshot, () => {
      if (!durableSnapshotsEqual(this.durable, lockedSnapshot)) {
        throw new Error('simulated durable writer violated the migration commit lock')
      }
      if (this.durable.migrationCompletionCommitmentBase64 === null) {
        this.revision += 1
        this.durable = {
          ...this.durable,
          revision: `revision-${this.revision}`,
          migrationCompletionCommitmentBase64: completionCommitmentBase64,
        }
      }
      return snapshotClone(this.durable)
    })
  }

  snapshot(): unknown {
    return snapshotClone(this.durable.educationalData)
  }

  atomicSnapshot(): DurableParentMigrationSnapshot {
    return snapshotClone(this.durable)
  }

  replaceAtomicSnapshotForTest(snapshot: DurableParentMigrationSnapshot): void {
    this.durable = snapshotClone(snapshot)
    const suffix = /^revision-(\d+)$/.exec(snapshot.revision)?.[1]
    this.revision = suffix === undefined ? this.revision + 1 : Number(suffix)
  }
}

function durableSnapshot(
  educationalData: unknown,
  revision = 'revision-0',
  migrationReceiptBase64: string | null = null,
  migrationPreparationCommitmentBase64: string | null = null,
  migrationCompletionCommitmentBase64: string | null = null,
): DurableParentMigrationSnapshot {
  return {
    educationalData: snapshotClone(educationalData),
    revision,
    migrationReceiptBase64,
    migrationPreparationCommitmentBase64,
    migrationCompletionCommitmentBase64,
  }
}

function durableSnapshotsEqual(
  left: DurableParentMigrationSnapshot,
  right: DurableParentMigrationSnapshot,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`
  }
  const record = value as Record<string, unknown>
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`
}

async function completionSealForTest(
  record: Record<string, unknown>,
): Promise<string> {
  const payload = { ...record, completionSealBase64: null }
  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(canonicalJson(payload)),
  )
  return bytesToBase64(new Uint8Array(digest))
}

function fixedOptions(
  storage: MemoryCredentialStorage,
  persistence: DurableParentMigrationPersistence,
  afterStage?: (stage: LegacyParentMigrationStage) => void | Promise<void>,
): import('./parentMigration').LegacyParentCredentialMigrationOptions {
  return {
    storage,
    generationAuthority: generationAuthorityFor(storage),
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
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('completed')

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
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
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
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
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
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
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
      binding,
      fixedOptions(storage, persistence),
    )
    const credentialBefore = storage.getItem(parentCredentialStorageKey(binding))
    const journalBefore = journalRaw(storage)

    const second = await migrateLegacyParentCredential(
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
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it('treats completion as historical across normal data changes and authorized rotation/reset', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    await migrateLegacyParentCredential(binding, fixedOptions(storage, persistence))

    await rotateParentPinAuthorized(
      binding,
      '8642',
      { consumeParentCredentialRotationAuthorization: () => true },
      parentOptions(storage),
    )
    const changed = persistence.snapshot() as Record<string, unknown>
    changed.activeProfileId = null
    persistence.value = clone(changed)
    const writesAfterChange = persistence.writes

    const afterRotation = await migrateLegacyParentCredential(
      binding,
      fixedOptions(storage, persistence),
    )
    expect(afterRotation.outcome).toMatchObject({
      classification: 'migratable',
      credentialState: 'enrolled',
      resumed: true,
    })
    expect(persistence.writes).toBe(writesAfterChange)
    await expect(verifyParentPin(binding, '8642', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })

    await markParentCredentialResetRequiredAuthorized(
      binding,
      { consumeParentCredentialResetAuthorization: () => true },
      parentOptions(storage),
    )
    const afterReset = await migrateLegacyParentCredential(
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
        binding,
        fixedOptions(storage, persistence, (stage) => {
          if (!crashed && stage === 'prepared') {
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
      binding,
      fixedOptions(storage, persistence),
    )

    expect(resumed.outcome).toMatchObject({ credentialState: 'enrolled', resumed: true })
    expect(resumed.educationalData).not.toHaveProperty('parentPin')
    expect(resumed.educationalData).not.toHaveProperty('profiles.p1.pin')
    expect(persistence.writes).toBe(1)
    const preparedParent = JSON.parse(parentCredentialBefore!) as Record<string, unknown>
    const enrolledParent = JSON.parse(
      storage.getItem(parentCredentialStorageKey(binding))!,
    ) as Record<string, unknown>
    expect(enrolledParent.saltBase64).toBe(preparedParent.saltBase64)
    expect(enrolledParent.verifierBase64).toBe(preparedParent.verifierBase64)
    expect(storage.getItem(learnerCredentialStorageKey('p1'))).toBe(learnerCredentialBefore)
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })
    await expect(verifyLearnerPin('p1', '1357', { storage })).resolves.toBe(true)
  })

  it('resumes after CAS when a conflicting learner verifier became reset-required', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    await enrollLearnerPin('p1', '1111', { storage, now: () => new Date(NOW) })
    const source = legacyState('2468')
    ;(source.profiles as Record<string, Record<string, unknown>>).p1.pin = '2222'
    const persistence = new DurableHarness(source)
    persistence.failNextRead = true

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/after sanitized write/)

    expect(readLearnerCredential('p1', { storage })?.state).toBe('reset-required')
    const durableAfterCrash = persistence.snapshot()
    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('completed')
    expect(readLearnerCredential('p1', { storage })?.state).toBe('reset-required')
    await expect(verifyLearnerPin('p1', '1111', { storage })).resolves.toBe(false)
    await expect(verifyLearnerPin('p1', '2222', { storage })).resolves.toBe(false)
  })

  it('retries safely after a crash with an inactive prepared verifier', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    let crashed = false

    await expect(
      migrateLegacyParentCredential(
        binding,
        fixedOptions(storage, persistence, (stage) => {
          if (!crashed && stage === 'prepared') {
            crashed = true
            throw new Error('simulated crash after inactive preparation')
          }
        }),
      ),
    ).rejects.toThrow(/inactive preparation/)

    await expect(readParentCredentialRecord(binding, parentOptions(storage))).resolves.toMatchObject({
      state: 'prepared',
    })
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('prepared')
    expect(persistence.writes).toBe(0)

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
  })

  it('reuses identical verifier material after educational commit', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    let crashed = false

    await expect(
      migrateLegacyParentCredential(
        binding,
        fixedOptions(storage, persistence, (stage) => {
          if (!crashed && stage === 'educational-committed') {
            crashed = true
            throw new Error('simulated crash after educational commit')
          }
        }),
      ),
    ).rejects.toThrow(/after educational commit/)

    const credentialBefore = storage.getItem(parentCredentialStorageKey(binding))
    expect(credentialBefore).not.toBeNull()
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe(
      'educational-committed',
    )
    expect(persistence.writes).toBe(1)

    await migrateLegacyParentCredential(binding, fixedOptions(storage, persistence))
    const prepared = JSON.parse(credentialBefore!) as Record<string, unknown>
    const promoted = JSON.parse(
      storage.getItem(parentCredentialStorageKey(binding))!,
    ) as Record<string, unknown>
    expect(promoted.saltBase64).toBe(prepared.saltBase64)
    expect(promoted.verifierBase64).toBe(prepared.verifierBase64)
    expect(promoted.generation).toBe((prepared.generation as number) + 1)
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('completed')
  })

  it('restarts from missing parentPin after the sanitized write already became durable', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    persistence.failNextRead = true

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/after sanitized write/)

    const durableAfterCrash = persistence.snapshot()
    expect(durableAfterCrash).not.toHaveProperty('parentPin')
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe(
      'prepared',
    )

    const resumed = await migrateLegacyParentCredential(
      binding,
      fixedOptions(storage, persistence),
    )
    expect(resumed.outcome).toEqual({
      classification: 'migratable',
      credentialState: 'enrolled',
      resumed: true,
    })
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('completed')
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
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
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/after sanitized write/)
    const durableAfterCrash = persistence.snapshot() as Record<string, unknown>
    const key = parentCredentialStorageKey(binding)
    const originalCredential = storage.getItem(key)!
    const tampered = JSON.parse(originalCredential) as Record<string, unknown>
    const verifier = tampered.verifierBase64 as string
    tampered.verifierBase64 = `${verifier[0] === 'A' ? 'B' : 'A'}${verifier.slice(1)}`
    storage.setItem(key, JSON.stringify(tampered))

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/generation has no matching durable record|credential commitment/)

    storage.setItem(key, originalCredential)
    const changedData = clone(durableAfterCrash)
    changedData.activeProfileId = null
    persistence.value = clone(changedData)
    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/different durable Parent migration transaction|educational data changed/i)
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
    const persistence = new DurableHarness(source)
    const exactRead = persistence.read.bind(persistence)
    persistence.read = () => {
      const snapshot = exactRead()
      return persistence.writes > 0
        ? { ...snapshot, educationalData: readBack(snapshot.educationalData) }
        : snapshot
    }

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/read-back changed|credential-free read-back verification/)
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe(
      'prepared',
    )
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.not.toMatchObject({
      status: 'verified',
    })
  })

  it('returns parent-setup-required for a fresh installation without enrolling a credential', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState()
    delete source.parentPin
    const persistence = new DurableHarness(source)

    const result = await migrateLegacyParentCredential(
      binding,
      fixedOptions(storage, persistence),
    )

    expect(result.outcome).toEqual({
      classification: 'parent-setup-required',
      credentialState: 'parent-setup-required',
      resumed: false,
    })
    await expect(readParentCredentialRecord(binding, parentOptions(storage))).resolves.toBeNull()
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
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
      binding,
      fixedOptions(storage, persistence),
    )

    expect(result.outcome).toEqual({
      classification: 'reset-required',
      credentialState: 'reset-required',
      resumed: false,
    })
    expect((await readParentCredentialRecord(binding, parentOptions(storage)))?.state).toBe('reset-required')
    await expect(verifyParentPin(binding, '0000', parentOptions(storage))).resolves.toMatchObject({
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
      migrateLegacyParentCredential(bindingA, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/after sanitized write/)
    const credentialFreeState = persistence.snapshot()

    await expect(
      migrateLegacyParentCredential(bindingB, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/different durable Parent migration transaction|completion anchor/i)
    await expect(readParentCredentialRecord(bindingB, parentOptions(storage))).resolves.toBeNull()
    await expect(verifyParentPin(bindingB, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
    await expect(verifyParentPin(bindingA, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })
  })
})

describe('authoritative Parent migration snapshot and CAS defenses', () => {
  it('rejects retired three-argument forged snapshots identically before any write', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const durable = legacyState('2468')
    const persistence = new DurableHarness(durable)
    const retiredCall = migrateLegacyParentCredential as unknown as (
      callerSnapshot: unknown,
      callerBinding: InstallationBinding,
      callerOptions: import('./parentMigration').LegacyParentCredentialMigrationOptions,
    ) => Promise<unknown>
    const messages: string[] = []

    for (const callerPin of ['9999', '1234']) {
      try {
        await retiredCall(
          legacyState(callerPin),
          binding,
          fixedOptions(storage, persistence),
        )
        throw new Error('Retired Parent migration call unexpectedly resolved.')
      } catch (cause) {
        expect(cause).toBeInstanceOf(Error)
        messages.push((cause as Error).message)
      }
    }

    expect(messages[0]).toBe(messages[1])
    expect(storage.entries()).toEqual([])
    expect(persistence.writes).toBe(0)
    expect(persistence.reads).toBe(0)
    expect(persistence.commitLocks).toBe(0)
    expect(
      generationAuthorityFor(storage).snapshot(parentCredentialBindingReference(binding)),
    ).toMatchObject({ generation: 0, activeGeneration: null, recordCommitmentBase64: null })
    await expect(verifyParentPin(binding, '9999', parentOptions(storage))).resolves.not.toMatchObject({
      status: 'verified',
    })
  })

  it('derives fresh-install setup only from durable no-PIN state', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const durable = legacyState()
    delete durable.parentPin
    const persistence = new DurableHarness(durable)

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).resolves.toMatchObject({
      outcome: {
        classification: 'parent-setup-required',
        credentialState: 'parent-setup-required',
      },
    })

    await expect(readParentCredentialRecord(binding, parentOptions(storage))).resolves.toBeNull()
    await expect(verifyParentPin(binding, '1234', parentOptions(storage))).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
    expect(
      generationAuthorityFor(storage).snapshot(parentCredentialBindingReference(binding)),
    ).toMatchObject({ generation: 0, activeGeneration: null, recordCommitmentBase64: null })
  })

  it('keeps a prepared Parent inactive after CAS false and safely retries', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    let rejectCas = true
    const persistence = new DurableHarness(source)
    const exactWrite = persistence.writeIfUnchanged.bind(persistence)
    persistence.writeIfUnchanged = (expected, educationalData, receipt, preparationCommitment) => {
      if (rejectCas) {
        persistence.writes += 1
        return false
      }
      return exactWrite(expected, educationalData, receipt, preparationCommitment)
    }

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/CAS failed/)
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('prepared')
    expect((await readParentCredentialRecord(binding, parentOptions(storage)))?.state).toBe('prepared')
    expect(
      generationAuthorityFor(storage).snapshot(parentCredentialBindingReference(binding)),
    ).toMatchObject({ generation: 1, activeGeneration: null })
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })

    rejectCas = false
    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
    expect(persistence.writes).toBe(2)
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it('keeps a prepared Parent inactive after the educational CAS throws', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    persistence.writeIfUnchanged = () => {
      persistence.writes += 1
      throw new Error('simulated CAS outage')
    }

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/CAS failed.*outage/)
    expect(persistence.writes).toBe(1)
    expect((await readParentCredentialRecord(binding, parentOptions(storage)))?.state).toBe('prepared')
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })
  })

  it.each(['false', 'throw'] as const)(
    'requires a fresh receipt-proven retry after a CAS %s following the exact commit',
    async (outcome) => {
      const binding = installationBinding()
      const storage = new MemoryCredentialStorage()
      const persistence = new DurableHarness(legacyState('2468'))
      const initialRevision = persistence.atomicSnapshot().revision
      const exactWrite = persistence.writeIfUnchanged.bind(persistence)
      persistence.writeIfUnchanged = (expected, educationalData, receipt, preparationCommitment) => {
        expect(
          exactWrite(expected, educationalData, receipt, preparationCommitment),
        ).toBe(true)
        if (outcome === 'throw') throw new Error('ambiguous response after durable commit')
        return false
      }

      await expect(
        migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
      ).rejects.toThrow(/fresh receipt-proven retry/i)
      expect(persistence.atomicSnapshot()).toMatchObject({
        migrationReceiptBase64: expect.any(String),
        migrationPreparationCommitmentBase64: expect.any(String),
        migrationCompletionCommitmentBase64: null,
      })
      expect(persistence.atomicSnapshot().revision).not.toBe(initialRevision)
      await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
        status: 'not-verified',
      })

      await expect(
        migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
      ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
      expect(persistence.atomicSnapshot()).toMatchObject({
        migrationCompletionCommitmentBase64: expect.any(String),
      })
      await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
        status: 'verified',
      })
    },
  )

  it('rejects an exact CAS payload whose adapter does not advance the authoritative revision', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const persistence = new DurableHarness(legacyState('2468'))
    const exactWrite = persistence.writeIfUnchanged.bind(persistence)
    persistence.writeIfUnchanged = (
      expected,
      educationalData,
      receipt,
      preparationCommitment,
    ) => {
      expect(
        exactWrite(expected, educationalData, receipt, preparationCommitment),
      ).toBe(true)
      persistence.replaceAtomicSnapshotForTest({
        ...persistence.atomicSnapshot(),
        revision: expected.revision,
      })
      return true
    }

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/did not advance.*revision/i)
    expect(persistence.commitLocks).toBe(0)
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })
  })

  it('cannot activate when a false CAS follows a changed PIN and independently identical sanitization', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    persistence.writeIfUnchanged = () => {
      persistence.writes += 1
      const changedPin = { ...source, parentPin: '9999' }
      persistence.value = sanitizeCredentialFreeEducationalData(changedPin)
      return false
    }

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/removed credential inputs.*receipt/i)
    expect(persistence.commitLocks).toBe(0)
    expect(persistence.atomicSnapshot()).toMatchObject({
      migrationReceiptBase64: null,
      migrationCompletionCommitmentBase64: null,
    })
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })
    await expect(verifyParentPin(binding, '9999', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })
  })

  it('rebases only a credential-stable CAS conflict and recomputes commitments', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = { ...legacyState('2468'), theme: 'light' }
    const persistence = new DurableHarness(source)
    const exactWrite = persistence.writeIfUnchanged.bind(persistence)
    const preparedJournals: NonNullable<
      ReturnType<typeof readLegacyParentCredentialMigrationRecord>
    >[] = []
    persistence.writeIfUnchanged = (expected, educationalData, receipt, preparationCommitment) => {
      if (persistence.writes === 0) {
        persistence.writes += 1
        const journal = readLegacyParentCredentialMigrationRecord(binding, { storage })
        if (journal) preparedJournals.push(journal)
        persistence.value = {
          ...(persistence.snapshot() as Record<string, unknown>),
          theme: 'night',
        }
        return false
      }
      return exactWrite(expected, educationalData, receipt, preparationCommitment)
    }

    const result = await migrateLegacyParentCredential(
      binding,
      fixedOptions(storage, persistence),
    )

    expect(persistence.writes).toBe(2)
    expect(result.educationalData).toMatchObject({ theme: 'night' })
    const completed = readLegacyParentCredentialMigrationRecord(binding, { storage })
    expect(completed).toMatchObject({
      stage: 'completed',
      attempt: 2,
    })
    const firstJournal = preparedJournals[0]
    expect(firstJournal).toBeDefined()
    expect(completed?.sourceStructureCommitmentBase64).not.toBe(
      firstJournal!.sourceStructureCommitmentBase64,
    )
    expect(completed?.educationalDataCommitmentBase64).not.toBe(
      firstJournal!.educationalDataCommitmentBase64,
    )
    expect(completed?.migrationReceiptBase64).not.toBe(
      firstJournal!.migrationReceiptBase64,
    )
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it('reprepares from a PIN-changing CAS conflict and authenticates only the new durable PIN', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    const exactWrite = persistence.writeIfUnchanged.bind(persistence)
    persistence.writeIfUnchanged = (expected, educationalData, receipt, preparationCommitment) => {
      if (persistence.writes === 0) {
        persistence.writes += 1
        persistence.value = {
          ...(persistence.snapshot() as Record<string, unknown>),
          parentPin: '9999',
        }
        return false
      }
      return exactWrite(expected, educationalData, receipt, preparationCommitment)
    }

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled' } })
    expect(persistence.writes).toBe(2)
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })).toMatchObject({
      stage: 'completed',
      attempt: 2,
    })
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })
    await expect(verifyParentPin(binding, '9999', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })
  })
})

class LearnerWriteFaultStorage extends MemoryCredentialStorage {
  failLearnerWrites = true

  override setItem(key: string, value: string): void {
    if (this.failLearnerWrites && key.includes('learner-credentials')) {
      throw new Error('simulated learner credential persistence failure')
    }
    super.setItem(key, value)
  }
}

describe('transaction completion remains the Parent authority boundary', () => {
  it('rejects a prepared-journal learner-scope rewrite against the durable preparation commitment', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    ;(source.profiles as Record<string, Record<string, unknown>>).p1.pin = '1357'
    const persistence = new DurableHarness(source)
    persistence.failNextRead = true

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/after sanitized write/)
    const entry = storage.entries().find(([key]) =>
      key.startsWith(`${LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE}:`),
    )
    expect(entry).toBeDefined()
    const tampered = JSON.parse(entry![1]) as Record<string, unknown>
    expect(tampered.stage).toBe('prepared')
    tampered.learnerProfileIds = []
    tampered.educationalProfileIds = []
    tampered.learnerMigrationCommitmentBase64 =
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    storage.setItem(entry![0], JSON.stringify(tampered))

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/different durable Parent migration transaction|preparation commitment/i)
    expect(persistence.commitLocks).toBe(0)
    expect(persistence.atomicSnapshot().migrationCompletionCommitmentBase64).toBeNull()
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })
  })

  it('leaves Parent inactive and educational data unpublished on learner preparation failure', async () => {
    const binding = installationBinding()
    const storage = new LearnerWriteFaultStorage()
    const source = legacyState('2468')
    ;(source.profiles as Record<string, Record<string, unknown>>).p1.pin = '1357'
    const persistence = new DurableHarness(source)

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/learner credential|could not be written/i)

    expect(persistence.writes).toBe(0)
    expect(persistence.snapshot()).toEqual(source)
    expect((await readParentCredentialRecord(binding, parentOptions(storage)))?.state).toBe('prepared')
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })

    storage.failLearnerWrites = false
    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })
    await expect(verifyLearnerPin('p1', '1357', { storage })).resolves.toBe(true)
  })

  it('cannot promote after a successful CAS whose immediate readback is different', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    let corruptNextRead = false
    const persistence = new DurableHarness(source)
    const exactWrite = persistence.writeIfUnchanged.bind(persistence)
    const exactRead = persistence.read.bind(persistence)
    persistence.writeIfUnchanged = (expected, educationalData, receipt, preparationCommitment) => {
      const result = exactWrite(
        expected,
        educationalData,
        receipt,
        preparationCommitment,
      )
      corruptNextRead = true
      return result
    }
    persistence.read = () => {
      const snapshot = exactRead()
      if (corruptNextRead) {
        corruptNextRead = false
        return {
          ...snapshot,
          educationalData: {
            ...(snapshot.educationalData as Record<string, unknown>),
            activeProfileId: null,
          },
        }
      }
      return snapshot
    }

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/reported success.*read-back changed|durable receipt\/read-back/i)
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe('prepared')
    expect((await readParentCredentialRecord(binding, parentOptions(storage)))?.state).toBe('prepared')
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
  })

  it('rejects an educational mutation injected under the activation commit hook', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const persistence = new DurableHarness(legacyState('2468'))
    const exactCommitLock = persistence.withMigrationCommitLock.bind(persistence)
    persistence.withMigrationCommitLock = (
      expected,
      completionCommitmentBase64,
      operation,
    ) => exactCommitLock(expected, completionCommitmentBase64, async (_locked, commitCompletion) => {
      persistence.value = {
        ...(persistence.snapshot() as Record<string, unknown>),
        activeProfileId: null,
      }
      return operation(persistence.atomicSnapshot(), commitCompletion)
    })

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/lock did not preserve|changed educational data/i)
    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe(
      'completed',
    )
    expect(persistence.atomicSnapshot().migrationCompletionCommitmentBase64).toBeNull()
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })
  })

  it('rechecks learner credentials after commitCompletion before activating Parent authority', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    ;(source.profiles as Record<string, Record<string, unknown>>).p1.pin = '1357'
    const persistence = new DurableHarness(source)
    const exactCommitLock = persistence.withMigrationCommitLock.bind(persistence)
    persistence.withMigrationCommitLock = (
      expected,
      completionCommitmentBase64,
      operation,
    ) => exactCommitLock(
      expected,
      completionCommitmentBase64,
      (locked, commitCompletion) => operation(locked, () => {
        const anchored = commitCompletion() as DurableParentMigrationSnapshot
        storage.removeItem(learnerCredentialStorageKey('p1'))
        return anchored
      }),
    )

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/learner credentials changed|missing.*learner|missing.*credential/i)
    expect(persistence.atomicSnapshot().migrationCompletionCommitmentBase64).toEqual(
      expect.any(String),
    )
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })
  })

  it('rejects a first completion anchor installed without advancing durable revision', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const persistence = new DurableHarness(legacyState('2468'))
    const exactCommitLock = persistence.withMigrationCommitLock.bind(persistence)
    persistence.withMigrationCommitLock = (
      expected,
      completionCommitmentBase64,
      operation,
    ) => exactCommitLock(
      expected,
      completionCommitmentBase64,
      (locked, commitCompletion) => operation(locked, () => {
        const anchored = commitCompletion() as DurableParentMigrationSnapshot
        persistence.replaceAtomicSnapshotForTest({
          ...anchored,
          revision: locked.revision,
        })
        return persistence.atomicSnapshot()
      }),
    )

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/completion anchor failed exact read-back|revision/i)
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })
  })

  it('rejects a completed-journal commitment altered and locally resealed against the external anchor', async () => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    await migrateLegacyParentCredential(binding, fixedOptions(storage, persistence))

    const entry = storage.entries().find(([key]) =>
      key.startsWith(`${LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE}:`),
    )
    expect(entry).toBeDefined()
    const tampered = JSON.parse(entry![1]) as Record<string, unknown>
    tampered.educationalDataCommitmentBase64 =
      'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    tampered.completionSealBase64 = await completionSealForTest(tampered)
    storage.setItem(entry![0], JSON.stringify(tampered))

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/durable completion anchor|external credential authority/i)
  })
})

describe('Parent migration exact crash recovery', () => {
  it.each([
    'prepared',
    'educational-committed',
    'credential-promoted',
    'completed',
  ] as const)('keeps Parent inactive after a crash at %s and resumes exactly', async (stage) => {
    const binding = installationBinding()
    const storage = new MemoryCredentialStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)
    let crashed = false

    await expect(
      migrateLegacyParentCredential(
        binding,
        fixedOptions(storage, persistence, (currentStage) => {
          if (!crashed && currentStage === stage) {
            crashed = true
            throw new Error(`simulated crash at ${stage}`)
          }
        }),
      ),
    ).rejects.toThrow(`simulated crash at ${stage}`)

    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe(stage)
    expect(
      generationAuthorityFor(storage).snapshot(parentCredentialBindingReference(binding)).activeGeneration,
    ).toBeNull()
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })
  })
})

class PrimaryParentWriteFaultStorage extends MemoryCredentialStorage {
  private failed = false

  constructor(private readonly primaryKey: string) {
    super()
  }

  override setItem(key: string, value: string): void {
    if (!this.failed && key === this.primaryKey) {
      this.failed = true
      throw new Error('simulated crash after generation CAS')
    }
    super.setItem(key, value)
  }
}

class PromotionJournalFaultStorage extends MemoryCredentialStorage {
  failPromotionJournal = true

  override setItem(key: string, value: string): void {
    if (
      this.failPromotionJournal &&
      key.startsWith(`${LEGACY_PARENT_CREDENTIAL_MIGRATION_NAMESPACE}:`) &&
      (JSON.parse(value) as { stage?: unknown }).stage === 'credential-promoted'
    ) {
      this.failPromotionJournal = false
      throw new Error('simulated crash before promotion journal write')
    }
    super.setItem(key, value)
  }
}

describe('cross-store Parent generation recovery', () => {
  it('recovers an authority-committed pending record after the primary write is interrupted', async () => {
    const binding = installationBinding()
    const primaryKey = parentCredentialStorageKey(binding)
    const storage = new PrimaryParentWriteFaultStorage(primaryKey)
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/could not be written/)

    expect(storage.getItem(primaryKey)).toBeNull()
    expect(
      generationAuthorityFor(storage).snapshot(parentCredentialBindingReference(binding)),
    ).toMatchObject({ generation: 1, activeGeneration: null })
    expect(storage.entries().some(([key]) => key.includes('pending-generation:1'))).toBe(true)
    expect(persistence.writes).toBe(0)

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
    expect(storage.entries().some(([key]) => key.includes('pending-generation:'))).toBe(false)
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it('recognizes an exact inactive promotion if its journal write was interrupted', async () => {
    const binding = installationBinding()
    const storage = new PromotionJournalFaultStorage()
    const source = legacyState('2468')
    const persistence = new DurableHarness(source)

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).rejects.toThrow(/before promotion journal write/)

    expect(readLegacyParentCredentialMigrationRecord(binding, { storage })?.stage).toBe(
      'educational-committed',
    )
    expect((await readParentCredentialRecord(binding, parentOptions(storage)))?.state).toBe('enrolled')
    expect(
      generationAuthorityFor(storage).snapshot(parentCredentialBindingReference(binding)),
    ).toMatchObject({ generation: 2, activeGeneration: null })
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'not-verified',
    })

    await expect(
      migrateLegacyParentCredential(binding, fixedOptions(storage, persistence)),
    ).resolves.toMatchObject({ outcome: { credentialState: 'enrolled', resumed: true } })
    await expect(verifyParentPin(binding, '2468', parentOptions(storage))).resolves.toMatchObject({
      status: 'verified',
    })
  })
})

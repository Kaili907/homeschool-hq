import { describe, expect, it, vi } from 'vitest'
import {
  createInstallationId,
  parseProfileId,
  type InstallationBinding,
} from '../contracts'
import {
  createParentPinVerifier,
  verifyParentPinVerifier,
} from './parentPinVerifier'
import {
  createPinVerifier,
  verifyPinVerifier,
  type PinVerifierCrypto,
} from './pinVerifier'
import {
  MemoryCredentialStorage,
  MemoryParentCredentialGenerationAuthority,
  MemoryParentInstallationGrantIssuer,
} from './testStorage'
import {
  createPreparedParentCredentialRecordForTest,
  commitParentMigrationAuthority,
  markParentCredentialResetRequiredForMigration,
  parentCredentialRecordCommitment,
  prepareLegacyParentPinForMigration,
  readParentCredentialRecord,
  readParentCredentialGeneration,
  stagePreparedParentCredentialForMigration,
  stagePreparedParentResetForMigration,
} from './parentVault.internal'
import {
  PARENT_CREDENTIAL_STORAGE_NAMESPACE,
  claimParentPinAuthorized,
  markParentCredentialResetRequiredAuthorized,
  parentCredentialBindingReference,
  parentCredentialStorageKey,
  parentFailedAttemptSubject,
  parseParentCredentialRecord,
  readParentCredentialState,
  recoverParentPinAuthorized,
  rotateParentPinAuthorized,
  verifyParentPin,
  type ParentCredentialGenerationAuthority,
  type ParentCredentialLockManager,
  type ParentCredentialOperationOptions,
  type ParentCredentialRotationAuthorization,
  type ParentInstallationRecoveryAuthorization,
} from './parentVault'

const INSTALLATION_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const INSTALLATION_B = 'b3d48c11-53bb-4d8f-bb8b-d2f311abf5ef'
const CREATED_AT = '2026-08-11T12:00:00.000Z'
const ROTATED_AT = '2026-08-11T12:01:00.000Z'
const TEST_MIGRATION_COMMITMENT_BASE64 =
  'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
const OTHER_MIGRATION_COMMITMENT_BASE64 =
  'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE='
const NULL_RECORD_COMMITMENT_BASE64 =
  'dCNOmK/nSY+12vHzasLXiswzlGT5UHA7jAGYkvmCuQs='

function activeBinding(
  installationId = INSTALLATION_A,
  householdId = 'household-a',
): InstallationBinding {
  return {
    schemaVersion: 1,
    bindingId: 'binding:' + householdId,
    installationId: createInstallationId(() => installationId),
    householdId,
    datasetEpoch: 'dataset-epoch-1',
    verifiedActorId: 'verified-parent-1',
    status: 'active',
    boundAt: CREATED_AT,
  }
}

function deterministicCrypto(fill: number): PinVerifierCrypto {
  return {
    subtle: globalThis.crypto.subtle,
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (array) {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(fill)
      }
      return array
    },
  }
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

class SerialLockManager implements ParentCredentialLockManager {
  readonly requestedNames: string[] = []
  readonly maxActiveByName = new Map<string, number>()
  private readonly tails = new Map<string, Promise<void>>()
  private readonly activeByName = new Map<string, number>()

  async request<T>(
    name: string,
    _options: { readonly mode: 'exclusive' },
    callback: () => T | Promise<T>,
  ): Promise<T> {
    this.requestedNames.push(name)
    const prior = this.tails.get(name) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = prior.then(() => gate)
    this.tails.set(name, tail)
    await prior

    const active = (this.activeByName.get(name) ?? 0) + 1
    this.activeByName.set(name, active)
    this.maxActiveByName.set(name, Math.max(this.maxActiveByName.get(name) ?? 0, active))
    try {
      return await callback()
    } finally {
      this.activeByName.set(name, active - 1)
      release()
      if (this.tails.get(name) === tail) this.tails.delete(name)
    }
  }
}

class PrimaryWriteFaultStorage extends MemoryCredentialStorage {
  failNextPrimaryWrite = false

  constructor(private readonly primaryKey: string) {
    super()
  }

  override setItem(key: string, value: string): void {
    if (this.failNextPrimaryWrite && key === this.primaryKey) {
      this.failNextPrimaryWrite = false
      throw new Error('simulated primary Parent record write failure')
    }
    super.setItem(key, value)
  }
}

const lockManager = new ImmediateLockManager()

function operationOptions(
  storage: MemoryCredentialStorage,
  generationAuthority: ParentCredentialGenerationAuthority,
  overrides: Partial<ParentCredentialOperationOptions> = {},
): ParentCredentialOperationOptions {
  return {
    storage,
    generationAuthority,
    lockManager,
    ...overrides,
  }
}

function recoveryGrantFor(
  binding: InstallationBinding,
  authority: MemoryParentCredentialGenerationAuthority,
  now?: () => Date,
): ParentInstallationRecoveryAuthorization {
  const issuer = new MemoryParentInstallationGrantIssuer(binding, now)
  issuer.issueRecovery(
    authority.snapshot(parentCredentialBindingReference(binding)).generation,
  )
  return issuer.recovery
}

async function enrollForTest(
  binding: InstallationBinding,
  pin: string,
  storage: MemoryCredentialStorage,
  generationAuthority: MemoryParentCredentialGenerationAuthority,
  overrides: Partial<ParentCredentialOperationOptions> = {},
) {
  const options = operationOptions(storage, generationAuthority, overrides)
  const prepared = await prepareLegacyParentPinForMigration(binding, pin, options)
  const staged = await stagePreparedParentCredentialForMigration(
    binding,
    prepared.generation,
    options,
  )
  const committed = await commitParentMigrationAuthority(
    binding,
    'enrolled',
    staged.generation,
    await parentCredentialRecordCommitment(staged, options),
    TEST_MIGRATION_COMMITMENT_BASE64,
    options,
  )
  if (!committed) throw new Error('Test Parent enrollment did not produce a record.')
  return committed
}

function deferredKdfCrypto(): {
  readonly crypto: PinVerifierCrypto
  readonly entered: Promise<void>
  readonly release: () => void
} {
  let announce!: () => void
  let release!: () => void
  const entered = new Promise<void>((resolve) => {
    announce = resolve
  })
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const subtle = globalThis.crypto.subtle
  const wrapped = {
    digest: subtle.digest.bind(subtle),
    importKey: subtle.importKey.bind(subtle),
    deriveBits: async (...args: Parameters<SubtleCrypto['deriveBits']>) => {
      announce()
      await gate
      return subtle.deriveBits(...args)
    },
  } as unknown as SubtleCrypto
  return {
    crypto: {
      subtle: wrapped,
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T =>
        globalThis.crypto.getRandomValues(array),
    },
    entered,
    release,
  }
}

function failReplacementPreverificationCrypto(): PinVerifierCrypto {
  const subtle = globalThis.crypto.subtle
  let derivations = 0
  return {
    subtle: {
      digest: subtle.digest.bind(subtle),
      importKey: subtle.importKey.bind(subtle),
      deriveBits: async (...args: Parameters<SubtleCrypto['deriveBits']>) => {
        derivations += 1
        if (derivations === 2) throw new Error('simulated replacement preverification failure')
        return subtle.deriveBits(...args)
      },
    } as unknown as SubtleCrypto,
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T =>
      globalThis.crypto.getRandomValues(array),
  }
}

describe('device-local Parent credential vault', () => {
  it('isolates schema-2 Parent blobs in the v2 namespace', () => {
    expect(PARENT_CREDENTIAL_STORAGE_NAMESPACE).toBe(
      'homeschool-hq:security:parent-credentials:v2',
    )
    expect(parentCredentialStorageKey(activeBinding())).toContain(
      'homeschool-hq:security:parent-credentials:v2:',
    )
  })

  it('anchors setup completion at generation zero idempotently and immutably', async () => {
    const binding = activeBinding(INSTALLATION_A, 'household-setup-anchor')
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)

    await expect(commitParentMigrationAuthority(
      binding,
      'missing',
      null,
      NULL_RECORD_COMMITMENT_BASE64,
      TEST_MIGRATION_COMMITMENT_BASE64,
      options,
    )).resolves.toBeNull()
    await expect(commitParentMigrationAuthority(
      binding,
      'missing',
      null,
      NULL_RECORD_COMMITMENT_BASE64,
      TEST_MIGRATION_COMMITMENT_BASE64,
      options,
    )).resolves.toBeNull()
    await expect(readParentCredentialGeneration(binding, options)).resolves.toEqual({
      generation: 0,
      activeGeneration: null,
      recordCommitmentBase64: null,
      migrationCommitmentBase64: TEST_MIGRATION_COMMITMENT_BASE64,
    })
    await expect(commitParentMigrationAuthority(
      binding,
      'missing',
      null,
      NULL_RECORD_COMMITMENT_BASE64,
      OTHER_MIGRATION_COMMITMENT_BASE64,
      options,
    )).rejects.toMatchObject({ code: 'generation-mismatch' })
  })

  it('anchors and activates an exact enrolled migration in one immutable authority CAS', async () => {
    const binding = activeBinding(INSTALLATION_A, 'household-enrolled-anchor')
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)
    const prepared = await prepareLegacyParentPinForMigration(binding, '2468', options)
    const staged = await stagePreparedParentCredentialForMigration(
      binding,
      prepared.generation,
      options,
    )
    const commitment = await parentCredentialRecordCommitment(staged, options)

    await expect(verifyParentPin(binding, '2468', options)).resolves.toMatchObject({
      status: 'not-verified',
    })
    await expect(commitParentMigrationAuthority(
      binding,
      'enrolled',
      staged.generation,
      commitment,
      TEST_MIGRATION_COMMITMENT_BASE64,
      options,
    )).resolves.toEqual(staged)
    await expect(commitParentMigrationAuthority(
      binding,
      'enrolled',
      staged.generation,
      commitment,
      TEST_MIGRATION_COMMITMENT_BASE64,
      options,
    )).resolves.toEqual(staged)
    await expect(verifyParentPin(binding, '2468', options)).resolves.toMatchObject({
      status: 'verified',
    })
    await expect(commitParentMigrationAuthority(
      binding,
      'enrolled',
      staged.generation,
      commitment,
      OTHER_MIGRATION_COMMITMENT_BASE64,
      options,
    )).rejects.toMatchObject({ code: 'generation-mismatch' })

    await rotateParentPinAuthorized(
      binding,
      '8642',
      { consumeParentCredentialRotationAuthorization: () => true },
      options,
    )
    expect(authority.snapshot(parentCredentialBindingReference(binding))).toMatchObject({
      migrationCommitmentBase64: TEST_MIGRATION_COMMITMENT_BASE64,
    })
  })

  it('anchors an exact reset-required migration without activating it', async () => {
    const binding = activeBinding(INSTALLATION_A, 'household-reset-anchor')
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)
    const prepared = await markParentCredentialResetRequiredForMigration(binding, options)
    const staged = await stagePreparedParentResetForMigration(
      binding,
      prepared.generation,
      options,
    )

    await expect(commitParentMigrationAuthority(
      binding,
      'reset-required',
      staged.generation,
      await parentCredentialRecordCommitment(staged, options),
      TEST_MIGRATION_COMMITMENT_BASE64,
      options,
    )).resolves.toEqual(staged)
    expect(authority.snapshot(parentCredentialBindingReference(binding))).toMatchObject({
      generation: staged.generation,
      activeGeneration: null,
      migrationCommitmentBase64: TEST_MIGRATION_COMMITMENT_BASE64,
    })
    await expect(verifyParentPin(binding, '0000', options)).resolves.toMatchObject({
      status: 'reset-required',
    })
  })

  it('verifies only an active enrolled generation and rejects the wrong PIN', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)
    const enrolled = await enrollForTest(binding, '2468', storage, authority)

    expect(enrolled.generation).toBe(2)
    await expect(verifyParentPin(binding, '2468', options)).resolves.toEqual({
      status: 'verified',
      subject: { kind: 'parent', householdId: 'household-a' },
    })
    await expect(verifyParentPin(binding, '2469', options)).resolves.toEqual({
      status: 'not-verified',
      subject: { kind: 'parent', householdId: 'household-a' },
    })
  })

  it('keeps a migration-prepared record non-authenticating', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)
    const prepared = await prepareLegacyParentPinForMigration(binding, '2468', options)

    expect(prepared).toMatchObject({ state: 'prepared', generation: 1 })
    await expect(verifyParentPin(binding, '2468', options)).resolves.toMatchObject({
      status: 'not-verified',
    })
    await expect(readParentCredentialState(binding, options)).resolves.toMatchObject({
      status: 'prepared',
    })
    expect(authority.snapshot(parentCredentialBindingReference(binding))).toMatchObject({
      generation: 1,
      activeGeneration: null,
    })
  })

  it('binds verification to the exact installation and household and rejects moved records', async () => {
    const source = activeBinding(INSTALLATION_A, 'household-a')
    const otherInstallation = activeBinding(INSTALLATION_B, 'household-a')
    const otherHousehold = activeBinding(INSTALLATION_A, 'household-b')
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    await enrollForTest(source, '1357', storage, authority, {
      crypto: deterministicCrypto(0x5a),
    })
    const sourceRaw = storage.getItem(parentCredentialStorageKey(source))!

    storage.setItem(parentCredentialStorageKey(otherInstallation), sourceRaw)
    await expect(
      verifyParentPin(
        otherInstallation,
        '1357',
        operationOptions(storage, authority, { crypto: deterministicCrypto(0x5a) }),
      ),
    ).resolves.toMatchObject({ status: 'not-verified' })

    storage.setItem(parentCredentialStorageKey(otherHousehold), sourceRaw)
    await expect(
      verifyParentPin(
        otherHousehold,
        '1357',
        operationOptions(storage, authority, { crypto: deterministicCrypto(0x5a) }),
      ),
    ).resolves.toMatchObject({ status: 'not-verified' })
  })

  it('keeps learner and Parent verifier material cryptographically cross-domain', async () => {
    const binding = activeBinding()
    const reference = parentCredentialBindingReference(binding)
    const profileId = parseProfileId('p1')!
    const crypto = deterministicCrypto(0x33)
    const learnerMaterial = await createPinVerifier(profileId, '8642', crypto)
    const parentMaterial = await createParentPinVerifier(reference, '8642', crypto)

    expect(parentMaterial.saltBase64).toBe(learnerMaterial.saltBase64)
    expect(parentMaterial.verifierBase64).not.toBe(learnerMaterial.verifierBase64)
    await expect(
      verifyParentPinVerifier(reference, '8642', learnerMaterial, crypto),
    ).resolves.toBe(false)
    await expect(verifyPinVerifier(profileId, '8642', parentMaterial, crypto)).resolves.toBe(false)
  })

  it('never stores the plaintext Parent PIN', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const record = await enrollForTest(binding, '9753', storage, authority)
    const raw = storage.getItem(parentCredentialStorageKey(binding))!

    expect(raw).not.toContain('"9753"')
    expect(record).not.toHaveProperty('pin')
    expect(record).not.toHaveProperty('rawPin')
  })

  it.each(['', '123', '12345', '12x4', ' 1234', '1234 '])(
    'preserves the exact four-digit Parent PIN policy for %j',
    async (pin) => {
      await expect(
        createPreparedParentCredentialRecordForTest(activeBinding(), pin, 1),
      ).rejects.toThrow(/exactly four decimal digits/i)
    },
  )

  it('returns a non-authoritative fresh-install status and requires generation authority', async () => {
    const binding = activeBinding(INSTALLATION_A, 'household-fresh')
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)

    await expect(readParentCredentialState(binding, options)).resolves.toEqual({
      status: 'parent-setup-required',
      subject: { kind: 'parent', householdId: 'household-fresh' },
    })
    await expect(verifyParentPin(binding, '1234', options)).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
    await expect(
      verifyParentPin(binding, '1234', {
        storage,
      } as unknown as ParentCredentialOperationOptions),
    ).rejects.toMatchObject({ code: 'generation-authority-unavailable' })
    expect(parentFailedAttemptSubject(binding)).toEqual({
      kind: 'parent',
      householdId: 'household-fresh',
    })
  })

  it('denies unauthorized rotation and advances/activates exactly one new generation', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority, {
      now: () => new Date(CREATED_AT),
    })
    const enrolled = await enrollForTest(binding, '1111', storage, authority, {
      now: () => new Date(CREATED_AT),
    })
    const deny = vi.fn(() => false)
    const deniedAuthorization: ParentCredentialRotationAuthorization = {
      consumeParentCredentialRotationAuthorization: deny,
    }

    await expect(
      rotateParentPinAuthorized(binding, '2222', deniedAuthorization, options),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    await expect(verifyParentPin(binding, '1111', options)).resolves.toMatchObject({
      status: 'verified',
    })
    expect(deny).toHaveBeenCalledWith({
      operationId: 'parent-pin:rotate',
      binding: parentCredentialBindingReference(binding),
      credentialGeneration: enrolled.generation,
      credentialCreatedAt: CREATED_AT,
    })

    const allow = vi.fn(async () => true)
    const acceptedAuthorization: ParentCredentialRotationAuthorization = {
      consumeParentCredentialRotationAuthorization: allow,
    }
    const rotatedOptions = operationOptions(storage, authority, {
      now: () => new Date(ROTATED_AT),
    })
    await expect(
      rotateParentPinAuthorized(binding, '2222', acceptedAuthorization, rotatedOptions),
    ).resolves.toMatchObject({
      status: 'enrolled',
      generation: enrolled.generation + 1,
      createdAt: CREATED_AT,
      rotatedAt: ROTATED_AT,
    })
    await expect(verifyParentPin(binding, '1111', rotatedOptions)).resolves.toMatchObject({
      status: 'not-verified',
    })
    await expect(verifyParentPin(binding, '2222', rotatedOptions)).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it('does not advance authority when replacement preverification fails', async () => {
    const binding = activeBinding(INSTALLATION_A, 'household-preverify')
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)
    const enrolled = await enrollForTest(binding, '1111', storage, authority)
    const before = authority.snapshot(parentCredentialBindingReference(binding))

    await expect(rotateParentPinAuthorized(
      binding,
      '2222',
      { consumeParentCredentialRotationAuthorization: () => true },
      operationOptions(storage, authority, {
        crypto: failReplacementPreverificationCrypto(),
      }),
    )).rejects.toThrow(/pre-commit verification/)

    expect(authority.snapshot(parentCredentialBindingReference(binding))).toEqual(before)
    expect(enrolled.generation).toBe(before.generation)
    await expect(verifyParentPin(binding, '1111', options)).resolves.toMatchObject({
      status: 'verified',
    })
    await expect(verifyParentPin(binding, '2222', options)).resolves.toMatchObject({
      status: 'not-verified',
    })
  })

  it('recovers an active rotation or recovery record after the primary write crashes', async () => {
    const binding = activeBinding(INSTALLATION_A, 'household-active-cas-crash')
    const storage = new PrimaryWriteFaultStorage(parentCredentialStorageKey(binding))
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority, {
      now: () => new Date(ROTATED_AT),
    })
    const enrolled = await enrollForTest(binding, '1111', storage, authority, {
      now: () => new Date(CREATED_AT),
    })

    storage.failNextPrimaryWrite = true
    await expect(rotateParentPinAuthorized(
      binding,
      '2222',
      { consumeParentCredentialRotationAuthorization: () => true },
      options,
    )).rejects.toMatchObject({ code: 'storage-unavailable' })
    expect(authority.snapshot(parentCredentialBindingReference(binding))).toMatchObject({
      generation: enrolled.generation + 1,
      activeGeneration: enrolled.generation + 1,
      migrationCommitmentBase64: TEST_MIGRATION_COMMITMENT_BASE64,
    })
    await expect(verifyParentPin(binding, '2222', options)).resolves.toMatchObject({
      status: 'verified',
    })
    await expect(verifyParentPin(binding, '1111', options)).resolves.toMatchObject({
      status: 'not-verified',
    })

    const reset = await markParentCredentialResetRequiredAuthorized(
      binding,
      recoveryGrantFor(binding, authority),
      options,
    )
    storage.failNextPrimaryWrite = true
    await expect(recoverParentPinAuthorized(
      binding,
      '3333',
      recoveryGrantFor(binding, authority),
      options,
    )).rejects.toMatchObject({ code: 'storage-unavailable' })
    expect(authority.snapshot(parentCredentialBindingReference(binding))).toMatchObject({
      generation: reset.generation + 1,
      activeGeneration: reset.generation + 1,
      migrationCommitmentBase64: TEST_MIGRATION_COMMITMENT_BASE64,
    })
    await expect(verifyParentPin(binding, '3333', options)).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it('creates a monotonic authoritative tombstone and recovers only with authorization', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const enrolled = await enrollForTest(binding, '4444', storage, authority, {
      now: () => new Date(CREATED_AT),
    })
    const resetOptions = operationOptions(storage, authority, {
      now: () => new Date(ROTATED_AT),
    })
    const deniedReset: ParentInstallationRecoveryAuthorization = {
      consumeParentInstallationRecoveryAuthorization: vi.fn(() => null),
    }
    await expect(
      markParentCredentialResetRequiredAuthorized(binding, deniedReset, resetOptions),
    ).rejects.toMatchObject({ code: 'authorization-required' })

    const allowReset = recoveryGrantFor(binding, authority, () => new Date(ROTATED_AT))
    const reset = await markParentCredentialResetRequiredAuthorized(
      binding,
      allowReset,
      resetOptions,
    )
    expect(reset).toMatchObject({
      status: 'reset-required',
      generation: enrolled.generation + 1,
      rotatedAt: ROTATED_AT,
    })
    const tombstone = await readParentCredentialRecord(binding, resetOptions)
    expect(tombstone?.state).toBe('reset-required')
    expect(authority.snapshot(parentCredentialBindingReference(binding))).toMatchObject({
      generation: reset.generation,
      activeGeneration: null,
    })
    await expect(verifyParentPin(binding, '4444', resetOptions)).resolves.toMatchObject({
      status: 'reset-required',
    })

    const deniedRecovery: ParentInstallationRecoveryAuthorization = {
      consumeParentInstallationRecoveryAuthorization: vi.fn(() => null),
    }
    await expect(
      recoverParentPinAuthorized(binding, '5555', deniedRecovery, resetOptions),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    await expect(verifyParentPin(binding, '5555', resetOptions)).resolves.toMatchObject({
      status: 'reset-required',
    })

    const recovery = recoveryGrantFor(binding, authority, () => new Date(ROTATED_AT))
    const consumeRecovery = vi.spyOn(recovery, 'consumeParentInstallationRecoveryAuthorization')
    const recovered = await recoverParentPinAuthorized(
      binding,
      '5555',
      recovery,
      resetOptions,
    )
    expect(recovered).toMatchObject({
      status: 'enrolled',
      generation: reset.generation + 1,
    })
    expect(consumeRecovery).toHaveBeenCalledWith({
      operationId: 'parent-pin:recover',
      requiredCapability: 'parent_installation:recover',
      binding: parentCredentialBindingReference(binding),
      priorState: 'reset-required',
      priorGeneration: reset.generation,
    })
    await expect(verifyParentPin(binding, '4444', resetOptions)).resolves.toMatchObject({
      status: 'not-verified',
    })
    await expect(verifyParentPin(binding, '5555', resetOptions)).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it.each(['missing', 'corrupt', 'schema-v1'] as const)(
    'allows authorized reset to repair %s local state from external authority',
    async (damage) => {
      const binding = activeBinding(INSTALLATION_A, `household-repair-${damage}`)
      const storage = new MemoryCredentialStorage()
      const authority = new MemoryParentCredentialGenerationAuthority()
      const options = operationOptions(storage, authority, {
        now: () => new Date(ROTATED_AT),
      })
      const enrolled = await enrollForTest(binding, '4444', storage, authority, {
        now: () => new Date(CREATED_AT),
      })
      const key = parentCredentialStorageKey(binding)
      const raw = storage.getItem(key)!
      if (damage === 'missing') storage.removeItem(key)
      if (damage === 'corrupt') storage.setItem(key, '{not-json')
      if (damage === 'schema-v1') {
        storage.setItem(key, JSON.stringify({
          ...(JSON.parse(raw) as Record<string, unknown>),
          schemaVersion: 1,
        }))
      }
      const authorize = recoveryGrantFor(binding, authority)
      const consumeAuthorize = vi.spyOn(authorize, 'consumeParentInstallationRecoveryAuthorization')

      const reset = await markParentCredentialResetRequiredAuthorized(
        binding,
        authorize,
        options,
      )

      expect(consumeAuthorize).toHaveBeenCalledWith({
        operationId: 'parent-pin:reset-required',
        requiredCapability: 'parent_installation:recover',
        binding: parentCredentialBindingReference(binding),
        priorState: 'unavailable',
        priorGeneration: enrolled.generation,
      })
      expect(reset).toMatchObject({
        status: 'reset-required',
        generation: enrolled.generation + 1,
      })
      expect(authority.snapshot(parentCredentialBindingReference(binding))).toMatchObject({
        migrationCommitmentBase64: TEST_MIGRATION_COMMITMENT_BASE64,
      })
      await expect(verifyParentPin(binding, '4444', options)).resolves.toMatchObject({
        status: 'reset-required',
      })
    },
  )

  it('serializes same-binding reset and rotation so stale rotation cannot overwrite a tombstone', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const serialLocks = new SerialLockManager()
    await enrollForTest(binding, '4444', storage, authority, {
      now: () => new Date(CREATED_AT),
    })

    let announceResetAuthorization!: () => void
    let releaseResetAuthorization!: () => void
    const resetAuthorizationEntered = new Promise<void>((resolve) => {
      announceResetAuthorization = resolve
    })
    const resetAuthorizationGate = new Promise<void>((resolve) => {
      releaseResetAuthorization = resolve
    })
    const grantedReset = recoveryGrantFor(binding, authority, () => new Date(ROTATED_AT))
    const resetAuthorization: ParentInstallationRecoveryAuthorization = {
      consumeParentInstallationRecoveryAuthorization: vi.fn(async (context) => {
        announceResetAuthorization()
        await resetAuthorizationGate
        return grantedReset.consumeParentInstallationRecoveryAuthorization(context)
      }),
    }
    const rotationAuthorization = vi.fn(async () => true)
    const serialOptions = operationOptions(storage, authority, {
      lockManager: serialLocks,
      now: () => new Date(ROTATED_AT),
    })

    const resetPromise = markParentCredentialResetRequiredAuthorized(
      binding,
      resetAuthorization,
      serialOptions,
    )
    await resetAuthorizationEntered
    const rotationPromise = rotateParentPinAuthorized(
      binding,
      '2222',
      { consumeParentCredentialRotationAuthorization: rotationAuthorization },
      serialOptions,
    )
    void rotationPromise.catch(() => undefined)
    await Promise.resolve()
    expect(rotationAuthorization).not.toHaveBeenCalled()

    releaseResetAuthorization()
    await expect(resetPromise).resolves.toMatchObject({ status: 'reset-required' })
    await expect(rotationPromise).rejects.toMatchObject({ code: 'credential-missing' })
    expect(rotationAuthorization).not.toHaveBeenCalled()
    expect((await readParentCredentialRecord(binding, serialOptions))?.state).toBe('reset-required')
    expect(new Set(serialLocks.requestedNames).size).toBe(1)
    expect(serialLocks.maxActiveByName.get(serialLocks.requestedNames[0]!)).toBe(1)
  })

  it('fails an in-flight verification closed when reset commits during PBKDF2', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)
    await enrollForTest(binding, '2468', storage, authority)
    const deferred = deferredKdfCrypto()

    const verification = verifyParentPin(
      binding,
      '2468',
      operationOptions(storage, authority, { crypto: deferred.crypto }),
    )
    await deferred.entered
    await markParentCredentialResetRequiredAuthorized(
      binding,
      recoveryGrantFor(binding, authority),
      options,
    )
    deferred.release()

    await expect(verification).resolves.toMatchObject({ status: 'not-verified' })
  })

  it('fails an in-flight verification closed when rotation commits during PBKDF2', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)
    await enrollForTest(binding, '2468', storage, authority)
    const deferred = deferredKdfCrypto()

    const verification = verifyParentPin(
      binding,
      '2468',
      operationOptions(storage, authority, { crypto: deferred.crypto }),
    )
    await deferred.entered
    await rotateParentPinAuthorized(
      binding,
      '8642',
      { consumeParentCredentialRotationAuthorization: () => true },
      options,
    )
    deferred.release()

    await expect(verification).resolves.toMatchObject({ status: 'not-verified' })
    await expect(verifyParentPin(binding, '8642', options)).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it('rejects restoration of an older enrolled record after a newer tombstone', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)
    const enrolled = await enrollForTest(binding, '2468', storage, authority)
    const enrolledRaw = storage.getItem(parentCredentialStorageKey(binding))!

    const reset = await markParentCredentialResetRequiredAuthorized(
      binding,
      recoveryGrantFor(binding, authority),
      options,
    )
    expect(reset.generation).toBe(enrolled.generation + 1)
    storage.setItem(parentCredentialStorageKey(binding), enrolledRaw)

    await expect(verifyParentPin(binding, '2468', options)).resolves.toMatchObject({
      status: 'not-verified',
    })
    await expect(readParentCredentialRecord(binding, options)).rejects.toMatchObject({
      code: 'generation-mismatch',
    })

    const authorizeRepair = recoveryGrantFor(binding, authority)
    const consumeRepair = vi.spyOn(authorizeRepair, 'consumeParentInstallationRecoveryAuthorization')
    const repaired = await markParentCredentialResetRequiredAuthorized(
      binding,
      authorizeRepair,
      options,
    )
    expect(consumeRepair).toHaveBeenCalledWith({
      operationId: 'parent-pin:reset-required',
      requiredCapability: 'parent_installation:recover',
      binding: parentCredentialBindingReference(binding),
      priorState: 'unavailable',
      priorGeneration: reset.generation,
    })
    expect(repaired.generation).toBe(reset.generation + 1)
    await expect(verifyParentPin(binding, '2468', options)).resolves.toMatchObject({
      status: 'reset-required',
    })
  })

  it('rejects wrong generations and same-generation verifier replacement', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority)
    const enrolled = await enrollForTest(binding, '2468', storage, authority)
    const key = parentCredentialStorageKey(binding)
    const original = storage.getItem(key)!
    const parsed = JSON.parse(original) as Record<string, unknown>

    storage.setItem(key, JSON.stringify({ ...parsed, generation: enrolled.generation - 1 }))
    await expect(verifyParentPin(binding, '2468', options)).resolves.toMatchObject({
      status: 'not-verified',
    })

    const verifier = parsed.verifierBase64 as string
    storage.setItem(key, JSON.stringify({
      ...parsed,
      verifierBase64: (verifier[0] === 'A' ? 'B' : 'A') + verifier.slice(1),
    }))
    await expect(verifyParentPin(binding, '2468', options)).resolves.toMatchObject({
      status: 'not-verified',
    })
  })

  it('rejects accessors, hidden password fields, and symbols without executing getters', async () => {
    const binding = activeBinding()
    const record = await createPreparedParentCredentialRecordForTest(binding, '2468', 1)
    let getterCalls = 0
    const costParameters = Object.create(Object.prototype) as Record<string, unknown>
    Object.defineProperty(costParameters, 'iterations', {
      enumerable: true,
      get: () => {
        getterCalls += 1
        return 600_000
      },
    })
    Object.defineProperty(costParameters, 'derivedKeyBytes', {
      enumerable: true,
      value: 32,
    })

    expect(() =>
      parseParentCredentialRecord({ ...record, costParameters }, binding),
    ).toThrow(/violates|malformed/i)
    expect(getterCalls).toBe(0)

    const hiddenPassword = { ...record }
    Object.defineProperty(hiddenPassword, 'password', {
      enumerable: false,
      value: '2468',
    })
    expect(() => parseParentCredentialRecord(hiddenPassword, binding)).toThrow(/unexpected/i)

    const symbolRecord = { ...record, [Symbol('secret')]: '2468' }
    expect(() => parseParentCredentialRecord(symbolRecord, binding)).toThrow(/symbol/i)
    expect(getterCalls).toBe(0)
  })
})

describe('Parent installation claim and recovery authority', () => {
  function pristine() {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const authority = new MemoryParentCredentialGenerationAuthority()
    const options = operationOptions(storage, authority, { now: () => new Date(CREATED_AT) })
    const issuer = new MemoryParentInstallationGrantIssuer(binding, () => new Date(CREATED_AT))
    return { binding, storage, authority, options, issuer }
  }

  async function tombstoned() {
    const context = pristine()
    await enrollForTest(context.binding, '2468', context.storage, context.authority, {
      now: () => new Date(CREATED_AT),
    })
    const reset = await markParentCredentialResetRequiredAuthorized(
      context.binding,
      recoveryGrantFor(context.binding, context.authority, () => new Date(CREATED_AT)),
      context.options,
    )
    return { ...context, reset }
  }

  it('reports setup-required and refuses to enroll a first visitor holding no claim grant', async () => {
    const { binding, options, issuer } = pristine()

    await expect(readParentCredentialState(binding, options)).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
    await expect(
      claimParentPinAuthorized(binding, '2468', issuer.claim, options),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    await expect(verifyParentPin(binding, '2468', options)).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
  })

  it('refuses a first claim and a reset when only a recovery grant exists', async () => {
    const { binding, options, issuer } = pristine()
    issuer.issueRecovery(0)

    await expect(
      claimParentPinAuthorized(binding, '2468', issuer.claim, options),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    // A recovery grant must not reach a first credential through the reset path.
    await expect(
      markParentCredentialResetRequiredAuthorized(binding, issuer.recovery, options),
    ).rejects.toMatchObject({ code: 'credential-missing' })
    await expect(readParentCredentialState(binding, options)).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
  })

  it('enrolls the first Parent credential against a valid claim grant', async () => {
    const { binding, authority, options, issuer } = pristine()
    issuer.issueClaim()

    const claimed = await claimParentPinAuthorized(binding, '2468', issuer.claim, options)
    expect(claimed).toMatchObject({ status: 'enrolled', generation: 1 })
    expect(issuer.consumedContexts[0]).toEqual({
      operationId: 'parent-installation:claim',
      requiredCapability: 'parent_installation:claim',
      binding: parentCredentialBindingReference(binding),
      priorState: 'missing',
      priorGeneration: 0,
    })
    expect(authority.snapshot(parentCredentialBindingReference(binding))).toMatchObject({
      generation: 1,
      activeGeneration: 1,
    })
    await expect(verifyParentPin(binding, '2468', options)).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it('refuses a replayed claim grant', async () => {
    const { binding, options, issuer } = pristine()
    issuer.issueClaim()
    await claimParentPinAuthorized(binding, '2468', issuer.claim, options)

    // The issuer redeems once, so a second consume of the same grant is null.
    await expect(
      claimParentPinAuthorized(binding, '1357', issuer.claim, options),
    ).rejects.toMatchObject({ code: 'credential-conflict' })
    await expect(verifyParentPin(binding, '1357', options)).resolves.toMatchObject({
      status: 'not-verified',
    })
  })

  it('refuses recovery of a tombstone when only a claim grant exists', async () => {
    const { binding, options, issuer } = await tombstoned()
    issuer.issueClaim()

    await expect(
      recoverParentPinAuthorized(binding, '5555', issuer.recovery, options),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    await expect(verifyParentPin(binding, '5555', options)).resolves.toMatchObject({
      status: 'reset-required',
    })
  })

  it('recovers a tombstone against a valid recovery grant', async () => {
    const { binding, options, issuer, reset } = await tombstoned()
    issuer.issueRecovery(reset.generation)

    const recovered = await recoverParentPinAuthorized(binding, '5555', issuer.recovery, options)
    expect(recovered).toMatchObject({ status: 'enrolled', generation: reset.generation + 1 })
    await expect(verifyParentPin(binding, '5555', options)).resolves.toMatchObject({
      status: 'verified',
    })
  })

  it.each([
    ['a different installation', { installationId: createInstallationId(() => INSTALLATION_B) }],
    ['a different household', { householdId: 'household-b' }],
    ['a different dataset epoch', { datasetEpoch: 'dataset-epoch-2' }],
    ['a grant its issuer never redeemed', { status: 'issued' as const }],
  ])('refuses a claim grant bound to %s', async (_label, overrides) => {
    const { binding, options, issuer } = pristine()
    issuer.issueClaim(overrides)

    await expect(
      claimParentPinAuthorized(binding, '2468', issuer.claim, options),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    await expect(readParentCredentialState(binding, options)).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
  })

  it('refuses a claim grant that expired before the operation', async () => {
    const { binding, options } = pristine()
    // Issued well before the operation clock and expired in between, so the
    // issuedAt < expiresAt shape check passes and only expiry can reject.
    const issuer = new MemoryParentInstallationGrantIssuer(
      binding,
      () => new Date('2026-08-11T11:00:00.000Z'),
    )
    issuer.issueClaim({ expiresAt: '2026-08-11T11:30:00.000Z' })

    await expect(
      claimParentPinAuthorized(binding, '2468', issuer.claim, options),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    await expect(readParentCredentialState(binding, options)).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
  })

  it('refuses a claim grant issued for a different purpose', async () => {
    const { binding, options, issuer } = pristine()
    // legacy_upgrade carries the claim capability, so only the purpose check
    // can reject this grant.
    issuer.issueClaim({ purpose: 'legacy_upgrade' })

    await expect(
      claimParentPinAuthorized(binding, '2468', issuer.claim, options),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    await expect(readParentCredentialState(binding, options)).resolves.toMatchObject({
      status: 'parent-setup-required',
    })
  })

  it('refuses a recovery grant bound to a stale generation', async () => {
    const { binding, options, issuer, reset } = await tombstoned()
    issuer.issueRecovery(reset.generation - 1)

    await expect(
      recoverParentPinAuthorized(binding, '5555', issuer.recovery, options),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    await expect(verifyParentPin(binding, '5555', options)).resolves.toMatchObject({
      status: 'reset-required',
    })
  })

  it('cannot restore a superseded enrolled record as current authority through any public API', async () => {
    const { binding, storage, authority, options } = pristine()
    const enrolled = await enrollForTest(binding, '2468', storage, authority, {
      now: () => new Date(CREATED_AT),
    })
    const supersededRaw = storage.getItem(parentCredentialStorageKey(binding))!
    await markParentCredentialResetRequiredAuthorized(
      binding,
      recoveryGrantFor(binding, authority, () => new Date(CREATED_AT)),
      options,
    )

    // Replay the still well-formed, still PIN-matching earlier enrolled record.
    storage.setItem(parentCredentialStorageKey(binding), supersededRaw)
    expect(JSON.parse(supersededRaw)).toMatchObject({
      state: 'enrolled',
      generation: enrolled.generation,
    })
    await expect(verifyParentPin(binding, '2468', options)).resolves.toMatchObject({
      status: 'not-verified',
    })
    await expect(readParentCredentialState(binding, options)).rejects.toMatchObject({
      code: 'generation-mismatch',
    })
  })
})

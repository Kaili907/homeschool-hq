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
import { MemoryCredentialStorage } from './testStorage'
import {
  createParentCredentialRecordForMigration,
  enrollLegacyParentPinForMigration,
  markParentCredentialResetRequiredAuthorized,
  parentCredentialBindingReference,
  parentCredentialStorageKey,
  parentFailedAttemptSubject,
  readParentCredentialRecord,
  readParentCredentialState,
  rotateParentPinAuthorized,
  verifyParentCredentialRecord,
  verifyParentPin,
  type ParentCredentialLockManager,
  type ParentCredentialResetAuthorization,
  type ParentCredentialRotationAuthorization,
} from './parentVault'

const INSTALLATION_A = 'd9428888-122b-4f9b-9424-1f35c63d5750'
const INSTALLATION_B = 'b3d48c11-53bb-4d8f-bb8b-d2f311abf5ef'
const CREATED_AT = '2026-08-11T12:00:00.000Z'
const ROTATED_AT = '2026-08-11T12:01:00.000Z'

function activeBinding(
  installationId = INSTALLATION_A,
  householdId = 'household-a',
): InstallationBinding {
  return {
    schemaVersion: 1,
    bindingId: `binding:${householdId}`,
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

const lockManager = new ImmediateLockManager()

describe('device-local Parent credential vault', () => {
  it('verifies the valid Parent PIN and rejects the wrong PIN', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    await enrollLegacyParentPinForMigration(binding, '2468', { storage })

    await expect(verifyParentPin(binding, '2468', { storage })).resolves.toEqual({
      status: 'verified',
      subject: { kind: 'parent', householdId: 'household-a' },
    })
    await expect(verifyParentPin(binding, '2469', { storage })).resolves.toEqual({
      status: 'not-verified',
      subject: { kind: 'parent', householdId: 'household-a' },
    })
  })

  it('binds verification to the exact installation and household and rejects moved records', async () => {
    const source = activeBinding(INSTALLATION_A, 'household-a')
    const otherInstallation = activeBinding(INSTALLATION_B, 'household-a')
    const otherHousehold = activeBinding(INSTALLATION_A, 'household-b')
    const storage = new MemoryCredentialStorage()
    const sourceRecord = await enrollLegacyParentPinForMigration(source, '1357', {
      storage,
      crypto: deterministicCrypto(0x5a),
    })

    await expect(
      verifyParentCredentialRecord(sourceRecord, source, '1357', {
        crypto: deterministicCrypto(0x5a),
      }),
    ).resolves.toBe(true)
    await expect(
      verifyParentCredentialRecord(sourceRecord, otherInstallation, '1357', {
        crypto: deterministicCrypto(0x5a),
      }),
    ).resolves.toBe(false)
    await expect(
      verifyParentCredentialRecord(sourceRecord, otherHousehold, '1357', {
        crypto: deterministicCrypto(0x5a),
      }),
    ).resolves.toBe(false)

    const sourceRaw = storage.getItem(parentCredentialStorageKey(source))!
    storage.setItem(parentCredentialStorageKey(otherInstallation), sourceRaw)
    await expect(
      verifyParentPin(otherInstallation, '1357', {
        storage,
        crypto: deterministicCrypto(0x5a),
      }),
    ).resolves.toMatchObject({ status: 'not-verified' })

    storage.setItem(
      parentCredentialStorageKey(otherHousehold),
      JSON.stringify({
        ...sourceRecord,
        binding: parentCredentialBindingReference(otherHousehold),
      }),
    )
    await expect(
      verifyParentPin(otherHousehold, '1357', {
        storage,
        crypto: deterministicCrypto(0x5a),
      }),
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
    const record = await enrollLegacyParentPinForMigration(binding, '9753', { storage })
    const raw = storage.getItem(parentCredentialStorageKey(binding))!
    const parsed = JSON.parse(raw) as Record<string, unknown>

    expect(raw).not.toContain('"9753"')
    expect(Object.values(parsed)).not.toContain('9753')
    expect(record).not.toHaveProperty('pin')
    expect(record).not.toHaveProperty('rawPin')
  })

  it.each(['', '123', '12345', '12x4', ' 1234', '1234 '])(
    'preserves the exact four-digit Parent PIN policy for %j',
    async (pin) => {
      await expect(
        createParentCredentialRecordForMigration(activeBinding(), pin, {
          storage: new MemoryCredentialStorage(),
        }),
      ).rejects.toThrow(/exactly four decimal digits/i)
    },
  )

  it('returns a non-authoritative fresh-install status and exact attempt-ledger subject', async () => {
    const binding = activeBinding(INSTALLATION_A, 'household-fresh')
    const storage = new MemoryCredentialStorage()

    expect(readParentCredentialState(binding, { storage })).toEqual({
      status: 'parent-setup-required',
      subject: { kind: 'parent', householdId: 'household-fresh' },
    })
    await expect(verifyParentPin(binding, '1234', { storage })).resolves.toEqual({
      status: 'parent-setup-required',
      subject: { kind: 'parent', householdId: 'household-fresh' },
    })
    expect(parentFailedAttemptSubject(binding)).toEqual({
      kind: 'parent',
      householdId: 'household-fresh',
    })
    expect(storage.entries()).toEqual([])
  })

  it('denies unauthorized rotation and rotates only after authorization is consumed', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    await enrollLegacyParentPinForMigration(binding, '1111', {
      storage,
      now: () => new Date(CREATED_AT),
    })
    const deny = vi.fn(() => false)
    const deniedAuthorization: ParentCredentialRotationAuthorization = {
      consumeParentCredentialRotationAuthorization: deny,
    }

    await expect(
      rotateParentPinAuthorized(binding, '2222', deniedAuthorization, {
        storage,
        lockManager,
      }),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    await expect(verifyParentPin(binding, '1111', { storage })).resolves.toMatchObject({
      status: 'verified',
    })
    expect(deny).toHaveBeenCalledWith({
      operationId: 'parent-pin:rotate',
      binding: parentCredentialBindingReference(binding),
      credentialCreatedAt: CREATED_AT,
    })

    const allow = vi.fn(async () => true)
    const acceptedAuthorization: ParentCredentialRotationAuthorization = {
      consumeParentCredentialRotationAuthorization: allow,
    }
    await expect(
      rotateParentPinAuthorized(binding, '2222', acceptedAuthorization, {
        storage,
        lockManager,
        now: () => new Date(ROTATED_AT),
      }),
    ).resolves.toMatchObject({
      status: 'enrolled',
      createdAt: CREATED_AT,
      rotatedAt: ROTATED_AT,
      subject: { kind: 'parent', householdId: 'household-a' },
    })
    await expect(verifyParentPin(binding, '1111', { storage })).resolves.toMatchObject({
      status: 'not-verified',
    })
    await expect(verifyParentPin(binding, '2222', { storage })).resolves.toMatchObject({
      status: 'verified',
    })
    expect(allow).toHaveBeenCalledOnce()
  })

  it('denies unauthorized reset and makes an authorized tombstone fail closed', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const enrolled = await enrollLegacyParentPinForMigration(binding, '4444', {
      storage,
      now: () => new Date(CREATED_AT),
    })
    const deniedAuthorization: ParentCredentialResetAuthorization = {
      consumeParentCredentialResetAuthorization: vi.fn(() => false),
    }

    await expect(
      markParentCredentialResetRequiredAuthorized(binding, deniedAuthorization, {
        storage,
        lockManager,
      }),
    ).rejects.toMatchObject({ code: 'authorization-required' })
    await expect(verifyParentPin(binding, '4444', { storage })).resolves.toMatchObject({
      status: 'verified',
    })

    const allow = vi.fn(async () => true)
    const acceptedAuthorization: ParentCredentialResetAuthorization = {
      consumeParentCredentialResetAuthorization: allow,
    }
    await expect(
      markParentCredentialResetRequiredAuthorized(binding, acceptedAuthorization, {
        storage,
        lockManager,
        now: () => new Date(ROTATED_AT),
      }),
    ).resolves.toMatchObject({
      status: 'reset-required',
      createdAt: CREATED_AT,
      rotatedAt: ROTATED_AT,
    })

    const tombstone = readParentCredentialRecord(binding, { storage })!
    expect(tombstone.state).toBe('reset-required')
    expect(tombstone.saltBase64).not.toBe(enrolled.saltBase64)
    expect(tombstone.verifierBase64).not.toBe(enrolled.verifierBase64)
    await expect(
      verifyParentCredentialRecord(tombstone, binding, '4444', { storage }),
    ).resolves.toBe(false)
    await expect(verifyParentPin(binding, '4444', { storage })).resolves.toMatchObject({
      status: 'reset-required',
    })
    await expect(verifyParentPin(binding, '0000', { storage })).resolves.toMatchObject({
      status: 'reset-required',
    })
    expect(allow).toHaveBeenCalledWith({
      operationId: 'parent-pin:reset-required',
      binding: parentCredentialBindingReference(binding),
      priorState: 'enrolled',
    })
  })

  it('serializes same-binding reset and rotation so stale rotation cannot overwrite a tombstone', async () => {
    const binding = activeBinding()
    const storage = new MemoryCredentialStorage()
    const serialLocks = new SerialLockManager()
    await enrollLegacyParentPinForMigration(binding, '4444', {
      storage,
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
    const resetAuthorization: ParentCredentialResetAuthorization = {
      consumeParentCredentialResetAuthorization: vi.fn(async () => {
        announceResetAuthorization()
        await resetAuthorizationGate
        return true
      }),
    }
    const rotationAuthorization = vi.fn(async () => true)

    const resetPromise = markParentCredentialResetRequiredAuthorized(
      binding,
      resetAuthorization,
      {
        storage,
        lockManager: serialLocks,
        now: () => new Date(ROTATED_AT),
      },
    )
    await resetAuthorizationEntered

    const rotationPromise = rotateParentPinAuthorized(
      binding,
      '2222',
      { consumeParentCredentialRotationAuthorization: rotationAuthorization },
      {
        storage,
        lockManager: serialLocks,
        now: () => new Date(ROTATED_AT),
      },
    )
    void rotationPromise.catch(() => undefined)
    await Promise.resolve()
    expect(rotationAuthorization).not.toHaveBeenCalled()

    releaseResetAuthorization()
    await expect(resetPromise).resolves.toMatchObject({ status: 'reset-required' })
    await expect(rotationPromise).rejects.toMatchObject({ code: 'credential-missing' })
    expect(rotationAuthorization).not.toHaveBeenCalled()
    expect(readParentCredentialRecord(binding, { storage })?.state).toBe('reset-required')
    expect(new Set(serialLocks.requestedNames).size).toBe(1)
    expect(serialLocks.maxActiveByName.get(serialLocks.requestedNames[0]!)).toBe(1)
  })
})

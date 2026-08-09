import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  isAuthorityEstablishmentForbidden,
  LEARNER_CREDENTIAL_SCHEMA_VERSION,
} from '../contracts'
import { MemoryCredentialStorage } from './testStorage'
import {
  createLearnerCredentialRecord,
  CredentialVaultError,
  deleteLearnerCredential,
  enrollLegacyCredential,
  enrollLearnerPin,
  learnerCredentialStorageKey,
  markLearnerCredentialResetRequired,
  parseLearnerCredentialRecord,
  readLearnerCredential,
  rotateLearnerPin,
  type StoredLearnerCredentialRecord,
  verifyLearnerCredentialRecord,
  verifyLearnerPin,
} from './vault'

describe('device-local learner credential vault', () => {
  let template: StoredLearnerCredentialRecord

  beforeAll(async () => {
    template = await createLearnerCredentialRecord('template-profile', '1234', {
      now: () => new Date('2026-08-09T12:00:00.000Z'),
    })
  })

  it('uses a unique cryptographic salt per profile for the same PIN', async () => {
    const left = await createLearnerCredentialRecord('p1', '2468')
    const right = await createLearnerCredentialRecord('p2', '2468')

    expect(left.saltBase64).not.toBe(right.saltBase64)
    expect(left.verifierBase64).not.toBe(right.verifierBase64)
  })

  it('verifies deterministically and fails closed for wrong or malformed PINs', async () => {
    const storage = new MemoryCredentialStorage()
    await enrollLearnerPin('p1', '2468', { storage })

    await expect(verifyLearnerPin('p1', '2468', { storage })).resolves.toBe(true)
    await expect(verifyLearnerPin('p1', '2469', { storage })).resolves.toBe(false)
    await expect(verifyLearnerPin('p1', '24680', { storage })).resolves.toBe(false)
  })

  it('never persists the plaintext PIN in the vault record', async () => {
    const storage = new MemoryCredentialStorage()
    const record = await enrollLearnerPin('p1', '1357', { storage })
    const raw = storage.getItem(learnerCredentialStorageKey('p1'))!
    const parsed = JSON.parse(raw) as Record<string, unknown>

    expect(raw).not.toContain('"1357"')
    expect(Object.values(parsed)).not.toContain('1357')
    expect(record).not.toHaveProperty('pin')
    expect(record).not.toHaveProperty('rawPin')
  })

  it('rejects malformed, extra-field, and profile-mismatched records', () => {
    const storage = new MemoryCredentialStorage()
    const key = learnerCredentialStorageKey('p1')
    storage.setItem(key, '{broken')
    expect(() => readLearnerCredential('p1', { storage })).toThrow(/valid JSON/i)

    storage.setItem(key, JSON.stringify({ ...template, profileId: 'p1', pin: '1234' }))
    expect(() => readLearnerCredential('p1', { storage })).toThrow(/unexpected fields/i)

    storage.setItem(key, JSON.stringify({ ...template, profileId: 'p2' }))
    expect(() => readLearnerCredential('p1', { storage })).toThrow(/contract/i)
  })

  it('rejects unknown schema, verifier, and cost-parameter versions', () => {
    for (const mutation of [
      { schemaVersion: 2 },
      { verifierSchemeVersion: 2 },
      { costParametersVersion: 2 },
    ]) {
      expect(() =>
        parseLearnerCredentialRecord({ ...template, ...mutation }),
      ).toThrowError(expect.objectContaining<Partial<CredentialVaultError>>({
        code: 'unsupported-version',
      }))
    }
    expect(template.schemaVersion).toBe(LEARNER_CREDENTIAL_SCHEMA_VERSION)
  })

  it('rotates with a fresh salt, invalidates the old PIN, and verifies deletion', async () => {
    const storage = new MemoryCredentialStorage()
    await enrollLearnerPin('p1', '1111', {
      storage,
      now: () => new Date('2026-08-09T12:00:00.000Z'),
    })
    const before = readLearnerCredential('p1', { storage })!
    const after = await rotateLearnerPin('p1', '1111', '2222', {
      storage,
      now: () => new Date('2026-08-09T12:01:00.000Z'),
    })

    expect(after.createdAt).toBe(before.createdAt)
    expect(after.rotatedAt).toBe('2026-08-09T12:01:00.000Z')
    expect(after.saltBase64).not.toBe(before.saltBase64)
    await expect(verifyLearnerPin('p1', '1111', { storage })).resolves.toBe(false)
    await expect(verifyLearnerPin('p1', '2222', { storage })).resolves.toBe(true)

    deleteLearnerCredential('p1', { storage })
    expect(readLearnerCredential('p1', { storage })).toBeNull()
  })

  it('uses reset-required records only for learner convenience-lock state', async () => {
    const storage = new MemoryCredentialStorage()
    const reset = await markLearnerCredentialResetRequired('p1', { storage })

    expect(reset.state).toBe('reset-required')
    await expect(verifyLearnerPin('p1', '0000', { storage })).resolves.toBe(false)
    expect(JSON.stringify(reset)).not.toMatch(/admin|staff|study|guardian/i)
    expect(isAuthorityEstablishmentForbidden('learner', 'admin')).toBe(true)
    expect(isAuthorityEstablishmentForbidden('learner', 'study-guardian')).toBe(true)
  })

  it('replaces enrolled verifier material with a fresh reset tombstone', async () => {
    const storage = new MemoryCredentialStorage()
    const enrolled = await enrollLearnerPin('p1', '1234', { storage })
    const reset = await markLearnerCredentialResetRequired('p1', { storage })
    const durableRaw = storage.getItem(learnerCredentialStorageKey('p1'))!

    expect(reset.state).toBe('reset-required')
    expect(reset.saltBase64).not.toBe(enrolled.saltBase64)
    expect(reset.verifierBase64).not.toBe(enrolled.verifierBase64)
    expect(durableRaw).not.toContain(enrolled.saltBase64)
    expect(durableRaw).not.toContain(enrolled.verifierBase64)
    const importKey = vi.fn()
    await expect(verifyLearnerPin('p1', '1234', {
      storage,
      crypto: {
        getRandomValues: vi.fn(),
        subtle: { importKey } as unknown as SubtleCrypto,
      },
    })).resolves.toBe(false)
    expect(importKey).not.toHaveBeenCalled()
    await expect(verifyLearnerPin('p1', '0000', { storage })).resolves.toBe(false)
    await expect(verifyLearnerPin('p1', '9999', { storage })).resolves.toBe(false)
  })

  it('exposes an awaitable legacy enrollment handoff with verified durability', async () => {
    const storage = new MemoryCredentialStorage()
    const enrollment = enrollLegacyCredential('p1', '2468', { storage })

    expect(enrollment).toBeInstanceOf(Promise)
    expect(readLearnerCredential('p1', { storage })).toBeNull()
    await expect(enrollment).resolves.toMatchObject({
      profileId: 'p1',
      state: 'enrolled',
    })
    await expect(verifyLearnerPin('p1', '2468', { storage })).resolves.toBe(true)
  })

  it('rejects malformed UTF-16 profile IDs without leaking URIError', () => {
    for (const profileId of ['\ud800', '\udc00', `learner-\ud800`]) {
      try {
        learnerCredentialStorageKey(profileId)
        throw new Error('Expected malformed profile ID to be rejected.')
      } catch (cause) {
        expect(cause).toBeInstanceOf(CredentialVaultError)
        expect(cause).not.toBeInstanceOf(URIError)
        expect(cause).toMatchObject({ code: 'invalid-profile-id' })
      }
    }

    expect(learnerCredentialStorageKey('learner-\ud83d\ude00')).not.toBe(
      learnerCredentialStorageKey('learner-\ud83d\ude01'),
    )
  })

  it('rejects a credential record relabeled with a malformed profile ID', async () => {
    const enrolled = await createLearnerCredentialRecord('profile-a', '1234')
    const relabeled = { ...enrolled, profileId: '\ud800' }

    try {
      parseLearnerCredentialRecord(relabeled)
      throw new Error('Expected malformed record profile ID to be rejected.')
    } catch (cause) {
      expect(cause).toBeInstanceOf(CredentialVaultError)
      expect(cause).not.toBeInstanceOf(URIError)
      expect(cause).toMatchObject({ code: 'invalid-profile-id' })
    }
    await expect(
      verifyLearnerCredentialRecord(
        relabeled as StoredLearnerCredentialRecord,
        '1234',
      ),
    ).resolves.toBe(false)
  })

  it('preserves valid Unicode profile IDs as distinct credential identities', async () => {
    const composed = 'learner-\u00e9-\ud83d\ude00'
    const decomposed = 'learner-e\u0301-\ud83d\ude00'
    const composedRecord = await createLearnerCredentialRecord(composed, '1234')
    const decomposedRecord = await createLearnerCredentialRecord(decomposed, '5678')

    expect(learnerCredentialStorageKey(composed)).not.toBe(
      learnerCredentialStorageKey(decomposed),
    )
    expect(parseLearnerCredentialRecord(composedRecord).profileId).toBe(composed)
    expect(parseLearnerCredentialRecord(decomposedRecord).profileId).toBe(decomposed)
    await expect(
      verifyLearnerCredentialRecord(composedRecord, '1234'),
    ).resolves.toBe(true)
    await expect(
      verifyLearnerCredentialRecord(decomposedRecord, '5678'),
    ).resolves.toBe(true)
  })
})

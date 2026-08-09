import { beforeAll, describe, expect, it } from 'vitest'
import {
  isAuthorityEstablishmentForbidden,
  LEARNER_CREDENTIAL_SCHEMA_VERSION,
} from '../contracts'
import { MemoryCredentialStorage } from './testStorage'
import {
  createLearnerCredentialRecord,
  CredentialVaultError,
  deleteLearnerCredential,
  enrollLearnerPin,
  learnerCredentialStorageKey,
  markLearnerCredentialResetRequired,
  parseLearnerCredentialRecord,
  readLearnerCredential,
  rotateLearnerPin,
  type StoredLearnerCredentialRecord,
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
})

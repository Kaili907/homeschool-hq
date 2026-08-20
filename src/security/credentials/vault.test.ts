import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  CANONICAL_PROFILE_IDS,
  isAuthorityEstablishmentForbidden,
  LEARNER_CREDENTIAL_SCHEMA_VERSION,
  LEARNER_PIN_VERIFIER_SCHEME_VERSION,
} from '../contracts'
import { LEARNER_PIN_VERIFIER_DOMAIN, type PinVerifierCrypto } from './pinVerifier'
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

describe('device-local learner credential vault', () => {
  let template: StoredLearnerCredentialRecord

  beforeAll(async () => {
    template = await createLearnerCredentialRecord('p1', '1234', {
      now: () => new Date('2026-08-09T12:00:00.000Z'),
    })
  })

  it('uses a unique cryptographic salt per profile for the same PIN', async () => {
    const left = await createLearnerCredentialRecord('p1', '2468')
    const right = await createLearnerCredentialRecord('p2', '2468')

    expect(left.saltBase64).not.toBe(right.saltBase64)
    expect(left.verifierBase64).not.toBe(right.verifierBase64)
  })

  it('binds the same PIN and deterministic salt to the exact profile ID', async () => {
    const left = await createLearnerCredentialRecord('p1', '1234', {
      crypto: deterministicCrypto(0x5a),
    })
    const right = await createLearnerCredentialRecord('p2', '1234', {
      crypto: deterministicCrypto(0x5a),
    })

    expect(left.saltBase64).toBe(right.saltBase64)
    expect(left.verifierBase64).not.toBe(right.verifierBase64)
    expect(left.verifierSchemeVersion).toBe(LEARNER_PIN_VERIFIER_SCHEME_VERSION)
    expect(LEARNER_PIN_VERIFIER_DOMAIN).toBe('manuel-academy:learner-pin:v2')
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
    for (const mutation of [{ schemaVersion: 2 }, { verifierSchemeVersion: 1 }, { costParametersVersion: 2 }]) {
      expect(() => parseLearnerCredentialRecord({ ...template, ...mutation })).toThrowError(
        expect.objectContaining<Partial<CredentialVaultError>>({
          code: 'unsupported-version',
        }),
      )
    }
    expect(template.schemaVersion).toBe(LEARNER_CREDENTIAL_SCHEMA_VERSION)
    expect(template.verifierSchemeVersion).toBe(LEARNER_PIN_VERIFIER_SCHEME_VERSION)
  })

  it('treats a genuine prior unbound verifier as non-authoritative', async () => {
    const storage = new MemoryCredentialStorage()
    // Generated from the exact scheme-v1 implementation in commit 087e79f:
    // PBKDF2-SHA256 over raw UTF-8 PIN "1234", a 16-byte 0x5a salt,
    // 600,000 iterations, and a 32-byte result. Production v1 verification is
    // intentionally not restored merely to create this historical fixture.
    const unbound = {
      ...template,
      verifierSchemeVersion: 1,
      saltBase64: 'WlpaWlpaWlpaWlpaWlpaWg==',
      verifierBase64: '/W6yvXqhSUrO7R+fJY1R4NtLM+fJ9bwGktEYtBUtFyM=',
    }

    expect(() => parseLearnerCredentialRecord(unbound)).toThrowError(
      expect.objectContaining<Partial<CredentialVaultError>>({
        code: 'unsupported-version',
      }),
    )
    await expect(verifyLearnerCredentialRecord(unbound as StoredLearnerCredentialRecord, '1234')).resolves.toBe(false)
    await expect(verifyLearnerCredentialRecord(unbound as StoredLearnerCredentialRecord, '9999')).resolves.toBe(false)
    storage.setItem(learnerCredentialStorageKey(template.profileId), JSON.stringify(unbound))
    await expect(verifyLearnerPin(template.profileId, '1234', { storage })).resolves.toBe(false)
    await expect(verifyLearnerPin(template.profileId, '9999', { storage })).resolves.toBe(false)
  })

  it('fails closed for malformed stored credential material', async () => {
    const storage = new MemoryCredentialStorage()
    storage.setItem(
      learnerCredentialStorageKey('p1'),
      JSON.stringify({
        ...template,
        profileId: 'p1',
        verifierBase64: 'not-base64',
      }),
    )

    await expect(verifyLearnerPin('p1', '1234', { storage })).resolves.toBe(false)
  })

  it('propagates operational storage read failures', async () => {
    const operationalFailure = new Error('credential storage offline')
    const storage = {
      getItem: vi.fn(() => {
        throw operationalFailure
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }

    await expect(verifyLearnerPin('p1', '1234', { storage })).rejects.toMatchObject({
      code: 'storage-unavailable',
    })
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

    const relabeled = { ...after, profileId: 'p2' }
    await expect(verifyLearnerCredentialRecord(relabeled, '2222')).resolves.toBe(false)
    storage.setItem(learnerCredentialStorageKey('p2'), JSON.stringify(relabeled))
    await expect(verifyLearnerPin('p2', '2222', { storage })).resolves.toBe(false)

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
    await expect(
      verifyLearnerPin('p1', '1234', {
        storage,
        crypto: {
          getRandomValues: vi.fn(),
          subtle: { importKey } as unknown as SubtleCrypto,
        },
      }),
    ).resolves.toBe(false)
    expect(importKey).not.toHaveBeenCalled()
    await expect(verifyLearnerPin('p1', '0000', { storage })).resolves.toBe(false)
    await expect(verifyLearnerPin('p1', '9999', { storage })).resolves.toBe(false)
  })

  it('exposes an awaitable legacy enrollment handoff with verified durability', async () => {
    const storage = new MemoryCredentialStorage()
    const enrollment = enrollLegacyCredential('p1', '2468', { storage })

    expect(enrollment).toBeInstanceOf(Promise)
    expect(readLearnerCredential('p1', { storage })).toBeNull()
    const enrolled = await enrollment
    expect(enrolled).toMatchObject({
      profileId: 'p1',
      state: 'enrolled',
      verifierSchemeVersion: LEARNER_PIN_VERIFIER_SCHEME_VERSION,
    })
    await expect(verifyLearnerPin('p1', '2468', { storage })).resolves.toBe(true)
    await expect(verifyLearnerCredentialRecord({ ...enrolled, profileId: 'p2' }, '2468')).resolves.toBe(false)
  })

  it.each(CANONICAL_PROFILE_IDS)('accepts canonical profile ID %s', (profileId) => {
    expect(learnerCredentialStorageKey(profileId)).toBe(`homeschool-hq:security:learner-credentials:v1:${profileId}`)
  })

  it.each(['P1', 'p0', 'p6', 'p01', ' p1', 'p1 ', '\ud83d\ude00', '\u00e9', 'e\u0301', '', '\ud800', '\udc00'])(
    'rejects unsupported profile ID %j for storage, creation, and authentication',
    async (profileId) => {
      expect(() => learnerCredentialStorageKey(profileId)).toThrowError(
        expect.objectContaining<Partial<CredentialVaultError>>({
          code: 'invalid-profile-id',
        }),
      )
      await expect(createLearnerCredentialRecord(profileId, '1234')).rejects.toMatchObject({
        code: 'invalid-profile-id',
      })
      await expect(
        verifyLearnerPin(profileId, '1234', {
          storage: new MemoryCredentialStorage(),
        }),
      ).rejects.toMatchObject({ code: 'invalid-profile-id' })
    },
  )

  it('rejects a credential record relabeled with an unsupported profile ID', async () => {
    const enrolled = await createLearnerCredentialRecord('p1', '1234')
    const relabeled = { ...enrolled, profileId: '\ud800' }

    expect(() => parseLearnerCredentialRecord(relabeled)).toThrowError(
      expect.objectContaining<Partial<CredentialVaultError>>({
        code: 'invalid-profile-id',
      }),
    )
    await expect(verifyLearnerCredentialRecord(relabeled, '1234')).resolves.toBe(false)
  })

  it('rejects a valid p1 credential copied and relabeled to p2', async () => {
    const storage = new MemoryCredentialStorage()
    await enrollLearnerPin('p1', '1234', { storage })
    const enrolled = readLearnerCredential('p1', { storage })!
    const relabeled = { ...enrolled, profileId: 'p2' }
    const parsed = parseLearnerCredentialRecord(relabeled)

    expect(parsed.profileId).toBe('p2')
    await expect(verifyLearnerCredentialRecord(parsed, '1234')).resolves.toBe(false)

    storage.setItem(learnerCredentialStorageKey('p2'), JSON.stringify(relabeled))
    await expect(verifyLearnerPin('p2', '1234', { storage })).resolves.toBe(false)
  })

  it('fails closed across the canonical profile and PIN identity matrix', async () => {
    const profileA = await createLearnerCredentialRecord('p1', '1234', {
      crypto: deterministicCrypto(0x33),
    })
    const profileB = await createLearnerCredentialRecord('p2', '5678', {
      crypto: deterministicCrypto(0x33),
    })
    const samePinB = await createLearnerCredentialRecord('p2', '1234', {
      crypto: deterministicCrypto(0x33),
    })

    await expect(verifyLearnerCredentialRecord(profileA, '1234')).resolves.toBe(true)
    await expect(verifyLearnerCredentialRecord({ ...profileA, profileId: 'p2' }, '1234')).resolves.toBe(false)
    await expect(verifyLearnerCredentialRecord(profileA, '9999')).resolves.toBe(false)
    await expect(verifyLearnerCredentialRecord({ ...profileB, profileId: 'p1' }, '5678')).resolves.toBe(false)
    await expect(verifyLearnerCredentialRecord(samePinB, '1234')).resolves.toBe(true)
    await expect(verifyLearnerCredentialRecord({ ...samePinB, profileId: 'p1' }, '1234')).resolves.toBe(false)
    expect(profileA.verifierBase64).not.toBe(samePinB.verifierBase64)
  })
})

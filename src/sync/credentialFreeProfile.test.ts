import { describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../migration'
import type { Profile } from '../types'
import {
  CredentialBearingProfileError,
  credentialFreeProfileFingerprint,
  readEducationalProfile,
  reconcileStoredProfileFingerprint,
  serializeCredentialFreeEducationalProfile,
} from './credentialFreeProfile'
import { profileHash } from './engine'

const legacyProfile = (pin = '1234'): Profile => ({
  ...emptyProfile('p1', 'Ada', '5'),
  pin,
  workingLevels: { mathematics: '5' },
})

function allNormalizedKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allNormalizedKeys)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, child]) => [
    key.replace(/[-_]/g, '').toLowerCase(),
    ...allNormalizedKeys(child),
  ])
}

describe('credential-free educational profile serializer', () => {
  it('constructs the explicit educational allowlist without any PIN or credential material', () => {
    const serialized = serializeCredentialFreeEducationalProfile(legacyProfile())
    expect(serialized).toMatchObject({
      id: 'p1',
      name: 'Ada',
      grade: '5',
      workingLevels: { mathematics: '5' },
    })
    expect(Object.prototype.hasOwnProperty.call(serialized, 'pin')).toBe(false)
    expect(JSON.stringify(serialized)).not.toContain('1234')
    expect(allNormalizedKeys(serialized)).not.toEqual(
      expect.arrayContaining([
        'pin',
        'verifier',
        'salt',
        'recoverysecret',
        'activelearnersession',
        'credentials',
      ]),
    )
  })

  it.each([
    ['top-level alias', { raw_pin: '1234' }],
    ['nested verifier', { harmlessExtension: { pin_verifier: 'hash' } }],
    ['nested credential container', { harmlessExtension: { credentials: { learner: 'secret' } } }],
    ['nested recovery secret', { harmlessExtension: [{ recovery_secret: 'secret' }] }],
    ['nested active session', { harmlessExtension: { active_learner_session: 'token' } }],
  ])('rejects %s instead of silently deleting it', (_label, injection) => {
    const candidate = Object.assign(legacyProfile(), injection) as Profile
    expect(() => serializeCredentialFreeEducationalProfile(candidate)).toThrow(
      CredentialBearingProfileError,
    )
  })

  it('rejects an unapproved educational field instead of silently dropping it', () => {
    const candidate = Object.assign(legacyProfile(), {
      futureEducationalState: { completed: true },
    }) as Profile
    expect(() => serializeCredentialFreeEducationalProfile(candidate)).toThrow(
      /unapproved synchronization field/i,
    )
  })
})

describe('dual profile reader and legacy credential handoff', () => {
  it('sanitizes a legacy row and exposes the raw PIN only through a one-use local handoff', () => {
    const read = readEducationalProfile(legacyProfile('2468'))
    expect(read.ok).toBe(true)
    if (!read.ok) return

    expect(read.source).toBe('legacy')
    expect(Object.prototype.hasOwnProperty.call(read.profile, 'pin')).toBe(false)
    expect(JSON.stringify(read)).not.toContain('2468')
    expect(read.legacyCredentialHandoff?.toJSON()).toMatchObject({
      kind: 'legacy-pin',
      profileId: 'p1',
      migrationRequired: true,
      secret: '[redacted]',
    })

    const localVaultConsumer = vi.fn()
    read.legacyCredentialHandoff?.consume(localVaultConsumer)
    expect(localVaultConsumer).toHaveBeenCalledWith('2468')
    expect(read.legacyCredentialHandoff?.consumed).toBe(true)
    expect(() => read.legacyCredentialHandoff?.consume(localVaultConsumer)).toThrow(
      /already been consumed/i,
    )
    expect(JSON.stringify(read)).not.toContain('2468')
  })

  it('reads a credential-free v2 row without manufacturing a credential handoff', () => {
    const v2 = serializeCredentialFreeEducationalProfile(legacyProfile())
    const read = readEducationalProfile(v2)
    expect(read).toEqual({
      ok: true,
      source: 'credential-free-v2',
      profile: v2,
      legacyCredentialHandoff: null,
    })
  })

  it('never republishes a legacy PIN into a later serialization', () => {
    const read = readEducationalProfile(legacyProfile('1357'))
    expect(read.ok).toBe(true)
    if (!read.ok) return
    const compatibilityModel = { ...read.profile, pin: '' } as Profile
    const republished = serializeCredentialFreeEducationalProfile(compatibilityModel)
    expect(JSON.stringify(republished)).not.toContain('1357')
    expect(Object.prototype.hasOwnProperty.call(republished, 'pin')).toBe(false)
  })

  it('rejects credential aliases in both legacy and credential-free rows', () => {
    const legacy = {
      ...legacyProfile(),
      academy: { nested: { pinSalt: 'salt' } },
    }
    const credentialFree = {
      ...serializeCredentialFreeEducationalProfile(legacyProfile()),
      extension: { learner_pin: '9999' },
    }
    expect(readEducationalProfile(legacy)).toMatchObject({
      ok: false,
      classification: 'credential-bearing-payload-rejection',
    })
    expect(readEducationalProfile(credentialFree)).toMatchObject({
      ok: false,
      classification: 'credential-bearing-payload-rejection',
    })
  })

  it('rejects malformed legacy PIN handoff material', () => {
    expect(
      readEducationalProfile({ ...legacyProfile(), pin: 'not-a-pin' }),
    ).toMatchObject({ ok: false, classification: 'invalid-profile' })
  })
})

describe('credential-free canonical profile fingerprinting', () => {
  it('uses a distinct v2 domain and excludes the legacy PIN input', () => {
    const first = legacyProfile('1111')
    const second = legacyProfile('9999')
    expect(credentialFreeProfileFingerprint(first)).toMatch(
      /^academy-profile-v2:[0-9a-f]{8}$/,
    )
    expect(credentialFreeProfileFingerprint(first)).toBe(
      credentialFreeProfileFingerprint(second),
    )
    expect(profileHash(first)).not.toBe(profileHash(second))
    expect(credentialFreeProfileFingerprint(first)).not.toBe(profileHash(first))
  })

  it('flags an old credential-bearing hash as ambiguous review input', () => {
    const profile = legacyProfile('2468')
    expect(
      reconcileStoredProfileFingerprint(profile, profileHash(profile)),
    ).toMatchObject({
      kind: 'legacy-credential-input-ambiguous',
      requiresReview: true,
    })
    const current = credentialFreeProfileFingerprint(profile)
    expect(reconcileStoredProfileFingerprint(profile, current)).toEqual({
      kind: 'credential-free-match',
      credentialFreeFingerprint: current,
      requiresReview: false,
    })
    expect(reconcileStoredProfileFingerprint(profile, 'unknown')).toMatchObject({
      kind: 'mismatch',
      requiresReview: true,
    })
  })
})

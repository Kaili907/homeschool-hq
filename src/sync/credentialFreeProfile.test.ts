import { describe, expect, it, vi } from 'vitest'
import { emptyProfile } from '../migration'
import type { CredentialFreeEducationalProfile } from '../security/contracts'
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

const missionItem = (extra: Record<string, unknown> = {}) => ({
  id: 'mission-1',
  label: 'Write about why a password should stay private.',
  done: false,
  ...extra,
})

describe('credential-free educational profile serializer', () => {
  it('constructs the explicit educational allowlist without any PIN or credential material', () => {
    const serialized =
      serializeCredentialFreeEducationalProfile(legacyProfile())
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
    ['top level', { parentPin: '9876' }],
    [
      'one level deep',
      { tutor: { voiceOptIn: true, accessToken: 'session-secret' } },
    ],
    [
      'multiple levels deep',
      {
        missions: {
          '2026-08-09': {
            items: [missionItem({ sessionToken: 'session-secret' })],
          },
        },
      },
    ],
    [
      'array element',
      {
        serviceLog: [
          {
            id: 'service-1',
            date: '2026-08-09',
            org: 'Library',
            hours: 1,
            note: 'Shelved books',
            approved: true,
            createdAt: '2026-08-09T12:00:00.000Z',
            refreshToken: 'session-secret',
          },
        ],
      },
    ],
    [
      'record value',
      {
        skills: {
          fractions: {
            attempts: 1,
            correct: 1,
            mastery: 100,
            pinHash: 'session-secret',
          },
        },
      },
    ],
    [
      'recovery token',
      { attendance: { log: [], recoveryToken: 'session-secret' } },
    ],
  ])('rejects %s instead of silently deleting it', (_label, injection) => {
    const candidate = Object.assign(legacyProfile(), injection) as Profile
    expect(() => serializeCredentialFreeEducationalProfile(candidate)).toThrow(
      CredentialBearingProfileError,
    )
  })

  it('allows security words in learner-authored educational text values', () => {
    const candidate = {
      ...legacyProfile(),
      missions: {
        '2026-08-09': { items: [missionItem()] },
      },
    }
    expect(
      serializeCredentialFreeEducationalProfile(candidate).missions,
    ).toEqual(candidate.missions)
  })

  it('accepts the credential-free educational representation directly', () => {
    const credentialFree: CredentialFreeEducationalProfile = {
      ...serializeCredentialFreeEducationalProfile(legacyProfile()),
    }
    expect(serializeCredentialFreeEducationalProfile(credentialFree)).toEqual(
      credentialFree,
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
  it('sanitizes a legacy row and exposes the raw PIN only through an awaited one-use local handoff', async () => {
    const read = readEducationalProfile(legacyProfile('2468'))
    expect(read.ok).toBe(true)
    if (!read.ok) return

    expect(read.source).toBe('legacy')
    expect(Object.prototype.hasOwnProperty.call(read.profile, 'pin')).toBe(
      false,
    )
    expect(JSON.stringify(read)).not.toContain('2468')
    expect(read.legacyCredentialHandoff?.toJSON()).toMatchObject({
      kind: 'legacy-pin',
      profileId: 'p1',
      migrationRequired: true,
      secret: '[redacted]',
    })

    const localVaultConsumer = vi.fn(async () => undefined)
    await read.legacyCredentialHandoff?.consume(localVaultConsumer)
    expect(localVaultConsumer).toHaveBeenCalledWith('p1', '2468')
    expect(read.legacyCredentialHandoff?.consumed).toBe(true)
    await expect(
      read.legacyCredentialHandoff?.consume(localVaultConsumer),
    ).rejects.toThrow(/already been consumed/i)
    expect(JSON.stringify(read)).not.toContain('2468')
  })

  it('retains a failed async legacy enrollment only for a safe retry', async () => {
    const read = readEducationalProfile(legacyProfile('2468'))
    expect(read.ok).toBe(true)
    if (!read.ok || !read.legacyCredentialHandoff) return

    const failedEnrollment = vi.fn(async () => {
      throw new Error('local vault unavailable')
    })
    await expect(
      read.legacyCredentialHandoff.consume(failedEnrollment),
    ).rejects.toThrow('local vault unavailable')
    expect(read.legacyCredentialHandoff.consumed).toBe(false)
    expect(JSON.stringify(read)).not.toContain('2468')

    const successfulRetry = vi.fn(async () => undefined)
    await read.legacyCredentialHandoff.consume(successfulRetry)
    expect(successfulRetry).toHaveBeenCalledWith('p1', '2468')
    expect(read.legacyCredentialHandoff.consumed).toBe(true)
    expect(JSON.stringify(read)).not.toContain('2468')
  })

  it('does not allow explicit destruction while async enrollment is pending', async () => {
    const read = readEducationalProfile(legacyProfile('2468'))
    expect(read.ok).toBe(true)
    if (!read.ok || !read.legacyCredentialHandoff) return

    let finishEnrollment: (() => void) | undefined
    const pending = read.legacyCredentialHandoff.consume(
      () =>
        new Promise<void>((resolve) => {
          finishEnrollment = resolve
        }),
    )
    expect(() => read.legacyCredentialHandoff?.discard()).toThrow(
      /in progress/i,
    )
    finishEnrollment?.()
    await pending
    expect(read.legacyCredentialHandoff.consumed).toBe(true)
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
    const republished =
      serializeCredentialFreeEducationalProfile(compatibilityModel)
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

  it.each([
    ['parentPin', '9876'],
    ['accessToken', 'session-secret'],
    ['refreshToken', 'session-secret'],
    ['sessionToken', 'session-secret'],
    ['pinHash', 'session-secret'],
    ['recoveryToken', 'session-secret'],
  ])(
    'rejects nested %s from incoming rows without echoing its value',
    (key, secret) => {
      const row = {
        ...serializeCredentialFreeEducationalProfile(legacyProfile()),
        tutor: { voiceOptIn: true, nested: { [key]: secret } },
      }
      const read = readEducationalProfile(row)
      expect(read).toMatchObject({
        ok: false,
        classification: 'credential-bearing-payload-rejection',
      })
      expect(JSON.stringify(read)).not.toContain(secret)
    },
  )

  it('rejects malformed legacy PIN handoff material', () => {
    expect(
      readEducationalProfile({ ...legacyProfile(), pin: 'not-a-pin' }),
    ).toMatchObject({ ok: false, classification: 'invalid-profile' })
  })
})

describe('credential-free canonical profile fingerprinting', () => {
  it('uses a domain-separated SHA-256 digest and excludes the legacy PIN input', async () => {
    const first = legacyProfile('1111')
    const second = legacyProfile('9999')
    await expect(credentialFreeProfileFingerprint(first)).resolves.toMatch(
      /^academy-profile-v2:sha256:[0-9a-f]{64}$/,
    )
    expect(await credentialFreeProfileFingerprint(first)).toBe(
      await credentialFreeProfileFingerprint(second),
    )
    expect(profileHash(first)).not.toBe(profileHash(second))
    expect(await credentialFreeProfileFingerprint(first)).not.toBe(
      profileHash(first),
    )
  })

  it('flags an old credential-bearing hash as ambiguous review input', async () => {
    const profile = legacyProfile('2468')
    expect(
      await reconcileStoredProfileFingerprint(profile, profileHash(profile)),
    ).toMatchObject({
      kind: 'legacy-credential-input-ambiguous',
      requiresReview: true,
    })
    const current = await credentialFreeProfileFingerprint(profile)
    expect(await reconcileStoredProfileFingerprint(profile, current)).toEqual({
      kind: 'credential-free-match',
      credentialFreeFingerprint: current,
      requiresReview: false,
    })
    expect(
      await reconcileStoredProfileFingerprint(profile, 'unknown'),
    ).toMatchObject({
      kind: 'mismatch',
      requiresReview: true,
    })
  })

  it('rejects nested credentials before canonicalization and never echoes the secret', async () => {
    const credentialBearing = {
      ...legacyProfile(),
      missions: {
        '2026-08-09': {
          items: [missionItem({ accessToken: 'session-secret' })],
        },
      },
    } as Profile
    let caught: unknown
    try {
      await credentialFreeProfileFingerprint(credentialBearing)
    } catch (cause) {
      caught = cause
    }
    expect(caught).toBeInstanceOf(CredentialBearingProfileError)
    expect(JSON.stringify(caught)).not.toContain('session-secret')
  })
})

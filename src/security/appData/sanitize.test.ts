import { describe, expect, it } from 'vitest'
import type { Profile } from '../../types'
import { PROHIBITED_PORTABLE_SECURITY_KEY_ALIASES } from '../contracts'
import {
  CredentialSanitizationError,
  sanitizeCredentialFreeEducationalData,
  sanitizeCredentialFreeEducationalProfile,
  serializeCredentialFreeEducationalData,
} from './sanitize'

const PROHIBITED_PORTABLE_SECURITY_PATTERN_EXAMPLES = [
  'lessonCredentialHint',
  'parent-authorization-state',
  'bearer_metadata',
  'derivedVerifierBytes',
  'passwordReminder',
  'sharedSecretMaterial',
  'identityToken',
  'pinEntry',
  'backupPin',
  'saltMaterial',
  'derivedSalt',
  'replacementGrant',
  'sessionRuntime',
  'classSession',
] as const

const REQUIRED_PUBLIC_PROFILE_SECURITY_KEYS = [
  'pin',
  'parentPin',
  'pinHash',
  'pinVerifier',
  'verifier',
  'salt',
  'password',
  'credential',
  'credentials',
  'credentialmetadata',
  'recoverySecret',
  'recoveryToken',
  'accessToken',
  'refreshToken',
  'sessionToken',
  'authorization',
  'bearer',
  'activeSession',
  'session',
  'grant',
  'secret',
] as const

const COMPLETE_PUBLIC_PROFILE_SECURITY_KEY_MATRIX = [
  ...new Set([
    ...PROHIBITED_PORTABLE_SECURITY_KEY_ALIASES,
    ...REQUIRED_PUBLIC_PROFILE_SECURITY_KEYS,
    ...PROHIBITED_PORTABLE_SECURITY_PATTERN_EXAMPLES,
  ]),
]

function legacyData(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    activeProfileId: 'p1',
    parentPin: '9876',
    profiles: {
      p1: {
        id: 'p1',
        name: 'Learner One',
        pin: '1234',
        progress: { completed: true },
      },
    },
  }
}

function legacyProfile(
  id = 'p1',
  additionalData: Record<string, unknown> = {},
): Profile {
  return {
    id,
    name: 'Learner One',
    grade: 5,
    pin: '1234',
    lessonText: 'Ordinary educational content.',
    ...additionalData,
  } as unknown as Profile
}

describe('credential-free educational-data sanitizer', () => {
  it('strips only the accepted legacy AppState and Profile PIN fields', () => {
    const source = legacyData()
    const sanitized = sanitizeCredentialFreeEducationalData(source)

    expect(sanitized).toEqual({
      schemaVersion: 2,
      activeProfileId: 'p1',
      profiles: {
        p1: {
          id: 'p1',
          name: 'Learner One',
          progress: { completed: true },
        },
      },
    })
    expect((source.profiles as Record<string, Record<string, unknown>>).p1.pin).toBe('1234')
  })

  it.each(['p1', 'p2', 'p3', 'p4', 'p5'])(
    'strips the exact legacy Profile PIN for canonical profile key %s',
    (profileId) => {
      const source = legacyData()
      source.activeProfileId = profileId
      source.profiles = {
        [profileId]: {
          id: profileId,
          name: `Learner ${profileId}`,
          pin: '1234',
        },
      }

      expect(sanitizeCredentialFreeEducationalData(source)).toEqual({
        schemaVersion: 2,
        activeProfileId: profileId,
        profiles: {
          [profileId]: {
            id: profileId,
            name: `Learner ${profileId}`,
          },
        },
      })
    },
  )

  it.each(['P1', 'p6', ' p1', 'foo'])(
    'rejects noncanonical legacy profile key %s instead of stripping its PIN',
    (profileId) => {
      const source = legacyData()
      source.profiles = {
        [profileId]: { id: profileId, name: 'Malformed learner', pin: '1234' },
      }

      expect(() => sanitizeCredentialFreeEducationalData(source)).toThrow(
        CredentialSanitizationError,
      )
    },
  )

  it('rejects an array-shaped profiles collection instead of treating its PIN as legacy', () => {
    const source = legacyData()
    source.profiles = [{ id: 'p1', name: 'Learner One', pin: '1234' }]

    expect(() => sanitizeCredentialFreeEducationalData(source)).toThrow(
      CredentialSanitizationError,
    )
  })

  it('rejects a nested Profile PIN path instead of silently stripping it', () => {
    const source = legacyData()
    ;(source.profiles as Record<string, Record<string, unknown>>).p1 = {
      id: 'p1',
      name: 'Learner One',
      pin: '1234',
      deep: { pin: '5678' },
    }

    expect(() => sanitizeCredentialFreeEducationalData(source)).toThrow(
      CredentialSanitizationError,
    )
  })

  it('allows only root parentPin consumption and rejects nested parentPin', () => {
    expect(sanitizeCredentialFreeEducationalData(legacyData())).not.toHaveProperty('parentPin')
    expect(() =>
      sanitizeCredentialFreeEducationalData({
        ...legacyData(),
        lesson: { parentPin: '9876' },
      }),
    ).toThrow(CredentialSanitizationError)
  })

  it.each([
    ['nested verifier alias', { lesson: { pin_verifier: 'secret' } }],
    ['credential container alias', { lesson: { credentialVault: {} } }],
    ['nested PIN', { lesson: { pin: '1234' } }],
    ['recovery secret alias', { lesson: { recovery_secret: 'secret' } }],
    ['session token alias', { lesson: { session_token: 'secret' } }],
    ['root Parent PIN alias', { parent_pin: '9876' }],
  ])('rejects %s instead of silently stripping it', (_label, injected) => {
    expect(() => sanitizeCredentialFreeEducationalData({ ...legacyData(), ...injected })).toThrow(
      CredentialSanitizationError,
    )
  })

  it.each(PROHIBITED_PORTABLE_SECURITY_KEY_ALIASES)(
    'rejects shared prohibited key %s at every portable-data placement',
    (key) => {
      const placements = [
        { [key]: 'blocked' },
        { nested: { [key]: 'blocked' } },
        { one: { two: { three: { [key]: 'blocked' } } } },
        { items: [{ [key]: 'blocked' }] },
        { records: { lessonOne: { [key]: 'blocked' } } },
      ]

      for (const placement of placements) {
        expect(() =>
          sanitizeCredentialFreeEducationalData({
            ...legacyData(),
            ...placement,
          }),
        ).toThrow(CredentialSanitizationError)
      }
    },
  )

  it('rejects an aliased Profile PIN at the accepted legacy path', () => {
    const source = legacyData()
    const profiles = source.profiles as Record<string, Record<string, unknown>>
    delete profiles.p1.pin
    profiles.p1.p_i_n = '1234'

    expect(() => sanitizeCredentialFreeEducationalData(source)).toThrow(CredentialSanitizationError)
  })

  it('rejects active authorization and session material at any depth', () => {
    expect(() =>
      sanitizeCredentialFreeEducationalData({
        ...legacyData(),
        runtime: {
          activeLearnerSession: { sessionId: 'local-session' },
        },
      }),
    ).toThrow(CredentialSanitizationError)
  })

  it('rejects unexpected session, grant, and token families after legacy stripping', () => {
    for (const injected of [
      { runtime: { session: {} } },
      { runtime: { delegatedGrant: 'blocked' } },
      { runtime: { backupToken: 'blocked' } },
    ]) {
      expect(() => sanitizeCredentialFreeEducationalData({ ...legacyData(), ...injected })).toThrow(
        CredentialSanitizationError,
      )
    }
  })

  it('allows security words in learner-authored values because only keys are structural', () => {
    expect(
      sanitizeCredentialFreeEducationalData({
        answer: 'Never share your password or secret.',
        note: 'A bearer token and parent PIN are security lesson vocabulary.',
      }),
    ).toEqual({
      answer: 'Never share your password or secret.',
      note: 'A bearer token and parent PIN are security lesson vocabulary.',
    })
  })

  it('serializes a detached credential-free clone', () => {
    const source = legacyData()
    const serialized = serializeCredentialFreeEducationalData(source)
    const parsed = JSON.parse(serialized) as Record<string, unknown>

    expect(serialized).not.toContain('1234')
    expect(serialized).not.toContain('9876')
    expect(parsed).not.toHaveProperty('parentPin')
  })
})

describe('credential-free single-profile sanitizer', () => {
  it('fails closed on the exact previously leaking public-API payload', () => {
    expect(() =>
      sanitizeCredentialFreeEducationalProfile(
        legacyProfile('p1', {
          accessToken: 'token-value',
          parentPin: '9876',
          lesson: { password: 'pw' },
        }),
      ),
    ).toThrow(CredentialSanitizationError)
  })

  it.each(COMPLETE_PUBLIC_PROFILE_SECURITY_KEY_MATRIX)(
    'enforces the shared prohibited key %s at every profile placement',
    (key) => {
      const placements = [
        { [key]: 'blocked' },
        { nested: { [key]: 'blocked' } },
        { one: { two: { three: { [key]: 'blocked' } } } },
        { items: [{ [key]: 'blocked' }] },
        { records: { lessonOne: { [key]: 'blocked' } } },
      ]

      for (const placement of placements) {
        if (key === 'pin' && Object.hasOwn(placement, 'pin')) {
          expect(
            sanitizeCredentialFreeEducationalProfile(legacyProfile('p1', placement)),
          ).not.toHaveProperty('pin')
        } else {
          expect(() =>
            sanitizeCredentialFreeEducationalProfile(legacyProfile('p1', placement)),
          ).toThrow(CredentialSanitizationError)
        }
      }
    },
  )

  it('preserves security vocabulary in values and returns a detached profile', () => {
    const source = legacyProfile('p1', {
      lesson: { lessonText: 'Never share your password or secret.' },
    })
    const sanitized = sanitizeCredentialFreeEducationalProfile(source)

    expect(sanitized).toMatchObject({
      id: 'p1',
      lesson: { lessonText: 'Never share your password or secret.' },
    })
    expect(sanitized).not.toHaveProperty('pin')
    expect(sanitized).not.toBe(source)
    expect((sanitized as unknown as Record<string, unknown>).lesson).not.toBe(
      (source as unknown as Record<string, unknown>).lesson,
    )
  })

  it.each(['P1', 'p6'])('rejects noncanonical profile id %s', (profileId) => {
    expect(() => sanitizeCredentialFreeEducationalProfile(legacyProfile(profileId))).toThrow(
      CredentialSanitizationError,
    )
  })
})

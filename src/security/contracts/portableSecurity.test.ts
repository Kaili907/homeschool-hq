import { describe, expect, it } from 'vitest'
import {
  assertPortableSecurityKeyFree,
  isProhibitedPortableSecurityKey,
  normalizePortableSecurityKey,
  PortableSecurityStructureError,
  PROHIBITED_PORTABLE_SECURITY_KEY_ALIASES,
} from './portableSecurity'

const EXPECTED_EXPLICIT_ALIASES = [
  'pin',
  'parentpin',
  'rawpin',
  'learnerpin',
  'pinhash',
  'pinverifier',
  'pinsalt',
  'verifier',
  'verifierbase64',
  'verifierscheme',
  'verifierschemeversion',
  'salt',
  'saltbase64',
  'password',
  'credential',
  'credentials',
  'credentialkind',
  'credentialmetadata',
  'credentialstate',
  'credentialcontainer',
  'credentialvault',
  'learnercredential',
  'costparameters',
  'activeauthorization',
  'activelearnerauthorization',
  'activesession',
  'activelearnersession',
  'learnersession',
  'parentsession',
  'session',
  'sessiontoken',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'bearer',
  'grant',
  'secret',
  'recoverysecret',
  'recoverytoken',
  'recoverycode',
  'recoverykey',
] as const

const placements = [
  (key: string) => ({ [key]: 'blocked' }),
  (key: string) => ({ nested: { [key]: 'blocked' } }),
  (key: string) => ({ one: { two: { three: { [key]: 'blocked' } } } }),
  (key: string) => ({ items: [{ [key]: 'blocked' }] }),
  (key: string) => ({ records: { lessonOne: { [key]: 'blocked' } } }),
]

describe('portable security-key policy', () => {
  it('locks the exact explicit Sync V2 and Local safe-superset aliases', () => {
    expect(PROHIBITED_PORTABLE_SECURITY_KEY_ALIASES).toEqual(
      EXPECTED_EXPLICIT_ALIASES,
    )
    expect(Object.isFrozen(PROHIBITED_PORTABLE_SECURITY_KEY_ALIASES)).toBe(true)
  })

  it.each(EXPECTED_EXPLICIT_ALIASES)(
    'rejects the complete %s matrix at every required structure location',
    (key) => {
      for (const place of placements) {
        expect(() => assertPortableSecurityKeyFree(place(key))).toThrow(
          PortableSecurityStructureError,
        )
      }
    },
  )

  it.each([
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
  ])('preserves the mature Sync V2 pattern rejection for %s', (key) => {
    expect(isProhibitedPortableSecurityKey(key)).toBe(true)
    expect(() => assertPortableSecurityKeyFree({ [key]: 'blocked' })).toThrow(
      PortableSecurityStructureError,
    )
  })

  it('matches case and separators exactly as mature Sync V2 does', () => {
    expect(normalizePortableSecurityKey('PIN-_-Verifier')).toBe('pinverifier')
    expect(normalizePortableSecurityKey('recovery 🔒 token')).toBe(
      'recoverytoken',
    )
    expect(isProhibitedPortableSecurityKey('PIN-_-Verifier')).toBe(true)
    expect(isProhibitedPortableSecurityKey('recovery 🔒 token')).toBe(true)
  })

  it('retains the approved educational session plural/count exceptions', () => {
    expect(isProhibitedPortableSecurityKey('sessions')).toBe(false)
    expect(isProhibitedPortableSecurityKey('session_count')).toBe(false)
    expect(() =>
      assertPortableSecurityKeyFree({ sessions: [], session_count: 2 }),
    ).not.toThrow()
  })

  it('inspects keys only and allows ordinary educational string values', () => {
    const content = {
      answer: 'Never share your password',
      note: 'The words secret, authorization, and bearer are lesson content.',
      records: {
        lessonOne: ['credential', 'refreshToken', 'parentPin'],
      },
    }
    expect(() => assertPortableSecurityKeyFree(content)).not.toThrow()
  })

  it('accepts null, primitives, arrays, records, deep objects, and shared references', () => {
    const shared = { answer: 'safe' }
    const values: unknown[] = [
      null,
      true,
      false,
      0,
      -1.5,
      'educational text',
      [null, { answer: 'safe' }],
      { records: { lessonOne: { completed: true } } },
      { first: shared, second: shared },
      Object.assign(Object.create(null) as Record<string, unknown>, {
        answer: 'safe',
      }),
    ]
    for (const value of values) {
      expect(() => assertPortableSecurityKeyFree(value)).not.toThrow()
    }
  })

  it.each([undefined, 1n, Symbol('value'), () => undefined, NaN, Infinity])(
    'fails closed on non-JSON input: %s',
    (value) => {
      expect(() => assertPortableSecurityKeyFree(value)).toThrow(
        PortableSecurityStructureError,
      )
    },
  )

  it('fails closed on cycles, sparse/extended arrays, accessors, and non-plain objects', () => {
    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    const sparse = new Array(1)
    const extended = [1] as unknown[] & { note?: string }
    extended.note = 'not serialized'
    const accessor = Object.defineProperty({}, 'answer', {
      enumerable: true,
      get: () => 'not invoked',
    })

    for (const value of [cycle, sparse, extended, accessor, new Date()]) {
      expect(() => assertPortableSecurityKeyFree(value)).toThrow(
        PortableSecurityStructureError,
      )
    }
  })

  it('fails closed on prototype-sensitive and symbol keys', () => {
    for (const key of ['__proto__', 'prototype', 'constructor']) {
      const value = Object.assign(Object.create(null), { [key]: 'blocked' })
      expect(() => assertPortableSecurityKeyFree(value)).toThrow(
        PortableSecurityStructureError,
      )
    }

    const symbolKeyed = { answer: 'safe', [Symbol('hidden')]: 'blocked' }
    expect(() => assertPortableSecurityKeyFree(symbolKeyed)).toThrow(
      PortableSecurityStructureError,
    )
  })
})

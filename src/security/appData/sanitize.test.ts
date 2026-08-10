import { describe, expect, it } from 'vitest'
import { PROHIBITED_PORTABLE_SECURITY_KEY_ALIASES } from '../contracts'
import {
  CredentialSanitizationError,
  sanitizeCredentialFreeEducationalData,
  serializeCredentialFreeEducationalData,
} from './sanitize'

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

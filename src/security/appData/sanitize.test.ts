import { describe, expect, it } from 'vitest'
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
    expect(() =>
      sanitizeCredentialFreeEducationalData({ ...legacyData(), ...injected }),
    ).toThrow(CredentialSanitizationError)
  })

  it('rejects an aliased Profile PIN at the accepted legacy path', () => {
    const source = legacyData()
    const profiles = source.profiles as Record<string, Record<string, unknown>>
    delete profiles.p1.pin
    profiles.p1.p_i_n = '1234'

    expect(() => sanitizeCredentialFreeEducationalData(source)).toThrow(
      CredentialSanitizationError,
    )
  })

  it('rejects active authorization and session material at any depth', () => {
    expect(() =>
      sanitizeCredentialFreeEducationalData({
        ...legacyData(),
        runtime: {
          activeLearnerSession: { sessionId: 'local-session' },
        },
      }),
    ).toThrow(/active-session material/i)
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

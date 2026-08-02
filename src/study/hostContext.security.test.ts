import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import { buildHostStudyContext, deriveStudyLearnerRef, isValidIanaTimeZone } from './hostContext'

const profile = defaultAppState().profiles.p1
const readyStatus = {
  user: { id: 'household-synthetic', email: 'synthetic@example.invalid' },
  binding: 'bound' as const,
  provenance: 'verified' as const,
}

describe('verified host Study context', () => {
  it('derives a household-scoped opaque learner and never uses the name', () => {
    const result = buildHostStudyContext({
      enabled: true,
      syncStatus: readyStatus,
      profile,
      subject: 'math',
      lessonRef: 'lesson:synthetic',
      skillRefs: ['skill:synthetic'],
      householdTimeZone: 'America/New_York',
    })
    expect(result.status).toBe('ready')
    if (result.status !== 'ready') return
    expect(result.context.learnerRef).toBe(deriveStudyLearnerRef('household-synthetic', profile.id))
    expect(result.context.learnerRef).not.toContain(profile.name)
    expect(result.context.householdRef).not.toContain('household-synthetic')
  })

  it.each([
    ['disabled', { ...readyStatus }, false, 'America/New_York'],
    ['signed out', { ...readyStatus, user: null }, true, 'America/New_York'],
    ['unbound', { ...readyStatus, binding: 'unbound' as const }, true, 'America/New_York'],
    ['paused provenance', { ...readyStatus, provenance: 'paused' as const }, true, 'America/New_York'],
    ['invalid timezone', { ...readyStatus }, true, 'Mars/Olympus'],
  ])('fails closed when %s', (_label, syncStatus, enabled, timeZone) => {
    expect(buildHostStudyContext({
      enabled,
      syncStatus,
      profile,
      subject: 'math',
      lessonRef: 'lesson:synthetic',
      skillRefs: [],
      householdTimeZone: timeZone,
    }).status).toBe('unavailable')
  })

  it('validates IANA time zones without accepting loose labels', () => {
    expect(isValidIanaTimeZone('America/New_York')).toBe(true)
    expect(isValidIanaTimeZone('UTC')).toBe(true)
    expect(isValidIanaTimeZone('EST')).toBe(false)
  })
})

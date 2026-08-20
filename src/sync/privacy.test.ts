import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../migration'
import { createLocalPinVerifier } from '../localPin'
import type { Profile } from '../types'
import { pendingRows, profileHash } from './engine'
import { sanitizeProfileForSync, mergeDevicePrivateProfile } from './privacy'
import { emptyHouseholdMeta } from './types'

function privateProfile(): Profile {
  return {
    ...emptyProfile('p1', 'Ada', '3'),
    pin: createLocalPinVerifier('1234'),
    tutorChats: [{
      id: 'chat-1', skillId: 'addsub', grade: '3', day: '2026-08-16', startedTs: 1,
      messages: [], problem: 'private prompt', correctAnswer: 'private answer', herAnswer: 'private response',
    }],
    assistant: {
      calls: [1],
      sessions: [{ id: 'session-1', day: '2026-08-16', startedTs: 1, messages: [{ role: 'girl', text: 'private conversation', ts: 1 }] }],
      name: 'Helper',
    },
  }
}

describe('household sync privacy projection', () => {
  it('omits local PIN verifiers and raw tutor/assistant conversations', () => {
    const local = privateProfile()
    const projected = sanitizeProfileForSync(local)
    const serialized = JSON.stringify(projected)
    expect(projected.pin).toBe('')
    expect(projected.tutorChats).toBeUndefined()
    expect(projected.assistant?.sessions).toEqual([])
    expect(serialized).not.toMatch(/private prompt|private answer|private response|private conversation|local-pin/)
  })

  it('queues only the projected profile and ignores device-private hash changes', () => {
    const local = privateProfile()
    const meta = {
      ...emptyHouseholdMeta('household-a'),
      profiles: { p1: { updatedAt: 1, dirty: true } },
    }
    expect(pendingRows({ p1: local }, meta)[0].data).toEqual(sanitizeProfileForSync(local))
    expect(profileHash(local)).toBe(profileHash(sanitizeProfileForSync(local)))
  })

  it('reattaches this device private fields after a cloud choice', () => {
    const local = privateProfile()
    const remote = { ...sanitizeProfileForSync(local), name: 'Cloud Ada' }
    const merged = mergeDevicePrivateProfile(remote, local)
    expect(merged.name).toBe('Cloud Ada')
    expect(merged.pin).toBe(local.pin)
    expect(merged.tutorChats).toBe(local.tutorChats)
    expect(merged.assistant?.sessions).toBe(local.assistant?.sessions)
  })
})

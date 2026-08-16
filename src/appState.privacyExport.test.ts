import { describe, expect, it } from 'vitest'
import {
  sanitizeStateForPortableExport,
  serializeAllBackup,
} from './appState'
import { defaultAppState } from './migration'
import { validateAppStateForSync } from './sync/provenance'
import type { AppState, TutorChat } from './types'

const PARENT_PIN = '4271'
const KID_PIN = '9137'
const HER_ANSWER = 'HER_SECRET_ANSWER_a19f'
const CORRECT_ANSWER = 'CORRECT_SECRET_ANSWER_b7c2'
const KID_MESSAGE_TEXT = 'KID_SECRET_MESSAGE_c83e'
const TUTOR_MESSAGE_TEXT = 'TUTOR_SECRET_MESSAGE_d55b'
const ASSISTANT_MESSAGE_TEXT = 'ASSISTANT_SECRET_MESSAGE_e77a'
const ASSISTANT_GIRL_TEXT = 'GIRL_SECRET_MESSAGE_f61d'
const TUTOR_PROBLEM = 'TUTOR_SECRET_PROBLEM_g22c'

function stateWithSensitiveFields(): AppState {
  const base = defaultAppState()
  const tutorChat: TutorChat = {
    id: 'chat-1',
    skillId: 'mult',
    grade: '3',
    day: '2026-08-16',
    startedTs: 1_700_000_000_000,
    problem: TUTOR_PROBLEM,
    correctAnswer: CORRECT_ANSWER,
    herAnswer: HER_ANSWER,
    messages: [
      { role: 'kid', text: KID_MESSAGE_TEXT, ts: 1_700_000_000_100 },
      { role: 'tutor', text: TUTOR_MESSAGE_TEXT, ts: 1_700_000_000_200, source: 'api' },
    ],
  }
  return {
    ...base,
    parentPin: PARENT_PIN,
    profiles: {
      ...base.profiles,
      p1: { ...base.profiles.p1, pin: KID_PIN, tutorChats: [tutorChat] },
      p4: {
        ...base.profiles.p4,
        pin: KID_PIN,
        assistant: {
          calls: [1_700_000_000_000],
          sessions: [
            {
              id: 'sess-1',
              day: '2026-08-16',
              startedTs: 1_700_000_000_000,
              messages: [
                { role: 'girl', text: ASSISTANT_GIRL_TEXT, ts: 1_700_000_000_050 },
                { role: 'assistant', text: ASSISTANT_MESSAGE_TEXT, ts: 1_700_000_000_150 },
              ],
            },
          ],
        },
      },
    },
  }
}

describe('portable-backup privacy — SEC-8 client-privacy boundary', () => {
  it('exports omit raw parent PIN and kid PINs', () => {
    const json = serializeAllBackup(stateWithSensitiveFields())
    expect(json).not.toContain(PARENT_PIN)
    expect(json).not.toContain(KID_PIN)
  })

  it('exports omit tutor transcript prose, learner answer, and correct-answer key', () => {
    const json = serializeAllBackup(stateWithSensitiveFields())
    expect(json).not.toContain(HER_ANSWER)
    expect(json).not.toContain(CORRECT_ANSWER)
    expect(json).not.toContain(KID_MESSAGE_TEXT)
    expect(json).not.toContain(TUTOR_MESSAGE_TEXT)
    expect(json).not.toContain(TUTOR_PROBLEM)
    expect(json).not.toContain('tutorChats')
  })

  it('exports omit HS assistant session prose', () => {
    const json = serializeAllBackup(stateWithSensitiveFields())
    expect(json).not.toContain(ASSISTANT_MESSAGE_TEXT)
    expect(json).not.toContain(ASSISTANT_GIRL_TEXT)
  })

  it('sanitized export is re-importable — validator still accepts it', () => {
    const json = serializeAllBackup(stateWithSensitiveFields())
    const parsed = JSON.parse(json)
    const validation = validateAppStateForSync(parsed)
    expect(validation).toMatchObject({ ok: true })
  })

  it('sanitizer replaces PINs with empty strings so the PinCreate flow re-triggers', () => {
    const sanitized = sanitizeStateForPortableExport(stateWithSensitiveFields())
    expect(sanitized.parentPin).toBe('')
    for (const profile of Object.values(sanitized.profiles)) {
      expect(profile.pin).toBe('')
    }
  })

  it('sanitizer strips tutorChats entirely and empties assistant.sessions', () => {
    const sanitized = sanitizeStateForPortableExport(stateWithSensitiveFields())
    expect(sanitized.profiles.p1.tutorChats).toBeUndefined()
    expect(sanitized.profiles.p4.assistant?.sessions).toEqual([])
    // Aggregate call-cap meter is retained so restore keeps the parent's meter.
    expect(sanitized.profiles.p4.assistant?.calls).toEqual([1_700_000_000_000])
  })

  it('sanitizer does not mutate the original state', () => {
    const state = stateWithSensitiveFields()
    sanitizeStateForPortableExport(state)
    expect(state.parentPin).toBe(PARENT_PIN)
    expect(state.profiles.p1.pin).toBe(KID_PIN)
    expect(state.profiles.p1.tutorChats?.[0].herAnswer).toBe(HER_ANSWER)
    expect(state.profiles.p4.assistant?.sessions).toHaveLength(1)
  })
})

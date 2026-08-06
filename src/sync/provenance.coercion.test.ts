import { describe, expect, it } from 'vitest'
import { defaultAppState } from '../migration'
import { validateAppStateForSync, validateProfileForSync } from './provenance'

const GRADES = ['3', '4', '5', '6', '7', '8', '10', '12'] as const
const THEMES = ['playful', 'cool', 'clean'] as const
const GRADE_MALFORMED_VALUES: unknown[] = [
  5,
  ['5'],
  true,
  null,
  { value: '5' },
]
const THEME_MALFORMED_VALUES: unknown[] = [
  5,
  ['playful'],
  true,
  null,
  { value: 'playful' },
]

function profileWith(field: 'grade' | 'theme', value: unknown): unknown {
  const profile = structuredClone(
    defaultAppState().profiles.p1,
  ) as unknown as Record<string, unknown>
  profile[field] = value
  return profile
}

function stateWithTutorChatGrade(grade: unknown): unknown {
  const state = defaultAppState()
  ;(state.profiles.p1 as unknown as Record<string, unknown>).tutorChats = [
    {
      id: 'chat-1',
      skillId: 'addition',
      grade,
      day: '2026-08-05',
      startedTs: 1_754_352_000_000,
      problem: '1 + 1',
      correctAnswer: '2',
      herAnswer: '2',
      messages: [],
    },
  ]
  return state
}

describe('sync provenance enum fields reject coercible values', () => {
  it.each(GRADES)('accepts profile grade %s', (grade) => {
    expect(validateProfileForSync('p1', profileWith('grade', grade))).toBe(true)
  })

  it.each(GRADE_MALFORMED_VALUES)(
    'rejects malformed profile grade %j',
    (grade) => {
      expect(validateProfileForSync('p1', profileWith('grade', grade))).toBe(
        false,
      )
    },
  )

  it.each(THEMES)('accepts profile theme %s', (theme) => {
    expect(validateProfileForSync('p1', profileWith('theme', theme))).toBe(true)
  })

  it.each(THEME_MALFORMED_VALUES)(
    'rejects malformed profile theme %j',
    (theme) => {
      expect(validateProfileForSync('p1', profileWith('theme', theme))).toBe(
        false,
      )
    },
  )

  it.each(GRADES)('accepts tutor-chat grade %s', (grade) => {
    expect(validateAppStateForSync(stateWithTutorChatGrade(grade)).ok).toBe(true)
  })

  it.each(GRADE_MALFORMED_VALUES)(
    'rejects malformed tutor-chat grade %j',
    (grade) => {
      expect(validateAppStateForSync(stateWithTutorChatGrade(grade)).ok).toBe(
        false,
      )
    },
  )
})

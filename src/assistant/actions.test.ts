import { describe, it, expect } from 'vitest'
import type { Profile } from '../types'
import { buildActionCatalog, parseAction, parseSessionTarget } from './actions'

function teen(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'p5',
    name: 'Nadia',
    grade: '12',
    pin: '',
    theme: 'clean',
    skills: {},
    missions: {
      '2026-07-24': {
        items: [
          { id: 'math-block', label: 'Math block', done: false },
          { id: 'english', label: 'English', done: true }, // already done → not offered
        ],
      },
    },
    streaks: { current: 0, best: 0, lastActiveDate: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
    placementDone: true,
    totals: { questionsAnswered: 0, correct: 0, bestStreak: 0, sessions: 0 },
    collegeTasks: [
      { id: 'c2', label: 'Common App essay — first draft', due: '2026-09-15', done: false },
      { id: 'c9', label: 'Done task', due: '', done: true }, // done → not offered
    ],
    ...overrides,
  }
}

describe('buildActionCatalog — only her real, actionable items', () => {
  const cat = buildActionCatalog(teen(), '2026-07-24')

  it('offers only INCOMPLETE mission items', () => {
    expect(cat.find((a) => a.key === 'mission:math-block')).toBeTruthy()
    expect(cat.find((a) => a.key === 'mission:english')).toBeFalsy() // done
  })

  it('offers only INCOMPLETE college tasks (senior)', () => {
    expect(cat.find((a) => a.key === 'college:c2')).toBeTruthy()
    expect(cat.find((a) => a.key === 'college:c9')).toBeFalsy() // done
  })

  it('offers startable sessions (geometry units, algebra, timed)', () => {
    expect(cat.find((a) => a.key === 'unit:angles')?.kind).toBe('start_session')
    expect(cat.find((a) => a.key === 'algebra')).toBeTruthy()
    expect(cat.find((a) => a.key === 'timed:mixed')).toBeTruthy()
  })

  it('a 10th grader gets no college-task actions', () => {
    const cat10 = buildActionCatalog(teen({ grade: '10', collegeTasks: undefined }), '2026-07-24')
    expect(cat10.some((a) => a.kind === 'mark_college_task')).toBe(false)
  })
})

describe('parseAction — strips the ACTION line and matches only catalog keys', () => {
  const cat = buildActionCatalog(teen(), '2026-07-24')

  it('extracts a valid proposed action and cleans the spoken text', () => {
    const reply = 'Sounds good — want me to check that off?\nACTION: mission:math-block'
    const { text, action } = parseAction(reply, cat)
    expect(text).toBe('Sounds good — want me to check that off?')
    expect(action?.key).toBe('mission:math-block')
    expect(action?.kind).toBe('check_mission')
  })

  it('drops a hallucinated action key but still strips the line', () => {
    const reply = "Here's your plan.\nACTION: delete_everything"
    const { text, action } = parseAction(reply, cat)
    expect(text).toBe("Here's your plan.")
    expect(action).toBeUndefined()
  })

  it('returns no action when none proposed', () => {
    const { text, action } = parseAction('Just some encouragement!', cat)
    expect(text).toBe('Just some encouragement!')
    expect(action).toBeUndefined()
  })
})

describe('parseSessionTarget', () => {
  it('parses unit / algebra / timed descriptors', () => {
    expect(parseSessionTarget('unit:angles')).toEqual({ kind: 'unit', unitId: 'angles' })
    expect(parseSessionTarget('algebra')).toEqual({ kind: 'algebra' })
    expect(parseSessionTarget('timed:mixed')).toEqual({ kind: 'timed', source: 'mixed' })
    expect(parseSessionTarget('bogus')).toBeNull()
  })
})

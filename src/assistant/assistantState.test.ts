import { describe, it, expect } from 'vitest'
import type { Profile } from '../types'
import {
  DEFAULT_ASSISTANT_CAP,
  DEFAULT_ASSISTANT_NAME,
  assistantDailyCap,
  assistantName,
  assistantPersona,
  atDailyCap,
  callsInMonth,
  callsOnDay,
  getAssistantState,
  newAssistantSession,
  appendAssistantMessage,
  recentAssistantSessions,
  recordAssistantCall,
  saveAssistantSession,
  setAssistantDailyCap,
  setAssistantName,
  setAssistantPersona,
} from './assistantState'

function teen(): Profile {
  return {
    id: 'p5',
    name: 'Nadia',
    grade: '12',
    pin: '',
    theme: 'clean',
    skills: {},
    missions: {},
    streaks: { current: 0, best: 0, lastActiveDate: '' },
    createdAt: '2026-01-01T00:00:00.000Z',
    placementDone: true,
    totals: { questionsAnswered: 0, correct: 0, bestStreak: 0, sessions: 0 },
  }
}

const at = (day: string, h = 12) => Date.parse(`${day}T${String(h).padStart(2, '0')}:00:00`)

describe('config defaults + setters (functional)', () => {
  it('defaults name/persona/cap gracefully', () => {
    const p = teen()
    expect(assistantName(p)).toBe(DEFAULT_ASSISTANT_NAME)
    expect(assistantPersona(p)).toBe('')
    expect(assistantDailyCap(p)).toBe(DEFAULT_ASSISTANT_CAP)
    expect(p.assistant).toBeUndefined()
  })

  it('sets name/persona/cap without mutating prev', () => {
    const p = teen()
    const p2 = setAssistantName(p, 'Athena')
    const p3 = setAssistantPersona(p2, 'crisp and kind')
    const p4 = setAssistantDailyCap(p3, 25)
    expect(p.assistant).toBeUndefined() // prev untouched
    expect(assistantName(p4)).toBe('Athena')
    expect(assistantPersona(p4)).toBe('crisp and kind')
    expect(assistantDailyCap(p4)).toBe(25)
  })
})

describe('cap + month meter (own call log)', () => {
  it('counts calls per day and per month, enforces the cap', () => {
    let p = setAssistantDailyCap(teen(), 3)
    p = recordAssistantCall(p, at('2026-07-24'))
    p = recordAssistantCall(p, at('2026-07-24', 13))
    expect(callsOnDay(p, '2026-07-24')).toBe(2)
    expect(atDailyCap(p, '2026-07-24')).toBe(false)
    p = recordAssistantCall(p, at('2026-07-24', 14))
    expect(atDailyCap(p, '2026-07-24')).toBe(true) // 3/3
    // a different day is under cap again; month meter accumulates
    p = recordAssistantCall(p, at('2026-07-25'))
    expect(callsOnDay(p, '2026-07-25')).toBe(1)
    expect(callsInMonth(p, '2026-07-25')).toBe(4)
  })
})

describe('transcripts + 60-day prune', () => {
  it('saves sessions, replaces by id, and prunes old calls/sessions', () => {
    let p = teen()
    const now = at('2026-07-24')
    let s = newAssistantSession('s1', now, '2026-07-24')
    s = appendAssistantMessage(s, { role: 'girl', text: 'hi', ts: now })
    s = appendAssistantMessage(s, { role: 'assistant', text: 'hey', ts: now, source: 'api' })
    p = saveAssistantSession(p, s, now)
    expect(getAssistantState(p).sessions).toHaveLength(1)
    expect(recentAssistantSessions(p)[0].messages).toHaveLength(2)

    // an old call + old session (100 days ago) get pruned on the next write
    const old = now - 100 * 24 * 60 * 60 * 1000
    p = { ...p, assistant: { ...getAssistantState(p), calls: [old], sessions: [
      newAssistantSession('old', old, '2026-04-01'),
      ...getAssistantState(p).sessions,
    ] } }
    p = recordAssistantCall(p, now)
    expect(getAssistantState(p).calls).toEqual([now]) // old call pruned
    expect(getAssistantState(p).sessions.find((x) => x.id === 'old')).toBeUndefined()
    expect(getAssistantState(p).sessions.find((x) => x.id === 's1')).toBeTruthy()
  })
})

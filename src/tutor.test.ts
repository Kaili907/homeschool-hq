import { describe, expect, it } from 'vitest'
import { emptyProfile } from './migration'
import { buildPracticePlan } from './engine'
import type { Profile } from './types'
import {
  SESSION_ESCALATION,
  WEEK_ESCALATION,
  clearTutorFlag,
  defaultRate,
  getVoicePrefs,
  isMuted,
  isSkillGated,
  logWalkthrough,
  setMuted,
  setVoiceOptIn,
} from './tutor/tutorState'

const g6 = (): Profile => emptyProfile('p3', '6th Grader', '6')
const DAY = '2026-07-23'

describe('MT-1 escalation: 3+ walkthroughs in a session', () => {
  it('flags and gates the skill on the 3rd same-skill walkthrough this session', () => {
    let p = g6()
    const S = 1000
    p = logWalkthrough(p, 'ratio6', 1001, S, DAY)
    expect(isSkillGated(p, 'ratio6')).toBe(false)
    p = logWalkthrough(p, 'ratio6', 1002, S, DAY)
    expect(isSkillGated(p, 'ratio6')).toBe(false) // 2 is not enough
    p = logWalkthrough(p, 'ratio6', 1003, S, DAY)
    expect(isSkillGated(p, 'ratio6')).toBe(true) // 3rd trips it
    expect(p.tutorFlags?.ratio6?.reason).toMatch(/session/)
    expect(SESSION_ESCALATION).toBe(3)
  })

  it('does not cross-trip between different skills', () => {
    let p = g6()
    const S = 1000
    p = logWalkthrough(p, 'ratio6', 1001, S, DAY)
    p = logWalkthrough(p, 'ratio6', 1002, S, DAY)
    p = logWalkthrough(p, 'percent6', 1003, S, DAY)
    p = logWalkthrough(p, 'percent6', 1004, S, DAY)
    expect(isSkillGated(p, 'ratio6')).toBe(false)
    expect(isSkillGated(p, 'percent6')).toBe(false)
  })
})

describe('MT-1 escalation: 5+ walkthroughs in a week (across sessions)', () => {
  it('flags on the 5th even when each is its own session', () => {
    let p = g6()
    // each walkthrough is a separate session (sessionStart = its own ts), so the
    // per-session count is always 1 — only the weekly total climbs.
    for (let k = 1; k <= WEEK_ESCALATION - 1; k++) {
      const ts = 10_000 + k * 60_000
      p = logWalkthrough(p, 'eq6', ts, ts, DAY)
      expect(isSkillGated(p, 'eq6')).toBe(false)
    }
    const lastTs = 10_000 + WEEK_ESCALATION * 60_000
    p = logWalkthrough(p, 'eq6', lastTs, lastTs, DAY)
    expect(isSkillGated(p, 'eq6')).toBe(true)
    expect(p.tutorFlags?.eq6?.reason).toMatch(/week/)
  })
})

describe('MT-1: Dad clears the flag', () => {
  it('un-gates the skill and resets its walkthrough history', () => {
    let p = g6()
    const S = 1000
    p = logWalkthrough(p, 'geo6', 1001, S, DAY)
    p = logWalkthrough(p, 'geo6', 1002, S, DAY)
    p = logWalkthrough(p, 'geo6', 1003, S, DAY)
    expect(isSkillGated(p, 'geo6')).toBe(true)

    p = clearTutorFlag(p, 'geo6')
    expect(isSkillGated(p, 'geo6')).toBe(false)
    expect((p.walkthroughLog ?? []).some((e) => e.skillId === 'geo6')).toBe(false)

    // one more walkthrough after clearing must NOT instantly re-trip it
    p = logWalkthrough(p, 'geo6', 2000, 1900, DAY)
    expect(isSkillGated(p, 'geo6')).toBe(false)
  })
})

describe('MT-1: gated skills are pulled from practice', () => {
  it('never plans a gated skill, but never returns an empty plan', () => {
    let p = g6()
    const S = 1000
    p = logWalkthrough(p, 'stats6', 1001, S, DAY)
    p = logWalkthrough(p, 'stats6', 1002, S, DAY)
    p = logWalkthrough(p, 'stats6', 1003, S, DAY)
    expect(isSkillGated(p, 'stats6')).toBe(true)

    const plan = buildPracticePlan(p, 60)
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.some((item) => item.skill === 'stats6')).toBe(false)
  })
})

describe('MT-1 voice prefs', () => {
  it('slows the littles and defaults teens to text-first', () => {
    expect(defaultRate('3')).toBeLessThan(1)
    expect(defaultRate('4')).toBeLessThan(1)
    expect(defaultRate('6')).toBe(1)

    const three = getVoicePrefs(emptyProfile('p1', 'Ada', '3'))
    expect(three.enabled).toBe(true)
    expect(three.rate).toBeLessThan(1)

    const teen = emptyProfile('p4', 'Sam', '10')
    expect(getVoicePrefs(teen).enabled).toBe(false) // text-first until opt-in
    expect(getVoicePrefs(setVoiceOptIn(teen, true)).enabled).toBe(true)
  })

  it('global mute defaults off and toggles', () => {
    const state = { schemaVersion: 2 as const, profiles: {}, activeProfileId: null, parentPin: '' }
    expect(isMuted(state)).toBe(false)
    expect(isMuted(setMuted(state, true))).toBe(true)
  })
})

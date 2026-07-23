import { describe, expect, it } from 'vitest'
import {
  autoCompletePractice,
  buildMissionDay,
  defaultTemplateFor,
  ensureToday,
  isDayComplete,
  isFridayDate,
  isoYesterday,
  setItemDone,
} from './missions'
import { emptyProfile } from './migration'
import type { Profile } from './types'

const MON = '2026-07-20' // a Monday
const TUE = '2026-07-21'
const WED = '2026-07-22'
const FRI = '2026-07-24' // a Friday

const kid = (): Profile => emptyProfile('p1', 'Test Kid', '3')

function completeAllManual(p: Profile, day: string): Profile {
  let out = ensureToday(p, day)
  for (const item of out.missions[day].items) {
    if (!item.auto) out = setItemDone(out, item.id, true, day)
  }
  return out
}

describe('mission days', () => {
  it('builds today from the weekday template with auto flags carried', () => {
    const p = ensureToday(kid(), MON)
    const day = p.missions[MON]
    expect(day.items.map((i) => i.id)).toEqual([
      'math-lesson',
      'math-practice',
      'read-aloud',
      'read-self',
      'writing',
      'science-ss',
    ])
    expect(day.items.find((i) => i.id === 'math-practice')?.auto).toBe(true)
    expect(day.items.every((i) => !i.done)).toBe(true)
  })

  it('uses the Friday light-day variant on Fridays', () => {
    expect(isFridayDate(FRI)).toBe(true)
    expect(isFridayDate(MON)).toBe(false)
    const p = ensureToday(kid(), FRI)
    expect(p.missions[FRI].items).toHaveLength(3)
    expect(p.missions[FRI].items[0].id).toBe('math-practice')
  })

  it('falls back to weekday items when the friday list is empty', () => {
    const t = { ...defaultTemplateFor('3'), friday: [] }
    const day = buildMissionDay(t, true)
    expect(day.items).toHaveLength(6)
  })

  it('does not regenerate an existing day', () => {
    let p = ensureToday(kid(), MON)
    p = setItemDone(p, 'read-aloud', true, MON)
    const again = ensureToday(p, MON)
    expect(again.missions[MON].items.find((i) => i.id === 'read-aloud')?.done).toBe(true)
  })
})

describe('auto-check from practice', () => {
  it('flips only auto items', () => {
    const p = autoCompletePractice(kid(), MON)
    const day = p.missions[MON]
    expect(day.items.find((i) => i.id === 'math-practice')?.done).toBe(true)
    expect(day.items.filter((i) => !i.auto).every((i) => !i.done)).toBe(true)
  })
})

describe('mission streaks', () => {
  it('completing every item bumps the streak once', () => {
    let p = completeAllManual(kid(), MON)
    expect(isDayComplete(p.missions[MON])).toBe(false) // auto item still open
    p = autoCompletePractice(p, MON)
    expect(isDayComplete(p.missions[MON])).toBe(true)
    expect(p.streaks).toEqual({ current: 1, best: 1, lastActiveDate: MON })
    // re-toggling an item the same day does not double-count
    p = setItemDone(p, 'read-aloud', false, MON)
    p = setItemDone(p, 'read-aloud', true, MON)
    expect(p.streaks.current).toBe(1)
  })

  it('consecutive days grow the streak; a gap resets it', () => {
    expect(isoYesterday(TUE)).toBe(MON)
    let p = completeAllManual(kid(), MON)
    p = autoCompletePractice(p, MON)
    p = completeAllManual(p, TUE)
    p = autoCompletePractice(p, TUE)
    expect(p.streaks).toEqual({ current: 2, best: 2, lastActiveDate: TUE })
    // skip WED, complete FRI → reset to 1, best stays 2
    void WED
    p = completeAllManual(p, FRI)
    p = autoCompletePractice(p, FRI)
    expect(p.streaks).toEqual({ current: 1, best: 2, lastActiveDate: FRI })
  })

  it('an incomplete day never bumps', () => {
    let p = ensureToday(kid(), MON)
    p = setItemDone(p, 'read-aloud', true, MON)
    expect(p.streaks.current).toBe(0)
  })

  it('month boundaries compute yesterday correctly', () => {
    expect(isoYesterday('2026-08-01')).toBe('2026-07-31')
    expect(isoYesterday('2026-01-01')).toBe('2025-12-31')
    expect(isoYesterday('2026-03-01')).toBe('2026-02-28')
  })
})

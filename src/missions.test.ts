import { describe, expect, it } from 'vitest'
import {
  applyDefaultsToProfile,
  autoCompleteKind,
  autoCompletePractice,
  autoCompleteReading,
  autoCompleteTyping,
  buildMissionDay,
  defaultTemplateFor,
  ensureToday,
  isDayComplete,
  isFallTerm,
  isFridayDate,
  isoYesterday,
  itemOccursOn,
  setItemDone,
  weekdayOf,
} from './missions'
import { emptyProfile } from './migration'
import type { MissionTemplate, Profile } from './types'

const MON = '2026-07-20' // a Monday (July → not fall term)
const TUE = '2026-07-21'
const WED = '2026-07-22' // weekly-once anchor day
const THU = '2026-07-23'
const FRI = '2026-07-24' // a Friday
const FALL_MON = '2026-09-07' // a Monday in fall term

const kid = (grade: Profile['grade'] = '3'): Profile => emptyProfile('p1', 'Test Kid', grade)

/** Complete a whole day: manual items + math + typing autos. */
function completeDay(p: Profile, day: string): Profile {
  let out = ensureToday(p, day)
  for (const item of out.missions[day].items) {
    if (!item.auto) out = setItemDone(out, item.id, true, day)
  }
  out = autoCompletePractice(out, day)
  out = autoCompleteTyping(out, day)
  return out
}

describe('calendar helpers', () => {
  it('maps ISO dates to Mon=1…Fri=5', () => {
    expect(weekdayOf(MON)).toBe(1)
    expect(weekdayOf(FRI)).toBe(5)
    expect(isFridayDate(FRI)).toBe(true)
    expect(isFridayDate(MON)).toBe(false)
  })
  it('treats Aug–Dec as the fall term', () => {
    expect(isFallTerm('2026-09-07')).toBe(true)
    expect(isFallTerm('2026-12-31')).toBe(true)
    expect(isFallTerm('2026-07-20')).toBe(false)
    expect(isFallTerm('2027-01-05')).toBe(false)
  })
})

describe('mission days', () => {
  it('builds the grade-3 weekday day with Typing first and math auto carried', () => {
    const p = ensureToday(kid('3'), MON)
    const day = p.missions[MON]
    // Monday: handwriting (Tue/Thu) is hidden
    expect(day.items.map((i) => i.id)).toEqual([
      'typing',
      'math-lesson',
      'math-practice',
      'read-aloud',
      'read-self',
      'writing',
      'science-ss',
    ])
    expect(day.items[0].id).toBe('typing') // first item after sign-in
    expect(day.items.find((i) => i.id === 'typing')?.autoKind).toBe('typing')
    expect(day.items.find((i) => i.id === 'math-practice')?.auto).toBe(true)
    expect(day.items.every((i) => !i.done)).toBe(true)
  })

  it('uses the Friday light-day variant (Typing still daily)', () => {
    const p = ensureToday(kid('3'), FRI)
    expect(p.missions[FRI].items.map((i) => i.id)).toEqual([
      'typing',
      'math-practice',
      'read-self',
      'fun-project',
    ])
  })

  it('falls back to weekday items when the friday list is empty', () => {
    const t: MissionTemplate = { ...defaultTemplateFor('3'), friday: [] }
    // built on a Friday → handwriting still hidden → 7 of the 8 weekday blocks
    expect(buildMissionDay(t, FRI).items).toHaveLength(7)
  })

  it('does not regenerate an existing day', () => {
    let p = ensureToday(kid(), MON)
    p = setItemDone(p, 'read-aloud', true, MON)
    const again = ensureToday(p, MON)
    expect(again.missions[MON].items.find((i) => i.id === 'read-aloud')?.done).toBe(true)
  })
})

describe('cadence', () => {
  it('handwriting (littles) appears only Tue/Thu', () => {
    const ids = (day: string) => ensureToday(kid('3'), day).missions[day].items.map((i) => i.id)
    expect(ids(MON)).not.toContain('handwriting')
    expect(ids(TUE)).toContain('handwriting')
    expect(ids(THU)).toContain('handwriting')
    expect(ids(WED)).not.toContain('handwriting')
  })

  it('current events (grade 6) appears once a week on the anchor day', () => {
    const ids = (day: string) => ensureToday(kid('6'), day).missions[day].items.map((i) => i.id)
    expect(ids(WED)).toContain('current-events')
    expect(ids(MON)).not.toContain('current-events')
    expect(ids(TUE)).not.toContain('current-events')
    // grade 6 also gets Japanese daily + Typing
    expect(ids(MON)).toEqual(expect.arrayContaining(['typing', 'japanese']))
  })

  it('senior SAT-prep runs 3×/week in fall only, never on the light Friday', () => {
    const ids = (day: string) => ensureToday(kid('12'), day).missions[day].items.map((i) => i.id)
    expect(ids(FALL_MON)).toContain('sat-prep') // fall Monday
    expect(ids('2026-09-10')).not.toContain('sat-prep') // fall Thursday (days [1,2,3])
    expect(ids(MON)).not.toContain('sat-prep') // July Monday — not fall
    // sophomore (grade 10) gets current events but never SAT prep
    const soph = ensureToday(kid('10'), WED).missions[WED].items.map((i) => i.id)
    expect(soph).toContain('current-events')
    expect(soph).not.toContain('sat-prep')
  })

  it('itemOccursOn honours combined day + season filters', () => {
    const sat = defaultTemplateFor('12').weekday.find((i) => i.id === 'sat-prep')!
    expect(itemOccursOn(sat, FALL_MON)).toBe(true)
    expect(itemOccursOn(sat, '2026-09-11')).toBe(false) // fall Friday not in [1,2,3]
    expect(itemOccursOn(sat, MON)).toBe(false) // not fall
  })
})

describe('auto-check by kind', () => {
  it('math practice flips only the math auto item, leaving typing open', () => {
    const p = autoCompletePractice(kid('3'), MON)
    const day = p.missions[MON]
    expect(day.items.find((i) => i.id === 'math-practice')?.done).toBe(true)
    expect(day.items.find((i) => i.id === 'typing')?.done).toBe(false)
  })

  it('a finished typing drill flips only the typing item', () => {
    const p = autoCompleteTyping(kid('3'), MON)
    const day = p.missions[MON]
    expect(day.items.find((i) => i.id === 'typing')?.done).toBe(true)
    expect(day.items.find((i) => i.id === 'math-practice')?.done).toBe(false)
  })

  it('leave hooks flip only their own kind (reading auto item)', () => {
    // simulate an MR reading auto item landing in the template
    let p = kid('3')
    p = {
      ...ensureToday(p, MON),
      missions: {
        [MON]: {
          items: [
            { id: 'reading-drill', label: 'Reading', done: false, auto: true, autoKind: 'reading' },
            { id: 'math-practice', label: 'Math', done: false, auto: true },
          ],
        },
      },
    }
    const afterMath = autoCompletePractice(p, MON)
    expect(afterMath.missions[MON].items.find((i) => i.id === 'reading-drill')?.done).toBe(false)
    const afterReading = autoCompleteReading(p, MON)
    expect(afterReading.missions[MON].items.find((i) => i.id === 'reading-drill')?.done).toBe(true)
    expect(afterReading.missions[MON].items.find((i) => i.id === 'math-practice')?.done).toBe(false)
  })

  it('autoCompleteKind is a no-op when nothing of that kind is open', () => {
    const p = ensureToday(kid('3'), MON)
    expect(autoCompleteKind(p, 'mindset', MON)).toBe(p)
  })
})

describe('mission streaks', () => {
  it('a day is complete only once math AND typing are both done', () => {
    let p = kid('3')
    // manual + math, but typing still open → not complete, no streak
    let out = ensureToday(p, MON)
    for (const item of out.missions[MON].items) if (!item.auto) out = setItemDone(out, item.id, true, MON)
    out = autoCompletePractice(out, MON)
    expect(isDayComplete(out.missions[MON])).toBe(false)
    p = autoCompleteTyping(out, MON)
    expect(isDayComplete(p.missions[MON])).toBe(true)
    expect(p.streaks).toEqual({ current: 1, best: 1, lastActiveDate: MON })
  })

  it('consecutive days grow the streak; a gap resets it', () => {
    expect(isoYesterday(TUE)).toBe(MON)
    let p = completeDay(kid('3'), MON)
    p = completeDay(p, TUE)
    expect(p.streaks).toEqual({ current: 2, best: 2, lastActiveDate: TUE })
    // skip WED, complete FRI → reset to 1, best stays 2
    p = completeDay(p, FRI)
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

describe('apply new defaults (respecting Dad edits)', () => {
  it('adds missing default items and keeps Dad’s edited items untouched', () => {
    const custom: MissionTemplate = {
      weekday: [{ id: 'math-lesson', label: 'MY custom math time' }],
      friday: [],
    }
    const p: Profile = { ...kid('3'), template: custom }
    const { profile, added } = applyDefaultsToProfile(p)
    const wd = profile.template!.weekday
    // Dad's item stays first, with his label
    expect(wd[0]).toEqual({ id: 'math-lesson', label: 'MY custom math time' })
    // typing (and the rest) got appended
    expect(added).toContain('typing')
    expect(added).not.toContain('math-lesson') // already present → not re-added
    expect(wd.map((i) => i.id)).toEqual(expect.arrayContaining(['typing', 'handwriting', 'science-ss']))
    // friday list filled from defaults
    expect(profile.template!.friday.map((i) => i.id)).toContain('typing')
  })

  it('is idempotent once caught up', () => {
    const first = applyDefaultsToProfile(kid('6'))
    const second = applyDefaultsToProfile(first.profile)
    expect(second.added).toEqual([])
    expect(second.profile.template).toEqual(first.profile.template)
  })

  it('materialises the full default template for a girl on the bare default', () => {
    const bare = kid('4')
    expect(bare.template).toBeUndefined()
    const { profile, added } = applyDefaultsToProfile(bare)
    // her template is now the concrete grade default...
    expect(profile.template!.weekday.map((i) => i.id)).toEqual(
      defaultTemplateFor('4').weekday.map((i) => i.id),
    )
    // ...and nothing was "added" because the bare default already had every item
    expect(added).toEqual([])
  })
})

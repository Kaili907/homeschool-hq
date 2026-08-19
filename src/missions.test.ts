import { describe, expect, it } from 'vitest'
import {
  applyDefaultsToProfile,
  autoCompleteKind,
  autoCompleteMindset,
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

/** Complete a whole day: every manual item + all four auto kinds present. */
function completeDay(p: Profile, day: string): Profile {
  let out = ensureToday(p, day)
  for (const item of out.missions[day].items) {
    if (!item.auto) out = setItemDone(out, item.id, true, day)
  }
  out = autoCompletePractice(out, day)
  out = autoCompleteTyping(out, day)
  out = autoCompleteReading(out, day)
  out = autoCompleteMindset(out, day)
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
    // Monday: handwriting (Tue/Thu) and the weekly mindset item (Wed) are hidden
    expect(day.items.map((i) => i.id)).toEqual([
      'typing',
      'math-lesson',
      'math-practice',
      'read-aloud',
      'reading-session',
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
      'reading-session',
      'read-self',
      'fun-project',
    ])
  })

  it('falls back to weekday items when the friday list is empty', () => {
    const t: MissionTemplate = { ...defaultTemplateFor('3'), friday: [] }
    // built on a Friday → handwriting (Tue/Thu) + mindset (Wed) hidden → 8 of 10 weekday blocks
    expect(buildMissionDay(t, FRI).items).toHaveLength(8)
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

  it('reading is a daily auto item (3/4/6); mindset is a weekly auto item (all grades)', () => {
    // reading-session appears every school day for the littles, incl. Friday
    for (const g of ['3', '4', '6'] as const) {
      expect(ensureToday(kid(g), MON).missions[MON].items.some((i) => i.id === 'reading-session' && i.autoKind === 'reading')).toBe(true)
      expect(ensureToday(kid(g), FRI).missions[FRI].items.some((i) => i.id === 'reading-session')).toBe(true)
    }
    // teens never get the reading item
    expect(ensureToday(kid('10'), MON).missions[MON].items.some((i) => i.id === 'reading-session')).toBe(false)
    // mindset-lesson is weekly (anchor Wed) and applies to every grade
    for (const g of ['3', '6', '12'] as const) {
      expect(ensureToday(kid(g), WED).missions[WED].items.some((i) => i.id === 'mindset-lesson' && i.autoKind === 'mindset')).toBe(true)
      expect(ensureToday(kid(g), MON).missions[MON].items.some((i) => i.id === 'mindset-lesson')).toBe(false)
    }
  })

  it('a reflected mindset lesson and a finished reading session flip their own items only', () => {
    // Wednesday grade-6 carries both a reading (daily) and a mindset (weekly) auto item
    const built = ensureToday(kid('6'), WED)
    const afterReading = autoCompleteReading(built, WED)
    expect(afterReading.missions[WED].items.find((i) => i.id === 'reading-session')?.done).toBe(true)
    expect(afterReading.missions[WED].items.find((i) => i.id === 'mindset-lesson')?.done).toBe(false)
    const afterMindset = autoCompleteMindset(built, WED)
    expect(afterMindset.missions[WED].items.find((i) => i.id === 'mindset-lesson')?.done).toBe(true)
    expect(afterMindset.missions[WED].items.find((i) => i.id === 'reading-session')?.done).toBe(false)
  })

  it('itemOccursOn honours combined day + season filters', () => {
    const sat = defaultTemplateFor('12').weekday.find((i) => i.id === 'sat-prep')!
    expect(itemOccursOn(sat, FALL_MON)).toBe(true)
    expect(itemOccursOn(sat, '2026-09-11')).toBe(false) // fall Friday not in [1,2,3]
    expect(itemOccursOn(sat, MON)).toBe(false) // not fall
  })
})

describe('auto-check by kind', () => {
  it.each([
    { label: 'practice', complete: autoCompletePractice, profile: kid('3'), day: MON, itemId: 'math-practice' },
    { label: 'typing', complete: autoCompleteTyping, profile: kid('3'), day: MON, itemId: 'typing' },
    { label: 'reading', complete: autoCompleteReading, profile: kid('3'), day: MON, itemId: 'reading-session' },
    { label: 'mindset', complete: autoCompleteMindset, profile: kid('6'), day: WED, itemId: 'mindset-lesson' },
  ])('$label completion materialises the canonical day from empty missions', ({ complete, profile, day, itemId }) => {
    const empty = { ...profile, missions: {} }
    const canonical = ensureToday(empty, day).missions[day]
    const completed = complete(empty, day).missions[day]

    expect(completed.items.map(({ done: _done, ...item }) => item)).toEqual(
      canonical.items.map(({ done: _done, ...item }) => item),
    )
    expect(completed.items.filter((item) => item.done).map((item) => item.id)).toEqual([itemId])
  })

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
  it('a day is complete only once every auto activity is done', () => {
    let p = kid('3')
    // manual + math + typing, but the reading auto item is still open → not complete
    let out = ensureToday(p, MON)
    for (const item of out.missions[MON].items) if (!item.auto) out = setItemDone(out, item.id, true, MON)
    out = autoCompletePractice(out, MON)
    out = autoCompleteTyping(out, MON)
    expect(isDayComplete(out.missions[MON])).toBe(false) // reading still open
    p = autoCompleteReading(out, MON)
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

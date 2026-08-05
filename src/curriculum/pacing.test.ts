import { describe, expect, it } from 'vitest'
import type { Profile, SchoolYear } from '../types'
import { emptyProfile } from '../migration'
import {
  buildCalendar,
  defaultSchoolYear,
  derivedScopeWeek,
  isTravelWeek,
  mondayForScopeWeek,
  mondayOf,
  nudgePointer,
  pointerDrift,
  quarterOfWeek,
  resetPointer,
  resolvePointer,
  setStartDate,
  toggleOffWeek,
  weekdayOf,
} from './pacing'
import {
  definedWeeks,
  itemsForDay,
  itemsForWeek,
  parsePlanDoc,
  plansForGrade,
  planAppliesToGrade,
} from './parser'

// 2026-08-31 is a Monday (school-year start anchor for these tests).
const START = '2026-08-31'
const sy = (over: Partial<SchoolYear> = {}): SchoolYear => ({ ...defaultSchoolYear(START), ...over })
const kid = (grade: Profile['grade'] = '6'): Profile => emptyProfile('p1', 'Test Kid', grade)

// ---------- date helpers ----------

describe('pacing date helpers', () => {
  it('mondayOf snaps any day to its Monday', () => {
    expect(mondayOf('2026-08-31')).toBe('2026-08-31') // Monday
    expect(mondayOf('2026-09-06')).toBe('2026-08-31') // the following Sunday → same Monday
    expect(mondayOf('2026-09-07')).toBe('2026-09-07') // next Monday
  })
  it('weekdayOf names the day', () => {
    expect(weekdayOf('2026-08-31')).toBe('Mon')
    expect(weekdayOf('2026-09-01')).toBe('Tue')
    expect(weekdayOf('2026-09-06')).toBe('Sun')
  })
})

// ---------- scope-week mapping + off-week shift ----------

describe('scope-week mapping', () => {
  it('is 0 before the year starts, 1 on the start week', () => {
    expect(derivedScopeWeek(sy(), '2026-08-24')).toBe(0) // week before
    expect(derivedScopeWeek(sy(), START)).toBe(1)
    expect(derivedScopeWeek(sy(), '2026-09-06')).toBe(1) // still start week (Sun)
    expect(derivedScopeWeek(sy(), '2026-09-07')).toBe(2) // next Monday
  })

  it('advances one scope week per calendar week with no off-weeks', () => {
    // 9 weeks after start = scope week 10
    expect(derivedScopeWeek(sy(), '2026-11-02')).toBe(10)
  })

  it('is unconfigured-safe', () => {
    expect(derivedScopeWeek(defaultSchoolYear(''), START)).toBe(0)
  })
})

describe('off-weeks shift every later expectation (across a quarter boundary)', () => {
  it('a travel week holds the expectation steady and pushes later weeks back by one', () => {
    // Off week = the 4th calendar week (Monday 2026-09-21).
    const y = sy({ offWeeks: ['2026-09-21'] })
    expect(isTravelWeek(y, '2026-09-23')).toBe(true) // mid that week
    // During the off week, expectation stays at week 3 (last taught week).
    expect(derivedScopeWeek(y, '2026-09-21')).toBe(3)
    // The calendar week that WOULD have been scope-4 without the off week is now scope-3+1… shifted:
    // 2026-09-28 (5th calendar week) is the 4th TAUGHT week → scope 4 (was scope 5 in calendar terms).
    expect(derivedScopeWeek(y, '2026-09-28')).toBe(4)
    // Without the off week, 2026-09-28 would have been scope week 5.
    expect(derivedScopeWeek(sy(), '2026-09-28')).toBe(5)
  })

  it('shifts weeks correctly ACROSS the quarter break (after week 9)', () => {
    // One off week early (week 2 Monday) pushes everything back by one calendar week.
    const y = sy({ offWeeks: ['2026-09-07'] })
    // Q1 has scope weeks 1..9. The 10th TAUGHT week (Q2 wk 10) now lands one calendar week later.
    const plainWk10Monday = mondayForScopeWeek(sy(), 10) // 2026-11-02
    const shiftedWk10Monday = mondayForScopeWeek(y, 10) // 2026-11-09 (one week later)
    expect(plainWk10Monday).toBe('2026-11-02')
    expect(shiftedWk10Monday).toBe('2026-11-09')
    // And the scope number at the plain wk-10 date is only 9 now (still Q1), proving the shift crossed the break.
    expect(derivedScopeWeek(y, '2026-11-02')).toBe(9)
    expect(quarterOfWeek(y, 9)).toBe(1)
    expect(quarterOfWeek(y, 10)).toBe(2)
  })

  it('two off-weeks straddling the break shift by two', () => {
    const y = sy({ offWeeks: ['2026-09-07', '2026-11-16'] }) // one in Q1, one in Q2
    // wk 10 shifted by the first off week (+1). The second off week is later, so wk10 = +1 only.
    expect(mondayForScopeWeek(y, 10)).toBe('2026-11-09')
    // A week after BOTH off weeks shifts by 2: scope wk 20.
    const plain20 = mondayForScopeWeek(sy(), 20)
    const shifted20 = mondayForScopeWeek(y, 20)
    expect(daysApart(plain20!, shifted20!)).toBe(14)
  })
})

function daysApart(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

describe('quarters + calendar', () => {
  it('assigns quarters by the break boundaries', () => {
    const y = sy()
    expect(quarterOfWeek(y, 1)).toBe(1)
    expect(quarterOfWeek(y, 9)).toBe(1)
    expect(quarterOfWeek(y, 10)).toBe(2)
    expect(quarterOfWeek(y, 18)).toBe(2)
    expect(quarterOfWeek(y, 19)).toBe(3)
    expect(quarterOfWeek(y, 28)).toBe(4)
    expect(quarterOfWeek(y, 36)).toBe(4)
  })

  it('buildCalendar lays 36 taught weeks + interleaves off-weeks', () => {
    const y = sy({ offWeeks: ['2026-09-21'] })
    const rows = buildCalendar(y)
    const taught = rows.filter((r) => !r.off)
    expect(taught).toHaveLength(36)
    expect(taught[0].scopeWeek).toBe(1)
    expect(taught[35].scopeWeek).toBe(36)
    // exactly one off row, sitting between scope weeks 3 and 4
    const offRows = rows.filter((r) => r.off)
    expect(offRows).toHaveLength(1)
    expect(offRows[0].monday).toBe('2026-09-21')
    // quarter-break flag after week 9
    expect(rows.find((r) => r.scopeWeek === 9)!.quarterBreakAfter).toBe(true)
    expect(rows.find((r) => r.scopeWeek === 8)!.quarterBreakAfter).toBe(false)
  })

  it('setStartDate + toggleOffWeek behave', () => {
    let y = defaultSchoolYear('')
    y = setStartDate(y, START)
    expect(y.startDate).toBe(START)
    y = toggleOffWeek(y, '2026-09-23') // any day in a week → its Monday
    expect(y.offWeeks).toEqual(['2026-09-21'])
    y = toggleOffWeek(y, '2026-09-21') // toggle off
    expect(y.offWeeks).toEqual([])
  })
})

// ---------- pointers: default, drift, nudge scoping + logging ----------

describe('per-girl per-subject pointers', () => {
  const TODAY = '2026-09-28' // scope week 5 with no off-weeks
  const NOW = '2026-09-28T14:00:00.000Z'

  it('defaults to the calendar-derived week until nudged', () => {
    const p = kid()
    expect(resolvePointer(p, 'math', sy(), TODAY)).toBe(5)
    expect(pointerDrift(p, 'math', sy(), TODAY)).toBe(0)
  })

  it('nudging one subject changes ONLY that subject and logs the move', () => {
    const p0 = kid()
    const p1 = nudgePointer(p0, 'math', 3, 'reteaching fractions', NOW, sy(), TODAY)
    // math moved to 3; writing (untouched) still rides the calendar (5)
    expect(resolvePointer(p1, 'math', sy(), TODAY)).toBe(3)
    expect(resolvePointer(p1, 'writing', sy(), TODAY)).toBe(5)
    expect(pointerDrift(p1, 'math', sy(), TODAY)).toBe(-2) // 3 - 5
    expect(pointerDrift(p1, 'writing', sy(), TODAY)).toBe(0)
    // logged: date + old→new + reason
    expect(p1.pacing!.nudges).toHaveLength(1)
    expect(p1.pacing!.nudges[0]).toMatchObject({ subjectId: 'math', from: 5, to: 3, reason: 'reteaching fractions', at: NOW })
  })

  it('clamps to [1, totalWeeks] and no-ops an unchanged move', () => {
    const p = nudgePointer(kid(), 'math', 999, 'ahead', NOW, sy(), TODAY)
    expect(resolvePointer(p, 'math', sy(), TODAY)).toBe(36)
    // a nudge landing on the current resolved week records nothing
    const same = nudgePointer(kid(), 'math', 5, 'noop', NOW, sy(), TODAY)
    expect(same.pacing).toBeUndefined()
  })

  it('resetPointer returns a subject to the calendar (keeps the log)', () => {
    const p1 = nudgePointer(kid(), 'math', 3, 'reteach', NOW, sy(), TODAY)
    const p2 = resetPointer(p1, 'math')
    expect(resolvePointer(p2, 'math', sy(), TODAY)).toBe(5) // back on the calendar
    expect(p2.pacing!.nudges).toHaveLength(1) // history preserved
  })
})

// ---------- parser: fixtures ----------

describe('parser', () => {
  const DOC = `---
subject: Personal Finance
subjectId: personal-finance
grades: 10,12
---

## Week 1 — Money basics
- What money is for
- ✋ Dad walks through a paystub
- (Tue) intro the vocabulary list

## Week 3 — Budgeting
- The 50/30/20 rule
`

  it('reads front-matter, weeks, items, ✋ and day tags', () => {
    const doc = parsePlanDoc(DOC)
    expect(doc.subject).toBe('Personal Finance')
    expect(doc.subjectId).toBe('personal-finance')
    expect(doc.grades).toEqual(['10', '12'])
    expect(definedWeeks(doc)).toEqual([1, 3]) // sparse weeks preserved
    expect(doc.weekCount).toBe(2)
    const w1 = itemsForWeek(doc, 1)
    expect(w1).toHaveLength(3)
    expect(w1[1]).toMatchObject({ text: 'Dad walks through a paystub', dadTaught: true })
    expect(w1[2]).toMatchObject({ text: 'intro the vocabulary list', day: 'Tue' })
  })

  it('day-tagged items only surface on their day; untagged every day', () => {
    const doc = parsePlanDoc(DOC)
    expect(itemsForDay(doc, 1, 'Tue').map((i) => i.text)).toContain('intro the vocabulary list')
    expect(itemsForDay(doc, 1, 'Mon').map((i) => i.text)).not.toContain('intro the vocabulary list')
    expect(itemsForDay(doc, 1, 'Mon')).toHaveLength(2) // the two untagged items
  })

  it('grades=all applies to every grade; a list restricts', () => {
    const all = parsePlanDoc(`---\nsubject: X\nsubjectId: x\ngrades: all\n---\n## Week 1 — a\n- b\n`)
    expect(all.grades).toBe('all')
    expect(planAppliesToGrade(all, '3')).toBe(true)
    const doc = parsePlanDoc(DOC)
    expect(planAppliesToGrade(doc, '10')).toBe(true)
    expect(planAppliesToGrade(doc, '3')).toBe(false)
    expect(plansForGrade([all, doc], '3').map((d) => d.subjectId)).toEqual(['x'])
  })

  it('accepts grade 5, 7, and 8 in front matter', () => {
    const doc = parsePlanDoc(`---\nsubject: Middle school lab\nsubjectId: middle-school-lab\ngrades: 5,7,8\n---\n## Week 1 - a\n- b\n`)
    expect(doc.grades).toEqual(['5', '7', '8'])
    for (const grade of ['5', '7', '8'] as const) expect(planAppliesToGrade(doc, grade)).toBe(true)
  })
})

// ---------- parser round-trip against the SHIPPED docs (count-verified per doc) ----------

describe('shipped plan docs round-trip', () => {
  // Load the REAL shipped docs the same way the app does (Vite raw glob), so the
  // round-trip is verified against what actually ships, not a fixture.
  const raws = import.meta.glob('./plans/*.md', { query: '?raw', eager: true, import: 'default' }) as Record<string, string>
  const read = (f: string) => {
    const entry = Object.entries(raws).find(([path]) => path.endsWith(`/${f}`))
    if (!entry) throw new Error(`plan doc not found: ${f}`)
    return parsePlanDoc(entry[1], f.replace(/\.md$/, ''))
  }

  it('every plans/*.md parses with defined weeks that each carry items', () => {
    const files = Object.keys(raws)
    expect(files.length).toBeGreaterThanOrEqual(3)
    for (const path of files) {
      const doc = parsePlanDoc(raws[path], path)
      expect(doc.weekCount).toBeGreaterThan(0)
      for (const w of definedWeeks(doc)) {
        expect(w).toBeGreaterThanOrEqual(1)
        expect(itemsForWeek(doc, w).length).toBeGreaterThan(0)
      }
    }
  })

  it('counts match the source: 36 / 9 / 9 with no gaps', () => {
    const pf = read('personal-finance.md')
    expect(pf.weekCount).toBe(36)
    expect(definedWeeks(pf)).toEqual(Array.from({ length: 36 }, (_, i) => i + 1))
    expect(pf.grades).toEqual(['10', '12'])

    const ai = read('ai-literacy.md')
    expect(ai.weekCount).toBe(9)
    expect(definedWeeks(ai)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(ai.grades).toBe('all')

    const cm = read('competitors-mind.md')
    expect(cm.weekCount).toBe(9)
    expect(definedWeeks(cm)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(cm.subjectId).toBe('mindset')
  })
})

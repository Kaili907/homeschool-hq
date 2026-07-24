import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../migration'
import type { Profile } from '../types'
import {
  attendanceCsv,
  effectiveHoursPerDay,
  estimateHoursFromTemplate,
  getAttendance,
  loggedMonths,
  monthTotals,
  recordAttendance,
  setHoursPerDay,
  yearToDateTotals,
} from './attendance'

const kid = (grade: Profile['grade'] = '3'): Profile => emptyProfile('p1', 'Test Kid', grade)

describe('hours estimation', () => {
  it('estimates a full day from the weekday template block count (0.5h/block)', () => {
    // grade 3 weekday default = 8 blocks → 4.0h
    expect(estimateHoursFromTemplate(kid('3'))).toBe(4)
    // grade 6 default = 9 blocks → 4.5h
    expect(estimateHoursFromTemplate(kid('6'))).toBe(4.5)
  })

  it('effective hours prefers Dad’s override, falls back to the estimate', () => {
    const p = kid('3')
    expect(effectiveHoursPerDay(p)).toBe(estimateHoursFromTemplate(p))
    const withOverride = setHoursPerDay(p, 5.5)
    expect(effectiveHoursPerDay(withOverride)).toBe(5.5)
    // an override of 0 is honoured (not treated as "unset")
    expect(effectiveHoursPerDay(setHoursPerDay(p, 0))).toBe(0)
  })

  it('clearing the override falls back to the estimate again', () => {
    const p = setHoursPerDay(kid('3'), 6)
    const cleared = setHoursPerDay(p, undefined)
    expect(getAttendance(cleared).hoursPerDay).toBeUndefined()
    expect(effectiveHoursPerDay(cleared)).toBe(estimateHoursFromTemplate(cleared))
  })
})

describe('attendance recording (append-only, idempotent)', () => {
  it('records a day only when the mission is complete', () => {
    const p = kid('3')
    expect(getAttendance(recordAttendance(p, false, '2026-09-08')).log).toHaveLength(0)
    const rec = recordAttendance(p, true, '2026-09-08')
    expect(getAttendance(rec).log).toEqual([{ date: '2026-09-08', hours: 4 }])
  })

  it('is idempotent — the same date is never logged twice', () => {
    let p = recordAttendance(kid('3'), true, '2026-09-08')
    p = recordAttendance(p, true, '2026-09-08')
    p = recordAttendance(p, true, '2026-09-08')
    expect(getAttendance(p).log).toHaveLength(1)
  })

  it('snapshots hours at record time — a later override does not rewrite history', () => {
    let p = recordAttendance(kid('3'), true, '2026-09-08') // logged at 4h estimate
    p = setHoursPerDay(p, 6) // Dad changes the default afterwards
    p = recordAttendance(p, true, '2026-09-09') // new day at the new rate
    expect(getAttendance(p).log).toEqual([
      { date: '2026-09-08', hours: 4 },
      { date: '2026-09-09', hours: 6 },
    ])
  })

  it('keeps the logged day even if the mission is later marked incomplete', () => {
    let p = recordAttendance(kid('3'), true, '2026-09-08')
    // a subsequent "incomplete" report never removes the append-only row
    p = recordAttendance(p, false, '2026-09-08')
    expect(getAttendance(p).log).toHaveLength(1)
  })
})

describe('aggregation', () => {
  const seed = (): Profile => {
    let p = kid('3')
    for (const date of ['2026-09-01', '2026-09-15', '2026-10-02', '2027-01-10']) {
      p = recordAttendance(p, true, date)
    }
    return p
  }

  it('month totals count days and sum hours', () => {
    const s = getAttendance(seed())
    expect(monthTotals(s, '2026-09')).toEqual({ days: 2, hours: 8 })
    expect(monthTotals(s, '2026-10')).toEqual({ days: 1, hours: 4 })
    expect(monthTotals(s, '2026-11')).toEqual({ days: 0, hours: 0 })
  })

  it('YTD rolls over Aug 1 — a January date still counts the prior-August start', () => {
    const s = getAttendance(seed())
    // asOf in Jan 2027 → school year started 2026-08-01, so all four days count
    expect(yearToDateTotals(s, '2027-01-10')).toEqual({ days: 4, hours: 16 })
    // asOf in Oct 2026 → only the three Fall days so far
    expect(yearToDateTotals(s, '2026-10-31')).toEqual({ days: 3, hours: 12 })
  })

  it('lists logged months most-recent first', () => {
    expect(loggedMonths(getAttendance(seed()))).toEqual(['2027-01', '2026-10', '2026-09'])
  })
})

describe('CSV export', () => {
  it('emits a header and one sorted row per day', () => {
    let p = kid('3')
    p = recordAttendance(p, true, '2026-09-15')
    p = recordAttendance(p, true, '2026-09-01')
    expect(attendanceCsv(getAttendance(p))).toBe('date,hours\n2026-09-01,4\n2026-09-15,4')
  })
})

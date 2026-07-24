import { describe, expect, it } from 'vitest'
import { emptyProfile } from '../migration'
import type { Profile } from '../types'
import {
  addServiceEntry,
  deleteServiceEntry,
  getServiceLog,
  serviceCsv,
  serviceYtd,
  setServiceApproved,
  sortedService,
} from './service'

const teen = (): Profile => emptyProfile('p5', 'Senior', '12')

const add = (p: Profile, over: Partial<{ date: string; org: string; hours: number; note: string }> = {}) =>
  addServiceEntry(p, {
    date: '2026-09-10',
    org: 'Wrestling club',
    hours: 3,
    note: 'Helped coach the littles',
    ...over,
  })

describe('adding service entries', () => {
  it('adds a valid, unapproved entry', () => {
    const res = add(teen())
    expect(res.ok).toBe(true)
    const log = getServiceLog(res.profile)
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({ org: 'Wrestling club', hours: 3, approved: false })
  })

  it('rejects missing org, non-positive hours, and missing date', () => {
    expect(add(teen(), { org: '  ' }).error).toMatch(/organization/i)
    expect(add(teen(), { hours: 0 }).error).toMatch(/greater than 0/i)
    expect(add(teen(), { date: '' }).error).toMatch(/date/i)
  })

  it('trims org and note', () => {
    const log = getServiceLog(add(teen(), { org: '  Food bank  ', note: '  boxes  ' }).profile)
    expect(log[0].org).toBe('Food bank')
    expect(log[0].note).toBe('boxes')
  })
})

describe('Dad approval lock', () => {
  it('approving locks the entry against deletion until unlocked', () => {
    let p = add(teen()).profile
    const id = getServiceLog(p)[0].id
    p = setServiceApproved(p, id, true)
    expect(getServiceLog(p)[0].approved).toBe(true)

    const blocked = deleteServiceEntry(p, id)
    expect(blocked.ok).toBe(false)
    expect(getServiceLog(blocked.profile)).toHaveLength(1) // still there

    // unlock → deletable again
    p = setServiceApproved(p, id, false)
    const ok = deleteServiceEntry(p, id)
    expect(ok.ok).toBe(true)
    expect(getServiceLog(ok.profile)).toHaveLength(0)
  })

  it('an unapproved entry can be deleted by the teen', () => {
    const p = add(teen()).profile
    const id = getServiceLog(p)[0].id
    expect(getServiceLog(deleteServiceEntry(p, id).profile)).toHaveLength(0)
  })
})

describe('YTD totals', () => {
  const seed = (): Profile => {
    let p = teen()
    p = add(p, { date: '2026-09-10', hours: 3 }).profile
    p = add(p, { date: '2026-11-02', hours: 5 }).profile
    p = add(p, { date: '2027-01-15', hours: 2 }).profile
    p = add(p, { date: '2026-05-01', hours: 8 }).profile // prior school year
    // approve two of them
    const log = getServiceLog(p)
    p = setServiceApproved(p, log[0].id, true) // the Sep entry
    p = setServiceApproved(p, log[1].id, true) // the Nov entry
    return p
  }

  it('sums the current school year (Aug 1 rollover) and splits approved vs total', () => {
    const t = serviceYtd(getServiceLog(seed()), '2027-02-01')
    // Sep(3) + Nov(5) + Jan(2) = 10 within the year; May(8) is the prior year
    expect(t.total).toBe(10)
    expect(t.approved).toBe(8) // Sep + Nov approved
    expect(t.count).toBe(3)
    expect(t.pending).toBe(1)
  })
})

describe('sorting + CSV export', () => {
  it('sorts most-recent first for display', () => {
    let p = teen()
    p = add(p, { date: '2026-09-01' }).profile
    p = add(p, { date: '2026-10-01' }).profile
    expect(sortedService(getServiceLog(p)).map((e) => e.date)).toEqual(['2026-10-01', '2026-09-01'])
  })

  it('emits a header and quotes fields with commas', () => {
    let p = add(teen(), { date: '2026-09-10', org: 'Shelter, Inc', hours: 3, note: 'sorting' }).profile
    p = setServiceApproved(p, getServiceLog(p)[0].id, true)
    expect(serviceCsv(getServiceLog(p))).toBe(
      'date,org,hours,approved,note\n2026-09-10,"Shelter, Inc",3,yes,sorting',
    )
  })
})

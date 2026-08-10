import { describe, expect, it } from 'vitest'
import {
  ADMIN_COST_MAX_RANGE_DAYS,
  resolveAdminCostRange,
} from './admin-cost-projection.js'

const NOW = new Date('2026-08-08T18:30:00.000Z')

function event(queryStringParameters) {
  return { queryStringParameters }
}

describe('Admin Costs v3 UTC date ranges', () => {
  it.each([
    [{ range: 'today' }, ['2026-08-08', '2026-08-08', 1]],
    [{ range: '7-days' }, ['2026-08-02', '2026-08-08', 7]],
    [{ range: '30-days' }, ['2026-07-10', '2026-08-08', 30]],
    [{ range: 'month' }, ['2026-08-01', '2026-08-08', 8]],
    [{ range: 'custom', start: '2025-08-08', end: '2026-08-08' }, ['2025-08-08', '2026-08-08', ADMIN_COST_MAX_RANGE_DAYS]],
  ])('resolves %o', (query, expected) => {
    const range = resolveAdminCostRange(event(query), NOW)
    expect([range.start, range.end, range.days]).toEqual(expected)
    expect(range.startAt).toMatch(/T00:00:00\.000Z$/)
    expect(range.endExclusive).toMatch(/T00:00:00\.000Z$/)
  })

  it.each([
    {},
    { range: 'school-year' },
    { range: 'today', role: 'owner' },
    { range: 'custom', start: '2026-08-08' },
    { range: 'custom', start: '2026-08-09', end: '2026-08-08' },
    { range: 'custom', start: '2026-02-30', end: '2026-08-08' },
    { range: 'custom', start: '2026-08-08', end: '2026-08-09' },
  ])('rejects malformed range %o', (query) => {
    expect(() => resolveAdminCostRange(event(query), NOW)).toThrow()
  })

  it('rejects an excessive custom range and duplicate query keys', () => {
    expect(() => resolveAdminCostRange(event({
      range: 'custom', start: '2025-08-07', end: '2026-08-08',
    }), NOW)).toThrow()
    expect(() => resolveAdminCostRange({ rawQueryString: 'range=today&range=30-days' }, NOW)).toThrow()
    expect(() => resolveAdminCostRange({
      queryStringParameters: { range: 'today' },
      multiValueQueryStringParameters: { range: ['today', '30-days'] },
    }, NOW)).toThrow()
  })
})

import { reject } from './http.js'
import { buildAdminCostAggregateProjection } from './admin-cost-aggregate.js'

export const ADMIN_COST_MAX_RANGE_DAYS = 366

const DAY_MS = 24 * 60 * 60 * 1_000
const RANGE_PRESETS = new Set(['today', '7-days', '30-days', 'month'])

function isoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value
    ? null
    : value
}

function utcDate(milliseconds) {
  return new Date(milliseconds).toISOString().slice(0, 10)
}

function midnightUtc(date) {
  return Date.parse(`${date}T00:00:00.000Z`)
}

function parseQuery(event) {
  const raw = typeof event?.rawQueryString === 'string'
    ? event.rawQueryString
    : typeof event?.rawQuery === 'string'
      ? event.rawQuery
      : null
  const multi = event?.multiValueQueryStringParameters
  if (multi && typeof multi === 'object' && !Array.isArray(multi)) {
    for (const values of Object.values(multi)) {
      if (!Array.isArray(values) || values.length !== 1 || typeof values[0] !== 'string') {
        reject(400, 'invalid_range')
      }
    }
  }
  const entries = raw !== null
    ? [...new URLSearchParams(raw).entries()]
    : multi && typeof multi === 'object' && !Array.isArray(multi)
      ? Object.entries(multi).map(([key, values]) => [key, values[0]])
      : Object.entries(event?.queryStringParameters ?? {}).filter(([, value]) => value !== null)
  const allowed = new Set(['range', 'start', 'end'])
  if (entries.length < 1 || entries.some(([key, value]) => !allowed.has(key) || typeof value !== 'string')) {
    reject(400, 'invalid_range')
  }
  const query = Object.create(null)
  for (const [key, value] of entries) {
    if (Object.hasOwn(query, key)) reject(400, 'invalid_range')
    query[key] = value
  }
  return query
}

export function resolveAdminCostRange(event, now = new Date()) {
  const query = parseQuery(event)
  const today = utcDate(now.getTime())
  let start
  let end
  let kind

  if (query.range === 'custom') {
    if (Object.keys(query).length !== 3) reject(400, 'invalid_range')
    start = isoDate(query.start)
    end = isoDate(query.end)
    kind = 'custom'
    if (!start || !end || start > end || end > today) reject(400, 'invalid_range')
  } else {
    if (Object.keys(query).length !== 1 || !RANGE_PRESETS.has(query.range)) {
      reject(400, 'invalid_range')
    }
    kind = query.range
    end = today
    const endMs = midnightUtc(end)
    if (kind === 'month') start = `${end.slice(0, 7)}-01`
    else {
      const days = kind === 'today' ? 1 : kind === '7-days' ? 7 : 30
      start = utcDate(endMs - (days - 1) * DAY_MS)
    }
  }

  const startMs = midnightUtc(start)
  const endExclusiveMs = midnightUtc(end) + DAY_MS
  const days = Math.round((endExclusiveMs - startMs) / DAY_MS)
  if (days < 1 || days > ADMIN_COST_MAX_RANGE_DAYS) reject(400, 'range_too_large')

  return Object.freeze({
    kind,
    start,
    end,
    startAt: new Date(startMs).toISOString(),
    endExclusive: new Date(endExclusiveMs).toISOString(),
    days,
  })
}

export function createAdminCostProjection({ gatewayAccess, now = () => new Date() }) {
  if (!gatewayAccess || typeof gatewayAccess.aggregateProviderUsageCosts !== 'function') {
    throw new TypeError('admin cost projection requires the provider usage aggregate seam')
  }
  return Object.freeze({
    async read(event) {
      const observedAt = now()
      const range = resolveAdminCostRange(event, observedAt)
      const aggregate = await gatewayAccess.aggregateProviderUsageCosts({
        start: range.startAt,
        endExclusive: range.endExclusive,
      })
      return buildAdminCostAggregateProjection(aggregate, range, observedAt)
    },
  })
}

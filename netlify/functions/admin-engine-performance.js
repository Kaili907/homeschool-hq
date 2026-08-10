import { ADMIN_ENGINE_IDS } from '../../src/admin/contracts.ts'
import {
  buildEnginePerformanceProjection,
  ENGINE_PERFORMANCE_SOURCE_LIMIT,
} from '../../src/admin/enginePerformanceModel.ts'
import { createAdminAuthorization } from './_shared/admin-authorization.js'
import {
  AdminEnginePerformanceReadError,
  createAdminEnginePerformanceReader,
} from './_shared/admin-engine-performance-reader.js'
import { errorResponse, jsonResponse } from './_shared/http.js'

const PATHS = new Set([
  '/api/admin/v1/engine-performance',
  '/.netlify/functions/admin-engine-performance',
])
const ALLOWED_QUERY = new Set(['window', 'engine', 'engineVersion', 'course', 'unit'])
const WINDOWS = Object.freeze({ '7d': 7, '30d': 30 })
const SAFE_VERSION = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/
const SAFE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/

function invalidQuery(event) {
  const query = event?.queryStringParameters
  if (query !== null && query !== undefined && (typeof query !== 'object' || Array.isArray(query))) return true
  if (query && Object.keys(query).some((key) => !ALLOWED_QUERY.has(key))) return true
  const multi = event?.multiValueQueryStringParameters
  if (multi && (typeof multi !== 'object' || Array.isArray(multi))) return true
  return !!multi && Object.entries(multi).some(([key, values]) =>
    !ALLOWED_QUERY.has(key) || !Array.isArray(values) || values.length !== 1)
}

function optionalToken(value, pattern) {
  if (value === undefined || value === null || value === '') return null
  return typeof value === 'string' && pattern.test(value) ? value : undefined
}

export function enginePerformanceFilters(event, now) {
  if (invalidQuery(event)) return null
  const query = event?.queryStringParameters ?? {}
  const windowName = query.window ?? '30d'
  if (!Object.hasOwn(WINDOWS, windowName)) return null
  const engine = optionalToken(query.engine, /^[a-z]+$/)
  const engineVersion = optionalToken(query.engineVersion, SAFE_VERSION)
  const courseRef = optionalToken(query.course, SAFE_REFERENCE)
  const unitRef = optionalToken(query.unit, SAFE_REFERENCE)
  if (
    engine === undefined || (engine !== null && !ADMIN_ENGINE_IDS.includes(engine))
    || engineVersion === undefined || courseRef === undefined || unitRef === undefined
  ) return null
  const end = new Date(now)
  if (!Number.isFinite(end.getTime())) return null
  const start = new Date(end.getTime() - WINDOWS[windowName] * 24 * 60 * 60 * 1_000)
  return Object.freeze({
    start: start.toISOString(),
    end: end.toISOString(),
    engine,
    engineVersion,
    courseRef,
    unitRef,
  })
}

export function createAdminEnginePerformanceHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const reader = overrides.reader ?? createAdminEnginePerformanceReader({
    env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.telemetryClient,
  })
  const now = overrides.now ?? (() => new Date().toISOString())

  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    const generatedAt = now()
    const filters = enginePerformanceFilters(event, generatedAt)
    if (!filters) return errorResponse(400, 'invalid_request')

    const authorized = await authorization.require(event, 'engines:read')
    if (!authorized.ok) return authorized.response

    try {
      const rows = await reader.list(ENGINE_PERFORMANCE_SOURCE_LIMIT)
      return jsonResponse(200, buildEnginePerformanceProjection(rows, {
        generatedAt,
        filters,
        sourceLimit: ENGINE_PERFORMANCE_SOURCE_LIMIT,
      }))
    } catch (error) {
      if (error instanceof AdminEnginePerformanceReadError && error.code === 'source_timeout') {
        return errorResponse(504, 'engine_performance_timeout')
      }
      return errorResponse(503, 'engine_performance_unavailable')
    }
  }
}

export const handler = createAdminEnginePerformanceHandler()

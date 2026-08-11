import { createAdminAuthorization } from './_shared/admin-authorization.js'
import {
  AdminHealthSourceReadError,
  createAdminHealthSource,
  disabledHealthEngines,
} from './_shared/admin-health-source.js'
import { errorResponse, hasBody, jsonResponse, readQueryEntries } from './_shared/http.js'
import { createEffectiveConfigurationReader } from './_shared/effective-configuration.js'
import {
  SYSTEM_HEALTH_WINDOWS,
  buildSystemHealthProjectionFromAggregates,
} from '../../src/admin/systemHealth.ts'

const ADMIN_HEALTH_PATHS = new Set([
  '/api/admin/v1/health',
  '/.netlify/functions/admin-health',
])

function selectedWindow(event) {
  let entries
  try {
    entries = readQueryEntries(event)
  } catch {
    return null
  }
  if (entries.length > 1 || (entries.length === 1 && entries[0][0] !== 'window')) return null
  const value = entries.length === 0 ? '1h' : entries[0][1]
  return SYSTEM_HEALTH_WINDOWS.includes(value) ? value : null
}

export function createAdminHealthHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const source = overrides.source ?? createAdminHealthSource({
    env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.telemetryClient,
  })
  const now = overrides.now ?? (() => new Date())
  const configurationReader = overrides.effectiveConfigurationReader
    ?? createEffectiveConfigurationReader({ env, fetchImpl: overrides.fetchImpl ?? globalThis.fetch })

  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!ADMIN_HEALTH_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasBody(event)) return errorResponse(400, 'invalid_request')
    const window = selectedWindow(event)
    if (window === null) return errorResponse(400, 'invalid_request')

    let authorized
    try {
      authorized = await authorization.require(event, 'health:read')
    } catch {
      return errorResponse(503, 'authorization_unavailable')
    }
    if (!authorized.ok) return authorized.response

    const observationTime = now()
    try {
      let configuration = null
      if (overrides.disabledEngines === undefined) {
        try {
          configuration = await configurationReader.read()
        } catch {
          configuration = { status: 'unavailable' }
        }
      }
      const runtimeValues = configuration?.status === 'available'
        ? { aiEnabled: configuration.runtime.aiEnabled, ttsEnabled: configuration.runtime.ttsEnabled }
        : { aiEnabled: false, ttsEnabled: false }
      const evidence = await source.read({ now: observationTime, selectedWindow: window })
      const projection = buildSystemHealthProjectionFromAggregates(evidence, {
        now: observationTime,
        selectedWindow: window,
        disabledEngines: overrides.disabledEngines ?? disabledHealthEngines(env, runtimeValues),
      })
      return jsonResponse(200, projection)
    } catch (error) {
      return jsonResponse(200, buildSystemHealthProjectionFromAggregates(null, {
        now: observationTime,
        selectedWindow: window,
        disabledEngines: overrides.disabledEngines ?? disabledHealthEngines(env, {
          aiEnabled: false,
          ttsEnabled: false,
        }),
        evidenceCompleteness: error instanceof AdminHealthSourceReadError
          ? error.code
          : 'unavailable',
      }))
    }
  }
}

export const handler = createAdminHealthHandler()

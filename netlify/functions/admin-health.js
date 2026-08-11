import { createAdminAuthorization } from './_shared/admin-authorization.js'
import {
  createAdminHealthSource,
  disabledHealthEngines,
} from './_shared/admin-health-source.js'
import { errorResponse, hasBody, jsonResponse, readQueryEntries } from './_shared/http.js'
import { createRuntimeConfigurationResolver } from './_shared/admin-runtime-configuration.js'
import {
  SYSTEM_HEALTH_WINDOWS,
  buildSystemHealthProjection,
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

    try {
      let runtimeValues = { aiEnabled: false, ttsEnabled: false }
      if (overrides.disabledEngines === undefined) {
        try {
          const runtimeConfigurationResolver = overrides.runtimeConfigurationResolver
            ?? createRuntimeConfigurationResolver({
              env,
              fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
              source: overrides.runtimeConfigurationSource,
              serviceClient: overrides.configurationClient,
            })
          runtimeValues = (await runtimeConfigurationResolver.resolve()).values
        } catch {
          // Injected resolvers fail closed just like the production resolver.
        }
      }
      const evidence = await source.list()
      const projection = buildSystemHealthProjection(evidence.events, {
        now: now(),
        selectedWindow: window,
        disabledEngines: overrides.disabledEngines ?? disabledHealthEngines(env, runtimeValues),
        sourceTruncated: evidence.sourceTruncated,
        rejectedRows: evidence.rejectedRows,
      })
      return jsonResponse(200, projection)
    } catch {
      return errorResponse(503, 'health_source_unavailable')
    }
  }
}

export const handler = createAdminHealthHandler()

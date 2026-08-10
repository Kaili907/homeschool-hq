import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { createAdminCostProjection } from './_shared/admin-cost-projection.js'
import {
  createEffectiveConfigurationReader,
  evaluateMonthlyCostThreshold,
} from './_shared/effective-configuration.js'
import { createGatewayAccess } from './_shared/gateway-access.js'
import { errorResponse, GatewayError, jsonResponse, responseForError } from './_shared/http.js'

const ADMIN_COST_PATHS = new Set([
  '/api/admin/v1/costs',
  '/.netlify/functions/admin-costs',
])

export function createAdminCostsHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const gatewayAccess = overrides.gatewayAccess ?? createGatewayAccess({
    env,
    fetchImpl,
    client: overrides.serviceClient,
  })
  const projection = overrides.projection ?? createAdminCostProjection({
    gatewayAccess,
    now: overrides.now,
  })
  const configurationReader = overrides.effectiveConfigurationReader
    ?? createEffectiveConfigurationReader({ env, fetchImpl })

  return async (event) => {
    if (event?.httpMethod !== 'GET') {
      return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    }
    if (!ADMIN_COST_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')

    const authorized = await authorization.require(event, 'costs:read')
    if (!authorized.ok) return authorized.response

    try {
      const costs = await projection.read(event)
      const configuration = await configurationReader.read()
      return jsonResponse(200, {
        ...costs,
        monthlyCostThreshold: evaluateMonthlyCostThreshold({
          rangeKind: costs.range?.kind,
          calculatedCost: costs.summary?.calculatedCost,
          configuration,
        }),
      })
    } catch (error) {
      if (error instanceof GatewayError && error.statusCode >= 500) {
        return errorResponse(
          error.statusCode === 504 ? 504 : 503,
          error.statusCode === 504 ? 'cost_source_timeout' : 'cost_source_unavailable',
        )
      }
      return responseForError(error)
    }
  }
}

export const handler = createAdminCostsHandler()

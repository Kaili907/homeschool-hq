import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { createAdminConfigurationSource } from './_shared/admin-configuration-source.js'
import { createAdminCostProjection } from './_shared/admin-cost-projection.js'
import { createAdminMonthlyCostAlertEvaluator } from './_shared/admin-monthly-cost-alert.js'
import { createGatewayAccess } from './_shared/gateway-access.js'
import { errorResponse, GatewayError, hasBody, jsonResponse, responseForError } from './_shared/http.js'

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
  const configurationSource = overrides.configurationSource ?? createAdminConfigurationSource({
    env,
    fetchImpl,
    serviceClient: overrides.configurationClient ?? overrides.serviceClient,
  })
  const now = overrides.now ?? (() => new Date())
  const projection = overrides.projection ?? createAdminCostProjection({
    gatewayAccess,
    now,
  })
  const monthlyCostAlertEvaluator = overrides.monthlyCostAlertEvaluator
    ?? createAdminMonthlyCostAlertEvaluator({
      gatewayAccess,
      configurationSource,
      now,
    })

  return async (event) => {
    if (event?.httpMethod !== 'GET') {
      return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    }
    if (!ADMIN_COST_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasBody(event)) {
      return errorResponse(400, 'invalid_request')
    }

    const authorized = await authorization.require(event, 'costs:read')
    if (!authorized.ok) return authorized.response

    try {
      const model = await projection.read(event)
      const monthlyCostAlert = await monthlyCostAlertEvaluator.read({
        generatedAt: model.generatedAt,
      })
      return jsonResponse(200, {
        ...model,
        contractVersion: 4,
        monthlyCostAlert,
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

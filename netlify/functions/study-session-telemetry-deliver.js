import { createAdminAuthorization } from './_shared/admin-authorization.js'
import {
  assertExactObject,
  errorResponse,
  hasQuery,
  jsonResponse,
  readJsonBody,
  responseForError,
} from './_shared/http.js'
import {
  runProductionStudySessionTelemetryDelivery,
  studySessionTelemetryDeliveryWireResult,
  unavailableStudySessionTelemetryDeliveryResult,
} from './_shared/study-session-telemetry/entrypoint.js'
import { studySessionTelemetryInvocationReadiness } from './_shared/study-session-telemetry/invocation-readiness.js'

const PATHS = new Set([
  '/api/admin/v1/study-telemetry-delivery',
  '/.netlify/functions/study-session-telemetry-deliver',
])

function successful(result) {
  return result.health.worker === 'available'
    && ['no_work', 'processed'].includes(result.delivery.category)
}

export function createStudySessionTelemetryDeliverHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl: overrides.fetchImpl ?? globalThis.fetch,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const runDelivery = overrides.runDelivery ?? runProductionStudySessionTelemetryDelivery
  const readiness = overrides.readiness ?? studySessionTelemetryInvocationReadiness

  return async (event) => {
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (!['GET', 'POST'].includes(event?.httpMethod)) {
      return errorResponse(405, 'method_not_allowed', { allow: 'GET, POST' })
    }
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    if (event.httpMethod === 'POST') {
      let body
      try {
        body = assertExactObject(readJsonBody(event, 128), ['schemaVersion', 'action'])
      } catch (error) {
        return responseForError(error)
      }
      if (body.schemaVersion !== 1 || body.action !== 'deliver') {
        return errorResponse(400, 'invalid_request')
      }
    }

    let authorized
    try {
      authorized = await authorization.require(
        event,
        event.httpMethod === 'POST' ? 'engines:operate' : 'engines:read',
      )
    } catch {
      return errorResponse(503, 'authorization_unavailable')
    }
    if (!authorized.ok) return authorized.response

    if (event.httpMethod === 'GET') {
      return jsonResponse(200, readiness({ env, manualAuthority: true }))
    }

    let result
    try {
      result = studySessionTelemetryDeliveryWireResult(await runDelivery({ env }))
    } catch {
      result = unavailableStudySessionTelemetryDeliveryResult()
    }
    return jsonResponse(successful(result) ? 200 : 503, result)
  }
}

export const handler = createStudySessionTelemetryDeliverHandler()

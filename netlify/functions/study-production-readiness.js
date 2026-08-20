import {
  envFlagEnabled,
  errorResponse,
  hasQuery,
  jsonResponse,
} from './_shared/http.js'
import { createStudyGuardianAuthorization } from './_shared/study-guardian-authorization.js'
import {
  createStudyProductionReadinessService,
  readinessWireResult,
} from './_shared/study-production/readiness.js'

const READINESS_PATHS = new Set([
  '/api/study/production/readiness',
  '/.netlify/functions/study-production-readiness',
])

export function createStudyProductionReadinessHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createStudyGuardianAuthorization({
    env,
    fetchImpl,
    authVerifier: overrides.authVerifier,
  })
  const readiness = overrides.readiness ?? createStudyProductionReadinessService({
    env,
    fetchImpl,
    now: overrides.now,
    ttlMs: overrides.ttlMs,
    identityVerifier: overrides.identityVerifier,
    durablePorts: overrides.durablePorts,
    academicReadiness: overrides.academicReadiness,
    curriculumBindingReadiness: overrides.curriculumBindingReadiness,
    sessionSemanticsReadiness: overrides.sessionSemanticsReadiness,
    effectiveSettingsReadiness: overrides.effectiveSettingsReadiness,
    classifier: overrides.classifier,
    session17: overrides.session17,
  })

  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!READINESS_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    let authorized
    try {
      authorized = await authorization.require(event, 'study:production-readiness:read')
    } catch {
      return errorResponse(503, 'authorization_unavailable')
    }
    if (!authorized.ok) return authorized.response

    const snapshot = await readiness.check()
    const wire = readinessWireResult(snapshot)
    return jsonResponse(wire.status === 'ready' ? 200 : 503, wire)
  }
}

export const handler = createStudyProductionReadinessHandler()

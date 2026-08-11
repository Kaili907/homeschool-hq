import {
  envFlagEnabled,
  errorResponse,
  hasQuery,
  jsonResponse,
} from './_shared/http.js'
import { verifySupabaseBearer } from './_shared/supabase-auth.js'
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
  const authVerifier = overrides.authVerifier ?? verifySupabaseBearer
  const readiness = overrides.readiness ?? createStudyProductionReadinessService({
    env,
    fetchImpl,
    now: overrides.now,
    ttlMs: overrides.ttlMs,
    identityVerifier: overrides.identityVerifier,
    durablePorts: overrides.durablePorts,
    academicReadiness: overrides.academicReadiness,
    curriculumBindingReadiness: overrides.curriculumBindingReadiness,
    effectiveSettingsReadiness: overrides.effectiveSettingsReadiness,
    classifier: overrides.classifier,
    session17: overrides.session17,
  })

  return async (event) => {
    if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) return errorResponse(503, 'gateway_disabled')
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!READINESS_PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event)) return errorResponse(400, 'invalid_request')

    const auth = await authVerifier(event, { fetchImpl, env, timeoutMs: 3_000 })
    if (!auth.ok) return auth.response

    const snapshot = await readiness.check()
    const wire = readinessWireResult(snapshot)
    return jsonResponse(wire.status === 'ready' ? 200 : 503, wire)
  }
}

export const handler = createStudyProductionReadinessHandler()

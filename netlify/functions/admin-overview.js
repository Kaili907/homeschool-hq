import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { createAdminLearnerReader } from './_shared/admin-learner-reader.js'
import { createAdminHealthSource, disabledHealthEngines } from './_shared/admin-health-source.js'
import { createAdminEnginePerformanceReader } from './_shared/admin-engine-performance-reader.js'
import { createGatewayAccess } from './_shared/gateway-access.js'
import { createAdminSafetyReader } from './_shared/admin-safety-reader.js'
import { loadAdminCurriculumValidationEvidence } from './_shared/admin-curriculum-evidence.js'
import { createFilesystemCurriculumSource } from '../../src/admin/curriculum/filesystemSource.node.ts'
import { composeAdminOverview, resolveAdminOverviewRange } from './_shared/admin-overview.js'
import { errorResponse, jsonResponse } from './_shared/http.js'
import { createRuntimeConfigurationResolver } from './_shared/admin-runtime-configuration.js'

const PATHS = new Set([
  '/api/admin/v1/overview',
  '/.netlify/functions/admin-overview',
])

export function createAdminOverviewHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const learnerReader = overrides.learnerReader ?? createAdminLearnerReader({
    env, fetchImpl, clientFactory: overrides.learnerClientFactory, clock: overrides.now,
  })
  const healthSource = overrides.healthSource ?? createAdminHealthSource({
    env, fetchImpl, client: overrides.telemetryClient,
  })
  const performanceReader = overrides.performanceReader ?? createAdminEnginePerformanceReader({
    env, fetchImpl, client: overrides.telemetryClient,
  })
  const gatewayAccess = overrides.gatewayAccess ?? createGatewayAccess({
    env, fetchImpl, client: overrides.serviceClient,
  })
  const safetyReader = overrides.safetyReader ?? createAdminSafetyReader({
    env, fetchImpl, client: overrides.safetyClient,
  })
  const curriculumSource = overrides.curriculumSource ?? createFilesystemCurriculumSource()
  const now = overrides.now ?? (() => new Date())
  const sources = overrides.sources ?? {
    learners: (input) => learnerReader.readSnapshot(input),
    health: () => healthSource.list(),
    enginePerformance: (limit) => performanceReader.list(limit),
    costs: (input) => gatewayAccess.readProviderUsageCosts(input),
    safety: (input) => safetyReader.read(input),
    curriculumCatalog: () => curriculumSource.loadCatalog(),
    curriculumValidation: loadAdminCurriculumValidationEvidence,
  }

  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (typeof event?.body === 'string' && event.body !== '') return errorResponse(400, 'invalid_request')

    let authorized
    try {
      authorized = await authorization.require(event, 'overview:read')
    } catch {
      return errorResponse(503, 'authorization_unavailable')
    }
    if (!authorized.ok) return authorized.response

    const observedAt = now()
    let range
    try {
      range = resolveAdminOverviewRange(event, observedAt)
    } catch (error) {
      return errorResponse(400, error?.code === 'range_too_large' ? 'range_too_large' : 'invalid_range')
    }

    try {
      let runtimeValues = { aiEnabled: false, ttsEnabled: false }
      if (overrides.disabledEngines === undefined) {
        try {
          const runtimeConfigurationResolver = overrides.runtimeConfigurationResolver
            ?? createRuntimeConfigurationResolver({
              env,
              fetchImpl,
              source: overrides.runtimeConfigurationSource,
              serviceClient: overrides.configurationClient,
            })
          runtimeValues = (await runtimeConfigurationResolver.resolve()).values
        } catch {
          // Injected resolvers fail closed just like the production resolver.
        }
      }
      const effectiveSources = {
        ...sources,
        disabledEngines: overrides.disabledEngines ?? disabledHealthEngines(env, runtimeValues),
      }
      const response = await composeAdminOverview({
        principal: authorized.principal,
        accessToken: authorized.accessToken,
        range,
        generatedAt: observedAt.toISOString(),
        sources: effectiveSources,
        env,
      })
      return jsonResponse(200, response)
    } catch {
      return errorResponse(503, 'overview_unavailable')
    }
  }
}

export const handler = createAdminOverviewHandler()

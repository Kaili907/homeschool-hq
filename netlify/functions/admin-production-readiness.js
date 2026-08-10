import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { createAdminConfigurationSource } from './_shared/admin-configuration-source.js'
import {
  projectAdminRuntimeConfiguration,
  resolveEffectiveRuntimeConfiguration,
} from './_shared/admin-runtime-configuration.js'
import { createAdminOperationalAggregateReader } from './_shared/admin-operational-aggregate-reader.js'
import { createGatewayAccess } from './_shared/gateway-access.js'
import { errorResponse, hasQuery, jsonResponse } from './_shared/http.js'
import {
  projectPublicTtsCatalog,
  TTS_VOICE_CATALOG,
} from './_shared/tts-catalog.js'
import { createStudyProductionReadinessService } from './_shared/study-production/readiness.js'
import { createRepositoryProductionReadinessSource } from './_shared/admin-production-readiness/repository.js'
import { createAdminProductionReadinessService } from './_shared/admin-production-readiness/service.js'

const PATHS = new Set([
  '/api/admin/v1/production-readiness',
  '/.netlify/functions/admin-production-readiness',
])

function createConfigurationProbe({ env, source, catalog }) {
  return async () => {
    const saved = await source.read()
    const resolved = resolveEffectiveRuntimeConfiguration(saved, { env, catalog })
    const projection = projectAdminRuntimeConfiguration(saved, resolved)
    const savedByKey = new Map(saved.settings.map((setting) => [setting.key, setting.value]))
    const publicCatalog = projectPublicTtsCatalog(catalog, env)
    const partial = projection.settings.some((setting) =>
      setting.runtime.classification !== 'ENFORCEABLE_NOW'
      || setting.runtime.enforcement !== 'enforced'
      || setting.runtime.resolution === 'error')
    return Object.freeze({
      state: partial ? 'partial' : 'ready',
      aiRequested: savedByKey.get('runtime.ai.enabled') === true,
      aiEffective: resolved.values.aiEnabled === true,
      ttsRequested: savedByKey.get('runtime.tts.enabled') === true,
      ttsEffective: resolved.values.ttsEnabled === true,
      activeVoiceCount: publicCatalog.voices.filter((voice) => voice.status === 'active').length,
      deployableVoiceCount: publicCatalog.voices.filter((voice) =>
        voice.status === 'active' && voice.deploymentAvailable).length,
    })
  }
}

export function createAdminProductionReadinessHandler(overrides = {}) {
  const env = overrides.env ?? process.env
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch
  const now = overrides.now ?? (() => new Date())
  const authorization = overrides.authorization ?? createAdminAuthorization({
    env,
    fetchImpl,
    client: overrides.authorizationClient,
    authVerifier: overrides.authVerifier,
  })
  const repositorySource = overrides.repositorySource ?? createRepositoryProductionReadinessSource()
  const configurationSource = overrides.configurationSource ?? createAdminConfigurationSource({
    env,
    fetchImpl,
    serviceClient: overrides.configurationClient,
  })
  const catalog = overrides.catalog ?? TTS_VOICE_CATALOG
  const aggregateReader = overrides.aggregateReader ?? createAdminOperationalAggregateReader({
    env,
    fetchImpl,
    client: overrides.telemetryClient,
  })
  const gatewayAccess = overrides.gatewayAccess ?? createGatewayAccess({
    env,
    fetchImpl,
    client: overrides.serviceClient,
  })
  const studyReadiness = overrides.studyReadiness ?? createStudyProductionReadinessService({
    env,
    fetchImpl,
    identityVerifier: overrides.identityVerifier,
    durablePorts: overrides.durablePorts,
    academicReadiness: overrides.academicReadiness,
    classifier: overrides.classifier,
    session17: overrides.session17,
  })
  const service = overrides.service ?? createAdminProductionReadinessService({
    env,
    now,
    repository: overrides.repository ?? (() => repositorySource.read()),
    configuration: overrides.configuration ?? createConfigurationProbe({
      env,
      source: configurationSource,
      catalog,
    }),
    hostedMigrations: overrides.hostedMigrations,
    ownerBootstrap: overrides.ownerBootstrap,
    telemetry: overrides.telemetry ?? (async () => {
      const end = now()
      const endDate = end instanceof Date ? end : new Date(end)
      const start = new Date(endDate.valueOf() - 60 * 60 * 1_000)
      await aggregateReader.aggregate({
        start: start.toISOString(),
        endExclusive: endDate.toISOString(),
        engine: null,
        engineVersion: null,
        courseRef: null,
        unitRef: null,
        capability: 'engines:read',
      })
      return Object.freeze({ state: 'available' })
    }),
    accounting: overrides.accounting ?? (async () => {
      await gatewayAccess.readProviderUsageCosts({ limit: 1, before: now().toISOString() })
      return Object.freeze({ state: 'available' })
    }),
    study: overrides.study ?? (() => studyReadiness.check({ force: true })),
  })

  return async (event) => {
    if (event?.httpMethod !== 'GET') return errorResponse(405, 'method_not_allowed', { allow: 'GET' })
    if (!PATHS.has(event?.path ?? '')) return errorResponse(404, 'not_found')
    if (hasQuery(event) || (typeof event?.body === 'string' && event.body !== '')) {
      return errorResponse(400, 'invalid_request')
    }
    let authorized
    try {
      authorized = await authorization.require(event, 'releases:read')
    } catch {
      return errorResponse(503, 'authorization_unavailable')
    }
    if (!authorized.ok) return authorized.response
    try {
      return jsonResponse(200, await service.check(authorized.principal))
    } catch {
      return errorResponse(503, 'production_readiness_unavailable')
    }
  }
}

export const handler = createAdminProductionReadinessHandler()

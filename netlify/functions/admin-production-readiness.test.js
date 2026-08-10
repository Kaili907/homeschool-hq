import { describe, expect, it, vi } from 'vitest'
import { createAdminProductionReadinessHandler } from './admin-production-readiness.js'
import { createRepositoryProductionReadinessSource } from './_shared/admin-production-readiness/repository.js'
import { createAdminProductionReadinessService } from './_shared/admin-production-readiness/service.js'

const NOW = new Date('2026-08-10T18:00:00.000Z')
const SECRET_VALUES = {
  SUPABASE_SERVICE_ROLE_KEY: 'SECRET-service-role-value',
  STUDY_SAFETY_RATE_LIMIT_HMAC_KEY: 'SECRET-study-hmac-value',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL: 'SECRET-worker-value',
  ANTHROPIC_API_KEY: 'SECRET-anthropic-value',
}
const READY_ENV = {
  ...SECRET_VALUES,
  CONTEXT: 'production',
  ACADEMY_APP_VERSION: 'build-1',
  SUPABASE_URL: 'https://project.invalid',
  SUPABASE_ANON_KEY: 'public-anon-value',
  VITE_USE_PROXY: 'true',
  ACADEMY_STUDY_ENABLED: 'true',
  VITE_STUDY_ENGINE_ENABLED: 'true',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CREDENTIAL_VERSION: 'v1',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_ID: 'worker-1',
  ACADEMY_STUDY_ADULT_REVIEW_WORKER_CONFIGURATION_VERSION: 'v1',
  ACADEMY_AI_ENABLED: 'false',
}
const READY_REPOSITORY = {
  migrations: {
    state: 'ready', migrationCount: 19, manifestCount: 19,
    collisionVersions: [], orderingHazardCount: 0, hashMismatchCount: 0,
  },
  curriculum: {
    state: 'ready', activeVersion: '1.0.0', registeredReleaseCount: 1,
    validationState: 'passed',
  },
}
const READY_CONFIGURATION = {
  state: 'ready',
  aiRequested: false,
  aiEffective: false,
  ttsRequested: false,
  ttsEffective: false,
  activeVoiceCount: 0,
  deployableVoiceCount: 0,
}
const OWNER = { role: 'owner', capabilities: ['releases:read'] }

function dependencies(overrides = {}) {
  return {
    env: READY_ENV,
    now: () => NOW,
    repository: vi.fn(async () => READY_REPOSITORY),
    configuration: vi.fn(async () => READY_CONFIGURATION),
    hostedMigrations: vi.fn(async () => ({ state: 'verified' })),
    ownerBootstrap: vi.fn(async () => ({ state: 'verified' })),
    telemetry: vi.fn(async () => ({ state: 'available' })),
    accounting: vi.fn(async () => ({ state: 'available' })),
    study: vi.fn(async () => ({ status: 'ready' })),
    ...overrides,
  }
}

function findCheck(projection, id) {
  return projection.domains.flatMap((domain) => domain.checks).find((check) => check.id === id)
}

describe('Admin Production Readiness evidence composition', () => {
  it('allows READY only when every required gate has positive authoritative evidence', async () => {
    const projection = await createAdminProductionReadinessService(dependencies()).check(OWNER)
    expect(projection.status).toBe('READY')
    expect(projection.requiredSummary.blocking).toBe(0)
    expect(projection.domains).toHaveLength(8)
    expect(projection.domains.flatMap((domain) => domain.checks)
      .filter((check) => check.required)
      .every((check) => check.status === 'READY')).toBe(true)
  })

  it('keeps a required hosted migration gate UNVERIFIED and blocks READY', async () => {
    const projection = await createAdminProductionReadinessService(dependencies({
      hostedMigrations: undefined,
    })).check(OWNER)
    expect(projection.status).toBe('BLOCKED')
    expect(findCheck(projection, 'database.hosted_migrations')).toMatchObject({
      status: 'UNVERIFIED',
      evidence: { status: 'UNVERIFIED', source: 'Hosted infrastructure not contacted' },
    })
  })

  it('reports missing environment presence without serializing any secret value', async () => {
    const { SUPABASE_SERVICE_ROLE_KEY: _missing, ...env } = READY_ENV
    const projection = await createAdminProductionReadinessService(dependencies({ env })).check(OWNER)
    expect(findCheck(projection, 'deployment.environment')).toMatchObject({ status: 'BLOCKED' })
    expect(findCheck(projection, 'deployment.environment').observations).toContainEqual({
      label: 'Supabase service role key', status: 'missing',
    })
    const serialized = JSON.stringify(projection)
    for (const value of Object.values(SECRET_VALUES)) expect(serialized).not.toContain(value)
    expect(serialized).not.toMatch(/connection string|providerVoiceId|projectRef/i)
  })

  it('keeps partial effective configuration and TTS fallback from becoming ready', async () => {
    const projection = await createAdminProductionReadinessService(dependencies({
      configuration: async () => ({
        ...READY_CONFIGURATION,
        state: 'partial',
        ttsRequested: true,
        ttsEffective: false,
      }),
    })).check(OWNER)
    expect(projection.status).toBe('BLOCKED')
    expect(findCheck(projection, 'application.runtime_configuration').status).toBe('PARTIAL')
    expect(findCheck(projection, 'ai_tts.tts_state')).toMatchObject({ status: 'UNAVAILABLE' })
    expect(findCheck(projection, 'ai_tts.voice_catalog')).toMatchObject({
      status: 'UNAVAILABLE', required: true,
    })
  })

  it('reports unavailable Study and telemetry independently', async () => {
    const projection = await createAdminProductionReadinessService(dependencies({
      study: async () => { throw new Error('SECRET study detail') },
      telemetry: async () => { throw new Error('SECRET telemetry detail') },
    })).check(OWNER)
    expect(findCheck(projection, 'study.readiness').status).toBe('UNAVAILABLE')
    expect(findCheck(projection, 'telemetry.operational_aggregate').status).toBe('UNAVAILABLE')
    expect(findCheck(projection, 'curriculum.release_registry').status).toBe('READY')
    expect(JSON.stringify(projection)).not.toContain('SECRET')
  })

  it('rejects malformed evidence within its domain instead of failing or guessing', async () => {
    const projection = await createAdminProductionReadinessService(dependencies({
      repository: async () => ({ secret: 'SECRET repository exception' }),
      configuration: async () => ({ state: 'ready', apiKey: 'SECRET key' }),
    })).check(OWNER)
    expect(findCheck(projection, 'database.repository_migrations').status).toBe('UNAVAILABLE')
    expect(findCheck(projection, 'curriculum.release_registry').status).toBe('UNAVAILABLE')
    expect(findCheck(projection, 'application.runtime_configuration').status).toBe('UNAVAILABLE')
    expect(JSON.stringify(projection)).not.toContain('SECRET')
  })

  it('uses the checked-in repository registry, hashes, and migration order successfully', async () => {
    const evidence = await createRepositoryProductionReadinessSource().read()
    expect(evidence.migrations).toMatchObject({ state: 'ready', collisionVersions: [] })
    expect(evidence.curriculum).toEqual({
      state: 'ready', activeVersion: '1.0.0', registeredReleaseCount: 1,
      validationState: 'passed',
    })
  })
})

describe('Admin Production Readiness read-only endpoint', () => {
  const event = (overrides = {}) => ({
    httpMethod: 'GET',
    path: '/api/admin/v1/production-readiness',
    headers: { authorization: 'Bearer verified-token' },
    ...overrides,
  })

  it('requires releases:read and never composes evidence after permission denial', async () => {
    const check = vi.fn()
    const require = vi.fn(async () => ({
      ok: false,
      response: { statusCode: 403, body: '{"error":{"code":"admin_access_denied"}}' },
    }))
    const response = await createAdminProductionReadinessHandler({
      authorization: { require }, service: { check },
    })(event())
    expect(response.statusCode).toBe(403)
    expect(require).toHaveBeenCalledWith(expect.anything(), 'releases:read')
    expect(check).not.toHaveBeenCalled()
  })

  it('exposes only GET and rejects query, body, and mutation-shaped routes', async () => {
    const require = vi.fn(async () => ({ ok: true, principal: OWNER }))
    const check = vi.fn(async () => ({ schemaVersion: 1 }))
    const handler = createAdminProductionReadinessHandler({
      authorization: { require }, service: { check },
    })
    expect((await handler(event({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(event({ rawQuery: 'apply=true' }))).statusCode).toBe(400)
    expect((await handler(event({ body: '{"deploy":true}' }))).statusCode).toBe(400)
    expect((await handler(event({ path: '/api/admin/v1/production-readiness/deploy' }))).statusCode).toBe(404)
    expect(require).not.toHaveBeenCalled()
    expect(check).not.toHaveBeenCalled()
  })

  it('returns the sanitized projection without exposing internal service failures', async () => {
    const projection = await createAdminProductionReadinessService(dependencies()).check(OWNER)
    const handler = createAdminProductionReadinessHandler({
      authorization: { require: async () => ({ ok: true, principal: OWNER }) },
      service: { check: async () => projection },
    })
    const response = await handler(event())
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual(projection)
    for (const value of Object.values(SECRET_VALUES)) expect(response.body).not.toContain(value)
  })
})

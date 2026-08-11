import { describe, expect, it, vi } from 'vitest'
import { createAdminAuthorization } from './_shared/admin-authorization.js'
import { verifySupabaseBearer } from './_shared/supabase-auth.js'
import { errorResponse } from './_shared/http.js'
import { createAdminAccessHandler } from './admin-access.js'
import { createAdminAuditHandler } from './admin-audit.js'
import { createAdminAuthorizationHandler } from './admin-authorization.js'
import { createAdminConfigurationHandler } from './admin-configuration.js'
import { createAdminCostsHandler } from './admin-costs.js'
import { createAdminCurriculumHandler } from './admin-curriculum.js'
import { createAdminEnginePerformanceHandler } from './admin-engine-performance.js'
import { createAdminHealthHandler } from './admin-health.js'
import { createAdminLearnersHandler } from './admin-learners.js'
import { createAdminOverviewHandler } from './admin-overview.js'
import { createAdminProductionReadinessHandler } from './admin-production-readiness.js'
import { createAdminSafetyOperationsHandler } from './admin-safety-operations.js'

const USER_ID = '00000000-0000-4000-8000-000000000711'
const ASSIGNMENT_ID = '10000000-0000-4000-8000-000000000711'
const REQUEST_ID = '20000000-0000-4000-8000-000000000711'
const ACCESS_TOKEN = 'verified.admin.access.token'

function event(path, overrides = {}) {
  return {
    httpMethod: 'GET',
    path,
    headers: {
      authorization: `Bearer ${ACCESS_TOKEN}`,
      'x-admin-role': 'owner',
      'x-admin-capabilities': 'admin_roles:manage,configuration:manage',
    },
    ...overrides,
  }
}

function jsonEvent(path, body) {
  return event(path, {
    httpMethod: 'POST',
    headers: {
      authorization: `Bearer ${ACCESS_TOKEN}`,
      'content-type': 'application/json',
      'x-admin-role': 'owner',
      'x-admin-capabilities': 'admin_roles:manage,configuration:manage',
    },
    body: JSON.stringify(body),
  })
}

function databaseRoleAuthorization(role) {
  const builder = { abortSignal: vi.fn(async () => ({ data: [{ role }], error: null })) }
  const client = { rpc: vi.fn(() => builder) }
  return createAdminAuthorization({
    client,
    authVerifier: async () => ({
      ok: true,
      user: { id: USER_ID },
      accessToken: ACCESS_TOKEN,
    }),
  })
}

describe('Admin authorization red-team boundary', () => {
  it.each([
    { headers: { authorization: 'Bearer token with spaces' } },
    { headers: { authorization: 'Bearer first', Authorization: 'Bearer second' } },
    { headers: { authorization: ['Bearer token'] } },
    { headers: { authorization: 'Bearer first' }, multiValueHeaders: { authorization: ['Bearer second'] } },
    { headers: { authorization: 'Bearer first' }, multiValueHeaders: { authorization: ['Bearer first', 'Bearer second'] } },
    { headers: { authorization: `Bearer ${'a'.repeat(4097)}` } },
  ])('rejects malformed or ambiguous bearer state without contacting Auth: %j', async (request) => {
    const fetchImpl = vi.fn()
    const result = await verifySupabaseBearer(request, {
      env: { SUPABASE_URL: 'https://project.supabase.co', SUPABASE_ANON_KEY: 'anon-key' },
      fetchImpl,
    })
    expect(result.ok).toBe(false)
    expect(result.response.statusCode).toBe(401)
    expect(JSON.parse(result.response.body)).toEqual({ error: { code: 'unauthenticated' } })
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it.each([
    ['authorization', 'overview:read', (authorization) => createAdminAuthorizationHandler({ authorization }), event('/api/admin/v1/authorization')],
    ['overview', 'overview:read', (authorization, touched) => createAdminOverviewHandler({ authorization, sources: { learners: touched } }), event('/api/admin/v1/overview')],
    ['configuration', 'configuration:read', (authorization, touched) => createAdminConfigurationHandler({ authorization, source: { read: touched } }), event('/api/admin/v1/configuration')],
    ['audit', 'audit:read', (authorization, touched) => createAdminAuditHandler({ authorization, reader: { list: touched } }), event('/api/admin/v1/audit')],
    ['engine performance', 'engines:read', (authorization, touched) => createAdminEnginePerformanceHandler({ authorization, reader: { aggregate: touched }, now: () => '2026-08-10T12:00:00.000Z' }), event('/api/admin/v1/engine-performance', { queryStringParameters: { window: '30d' } })],
    ['health', 'health:read', (authorization, touched) => createAdminHealthHandler({ authorization, source: { list: touched } }), event('/api/admin/v1/health', { queryStringParameters: { window: '1h' } })],
    ['learners', 'learners:read', (authorization, touched) => createAdminLearnersHandler({ authorization, reader: { readSnapshot: touched } }), event('/api/admin/v1/learners')],
    ['access', 'overview:read', (authorization, touched) => createAdminAccessHandler({ authorization, source: { read: touched } }), event('/api/admin/v1/access')],
    ['production readiness', 'releases:read', (authorization, touched) => createAdminProductionReadinessHandler({ authorization, service: { check: touched } }), event('/api/admin/v1/production-readiness')],
    ['costs', 'costs:read', (authorization, touched) => createAdminCostsHandler({ authorization, projection: { read: touched } }), event('/api/admin/v1/costs', { queryStringParameters: { range: 'today' } })],
    ['safety operations', 'safety:read', (authorization, touched) => createAdminSafetyOperationsHandler({ authorization, reader: { read: touched } }), event('/api/admin/v1/safety-operations', { queryStringParameters: { limit: '50' } })],
    ['curriculum', 'curriculum:read', (authorization, touched) => createAdminCurriculumHandler({ authorization, source: { loadCatalog: touched } }), event('/api/admin/curriculum/catalog')],
  ])('requires the exact %s surface capability and never reads on denial', async (_name, capability, createHandler, request) => {
    const touched = vi.fn()
    const require = vi.fn(async () => ({
      ok: false,
      response: errorResponse(403, 'admin_access_denied'),
    }))
    const response = await createHandler({ require }, touched)(request)
    expect(require).toHaveBeenCalledWith(expect.anything(), capability)
    expect(response.statusCode).toBe(403)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'admin_access_denied' } })
    expect(touched).not.toHaveBeenCalled()
  })

  it.each(['viewer', 'admin'])('%s cannot invoke Owner configuration or access mutation through forged client claims', async (role) => {
    const authorization = databaseRoleAuthorization(role)
    const configurationSource = { preview: vi.fn() }
    const accessSource = { mutate: vi.fn() }
    const configuration = createAdminConfigurationHandler({
      authorization,
      source: configurationSource,
    })
    const access = createAdminAccessHandler({ authorization, source: accessSource })

    const configurationResponse = await configuration(jsonEvent(
      '/api/admin/v1/configuration/preview',
      {
        settingKey: 'runtime.ai.enabled', expectedRevision: '1', newValue: true,
        reasonCode: 'operator.request', role: 'owner',
        capabilities: ['configuration:manage'], principalRef: USER_ID,
      },
    ))
    const accessResponse = await access(jsonEvent('/api/admin/v1/access/change-role', {
      assignmentRef: ASSIGNMENT_ID, expectedRevision: '1', newRole: 'owner',
      reasonCode: 'operator.request', requestId: REQUEST_ID,
      role: 'owner', capabilities: ['admin_roles:manage'], principalRef: USER_ID,
    }))

    expect(configurationResponse.statusCode).toBe(403)
    expect(accessResponse.statusCode).toBe(403)
    expect(configurationSource.preview).not.toHaveBeenCalled()
    expect(accessSource.mutate).not.toHaveBeenCalled()
  })

  it('rejects unexpected DTO authority keys even after valid Owner authorization', async () => {
    const authorization = {
      require: vi.fn(async () => ({
        ok: true,
        accessToken: ACCESS_TOKEN,
        principal: { userId: USER_ID, role: 'owner' },
      })),
    }
    const configurationSource = { preview: vi.fn() }
    const accessSource = { mutate: vi.fn() }
    const configuration = createAdminConfigurationHandler({ authorization, source: configurationSource })
    const access = createAdminAccessHandler({ authorization, source: accessSource })

    const responses = await Promise.all([
      configuration(jsonEvent('/api/admin/v1/configuration/preview', {
        settingKey: 'runtime.ai.enabled', expectedRevision: '1', newValue: true,
        reasonCode: 'operator.request', capabilities: ['configuration:manage'],
      })),
      access(jsonEvent('/api/admin/v1/access/revoke', {
        assignmentRef: ASSIGNMENT_ID, expectedRevision: '1',
        reasonCode: 'operator.request', requestId: REQUEST_ID,
        principalRef: USER_ID,
      })),
    ])

    expect(responses.map((response) => response.statusCode)).toEqual([400, 400])
    expect(responses.map((response) => JSON.parse(response.body))).toEqual([
      { error: { code: 'invalid_request' } },
      { error: { code: 'invalid_request' } },
    ])
    expect(configurationSource.preview).not.toHaveBeenCalled()
    expect(accessSource.mutate).not.toHaveBeenCalled()
  })
})

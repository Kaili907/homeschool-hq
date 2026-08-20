import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  createAdminConfigurationHandler,
  parseConfigurationCommitRequest,
  parseConfigurationPreviewRequest,
} from './admin-configuration.js'
import { AdminConfigurationSourceError } from './_shared/admin-configuration-source.js'

const TOKEN = 'A'.repeat(43)
const REQUEST_ID = '10000000-0000-4000-8000-000000000101'
const CONFIGURATION_KEYS = Object.freeze([
  'runtime.ai.enabled',
  'runtime.tts.enabled',
  'quota.ai.requests_per_account_day',
  'quota.tts.requests_per_account_day',
  'cost.warning.monthly_micros',
  'cost.critical.monthly_micros',
  'ai.approved_tiers',
  'ai.default_tier',
])

function savedValue(key) {
  if (key.startsWith('runtime.')) return false
  if (key === 'quota.ai.requests_per_account_day') return 50
  if (key === 'quota.tts.requests_per_account_day') return 200
  if (key === 'cost.warning.monthly_micros') return '10000000'
  if (key === 'cost.critical.monthly_micros') return '25000000'
  if (key === 'ai.approved_tiers') return Object.freeze(['sonnet', 'haiku'])
  return 'sonnet'
}

function savedSetting(key) {
  const isRuntime = key.startsWith('runtime.')
  const isQuota = key.startsWith('quota.')
  const isCost = key.startsWith('cost.')
  const isApproved = key === 'ai.approved_tiers'
  return Object.freeze({
    key,
    value: savedValue(key),
    revision: '1',
    requiredCapability: 'configuration:manage',
    protectiveCapability: isRuntime ? 'engines:operate' : null,
    warningLevel: isRuntime || isApproved || key === 'cost.critical.monthly_micros'
      ? 'critical' : 'warning',
    bounds: isQuota
      ? Object.freeze({ minimum: '1', maximum: key.includes('.ai.') ? '200' : '1000' })
      : isCost ? Object.freeze({ minimum: '1', maximum: '1000000000000' }) : null,
    allowlist: key.startsWith('ai.') ? Object.freeze(['sonnet', 'haiku']) : null,
    deploymentCeilingType: isRuntime ? 'boolean_enablement'
      : isQuota ? 'integer_maximum'
        : isCost ? 'integer_micros_maximum'
          : isApproved ? 'allowlist_subset' : 'allowlist_member',
    registryVersion: 1,
    integrationStatus: 'pending_runtime_integration',
  })
}

const SETTINGS = Object.freeze(CONFIGURATION_KEYS.map(savedSetting))
const READ_RESULT = Object.freeze({
  schemaVersion: 2,
  integrationStatus: 'pending_runtime_integration',
  settings: SETTINGS,
})
function runtimeState(setting) {
  const isCost = setting.key.startsWith('cost.')
  const isTts = setting.key === 'runtime.tts.enabled'
    || setting.key === 'quota.tts.requests_per_account_day'
  return Object.freeze({
    classification: 'ENFORCEABLE_NOW',
    effectiveValue: setting.value,
    enforcement: 'enforced',
    resolution: 'saved',
    reason: 'saved_value_enforced',
    trustedConsumer: isCost ? 'cost_alert_evaluator' : isTts ? 'tts_gateway' : 'anthropic_gateway',
    studyStatus: isCost ? 'not_applicable' : 'unavailable',
  })
}
const RUNTIME = Object.freeze(Object.fromEntries(
  SETTINGS.map((setting) => [setting.key, runtimeState(setting)]),
))
const EFFECTIVE_READ_RESULT = Object.freeze({
  schemaVersion: 2,
  integrationStatus: 'pending_runtime_integration',
  runtimeStatus: 'runtime_enforced',
  settings: SETTINGS.map((setting) => Object.freeze({
    ...setting,
    runtime: RUNTIME[setting.key],
  })),
})
const PREVIEW_RESULT = Object.freeze({
  schemaVersion: 2,
  settingKey: 'runtime.ai.enabled',
  currentValue: false,
  newValue: true,
  expectedRevision: '1',
  warningLevel: 'critical',
  confirmationId: '20000000-0000-4000-8000-000000000101',
  confirmationExpiresAt: '2026-08-09T17:05:00.000Z',
  integrationStatus: 'pending_runtime_integration',
})
const COMMIT_RESULT = Object.freeze({
  schemaVersion: 2,
  settingKey: 'runtime.ai.enabled',
  value: true,
  revision: '2',
  idempotencyResult: 'created',
  integrationStatus: 'pending_runtime_integration',
})

function event(overrides = {}) {
  return {
    httpMethod: 'GET',
    path: '/api/admin/v1/configuration',
    headers: { authorization: 'Bearer verified-token' },
    queryStringParameters: null,
    ...overrides,
  }
}

function post(path, body) {
  return event({
    httpMethod: 'POST',
    path,
    headers: {
      authorization: 'Bearer verified-token',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function previewBody(overrides = {}) {
  return {
    settingKey: 'runtime.ai.enabled',
    expectedRevision: '1',
    newValue: true,
    reasonCode: 'operator.request',
    ...overrides,
  }
}

function commitBody(overrides = {}) {
  return {
    ...previewBody(),
    requestId: REQUEST_ID,
    confirmationToken: TOKEN,
    ...overrides,
  }
}

const AUTHORIZED = Object.freeze({
  ok: true,
  principal: { userId: 'owner', role: 'owner', capabilities: ['configuration:read', 'configuration:manage'] },
  accessToken: 'pinned-access-token',
})

function setup({ auth = AUTHORIZED, sourceError, resolverError } = {}) {
  const authorization = { require: vi.fn(async () => auth) }
  const source = {
    read: vi.fn(async () => {
      if (sourceError) throw sourceError
      return READ_RESULT
    }),
    preview: vi.fn(async () => {
      if (sourceError) throw sourceError
      return PREVIEW_RESULT
    }),
    commit: vi.fn(async () => {
      if (sourceError) throw sourceError
      return COMMIT_RESULT
    }),
  }
  const effectiveResolver = vi.fn(async (projection) => {
    if (resolverError) throw resolverError
    return { runtime: RUNTIME, projection }
  })
  const stepUpAssurance = {
    consume: vi.fn(async ({ binding }) => ({ ok: true, binding })),
  }
  return {
    handler: createAdminConfigurationHandler({
      authorization,
      source,
      tokenFactory: () => TOKEN,
      effectiveResolver,
      stepUpAssurance,
      requestSourceGuard: () => ({ ok: true }),
      criticalActionAudit: { record: vi.fn(async () => {}) },
    }),
    authorization,
    source,
    effectiveResolver,
    stepUpAssurance,
  }
}

describe('Admin configuration API', () => {
  it('requires configuration:read and returns only the trusted runtime-effective projection', async () => {
    const { handler, authorization, source, effectiveResolver, stepUpAssurance } = setup()
    const response = await handler(event())
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual(EFFECTIVE_READ_RESULT)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'configuration:read')
    expect(source.read).toHaveBeenCalledOnce()
    expect(effectiveResolver).toHaveBeenCalledOnce()
    expect(effectiveResolver).toHaveBeenCalledWith(READ_RESULT)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body).not.toMatch(/secret|token|actor|assignment/i)
    expect(stepUpAssurance.consume).not.toHaveBeenCalled()
  })

  it('fails closed when trusted effective resolution fails', async () => {
    const { handler } = setup({ resolverError: new Error('resolver SECRET') })
    const response = await handler(event())
    expect(response.statusCode).toBe(503)
    expect(response.body).toBe(JSON.stringify({
      error: { code: 'configuration_source_unavailable' },
    }))
    expect(response.body).not.toContain('SECRET')
  })

  it('requires configuration:manage for preview and returns the raw token only once from the API', async () => {
    const { handler, authorization, source, stepUpAssurance } = setup()
    const response = await handler(post('/api/admin/v1/configuration/preview', previewBody()))
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({ ...PREVIEW_RESULT, confirmationToken: TOKEN })
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'configuration:manage')
    expect(source.preview).toHaveBeenCalledWith(
      'pinned-access-token',
      previewBody(),
      createHash('sha256').update(TOKEN).digest('hex'),
    )
    expect(JSON.stringify(source.preview.mock.calls)).not.toContain(`"${TOKEN}"`)
    expect(stepUpAssurance.consume).not.toHaveBeenCalled()
  })

  it('commits with actor/request idempotency data and only a confirmation digest downstream', async () => {
    const { handler, source, stepUpAssurance } = setup()
    const response = await handler(post('/api/admin/v1/configuration/commit', commitBody()))
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual(COMMIT_RESULT)
    expect(source.commit).toHaveBeenCalledWith(
      'pinned-access-token',
      { ...previewBody(), requestId: REQUEST_ID },
      createHash('sha256').update(TOKEN).digest('hex'),
    )
    expect(response.body).not.toContain(TOKEN)
    expect(stepUpAssurance.consume).toHaveBeenCalledWith({
      event: expect.anything(),
      binding: {
        actorId: 'owner',
        action: 'admin.production.enable',
        resource: { type: 'admin-configuration', id: 'runtime.ai.enabled' },
      },
    })
  })

  it.each([
    ['Admin', 403, 'admin_access_denied'],
    ['Viewer', 403, 'admin_access_denied'],
    ['student', 403, 'admin_access_denied'],
    ['unauthenticated', 401, 'authentication_required'],
  ])('denies %s mutation before source access', async (_label, statusCode, code) => {
    const { handler, source } = setup({
      auth: { ok: false, response: { statusCode, body: JSON.stringify({ error: { code } }) } },
    })
    const response = await handler(post('/api/admin/v1/configuration/commit', commitBody()))
    expect(response.statusCode).toBe(statusCode)
    expect(source.commit).not.toHaveBeenCalled()
  })

  it.each([
    [previewBody({ settingKey: 'arbitrary.key' })],
    [previewBody({ expectedRevision: 1 })],
    [previewBody({ expectedRevision: '0' })],
    [previewBody({ newValue: 'true' })],
    [previewBody({ reasonCode: 'free text' })],
    [previewBody({ extra: 'field' })],
    [previewBody({ effectiveValue: true })],
    [previewBody({ enforcement: 'enforced' })],
    [previewBody({ enforced: true })],
    [previewBody({ runtimeStatus: 'runtime_enforced' })],
    [previewBody({ role: 'owner' })],
    [previewBody({ capabilities: ['configuration:manage'] })],
    [{ ...previewBody(), requestId: REQUEST_ID }],
  ])('rejects narrow preview request %j', async (body) => {
    const { handler, source } = setup()
    const response = await handler(post('/api/admin/v1/configuration/preview', body))
    expect(response.statusCode).toBe(400)
    expect(source.preview).not.toHaveBeenCalled()
  })

  it.each([
    [commitBody({ confirmationToken: 'raw token' })],
    [commitBody({ requestId: 'request-1' })],
    [commitBody({ newValue: { arbitrary: true } })],
    [commitBody({ settingKey: 'quota.ai.requests_per_account_day', newValue: 201 })],
    [commitBody({ settingKey: 'quota.tts.requests_per_account_day', newValue: 1001 })],
    [commitBody({ settingKey: 'cost.warning.monthly_micros', newValue: 1000 })],
    [commitBody({ settingKey: 'cost.warning.monthly_micros', newValue: '01' })],
    [commitBody({ settingKey: 'ai.approved_tiers', newValue: ['opus'] })],
    [commitBody({ effectiveValue: true })],
    [commitBody({ enforced: true })],
    [commitBody({ runtimeStatus: 'runtime_enforced' })],
    [commitBody({ role: 'owner' })],
    [commitBody({ capabilities: ['configuration:manage'] })],
  ])('rejects narrow commit request %j', async (body) => {
    const { handler, source } = setup()
    const response = await handler(post('/api/admin/v1/configuration/commit', body))
    expect(response.statusCode).toBe(400)
    expect(source.commit).not.toHaveBeenCalled()
  })

  it.each([
    ['revision_conflict', 409],
    ['idempotency_conflict', 409],
    ['confirmation_expired', 409],
    ['confirmation_reused', 409],
    ['cross_setting_invalid', 400],
    ['unknown_key', 400],
    ['source_unavailable', 503],
    ['source_timeout', 504],
  ])('maps %s without leaking source details', async (code, statusCode) => {
    const { handler } = setup({ sourceError: new AdminConfigurationSourceError(code) })
    const response = await handler(post('/api/admin/v1/configuration/commit', commitBody()))
    expect(response.statusCode).toBe(statusCode)
    expect(response.body).toBe(JSON.stringify({ error: {
      code: code === 'source_unavailable' ? 'configuration_source_unavailable'
        : code === 'source_timeout' ? 'configuration_source_timeout' : code,
    } }))
  })

  it('rejects queries, unsupported methods, and unknown paths', async () => {
    const { handler, source } = setup()
    expect((await handler(event({ rawQueryString: 'key=runtime.ai.enabled' }))).statusCode).toBe(400)
    expect((await handler(event({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(event({ path: '/api/admin/v1/configuration/unknown' }))).statusCode).toBe(404)
    expect(source.read).not.toHaveBeenCalled()
  })

  it('parses canonical IntegerMicros as strings without Number conversion', () => {
    const request = parseConfigurationPreviewRequest(post('/api/admin/v1/configuration/preview',
      previewBody({ settingKey: 'cost.warning.monthly_micros', newValue: '1000000000000' })))
    expect(request.newValue).toBe('1000000000000')
    expect(() => parseConfigurationCommitRequest(post('/api/admin/v1/configuration/commit',
      commitBody({ settingKey: 'cost.warning.monthly_micros', newValue: '1000000000001' }))))
      .toThrow()
  })
})

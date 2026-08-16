import { describe, expect, it, vi } from 'vitest'
import {
  createAdminProviderPricingTermsHandler,
  parseProviderPricingCommitRequest,
  parseProviderPricingPreviewRequest,
} from './admin-provider-pricing-terms.js'
import { AdminProviderPricingSourceError } from './_shared/admin-provider-pricing-source.js'

const TOKEN = 'A'.repeat(43)
const REQUEST_ID = '00000000-0000-4000-8000-000000000201'
const TERM_ID = '00000000-0000-4000-8000-000000000301'
const AUTHORIZED = {
  ok: true,
  accessToken: 'verified-access-token',
  principal: { userId: 'owner-user', role: 'owner' },
}

function event(overrides = {}) {
  return {
    httpMethod: 'GET',
    path: '/api/admin/v1/provider-pricing-terms',
    headers: { 'content-type': 'application/json' },
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    rawQueryString: '',
    ...overrides,
  }
}

function post(path, body) {
  return event({ httpMethod: 'POST', path, body: JSON.stringify(body) })
}

function term(overrides = {}) {
  return {
    provider: 'anthropic',
    providerProductId: 'claude-sonnet-4-6',
    providerModelId: 'claude-sonnet-4-6',
    logicalModelTier: 'sonnet',
    usageUnit: 'input_token',
    priceMicrosPerUnitSize: '2500',
    unitSize: '1000000',
    effectiveFrom: '2030-01-01T00:00:00.000Z',
    effectiveUntil: null,
    replacesTermId: null,
    verificationRef: 'invoice:verified-1',
    reasonCode: 'configuration.changed',
    ...overrides,
  }
}

function setup({ authorizationResult = AUTHORIZED, sourceError } = {}) {
  const authorization = { require: vi.fn(async () => authorizationResult) }
  const source = {
    read: vi.fn(async () => {
      if (sourceError) throw sourceError
      return { schemaVersion: 1, pricingStatus: 'pricing_unconfigured', currency: 'USD', terms: [] }
    }),
    preview: vi.fn(async () => {
      if (sourceError) throw sourceError
      return {
        schemaVersion: 1,
        operation: 'create',
        expectedRevision: '0',
        newRevision: '1',
        term: { ...term(), currency: 'USD' },
        confirmationId: '00000000-0000-4000-8000-000000000401',
        confirmationExpiresAt: '2030-01-01T00:05:00.000Z',
      }
    }),
    commit: vi.fn(async () => {
      if (sourceError) throw sourceError
      return {
        schemaVersion: 1,
        termId: TERM_ID,
        revision: '1',
        status: 'published',
        effectiveFrom: term().effectiveFrom,
        effectiveUntil: null,
        supersedesTermId: null,
        idempotencyResult: 'created',
      }
    }),
    end: vi.fn(async () => {
      if (sourceError) throw sourceError
      return {
        schemaVersion: 1,
        termId: TERM_ID,
        revision: '1',
        status: 'disabled',
        effectiveUntil: null,
        idempotencyResult: 'created',
      }
    }),
  }
  const stepUpAssurance = {
    consume: vi.fn(async ({ binding }) => ({ ok: true, binding })),
  }
  return {
    authorization,
    source,
    stepUpAssurance,
    handler: createAdminProviderPricingTermsHandler({
      authorization,
      source,
      tokenFactory: () => TOKEN,
      stepUpAssurance,
      requestSourceGuard: () => ({ ok: true }),
      criticalActionAudit: { record: vi.fn(async () => {}) },
    }),
  }
}

describe('Admin provider pricing terms API', () => {
  it('returns the zero-term safe state behind costs:read', async () => {
    const { handler, authorization, source, stepUpAssurance } = setup()
    const response = await handler(event())
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body)).toEqual({
      schemaVersion: 1,
      pricingStatus: 'pricing_unconfigured',
      currency: 'USD',
      terms: [],
    })
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'costs:read')
    expect(source.read).toHaveBeenCalledOnce()
    expect(stepUpAssurance.consume).not.toHaveBeenCalled()
  })

  it('requires configuration:manage for preview and returns the raw token only once', async () => {
    const { handler, authorization, source, stepUpAssurance } = setup()
    const response = await handler(post('/api/admin/v1/provider-pricing-terms/preview', term()))
    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.body).confirmationToken).toBe(TOKEN)
    expect(authorization.require).toHaveBeenCalledWith(expect.anything(), 'configuration:manage')
    expect(source.preview).toHaveBeenCalledWith(
      'verified-access-token',
      term(),
      expect.stringMatching(/^[0-9a-f]{64}$/),
    )
    expect(JSON.stringify(source.preview.mock.calls)).not.toContain(TOKEN)
    expect(stepUpAssurance.consume).not.toHaveBeenCalled()
  })

  it('commits only canonical decimal strings with request idempotency and a token digest', async () => {
    const { handler, source, stepUpAssurance } = setup()
    const body = {
      ...term(),
      expectedRevision: '0',
      requestId: REQUEST_ID,
      confirmationToken: TOKEN,
    }
    const response = await handler(post('/api/admin/v1/provider-pricing-terms/commit', body))
    expect(response.statusCode).toBe(200)
    expect(source.commit).toHaveBeenCalledWith(
      'verified-access-token',
      { ...term(), expectedRevision: '0', requestId: REQUEST_ID },
      expect.stringMatching(/^[0-9a-f]{64}$/),
    )
    expect(JSON.stringify(source.commit.mock.calls)).not.toContain(TOKEN)
    expect(stepUpAssurance.consume).toHaveBeenCalledWith({
      event: expect.anything(),
      binding: {
        actorId: 'owner-user',
        action: 'admin.provider-pricing.commit',
        resource: {
          type: 'provider-pricing-dimension',
          id: 'anthropic/claude-sonnet-4-6/claude-sonnet-4-6/sonnet/input_token/2030-01-01T00%3A00%3A00.000Z',
        },
      },
    })
  })

  it('supports a revision-bound future disable/end operation', async () => {
    const { handler, source, stepUpAssurance } = setup()
    const request = {
      termId: TERM_ID,
      expectedRevision: '1',
      mode: 'disable',
      effectiveUntil: null,
      reasonCode: 'operator.request',
      requestId: REQUEST_ID,
    }
    const response = await handler(post('/api/admin/v1/provider-pricing-terms/end', request))
    expect(response.statusCode).toBe(200)
    expect(source.end).toHaveBeenCalledWith('verified-access-token', request)
    expect(stepUpAssurance.consume).toHaveBeenCalledWith({
      event: expect.anything(),
      binding: {
        actorId: 'owner-user',
        action: 'admin.provider-pricing.end',
        resource: { type: 'provider-pricing-term', id: TERM_ID },
      },
    })
  })

  it.each([
    term({ priceMicrosPerUnitSize: 0.5 }),
    term({ priceMicrosPerUnitSize: '1.5' }),
    term({ priceMicrosPerUnitSize: '01' }),
    term({ unitSize: 1000000 }),
    term({ effectiveUntil: '2029-01-01T00:00:00.000Z' }),
    term({ verificationRef: 'https://provider.example/terms' }),
  ])('rejects malformed or float pricing input %#', async (body) => {
    const { handler, source } = setup()
    const response = await handler(post('/api/admin/v1/provider-pricing-terms/preview', body))
    expect(response.statusCode).toBe(400)
    expect(source.preview).not.toHaveBeenCalled()
  })

  it.each([
    term({ usageUnit: 'cached_input_write_token' }),
    term({ usageUnit: 'tts_character' }),
    term({ provider: 'elevenlabs', logicalModelTier: 'sonnet', usageUnit: 'tts_character' }),
  ])('rejects unsupported accounting dimensions %#', async (body) => {
    const { handler, source } = setup()
    const response = await handler(post('/api/admin/v1/provider-pricing-terms/preview', body))
    expect(response.statusCode).toBe(400)
    expect(JSON.parse(response.body)).toEqual({ error: { code: 'unsupported_dimension' } })
    expect(source.preview).not.toHaveBeenCalled()
  })

  it.each([
    [{ ok: false, response: { statusCode: 401, body: 'unauthorized' } }, 401],
    [{ ok: false, response: { statusCode: 403, body: 'forbidden' } }, 403],
  ])('denies unauthorized mutation before source access', async (authorizationResult, status) => {
    const { handler, source } = setup({ authorizationResult })
    const response = await handler(post('/api/admin/v1/provider-pricing-terms/preview', term()))
    expect(response.statusCode).toBe(status)
    expect(source.preview).not.toHaveBeenCalled()
  })

  it.each([
    ['overlap', 409],
    ['revision_conflict', 409],
    ['disable_unsafe', 409],
    ['unsupported_dimension', 400],
    ['source_timeout', 504],
    ['source_unavailable', 503],
  ])('maps %s without leaking database details', async (code, status) => {
    const { handler } = setup({ sourceError: new AdminProviderPricingSourceError(code) })
    const response = await handler(post('/api/admin/v1/provider-pricing-terms/preview', term()))
    expect(response.statusCode).toBe(status)
    expect(response.body).not.toContain('Postgres')
  })

  it('rejects queries, unsupported methods, and unknown paths', async () => {
    const { handler, source } = setup()
    expect((await handler(event({ rawQueryString: 'all=true' }))).statusCode).toBe(400)
    expect((await handler(event({ httpMethod: 'POST' }))).statusCode).toBe(405)
    expect((await handler(event({ path: '/api/admin/v1/provider-pricing-terms/export' }))).statusCode)
      .toBe(404)
    expect(source.read).not.toHaveBeenCalled()
  })

  it('parses IntegerMicros without converting through Number', () => {
    const parsed = parseProviderPricingPreviewRequest(post(
      '/api/admin/v1/provider-pricing-terms/preview',
      term({ priceMicrosPerUnitSize: '1000000000' }),
    ))
    expect(parsed.priceMicrosPerUnitSize).toBe('1000000000')
    expect(() => parseProviderPricingCommitRequest(post(
      '/api/admin/v1/provider-pricing-terms/commit',
      { ...term(), expectedRevision: 0, requestId: REQUEST_ID, confirmationToken: TOKEN },
    ))).toThrow()
  })
})

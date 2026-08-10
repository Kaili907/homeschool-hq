import { describe, expect, it, vi } from 'vitest'
import {
  AdminProviderPricingHttpError,
  commitAdminProviderPricing,
  endAdminProviderPricing,
  previewAdminProviderPricing,
  readAdminProviderPricing,
} from './providerPricingHttpSource'
import type { ProviderPricingTermRequest } from './providerPricingModel'

const TERM_ID = '00000000-0000-4000-8000-000000000301'
const REQUEST_ID = '00000000-0000-4000-8000-000000000201'
const TOKEN = 'A'.repeat(43)

interface TestResponse {
  readonly status: number
  json(): Promise<unknown>
}

type TestFetch = (input: string, init: RequestInit) => Promise<TestResponse>

function response(status: number, value: unknown): TestResponse {
  return { status, json: vi.fn(async () => value) }
}

function request(): ProviderPricingTermRequest {
  return {
    provider: 'anthropic',
    providerProductId: 'provider-product',
    providerModelId: 'provider-model',
    logicalModelTier: 'sonnet',
    usageUnit: 'input_token',
    priceMicrosPerUnitSize: '2500',
    unitSize: '1000000',
    effectiveFrom: '2026-09-01T00:00:00.000Z',
    effectiveUntil: null,
    replacesTermId: null,
    verificationRef: 'verified-reference',
    reasonCode: 'configuration.changed',
  }
}

function term() {
  return {
    termId: TERM_ID,
    provider: 'anthropic',
    providerProductId: 'provider-product',
    providerModelId: 'provider-model',
    logicalModelTier: 'sonnet',
    usageUnit: 'input_token',
    priceMicrosPerUnitSize: '2500',
    unitSize: '1000000',
    currency: 'USD',
    effectiveFrom: '2026-08-01T00:00:00.000Z',
    effectiveUntil: null,
    revision: '1',
    status: 'published',
    supersedesTermId: null,
    verificationRef: 'verified-reference',
    createdAt: '2026-07-31T00:00:00.000Z',
    createdAuthority: { role: 'owner' },
  }
}

const options = (fetchImpl: TestFetch) => ({
  fetchImpl,
  getAccessToken: async () => 'verified-access-token',
})

describe('provider pricing HTTP source', () => {
  it('reads the costs projection with a bearer and no browser capability assertions', async () => {
    const fetchImpl = vi.fn<TestFetch>(async () => response(200, {
      schemaVersion: 1,
      pricingStatus: 'configured',
      currency: 'USD',
      terms: [term()],
    }))
    await expect(readAdminProviderPricing(options(fetchImpl))).resolves.toMatchObject({
      pricingStatus: 'configured', terms: [{ priceMicrosPerUnitSize: '2500' }],
    })
    expect(fetchImpl).toHaveBeenCalledWith('/api/admin/v1/provider-pricing-terms', {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer verified-access-token' },
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: expect.any(AbortSignal),
    })
    expect(JSON.stringify(fetchImpl.mock.calls)).not.toMatch(/role|capabilit|actor|service/i)
  })

  it('previews exact string money through the server confirmation endpoint', async () => {
    const previewProjection = {
      schemaVersion: 1,
      operation: 'create',
      expectedRevision: '0',
      newRevision: '1',
      term: {
        provider: 'anthropic', providerProductId: 'provider-product', providerModelId: 'provider-model',
        logicalModelTier: 'sonnet', usageUnit: 'input_token', priceMicrosPerUnitSize: '2500',
        unitSize: '1000000', currency: 'USD', effectiveFrom: '2026-09-01T00:00:00.000Z',
        effectiveUntil: null, replacesTermId: null,
      },
      confirmationId: '00000000-0000-4000-8000-000000000401',
      confirmationExpiresAt: '2026-08-10T00:05:00.000Z',
      confirmationToken: TOKEN,
    }
    const fetchImpl = vi.fn<TestFetch>(async () => response(200, previewProjection))

    await expect(previewAdminProviderPricing(request(), options(fetchImpl))).resolves.toMatchObject({
      operation: 'create', confirmationToken: TOKEN,
    })
    const [path, init] = fetchImpl.mock.calls[0]
    expect(path).toBe('/api/admin/v1/provider-pricing-terms/preview')
    expect(JSON.parse(String(init.body))).toEqual(request())
    expect(JSON.parse(String(init.body)).priceMicrosPerUnitSize).toBe('2500')
    expect(JSON.stringify(init)).not.toMatch(/role|capabilit|actor/i)
  })

  it('commits a preview with idempotency and ends a term through the dedicated endpoint', async () => {
    const commitFetch = vi.fn<TestFetch>(async () => response(200, {
      schemaVersion: 1,
      termId: TERM_ID,
      revision: '1',
      status: 'published',
      effectiveFrom: request().effectiveFrom,
      effectiveUntil: null,
      supersedesTermId: null,
      idempotencyResult: 'created',
    }))
    await expect(commitAdminProviderPricing({
      ...request(), expectedRevision: '0', requestId: REQUEST_ID, confirmationToken: TOKEN,
    }, options(commitFetch))).resolves.toMatchObject({ status: 'published', revision: '1' })
    expect(commitFetch.mock.calls[0][0]).toBe('/api/admin/v1/provider-pricing-terms/commit')
    expect(JSON.parse(String(commitFetch.mock.calls[0][1].body))).toMatchObject({
      expectedRevision: '0', requestId: REQUEST_ID, confirmationToken: TOKEN,
    })

    const endFetch = vi.fn<TestFetch>(async () => response(200, {
      schemaVersion: 1,
      termId: TERM_ID,
      revision: '1',
      status: 'ended',
      effectiveUntil: '2026-09-15T00:00:00.000Z',
      idempotencyResult: 'created',
    }))
    const endRequest = {
      termId: TERM_ID,
      expectedRevision: '1',
      mode: 'end' as const,
      effectiveUntil: '2026-09-15T00:00:00.000Z',
      reasonCode: 'scheduled.change' as const,
      requestId: REQUEST_ID,
    }
    await expect(endAdminProviderPricing(endRequest, options(endFetch))).resolves.toMatchObject({ status: 'ended' })
    expect(endFetch.mock.calls[0][0]).toBe('/api/admin/v1/provider-pricing-terms/end')
    expect(JSON.parse(String(endFetch.mock.calls[0][1].body))).toEqual(endRequest)
  })

  it('fails closed for missing permission, conflict, malformed responses, and source failure', async () => {
    const deniedFetch = vi.fn<TestFetch>(async () => response(403, { error: { code: 'admin_access_denied' } }))
    await expect(readAdminProviderPricing(options(deniedFetch))).rejects.toMatchObject({ code: 'read_denied' })
    await expect(previewAdminProviderPricing(request(), options(deniedFetch))).rejects.toMatchObject({ code: 'manage_denied' })

    const conflictFetch = vi.fn<TestFetch>(async () => response(409, { error: { code: 'revision_conflict' } }))
    await expect(commitAdminProviderPricing({
      ...request(), expectedRevision: '0', requestId: REQUEST_ID, confirmationToken: TOKEN,
    }, options(conflictFetch))).rejects.toMatchObject({ code: 'revision_conflict' })

    const malformedFetch = vi.fn<TestFetch>(async () => response(200, { schemaVersion: 1, pricingStatus: 'configured', currency: 'USD', terms: [] }))
    await expect(readAdminProviderPricing(options(malformedFetch))).rejects.toMatchObject({ code: 'source_unavailable' })

    await expect(readAdminProviderPricing({
      getAccessToken: async () => { throw new Error('private auth failure') },
      fetchImpl: vi.fn<TestFetch>(),
    })).rejects.toEqual(new AdminProviderPricingHttpError('source_unavailable'))
  })
})

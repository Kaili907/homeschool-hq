import { describe, expect, it, vi } from 'vitest'
import {
  AdminProviderPricingSourceError,
  createAdminProviderPricingSource,
} from './admin-provider-pricing-source.js'

const TERM_ID = '00000000-0000-4000-8000-000000000301'
const REQUEST_ID = '00000000-0000-4000-8000-000000000201'

function clientWith(data, error = null) {
  const abortSignal = vi.fn(async () => ({ data, error }))
  return { client: { rpc: vi.fn(() => ({ abortSignal })) }, abortSignal }
}

function request(overrides = {}) {
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

describe('Admin provider pricing source', () => {
  it('reads only the service projection with costs:read and preserves the zero-term state', async () => {
    const { client } = clientWith({
      schemaVersion: 1,
      pricingStatus: 'pricing_unconfigured',
      currency: 'USD',
      terms: [],
    })
    const source = createAdminProviderPricingSource({ serviceClient: client })
    await expect(source.read()).resolves.toEqual({
      schemaVersion: 1,
      pricingStatus: 'pricing_unconfigured',
      currency: 'USD',
      terms: [],
    })
    expect(client.rpc).toHaveBeenCalledWith('academy_admin_read_provider_pricing_terms_v1', {
      p_required_capability: 'costs:read',
    })
  })

  it('uses the pinned actor bearer for preview and exact string money parameters', async () => {
    const projection = {
      schemaVersion: 1,
      operation: 'create',
      expectedRevision: '0',
      newRevision: '1',
      term: {
        provider: 'anthropic',
        providerProductId: 'claude-sonnet-4-6',
        providerModelId: 'claude-sonnet-4-6',
        logicalModelTier: 'sonnet',
        usageUnit: 'input_token',
        priceMicrosPerUnitSize: '2500',
        unitSize: '1000000',
        currency: 'USD',
        effectiveFrom: '2030-01-01T00:00:00.000Z',
        effectiveUntil: null,
        replacesTermId: null,
      },
      confirmationId: '00000000-0000-4000-8000-000000000401',
      confirmationExpiresAt: '2030-01-01T00:05:00.000Z',
    }
    const { client } = clientWith(projection)
    const factory = vi.fn(() => client)
    const source = createAdminProviderPricingSource({ mutationClientFactory: factory })
    await expect(source.preview('actor-token', request(), 'a'.repeat(64))).resolves.toMatchObject({
      expectedRevision: '0',
      term: { priceMicrosPerUnitSize: '2500', unitSize: '1000000' },
    })
    expect(factory).toHaveBeenCalledWith('actor-token')
    expect(client.rpc).toHaveBeenCalledWith(
      'academy_admin_preview_provider_pricing_term_v1',
      expect.objectContaining({
        p_price_micros: '2500',
        p_unit_quantity: '1000000',
        p_required_capability: 'configuration:manage',
      }),
    )
  })

  it('commits with revision, request, and confirmation digest but no raw token', async () => {
    const { client } = clientWith({
      schemaVersion: 1,
      termId: TERM_ID,
      revision: '1',
      status: 'published',
      effectiveFrom: '2030-01-01T00:00:00.000Z',
      effectiveUntil: null,
      supersedesTermId: null,
      idempotencyResult: 'created',
    })
    const source = createAdminProviderPricingSource({ mutationClientFactory: () => client })
    await source.commit('actor-token', request({
      expectedRevision: '0',
      requestId: REQUEST_ID,
    }), 'b'.repeat(64))
    expect(client.rpc).toHaveBeenCalledWith(
      'academy_admin_commit_provider_pricing_term_v1',
      expect.objectContaining({
        p_expected_revision: '0',
        p_request_id: REQUEST_ID,
        p_confirmation_digest: 'b'.repeat(64),
        p_required_capability: 'configuration:manage',
      }),
    )
  })

  it('invokes only the narrow end RPC for an end/disable operation', async () => {
    const { client } = clientWith({
      schemaVersion: 1,
      termId: TERM_ID,
      revision: '1',
      status: 'disabled',
      effectiveUntil: null,
      idempotencyResult: 'created',
    })
    const source = createAdminProviderPricingSource({ mutationClientFactory: () => client })
    await source.end('actor-token', {
      termId: TERM_ID,
      expectedRevision: '1',
      mode: 'disable',
      effectiveUntil: null,
      reasonCode: 'operator.request',
      requestId: REQUEST_ID,
    })
    expect(client.rpc).toHaveBeenCalledWith(
      'academy_admin_end_provider_pricing_term_v1',
      expect.objectContaining({ p_mode: 'disable', p_required_capability: 'configuration:manage' }),
    )
  })

  it('fails closed on malformed projections and maps database markers', async () => {
    const malformed = clientWith({
      schemaVersion: 1,
      pricingStatus: 'configured',
      currency: 'USD',
      terms: [{ priceMicrosPerUnitSize: 2.5 }],
    }).client
    await expect(createAdminProviderPricingSource({ serviceClient: malformed }).read())
      .rejects.toEqual(expect.objectContaining({ code: 'source_unavailable' }))

    const overlap = clientWith(null, { message: 'PROVIDER_PRICING_OVERLAP' }).client
    await expect(createAdminProviderPricingSource({ mutationClientFactory: () => overlap })
      .preview('actor-token', request(), 'a'.repeat(64)))
      .rejects.toEqual(expect.objectContaining({ code: 'overlap' }))
  })

  it('rejects unavailable configuration without exposing credentials', async () => {
    await expect(createAdminProviderPricingSource({ env: {} }).read())
      .rejects.toEqual(expect.any(AdminProviderPricingSourceError))
  })
})

import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROVIDER_PRICING_DRAFT,
  exactUsdToIntegerMicros,
  formatExactUsdMicros,
  parseProviderPricingModel,
  parseProviderPricingMutationResult,
  parseProviderPricingPreview,
  providerPricingTiming,
  validateProviderPricingDraft,
  type ProviderPricingDraft,
  type ProviderPricingTerm,
} from './providerPricingModel'

const TERM_ID = '00000000-0000-4000-8000-000000000301'
const REPLACEMENT_ID = '00000000-0000-4000-8000-000000000302'

function term(overrides: Partial<ProviderPricingTerm> = {}): ProviderPricingTerm {
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
    ...overrides,
  }
}

function model(terms: readonly ProviderPricingTerm[]) {
  return {
    schemaVersion: 1,
    pricingStatus: terms.length ? 'configured' : 'pricing_unconfigured',
    currency: 'USD',
    terms,
  }
}

function draft(overrides: Partial<ProviderPricingDraft> = {}): ProviderPricingDraft {
  return {
    ...EMPTY_PROVIDER_PRICING_DRAFT,
    provider: 'anthropic',
    providerProductId: 'provider-product',
    providerModelId: 'provider-model',
    logicalModelTier: 'sonnet',
    usageUnit: 'input_token',
    exactUsd: '0.002500',
    unitSize: '1000000',
    effectiveFrom: '2026-09-01T00:00',
    effectiveUntil: '',
    verificationRef: 'verified-reference',
    reasonCode: 'configuration.changed',
    ...overrides,
  }
}

describe('provider pricing model', () => {
  it('preserves the explicit zero-term state without manufacturing a price', () => {
    expect(parseProviderPricingModel(model([]))).toEqual(model([]))
    expect(parseProviderPricingModel({ ...model([]), pricingStatus: 'configured' })).toBeNull()
    expect(JSON.stringify(parseProviderPricingModel(model([])))).not.toContain('priceMicrosPerUnitSize')
  })

  it('parses configured current, future, historical, and disabled terms exactly', () => {
    const terms = [
      term(),
      term({ termId: REPLACEMENT_ID, effectiveFrom: '2026-09-01T00:00:00.000Z', revision: '2' }),
      term({ termId: '00000000-0000-4000-8000-000000000303', effectiveFrom: '2026-01-01T00:00:00.000Z', effectiveUntil: '2026-02-01T00:00:00.000Z', status: 'ended' }),
      term({ termId: '00000000-0000-4000-8000-000000000304', effectiveFrom: '2026-10-01T00:00:00.000Z', status: 'disabled' }),
    ]
    const parsed = parseProviderPricingModel(model(terms))
    expect(parsed?.terms).toHaveLength(4)
    expect(providerPricingTiming(parsed!.terms[0], '2026-08-10T00:00:00.000Z')).toBe('current')
    expect(providerPricingTiming(parsed!.terms[1], '2026-08-10T00:00:00.000Z')).toBe('scheduled')
    expect(providerPricingTiming(parsed!.terms[2], '2026-08-10T00:00:00.000Z')).toBe('historical')
    expect(providerPricingTiming(parsed!.terms[3], '2026-08-10T00:00:00.000Z')).toBe('disabled')
  })

  it('rejects number money, malformed terms, and unsupported Anthropic cache-write dimensions', () => {
    expect(parseProviderPricingModel(model([{ ...term(), priceMicrosPerUnitSize: 2.5 as never }]))).toBeNull()
    expect(parseProviderPricingModel(model([{ ...term(), revision: 1 as never }]))).toBeNull()
    expect(parseProviderPricingModel(model([{ ...term(), usageUnit: 'cached_input_write_token' as never }]))).toBeNull()
    expect(parseProviderPricingModel(model([{ ...term(), verificationRef: 'secret-token' }]))).toBeNull()
  })

  it('converts human-readable USD to canonical micros with string and BigInt arithmetic only', () => {
    expect(exactUsdToIntegerMicros('0')).toEqual({ ok: true, micros: '0' })
    expect(exactUsdToIntegerMicros('0.000001')).toEqual({ ok: true, micros: '1' })
    expect(exactUsdToIntegerMicros('0.002500')).toEqual({ ok: true, micros: '2500' })
    expect(exactUsdToIntegerMicros('1000.000000')).toEqual({ ok: true, micros: '1000000000' })
    expect(formatExactUsdMicros('2500')).toBe('$0.002500')
    expect(formatExactUsdMicros('1000000000')).toBe('$1,000.000000')
  })

  it('returns exact money validation errors instead of rounding or accepting floats', () => {
    expect(exactUsdToIntegerMicros('0.0000001')).toEqual({
      ok: false,
      message: 'USD pricing supports at most six decimal places (one microdollar).',
    })
    expect(exactUsdToIntegerMicros('$1.00')).toEqual({
      ok: false,
      message: 'Use plain USD digits without spaces, currency symbols, or commas.',
    })
    expect(exactUsdToIntegerMicros('1000.000001')).toEqual({
      ok: false,
      message: 'The exact price must not exceed $1,000.000000 USD.',
    })
    expect(exactUsdToIntegerMicros('01.00').ok).toBe(false)
  })

  it('builds only canonical preview requests and reports every invalid field', () => {
    expect(validateProviderPricingDraft(draft())).toEqual({
      ok: true,
      request: {
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
      },
    })
    const invalid = validateProviderPricingDraft(draft({
      usageUnit: 'cached_input_write_token' as never,
      exactUsd: '0.0000001',
      unitSize: '1.5',
      effectiveUntil: '2026-08-01T00:00',
      verificationRef: 'https://provider.example',
      reasonCode: '',
    }))
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.errors).toMatchObject({
      usageUnit: expect.stringContaining('supported'),
      exactUsd: expect.stringContaining('six decimal'),
      unitSize: expect.stringContaining('whole unit'),
      effectiveUntil: expect.stringContaining('later'),
      verificationRef: expect.stringContaining('without a URL'),
      reasonCode: expect.stringContaining('Choose a reason'),
    })
  })

  it('accepts strict preview and mutation projections while rejecting extra or unsafe fields', () => {
    const preview = {
      schemaVersion: 1,
      operation: 'replace',
      expectedRevision: '1',
      newRevision: '2',
      term: {
        provider: 'anthropic', providerProductId: 'provider-product', providerModelId: 'provider-model',
        logicalModelTier: 'sonnet', usageUnit: 'input_token', priceMicrosPerUnitSize: '3000',
        unitSize: '1000000', currency: 'USD', effectiveFrom: '2026-09-01T00:00:00.000Z',
        effectiveUntil: null, replacesTermId: TERM_ID,
      },
      confirmationId: '00000000-0000-4000-8000-000000000401',
      confirmationExpiresAt: '2026-08-10T00:05:00.000Z',
      confirmationToken: 'A'.repeat(43),
    }
    expect(parseProviderPricingPreview(preview)).toEqual(preview)
    expect(parseProviderPricingPreview({ ...preview, clientAudit: true })).toBeNull()
    expect(parseProviderPricingMutationResult({
      schemaVersion: 1,
      termId: REPLACEMENT_ID,
      revision: '2',
      status: 'published',
      effectiveFrom: '2026-09-01T00:00:00.000Z',
      effectiveUntil: null,
      supersedesTermId: TERM_ID,
      idempotencyResult: 'created',
    })).not.toBeNull()
  })
})

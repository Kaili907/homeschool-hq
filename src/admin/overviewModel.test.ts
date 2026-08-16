import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_BILLING_DISPOSITIONS,
  ADMIN_CONTRACT_VERSION,
  ADMIN_COST_KINDS,
  ADMIN_CURRENCIES,
  ADMIN_ENGINE_IDS,
  ADMIN_HEALTH_STATES,
  ADMIN_READ_CAPABILITIES,
} from './admin0Vocabulary'
import {
  adaptAdminOverview,
  adaptCost,
  adaptCurriculumVersion,
  adaptSafetyMetric,
  adaptSystemMetric,
  adaptUsageMetric,
  formatUsdMicros,
  safeCompletenessMessage,
  safeCostReasonMessage,
  safeEngineReasonMessage,
  safeOverviewErrorMessage,
  type AdminOverviewSource,
  type CostSource,
} from './overviewAdapter'
import { hasOverviewReadCapability, movePresetSelection, validateCustomRange, type EngineObservation } from './overviewModel'

describe('ADMIN-0-R1 v2 vocabulary projection', () => {
  it('pins contract version 2 and faithfully mirrors overview vocabulary', () => {
    expect(ADMIN_CONTRACT_VERSION).toBe(2)
    expect(ADMIN_ENGINE_IDS).toEqual([
      'tutor', 'study', 'assessment', 'curriculum', 'jarvis', 'tts', 'gateway', 'sync',
    ])
    expect(ADMIN_HEALTH_STATES).toEqual(['healthy', 'degraded', 'unavailable', 'disabled', 'unknown'])
    expect(ADMIN_COST_KINDS).toEqual(['calculated', 'reconciled', 'unavailable'])
    expect(ADMIN_BILLING_DISPOSITIONS).toEqual(['billable', 'not_billable', 'unknown'])
    expect(ADMIN_CURRENCIES).toEqual(['USD'])
    expect(ADMIN_READ_CAPABILITIES).toContain('overview:read')
  })
})

describe('IntegerMicros and v2 billing presentation', () => {
  it('formats explicit USD beyond Number safe precision with exact BigInt arithmetic', () => {
    expect(formatUsdMicros('9007199254740993000000', 'USD')).toBe('$9,007,199,254,740,993.00')
    expect(formatUsdMicros('1840000', 'USD')).toBe('$1.84')
    expect(formatUsdMicros('5000', 'USD')).toBe('$0.01')
    expect(formatUsdMicros('4999', 'USD')).toBe('$0.00')
  })

  it('rejects non-canonical money and has no floating USD or raw identity transport', () => {
    expect(() => formatUsdMicros('1.5', 'USD')).toThrow(/IntegerMicros/)
    const modelSource = readFileSync(join(process.cwd(), 'src/admin/overviewModel.ts'), 'utf8')
    const adapterSource = readFileSync(join(process.cwd(), 'src/admin/overviewAdapter.ts'), 'utf8')
    expect(modelSource).not.toContain('amountUsd')
    expect(adapterSource).not.toContain('amountUsd')
    expect(adapterSource).not.toMatch(/\baccountRef\b|\bhouseholdRef\b|providerModelId|priceMicrosPerUnitSize/)
  })

  it('preserves billing disposition independently from cost kind and calculated zero', () => {
    const billableZero = adaptCost(costSource({ costMicros: '0', billingDisposition: 'billable' }))
    const nonBillableZero = adaptCost(costSource({ costMicros: '0', billingDisposition: 'not_billable' }))
    expect(billableZero).toMatchObject({ status: 'available', costKind: 'calculated', billingDisposition: 'billable', costMicros: '0', currency: 'USD' })
    expect(nonBillableZero).toMatchObject({ status: 'available', costKind: 'calculated', billingDisposition: 'not_billable', costMicros: '0', currency: 'USD' })
    expect(billableZero).not.toEqual(nonBillableZero)
  })

  it('keeps unavailable cost null and marks inconsistent accounting unknown', () => {
    expect(adaptCost(costSource({ costMicros: null, costKind: 'unavailable', billingDisposition: 'unknown', resultReasonCode: 'missing_provider_usage' }))).toMatchObject({
      status: 'unavailable', costKind: 'unavailable', billingDisposition: 'unknown', resultReasonCode: 'missing_provider_usage',
    })
    expect(adaptCost(costSource({ costMicros: null, costKind: 'calculated' }))).toMatchObject({ status: 'unknown' })
    expect(adaptCost(costSource({ costMicros: '1', billingDisposition: 'not_billable' }))).toMatchObject({ status: 'unknown' })
  })
})

describe('field-aware v2 adaptation', () => {
  it('keeps cached reads and writes separate, exact, and non-negative', () => {
    const model = adaptAdminOverview(minimalSource())
    expect(model.contractVersion).toBe(2)
    expect(model.academy.release?.counts).toEqual({
      grades: 9, courses: 90, units: 698, lessons: 8_292, assessments: 699,
    })
    expect(model.ai.cachedInputReadTokens).toEqual({ status: 'available', value: 7 })
    expect(model.ai.cachedInputWriteTokens).toEqual({ status: 'available', value: 3 })
    expect(adaptUsageMetric(-1)).toEqual({ status: 'unknown' })
    expect(adaptUsageMetric(Number.MAX_SAFE_INTEGER + 1)).toEqual({ status: 'unknown' })
  })

  it('distinguishes trusted, not-applicable, and unknown curriculum versions', () => {
    expect(adaptCurriculumVersion({ applicability: 'trusted', version: '1.0.0' })).toEqual({ status: 'available', value: '1.0.0' })
    expect(adaptCurriculumVersion({ applicability: 'not_applicable' })).toEqual({ status: 'not_applicable' })
    expect(adaptCurriculumVersion({ applicability: 'unknown' })).toEqual({ status: 'unknown' })
  })

  it('preserves nullable engine-version applicability and required app version', () => {
    const source = minimalSource()
    source.engines.push({
      engineId: 'gateway', health: 'healthy', appVersion: 'build-1', engineVersion: null,
      observedAt: source.observedAt, windowStart: source.observedAt, windowEnd: source.observedAt, reasonCodes: [],
    })
    const model = adaptAdminOverview(source)
    expect(model.engines[0].engineVersion).toBeNull()
    expect(model.academy.appVersion).toEqual({ status: 'available', value: 'build-1' })
  })

  it('preserves zero while distinguishing incomplete, unavailable, and unknown evidence', () => {
    expect(adaptSafetyMetric({ evidence: 'complete', value: 0 })).toEqual({ status: 'available', value: 0 })
    expect(adaptSafetyMetric({ evidence: 'incomplete' })).toEqual({ status: 'unknown' })
    expect(adaptSafetyMetric({ evidence: 'unavailable' })).toEqual({ status: 'unavailable' })
    expect(adaptSystemMetric(null)).toEqual({ status: 'unknown' })
  })

  it('keeps observation time separate from successful refresh time', () => {
    const model = adaptAdminOverview(minimalSource())
    expect(model.observedAt).toBe('2026-08-08T14:00:00.000Z')
    expect(model.academy.lastSuccessfulDataRefresh).toEqual({ status: 'available', value: '2026-08-08T13:55:00.000Z' })
  })
})

describe('authorization and bounded presentation messages', () => {
  it('requires the canonical overview-read capability', () => {
    expect(hasOverviewReadCapability({ status: 'authorized', role: 'viewer', capabilities: ['overview:read'] })).toBe(true)
    expect(hasOverviewReadCapability({ status: 'authorized', role: 'owner', capabilities: ['engines:operate'] })).toBe(false)
  })

  it('maps cost/completeness codes and never echoes arbitrary backend text', () => {
    expect(safeCostReasonMessage('missing_provider_usage')).toBe('Trustworthy provider usage was unavailable.')
    expect(safeCostReasonMessage('raw provider error: secret')).toBe('Additional cost detail is unavailable.')
    expect(safeCompletenessMessage('partial_attribution_ambiguous')).toMatch(/attribution was ambiguous/i)
    expect(safeEngineReasonMessage('raw learner transcript: secret')).toBe('Additional operational detail is unavailable.')
    expect(safeOverviewErrorMessage('raw stack trace' as 'overview_unavailable')).toBe('Operational data is temporarily unavailable.')
  })
})

describe('overview range behavior', () => {
  it('validates custom ranges and supports keyboard movement', () => {
    expect(validateCustomRange('', '')).toMatch(/both/i)
    expect(validateCustomRange('2026-02-30', '2026-03-01')).toMatch(/valid/i)
    expect(validateCustomRange('2026-08-10', '2026-08-09')).toMatch(/on or before/i)
    expect(validateCustomRange('2026-08-08', '2026-08-09')).toBeNull()
    expect(movePresetSelection('today', 'ArrowLeft')).toBe('school-year')
    expect(movePresetSelection('today', 'ArrowRight')).toBe('7-days')
  })
})

function costSource(overrides: Partial<CostSource> = {}): CostSource {
  return {
    costMicros: '0', costKind: 'calculated', billingDisposition: 'billable', currency: 'USD',
    completeness: 'complete', result: 'success', resultReasonCode: null, ...overrides,
  }
}

function minimalSource(): AdminOverviewSource & { engines: EngineObservation[] } {
  return {
    contractVersion: 2, range: { kind: 'preset', preset: 'today' },
    observedAt: '2026-08-08T14:00:00.000Z', freshness: 'current',
    academy: {
      environment: 'production', appVersion: 'build-1',
      curriculumVersion: { applicability: 'trusted', version: '1.0.0' },
      overallHealth: 'healthy', lastSuccessfulDataRefresh: '2026-08-08T13:55:00.000Z',
    },
    learners: { activeLearners: 0, lessonsStarted: 0, lessonsCompleted: 0, studySessions: 0, instructionalMinutes: 0 },
    engines: [],
    ai: {
      requests: 0, inputTokens: 0, outputTokens: 0, cachedInputReadTokens: 7,
      cachedInputWriteTokens: 3, ttsCharacters: 0, spend: costSource(),
    },
    safety: {
      openSafetyStops: { evidence: 'complete', value: 0 }, adultReviewsPending: { evidence: 'complete', value: 0 },
      safeguardFailures: { evidence: 'complete', value: 0 },
    },
    system: { apiErrorRatePercent: 0, latencyMs: 0, syncFailures: 0, persistenceFailures: 0 },
  }
}

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ADMIN_COST_KINDS,
  ADMIN_ENGINE_IDS,
  ADMIN_HEALTH_STATES,
  ADMIN_READ_CAPABILITIES,
} from './admin0Vocabulary'
import {
  adaptAdminOverview,
  adaptCost,
  adaptSafetyMetric,
  adaptSystemMetric,
  adaptUsageMetric,
  formatUsdMicros,
  safeEngineReasonMessage,
  safeOverviewErrorMessage,
  type AdminOverviewSource,
} from './overviewAdapter'
import { hasOverviewReadCapability, movePresetSelection, validateCustomRange } from './overviewModel'

describe('ADMIN-0 vocabulary projection', () => {
  it('faithfully mirrors all canonical engines, health states, cost kinds, and overview capability', () => {
    expect(ADMIN_ENGINE_IDS).toEqual([
      'tutor', 'study', 'assessment', 'curriculum', 'jarvis', 'tts', 'gateway', 'sync',
    ])
    expect(ADMIN_HEALTH_STATES).toEqual(['healthy', 'degraded', 'unavailable', 'disabled', 'unknown'])
    expect(ADMIN_COST_KINDS).toEqual(['calculated', 'reconciled', 'unavailable'])
    expect(ADMIN_READ_CAPABILITIES).toContain('overview:read')
  })
})

describe('IntegerMicros presentation', () => {
  it('formats values beyond Number safe precision with exact BigInt arithmetic', () => {
    expect(formatUsdMicros('9007199254740993000000')).toBe('$9,007,199,254,740,993.00')
    expect(formatUsdMicros('1840000')).toBe('$1.84')
    expect(formatUsdMicros('5000')).toBe('$0.01')
    expect(formatUsdMicros('4999')).toBe('$0.00')
  })

  it('rejects non-canonical money and removes the floating USD transport', () => {
    expect(() => formatUsdMicros('1.5')).toThrow(/IntegerMicros/)
    const modelSource = readFileSync(join(process.cwd(), 'src/admin/overviewModel.ts'), 'utf8')
    const adapterSource = readFileSync(join(process.cwd(), 'src/admin/overviewAdapter.ts'), 'utf8')
    expect(modelSource).not.toContain('amountUsd')
    expect(adapterSource).not.toContain('amountUsd')
  })

  it('preserves canonical calculated, reconciled, and unavailable cost semantics', () => {
    expect(adaptCost({ costMicros: '1840000', costKind: 'calculated', currency: 'USD' })).toEqual({
      status: 'available', value: { costMicros: '1840000', costKind: 'calculated' },
    })
    expect(adaptCost({ costMicros: '2000000', costKind: 'reconciled', currency: 'USD' })).toEqual({
      status: 'available', value: { costMicros: '2000000', costKind: 'reconciled' },
    })
    expect(adaptCost({ costMicros: null, costKind: 'unavailable', currency: 'USD' })).toEqual({ status: 'unavailable' })
    expect(adaptCost({ costMicros: null, costKind: 'calculated', currency: 'USD' })).toEqual({ status: 'unknown' })
  })
})

describe('field-aware overview adaptation', () => {
  it('preserves zero while distinguishing incomplete, unavailable, and unknown evidence', () => {
    expect(adaptSafetyMetric({ evidence: 'complete', value: 0 })).toEqual({ status: 'available', value: 0 })
    expect(adaptSafetyMetric({ evidence: 'incomplete' })).toEqual({ status: 'unknown' })
    expect(adaptSafetyMetric({ evidence: 'unavailable' })).toEqual({ status: 'unavailable' })
    expect(adaptUsageMetric(null)).toEqual({ status: 'unknown' })
    expect(adaptSystemMetric(null)).toEqual({ status: 'unknown' })
  })

  it('keeps overview observation time separate from successful refresh time', () => {
    const source = minimalSource()
    const model = adaptAdminOverview(source)
    expect(model.observedAt).toBe('2026-08-08T14:00:00.000Z')
    expect(model.academy.lastSuccessfulDataRefresh).toEqual({
      status: 'available', value: '2026-08-08T13:55:00.000Z',
    })
  })
})

describe('authorization and safe presentation', () => {
  it('requires the canonical overview-read capability', () => {
    expect(hasOverviewReadCapability({ status: 'authorized', role: 'viewer', capabilities: ['overview:read'] })).toBe(true)
    expect(hasOverviewReadCapability({ status: 'authorized', role: 'owner', capabilities: ['engines:operate'] })).toBe(false)
    expect(hasOverviewReadCapability({ status: 'unauthorized', reasonCode: 'admin_assignment_required' })).toBe(false)
  })

  it('maps bounded codes and never echoes an arbitrary reason or exception', () => {
    expect(safeEngineReasonMessage('provider_timeout')).toBe('Provider timeout')
    expect(safeEngineReasonMessage('raw learner transcript: secret')).toBe('Additional operational detail is unavailable.')
    expect(safeOverviewErrorMessage('raw stack trace' as 'overview_unavailable')).toBe('Operational data is temporarily unavailable.')
  })
})

describe('overview range behavior', () => {
  it('validates custom range completeness and ordering', () => {
    expect(validateCustomRange('', '')).toMatch(/both/i)
    expect(validateCustomRange('2026-02-30', '2026-03-01')).toMatch(/valid/i)
    expect(validateCustomRange('2026-08-10', '2026-08-09')).toMatch(/on or before/i)
    expect(validateCustomRange('2026-08-08', '2026-08-09')).toBeNull()
  })

  it('supports arrow, Home, and End keyboard movement across presets', () => {
    expect(movePresetSelection('today', 'ArrowLeft')).toBe('school-year')
    expect(movePresetSelection('today', 'ArrowRight')).toBe('7-days')
    expect(movePresetSelection('30-days', 'Home')).toBe('today')
    expect(movePresetSelection('today', 'End')).toBe('school-year')
  })
})

function minimalSource(): AdminOverviewSource {
  return {
    range: { kind: 'preset', preset: 'today' },
    observedAt: '2026-08-08T14:00:00.000Z',
    freshness: 'current',
    academy: {
      environment: 'production', appVersion: 'build-1', curriculumVersion: '1.0.0',
      overallHealth: 'healthy', lastSuccessfulDataRefresh: '2026-08-08T13:55:00.000Z',
    },
    learners: { activeLearners: 0, lessonsStarted: 0, lessonsCompleted: 0, studySessions: 0, instructionalMinutes: 0 },
    engines: [],
    ai: { requests: 0, inputTokens: 0, outputTokens: 0, ttsCharacters: 0, spend: { costMicros: '0', costKind: 'calculated', currency: 'USD' } },
    safety: {
      openSafetyStops: { evidence: 'complete', value: 0 },
      adultReviewsPending: { evidence: 'complete', value: 0 },
      safeguardFailures: { evidence: 'complete', value: 0 },
    },
    system: { apiErrorRatePercent: 0, latencyMs: 0, syncFailures: 0, persistenceFailures: 0 },
  }
}

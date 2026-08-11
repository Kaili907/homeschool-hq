import { describe, expect, it, vi } from 'vitest'
import { ADMIN_CONFIGURATION_KEYS } from '../../../src/admin/configurationModel.ts'
import { AdminConfigurationSourceError } from './admin-configuration-source.js'
import {
  createEffectiveConfigurationReader,
  evaluateMonthlyCostThreshold,
} from './effective-configuration.js'

const VALUES = Object.freeze({
  'runtime.ai.enabled': true,
  'runtime.tts.enabled': true,
  'quota.ai.requests_per_account_day': 80,
  'quota.tts.requests_per_account_day': 250,
  'cost.warning.monthly_micros': '999999999998',
  'cost.critical.monthly_micros': '999999999999',
  'ai.approved_tiers': ['sonnet', 'haiku'],
  'ai.default_tier': 'haiku',
})

function projection({ revision = '1', values = {}, status = 'runtime_enforced' } = {}) {
  const merged = { ...VALUES, ...values }
  return {
    schemaVersion: 2,
    integrationStatus: status,
    settings: ADMIN_CONFIGURATION_KEYS.map((key) => ({
      key,
      value: merged[key],
      revision,
      requiredCapability: 'configuration:manage',
      protectiveCapability: key.startsWith('runtime.') ? 'engines:operate' : null,
      warningLevel: key === 'runtime.ai.enabled' || key === 'runtime.tts.enabled'
        || key === 'cost.critical.monthly_micros' || key === 'ai.approved_tiers'
        ? 'critical'
        : 'warning',
      bounds: key.startsWith('quota.')
        ? { minimum: '1', maximum: key.includes('.ai.') ? '200' : '1000' }
        : key.startsWith('cost.') ? { minimum: '1', maximum: '1000000000000' } : null,
      allowlist: key.startsWith('ai.') ? ['sonnet', 'haiku'] : null,
      deploymentCeilingType: key.startsWith('runtime.') ? 'boolean_enablement'
        : key.startsWith('quota.') ? 'integer_maximum'
          : key.startsWith('cost.') ? 'integer_micros_maximum'
            : key === 'ai.approved_tiers' ? 'allowlist_subset' : 'allowlist_member',
      registryVersion: 1,
      integrationStatus: status,
    })),
  }
}

const ENV = Object.freeze({
  ACADEMY_AI_ENABLED: 'true',
  ACADEMY_TTS_ENABLED: 'true',
  ACADEMY_AI_DAILY_LIMIT: '60',
  ACADEMY_TTS_DAILY_LIMIT: '200',
  SUPABASE_SERVICE_ROLE_KEY: 'must-not-leak',
  ELEVENLABS_API_KEY: 'provider-secret',
})

describe('server effective configuration', () => {
  it('applies deployment ceilings without returning secrets or provider identifiers', async () => {
    const reader = createEffectiveConfigurationReader({
      env: ENV,
      source: { read: vi.fn(async () => projection()) },
      now: () => Date.parse('2026-08-10T12:00:00.000Z'),
    })
    const result = await reader.read()
    expect(result).toMatchObject({
      status: 'available',
      runtime: { aiEnabled: true, ttsEnabled: true },
      quotas: { aiRequestsPerAccountDay: 60, ttsRequestsPerAccountDay: 200 },
      ai: { approvedTiers: ['sonnet', 'haiku'], defaultTier: 'haiku' },
    })
    expect(result.revisions).toEqual(Object.fromEntries(ADMIN_CONFIGURATION_KEYS.map((key) => [key, '1'])))
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('must-not-leak')
    expect(serialized).not.toContain('provider-secret')
    expect(serialized).not.toMatch(/providerVoiceId|SUPABASE_SERVICE_ROLE_KEY|ELEVENLABS_API_KEY/)
  })

  it('uses a bounded cache and refreshes to a newer per-setting revision', async () => {
    let now = 1_000
    const source = { read: vi.fn()
      .mockResolvedValueOnce(projection())
      .mockResolvedValueOnce(projection({
        revision: '2', values: { 'runtime.ai.enabled': false },
      })) }
    const reader = createEffectiveConfigurationReader({
      env: ENV, source, now: () => now, cacheTtlMs: 10,
    })
    expect((await reader.read()).runtime.aiEnabled).toBe(true)
    now = 1_005
    expect((await reader.read()).runtime.aiEnabled).toBe(true)
    expect(source.read).toHaveBeenCalledOnce()
    now = 1_011
    const refreshed = await reader.read()
    expect(refreshed.runtime.aiEnabled).toBe(false)
    expect(refreshed.revisions['runtime.ai.enabled']).toBe('2')
    expect(source.read).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['source unavailable', new AdminConfigurationSourceError('source_unavailable'), 'source_unavailable'],
    ['source timeout', new AdminConfigurationSourceError('source_timeout'), 'source_timeout'],
  ])('returns explicit fail-safe defaults for %s', async (_label, failure, reason) => {
    const reader = createEffectiveConfigurationReader({
      env: ENV,
      source: { read: vi.fn(async () => { throw failure }) },
    })
    await expect(reader.read()).resolves.toMatchObject({
      status: 'unavailable',
      reason,
      revisions: null,
      runtime: { aiEnabled: false, ttsEnabled: false },
      quotas: { aiRequestsPerAccountDay: 1, ttsRequestsPerAccountDay: 1 },
      ai: { approvedTiers: [], defaultTier: null },
    })
  })

  it('refuses pending, regressed, or same-revision changed authority', async () => {
    const pending = createEffectiveConfigurationReader({
      env: ENV,
      source: { read: vi.fn(async () => projection({ status: 'pending_runtime_integration' })) },
    })
    expect((await pending.read()).reason).toBe('configuration_not_enforced')

    let now = 0
    const regressed = createEffectiveConfigurationReader({
      env: ENV,
      source: { read: vi.fn()
        .mockResolvedValueOnce(projection({ revision: '2' }))
        .mockResolvedValueOnce(projection({ revision: '1' })) },
      now: () => now,
      cacheTtlMs: 1,
    })
    expect((await regressed.read()).status).toBe('available')
    now = 2
    expect((await regressed.read()).reason).toBe('revision_regression')

    const inconsistent = createEffectiveConfigurationReader({
      env: ENV,
      source: { read: vi.fn()
        .mockResolvedValueOnce(projection())
        .mockResolvedValueOnce(projection({ values: { 'runtime.ai.enabled': false } })) },
      now: () => now,
      cacheTtlMs: 1,
    })
    expect((await inconsistent.read()).status).toBe('available')
    now = 4
    expect((await inconsistent.read()).reason).toBe('revision_inconsistent')
  })
})

describe('exact monthly cost threshold evaluation', () => {
  const configuration = {
    status: 'available',
    revisions: {
      'cost.warning.monthly_micros': '7',
      'cost.critical.monthly_micros': '9',
    },
    costThresholds: {
      warningMonthlyMicros: '999999999998',
      criticalMonthlyMicros: '999999999999',
    },
  }

  it.each([
    ['999999999997', 'below_warning'],
    ['999999999998', 'warning'],
    ['999999999999', 'critical'],
    ['9007199254740993', 'critical'],
  ])('classifies %s without Number conversion', (micros, status) => {
    expect(evaluateMonthlyCostThreshold({
      rangeKind: 'month',
      calculatedCost: { status: 'available', micros, currency: 'USD' },
      configuration,
    })).toMatchObject({ status, observedMicros: micros })
  })

  it('does not report a below-threshold result from partial or unavailable evidence', () => {
    expect(evaluateMonthlyCostThreshold({
      rangeKind: 'month',
      calculatedCost: { status: 'partial', micros: '1', currency: 'USD' },
      configuration,
    })).toMatchObject({ status: 'unavailable', reason: 'calculated_cost_partial' })
    expect(evaluateMonthlyCostThreshold({
      rangeKind: 'month', calculatedCost: { status: 'unavailable', micros: null },
      configuration: { status: 'unavailable' },
    })).toMatchObject({ status: 'unavailable', reason: 'configuration_unavailable' })
  })
})

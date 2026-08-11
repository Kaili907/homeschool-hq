import { describe, expect, it, vi } from 'vitest'
import {
  RUNTIME_CONFIGURATION_CLASSIFICATIONS,
  createRuntimeConfigurationResolver,
  projectEffectiveAdminConfiguration,
  resolveEffectiveRuntimeConfiguration,
  safeRuntimeConfigurationFallback,
} from '../../netlify/functions/_shared/admin-runtime-configuration.js'
import { createTtsVoiceCatalog } from '../../netlify/functions/_shared/tts-catalog.js'

const CONFIGURATION_KEYS = [
  'runtime.ai.enabled',
  'runtime.tts.enabled',
  'quota.ai.requests_per_account_day',
  'quota.tts.requests_per_account_day',
  'cost.warning.monthly_micros',
  'cost.critical.monthly_micros',
  'ai.approved_tiers',
  'ai.default_tier',
]

function setting(key, value) {
  const runtime = key.startsWith('runtime.')
  const quota = key.startsWith('quota.')
  const money = key.startsWith('cost.')
  const approved = key === 'ai.approved_tiers'
  return {
    key,
    value,
    revision: '1',
    requiredCapability: 'configuration:manage',
    protectiveCapability: runtime ? 'engines:operate' : null,
    warningLevel: runtime || approved || key === 'cost.critical.monthly_micros'
      ? 'critical'
      : 'warning',
    bounds: quota
      ? { minimum: '1', maximum: key.includes('.ai.') ? '200' : '1000' }
      : money ? { minimum: '1', maximum: '1000000000000' } : null,
    allowlist: key.startsWith('ai.') ? ['sonnet', 'haiku'] : null,
    deploymentCeilingType: runtime ? 'boolean_enablement'
      : quota ? 'integer_maximum'
        : money ? 'integer_micros_maximum'
          : approved ? 'allowlist_subset' : 'allowlist_member',
    registryVersion: 1,
    integrationStatus: 'pending_runtime_integration',
  }
}

function savedProjection(overrides = {}) {
  const values = {
    'runtime.ai.enabled': true,
    'runtime.tts.enabled': true,
    'quota.ai.requests_per_account_day': 50,
    'quota.tts.requests_per_account_day': 200,
    'cost.warning.monthly_micros': '10000000',
    'cost.critical.monthly_micros': '25000000',
    'ai.approved_tiers': ['sonnet', 'haiku'],
    'ai.default_tier': 'sonnet',
    ...overrides,
  }
  return {
    schemaVersion: 2,
    integrationStatus: 'pending_runtime_integration',
    settings: CONFIGURATION_KEYS.map((key) => setting(key, values[key])),
  }
}

const DEPLOYABLE_CATALOG = createTtsVoiceCatalog({
  catalogVersion: 'test-1',
  defaultVoiceRef: 'academy.tts.test',
  voices: [{
    voiceRef: 'academy.tts.test',
    displayLabel: 'Test voice',
    providerClass: 'premium',
    provider: 'elevenlabs',
    providerVoiceId: 'private-provider-voice',
    voiceVersion: '1',
    status: 'active',
    cachedPlayback: 'allow',
    adminApproved: true,
  }],
})

const EMPTY_CATALOG = createTtsVoiceCatalog({
  catalogVersion: 'test-empty-1',
  defaultVoiceRef: null,
  voices: [],
})

function enabledEnv(overrides = {}) {
  return {
    ACADEMY_AI_ENABLED: 'true',
    ACADEMY_TTS_ENABLED: 'true',
    ELEVENLABS_API_KEY: 'server-secret',
    ELEVENLABS_ALLOWED_VOICE_IDS: 'private-provider-voice',
    ...overrides,
  }
}

describe('trusted Admin runtime configuration resolver', () => {
  it('classifies each of the exact eight saved settings truthfully', () => {
    expect(RUNTIME_CONFIGURATION_CLASSIFICATIONS).toEqual({
      'runtime.ai.enabled': 'ENFORCEABLE_NOW',
      'runtime.tts.enabled': 'ENFORCEABLE_NOW',
      'quota.ai.requests_per_account_day': 'ENFORCEABLE_NOW',
      'quota.tts.requests_per_account_day': 'ENFORCEABLE_NOW',
      'cost.warning.monthly_micros': 'ENFORCEABLE_NOW',
      'cost.critical.monthly_micros': 'ENFORCEABLE_NOW',
      'ai.approved_tiers': 'ENFORCEABLE_NOW',
      'ai.default_tier': 'ENFORCEABLE_NOW',
    })
    expect(Object.keys(RUNTIME_CONFIGURATION_CLASSIFICATIONS)).toEqual(CONFIGURATION_KEYS)
  })

  it('applies configured deployment constraints and preserves per-domain truth', () => {
    const resolved = resolveEffectiveRuntimeConfiguration(savedProjection(), {
      env: enabledEnv({
        ACADEMY_AI_DAILY_LIMIT: '25',
        ACADEMY_TTS_DAILY_LIMIT: '150',
      }),
      catalog: DEPLOYABLE_CATALOG,
    })

    expect(resolved.values).toEqual({
      aiEnabled: true,
      ttsEnabled: true,
      aiDailyLimit: 25,
      ttsDailyLimit: 150,
      approvedTiers: ['sonnet', 'haiku'],
      defaultTier: 'sonnet',
    })
    expect(resolved.runtime['quota.ai.requests_per_account_day']).toMatchObject({
      resolution: 'constraint',
      reason: 'deployment_quota_ceiling',
      trustedConsumer: 'anthropic_gateway',
      studyStatus: 'unavailable',
    })
    expect(resolved.runtime['quota.tts.requests_per_account_day']).toMatchObject({
      resolution: 'constraint',
      reason: 'deployment_quota_ceiling',
      trustedConsumer: 'tts_gateway',
      studyStatus: 'unavailable',
    })
    expect(resolved.runtime['cost.warning.monthly_micros']).toMatchObject({
      classification: 'ENFORCEABLE_NOW',
      effectiveValue: '10000000',
      enforcement: 'enforced',
      trustedConsumer: 'cost_alert_evaluator',
      studyStatus: 'not_applicable',
    })
    expect(resolved.runtime['cost.critical.monthly_micros']).toMatchObject({
      effectiveValue: '25000000',
      trustedConsumer: 'cost_alert_evaluator',
    })
    expect(Object.values(resolved.runtime).filter(
      (state) => state.studyStatus === 'unavailable',
    )).toHaveLength(6)
    expect(Object.values(resolved.runtime).filter(
      (state) => state.studyStatus === 'not_applicable',
    )).toHaveLength(2)
    expect(JSON.stringify(resolved)).not.toContain('private-provider-voice')
    expect(JSON.stringify(resolved)).not.toContain('server-secret')
  })

  it('uses current quota fallback ceilings when deployment limits are missing', () => {
    const resolved = resolveEffectiveRuntimeConfiguration(savedProjection(), {
      env: enabledEnv(),
      catalog: DEPLOYABLE_CATALOG,
    })

    expect(resolved.values.aiDailyLimit).toBe(50)
    expect(resolved.values.ttsDailyLimit).toBe(100)
    expect(resolved.runtime['quota.ai.requests_per_account_day']).toMatchObject({
      effectiveValue: 50,
      resolution: 'saved',
      reason: 'saved_value_enforced',
    })
    expect(resolved.runtime['quota.tts.requests_per_account_day']).toMatchObject({
      effectiveValue: 100,
      resolution: 'fallback',
      reason: 'safe_fallback_quota_ceiling',
    })
  })

  it('never changes provider controls based on cost threshold amounts', () => {
    const lowThresholds = resolveEffectiveRuntimeConfiguration(savedProjection({
      'cost.warning.monthly_micros': '1',
      'cost.critical.monthly_micros': '2',
    }), { env: enabledEnv(), catalog: DEPLOYABLE_CATALOG })
    const highThresholds = resolveEffectiveRuntimeConfiguration(savedProjection({
      'cost.warning.monthly_micros': '999999999999',
      'cost.critical.monthly_micros': '1000000000000',
    }), { env: enabledEnv(), catalog: DEPLOYABLE_CATALOG })

    expect(lowThresholds.values).toEqual(highThresholds.values)
    expect(lowThresholds.runtime['cost.warning.monthly_micros']).toMatchObject({
      effectiveValue: '1', trustedConsumer: 'cost_alert_evaluator',
    })
    expect(highThresholds.runtime['cost.critical.monthly_micros']).toMatchObject({
      effectiveValue: '1000000000000', trustedConsumer: 'cost_alert_evaluator',
    })
  })

  it('treats flags as disable-only ceilings and requires a deployable active TTS voice', () => {
    const deploymentDisabled = resolveEffectiveRuntimeConfiguration(savedProjection(), {
      env: enabledEnv({ ACADEMY_AI_ENABLED: 'false' }),
      catalog: DEPLOYABLE_CATALOG,
    })
    expect(deploymentDisabled.runtime['runtime.ai.enabled']).toMatchObject({
      effectiveValue: false,
      resolution: 'constraint',
      reason: 'deployment_disabled',
    })

    const savedDisabled = resolveEffectiveRuntimeConfiguration(savedProjection({
      'runtime.ai.enabled': false,
    }), {
      env: enabledEnv(),
      catalog: DEPLOYABLE_CATALOG,
    })
    expect(savedDisabled.runtime['runtime.ai.enabled']).toMatchObject({
      effectiveValue: false,
      resolution: 'saved',
      reason: 'saved_value_enforced',
    })

    const noVoice = resolveEffectiveRuntimeConfiguration(savedProjection(), {
      env: enabledEnv(),
      catalog: EMPTY_CATALOG,
    })
    expect(noVoice.runtime['runtime.tts.enabled']).toMatchObject({
      effectiveValue: false,
      resolution: 'fallback',
      reason: 'browser_speech_fallback',
    })
  })

  it('distinguishes malformed deployment values from missing safe defaults', () => {
    const resolved = resolveEffectiveRuntimeConfiguration(savedProjection(), {
      env: enabledEnv({
        ACADEMY_AI_ENABLED: ' true ',
        ACADEMY_TTS_DAILY_LIMIT: 'not-a-number',
      }),
      catalog: DEPLOYABLE_CATALOG,
    })

    expect(resolved.runtime['runtime.ai.enabled']).toMatchObject({
      effectiveValue: false,
      enforcement: 'enforced',
      resolution: 'error',
      reason: 'configuration_resolution_failed',
    })
    expect(resolved.runtime['quota.tts.requests_per_account_day']).toMatchObject({
      effectiveValue: 100,
      enforcement: 'enforced',
      resolution: 'error',
      reason: 'configuration_resolution_failed',
    })
  })

  it('builds only the separately tagged, strict browser projection', () => {
    const saved = savedProjection()
    const resolved = resolveEffectiveRuntimeConfiguration(saved, {
      env: enabledEnv(),
      catalog: DEPLOYABLE_CATALOG,
    })
    const browser = projectEffectiveAdminConfiguration(saved, resolved)

    expect(browser.integrationStatus).toBe('pending_runtime_integration')
    expect(browser.runtimeStatus).toBe('runtime_enforced')
    expect(browser.settings[0]).toHaveProperty('value', true)
    expect(browser.settings[0]).toHaveProperty('runtime.effectiveValue', true)
    expect(Object.keys(browser.settings[0].runtime).sort()).toEqual([
      'classification',
      'effectiveValue',
      'enforcement',
      'reason',
      'resolution',
      'studyStatus',
      'trustedConsumer',
    ])
    expect(() => projectEffectiveAdminConfiguration(saved, {
      ...resolved,
      runtime: {
        ...resolved.runtime,
        'runtime.ai.enabled': {
          ...resolved.runtime['runtime.ai.enabled'],
          forgedByBrowser: true,
        },
      },
    })).toThrow('invalid effective Admin configuration projection')
  })

  it('reuses one saved source read and catches every resolution failure fail-closed', async () => {
    const read = vi.fn().mockResolvedValue(savedProjection())
    const resolver = createRuntimeConfigurationResolver({
      env: enabledEnv(),
      source: { read },
    })
    const resolved = await resolver.resolve({ catalog: DEPLOYABLE_CATALOG })
    expect(read).toHaveBeenCalledTimes(1)
    expect(resolved.values.aiEnabled).toBe(true)

    const failedRead = createRuntimeConfigurationResolver({
      env: enabledEnv(),
      source: { read: vi.fn().mockRejectedValue(new Error('database unavailable')) },
    })
    await expect(failedRead.resolve({ catalog: DEPLOYABLE_CATALOG })).resolves.toBe(
      safeRuntimeConfigurationFallback(),
    )

    const invalidProjection = createRuntimeConfigurationResolver({
      env: enabledEnv(),
      source: { read: vi.fn().mockResolvedValue({ forged: true }) },
    })
    const fallback = await invalidProjection.resolve({ catalog: DEPLOYABLE_CATALOG })
    expect(fallback.values).toEqual({
      aiEnabled: false,
      ttsEnabled: false,
      aiDailyLimit: 50,
      ttsDailyLimit: 100,
      approvedTiers: ['sonnet', 'haiku'],
      defaultTier: 'sonnet',
    })
    expect(fallback.runtime['runtime.ai.enabled']).toMatchObject({
      effectiveValue: false,
      resolution: 'error',
      reason: 'configuration_resolution_failed',
    })
    expect(Object.isFrozen(fallback)).toBe(true)
    expect(Object.isFrozen(fallback.values)).toBe(true)
    expect(Object.isFrozen(fallback.values.approvedTiers)).toBe(true)
    expect(Object.isFrozen(fallback.runtime)).toBe(true)
  })
})

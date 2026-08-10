import { describe, expect, it } from 'vitest'
import {
  ADMIN_CONFIGURATION_KEYS,
  isAdminConfigurationValue,
  sanitizeAdminConfigurationProjection,
  sanitizeAdminRuntimeConfigurationProjection,
} from './configurationModel'

type ConfigurationKey = (typeof ADMIN_CONFIGURATION_KEYS)[number]

function setting(key: ConfigurationKey) {
  const runtime = key.startsWith('runtime.')
  const quota = key.startsWith('quota.')
  const money = key.startsWith('cost.')
  const approved = key === 'ai.approved_tiers'
  return {
    key,
    value: runtime ? false
      : key === 'quota.ai.requests_per_account_day' ? 50
        : key === 'quota.tts.requests_per_account_day' ? 200
          : key === 'cost.warning.monthly_micros' ? '10000000'
            : key === 'cost.critical.monthly_micros' ? '25000000'
              : approved ? ['sonnet', 'haiku'] : 'sonnet',
    revision: '1',
    requiredCapability: 'configuration:manage',
    protectiveCapability: runtime ? 'engines:operate' : null,
    warningLevel: runtime || approved || key === 'cost.critical.monthly_micros' ? 'critical' : 'warning',
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

function projection() {
  return {
    schemaVersion: 2,
    integrationStatus: 'pending_runtime_integration',
    settings: ADMIN_CONFIGURATION_KEYS.map(setting),
  }
}

function runtimeState(key: ConfigurationKey) {
  const money = key.startsWith('cost.')
  const tts = key === 'runtime.tts.enabled' || key === 'quota.tts.requests_per_account_day'
  return money ? {
    classification: 'ENFORCEABLE_NOW',
    effectiveValue: key === 'cost.warning.monthly_micros' ? '10000000' : '25000000',
    enforcement: 'enforced',
    resolution: 'saved',
    reason: 'saved_value_enforced',
    trustedConsumer: 'cost_alert_evaluator',
    studyStatus: 'not_applicable',
  } : {
    classification: 'ENFORCEABLE_NOW',
    effectiveValue: key.startsWith('runtime.') ? false
      : key === 'quota.ai.requests_per_account_day' ? 50
        : key === 'quota.tts.requests_per_account_day' ? 100
          : key === 'ai.approved_tiers' ? ['sonnet', 'haiku'] : 'sonnet',
    enforcement: 'enforced',
    resolution: 'saved',
    reason: 'saved_value_enforced',
    trustedConsumer: tts ? 'tts_gateway' : 'anthropic_gateway',
    studyStatus: 'unavailable',
  }
}

function runtimeProjection() {
  return {
    ...projection(),
    runtimeStatus: 'partial_runtime_enforcement',
    settings: ADMIN_CONFIGURATION_KEYS.map((key) => ({
      ...setting(key),
      runtime: runtimeState(key),
    })),
  }
}

describe('Admin configuration browser model', () => {
  it('preserves the exact saved eight-key projection contract', () => {
    const model = sanitizeAdminConfigurationProjection(projection())
    expect(model?.integrationStatus).toBe('pending_runtime_integration')
    expect(model?.settings.map((item) => item.key)).toEqual(ADMIN_CONFIGURATION_KEYS)
    expect(model?.settings.every((item) => item.integrationStatus === 'pending_runtime_integration'))
      .toBe(true)
    expect(sanitizeAdminConfigurationProjection(runtimeProjection())).toBeNull()
  })

  it.each([
    ['quota.ai.requests_per_account_day', 1, true],
    ['quota.ai.requests_per_account_day', 200, true],
    ['quota.ai.requests_per_account_day', 201, false],
    ['quota.tts.requests_per_account_day', 1000, true],
    ['cost.warning.monthly_micros', '1000000000000', true],
    ['cost.warning.monthly_micros', 1000, false],
    ['cost.warning.monthly_micros', '01', false],
    ['ai.approved_tiers', ['sonnet'], true],
    ['ai.approved_tiers', ['sonnet', 'sonnet'], false],
    ['ai.default_tier', 'opus', false],
  ] as const)('validates %s value %j', (key, value, expected) => {
    expect(isAdminConfigurationValue(key, value)).toBe(expected)
  })

  it('rejects secret-bearing fields, missing settings, and wrong saved value kinds', () => {
    const secret = projection()
    secret.settings[0] = { ...secret.settings[0], providerSecret: 'do-not-expose' } as any
    expect(sanitizeAdminConfigurationProjection(secret)).toBeNull()

    const missing = projection()
    missing.settings.pop()
    expect(sanitizeAdminConfigurationProjection(missing)).toBeNull()

    const wrongMoney = projection()
    wrongMoney.settings[4] = { ...wrongMoney.settings[4], value: 10_000_000 }
    expect(sanitizeAdminConfigurationProjection(wrongMoney)).toBeNull()
  })

  it('accepts and freezes the separate strict runtime projection', () => {
    const model = sanitizeAdminRuntimeConfigurationProjection(runtimeProjection())
    expect(model?.integrationStatus).toBe('pending_runtime_integration')
    expect(model?.runtimeStatus).toBe('partial_runtime_enforcement')
    expect(model?.settings.filter((item) => item.runtime.studyStatus === 'unavailable'))
      .toHaveLength(6)
    expect(model?.settings.filter((item) => item.runtime.studyStatus === 'not_applicable'))
      .toHaveLength(2)
    expect(Object.isFrozen(model)).toBe(true)
    expect(Object.isFrozen(model?.settings)).toBe(true)
    expect(Object.isFrozen(model?.settings[6].runtime.effectiveValue)).toBe(true)
  })

  it.each([
    ['wrong runtime status', (value: any) => { value.runtimeStatus = 'runtime_enforcement_partial' }],
    ['extra top-level field', (value: any) => { value.providerSecret = 'do-not-expose' }],
    ['extra setting field', (value: any) => { value.settings[0].providerSecret = 'do-not-expose' }],
    ['extra runtime field', (value: any) => { value.settings[0].runtime.forged = true }],
    ['forged effective value', (value: any) => { value.settings[2].runtime.effectiveValue = 201 }],
    ['unknown reason', (value: any) => { value.settings[0].runtime.reason = 'browser_claimed_active' }],
    ['wrong trusted consumer', (value: any) => { value.settings[0].runtime.trustedConsumer = 'tts_gateway' }],
    ['wrong Study status', (value: any) => { value.settings[0].runtime.studyStatus = 'not_applicable' }],
    ['cost alert consumer removed', (value: any) => { value.settings[4].runtime.trustedConsumer = null }],
  ])('rejects %s in a browser runtime response', (_label, forge) => {
    const candidate = runtimeProjection()
    forge(candidate)
    expect(sanitizeAdminRuntimeConfigurationProjection(candidate)).toBeNull()
  })
})

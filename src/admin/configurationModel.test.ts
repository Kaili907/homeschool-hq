import { describe, expect, it } from 'vitest'
import {
  ADMIN_CONFIGURATION_KEYS,
  isAdminConfigurationValue,
  sanitizeAdminConfigurationProjection,
} from './configurationModel'

function setting(
  key: (typeof ADMIN_CONFIGURATION_KEYS)[number],
  integrationStatus: 'pending_runtime_integration' | 'runtime_enforced' = 'pending_runtime_integration',
) {
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
    integrationStatus,
  }
}

function projection(
  integrationStatus: 'pending_runtime_integration' | 'runtime_enforced' = 'pending_runtime_integration',
) {
  return {
    schemaVersion: 2,
    integrationStatus,
    settings: ADMIN_CONFIGURATION_KEYS.map((key) => setting(key, integrationStatus)),
  }
}

describe('Admin configuration browser model', () => {
  it('accepts only the exact eight-key sanitized projection', () => {
    const model = sanitizeAdminConfigurationProjection(projection())
    expect(model?.settings.map((item) => item.key)).toEqual(ADMIN_CONFIGURATION_KEYS)
    expect(model?.settings.every((item) => item.integrationStatus === 'pending_runtime_integration'))
      .toBe(true)
  })

  it('accepts the runtime-enforced projection and rejects mixed status', () => {
    expect(sanitizeAdminConfigurationProjection(projection('runtime_enforced'))?.integrationStatus)
      .toBe('runtime_enforced')
    const mixed = projection('runtime_enforced')
    mixed.settings[0] = { ...mixed.settings[0], integrationStatus: 'pending_runtime_integration' }
    expect(sanitizeAdminConfigurationProjection(mixed)).toBeNull()
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

  it('rejects extra secret-bearing fields, missing keys, and wrong value kinds', () => {
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
})

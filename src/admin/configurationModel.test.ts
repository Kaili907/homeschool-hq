import { describe, expect, it } from 'vitest'
import {
  ADMIN_CONFIGURATION_KEYS,
  isAdminConfigurationValue,
  sanitizeAdminConfigurationProjection,
} from './configurationModel'

function setting(key: (typeof ADMIN_CONFIGURATION_KEYS)[number]) {
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

describe('Admin configuration browser model', () => {
  it('accepts only the exact eight-key sanitized projection', () => {
    const model = sanitizeAdminConfigurationProjection(projection())
    expect(model?.settings.map((item) => item.key)).toEqual(ADMIN_CONFIGURATION_KEYS)
    expect(model?.settings.every((item) => item.integrationStatus === 'pending_runtime_integration'))
      .toBe(true)
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

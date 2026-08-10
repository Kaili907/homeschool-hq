import { describe, expect, it } from 'vitest'
import {
  ADMIN_CONFIGURATION_KEYS,
  type AdminConfigurationKey,
  type AdminConfigurationProjection,
} from './configurationModel'
import {
  adminConfigurationValuesEqual,
  draftForAdminConfigurationSetting,
  formatAdminConfigurationValue,
  parseAdminConfigurationDraft,
} from './configurationUiModel'

function setting(key: AdminConfigurationKey) {
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
              : approved ? ['sonnet', 'haiku'] as const : 'sonnet' as const,
    revision: '1', requiredCapability: 'configuration:manage' as const,
    protectiveCapability: runtime ? 'engines:operate' as const : null,
    warningLevel: runtime || approved || key === 'cost.critical.monthly_micros' ? 'critical' as const : 'warning' as const,
    bounds: quota ? { minimum: '1', maximum: key.includes('.ai.') ? '200' : '1000' } : money ? { minimum: '1', maximum: '1000000000000' } : null,
    allowlist: key.startsWith('ai.') ? ['sonnet', 'haiku'] as const : null,
    deploymentCeilingType: runtime ? 'boolean_enablement' as const : quota ? 'integer_maximum' as const : money ? 'integer_micros_maximum' as const : approved ? 'allowlist_subset' as const : 'allowlist_member' as const,
    registryVersion: 1 as const,
    integrationStatus: 'pending_runtime_integration' as const,
  }
}

function projection(): AdminConfigurationProjection {
  return {
    schemaVersion: 2,
    integrationStatus: 'pending_runtime_integration',
    settings: ADMIN_CONFIGURATION_KEYS.map(setting),
  }
}

describe('Admin configuration UI validation', () => {
  it('parses each supported value kind without adding a generic setting path', () => {
    const model = projection()
    expect(parseAdminConfigurationDraft('runtime.ai.enabled', true, model)).toEqual({ ok: true, value: true })
    expect(parseAdminConfigurationDraft('quota.ai.requests_per_account_day', '200', model)).toEqual({ ok: true, value: 200 })
    expect(parseAdminConfigurationDraft('cost.warning.monthly_micros', '12.345678', model)).toEqual({ ok: true, value: '12345678' })
    expect(parseAdminConfigurationDraft('ai.approved_tiers', ['haiku', 'sonnet'], model)).toEqual({ ok: true, value: ['haiku', 'sonnet'] })
    expect(parseAdminConfigurationDraft('ai.default_tier', 'haiku', model)).toEqual({ ok: true, value: 'haiku' })
  })

  it('validates bounds and cross-setting invariants before preview', () => {
    const model = projection()
    expect(parseAdminConfigurationDraft('quota.ai.requests_per_account_day', '201', model)).toMatchObject({ ok: false })
    expect(parseAdminConfigurationDraft('quota.tts.requests_per_account_day', '1.5', model)).toMatchObject({ ok: false })
    expect(parseAdminConfigurationDraft('cost.warning.monthly_micros', '25', model)).toMatchObject({ ok: false, error: expect.stringContaining('below') })
    expect(parseAdminConfigurationDraft('cost.critical.monthly_micros', '10', model)).toMatchObject({ ok: false, error: expect.stringContaining('above') })
    expect(parseAdminConfigurationDraft('ai.approved_tiers', ['haiku'], model)).toMatchObject({ ok: false, error: expect.stringContaining('default') })
  })

  it('keeps exact money and deterministic before/after presentation', () => {
    const warning = setting('cost.warning.monthly_micros')
    expect(draftForAdminConfigurationSetting(warning)).toBe('10')
    expect(formatAdminConfigurationValue(warning.key, warning.value)).toBe('$10.00')
    expect(formatAdminConfigurationValue(warning.key, '1')).toBe('$0.000001')
    expect(formatAdminConfigurationValue(warning.key, '12345678')).toBe('$12.345678')
    expect(adminConfigurationValuesEqual(['sonnet', 'haiku'], ['sonnet', 'haiku'])).toBe(true)
    expect(adminConfigurationValuesEqual(['sonnet'], ['haiku'])).toBe(false)
  })
})

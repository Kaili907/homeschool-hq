import { describe, expect, it, vi } from 'vitest'
import { ADMIN_CONFIGURATION_KEYS, type AdminConfigurationKey } from './configurationModel'
import {
  ADMIN_CONFIGURATION_COMMIT_ENDPOINT,
  ADMIN_CONFIGURATION_ENDPOINT,
  ADMIN_CONFIGURATION_PREVIEW_ENDPOINT,
  AdminConfigurationError,
  createAdminConfigurationHttpSource,
} from './configurationHttpSource'

const TOKEN = 'A'.repeat(43)
const CONFIRMATION_ID = '20000000-0000-4000-8000-000000000101'
const REQUEST_ID = '10000000-0000-4000-8000-000000000101'

function setting(key: AdminConfigurationKey) {
  const runtime = key.startsWith('runtime.')
  const quota = key.startsWith('quota.')
  const money = key.startsWith('cost.')
  const approved = key === 'ai.approved_tiers'
  return {
    key,
    value: runtime ? false : key === 'quota.ai.requests_per_account_day' ? 50
      : key === 'quota.tts.requests_per_account_day' ? 200
        : key === 'cost.warning.monthly_micros' ? '10000000'
          : key === 'cost.critical.monthly_micros' ? '25000000'
            : approved ? ['sonnet', 'haiku'] : 'sonnet',
    revision: '1', requiredCapability: 'configuration:manage',
    protectiveCapability: runtime ? 'engines:operate' : null,
    warningLevel: runtime || approved || key === 'cost.critical.monthly_micros' ? 'critical' : 'warning',
    bounds: quota ? { minimum: '1', maximum: key.includes('.ai.') ? '200' : '1000' } : money ? { minimum: '1', maximum: '1000000000000' } : null,
    allowlist: key.startsWith('ai.') ? ['sonnet', 'haiku'] : null,
    deploymentCeilingType: runtime ? 'boolean_enablement' : quota ? 'integer_maximum' : money ? 'integer_micros_maximum' : approved ? 'allowlist_subset' : 'allowlist_member',
    registryVersion: 1, integrationStatus: 'pending_runtime_integration',
  }
}

function projection() {
  return { schemaVersion: 2, integrationStatus: 'pending_runtime_integration', settings: ADMIN_CONFIGURATION_KEYS.map(setting) }
}

function response(status: number, body: unknown) {
  return { status, json: async () => body }
}

describe('Admin configuration HTTP source', () => {
  it('reads only the exact authenticated, no-store projection', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) => response(200, projection()))
    const source = createAdminConfigurationHttpSource({ getAccessToken: async () => 'access-token', fetchImpl })
    await expect(source.read()).resolves.toMatchObject({ settings: expect.arrayContaining([expect.objectContaining({ key: 'runtime.ai.enabled' })]) })
    expect(fetchImpl).toHaveBeenCalledWith(ADMIN_CONFIGURATION_ENDPOINT, expect.objectContaining({
      method: 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', Authorization: 'Bearer access-token' },
    }))
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty('body')
  })

  it('sends the exact preview and confirmed commit contracts', async () => {
    const fetchImpl = vi.fn(async (url: string, _init: RequestInit) => url === ADMIN_CONFIGURATION_PREVIEW_ENDPOINT
      ? response(200, {
          schemaVersion: 2, settingKey: 'runtime.ai.enabled', currentValue: false,
          newValue: true, expectedRevision: '1', warningLevel: 'critical',
          confirmationId: CONFIRMATION_ID, confirmationExpiresAt: '2026-08-10T17:05:00.000Z',
          integrationStatus: 'pending_runtime_integration', confirmationToken: TOKEN,
        })
      : response(200, {
          schemaVersion: 2, settingKey: 'runtime.ai.enabled', value: true, revision: '2',
          idempotencyResult: 'created', integrationStatus: 'pending_runtime_integration',
        }))
    const source = createAdminConfigurationHttpSource({ getAccessToken: async () => 'access-token', fetchImpl })
    const change = { settingKey: 'runtime.ai.enabled' as const, expectedRevision: '1', newValue: true, reasonCode: 'operator.request' as const }
    await expect(source.preview(change)).resolves.toMatchObject({ confirmationToken: TOKEN, newValue: true })
    await expect(source.commit({ ...change, requestId: REQUEST_ID, confirmationToken: TOKEN })).resolves.toMatchObject({ revision: '2' })
    expect(fetchImpl.mock.calls.map(([url]) => url)).toEqual([ADMIN_CONFIGURATION_PREVIEW_ENDPOINT, ADMIN_CONFIGURATION_COMMIT_ENDPOINT])
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1].body))).toEqual(change)
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1].body))).toEqual({ ...change, requestId: REQUEST_ID, confirmationToken: TOKEN })
  })

  it('fails closed for missing authorization, extra secret fields, and malformed confirmations', async () => {
    const fetchImpl = vi.fn()
    const signedOut = createAdminConfigurationHttpSource({ getAccessToken: async () => null, fetchImpl })
    await expect(signedOut.read()).rejects.toEqual(new AdminConfigurationError('configuration_unauthorized'))
    expect(fetchImpl).not.toHaveBeenCalled()

    const unsafe = projection()
    unsafe.settings[0] = { ...unsafe.settings[0], providerApiKey: 'SECRET' } as typeof unsafe.settings[number]
    const unsafeSource = createAdminConfigurationHttpSource({
      getAccessToken: async () => 'access-token', fetchImpl: async () => response(200, unsafe),
    })
    await expect(unsafeSource.read()).rejects.toEqual(new AdminConfigurationError('configuration_unavailable'))

    const mismatchedPreview = createAdminConfigurationHttpSource({
      getAccessToken: async () => 'access-token',
      fetchImpl: async () => response(200, {
        schemaVersion: 2, settingKey: 'runtime.tts.enabled', currentValue: false,
        newValue: true, expectedRevision: '1', warningLevel: 'critical',
        confirmationId: CONFIRMATION_ID, confirmationExpiresAt: '2026-08-10T17:05:00.000Z',
        integrationStatus: 'pending_runtime_integration', confirmationToken: TOKEN,
      }),
    })
    await expect(mismatchedPreview.preview({
      settingKey: 'runtime.ai.enabled', expectedRevision: '1', newValue: true,
      reasonCode: 'operator.request',
    })).rejects.toEqual(new AdminConfigurationError('configuration_unavailable'))
  })

  it.each([
    [409, 'revision_conflict', 'revision_conflict'],
    [400, 'cross_setting_invalid', 'cross_setting_invalid'],
    [504, 'configuration_source_timeout', 'configuration_timeout'],
    [503, 'configuration_source_unavailable', 'configuration_unavailable'],
    [403, 'admin_access_denied', 'configuration_unauthorized'],
  ] as const)('maps HTTP %s %s to vetted %s', async (status, wireCode, expected) => {
    const source = createAdminConfigurationHttpSource({
      getAccessToken: async () => 'access-token',
      fetchImpl: async () => response(status, { error: { code: wireCode } }),
    })
    await expect(source.read()).rejects.toEqual(new AdminConfigurationError(expected))
  })
})

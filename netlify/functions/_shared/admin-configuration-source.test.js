import { describe, expect, it, vi } from 'vitest'
import {
  AdminConfigurationSourceError,
  createAdminConfigurationSource,
} from './admin-configuration-source.js'

const definitions = [
  ['ai.approved_tiers', ['sonnet', 'haiku'], null, ['sonnet', 'haiku'], 'critical', 'allowlist_subset'],
  ['ai.default_tier', 'sonnet', null, ['sonnet', 'haiku'], 'warning', 'allowlist_member'],
  ['cost.critical.monthly_micros', '25000000', { minimum: '1', maximum: '1000000000000' }, null, 'critical', 'integer_micros_maximum'],
  ['cost.warning.monthly_micros', '10000000', { minimum: '1', maximum: '1000000000000' }, null, 'warning', 'integer_micros_maximum'],
  ['quota.ai.requests_per_account_day', 50, { minimum: '1', maximum: '200' }, null, 'warning', 'integer_maximum'],
  ['quota.tts.requests_per_account_day', 200, { minimum: '1', maximum: '1000' }, null, 'warning', 'integer_maximum'],
  ['runtime.ai.enabled', false, null, null, 'critical', 'boolean_enablement'],
  ['runtime.tts.enabled', false, null, null, 'critical', 'boolean_enablement'],
]

const READ = {
  schemaVersion: 2,
  integrationStatus: 'pending_runtime_integration',
  settings: definitions.map(([key, value, bounds, allowlist, warningLevel, deploymentCeilingType]) => ({
    key,
    value,
    revision: '1',
    requiredCapability: 'configuration:manage',
    protectiveCapability: String(key).startsWith('runtime.') ? 'engines:operate' : null,
    warningLevel,
    bounds,
    allowlist,
    deploymentCeilingType,
    registryVersion: 1,
    integrationStatus: 'pending_runtime_integration',
  })),
}

const PREVIEW = {
  schemaVersion: 2,
  settingKey: 'runtime.ai.enabled',
  currentValue: false,
  newValue: true,
  expectedRevision: '1',
  warningLevel: 'critical',
  confirmationId: '20000000-0000-4000-8000-000000000201',
  confirmationExpiresAt: '2026-08-09T17:05:00.000Z',
  integrationStatus: 'pending_runtime_integration',
}

const COMMIT = {
  schemaVersion: 2,
  settingKey: 'runtime.ai.enabled',
  value: true,
  revision: '2',
  idempotencyResult: 'created',
  integrationStatus: 'pending_runtime_integration',
}

function client(result) {
  const abortSignal = vi.fn(async () => result)
  return { rpc: vi.fn(() => ({ abortSignal })), abortSignal }
}

describe('Admin configuration Supabase source', () => {
  it('uses the exact service read RPC and rejects unsafe projections', async () => {
    const serviceClient = client({ data: READ, error: null })
    const source = createAdminConfigurationSource({ serviceClient })
    await expect(source.read()).resolves.toEqual(READ)
    expect(serviceClient.rpc).toHaveBeenCalledWith('academy_admin_read_configuration_v1', {
      p_required_capability: 'configuration:read',
    })

    const unsafe = client({ data: { ...READ, secret: 'provider-key' }, error: null })
    await expect(createAdminConfigurationSource({ serviceClient: unsafe }).read())
      .rejects.toMatchObject({ code: 'source_unavailable' })
  })

  it('pins the actor bearer and passes exact preview/commit parameters', async () => {
    const previewClient = client({ data: PREVIEW, error: null })
    const commitClient = client({ data: COMMIT, error: null })
    const factory = vi.fn()
      .mockReturnValueOnce(previewClient)
      .mockReturnValueOnce(commitClient)
    const source = createAdminConfigurationSource({ mutationClientFactory: factory })
    const request = {
      settingKey: 'runtime.ai.enabled', expectedRevision: '1', newValue: true,
      reasonCode: 'operator.request',
    }
    await expect(source.preview('actor-token', request, 'a'.repeat(64))).resolves.toEqual(PREVIEW)
    expect(factory).toHaveBeenNthCalledWith(1, 'actor-token')
    expect(previewClient.rpc).toHaveBeenCalledWith(
      'academy_admin_preview_configuration_change_v1',
      {
        p_setting_key: 'runtime.ai.enabled', p_expected_revision: '1',
        p_new_value: true, p_reason_code: 'operator.request',
        p_confirmation_digest: 'a'.repeat(64),
        p_required_capability: 'configuration:manage',
      },
    )
    await expect(source.commit('actor-token', { ...request,
      requestId: '10000000-0000-4000-8000-000000000201' }, 'b'.repeat(64)))
      .resolves.toEqual(COMMIT)
    expect(commitClient.rpc).toHaveBeenCalledWith(
      'academy_admin_commit_configuration_change_v1',
      {
        p_setting_key: 'runtime.ai.enabled', p_expected_revision: '1',
        p_new_value: true, p_reason_code: 'operator.request',
        p_request_id: '10000000-0000-4000-8000-000000000201',
        p_confirmation_digest: 'b'.repeat(64),
        p_required_capability: 'configuration:manage',
      },
    )
  })

  it.each([
    ['ADMIN_CONFIGURATION_REVISION_CONFLICT', 'revision_conflict'],
    ['ADMIN_CONFIGURATION_IDEMPOTENCY_CONFLICT', 'idempotency_conflict'],
    ['ADMIN_CONFIGURATION_CONFIRMATION_EXPIRED', 'confirmation_expired'],
    ['database details with no stable marker', 'source_unavailable'],
  ])('maps database marker %s to %s', async (message, code) => {
    const failing = client({ data: null, error: { message } })
    const source = createAdminConfigurationSource({ mutationClientFactory: () => failing })
    await expect(source.commit('token', {
      settingKey: 'runtime.ai.enabled', expectedRevision: '1', newValue: true,
      reasonCode: 'operator.request', requestId: '10000000-0000-4000-8000-000000000201',
    }, 'a'.repeat(64))).rejects.toEqual(new AdminConfigurationSourceError(code))
  })
})

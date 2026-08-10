import { createClient } from '@supabase/supabase-js'
import {
  ADMIN_CONFIGURATION_INTEGRATION_STATUS,
  isAdminConfigurationKey,
  isAdminConfigurationValue,
  sanitizeSavedAdminConfigurationProjection,
} from '../../../src/admin/configurationModel.ts'

const SOURCE_TIMEOUT_MS = 5_000
const POSITIVE_REVISION = /^[1-9]\d*$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class AdminConfigurationSourceError extends Error {
  constructor(code) {
    super(code)
    this.name = 'AdminConfigurationSourceError'
    this.code = code
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function hasExactKeys(value, keys) {
  if (!isRecord(value)) return false
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

function supabaseUrl(env) {
  const raw = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password) return null
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

function serviceConfig(env) {
  const url = supabaseUrl(env)
  const key = (env?.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  return url && key ? { url, key } : null
}

function publicConfig(env) {
  const url = supabaseUrl(env)
  const key = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  return url && key ? { url, key } : null
}

function sourceCode(error) {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ')
  const mappings = [
    ['ADMIN_CONFIGURATION_REVISION_CONFLICT', 'revision_conflict'],
    ['ADMIN_CONFIGURATION_IDEMPOTENCY_CONFLICT', 'idempotency_conflict'],
    ['ADMIN_CONFIGURATION_CONFIRMATION_EXPIRED', 'confirmation_expired'],
    ['ADMIN_CONFIGURATION_CONFIRMATION_REUSED', 'confirmation_reused'],
    ['ADMIN_CONFIGURATION_CONFIRMATION_MISMATCH', 'confirmation_mismatch'],
    ['ADMIN_CONFIGURATION_CONFIRMATION_INVALID', 'confirmation_invalid'],
    ['ADMIN_CONFIGURATION_REQUEST_IN_PROGRESS', 'request_in_progress'],
    ['ADMIN_CONFIGURATION_CROSS_SETTING_INVALID', 'cross_setting_invalid'],
    ['ADMIN_CONFIGURATION_VALUE_INVALID', 'value_invalid'],
    ['ADMIN_CONFIGURATION_UNKNOWN_KEY', 'unknown_key'],
    ['ADMIN_CONFIGURATION_REQUEST_INVALID', 'invalid_request'],
    ['ADMIN_CONFIGURATION_MANAGE_REQUIRED', 'manage_required'],
    ['ADMIN_CONFIGURATION_READ_REQUIRED', 'read_required'],
  ]
  return mappings.find(([marker]) => message.includes(marker))?.[1] ?? 'source_unavailable'
}

function previewProjection(value) {
  if (!hasExactKeys(value, [
    'schemaVersion', 'settingKey', 'currentValue', 'newValue', 'expectedRevision',
    'warningLevel', 'confirmationId', 'confirmationExpiresAt', 'integrationStatus',
  ])) return null
  if (value.schemaVersion !== 2
    || !isAdminConfigurationKey(value.settingKey)
    || !isAdminConfigurationValue(value.settingKey, value.currentValue)
    || !isAdminConfigurationValue(value.settingKey, value.newValue)
    || typeof value.expectedRevision !== 'string'
    || !POSITIVE_REVISION.test(value.expectedRevision)
    || (value.warningLevel !== 'warning' && value.warningLevel !== 'critical')
    || typeof value.confirmationId !== 'string'
    || !UUID.test(value.confirmationId)
    || typeof value.confirmationExpiresAt !== 'string'
    || !Number.isFinite(Date.parse(value.confirmationExpiresAt))
    || value.integrationStatus !== ADMIN_CONFIGURATION_INTEGRATION_STATUS) return null
  return Object.freeze({ ...value })
}

function commitProjection(value) {
  if (!hasExactKeys(value, [
    'schemaVersion', 'settingKey', 'value', 'revision',
    'idempotencyResult', 'integrationStatus',
  ])) return null
  if (value.schemaVersion !== 2
    || !isAdminConfigurationKey(value.settingKey)
    || !isAdminConfigurationValue(value.settingKey, value.value)
    || typeof value.revision !== 'string'
    || !POSITIVE_REVISION.test(value.revision)
    || (value.idempotencyResult !== 'created' && value.idempotencyResult !== 'replayed')
    || value.integrationStatus !== ADMIN_CONFIGURATION_INTEGRATION_STATUS) return null
  return Object.freeze({ ...value })
}

export function createAdminConfigurationSource({
  env,
  fetchImpl,
  serviceClient,
  mutationClientFactory,
} = {}) {
  let reader = serviceClient

  function getReader() {
    if (reader) return reader
    const config = serviceConfig(env)
    if (!config) return null
    reader = createClient(config.url, config.key, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return reader
  }

  function getWriter(accessToken) {
    if (mutationClientFactory) return mutationClientFactory(accessToken)
    const config = publicConfig(env)
    if (!config) return null
    return createClient(config.url, config.key, {
      accessToken: async () => accessToken,
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
  }

  async function invoke(client, rpc, parameters, sanitize) {
    if (!client) throw new AdminConfigurationSourceError('source_unavailable')
    const signal = AbortSignal.timeout(SOURCE_TIMEOUT_MS)
    try {
      const { data, error } = await client.rpc(rpc, parameters).abortSignal(signal)
      if (signal.aborted) throw new AdminConfigurationSourceError('source_timeout')
      if (error) throw new AdminConfigurationSourceError(sourceCode(error))
      const projection = sanitize(data)
      if (!projection) throw new AdminConfigurationSourceError('source_unavailable')
      return projection
    } catch (error) {
      if (error instanceof AdminConfigurationSourceError) throw error
      if (signal.aborted || error?.name === 'TimeoutError') {
        throw new AdminConfigurationSourceError('source_timeout')
      }
      throw new AdminConfigurationSourceError('source_unavailable')
    }
  }

  return Object.freeze({
    async read() {
      return invoke(getReader(), 'academy_admin_read_configuration_v1', {
        p_required_capability: 'configuration:read',
      }, sanitizeSavedAdminConfigurationProjection)
    },
    async preview(accessToken, request, confirmationDigest) {
      return invoke(getWriter(accessToken), 'academy_admin_preview_configuration_change_v1', {
        p_setting_key: request.settingKey,
        p_expected_revision: request.expectedRevision,
        p_new_value: request.newValue,
        p_reason_code: request.reasonCode,
        p_confirmation_digest: confirmationDigest,
        p_required_capability: 'configuration:manage',
      }, previewProjection)
    },
    async commit(accessToken, request, confirmationDigest) {
      return invoke(getWriter(accessToken), 'academy_admin_commit_configuration_change_v1', {
        p_setting_key: request.settingKey,
        p_expected_revision: request.expectedRevision,
        p_new_value: request.newValue,
        p_reason_code: request.reasonCode,
        p_request_id: request.requestId,
        p_confirmation_digest: confirmationDigest,
        p_required_capability: 'configuration:manage',
      }, commitProjection)
    },
  })
}

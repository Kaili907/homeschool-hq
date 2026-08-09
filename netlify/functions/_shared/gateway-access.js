import { createClient } from '@supabase/supabase-js'
import { createSupabaseOperationalTelemetryStore } from '../../../src/telemetry/supabaseOperationalTelemetry.ts'
import { reject } from './http.js'

const ACCESS_TIMEOUT_MS = 5_000
const MAX_DAILY_LIMIT = 100_000

function serviceConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const serviceRoleKey = (env?.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || !serviceRoleKey) return null
    return { url: url.toString().replace(/\/+$/, ''), serviceRoleKey }
  } catch {
    return null
  }
}

export function dailyLimit(env, name, fallback) {
  const raw = env?.[name]
  if (typeof raw !== 'string' || !/^\d+$/.test(raw.trim())) return fallback
  const parsed = Number(raw.trim())
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= MAX_DAILY_LIMIT ? parsed : fallback
}

export function createGatewayAccess({ env, fetchImpl, client } = {}) {
  let serviceClient = client

  function getClient() {
    if (serviceClient) return serviceClient
    const config = serviceConfig(env)
    if (!config) reject(503, 'service_unavailable')
    serviceClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return serviceClient
  }

  return {
    createOperationalTelemetryStore() {
      return createSupabaseOperationalTelemetryStore(getClient())
    },

    async requireEntitlement(userId) {
      const signal = AbortSignal.timeout(ACCESS_TIMEOUT_MS)
      const { data, error } = await getClient()
        .from('academy_household_memberships')
        .select('household_id, academy_households!inner(status)')
        .eq('user_id', userId)
        .eq('status', 'active')
        .eq('academy_households.status', 'active')
        .is('revoked_at', null)
        .limit(2)
        .abortSignal(signal)

      if (signal.aborted) reject(504, 'upstream_timeout')
      if (error) reject(503, 'service_unavailable')
      if (!Array.isArray(data) || data.length === 0) reject(403, 'not_entitled')
      const householdIds = [...new Set(data.map((row) => row?.household_id))]
      if (
        householdIds.length === 0 ||
        householdIds.some((householdId) => typeof householdId !== 'string' || householdId === '')
      ) {
        reject(503, 'service_unavailable')
      }
      return householdIds.length === 1
        ? { householdRef: householdIds[0], householdAttribution: 'resolved' }
        : { householdRef: null, householdAttribution: 'ambiguous' }
    },

    async consumeUsage(userId, endpoint, limit) {
      const signal = AbortSignal.timeout(ACCESS_TIMEOUT_MS)
      const { data, error } = await getClient()
        .rpc('academy_consume_gateway_usage', {
          p_user_id: userId,
          p_endpoint: endpoint,
          p_limit: limit,
        })
        .abortSignal(signal)

      if (signal.aborted) reject(504, 'upstream_timeout')
      if (error) reject(503, 'service_unavailable')
      if (data !== true) reject(429, 'usage_limit')
    },

    async recordProviderUsage(record) {
      const signal = AbortSignal.timeout(ACCESS_TIMEOUT_MS)
      const { error } = await getClient()
        .rpc('academy_record_provider_usage', {
          p_execution_key: record.requestKey,
          p_occurred_at: record.occurredAt,
          p_account_id: record.accountRef,
          p_household_id: record.householdRef,
          p_household_attribution: record.householdAttribution,
          p_app_version: record.appVersion,
          p_engine_version: record.engineVersion,
          p_curriculum_version: record.curriculumVersion,
          p_engine: record.engine,
          p_provider: record.provider,
          p_provider_product_id: record.providerProductId,
          p_provider_model_id: record.providerModelId,
          p_logical_model_tier: record.logicalModelTier ?? null,
          p_input_tokens: record.inputTokens ?? null,
          p_output_tokens: record.outputTokens ?? null,
          p_cached_input_read_tokens: record.cachedInputReadTokens ?? null,
          p_cached_input_write_tokens: record.cachedInputWriteTokens ?? null,
          p_tts_characters: record.ttsCharacters ?? null,
          p_latency_ms: record.latencyMs,
          p_result: record.result,
          p_result_reason_code: record.resultReasonCode ?? null,
          p_billing_disposition: record.billingDisposition,
        })
        .abortSignal(signal)

      if (signal.aborted) reject(504, 'upstream_timeout')
      if (error?.message?.includes?.('reconciliation_conflict')) {
        reject(409, 'reconciliation_conflict')
      }
      if (error) reject(503, 'service_unavailable')
    },

    async readProviderUsageCosts({ limit = 100, before = new Date().toISOString() } = {}) {
      const signal = AbortSignal.timeout(ACCESS_TIMEOUT_MS)
      const { data, error } = await getClient()
        .rpc('academy_read_provider_usage_costs', {
          p_limit: limit,
          p_before: before,
        })
        .abortSignal(signal)

      if (signal.aborted) reject(504, 'upstream_timeout')
      if (error) reject(503, 'service_unavailable')
      return data
    },

    async aggregateProviderUsageCosts({ start, endExclusive }) {
      const signal = AbortSignal.timeout(ACCESS_TIMEOUT_MS)
      const { data, error } = await getClient()
        .rpc('academy_aggregate_provider_usage_costs_v1', {
          p_start: start,
          p_end_exclusive: endExclusive,
          p_required_capability: 'costs:read',
          p_group_limit: 384,
        })
        .abortSignal(signal)

      if (signal.aborted) reject(504, 'upstream_timeout')
      if (error) reject(503, 'service_unavailable')
      return data
    },
  }
}

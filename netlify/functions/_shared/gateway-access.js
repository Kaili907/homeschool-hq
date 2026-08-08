import { createClient } from '@supabase/supabase-js'
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
    async requireEntitlement(userId) {
      const signal = AbortSignal.timeout(ACCESS_TIMEOUT_MS)
      const { data, error } = await getClient()
        .from('academy_household_memberships')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .is('revoked_at', null)
        .limit(1)
        .abortSignal(signal)

      if (signal.aborted) reject(504, 'upstream_timeout')
      if (error) reject(503, 'service_unavailable')
      if (!Array.isArray(data) || data.length === 0) reject(403, 'not_entitled')
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
          p_request_key: record.requestKey,
          p_occurred_at: record.occurredAt,
          p_user_id: record.userId,
          p_engine: record.engine,
          p_provider: record.provider,
          p_logical_model_tier: record.logicalModelTier ?? null,
          p_provider_product: record.providerProduct,
          p_voice_reference: record.voiceReference ?? null,
          p_input_tokens: record.inputTokens ?? null,
          p_output_tokens: record.outputTokens ?? null,
          p_cache_read_input_tokens: record.cacheReadInputTokens ?? null,
          p_cache_write_input_tokens: record.cacheWriteInputTokens ?? null,
          p_characters: record.characters ?? null,
          p_latency_ms: record.latencyMs,
          p_status: record.status,
          p_billing_basis: record.billingBasis,
        })
        .abortSignal(signal)

      if (signal.aborted) reject(504, 'upstream_timeout')
      if (error) reject(503, 'service_unavailable')
    },
  }
}

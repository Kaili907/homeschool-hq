import { createClient } from '@supabase/supabase-js'

const READ_TIMEOUT_MS = 5_000

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

export class AdminEnginePerformanceReadError extends Error {
  constructor(code) {
    super(code)
    this.name = 'AdminEnginePerformanceReadError'
    this.code = code
  }
}

/** Server-only access to the canonical ADMIN-2 operational ledger. */
export function createAdminEnginePerformanceReader({ env, fetchImpl, client } = {}) {
  let serviceClient = client

  function getClient() {
    if (serviceClient) return serviceClient
    const config = serviceConfig(env)
    if (!config) throw new AdminEnginePerformanceReadError('source_unavailable')
    serviceClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return serviceClient
  }

  return Object.freeze({
    async list(limit) {
      const signal = AbortSignal.timeout(READ_TIMEOUT_MS)
      try {
        const builder = getClient().rpc('academy_list_operational_events_v2', {
          p_scope: null,
          p_household_id: null,
          p_learner_id: null,
          p_limit: limit,
          p_required_capability: 'engines:read',
        })
        const { data, error } = typeof builder.abortSignal === 'function'
          ? await builder.abortSignal(signal)
          : await builder
        if (signal.aborted) throw new AdminEnginePerformanceReadError('source_timeout')
        if (error) throw new AdminEnginePerformanceReadError('source_unavailable')
        return data
      } catch (error) {
        if (error instanceof AdminEnginePerformanceReadError) throw error
        throw new AdminEnginePerformanceReadError(signal.aborted ? 'source_timeout' : 'source_unavailable')
      }
    },
  })
}

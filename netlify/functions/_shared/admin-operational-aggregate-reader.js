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

export class AdminOperationalAggregateReadError extends Error {
  constructor(code) {
    super(code)
    this.name = 'AdminOperationalAggregateReadError'
    this.code = code
  }
}

function isAggregateGroupLimit(error) {
  if (!error || typeof error !== 'object') return false
  if (error.code === '54000') return true
  return [error.message, error.details, error.hint].some((value) =>
    typeof value === 'string' && value.includes('OPERATIONAL_TELEMETRY_AGGREGATE_GROUP_LIMIT'))
}

/** Server-only adapter over the bounded, raw-row-free telemetry aggregate. */
export function createAdminOperationalAggregateReader({ env, fetchImpl, client } = {}) {
  let serviceClient = client

  function getClient() {
    if (serviceClient) return serviceClient
    const config = serviceConfig(env)
    if (!config) throw new AdminOperationalAggregateReadError('source_unavailable')
    serviceClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return serviceClient
  }

  return Object.freeze({
    async aggregate({ start, endExclusive, engine = null, engineVersion = null, courseRef = null, unitRef = null, capability }) {
      const signal = AbortSignal.timeout(READ_TIMEOUT_MS)
      try {
        const builder = getClient().rpc('academy_aggregate_operational_events_v2', {
          p_start: start,
          p_end: endExclusive,
          p_engine: engine,
          p_engine_version: engineVersion,
          p_course_ref: courseRef,
          p_unit_ref: unitRef,
          p_required_capability: capability,
        })
        const { data, error } = typeof builder.abortSignal === 'function'
          ? await builder.abortSignal(signal)
          : await builder
        if (signal.aborted) throw new AdminOperationalAggregateReadError('source_timeout')
        if (error) {
          throw new AdminOperationalAggregateReadError(
            isAggregateGroupLimit(error) ? 'source_group_incomplete' : 'source_unavailable',
          )
        }
        return data
      } catch (error) {
        if (error instanceof AdminOperationalAggregateReadError) throw error
        throw new AdminOperationalAggregateReadError(
          signal.aborted ? 'source_timeout' : 'source_unavailable',
        )
      }
    },
  })
}

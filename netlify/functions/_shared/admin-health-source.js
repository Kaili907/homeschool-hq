import { createClient } from '@supabase/supabase-js'
import {
  OPERATIONAL_TELEMETRY_MAX_READ_LIMIT,
  decodeStoredOperationalEvents,
} from '../../../src/telemetry/operationalTelemetry.ts'
import { envFlagEnabled } from './http.js'

const HEALTH_READ_TIMEOUT_MS = 5_000

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

/** Exact-default-off server gates are authoritative disabled evidence. */
export function disabledHealthEngines(env) {
  const disabled = new Set()
  if (!envFlagEnabled(env, 'ACADEMY_STUDY_ENABLED')) disabled.add('study')
  if (!envFlagEnabled(env, 'ACADEMY_TTS_ENABLED')) disabled.add('tts')
  if (!envFlagEnabled(env, 'ACADEMY_AI_ENABLED')) disabled.add('gateway')
  return disabled
}

/** Service-only adapter over the canonical ADMIN-2 telemetry read RPC. */
export function createAdminHealthSource({ env, fetchImpl, client } = {}) {
  let serviceClient = client

  function getClient() {
    if (serviceClient) return serviceClient
    const config = serviceConfig(env)
    if (!config) throw new Error('health_source_unavailable')
    serviceClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return serviceClient
  }

  return Object.freeze({
    async list() {
      const signal = AbortSignal.timeout(HEALTH_READ_TIMEOUT_MS)
      const { data, error } = await getClient()
        .rpc('academy_list_operational_events_v2', {
          p_scope: null,
          p_household_id: null,
          p_learner_id: null,
          p_limit: OPERATIONAL_TELEMETRY_MAX_READ_LIMIT,
          p_required_capability: 'engines:read',
        })
        .abortSignal(signal)
      if (signal.aborted || error) throw new Error('health_source_unavailable')
      const decoded = decodeStoredOperationalEvents(data)
      return Object.freeze({
        events: decoded.events,
        rejectedRows: decoded.rejectedRows,
        sourceTruncated: Array.isArray(data) && data.length === OPERATIONAL_TELEMETRY_MAX_READ_LIMIT,
      })
    },
  })
}

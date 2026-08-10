import { createClient } from '@supabase/supabase-js'
import { createSupabaseOperationalTelemetryStore } from '../../../../src/telemetry/supabaseOperationalTelemetry.ts'
import {
  createServerOperationalTelemetryWriter,
  resolveTrustedAppVersion,
  resolveTrustedEngineVersion,
} from '../operational-telemetry-writer.js'
import { createStudySessionTelemetryOutboxStore } from './outbox-store.js'
import { createStudySessionTelemetryWorker } from './worker.js'

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

/**
 * Production composition only. Invocation authorization and scheduling remain
 * an explicit deployment concern; this module exposes no public HTTP handler.
 */
export function createProductionStudySessionTelemetryWorker({
  env = process.env,
  fetchImpl,
  client,
} = {}) {
  resolveTrustedAppVersion(env)
  resolveTrustedEngineVersion(env, 'study')
  let serviceClient = client
  if (!serviceClient) {
    const config = serviceConfig(env)
    if (!config) throw new Error('study_session_telemetry_not_ready')
    serviceClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
  }
  const outbox = createStudySessionTelemetryOutboxStore(serviceClient)
  const telemetryStore = createSupabaseOperationalTelemetryStore(serviceClient)
  const telemetry = createServerOperationalTelemetryWriter({
    env,
    store: telemetryStore,
    resolveScope: async (trusted) => ({
      scope: 'household',
      householdRef: trusted.householdRef,
      learnerRef: null,
    }),
    resolveCurriculumVersion: async (_facts, trusted) =>
      trusted.curriculumVersion,
  })
  return createStudySessionTelemetryWorker({ outbox, telemetry })
}

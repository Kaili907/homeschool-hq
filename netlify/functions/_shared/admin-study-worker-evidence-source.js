import { createClient } from '@supabase/supabase-js'
import { decodeStudyWorkerEvidence } from '../../../src/admin/studyOperationsModel.ts'

const WORKER_EVIDENCE_TIMEOUT_MS = 5_000

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

/** Service-only adapter over the durable, content-free worker status RPC. */
export function createAdminStudyWorkerEvidenceSource({
  env,
  fetchImpl,
  client,
  now = () => new Date(),
} = {}) {
  let serviceClient = client

  function getClient() {
    if (serviceClient) return serviceClient
    const config = serviceConfig(env)
    if (!config) throw new Error('worker_evidence_source_unavailable')
    serviceClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return serviceClient
  }

  return Object.freeze({
    async read() {
      const observedAt = now().toISOString()
      const signal = AbortSignal.timeout(WORKER_EVIDENCE_TIMEOUT_MS)
      const { data, error } = await getClient()
        .rpc('academy_study_adult_review_worker_status_v1', {
          p_observed_at: observedAt,
        })
        .abortSignal(signal)
      if (signal.aborted || error) throw new Error('worker_evidence_source_unavailable')
      const evidence = decodeStudyWorkerEvidence(data)
      if (!evidence) throw new Error('worker_evidence_source_unavailable')
      return evidence
    },
  })
}

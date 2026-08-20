import { errorResponse } from './http.js'
import { verifySupabaseBearer } from './supabase-auth.js'

const GUARDIAN_AUTHORIZATION_TIMEOUT_MS = 3_000
const GUARDIAN_ACTION_RPC = 'academy_study_authorize_guardian_action_v1'
const KNOWN_CAPABILITIES = new Set(['study:production-readiness:read'])

function publicAuthConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (
      url.protocol !== 'https:' || url.username || url.password ||
      url.search || url.hash || !anonKey
    ) return null
    return { url: url.toString().replace(/\/+$/, ''), anonKey }
  } catch {
    return null
  }
}

/** Verified-bearer, RLS-independent guardian authorization for pre-session reads. */
export function createStudyGuardianAuthorization(options = {}) {
  const env = options.env ?? process.env
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const verify = options.authVerifier ?? verifySupabaseBearer
  const config = publicAuthConfig(env)

  return Object.freeze({
    async require(event, requiredCapability) {
      if (!KNOWN_CAPABILITIES.has(requiredCapability)) {
        return { ok: false, response: errorResponse(403, 'guardian_access_denied') }
      }
      const auth = await verify(event, { env, fetchImpl, timeoutMs: 3_000 })
      if (!auth.ok) return auth
      if (typeof auth.accessToken !== 'string' || auth.accessToken === '' || !config) {
        return { ok: false, response: errorResponse(503, 'authorization_unavailable') }
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), GUARDIAN_AUTHORIZATION_TIMEOUT_MS)
      let response
      try {
        response = await fetchImpl(`${config.url}/rest/v1/rpc/${GUARDIAN_ACTION_RPC}`, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            apikey: config.anonKey,
            Authorization: `Bearer ${auth.accessToken}`,
            'content-type': 'application/json',
            accept: 'application/json',
          },
          body: JSON.stringify({ p_required_capability: requiredCapability }),
        })
      } catch {
        return { ok: false, response: errorResponse(503, 'authorization_unavailable') }
      } finally {
        clearTimeout(timer)
      }

      if (response.status === 401) {
        return { ok: false, response: errorResponse(401, 'unauthenticated') }
      }
      if (response.status === 403) {
        return { ok: false, response: errorResponse(403, 'guardian_access_denied') }
      }
      if (!response.ok) {
        return { ok: false, response: errorResponse(503, 'authorization_unavailable') }
      }
      let result
      try {
        result = await response.json()
      } catch {
        return { ok: false, response: errorResponse(503, 'authorization_unavailable') }
      }
      if (
        result?.schemaVersion !== 1 ||
        !['authorized', 'denied'].includes(result?.status) ||
        Object.keys(result).length !== 2
      ) {
        return { ok: false, response: errorResponse(503, 'authorization_unavailable') }
      }
      if (result.status !== 'authorized') {
        return { ok: false, response: errorResponse(403, 'guardian_access_denied') }
      }
      return {
        ok: true,
        principal: Object.freeze({ userId: auth.user.id }),
        accessToken: auth.accessToken,
      }
    },
  })
}

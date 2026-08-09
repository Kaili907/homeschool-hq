import { createClient } from '@supabase/supabase-js'
import {
  ADMIN_CONTRACT_VERSION,
  ADMIN_ROLE_CAPABILITIES,
  hasAdminCapability,
} from '../../../src/admin/contracts.ts'
import { errorResponse, isTimeoutError } from './http.js'
import { verifySupabaseBearer } from './supabase-auth.js'

const ADMIN_ROLE_LOOKUP_TIMEOUT_MS = 5_000
const KNOWN_CAPABILITIES = new Set(Object.values(ADMIN_ROLE_CAPABILITIES).flat())

function publicAuthConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const anonKey = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || !anonKey) return null
    return { url: url.toString().replace(/\/+$/, ''), anonKey }
  } catch {
    return null
  }
}

function resolvePrincipal(userId, row) {
  if (
    !row ||
    typeof row !== 'object' ||
    Object.keys(row).length !== 1 ||
    !Object.hasOwn(ADMIN_ROLE_CAPABILITIES, row.role)
  ) {
    return null
  }
  return Object.freeze({
    userId,
    role: row.role,
    capabilities: ADMIN_ROLE_CAPABILITIES[row.role],
  })
}

/**
 * Server-only authorization boundary for every Admin Console endpoint.
 *
 * Supabase Auth verifies the bearer first. The same pinned access token invokes
 * the fixed-search-path database function, which derives auth.uid() and returns
 * only a current role. Request bodies, query strings, JWT metadata, and browser
 * capability arrays are never authority sources.
 */
export function createAdminAuthorization({
  env,
  fetchImpl,
  client,
  clientFactory,
  authVerifier,
} = {}) {
  const verify = authVerifier ?? verifySupabaseBearer

  function getClient(accessToken) {
    if (client) return client
    if (clientFactory) return clientFactory(accessToken)
    const config = publicAuthConfig(env)
    if (!config) return null
    return createClient(config.url, config.anonKey, {
      accessToken: async () => accessToken,
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
  }

  async function lookup(userId, accessToken) {
    const database = getClient(accessToken)
    if (!database) return { ok: false, response: errorResponse(503, 'authorization_unavailable') }

    const signal = AbortSignal.timeout(ADMIN_ROLE_LOOKUP_TIMEOUT_MS)
    try {
      const { data, error } = await database
        .rpc('academy_admin_authorization_v2')
        .abortSignal(signal)

      if (signal.aborted) {
        return { ok: false, response: errorResponse(504, 'upstream_timeout') }
      }
      if (error) return { ok: false, response: errorResponse(503, 'authorization_unavailable') }
      if (!Array.isArray(data) || data.length === 0) {
        return { ok: false, response: errorResponse(403, 'admin_access_denied') }
      }
      if (data.length !== 1) {
        return { ok: false, response: errorResponse(503, 'authorization_unavailable') }
      }
      const principal = resolvePrincipal(userId, data[0])
      return principal
        ? { ok: true, principal }
        : { ok: false, response: errorResponse(503, 'authorization_unavailable') }
    } catch (error) {
      const timedOut = isTimeoutError(error, signal)
      return {
        ok: false,
        response: errorResponse(
          timedOut ? 504 : 503,
          timedOut ? 'upstream_timeout' : 'authorization_unavailable',
        ),
      }
    }
  }

  return Object.freeze({
    async require(event, requiredCapability = 'overview:read') {
      if (!KNOWN_CAPABILITIES.has(requiredCapability)) {
        return { ok: false, response: errorResponse(403, 'admin_access_denied') }
      }
      const auth = await verify(event, { fetchImpl, env })
      if (!auth.ok) return auth
      if (typeof auth.accessToken !== 'string' || auth.accessToken === '') {
        return { ok: false, response: errorResponse(503, 'authorization_unavailable') }
      }
      const authorization = await lookup(auth.user.id, auth.accessToken)
      if (!authorization.ok) return authorization
      if (!hasAdminCapability(authorization.principal.role, requiredCapability)) {
        return { ok: false, response: errorResponse(403, 'admin_access_denied') }
      }
      // The pinned bearer is server-internal authority for downstream RLS
      // reads. Browser wire projections deliberately omit it.
      return { ...authorization, accessToken: auth.accessToken }
    },
  })
}

export function adminAuthorizationWire(principal) {
  return Object.freeze({
    contractVersion: ADMIN_CONTRACT_VERSION,
    status: 'authorized',
    role: principal.role,
    capabilities: principal.capabilities,
  })
}

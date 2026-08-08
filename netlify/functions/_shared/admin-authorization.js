import { createClient } from '@supabase/supabase-js'
import { errorResponse, isTimeoutError } from './http.js'
import { verifySupabaseBearer } from './supabase-auth.js'

const ADMIN_ROLE_LOOKUP_TIMEOUT_MS = 5_000

export const ADMIN_ROLE_CAPABILITIES = Object.freeze({
  viewer: Object.freeze(['admin:read']),
  admin: Object.freeze(['admin:read', 'admin:operate']),
  owner: Object.freeze([
    'admin:read',
    'admin:operate',
    'admin:roles:manage',
    'admin:config:manage',
    'admin:curriculum:publish',
    'admin:releases:manage',
  ]),
})

const KNOWN_CAPABILITIES = new Set(Object.values(ADMIN_ROLE_CAPABILITIES).flat())

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

function principalFor(userId, row) {
  if (
    !row ||
    typeof row !== 'object' ||
    row.status !== 'active' ||
    row.revoked_at !== null ||
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
 * Supabase Auth verifies the bearer identity first. Authority is then loaded
 * from the durable database assignment for that verified user id. Request
 * bodies, query strings, headers, and JWT metadata are never role sources.
 */
export function createAdminAuthorization({ env, fetchImpl, client, authVerifier } = {}) {
  let serviceClient = client
  const verify = authVerifier ?? verifySupabaseBearer

  function getClient() {
    if (serviceClient) return serviceClient
    const config = serviceConfig(env)
    if (!config) return null
    serviceClient = createClient(config.url, config.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
    return serviceClient
  }

  async function lookup(userId) {
    const database = getClient()
    if (!database) return { ok: false, response: errorResponse(503, 'authorization_unavailable') }

    const signal = AbortSignal.timeout(ADMIN_ROLE_LOOKUP_TIMEOUT_MS)
    try {
      const { data, error } = await database
        .from('academy_admin_role_assignments')
        .select('role,status,revoked_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .is('revoked_at', null)
        .limit(2)
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
      const principal = principalFor(userId, data[0])
      return principal
        ? { ok: true, principal }
        : { ok: false, response: errorResponse(503, 'authorization_unavailable') }
    } catch (error) {
      return {
        ok: false,
        response: errorResponse(
          isTimeoutError(error, signal) ? 504 : 503,
          isTimeoutError(error, signal) ? 'upstream_timeout' : 'authorization_unavailable',
        ),
      }
    }
  }

  return Object.freeze({
    async require(event, requiredCapability = 'admin:read') {
      if (!KNOWN_CAPABILITIES.has(requiredCapability)) {
        return { ok: false, response: errorResponse(403, 'admin_access_denied') }
      }
      const auth = await verify(event, { fetchImpl, env })
      if (!auth.ok) return auth
      const authorization = await lookup(auth.user.id)
      if (!authorization.ok) return authorization
      if (!authorization.principal.capabilities.includes(requiredCapability)) {
        return { ok: false, response: errorResponse(403, 'admin_access_denied') }
      }
      return authorization
    },
  })
}

export function adminAuthorizationWire(principal) {
  return Object.freeze({
    schemaVersion: 1,
    role: principal.role,
    capabilities: principal.capabilities,
  })
}

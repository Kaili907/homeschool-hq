import { createClient } from '@supabase/supabase-js'
import {
  sanitizeAdminAccessMutationResult,
  sanitizeAdminAccessProjection,
} from '../../../src/admin/accessModel.ts'

const SOURCE_TIMEOUT_MS = 5_000

export class AdminAccessSourceError extends Error {
  constructor(code) {
    super(code)
    this.name = 'AdminAccessSourceError'
    this.code = code
  }
}
function publicConfig(env) {
  const rawUrl = (env?.SUPABASE_URL || env?.VITE_SUPABASE_URL || '').trim()
  const key = (env?.SUPABASE_ANON_KEY || env?.VITE_SUPABASE_ANON_KEY || '').trim()
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || url.username || url.password || !key) return null
    return { url: url.toString().replace(/\/+$/, ''), key }
  } catch {
    return null
  }
}

function sourceCode(error) {
  const message = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ')
  const mappings = [
    ['ADMIN_ACCESS_SOLE_OWNER_PROTECTED', 'sole_owner_protected'],
    ['ADMIN_ACCESS_IDEMPOTENCY_CONFLICT', 'idempotency_conflict'],
    ['ADMIN_ACCESS_REQUEST_IN_PROGRESS', 'revision_conflict'],
    ['ADMIN_ACCESS_REVISION_CONFLICT', 'revision_conflict'],
    ['ADMIN_ACCESS_NO_CHANGE', 'invalid_request'],
    ['ADMIN_ACCESS_REQUEST_INVALID', 'invalid_request'],
    ['ADMIN_ACCESS_MANAGE_REQUIRED', 'manage_required'],
    ['ADMIN_ACCESS_READ_REQUIRED', 'read_required'],
  ]
  return mappings.find(([marker]) => message.includes(marker))?.[1] ?? 'source_unavailable'
}

export function createAdminAccessSource({ env, fetchImpl, clientFactory } = {}) {
  function getClient(accessToken) {
    if (clientFactory) return clientFactory(accessToken)
    const config = publicConfig(env)
    if (!config) return null
    return createClient(config.url, config.key, {
      accessToken: async () => accessToken,
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
      global: { fetch: fetchImpl },
    })
  }

  async function invoke(accessToken, rpc, parameters, sanitize) {
    const client = getClient(accessToken)
    if (!client) throw new AdminAccessSourceError('source_unavailable')
    const signal = AbortSignal.timeout(SOURCE_TIMEOUT_MS)
    try {
      const builder = client.rpc(rpc, parameters)
      const { data, error } = typeof builder.abortSignal === 'function'
        ? await builder.abortSignal(signal)
        : await builder
      if (signal.aborted) throw new AdminAccessSourceError('source_timeout')
      if (error) throw new AdminAccessSourceError(sourceCode(error))
      const projection = sanitize(data)
      if (!projection) throw new AdminAccessSourceError('source_unavailable')
      return projection
    } catch (error) {
      if (error instanceof AdminAccessSourceError) throw error
      throw new AdminAccessSourceError(
        signal.aborted || error?.name === 'TimeoutError'
          ? 'source_timeout' : 'source_unavailable',
      )
    }
  }

  return Object.freeze({
    read(accessToken) {
      return invoke(accessToken, 'academy_admin_read_access_v1', {
        p_required_capability: 'overview:read',
      }, sanitizeAdminAccessProjection)
    },
    mutate(accessToken, request) {
      return invoke(accessToken, 'academy_admin_mutate_access_v1', {
        p_target_assignment_ref: request.assignmentRef,
        p_expected_revision: request.expectedRevision,
        p_new_role: request.newRole ?? null,
        p_reason_code: request.reasonCode,
        p_request_id: request.requestId,
        p_required_capability: 'admin_roles:manage',
      }, sanitizeAdminAccessMutationResult)
    },
  })
}

import { createClient } from '@supabase/supabase-js'
import {
  SAFETY_OPERATIONS_SCHEMA_VERSION,
  buildSafetyOperationsModel,
} from '../../../src/admin/safetyOperationsModel.ts'

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

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function cursorFor(event) {
  return Buffer.from(JSON.stringify({ at: event.occurredAt, ref: event.eventRef }), 'utf8').toString('base64url')
}

export function decodeSafetyCursor(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (
      !isRecord(decoded)
      || Object.keys(decoded).sort().join(',') !== 'at,ref'
      || typeof decoded.at !== 'string'
      || decoded.at.length > 40
      || Number.isNaN(Date.parse(decoded.at))
      || typeof decoded.ref !== 'string'
      || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(decoded.ref)
    ) return null
    return { occurredAt: decoded.at, eventRef: decoded.ref }
  } catch {
    return null
  }
}

export function createAdminSafetyReader({ env, fetchImpl, client } = {}) {
  let serviceClient = client

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

  return Object.freeze({
    async read({ limit, cursor, householdRef, learnerRef }) {
      const database = getClient()
      if (!database) throw new Error('safety_source_unavailable')
      const signal = AbortSignal.timeout(READ_TIMEOUT_MS)
      const { data, error } = await database
        .rpc('academy_admin_read_safety_operations_v1', {
          p_limit: limit + 1,
          p_before_at: cursor?.occurredAt ?? null,
          p_before_ref: cursor?.eventRef ?? null,
          p_household_id: householdRef ?? null,
          p_learner_id: learnerRef ?? null,
          p_required_capability: 'safety:read',
        })
        .abortSignal(signal)
      if (signal.aborted || error || !isRecord(data) || !Array.isArray(data.events) || data.events.length > limit + 1) {
        throw new Error('safety_source_unavailable')
      }

      const hasMore = data.events.length > limit
      const visibleRows = data.events.slice(0, limit)
      const candidate = {
        schemaVersion: SAFETY_OPERATIONS_SCHEMA_VERSION,
        observedAt: data.observedAt,
        summary: data.summary,
        sources: data.sources,
        operationalTelemetry: data.operationalTelemetry,
        events: visibleRows,
        page: { limit, nextCursor: null },
      }
      const model = buildSafetyOperationsModel(candidate)
      const lookahead = hasMore
        ? buildSafetyOperationsModel({ ...candidate, events: [data.events[limit]] })
        : null
      if (
        model.observedAt === null
        || model.events.length !== visibleRows.length
        || model.sources.length !== data.sources?.length
        || Object.values(model.summary).some((metric) => metric.status !== 'available')
        || (lookahead !== null && lookahead.events.length !== 1)
      ) {
        throw new Error('safety_source_unavailable')
      }
      const events = model.events
      return Object.freeze({
        schemaVersion: SAFETY_OPERATIONS_SCHEMA_VERSION,
        observedAt: model.observedAt,
        summary: model.summary,
        sources: model.sources,
        operationalTelemetry: model.operationalTelemetry,
        events,
        page: {
          limit,
          nextCursor: hasMore && events.length > 0 ? cursorFor(events[events.length - 1]) : null,
        },
      })
    },
  })
}

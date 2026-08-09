import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import {
  SAFETY_OPERATIONS_EVENT_LIMIT,
  SAFETY_OPERATIONS_SCHEMA_VERSION,
  type SafetyOperationsReadState,
  type SafetyOperationsSnapshotV1,
} from './safetyOperationsModel'

export const ADMIN_SAFETY_OPERATIONS_ENDPOINT = '/api/admin/v1/safety-operations'
export const ADMIN_SAFETY_OPERATIONS_TIMEOUT_MS = 5_000

type FetchLike = (url: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export interface ReadAdminSafetyOperationsOptions {
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
  readonly limit?: number
  readonly cursor?: string
  readonly householdRef?: string
  readonly learnerRef?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSnapshot(value: unknown): value is SafetyOperationsSnapshotV1 {
  if (!isRecord(value)) return false
  const keys = Object.keys(value).sort()
  if (keys.join(',') !== 'events,observedAt,operationalTelemetry,page,schemaVersion,sources,summary') return false
  if (
    value.schemaVersion !== SAFETY_OPERATIONS_SCHEMA_VERSION
    || typeof value.observedAt !== 'string'
    || !isRecord(value.summary)
    || !Array.isArray(value.sources)
    || !Array.isArray(value.events)
    || value.events.length > SAFETY_OPERATIONS_EVENT_LIMIT
    || !isRecord(value.operationalTelemetry)
    || !isRecord(value.page)
  ) return false
  const status = value.operationalTelemetry.status
  return (
    (status === 'available' || status === 'unavailable')
    && Number.isSafeInteger(value.page.limit)
    && Number(value.page.limit) >= 1
    && Number(value.page.limit) <= SAFETY_OPERATIONS_EVENT_LIMIT
    && (value.page.nextCursor === null || typeof value.page.nextCursor === 'string')
  )
}

function safeReference(value: string | undefined): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}

export async function readAdminSafetyOperations(
  options: ReadAdminSafetyOperationsOptions = {},
): Promise<SafetyOperationsReadState> {
  const getAccessToken = options.getAccessToken ?? getGatewayAccessToken
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init))
  const limit = options.limit ?? 50
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > SAFETY_OPERATIONS_EVENT_LIMIT) {
    return { status: 'unavailable', reasonCode: 'read_failed' }
  }
  if (
    (options.cursor !== undefined && (options.cursor.length < 1 || options.cursor.length > 512))
    || (options.householdRef !== undefined && !safeReference(options.householdRef))
    || (options.learnerRef !== undefined && (!safeReference(options.learnerRef) || !options.householdRef))
  ) return { status: 'unavailable', reasonCode: 'read_failed' }

  let accessToken: string | null
  try {
    accessToken = await getAccessToken()
  } catch {
    return { status: 'unavailable', reasonCode: 'read_failed' }
  }
  if (!accessToken || options.signal?.aborted) return { status: 'unavailable', reasonCode: 'read_failed' }

  const query = new URLSearchParams({ limit: String(limit) })
  if (options.cursor) query.set('cursor', options.cursor)
  if (options.householdRef) query.set('household', options.householdRef)
  if (options.learnerRef) query.set('learner', options.learnerRef)

  const controller = new AbortController()
  const cancel = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', cancel, { once: true })
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? ADMIN_SAFETY_OPERATIONS_TIMEOUT_MS,
  )
  try {
    const response = await fetchImpl(`${ADMIN_SAFETY_OPERATIONS_ENDPOINT}?${query}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (response.status !== 200) {
      return { status: 'unavailable', reasonCode: response.status >= 500 ? 'source_unavailable' : 'read_failed' }
    }
    const snapshot = await response.json()
    return isSnapshot(snapshot)
      ? { status: 'ready', snapshot }
      : { status: 'unavailable', reasonCode: 'read_failed' }
  } catch {
    return { status: 'unavailable', reasonCode: 'source_unavailable' }
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', cancel)
  }
}

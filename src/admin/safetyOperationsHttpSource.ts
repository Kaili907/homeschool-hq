import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from './adminDependencyTimeout'
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

function exact(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const allowed = new Set([...required, ...optional])
  return required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => allowed.has(key))
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function reference(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value)
}

function version(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._+-]{0,127}$/.test(value)
}

const SUMMARY_KEYS = [
  'openSafetyStops', 'resolvedSafetyStops', 'adultReviewPending',
  'failClosedEvents', 'safetyStopEvents', 'fallbackRejectionEvents',
  'unresolvedSafetyConditions',
] as const
const SOURCES = new Set(['study-safety-stops', 'study-adult-review', 'study-safety-monitoring', 'operational-telemetry'])
const ENGINES = new Set(['tutor', 'study', 'assessment', 'curriculum', 'jarvis', 'tts', 'gateway', 'sync'])
const CATEGORIES = new Set(['safety-stop', 'adult-review', 'fail-closed', 'fallback-rejection'])
const EVENT_STATES = new Set(['open', 'resolved', 'pending-review', 'fail-closed', 'rejected', 'unknown'])
const RESOLUTION_STATES = new Set(['unresolved', 'pending-adult-review', 'resolved', 'not-applicable', 'unknown'])

function metric(value: unknown): boolean {
  if (!isRecord(value) || (value.status !== 'available' && value.status !== 'unavailable')) return false
  return value.status === 'available'
    ? exact(value, ['status', 'value']) && Number.isSafeInteger(value.value) && Number(value.value) >= 0
    : exact(value, ['status'])
}

function safeEvent(value: unknown): boolean {
  if (!exact(value, [
    'schemaVersion', 'eventRef', 'source', 'occurredAt', 'engine', 'evidenceCategory',
    'reasonCode', 'state', 'resolution', 'history',
  ], ['learner', 'versionSnapshot'])) return false
  if (value.schemaVersion !== SAFETY_OPERATIONS_SCHEMA_VERSION
    || !reference(value.eventRef) || !SOURCES.has(value.source as string)
    || !instant(value.occurredAt) || !ENGINES.has(value.engine as string)
    || !CATEGORIES.has(value.evidenceCategory as string)
    || !reference(value.reasonCode) || !EVENT_STATES.has(value.state as string)) return false
  if (value.learner !== undefined) {
    if (!exact(value.learner, ['reference'], ['displayName']) || !reference(value.learner.reference)) return false
    if (value.learner.displayName !== undefined && (
      typeof value.learner.displayName !== 'string'
      || value.learner.displayName.length < 1
      || value.learner.displayName.length > 80
      || !/^[\p{L}\p{M}\p{N} .'-]+$/u.test(value.learner.displayName)
    )) return false
  }
  if (value.versionSnapshot !== undefined && (
    !exact(value.versionSnapshot, ['appVersion', 'engineVersion', 'curriculumVersion'])
    || !version(value.versionSnapshot.appVersion)
    || !version(value.versionSnapshot.engineVersion)
    || (value.versionSnapshot.curriculumVersion !== null && !version(value.versionSnapshot.curriculumVersion))
  )) return false
  if (!exact(value.resolution, ['state'], ['resolvedAt', 'authorizedAdultRef'])
    || !RESOLUTION_STATES.has(value.resolution.state as string)
    || (value.resolution.resolvedAt !== undefined && !instant(value.resolution.resolvedAt))
    || (value.resolution.authorizedAdultRef !== undefined && !reference(value.resolution.authorizedAdultRef))) return false
  if (!Array.isArray(value.history) || value.history.length > 50) return false
  return value.history.every((entry) => exact(entry, ['occurredAt', 'state'], ['reasonCode'])
    && instant(entry.occurredAt)
    && EVENT_STATES.has(entry.state as string)
    && (entry.reasonCode === undefined || reference(entry.reasonCode)))
}

function isSnapshot(value: unknown): value is SafetyOperationsSnapshotV1 {
  if (!isRecord(value)) return false
  const keys = Object.keys(value).sort()
  if (keys.join(',') !== 'events,observedAt,operationalTelemetry,page,schemaVersion,sources,summary') return false
  if (
    value.schemaVersion !== SAFETY_OPERATIONS_SCHEMA_VERSION
    || !instant(value.observedAt)
    || !isRecord(value.summary)
    || !Array.isArray(value.sources)
    || value.sources.length > SOURCES.size
    || value.sources.some((source) => !exact(source, ['source', 'status'])
      || !SOURCES.has(source.source as string)
      || (source.status !== 'available' && source.status !== 'unavailable'))
    || new Set(value.sources.map((source) => (source as Record<string, unknown>).source)).size !== value.sources.length
    || !Array.isArray(value.events)
    || value.events.length > SAFETY_OPERATIONS_EVENT_LIMIT
    || !value.events.every(safeEvent)
    || !isRecord(value.operationalTelemetry)
    || !exact(value.operationalTelemetry, ['status'])
    || !isRecord(value.page)
    || !exact(value.page, ['limit', 'nextCursor'])
  ) return false
  const summary = value.summary
  if (Object.keys(summary).length !== SUMMARY_KEYS.length
    || !SUMMARY_KEYS.every((key) => metric(summary[key]))) return false
  const status = value.operationalTelemetry.status
  return (
    (status === 'available' || status === 'unavailable')
    && Number.isSafeInteger(value.page.limit)
    && Number(value.page.limit) >= 1
    && Number(value.page.limit) <= SAFETY_OPERATIONS_EVENT_LIMIT
    && (value.page.nextCursor === null
      || (typeof value.page.nextCursor === 'string' && /^[A-Za-z0-9_-]{1,512}$/.test(value.page.nextCursor)))
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
    accessToken = await withAdminDependencyTimeout(
      () => getAccessToken(), options.timeoutMs ?? ADMIN_SAFETY_OPERATIONS_TIMEOUT_MS,
    )
  } catch {
    return { status: 'unavailable', reasonCode: 'source_unavailable' }
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
    const response = await withAdminDependencyTimeout((timeoutSignal) => fetchImpl(`${ADMIN_SAFETY_OPERATIONS_ENDPOINT}?${query}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.any([controller.signal, timeoutSignal]),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    }), options.timeoutMs ?? ADMIN_SAFETY_OPERATIONS_TIMEOUT_MS)
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

import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import type { StudyProductionReadinessState } from '../contracts/production/readiness'
import { STUDY_READINESS_SCHEMA_VERSION } from '../contracts/production/versions'

export const STUDY_PRODUCTION_READINESS_ENDPOINT = '/api/study/production/readiness'
export const STUDY_PRODUCTION_READINESS_CLIENT_TIMEOUT_MS = 5_000
const MAX_SERVER_TTL_MS = 60_000
const FAILURE_TTL_MS = 1_000

export interface StudyProductionReadinessWire {
  readonly schemaVersion: typeof STUDY_READINESS_SCHEMA_VERSION
  readonly status: StudyProductionReadinessState
  readonly expiresAt: string
}

type FetchLike = (url: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export interface StudyProductionReadinessClient {
  read(options?: { readonly force?: boolean; readonly signal?: AbortSignal }): Promise<StudyProductionReadinessWire>
  revalidate(signal?: AbortSignal): Promise<StudyProductionReadinessWire>
  invalidate(): void
}

export interface StudyProductionReadinessClientOptions {
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly now?: () => number
  readonly timeoutMs?: number
}

function exactWire(value: unknown, nowMs: number): StudyProductionReadinessWire | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (
    keys.length !== 3 ||
    !['schemaVersion', 'status', 'expiresAt'].every((key) => keys.includes(key)) ||
    record.schemaVersion !== STUDY_READINESS_SCHEMA_VERSION ||
    !['ready', 'not-ready', 'degraded'].includes(record.status as string) ||
    typeof record.expiresAt !== 'string'
  ) return null
  const expiresAtMs = Date.parse(record.expiresAt)
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= nowMs || expiresAtMs > nowMs + MAX_SERVER_TTL_MS) return null
  return Object.freeze({
    schemaVersion: STUDY_READINESS_SCHEMA_VERSION,
    status: record.status as StudyProductionReadinessState,
    expiresAt: new Date(expiresAtMs).toISOString(),
  })
}

function failClosed(nowMs: number): StudyProductionReadinessWire {
  return Object.freeze({
    schemaVersion: STUDY_READINESS_SCHEMA_VERSION,
    status: 'not-ready',
    expiresAt: new Date(nowMs + FAILURE_TTL_MS).toISOString(),
  })
}

/** In-memory, authenticated, no-secret readiness adapter with bounded caching. */
export function createStudyProductionReadinessClient(
  options: StudyProductionReadinessClientOptions = {},
): StudyProductionReadinessClient {
  const getAccessToken = options.getAccessToken ?? getGatewayAccessToken
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init))
  const now = options.now ?? Date.now
  let cached: StudyProductionReadinessWire | null = null

  async function read(
    readOptions: { readonly force?: boolean; readonly signal?: AbortSignal } = {},
  ): Promise<StudyProductionReadinessWire> {
    const nowMs = now()
    if (readOptions.signal?.aborted) return failClosed(nowMs)
    if (!readOptions.force && cached && Date.parse(cached.expiresAt) > nowMs) return cached

    let accessToken: string | null
    try {
      accessToken = await getAccessToken()
    } catch {
      cached = failClosed(now())
      return cached
    }
    if (!accessToken || readOptions.signal?.aborted) {
      cached = failClosed(now())
      return cached
    }

    const controller = new AbortController()
    const cancel = () => controller.abort(readOptions.signal?.reason)
    readOptions.signal?.addEventListener('abort', cancel, { once: true })
    const timer = globalThis.setTimeout(
      () => controller.abort(),
      options.timeoutMs ?? STUDY_PRODUCTION_READINESS_CLIENT_TIMEOUT_MS,
    )
    try {
      const response = await fetchImpl(STUDY_PRODUCTION_READINESS_ENDPOINT, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
      if (response.status !== 200 && response.status !== 503) {
        cached = failClosed(now())
        return cached
      }
      const parsed = exactWire(await response.json(), now())
      cached = parsed ?? failClosed(now())
      return cached
    } catch {
      cached = failClosed(now())
      return cached
    } finally {
      globalThis.clearTimeout(timer)
      readOptions.signal?.removeEventListener('abort', cancel)
    }
  }

  return Object.freeze({
    read,
    revalidate(signal?: AbortSignal) { return read({ force: true, signal }) },
    invalidate() { cached = null },
  })
}

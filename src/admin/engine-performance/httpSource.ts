import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from '../adminDependencyTimeout'
import {
  isEnginePerformanceProjection,
  type EnginePerformanceProjection,
  type EnginePerformanceWindowPreset,
} from '../enginePerformanceModel'
import type { AdminEngineId } from '../contracts'

const ENDPOINT = '/api/admin/v1/engine-performance'

type FetchLike = (input: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export type EnginePerformanceReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly model: EnginePerformanceProjection }
  | { readonly status: 'unauthorized' }
  | { readonly status: 'error'; readonly code: 'unavailable' | 'timeout' | 'incomplete' | 'malformed' | 'invalid_response' }

export async function readAdminEnginePerformance(options: {
  readonly window: EnginePerformanceWindowPreset
  readonly engine: AdminEngineId
  readonly engineVersion?: string | null
  readonly courseRef?: string | null
  readonly unitRef?: string | null
  readonly fetchImpl?: FetchLike
  readonly getAccessToken?: () => Promise<string | null>
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}): Promise<EnginePerformanceReadState> {
  const controller = new AbortController()
  let timedOut = false
  const forwardAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', forwardAbort, { once: true })
  if (options.signal?.aborted) controller.abort(options.signal.reason)
  const timer = globalThis.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, options.timeoutMs ?? 10_000)
  try {
    const timeoutMs = options.timeoutMs ?? 10_000
    const token = await withAdminDependencyTimeout(
      () => (options.getAccessToken ?? getGatewayAccessToken)(), timeoutMs,
    )
    if (timedOut) return { status: 'error', code: 'timeout' }
    if (!token) return { status: 'unauthorized' }
    if (controller.signal.aborted) return { status: 'error', code: 'unavailable' }
    const query = new URLSearchParams({ window: options.window, engine: options.engine })
    if (options.engineVersion) query.set('engineVersion', options.engineVersion)
    if (options.courseRef) query.set('course', options.courseRef)
    if (options.unitRef) query.set('unit', options.unitRef)
    const response = await withAdminDependencyTimeout((timeoutSignal) => (options.fetchImpl ?? fetch)(`${ENDPOINT}?${query}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.any([controller.signal, timeoutSignal]),
    }), timeoutMs)
    if (response.status === 401 || response.status === 403) return { status: 'unauthorized' }
    if (response.status === 504) return { status: 'error', code: 'timeout' }
    if (response.status === 502) return { status: 'error', code: 'malformed' }
    if (response.status === 503) {
      const payload = await response.json().catch(() => null) as { error?: { code?: unknown } } | null
      return payload?.error?.code === 'engine_performance_incomplete'
        ? { status: 'error', code: 'incomplete' }
        : { status: 'error', code: 'unavailable' }
    }
    if (response.status !== 200) return { status: 'error', code: 'unavailable' }
    const candidate = await response.json()
    return isEnginePerformanceProjection(candidate)
      ? { status: 'ready', model: candidate }
      : { status: 'error', code: 'invalid_response' }
  } catch {
    return timedOut
      ? { status: 'error', code: 'timeout' }
      : { status: 'error', code: 'unavailable' }
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', forwardAbort)
  }
}

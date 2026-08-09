import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
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
  | { readonly status: 'error'; readonly code: 'unavailable' | 'timeout' | 'invalid_response' }

export async function readAdminEnginePerformance(options: {
  readonly window: EnginePerformanceWindowPreset
  readonly engine: AdminEngineId
  readonly engineVersion?: string | null
  readonly courseRef?: string | null
  readonly unitRef?: string | null
  readonly fetchImpl?: FetchLike
  readonly getAccessToken?: () => Promise<string | null>
  readonly signal?: AbortSignal
}): Promise<EnginePerformanceReadState> {
  try {
    const token = await (options.getAccessToken ?? getGatewayAccessToken)()
    if (!token || options.signal?.aborted) return { status: 'unauthorized' }
    const query = new URLSearchParams({ window: options.window, engine: options.engine })
    if (options.engineVersion) query.set('engineVersion', options.engineVersion)
    if (options.courseRef) query.set('course', options.courseRef)
    if (options.unitRef) query.set('unit', options.unitRef)
    const response = await (options.fetchImpl ?? fetch)(`${ENDPOINT}?${query}`, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: options.signal,
    })
    if (response.status === 401 || response.status === 403) return { status: 'unauthorized' }
    if (response.status === 504) return { status: 'error', code: 'timeout' }
    if (response.status !== 200) return { status: 'error', code: 'unavailable' }
    const candidate = await response.json()
    return isEnginePerformanceProjection(candidate)
      ? { status: 'ready', model: candidate }
      : { status: 'error', code: 'invalid_response' }
  } catch {
    return options.signal?.aborted
      ? { status: 'error', code: 'unavailable' }
      : { status: 'error', code: 'unavailable' }
  }
}

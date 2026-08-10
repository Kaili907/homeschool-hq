import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import {
  parseProductionReadinessProjection,
  type ProductionReadinessProjection,
} from './productionReadinessModel'

export const ADMIN_PRODUCTION_READINESS_ENDPOINT = '/api/admin/v1/production-readiness'

export class AdminProductionReadinessError extends Error {
  constructor(readonly code: 'unauthorized' | 'timeout' | 'unavailable' | 'malformed') {
    super(code)
    this.name = 'AdminProductionReadinessError'
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export async function readAdminProductionReadiness(options: {
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
} = {}): Promise<ProductionReadinessProjection> {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', forwardAbort, { once: true })
  if (options.signal?.aborted) controller.abort(options.signal.reason)
  const timer = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000)
  try {
    const token = await (options.getAccessToken ?? getGatewayAccessToken)()
    if (!token || controller.signal.aborted) throw new AdminProductionReadinessError('unauthorized')
    const response = await (options.fetchImpl ?? fetch)(ADMIN_PRODUCTION_READINESS_ENDPOINT, {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 403) {
      throw new AdminProductionReadinessError('unauthorized')
    }
    if (response.status !== 200) throw new AdminProductionReadinessError('unavailable')
    const projection = parseProductionReadinessProjection(await response.json())
    if (!projection) throw new AdminProductionReadinessError('malformed')
    return projection
  } catch (error) {
    if (error instanceof AdminProductionReadinessError) throw error
    throw new AdminProductionReadinessError(controller.signal.aborted ? 'timeout' : 'unavailable')
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', forwardAbort)
  }
}

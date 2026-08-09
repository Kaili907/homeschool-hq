import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import {
  parseAdminCostsModel,
  type AdminCostRangeSelection,
  type AdminCostsErrorCode,
  type AdminCostsModel,
} from './costsModel'

export class AdminCostsReadError extends Error {
  readonly code: AdminCostsErrorCode | 'costs_unauthorized'

  constructor(code: AdminCostsErrorCode | 'costs_unauthorized') {
    super(code)
    this.name = 'AdminCostsReadError'
    this.code = code
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

async function exactErrorCode(response: { json(): Promise<unknown> }): Promise<string | null> {
  try {
    const value = await response.json()
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1) return null
    const error = (value as { error?: unknown }).error
    if (!error || typeof error !== 'object' || Array.isArray(error) || Object.keys(error).length !== 1) return null
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}

export interface ReadAdminCostsOptions {
  readonly fetchImpl?: FetchLike
  readonly getAccessToken?: () => Promise<string | null>
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

function queryForRange(range: AdminCostRangeSelection): string {
  const query = new URLSearchParams()
  if (range.kind === 'preset') query.set('range', range.preset)
  else {
    query.set('range', 'custom')
    query.set('start', range.start)
    query.set('end', range.end)
  }
  return query.toString()
}

export async function readAdminCosts(
  range: AdminCostRangeSelection,
  options: ReadAdminCostsOptions = {},
): Promise<AdminCostsModel> {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', forwardAbort, { once: true })
  const timer = globalThis.setTimeout(() => controller.abort(), options.timeoutMs ?? 10_000)
  try {
    const token = await (options.getAccessToken ?? getGatewayAccessToken)()
    if (!token || controller.signal.aborted) throw new AdminCostsReadError('costs_unauthorized')
    const response = await (options.fetchImpl ?? fetch)(
      `/api/admin/v1/costs?${queryForRange(range)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal,
      },
    )
    if (response.status === 401 || response.status === 403) throw new AdminCostsReadError('costs_unauthorized')
    if (response.status === 400) throw new AdminCostsReadError('invalid_range')
    if (response.status !== 200) {
      const code = await exactErrorCode(response)
      if (code === 'cost_source_unavailable' || code === 'internal_error') {
        throw new AdminCostsReadError('costs_unavailable')
      }
      if (code === 'cost_source_timeout') throw new AdminCostsReadError('costs_timeout')
      throw new AdminCostsReadError('costs_unauthorized')
    }
    const model = parseAdminCostsModel(await response.json())
    if (!model) throw new AdminCostsReadError('costs_unavailable')
    return model
  } catch (error) {
    if (error instanceof AdminCostsReadError) throw error
    throw new AdminCostsReadError('costs_unauthorized')
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', forwardAbort)
  }
}

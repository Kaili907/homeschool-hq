import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import {
  parseProviderPricingModel,
  parseProviderPricingMutationResult,
  parseProviderPricingPreview,
  type ProviderPricingEndRequest,
  type ProviderPricingErrorCode,
  type ProviderPricingModel,
  type ProviderPricingMutationResult,
  type ProviderPricingPreview,
  type ProviderPricingTermRequest,
} from './providerPricingModel'

export const ADMIN_PROVIDER_PRICING_ENDPOINT = '/api/admin/v1/provider-pricing-terms'
export const ADMIN_PROVIDER_PRICING_TIMEOUT_MS = 10_000

export class AdminProviderPricingHttpError extends Error {
  readonly code: ProviderPricingErrorCode

  constructor(code: ProviderPricingErrorCode) {
    super(code)
    this.name = 'AdminProviderPricingHttpError'
    this.code = code
  }
}

type FetchLike = (input: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export interface AdminProviderPricingHttpOptions {
  readonly fetchImpl?: FetchLike
  readonly getAccessToken?: () => Promise<string | null>
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

const SERVER_ERROR_CODES: Readonly<Partial<Record<string, ProviderPricingErrorCode>>> = {
  admin_access_denied: 'manage_denied',
  provider_pricing_source_timeout: 'source_timeout',
  provider_pricing_source_unavailable: 'source_unavailable',
  internal_error: 'source_unavailable',
  invalid_request: 'invalid_request',
  unsupported_dimension: 'unsupported_dimension',
  overlap: 'overlap',
  replacement_invalid: 'replacement_invalid',
  revision_conflict: 'revision_conflict',
  status_conflict: 'status_conflict',
  idempotency_conflict: 'idempotency_conflict',
  request_in_progress: 'request_in_progress',
  confirmation_expired: 'confirmation_expired',
  confirmation_reused: 'confirmation_reused',
  confirmation_mismatch: 'confirmation_mismatch',
  confirmation_invalid: 'confirmation_invalid',
  disable_unsafe: 'disable_unsafe',
  end_unsafe: 'end_unsafe',
  term_not_found: 'term_not_found',
}

async function responseErrorCode(response: { json(): Promise<unknown> }): Promise<ProviderPricingErrorCode | null> {
  try {
    const value = await response.json()
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 1) return null
    const error = (value as { error?: unknown }).error
    if (!error || typeof error !== 'object' || Array.isArray(error) || Object.keys(error).length !== 1) return null
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? SERVER_ERROR_CODES[code] ?? null : null
  } catch {
    return null
  }
}

async function authorizedRequest<T>({
  path,
  method,
  body,
  parse,
  permission,
  options,
}: {
  readonly path: string
  readonly method: 'GET' | 'POST'
  readonly body?: unknown
  readonly parse: (value: unknown) => T | null
  readonly permission: 'read' | 'manage'
  readonly options: AdminProviderPricingHttpOptions
}): Promise<T> {
  const controller = new AbortController()
  const forwardAbort = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', forwardAbort, { once: true })
  if (options.signal?.aborted) forwardAbort()
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? ADMIN_PROVIDER_PRICING_TIMEOUT_MS,
  )
  try {
    const token = await (options.getAccessToken ?? getGatewayAccessToken)()
    if (!token || controller.signal.aborted) {
      throw new AdminProviderPricingHttpError(permission === 'read' ? 'read_denied' : 'manage_denied')
    }
    const response = await (options.fetchImpl ?? fetch)(path, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: controller.signal,
    })
    if (response.status === 401 || response.status === 403) {
      throw new AdminProviderPricingHttpError(permission === 'read' ? 'read_denied' : 'manage_denied')
    }
    if (response.status !== 200) {
      const code = await responseErrorCode(response)
      throw new AdminProviderPricingHttpError(code ?? (response.status >= 500 ? 'source_unavailable' : 'invalid_request'))
    }
    const parsed = parse(await response.json())
    if (!parsed) throw new AdminProviderPricingHttpError('source_unavailable')
    return parsed
  } catch (error) {
    if (error instanceof AdminProviderPricingHttpError) throw error
    if (controller.signal.aborted) throw new AdminProviderPricingHttpError('source_timeout')
    throw new AdminProviderPricingHttpError('source_unavailable')
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', forwardAbort)
  }
}

export function readAdminProviderPricing(
  options: AdminProviderPricingHttpOptions = {},
): Promise<ProviderPricingModel> {
  return authorizedRequest({
    path: ADMIN_PROVIDER_PRICING_ENDPOINT,
    method: 'GET',
    parse: parseProviderPricingModel,
    permission: 'read',
    options,
  })
}

export function previewAdminProviderPricing(
  request: ProviderPricingTermRequest,
  options: AdminProviderPricingHttpOptions = {},
): Promise<ProviderPricingPreview> {
  return authorizedRequest({
    path: `${ADMIN_PROVIDER_PRICING_ENDPOINT}/preview`,
    method: 'POST',
    body: request,
    parse: parseProviderPricingPreview,
    permission: 'manage',
    options,
  })
}

export function commitAdminProviderPricing(
  request: ProviderPricingTermRequest & {
    readonly expectedRevision: string
    readonly requestId: string
    readonly confirmationToken: string
  },
  options: AdminProviderPricingHttpOptions = {},
): Promise<ProviderPricingMutationResult> {
  return authorizedRequest({
    path: `${ADMIN_PROVIDER_PRICING_ENDPOINT}/commit`,
    method: 'POST',
    body: request,
    parse: parseProviderPricingMutationResult,
    permission: 'manage',
    options,
  })
}

export function endAdminProviderPricing(
  request: ProviderPricingEndRequest,
  options: AdminProviderPricingHttpOptions = {},
): Promise<ProviderPricingMutationResult> {
  return authorizedRequest({
    path: `${ADMIN_PROVIDER_PRICING_ENDPOINT}/end`,
    method: 'POST',
    body: request,
    parse: parseProviderPricingMutationResult,
    permission: 'manage',
    options,
  })
}

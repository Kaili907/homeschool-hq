import {
  buildFirstLinkArgs, buildHydrateArgs, buildResolveMappingArgs, buildWriteArgs,
  parseFirstLinkResult, parseHydrateResult, parseResolveMappingResult, parseWriteResult,
} from './contracts'
import {
  HOSTED_SYNC_OUTCOME_CODES, HOSTED_SYNC_RPC,
  type CreateHostedSyncRpcAdapterOptions, type HostedSyncFailure,
  type HostedSyncFirstLinkInput, type HostedSyncHydrateInput,
  type HostedSyncOutcome, type HostedSyncOutcomeCode, type HostedSyncResolveMappingInput,
  type HostedSyncRpcAdapter, type HostedSyncRpcName, type HostedSyncRpcProviderResult,
  type HostedSyncWriteInput,
} from './types'

const DEFAULT_TIMEOUT_MS = 15_000
const MAX_TIMEOUT_MS = 120_000
const TIMEOUT = Symbol('timeout')
const ABORTED = Symbol('aborted')

function failure(code: Exclude<HostedSyncOutcomeCode, 'SUCCESS'>, values: Partial<HostedSyncFailure> = {}): HostedSyncFailure {
  return Object.freeze({
    code, httpStatus: values.httpStatus ?? null, retryAfterMs: values.retryAfterMs ?? null,
    reasonCode: values.reasonCode ?? null,
  })
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function browserOnline(): boolean {
  try { return typeof navigator === 'undefined' || navigator.onLine !== false } catch { return true }
}

function providerFailure(value: unknown): HostedSyncFailure | null {
  if (!record(value) || value.data !== null || !record(value.error) || Object.keys(value).length !== 2) return null
  const code = value.error.code
  if (typeof code !== 'string' || !HOSTED_SYNC_OUTCOME_CODES.includes(code as HostedSyncOutcomeCode) ||
      ['SUCCESS', 'OFFLINE', 'AUTH_REQUIRED', 'MALFORMED_RESPONSE'].includes(code)) return null
  const httpStatus = value.error.httpStatus ?? null
  const retryAfterMs = value.error.retryAfterMs ?? null
  const reasonCode = value.error.reasonCode ?? null
  if (!(httpStatus === null || (Number.isSafeInteger(httpStatus) && Number(httpStatus) >= 100 && Number(httpStatus) <= 599)) ||
      !(retryAfterMs === null || (Number.isSafeInteger(retryAfterMs) && Number(retryAfterMs) >= 0)) ||
      !(reasonCode === null || typeof reasonCode === 'string')) return null
  return failure(code as Exclude<HostedSyncOutcomeCode, 'SUCCESS'>, {
    httpStatus: httpStatus as number | null, retryAfterMs: retryAfterMs as number | null,
    reasonCode: reasonCode as string | null,
  })
}

export function createHostedSyncRpcAdapter(options: CreateHostedSyncRpcAdapterOptions): HostedSyncRpcAdapter {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const isOnline = options.isOnline ?? browserOnline
  const now = options.now ?? (() => new Date())
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) throw new Error('Hosted sync timeout is out of range.')

  async function execute<T>(rpc: HostedSyncRpcName, args: Readonly<Record<string, unknown>> | null, parse: (value: unknown) => T | null, signal?: AbortSignal): Promise<HostedSyncOutcome<T>> {
    if (!args) return failure('PERMANENT_REFUSAL', { reasonCode: 'INVALID_CLIENT_INPUT' })
    if (signal?.aborted) return failure('ABORTED')
    try { if (!isOnline()) return failure('OFFLINE') } catch { return failure('NETWORK_UNAVAILABLE') }

    let authorized: Awaited<ReturnType<typeof options.authorization.acquire>>
    try { authorized = await options.authorization.acquire(signal) } catch { return signal?.aborted ? failure('ABORTED') : failure('AUTH_REQUIRED') }
    if (authorized.status !== 'AUTHORIZED') return failure(authorized.status)
    const lease = authorized.lease
    const release = () => { try { lease.release?.() } catch { /* outcome is already closed */ } }
    if (lease.clientKind !== 'AUTHENTICATED_USER') { release(); return failure('AUTH_REQUIRED', { reasonCode: 'AUTHENTICATED_USER_CLIENT_REQUIRED' }) }
    if (!Number.isFinite(Date.parse(lease.expiresAt)) || Date.parse(lease.expiresAt) <= now().getTime()) { release(); return failure('SESSION_EXPIRED') }

    const controller = new AbortController()
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined
    let abortListener: (() => void) | undefined
    const timeout = new Promise<typeof TIMEOUT>((resolve) => {
      timeoutHandle = setTimeout(() => { controller.abort(); resolve(TIMEOUT) }, timeoutMs)
    })
    const aborted = new Promise<typeof ABORTED>((resolve) => {
      abortListener = () => { controller.abort(signal?.reason); resolve(ABORTED) }
      signal?.addEventListener('abort', abortListener, { once: true })
    })
    try {
      let result: HostedSyncRpcProviderResult | typeof TIMEOUT | typeof ABORTED
      try { result = await Promise.race([lease.provider.rpc(rpc, args, controller.signal), timeout, aborted]) }
      catch { return signal?.aborted ? failure('ABORTED') : failure('NETWORK_UNAVAILABLE') }
      if (result === TIMEOUT) return failure('TIMEOUT')
      if (result === ABORTED) return failure('ABORTED')
      if (!record(result) || !('data' in result) || !('error' in result) || Object.keys(result).length !== 2) return failure('MALFORMED_RESPONSE')
      if (result.error !== null) return providerFailure(result) ?? failure('MALFORMED_RESPONSE')
      const parsed = parse(result.data)
      return parsed === null ? failure('MALFORMED_RESPONSE') : Object.freeze({ code: 'SUCCESS' as const, value: parsed })
    } finally {
      if (timeoutHandle) clearTimeout(timeoutHandle)
      if (abortListener) signal?.removeEventListener('abort', abortListener)
      release()
    }
  }

  return Object.freeze({
    firstLink(input: HostedSyncFirstLinkInput, signal?: AbortSignal) { return execute(HOSTED_SYNC_RPC.firstLink, buildFirstLinkArgs(input), parseFirstLinkResult, signal) },
    resolveMapping(input: HostedSyncResolveMappingInput, signal?: AbortSignal) { return execute(HOSTED_SYNC_RPC.resolveMapping, buildResolveMappingArgs(input), parseResolveMappingResult, signal) },
    hydrate(input: HostedSyncHydrateInput, signal?: AbortSignal) { return execute(HOSTED_SYNC_RPC.hydrate, buildHydrateArgs(input), parseHydrateResult, signal) },
    write(input: HostedSyncWriteInput, signal?: AbortSignal) { return execute(HOSTED_SYNC_RPC.write, buildWriteArgs(input), (value) => parseWriteResult(value, input), signal) },
  })
}

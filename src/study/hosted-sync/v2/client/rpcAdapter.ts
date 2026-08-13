import {
  buildAcknowledgeArgs,
  buildFirstLinkImportArgs,
  buildHydrateArgs,
  buildRevisionedWriteArgs,
  parseAcknowledgeResponse,
  parseHydrateResponse,
  parseRefusalResponse,
  parseWriteResponse,
  type ParsedWriteResponse,
} from './contracts'
import {
  HOSTED_SYNC_OUTCOME_CODES,
  HOSTED_SYNC_RPC,
  type CreateHostedSyncRpcAdapterOptions,
  type HostedSyncAcknowledgedResult,
  type HostedSyncAcknowledgeInput,
  type HostedSyncFailure,
  type HostedSyncFirstLinkImportInput,
  type HostedSyncHydrateInput,
  type HostedSyncHydrateResult,
  type HostedSyncOutcome,
  type HostedSyncOutcomeCode,
  type HostedSyncRevisionedWriteInput,
  type HostedSyncRpcName,
  type HostedSyncRpcProviderResult,
  type HostedSyncStoredResult,
} from './types'

const DEFAULT_TIMEOUT_MS = 15_000
const MAX_TIMEOUT_MS = 120_000
const RPC_TIMEOUT = Symbol('HOSTED_SYNC_RPC_TIMEOUT')
const RPC_ABORTED = Symbol('HOSTED_SYNC_RPC_ABORTED')

function failure(
  code: Exclude<HostedSyncOutcomeCode, 'SUCCESS'>,
  input: Partial<Omit<HostedSyncFailure, 'code'>> = {},
): HostedSyncFailure {
  return Object.freeze({
    code,
    httpStatus: input.httpStatus ?? null,
    retryAfterMs: input.retryAfterMs ?? null,
    serverRevision: input.serverRevision ?? null,
    reasonCode: input.reasonCode ?? null,
  })
}

function success<T>(value: T): HostedSyncOutcome<T> {
  return Object.freeze({ code: 'SUCCESS' as const, value })
}

function browserOnline(): boolean {
  try { return typeof navigator === 'undefined' || navigator.onLine !== false } catch { return true }
}

function validExpiry(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function safelyRelease(lease: { readonly release?: () => void } | null | undefined): void {
  try { lease?.release?.() } catch { /* Lease cleanup cannot change the closed RPC outcome. */ }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactAllowedKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function providerFailure(result: unknown): HostedSyncFailure | null {
  if (!isRecord(result) || result.data !== null || !isRecord(result.error) ||
      !exactAllowedKeys(result, ['data', 'error']) || Object.keys(result).length !== 2 ||
      !exactAllowedKeys(result.error, ['code', 'httpStatus', 'retryAfterMs', 'reasonCode'])) return null
  const code = result.error.code
  if (typeof code !== 'string' || code === 'SUCCESS' || code === 'OFFLINE' ||
      code === 'AUTH_REQUIRED' || code === 'STALE_REVISION' || code === 'MALFORMED_RESPONSE' ||
      !HOSTED_SYNC_OUTCOME_CODES.includes(code as HostedSyncOutcomeCode)) return null
  const httpStatus = result.error.httpStatus ?? null
  const retryAfterMs = result.error.retryAfterMs ?? null
  const reasonCode = result.error.reasonCode ?? null
  if (!(httpStatus === null || (Number.isSafeInteger(httpStatus) && (httpStatus as number) >= 100 && (httpStatus as number) <= 599)) ||
      !(retryAfterMs === null || (Number.isSafeInteger(retryAfterMs) && (retryAfterMs as number) >= 0)) ||
      !(reasonCode === null || (typeof reasonCode === 'string' && reasonCode.length <= 96))) return null
  return failure(code as Exclude<HostedSyncOutcomeCode, 'SUCCESS'>, {
    httpStatus: httpStatus as number | null,
    retryAfterMs: retryAfterMs as number | null,
    reasonCode: reasonCode as string | null,
  })
}

type ExecuteParser<T> = (value: unknown) =>
  | Readonly<{ status: 'SUCCESS'; value: T }>
  | Readonly<{ status: 'STALE_REVISION'; serverRevision: number }>
  | Readonly<{ status: 'PERMANENT_REFUSAL'; reasonCode: string }>
  | null

export function createHostedSyncRpcAdapter(
  options: CreateHostedSyncRpcAdapterOptions,
): import('./types').HostedSyncRpcAdapter {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const isOnline = options.isOnline ?? browserOnline
  const now = options.now ?? (() => new Date())
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error('Hosted sync RPC timeout must be bounded between 1 and 120000 milliseconds.')
  }

  async function execute<T>(input: {
    readonly rpc: HostedSyncRpcName
    readonly args: Readonly<Record<string, unknown>> | null
    readonly parse: ExecuteParser<T>
    readonly signal?: AbortSignal
  }): Promise<HostedSyncOutcome<T>> {
    if (!input.args) return failure('PERMANENT_REFUSAL', { reasonCode: 'INVALID_CLIENT_INPUT' })
    if (input.signal?.aborted) return failure('ABORTED')
    try {
      if (!isOnline()) return failure('OFFLINE')
    } catch {
      return failure('NETWORK_UNAVAILABLE')
    }

    let authorized: Awaited<ReturnType<typeof options.authorization.acquire>>
    try {
      authorized = await options.authorization.acquire(input.signal)
    } catch {
      return input.signal?.aborted ? failure('ABORTED') : failure('AUTH_REQUIRED')
    }
    if (!authorized || typeof authorized !== 'object' || !('status' in authorized)) return failure('AUTH_REQUIRED')
    if (authorized.status !== 'AUTHORIZED') {
      return authorized.status === 'SESSION_EXPIRED' ? failure('SESSION_EXPIRED') : failure('AUTH_REQUIRED')
    }
    const lease = authorized.lease
    if (!lease || lease.clientKind !== 'AUTHENTICATED_USER') {
      safelyRelease(lease)
      return failure('AUTH_REQUIRED', { reasonCode: 'AUTHENTICATED_USER_CLIENT_REQUIRED' })
    }
    if (input.signal?.aborted) {
      safelyRelease(lease)
      return failure('ABORTED')
    }
    if (!validExpiry(lease.expiresAt) || Date.parse(lease.expiresAt) <= now().getTime()) {
      safelyRelease(lease)
      return failure('SESSION_EXPIRED')
    }

    const controller = new AbortController()
    let timedOut = false
    let resolveAbort!: (value: typeof RPC_ABORTED) => void
    const aborted = new Promise<typeof RPC_ABORTED>((resolve) => { resolveAbort = resolve })
    const abortFromCaller = () => {
      controller.abort(input.signal?.reason)
      resolveAbort(RPC_ABORTED)
    }
    input.signal?.addEventListener('abort', abortFromCaller, { once: true })
    let resolveTimeout!: (value: typeof RPC_TIMEOUT) => void
    const timeout = new Promise<typeof RPC_TIMEOUT>((resolve) => { resolveTimeout = resolve })
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException('Hosted sync RPC timed out.', 'TimeoutError'))
      resolveTimeout(RPC_TIMEOUT)
    }, timeoutMs)
    try {
      let result: HostedSyncRpcProviderResult
      try {
        const raced = await Promise.race([
          lease.provider.rpc(input.rpc, input.args, controller.signal),
          timeout,
          aborted,
        ])
        if (raced === RPC_TIMEOUT) return failure('TIMEOUT')
        if (raced === RPC_ABORTED) return failure('ABORTED')
        result = raced
      } catch {
        if (input.signal?.aborted) return failure('ABORTED')
        return failure(timedOut ? 'TIMEOUT' : 'NETWORK_UNAVAILABLE')
      }
      if (timedOut) return failure('TIMEOUT')
      if (input.signal?.aborted) return failure('ABORTED')
      if (!isRecord(result) || !exactAllowedKeys(result, ['data', 'error']) || Object.keys(result).length !== 2 ||
          !('error' in result) || !('data' in result)) {
        return failure('MALFORMED_RESPONSE')
      }
      if (result.error !== null) return providerFailure(result) ?? failure('MALFORMED_RESPONSE')
      const parsed = input.parse(result.data)
      if (!parsed) return failure('MALFORMED_RESPONSE')
      if (parsed.status === 'STALE_REVISION') {
        return failure('STALE_REVISION', {
          serverRevision: parsed.serverRevision,
          reasonCode: 'CAS_BASE_REVISION_STALE',
        })
      }
      if (parsed.status === 'PERMANENT_REFUSAL') {
        return failure('PERMANENT_REFUSAL', { reasonCode: parsed.reasonCode })
      }
      return success(parsed.value)
    } finally {
      clearTimeout(timer)
      input.signal?.removeEventListener('abort', abortFromCaller)
      safelyRelease(lease)
    }
  }

  function writeParser(operationId: string, baseRevision: number): ExecuteParser<HostedSyncStoredResult> {
    return (value) => parseWriteResponse(value, operationId, baseRevision)
  }

  return Object.freeze({
    firstLinkImport(input: HostedSyncFirstLinkImportInput, signal?: AbortSignal) {
      return execute<HostedSyncStoredResult>({
        rpc: HOSTED_SYNC_RPC.firstLinkImport,
        args: buildFirstLinkImportArgs(input),
        parse: writeParser(input.operationId, input.baseRevision),
        signal,
      })
    },

    hydrate(input: HostedSyncHydrateInput, signal?: AbortSignal) {
      const identity = input.identity
      return execute<HostedSyncHydrateResult>({
        rpc: HOSTED_SYNC_RPC.hydrate,
        args: buildHydrateArgs(input),
        parse: (value) => {
          const parsed = parseHydrateResponse(value, identity)
          return parsed
            ? Object.freeze({ status: 'SUCCESS' as const, value: parsed })
            : parseRefusalResponse(value)
        },
        signal,
      })
    },

    revisionedWrite(input: HostedSyncRevisionedWriteInput, signal?: AbortSignal) {
      return execute<HostedSyncStoredResult>({
        rpc: HOSTED_SYNC_RPC.revisionedWrite,
        args: buildRevisionedWriteArgs(input),
        parse: writeParser(input.operationId, input.baseRevision),
        signal,
      })
    },

    acknowledge(input: HostedSyncAcknowledgeInput, signal?: AbortSignal) {
      return execute<HostedSyncAcknowledgedResult>({
        rpc: HOSTED_SYNC_RPC.acknowledge,
        args: buildAcknowledgeArgs(input),
        parse: (value) => {
          const parsed = parseAcknowledgeResponse(value, input)
          return parsed
            ? Object.freeze({ status: 'SUCCESS' as const, value: parsed })
            : parseRefusalResponse(value)
        },
        signal,
      })
    },
  })
}

export type { ParsedWriteResponse }

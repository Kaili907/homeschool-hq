import {
  buildHostedStudyHydrateArgs,
  buildHostedStudyWriteArgs,
  parseHostedStudyHydrateResult,
  parseHostedStudyWriteResult,
} from './rpcContracts'
import type {
  HostedStudyRpcAuthorization,
  HostedStudyRpcClient,
  HostedStudyRpcFailureCode,
  HostedStudyRpcHydrateResult,
  HostedStudyRpcOutcome,
  HostedStudyRpcScope,
  HostedStudyRpcWriteInput,
  HostedStudyRpcWriteResult,
} from './rpcTypes'
import { isHostedStudyBrowserPublicKey } from './config'

export const ACADEMY_STUDY_SYNC_HYDRATE_RPC = 'academy_study_sync_hydrate_v1' as const
export const ACADEMY_STUDY_SYNC_WRITE_RPC = 'academy_study_sync_write_v1' as const

export interface CreateHostedStudyRpcClientOptions {
  readonly rpcBaseUrl: string
  readonly publicClientKey: string
  readonly authorization: HostedStudyRpcAuthorization
  readonly fetchImpl?: typeof fetch
  readonly isOnline?: () => boolean
  readonly timeoutMs?: number
  readonly digestSessionReference?: (reference: string) => Promise<string>
}

function failure(code: HostedStudyRpcFailureCode, httpStatus: number | null = null, retryAfterMs: number | null = null) {
  return Object.freeze({ code, httpStatus, retryAfterMs })
}

function endpoint(base: string, name: string): string | null {
  const joined = `${base.replace(/\/$/, '')}/${name}`
  if (joined.startsWith('/')) return joined.startsWith('//') || /[?#\\]/.test(joined) ? null : joined
  try {
    const parsed = new URL(joined)
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
      ? parsed.toString() : null
  } catch { return null }
}

async function sha256(reference: string): Promise<string> {
  if (typeof globalThis.crypto?.subtle?.digest !== 'function') throw new Error('Web Crypto is unavailable.')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(reference))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function retryAfter(response: Response): number | null {
  const raw = response.headers.get('retry-after')
  if (!raw) return null
  const seconds = Number(raw)
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, 86_400_000) : null
}

function classify(response: Response) {
  if (response.status === 401) return failure('SESSION_EXPIRED', 401)
  if (response.status === 429) return failure('RATE_LIMITED', 429, retryAfter(response))
  if (response.status === 408 || response.status >= 500) return failure('SERVER_UNAVAILABLE', response.status)
  return failure('PERMANENT_REFUSAL', response.status)
}

function browserOnline(): boolean {
  try { return typeof navigator === 'undefined' || navigator.onLine !== false } catch { return true }
}

export function createHostedStudyRpcClient(options: CreateHostedStudyRpcClientOptions): HostedStudyRpcClient {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const isOnline = options.isOnline ?? browserOnline
  const timeoutMs = options.timeoutMs ?? 15_000
  const digest = options.digestSessionReference ?? sha256
  if (!isHostedStudyBrowserPublicKey(options.publicClientKey)) {
    throw new Error('A browser-safe public client key is required.')
  }
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) {
    throw new Error('Hosted Study RPC timeout must be bounded.')
  }

  async function execute<T>(input: {
    readonly rpc: string
    readonly args: Readonly<Record<string, unknown>> | null
    readonly parse: (value: unknown) => T | null
    readonly signal?: AbortSignal
    readonly authorized?: Extract<Awaited<ReturnType<HostedStudyRpcAuthorization['authorize']>>, { status: 'authorized' }>
  }): Promise<HostedStudyRpcOutcome<T>> {
    if (!input.args) return failure('PERMANENT_REFUSAL')
    if (input.signal?.aborted) return failure('ABORTED')
    try { if (!isOnline()) return failure('OFFLINE') } catch { return failure('NETWORK_UNAVAILABLE') }
    const url = endpoint(options.rpcBaseUrl, input.rpc)
    if (!url) return failure('PERMANENT_REFUSAL')
    const controller = new AbortController()
    let timedOut = false
    const abort = () => controller.abort(input.signal?.reason)
    input.signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    try {
      const authorized = input.authorized ?? await options.authorization.authorize(controller.signal)
      if (authorized.status !== 'authorized') return failure('AUTHORIZATION_REQUIRED')
      const headers: Record<string, string> = {
        ...authorized.headers,
        apikey: options.publicClientKey,
        accept: 'application/json',
        'content-type': 'application/json',
      }
      let response: Response
      try {
        response = await fetchImpl(url, {
          method: 'POST', headers, body: JSON.stringify(input.args), signal: controller.signal,
          cache: 'no-store', credentials: 'omit', redirect: 'error', referrerPolicy: 'no-referrer',
        })
      } catch {
        if (input.signal?.aborted) return failure('ABORTED')
        return failure(timedOut ? 'TIMEOUT' : 'NETWORK_UNAVAILABLE')
      }
      if (!response.ok) return classify(response)
      if (!(response.headers.get('content-type') ?? '').toLowerCase().includes('json')) {
        return failure('MALFORMED_RESPONSE')
      }
      let raw: unknown
      try { raw = await response.json() } catch { return failure('MALFORMED_RESPONSE') }
      const parsed = input.parse(raw)
      return parsed ? Object.freeze({ code: 'SUCCESS' as const, value: parsed }) : failure('MALFORMED_RESPONSE')
    } finally {
      clearTimeout(timer)
      input.signal?.removeEventListener('abort', abort)
    }
  }

  return Object.freeze({
    async hydrate(scope: HostedStudyRpcScope, signal?: AbortSignal) {
      return execute<HostedStudyRpcHydrateResult>({
        rpc: ACADEMY_STUDY_SYNC_HYDRATE_RPC,
        args: buildHostedStudyHydrateArgs(scope),
        parse: (value) => parseHostedStudyHydrateResult(value, scope),
        signal,
      })
    },
    async write(input: HostedStudyRpcWriteInput, signal?: AbortSignal) {
      if (signal?.aborted) return failure('ABORTED')
      const auth = await options.authorization.authorize(signal)
      if (auth.status !== 'authorized') return failure('AUTHORIZATION_REQUIRED')
      let tokenDigest: string
      try { tokenDigest = await digest(auth.studySessionReference) } catch { return failure('AUTHORIZATION_REQUIRED') }
      return execute<HostedStudyRpcWriteResult>({
        rpc: ACADEMY_STUDY_SYNC_WRITE_RPC,
        args: buildHostedStudyWriteArgs(input, tokenDigest),
        parse: (value) => parseHostedStudyWriteResult(value, input),
        signal,
        authorized: auth,
      })
    },
  })
}

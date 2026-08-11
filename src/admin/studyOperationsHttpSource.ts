import { getGatewayAccessToken } from '../tutor/gatewayAuth'
import {
  decodeStudyOperationsProjection,
  type StudyOperationsReadState,
} from './studyOperationsModel'

export const ADMIN_STUDY_OPERATIONS_ENDPOINT = '/api/admin/v1/study-operations'
export const ADMIN_STUDY_OPERATIONS_TIMEOUT_MS = 5_000

type FetchLike = (url: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

interface ReadAdminStudyOperationsOptions {
  readonly getAccessToken?: () => Promise<string | null>
  readonly fetchImpl?: FetchLike
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
}

export async function readAdminStudyOperations(
  options: ReadAdminStudyOperationsOptions = {},
): Promise<StudyOperationsReadState> {
  const getAccessToken = options.getAccessToken ?? getGatewayAccessToken
  const fetchImpl = options.fetchImpl ?? ((url, init) => fetch(url, init))
  let accessToken: string | null
  try {
    accessToken = await getAccessToken()
  } catch {
    return { status: 'error', code: 'study_operations_unavailable' }
  }
  if (!accessToken || options.signal?.aborted) return { status: 'denied' }

  const controller = new AbortController()
  const cancel = () => controller.abort(options.signal?.reason)
  options.signal?.addEventListener('abort', cancel, { once: true })
  const timer = globalThis.setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? ADMIN_STUDY_OPERATIONS_TIMEOUT_MS,
  )
  try {
    const response = await fetchImpl(ADMIN_STUDY_OPERATIONS_ENDPOINT, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (response.status === 401 || response.status === 403) return { status: 'denied' }
    if (response.status !== 200) {
      return { status: 'error', code: 'study_operations_unavailable' }
    }
    const projection = decodeStudyOperationsProjection(await response.json())
    return projection
      ? { status: 'ready', projection }
      : { status: 'error', code: 'study_operations_unavailable' }
  } catch {
    return {
      status: 'error',
      code: controller.signal.aborted
        ? 'study_operations_timeout'
        : 'study_operations_unavailable',
    }
  } finally {
    globalThis.clearTimeout(timer)
    options.signal?.removeEventListener('abort', cancel)
  }
}

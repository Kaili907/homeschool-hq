import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from '../adminDependencyTimeout'
import {
  buildCurriculumValidationReadModel,
  type CurriculumValidationEvidenceBundle,
  type CurriculumValidationReadModel,
} from './model'

type FetchLike = (input: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export type CurriculumValidationReadState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly model: CurriculumValidationReadModel }
  | { readonly status: 'no-evidence' }
  | { readonly status: 'unavailable' }
  | { readonly status: 'denied' }
  | { readonly status: 'error'; readonly code: 'unexpected_response' }

export async function readAdminCurriculumValidation(options: {
  readonly fetchImpl?: FetchLike
  readonly getAccessToken?: () => Promise<string | null>
  readonly signal?: AbortSignal
  readonly timeoutMs?: number
} = {}): Promise<CurriculumValidationReadState> {
  try {
    const timeoutMs = options.timeoutMs ?? 10_000
    const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init))
    const token = await withAdminDependencyTimeout(
      () => (options.getAccessToken ?? getGatewayAccessToken)(), timeoutMs,
    )
    if (!token) return { status: 'denied' }
    if (options.signal?.aborted) return { status: 'unavailable' }
    const response = await withAdminDependencyTimeout((timeoutSignal) => {
      const signal = options.signal ? AbortSignal.any([options.signal, timeoutSignal]) : timeoutSignal
      return fetchImpl('/api/admin/curriculum/validation', {
        method: 'GET',
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal,
      })
    }, timeoutMs)
    if (response.status === 401 || response.status === 403) return { status: 'denied' }
    if (response.status === 204 || response.status === 404) return { status: 'no-evidence' }
    if (response.status >= 500) return { status: 'unavailable' }
    if (response.status !== 200) return { status: 'error', code: 'unexpected_response' }
    try {
      return {
        status: 'ready',
        model: buildCurriculumValidationReadModel(
          await response.json() as CurriculumValidationEvidenceBundle,
        ),
      }
    } catch {
      return { status: 'error', code: 'unexpected_response' }
    }
  } catch {
    return { status: 'unavailable' }
  }
}

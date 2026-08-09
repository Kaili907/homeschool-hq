import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  buildCurriculumValidationReadModel,
  type CurriculumValidationReadModel,
} from './model'

type FetchLike = (input: string, init: RequestInit) => Promise<{
  readonly status: number
  json(): Promise<unknown>
}>

export async function readAdminCurriculumValidation(options: {
  readonly fetchImpl?: FetchLike
  readonly getAccessToken?: () => Promise<string | null>
  readonly signal?: AbortSignal
} = {}): Promise<CurriculumValidationReadModel | null> {
  try {
    const token = await (options.getAccessToken ?? getGatewayAccessToken)()
    if (!token || options.signal?.aborted) return null
    const response = await (options.fetchImpl ?? fetch)('/api/admin/curriculum/validation', {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: options.signal,
    })
    if (response.status !== 200) return null
    return buildCurriculumValidationReadModel(await response.json())
  } catch {
    return null
  }
}

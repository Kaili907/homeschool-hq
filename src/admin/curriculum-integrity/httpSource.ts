import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  CurriculumIntegrityError,
  type CurriculumIntegrityReport,
  type CurriculumIntegritySource,
} from './contracts'

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

export function createCurriculumIntegrityHttpSource(
  fetchImpl: FetchLike = fetch,
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  path = '/api/admin/curriculum/integrity',
): CurriculumIntegritySource {
  return Object.freeze({
    async readIntegrity() {
      let token: string | null
      try {
        token = await getAccessToken()
      } catch {
        throw new CurriculumIntegrityError('unavailable')
      }
      if (!token) throw new CurriculumIntegrityError('unauthenticated')
      let response: Pick<Response, 'ok' | 'status' | 'json'>
      try {
        response = await fetchImpl(path, {
          method: 'GET',
          headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
        })
      } catch {
        throw new CurriculumIntegrityError('unavailable')
      }
      if (!response.ok) {
        if (response.status === 401) throw new CurriculumIntegrityError('unauthenticated')
        if (response.status === 403) throw new CurriculumIntegrityError('forbidden')
        throw new CurriculumIntegrityError('unavailable')
      }
      try {
        return await response.json() as CurriculumIntegrityReport
      } catch {
        throw new CurriculumIntegrityError('unavailable')
      }
    },
  })
}

import {
  CurriculumSourceError,
  type CurriculumBrowserSource,
  type CurriculumCatalog,
  type CurriculumLessonDetail,
  type CurriculumSourceIdentity,
} from './contracts'
import { getGatewayAccessToken } from '../../tutor/gatewayAuth'

export type CurriculumBrowserFetch = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

async function getJson<T>(
  fetcher: CurriculumBrowserFetch,
  getAccessToken: () => Promise<string | null>,
  path: string,
): Promise<T> {
  let response: Pick<Response, 'ok' | 'status' | 'json'>
  try {
    const accessToken = await getAccessToken()
    if (!accessToken) throw new CurriculumSourceError('unavailable', 'Administrator authorization is unavailable')
    response = await fetcher(path, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    throw new CurriculumSourceError('unavailable', 'The authorized curriculum service is unavailable')
  }
  if (!response.ok) {
    throw new CurriculumSourceError(
      response.status === 404 ? 'not-found' : 'unavailable',
      response.status === 404
        ? 'That curriculum record is unavailable'
        : `The authorized curriculum service returned HTTP ${response.status}`,
    )
  }
  try {
    return await response.json() as T
  } catch {
    throw new CurriculumSourceError('malformed', 'The authorized curriculum service returned malformed data')
  }
}

/**
 * Typed ADMIN-1 integration seam. The server must derive identity and enforce
 * curriculum:read; this client sends no role, capability, or actor assertion.
 */
export function createAdminCurriculumHttpSource(
  fetcher: CurriculumBrowserFetch = fetch,
  basePath = '/api/admin/curriculum',
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
): CurriculumBrowserSource {
  return {
    loadIdentity: () => getJson<CurriculumSourceIdentity>(fetcher, getAccessToken, `${basePath}/catalog-identity`),
    loadCatalog: () => getJson<CurriculumCatalog>(fetcher, getAccessToken, `${basePath}/catalog`),
    loadLesson: (lessonId) => getJson<CurriculumLessonDetail>(
      fetcher,
      getAccessToken,
      `${basePath}/lessons/${encodeURIComponent(lessonId)}`,
    ),
  }
}

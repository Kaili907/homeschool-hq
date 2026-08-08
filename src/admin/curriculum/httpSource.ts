import {
  CurriculumSourceError,
  type CurriculumBrowserSource,
  type CurriculumCatalog,
  type CurriculumLessonDetail,
} from './contracts'

export type CurriculumBrowserFetch = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

async function getJson<T>(fetcher: CurriculumBrowserFetch, path: string): Promise<T> {
  let response: Pick<Response, 'ok' | 'status' | 'json'>
  try {
    response = await fetcher(path, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
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
): CurriculumBrowserSource {
  return {
    loadCatalog: () => getJson<CurriculumCatalog>(fetcher, `${basePath}/catalog`),
    loadLesson: (lessonId) => getJson<CurriculumLessonDetail>(
      fetcher,
      `${basePath}/lessons/${encodeURIComponent(lessonId)}`,
    ),
  }
}

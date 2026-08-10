import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  CurriculumDraftAuthoringError,
  type CreateCurriculumDraftEntityInput,
  type CreateCurriculumDraftInput,
  type CurriculumDraftAuthoringSource,
  type CurriculumDraftDetail,
  type CurriculumDraftEntityDetail,
  type CurriculumDraftEntityType,
  type CurriculumDraftMutationResult,
  type CurriculumDraftSummary,
  type TombstoneCurriculumDraftEntityInput,
  type UpdateCurriculumDraftEntityInput,
} from './contracts'

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

function failure(status: number): CurriculumDraftAuthoringError {
  if (status === 401) return new CurriculumDraftAuthoringError('unauthenticated')
  if (status === 403) return new CurriculumDraftAuthoringError('forbidden')
  if (status === 400 || status === 413 || status === 415 || status === 422) return new CurriculumDraftAuthoringError('invalid')
  if (status === 404) return new CurriculumDraftAuthoringError('not-found')
  if (status === 409) return new CurriculumDraftAuthoringError('conflict')
  return new CurriculumDraftAuthoringError('unavailable')
}

export function createCurriculumDraftAuthoringHttpSource(
  fetchImpl: FetchLike = fetch,
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  basePath = '/api/admin/curriculum/drafts',
): CurriculumDraftAuthoringSource {
  async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
    let token: string | null
    try {
      token = await getAccessToken()
    } catch {
      throw new CurriculumDraftAuthoringError('unavailable')
    }
    if (!token) throw new CurriculumDraftAuthoringError('unauthenticated')
    let response: Pick<Response, 'ok' | 'status' | 'json'>
    try {
      response = await fetchImpl(path, {
        method,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        cache: 'no-store',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      })
    } catch {
      throw new CurriculumDraftAuthoringError('unavailable')
    }
    if (!response.ok) throw failure(response.status)
    try {
      return await response.json() as T
    } catch {
      throw new CurriculumDraftAuthoringError('unavailable')
    }
  }

  const entityPath = (draftId: string, entityType: CurriculumDraftEntityType, entityRef: string) =>
    `${basePath}/${encodeURIComponent(draftId)}/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityRef)}`

  return Object.freeze({
    listDrafts: () => request<{ schemaVersion: 1; drafts: readonly CurriculumDraftSummary[] }>(basePath),
    readDraft: (draftId: string) => request<CurriculumDraftDetail>(`${basePath}/${encodeURIComponent(draftId)}`),
    readEntity: (draftId: string, entityType: CurriculumDraftEntityType, entityRef: string) =>
      request<CurriculumDraftEntityDetail>(entityPath(draftId, entityType, entityRef)),
    createDraft: (input: CreateCurriculumDraftInput) => request<CurriculumDraftMutationResult>(basePath, 'POST', input),
    createEntity: ({ draftId, ...body }: CreateCurriculumDraftEntityInput) =>
      request<CurriculumDraftMutationResult>(`${basePath}/${encodeURIComponent(draftId)}/entities`, 'POST', body),
    updateEntity: ({ draftId, entityType, entityRef, ...body }: UpdateCurriculumDraftEntityInput) =>
      request<CurriculumDraftMutationResult>(entityPath(draftId, entityType, entityRef), 'PUT', body),
    tombstoneEntity: ({ draftId, entityType, entityRef, ...body }: TombstoneCurriculumDraftEntityInput) =>
      request<CurriculumDraftMutationResult>(`${entityPath(draftId, entityType, entityRef)}/tombstone`, 'POST', body),
  })
}

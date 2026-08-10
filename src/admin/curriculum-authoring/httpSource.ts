import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  CurriculumDraftAuthoringError,
  type AddCurriculumDraftCollaboratorInput,
  type CreateCurriculumDraftEntityInput,
  type CreateCurriculumDraftInput,
  type CurriculumDraftAuthoringSource,
  type CurriculumDraftDetail,
  type CurriculumDraftCollaboratorMutationResult,
  type CurriculumDraftCollaborators,
  type CurriculumDraftMaterialization,
  type CurriculumDraftValidationResult,
  type CurriculumBaseAuthoringEntity,
  type CurriculumBaseAuthoringIndex,
  type CurriculumDraftEntityDetail,
  type CurriculumDraftEntityType,
  type CurriculumDraftMutationResult,
  type CurriculumDraftSummary,
  type TombstoneCurriculumDraftEntityInput,
  type RevokeCurriculumDraftCollaboratorInput,
  type UpdateCurriculumDraftEntityInput,
} from './contracts'

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

function failure(status: number, responseCode?: string): CurriculumDraftAuthoringError {
  if (status === 401) return new CurriculumDraftAuthoringError('unauthenticated')
  if (status === 403) return new CurriculumDraftAuthoringError('forbidden')
  if (status === 400 || status === 413 || status === 415 || status === 422) {
    return new CurriculumDraftAuthoringError(
      'invalid',
      responseCode === 'schema_v2_rejected'
        ? 'schema-v2-rejected'
        : responseCode === 'verified_admin_principal_required'
          ? 'verified-principal-required'
          : responseCode === 'last_editor_required'
            ? 'last-editor'
            : undefined,
    )
  }
  if (status === 404) return new CurriculumDraftAuthoringError('not-found')
  if (status === 409) {
    return new CurriculumDraftAuthoringError(
      'conflict',
      responseCode === 'idempotency_conflict'
        ? 'idempotency-conflict'
        : responseCode === 'collaborator_already_assigned'
          ? 'already-assigned'
          : 'revision-conflict',
    )
  }
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
    if (!response.ok) {
      let responseCode: string | undefined
      try {
        const failureBody = await response.json() as { error?: { code?: unknown } }
        if (typeof failureBody?.error?.code === 'string') responseCode = failureBody.error.code
      } catch {
        // Status remains authoritative when an intermediary strips the safe error envelope.
      }
      throw failure(response.status, responseCode)
    }
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
    listCollaborators: (draftId: string) => request<CurriculumDraftCollaborators>(
      `${basePath}/${encodeURIComponent(draftId)}/collaborators`,
    ),
    addCollaborator: ({ draftId, ...body }: AddCurriculumDraftCollaboratorInput) =>
      request<CurriculumDraftCollaboratorMutationResult>(
        `${basePath}/${encodeURIComponent(draftId)}/collaborators`, 'POST', body,
      ),
    revokeCollaborator: ({ draftId, principalRef, ...body }: RevokeCurriculumDraftCollaboratorInput) =>
      request<CurriculumDraftCollaboratorMutationResult>(
        `${basePath}/${encodeURIComponent(draftId)}/collaborators/${encodeURIComponent(principalRef)}/revoke`,
        'POST',
        body,
      ),
    readBaseIndex: (baseReleaseVersion: string) => request<CurriculumBaseAuthoringIndex>(
      `/api/admin/curriculum/releases/${encodeURIComponent(baseReleaseVersion)}/authoring-index`,
    ),
    readBaseEntity: (
      baseReleaseVersion: string,
      entityType: CurriculumDraftEntityType,
      entityRef: string,
    ) => request<CurriculumBaseAuthoringEntity>(
      `/api/admin/curriculum/releases/${encodeURIComponent(baseReleaseVersion)}/authoring/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityRef)}`,
    ),
    readMaterialization: (draftId: string, revision: number) => request<CurriculumDraftMaterialization>(
      `${basePath}/${encodeURIComponent(draftId)}/materialization/${revision}`,
    ),
    validateDraft: (draftId: string, revision: number) => request<CurriculumDraftValidationResult>(
      `${basePath}/${encodeURIComponent(draftId)}/validation/${revision}`,
    ),
  })
}

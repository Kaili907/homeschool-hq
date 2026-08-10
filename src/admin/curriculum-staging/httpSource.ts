import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  CurriculumStagingError,
  type CurriculumStagingInput,
  type CurriculumStagingMutationResult,
  type CurriculumStagingSource,
  type CurriculumStagingStatusResult,
} from './contracts'

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

function failure(status: number, responseCode?: string): CurriculumStagingError {
  if (status === 401) return new CurriculumStagingError('unauthenticated')
  if (status === 403) return new CurriculumStagingError('forbidden')
  if (status === 400 || status === 413 || status === 415 || status === 422) {
    return new CurriculumStagingError('invalid')
  }
  if (status === 404) return new CurriculumStagingError('not-found')
  if (status === 409) {
    const reason = responseCode === 'idempotency_conflict'
      ? 'idempotency-conflict'
      : responseCode === 'staging_gate_blocked'
        ? 'gate-blocked'
        : responseCode === 'target_version_collision'
          ? 'target-version-collision'
          : responseCode === 'staging_package_conflict'
            ? 'package-conflict'
            : 'revision-conflict'
    return new CurriculumStagingError('conflict', reason)
  }
  return new CurriculumStagingError('unavailable')
}

export function createCurriculumStagingHttpSource(
  fetchImpl: FetchLike = fetch,
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  basePath = '/api/admin/curriculum/drafts',
): CurriculumStagingSource {
  async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
    let token: string | null
    try {
      token = await getAccessToken()
    } catch {
      throw new CurriculumStagingError('unavailable')
    }
    if (!token) throw new CurriculumStagingError('unauthenticated')
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
      throw new CurriculumStagingError('unavailable')
    }
    if (!response.ok) {
      let responseCode: string | undefined
      try {
        const value = await response.json() as { error?: { code?: unknown } }
        if (typeof value?.error?.code === 'string') responseCode = value.error.code
      } catch {
        // HTTP status remains authoritative when a proxy strips the envelope.
      }
      throw failure(response.status, responseCode)
    }
    try {
      return await response.json() as T
    } catch {
      throw new CurriculumStagingError('unavailable')
    }
  }

  const stagingPath = (draftId: string) =>
    `${basePath}/${encodeURIComponent(draftId)}/staging`

  return Object.freeze({
    readStaging: (draftId: string) =>
      request<CurriculumStagingStatusResult>(stagingPath(draftId)),
    stageDraft: ({ draftId, ...body }: CurriculumStagingInput) =>
      request<CurriculumStagingMutationResult>(stagingPath(draftId), 'POST', body),
  })
}

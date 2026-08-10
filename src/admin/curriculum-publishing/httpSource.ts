import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  CurriculumPublishingError,
  type CurriculumPublishingInput,
  type CurriculumPublishingMutationResult,
  type CurriculumPublishingSource,
  type CurriculumPublishingStatusResult,
} from './contracts'

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

function failure(status: number, responseCode?: string): CurriculumPublishingError {
  if (status === 401) return new CurriculumPublishingError('unauthenticated')
  if (status === 403) return new CurriculumPublishingError('forbidden')
  if (status === 400 || status === 413 || status === 415 || status === 422) {
    return new CurriculumPublishingError('invalid')
  }
  if (status === 404) return new CurriculumPublishingError('not-found')
  if (status === 409) {
    const reasons: Readonly<Record<string, CurriculumPublishingError['reason']>> = {
      publication_artifact_invalid: 'artifact-invalid',
      publication_manifest_mismatch: 'manifest-mismatch',
      publication_package_mismatch: 'package-mismatch',
      publication_approval_stale: 'approval-stale',
      publication_validation_blocked: 'validation-blocked',
      publication_human_review_blocked: 'human-review-blocked',
      target_version_collision: 'target-version-collision',
      revision_conflict: 'revision-conflict',
      idempotency_conflict: 'idempotency-conflict',
      publication_gate_blocked: 'gate-blocked',
    }
    return new CurriculumPublishingError('conflict', responseCode ? reasons[responseCode] : undefined)
  }
  return new CurriculumPublishingError('unavailable')
}

export function createCurriculumPublishingHttpSource(
  fetchImpl: FetchLike = fetch,
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  basePath = '/api/admin/curriculum/drafts',
): CurriculumPublishingSource {
  async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
    let token: string | null
    try {
      token = await getAccessToken()
    } catch {
      throw new CurriculumPublishingError('unavailable')
    }
    if (!token) throw new CurriculumPublishingError('unauthenticated')
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
      throw new CurriculumPublishingError('unavailable')
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
      throw new CurriculumPublishingError('unavailable')
    }
  }

  const path = (draftId: string) => `${basePath}/${encodeURIComponent(draftId)}/publishing`
  return Object.freeze({
    readPublication: (draftId: string) => request<CurriculumPublishingStatusResult>(path(draftId)),
    publishStaged: ({ draftId, ...body }: CurriculumPublishingInput) =>
      request<CurriculumPublishingMutationResult>(path(draftId), 'POST', body),
  })
}

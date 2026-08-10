import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  CurriculumApprovalError,
  type CurriculumApprovalDecisionInput,
  type CurriculumApprovalMutationResult,
  type CurriculumApprovalSource,
  type CurriculumApprovalStatusResult,
} from './contracts'

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

function failure(status: number, responseCode?: string): CurriculumApprovalError {
  if (status === 401) return new CurriculumApprovalError('unauthenticated')
  if (status === 403) return new CurriculumApprovalError('forbidden')
  if (status === 400 || status === 413 || status === 415 || status === 422) {
    return new CurriculumApprovalError('invalid')
  }
  if (status === 404) return new CurriculumApprovalError('not-found')
  if (status === 409) {
    const reason = responseCode === 'idempotency_conflict'
      ? 'idempotency-conflict'
      : responseCode === 'validation_blocked'
        ? 'validation-blocked'
        : responseCode === 'approval_transition_conflict'
          ? 'decision-conflict'
          : 'revision-conflict'
    return new CurriculumApprovalError('conflict', reason)
  }
  return new CurriculumApprovalError('unavailable')
}

export function createCurriculumApprovalHttpSource(
  fetchImpl: FetchLike = fetch,
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  basePath = '/api/admin/curriculum/drafts',
): CurriculumApprovalSource {
  async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
    let token: string | null
    try {
      token = await getAccessToken()
    } catch {
      throw new CurriculumApprovalError('unavailable')
    }
    if (!token) throw new CurriculumApprovalError('unauthenticated')
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
      throw new CurriculumApprovalError('unavailable')
    }
    if (!response.ok) {
      let responseCode: string | undefined
      try {
        const body = await response.json() as { error?: { code?: unknown } }
        if (typeof body?.error?.code === 'string') responseCode = body.error.code
      } catch {
        // The status remains authoritative when a proxy strips the safe envelope.
      }
      throw failure(response.status, responseCode)
    }
    try {
      return await response.json() as T
    } catch {
      throw new CurriculumApprovalError('unavailable')
    }
  }

  const approvalPath = (draftId: string) =>
    `${basePath}/${encodeURIComponent(draftId)}/approval`

  return Object.freeze({
    readApproval: (draftId: string) =>
      request<CurriculumApprovalStatusResult>(approvalPath(draftId)),
    decideApproval: ({ draftId, ...body }: CurriculumApprovalDecisionInput) =>
      request<CurriculumApprovalMutationResult>(approvalPath(draftId), 'POST', body),
  })
}

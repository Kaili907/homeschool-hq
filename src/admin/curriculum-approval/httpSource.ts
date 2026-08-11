import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  CURRICULUM_APPROVAL_DECISIONS,
  CURRICULUM_APPROVAL_REASON_CODES,
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
  async function request(path: string, method = 'GET', body?: object): Promise<unknown> {
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
      return await response.json()
    } catch {
      throw new CurriculumApprovalError('unavailable')
    }
  }

  const approvalPath = (draftId: string) =>
    `${basePath}/${encodeURIComponent(draftId)}/approval`

  return Object.freeze({
    async readApproval(draftId: string) {
      const projected = adaptApproval(
        await request(approvalPath(draftId)), draftId, false,
      ) as CurriculumApprovalStatusResult | null
      if (!projected) throw new CurriculumApprovalError('unavailable')
      return projected
    },
    async decideApproval({ draftId, ...body }: CurriculumApprovalDecisionInput) {
      const projected = adaptApproval(
        await request(approvalPath(draftId), 'POST', body), draftId, true,
      ) as CurriculumApprovalMutationResult | null
      if (!projected) throw new CurriculumApprovalError('unavailable')
      return projected
    },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/
const HASH = /^[0-9a-f]{64}$/
const APPROVAL_STATUSES = new Set(['pending_review', 'approved', 'changes_requested', 'stale'])
const VALIDATION_STATUSES = new Set(['valid', 'invalid', 'incomplete', 'unavailable', 'error'])
const GATE_REASONS = new Set([
  'approved', 'approval_missing', 'approval_stale', 'changes_requested',
  'validation_missing', 'validation_blocked',
])

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => key in value)
}

function integer(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function validation(value: unknown) {
  if (!record(value) || !exact(value, [
    'validationSnapshotId', 'draftRevision', 'engineVersion', 'resultDigest', 'status',
    'publicationReady', 'blockingCount', 'blockingErrorCount', 'humanReviewBlockerCount', 'validatedAt',
  ]) || typeof value.validationSnapshotId !== 'string' || !UUID.test(value.validationSnapshotId)
    || !integer(value.draftRevision, 1) || typeof value.engineVersion !== 'string' || value.engineVersion.length > 80
    || typeof value.resultDigest !== 'string' || !HASH.test(value.resultDigest)
    || typeof value.status !== 'string' || !VALIDATION_STATUSES.has(value.status)
    || typeof value.publicationReady !== 'boolean' || !integer(value.blockingCount)
    || !integer(value.blockingErrorCount) || value.blockingErrorCount > value.blockingCount
    || !integer(value.humanReviewBlockerCount) || value.humanReviewBlockerCount > value.blockingCount
    || !timestamp(value.validatedAt)) return null
  return Object.freeze({ ...value })
}

function historyEntry(value: unknown) {
  if (!record(value) || !exact(value, [
    'approvalId', 'draftRevision', 'decision', 'reasonCode', 'validationSnapshotId',
    'validationResultDigest', 'reviewerRole', 'decidedAt', 'bindingStatus',
  ]) || typeof value.approvalId !== 'string' || !UUID.test(value.approvalId)
    || !integer(value.draftRevision, 1) || !CURRICULUM_APPROVAL_DECISIONS.includes(value.decision as never)
    || !CURRICULUM_APPROVAL_REASON_CODES.includes(value.reasonCode as never)
    || (value.validationSnapshotId !== null && (typeof value.validationSnapshotId !== 'string' || !UUID.test(value.validationSnapshotId)))
    || (value.validationResultDigest !== null && (typeof value.validationResultDigest !== 'string' || !HASH.test(value.validationResultDigest)))
    || value.reviewerRole !== 'owner' || !timestamp(value.decidedAt)
    || !['current', 'superseded'].includes(String(value.bindingStatus))) return null
  return Object.freeze({ ...value })
}

function adaptApproval(value: unknown, expectedDraftId: string, mutation: boolean) {
  const keys = [
    'schemaVersion', ...(mutation ? ['replayed'] : []), 'draftId', 'draftRevision',
    'baseReleaseVersion', 'targetVersion', 'schemaSetVersion', 'status', 'latestValidation',
    'currentDecision', 'staleApproval', 'history', 'publishGate',
  ]
  if (!record(value) || !exact(value, keys) || value.schemaVersion !== 1
    || (mutation && typeof value.replayed !== 'boolean') || value.draftId !== expectedDraftId
    || !integer(value.draftRevision, 1) || typeof value.baseReleaseVersion !== 'string' || !VERSION.test(value.baseReleaseVersion)
    || typeof value.targetVersion !== 'string' || !VERSION.test(value.targetVersion)
    || value.schemaSetVersion !== '2.0.0' || typeof value.status !== 'string' || !APPROVAL_STATUSES.has(value.status)
    || !Array.isArray(value.history) || value.history.length > 1_000 || !record(value.publishGate)) return null
  const latestValidation = value.latestValidation === null ? null : validation(value.latestValidation)
  const currentDecision = value.currentDecision === null ? null : historyEntry(value.currentDecision)
  const staleApproval = value.staleApproval === null ? null : historyEntry(value.staleApproval)
  const history = value.history.map(historyEntry)
  const gate = value.publishGate
  if ((value.latestValidation !== null && !latestValidation) || (value.currentDecision !== null && !currentDecision)
    || (value.staleApproval !== null && !staleApproval) || history.some((entry) => entry === null)
    || !exact(gate, ['eligible', 'reason', 'approvalId', 'draftRevision', 'validationSnapshotId'])
    || typeof gate.eligible !== 'boolean' || typeof gate.reason !== 'string' || !GATE_REASONS.has(gate.reason)
    || (gate.approvalId !== null && (typeof gate.approvalId !== 'string' || !UUID.test(gate.approvalId)))
    || !integer(gate.draftRevision, 1)
    || (gate.validationSnapshotId !== null && (typeof gate.validationSnapshotId !== 'string' || !UUID.test(gate.validationSnapshotId)))) return null
  return Object.freeze({
    ...value,
    latestValidation,
    currentDecision,
    staleApproval,
    history: Object.freeze(history),
    publishGate: Object.freeze({ ...gate }),
  })
}

import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from '../adminDependencyTimeout'
import {
  CurriculumStagingError,
  type CurriculumStagedCandidate,
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
  timeoutMs = 10_000,
): CurriculumStagingSource {
  const boundedToken = () => withAdminDependencyTimeout(() => getAccessToken(), timeoutMs)
  const boundedFetch: FetchLike = (input, init) => withAdminDependencyTimeout(
    (signal) => fetchImpl(input, { ...init, signal }), timeoutMs,
  )
  async function request(path: string, method = 'GET', body?: object): Promise<unknown> {
    let token: string | null
    try {
      token = await boundedToken()
    } catch {
      throw new CurriculumStagingError('unavailable')
    }
    if (!token) throw new CurriculumStagingError('unauthenticated')
    let response: Pick<Response, 'ok' | 'status' | 'json'>
    try {
      response = await boundedFetch(path, {
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
      return await response.json()
    } catch {
      throw new CurriculumStagingError('unavailable')
    }
  }

  const stagingPath = (draftId: string) =>
    `${basePath}/${encodeURIComponent(draftId)}/staging`

  return Object.freeze({
    async readStaging(draftId: string) {
      const projected = adaptStaging(
        await request(stagingPath(draftId)), draftId, false,
      ) as CurriculumStagingStatusResult | null
      if (!projected) throw new CurriculumStagingError('unavailable')
      return projected
    },
    async stageDraft({ draftId, ...body }: CurriculumStagingInput) {
      const projected = adaptStaging(
        await request(stagingPath(draftId), 'POST', body), draftId, true,
      ) as CurriculumStagingMutationResult | null
      if (!projected || projected.stageState !== 'staged'
        || projected.candidate?.publicationStatus !== 'not_published') {
        throw new CurriculumStagingError('unavailable')
      }
      return projected
    },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/
const HASH = /^[0-9a-f]{64}$/
const BLOCKERS = new Set([
  'validation_missing', 'validation_blocked', 'approval_missing', 'approval_stale',
  'changes_requested', 'target_version_collision', 'revision_mismatch', 'schema_set_unsupported',
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

function candidate(value: unknown): CurriculumStagedCandidate | null {
  if (!record(value) || !exact(value, [
    'stagingId', 'status', 'publicationStatus', 'validationSnapshotId', 'approvalId',
    'entityCounts', 'fileCount', 'byteCount', 'contentHash', 'manifestHash', 'packageHash',
    'stagedAt', 'authority',
  ]) || typeof value.stagingId !== 'string' || !UUID.test(value.stagingId) || value.status !== 'staged'
    || !['not_published', 'published'].includes(String(value.publicationStatus))
    || typeof value.validationSnapshotId !== 'string'
    || !UUID.test(value.validationSnapshotId) || typeof value.approvalId !== 'string' || !UUID.test(value.approvalId)
    || !record(value.entityCounts) || Object.keys(value.entityCounts).length > 100
    || Object.entries(value.entityCounts).some(([key, count]) => !/^[a-z][a-z_]{0,63}$/.test(key) || !integer(count))
    || !integer(value.fileCount, 1) || !integer(value.byteCount, 1)
    || typeof value.contentHash !== 'string' || !HASH.test(value.contentHash)
    || typeof value.manifestHash !== 'string' || !HASH.test(value.manifestHash)
    || typeof value.packageHash !== 'string' || !HASH.test(value.packageHash)
    || !timestamp(value.stagedAt) || value.authority !== 'curriculum:publish') return null
  return Object.freeze({
    ...value,
    entityCounts: Object.freeze({ ...value.entityCounts }),
  }) as unknown as CurriculumStagedCandidate
}

function adaptStaging(value: unknown, expectedDraftId: string, mutation: boolean) {
  const keys = [
    'schemaVersion', ...(mutation ? ['replayed'] : []), 'draftId', 'draftRevision',
    'baseReleaseVersion', 'targetVersion', 'schemaSetVersion', 'stageState', 'eligible',
    'blockingReasons', 'validation', 'approval', 'candidate',
  ]
  if (!record(value) || !exact(value, keys) || value.schemaVersion !== 1
    || (mutation && typeof value.replayed !== 'boolean') || value.draftId !== expectedDraftId
    || !integer(value.draftRevision, 1) || typeof value.baseReleaseVersion !== 'string' || !VERSION.test(value.baseReleaseVersion)
    || typeof value.targetVersion !== 'string' || !VERSION.test(value.targetVersion)
    || value.schemaSetVersion !== '2.0.0' || !['blocked', 'eligible', 'staged'].includes(String(value.stageState))
    || typeof value.eligible !== 'boolean' || !Array.isArray(value.blockingReasons) || value.blockingReasons.length > BLOCKERS.size
    || value.blockingReasons.some((reason) => typeof reason !== 'string' || !BLOCKERS.has(reason))
    || new Set(value.blockingReasons).size !== value.blockingReasons.length) return null
  const validation = value.validation
  const approval = value.approval
  const stagedCandidate = value.candidate === null ? null : candidate(value.candidate)
  if ((validation !== null && (!record(validation) || !exact(validation, ['status', 'validationSnapshotId'])
      || !['valid', 'invalid', 'incomplete', 'unavailable', 'error'].includes(String(validation.status))
      || typeof validation.validationSnapshotId !== 'string' || !UUID.test(validation.validationSnapshotId)))
    || (approval !== null && (!record(approval) || !exact(approval, ['status', 'approvalId'])
      || !['approved', 'changes_requested', 'stale'].includes(String(approval.status))
      || (approval.approvalId !== null && (typeof approval.approvalId !== 'string' || !UUID.test(approval.approvalId)))))
    || (value.candidate !== null && !stagedCandidate)) return null
  const eligibleState = value.stageState === 'eligible'
  const validEvidence = validation !== null && validation.status === 'valid'
    && approval !== null && approval.status === 'approved' && approval.approvalId !== null
  if (
    value.eligible !== eligibleState
    || (eligibleState && (!validEvidence || value.blockingReasons.length !== 0 || stagedCandidate !== null))
    || (value.stageState === 'blocked' && (value.blockingReasons.length === 0 || stagedCandidate !== null))
    || (value.stageState === 'staged' && (
      value.eligible || value.blockingReasons.length !== 0 || !validEvidence || stagedCandidate === null
      || stagedCandidate.validationSnapshotId !== validation?.validationSnapshotId
      || stagedCandidate.approvalId !== approval?.approvalId
    ))
  ) return null
  return Object.freeze({
    ...value,
    blockingReasons: Object.freeze([...value.blockingReasons]),
    validation: validation === null ? null : Object.freeze({ ...validation }),
    approval: approval === null ? null : Object.freeze({ ...approval }),
    candidate: stagedCandidate,
  })
}

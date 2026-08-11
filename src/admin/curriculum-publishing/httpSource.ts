import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import { withAdminDependencyTimeout } from '../adminDependencyTimeout'
import {
  CurriculumPublishingError,
  type CurriculumPublicationCandidate,
  type CurriculumPublicationVerification,
  type CurriculumPublishingInput,
  type CurriculumPublishingMutationResult,
  type CurriculumPublishingSource,
  type CurriculumPublishingStatusResult,
  type PublishedCurriculumRelease,
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HASH = /^[0-9a-f]{64}$/
const VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/
const STATES = new Set(['not_staged', 'blocked', 'eligible', 'published'])
const BLOCKERS = new Set([
  'staged_candidate_missing', 'staging_identity_mismatch', 'artifact_set_incomplete',
  'artifact_tampered', 'manifest_mismatch', 'package_mismatch', 'approval_stale',
  'validation_blocked', 'human_review_blocked', 'target_version_collision',
])

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return record(value) && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key))
}

function integer(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && Number(value) >= minimum
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function verification(value: unknown): CurriculumPublicationVerification | null {
  if (!exact(value, [
    'artifactSetComplete', 'contentVerified', 'manifestVerified', 'packageVerified',
    'actualFileCount', 'actualByteCount',
  ]) || typeof value.artifactSetComplete !== 'boolean'
    || typeof value.contentVerified !== 'boolean'
    || typeof value.manifestVerified !== 'boolean'
    || typeof value.packageVerified !== 'boolean'
    || !integer(value.actualFileCount) || !integer(value.actualByteCount)) return null
  return Object.freeze({ ...value }) as unknown as CurriculumPublicationVerification
}

function candidate(value: unknown): CurriculumPublicationCandidate | null {
  const checkedVerification = record(value) ? verification(value.verification) : null
  if (!exact(value, [
    'stagingId', 'status', 'draftRevision', 'validationSnapshotId', 'validationStatus',
    'approvalId', 'approvalStatus', 'humanReviewStatus', 'fileCount', 'byteCount',
    'contentHash', 'manifestHash', 'packageHash', 'verification',
  ]) || !UUID.test(String(value.stagingId)) || value.status !== 'staged'
    || !integer(value.draftRevision, 1) || !UUID.test(String(value.validationSnapshotId))
    || !['publication_ready', 'blocked'].includes(String(value.validationStatus))
    || !UUID.test(String(value.approvalId)) || !['current', 'stale'].includes(String(value.approvalStatus))
    || !['clear', 'blocked'].includes(String(value.humanReviewStatus))
    || !integer(value.fileCount, 1) || !integer(value.byteCount, 1)
    || !HASH.test(String(value.contentHash)) || !HASH.test(String(value.manifestHash))
    || !HASH.test(String(value.packageHash)) || !checkedVerification) return null
  return Object.freeze({ ...value, verification: checkedVerification }) as unknown as CurriculumPublicationCandidate
}

function published(value: unknown): PublishedCurriculumRelease | null {
  if (!exact(value, [
    'releaseId', 'version', 'status', 'activationStatus', 'stagingId', 'contentHash',
    'manifestHash', 'packageHash', 'fileCount', 'byteCount', 'publishedAt', 'authority',
  ]) || !UUID.test(String(value.releaseId)) || !VERSION.test(String(value.version))
    || value.status !== 'published' || value.activationStatus !== 'not_active'
    || !UUID.test(String(value.stagingId)) || !HASH.test(String(value.contentHash))
    || !HASH.test(String(value.manifestHash)) || !HASH.test(String(value.packageHash))
    || !integer(value.fileCount, 1) || !integer(value.byteCount, 1)
    || !timestamp(value.publishedAt) || value.authority !== 'curriculum:publish') return null
  return Object.freeze({ ...value }) as unknown as PublishedCurriculumRelease
}

export function parseCurriculumPublishingStatus(
  value: unknown,
  expectedDraftId: string,
): CurriculumPublishingStatusResult | null {
  if (!exact(value, [
    'schemaVersion', 'draftId', 'draftRevision', 'baseReleaseVersion', 'targetVersion',
    'schemaSetVersion', 'publicationState', 'eligible', 'blockingReasons', 'candidate', 'published',
  ]) || value.schemaVersion !== 1 || value.draftId !== expectedDraftId
    || !UUID.test(String(value.draftId)) || !integer(value.draftRevision, 1)
    || !VERSION.test(String(value.baseReleaseVersion)) || !VERSION.test(String(value.targetVersion))
    || value.schemaSetVersion !== '2.0.0' || !STATES.has(String(value.publicationState))
    || typeof value.eligible !== 'boolean' || !Array.isArray(value.blockingReasons)
    || value.blockingReasons.length > BLOCKERS.size
    || value.blockingReasons.some((reason) => typeof reason !== 'string' || !BLOCKERS.has(reason))
    || new Set(value.blockingReasons).size !== value.blockingReasons.length) return null
  const checkedCandidate = value.candidate === null ? null : candidate(value.candidate)
  const checkedPublished = value.published === null ? null : published(value.published)
  if ((value.candidate !== null && !checkedCandidate) || (value.published !== null && !checkedPublished)) return null
  const verifiedCandidate = checkedCandidate !== null
    && checkedCandidate.draftRevision === value.draftRevision
    && checkedCandidate.validationStatus === 'publication_ready'
    && checkedCandidate.approvalStatus === 'current'
    && checkedCandidate.humanReviewStatus === 'clear'
    && checkedCandidate.verification.artifactSetComplete === true
    && checkedCandidate.verification.contentVerified === true
    && checkedCandidate.verification.manifestVerified === true
    && checkedCandidate.verification.packageVerified === true
    && checkedCandidate.verification.actualFileCount === checkedCandidate.fileCount
    && checkedCandidate.verification.actualByteCount === checkedCandidate.byteCount
  if (
    value.eligible !== (value.publicationState === 'eligible')
    || (value.publicationState === 'not_staged') !== (checkedCandidate === null)
    || (value.publicationState === 'published') !== (checkedPublished !== null)
    || (value.publicationState === 'blocked') !== (value.blockingReasons.length > 0 && checkedCandidate !== null)
    || (value.publicationState === 'eligible' && (value.blockingReasons.length > 0 || !verifiedCandidate))
    || (checkedPublished !== null && (
      !checkedCandidate || checkedPublished.stagingId !== checkedCandidate.stagingId
      || checkedPublished.version !== value.targetVersion
      || checkedPublished.contentHash !== checkedCandidate.contentHash
      || checkedPublished.manifestHash !== checkedCandidate.manifestHash
      || checkedPublished.packageHash !== checkedCandidate.packageHash
      || checkedPublished.fileCount !== checkedCandidate.fileCount
      || checkedPublished.byteCount !== checkedCandidate.byteCount
    ))
  ) return null
  return Object.freeze({
    ...value,
    blockingReasons: Object.freeze([...value.blockingReasons]),
    candidate: checkedCandidate,
    published: checkedPublished,
  }) as unknown as CurriculumPublishingStatusResult
}

function parseCurriculumPublishingMutation(
  value: unknown,
  expectedDraftId: string,
): CurriculumPublishingMutationResult | null {
  if (!record(value) || typeof value.replayed !== 'boolean') return null
  const { replayed, ...statusValue } = value
  const projected = parseCurriculumPublishingStatus(statusValue, expectedDraftId)
  return projected?.publicationState === 'published' && projected.published !== null
    ? Object.freeze({ ...projected, replayed })
    : null
}

export function createCurriculumPublishingHttpSource(
  fetchImpl: FetchLike = fetch,
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  basePath = '/api/admin/curriculum/drafts',
  timeoutMs = 10_000,
): CurriculumPublishingSource {
  const boundedToken = () => withAdminDependencyTimeout(() => getAccessToken(), timeoutMs)
  const boundedFetch: FetchLike = (input, init) => withAdminDependencyTimeout(
    (signal) => fetchImpl(input, { ...init, signal }), timeoutMs,
  )
  async function request(path: string, method = 'GET', body?: object): Promise<unknown> {
    let token: string | null
    try {
      token = await boundedToken()
    } catch {
      throw new CurriculumPublishingError('unavailable')
    }
    if (!token) throw new CurriculumPublishingError('unauthenticated')
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
      return await response.json()
    } catch {
      throw new CurriculumPublishingError('unavailable')
    }
  }

  const path = (draftId: string) => `${basePath}/${encodeURIComponent(draftId)}/publishing`
  return Object.freeze({
    async readPublication(draftId: string) {
      const projected = parseCurriculumPublishingStatus(await request(path(draftId)), draftId)
      if (!projected) throw new CurriculumPublishingError('unavailable')
      return projected
    },
    async publishStaged({ draftId, ...body }: CurriculumPublishingInput) {
      const projected = parseCurriculumPublishingMutation(
        await request(path(draftId), 'POST', body), draftId,
      )
      if (!projected || projected.candidate?.stagingId !== body.stagingId) {
        throw new CurriculumPublishingError('unavailable')
      }
      return projected
    },
  })
}

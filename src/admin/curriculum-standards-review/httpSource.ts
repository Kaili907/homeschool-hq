import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION,
  CURRICULUM_STANDARDS_REVIEW_STATES,
  CurriculumStandardsReviewError,
  type CurriculumStandardsReviewContextKind,
  type CurriculumStandardsReviewDecision,
  type CurriculumDraftStandardsReviewWorkspace,
  type CurriculumStandardsReviewMutationInput,
  type CurriculumStandardsReviewMutationResult,
  type CurriculumStandardsReviewOccurrence,
  type CurriculumStandardsReviewSource,
} from './contracts'

type FetchLike = (input: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'json'>>

function failure(status: number): CurriculumStandardsReviewError {
  if (status === 401) return new CurriculumStandardsReviewError('unauthenticated')
  if (status === 403) return new CurriculumStandardsReviewError('forbidden')
  if (status === 400 || status === 413 || status === 415 || status === 422) return new CurriculumStandardsReviewError('invalid')
  if (status === 409) return new CurriculumStandardsReviewError('conflict')
  return new CurriculumStandardsReviewError('unavailable')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function decision(value: unknown): CurriculumStandardsReviewDecision | null {
  if (!isRecord(value)) return null
  if (
    value.schemaVersion !== CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION
    || typeof value.reviewKey !== 'string'
    || !['published_release', 'draft'].includes(String(value.contextKind))
    || typeof value.contextRef !== 'string'
    || typeof value.sourceLabel !== 'string'
    || !Number.isSafeInteger(value.grade)
    || typeof value.courseRef !== 'string'
    || value.findingRule !== 'standards.human_review_required'
    || !Number.isSafeInteger(value.affectedCount)
    || !Array.isArray(value.findingIds)
    || value.findingIds.some((findingId) => typeof findingId !== 'string')
    || !CURRICULUM_STANDARDS_REVIEW_STATES.includes(value.status as never)
    || !Number.isSafeInteger(value.revision)
    || typeof value.updatedAt !== 'string'
  ) return null
  for (const key of ['canonicalStandardId', 'frameworkVersion', 'canonicalTitle', 'evidenceSource', 'reviewerNote']) {
    if (value[key] !== null && typeof value[key] !== 'string') return null
  }
  return value as unknown as CurriculumStandardsReviewDecision
}

function list(value: unknown) {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.decisions) || value.decisions.length > 10_000) return null
  const decisions = value.decisions.map(decision)
  return decisions.some((item) => item === null) ? null : {
    schemaVersion: CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION,
    decisions: decisions as readonly CurriculumStandardsReviewDecision[],
  }
}

function mutation(value: unknown): CurriculumStandardsReviewMutationResult | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.replayed !== 'boolean') return null
  const projected = decision(value.decision)
  return projected ? { schemaVersion: 1, replayed: value.replayed, decision: projected } : null
}

function occurrence(value: unknown): CurriculumStandardsReviewOccurrence | null {
  if (!isRecord(value) || !isRecord(value.finding)) return null
  const finding = value.finding
  if (!isRecord(finding.entity)) return null
  const entity = finding.entity
  if (
    typeof value.sourceLabel !== 'string'
    || !Number.isSafeInteger(value.grade)
    || typeof value.courseRef !== 'string'
    || typeof finding.id !== 'string'
    || !['error', 'warning', 'info'].includes(String(finding.severity))
    || typeof finding.category !== 'string'
    || typeof entity.type !== 'string'
    || (entity.id !== null && typeof entity.id !== 'string')
    || typeof finding.path !== 'string'
    || typeof finding.rule !== 'string'
    || typeof finding.explanation !== 'string'
    || typeof finding.blocking !== 'boolean'
    || (finding.remediation !== undefined && typeof finding.remediation !== 'string')
  ) return null
  return value as unknown as CurriculumStandardsReviewOccurrence
}

export function adaptCurriculumDraftStandardsReviewWorkspace(
  value: unknown,
  expectedDraftId: string,
  expectedDraftRevision: number,
): CurriculumDraftStandardsReviewWorkspace | null {
  if (
    !isRecord(value)
    || value.schemaVersion !== CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION
    || value.draftId !== expectedDraftId
    || value.draftRevision !== expectedDraftRevision
    || typeof value.baseReleaseVersion !== 'string'
    || typeof value.targetVersion !== 'string'
    || !Array.isArray(value.occurrences)
    || value.occurrences.length > 10_000
    || !Array.isArray(value.decisions)
    || value.decisions.length > 10_000
  ) return null
  const occurrences = value.occurrences.map(occurrence)
  const decisions = value.decisions.map(decision)
  if (occurrences.some((item) => item === null) || decisions.some((item) => item === null)) return null
  return {
    schemaVersion: CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION,
    draftId: expectedDraftId,
    draftRevision: expectedDraftRevision,
    baseReleaseVersion: value.baseReleaseVersion,
    targetVersion: value.targetVersion,
    occurrences: occurrences as readonly CurriculumStandardsReviewOccurrence[],
    decisions: decisions as readonly CurriculumStandardsReviewDecision[],
  }
}

export function createCurriculumStandardsReviewHttpSource(
  fetchImpl: FetchLike = fetch,
  getAccessToken: () => Promise<string | null> = getGatewayAccessToken,
  basePath = '/api/admin/curriculum/standards-reviews',
  draftBasePath = '/api/admin/curriculum/drafts',
): CurriculumStandardsReviewSource {
  async function request(path: string, method = 'GET', body?: object): Promise<unknown> {
    let token: string | null
    try {
      token = await getAccessToken()
    } catch {
      throw new CurriculumStandardsReviewError('unavailable')
    }
    if (!token) throw new CurriculumStandardsReviewError('unauthenticated')
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
      throw new CurriculumStandardsReviewError('unavailable')
    }
    if (!response.ok) throw failure(response.status)
    try {
      return await response.json()
    } catch {
      throw new CurriculumStandardsReviewError('unavailable')
    }
  }

  return Object.freeze({
    async list(contextKind: CurriculumStandardsReviewContextKind, contextRef: string) {
      const value = await request(`${basePath}/${encodeURIComponent(contextKind)}/${encodeURIComponent(contextRef)}`)
      const projected = list(value)
      if (!projected) throw new CurriculumStandardsReviewError('unavailable')
      return projected
    },
    async readDraftWorkspace(draftId: string, draftRevision: number) {
      const value = await request(
        `${draftBasePath}/${encodeURIComponent(draftId)}/standards-review/${draftRevision}`,
      )
      const projected = adaptCurriculumDraftStandardsReviewWorkspace(value, draftId, draftRevision)
      if (!projected) throw new CurriculumStandardsReviewError('unavailable')
      return projected
    },
    async update(input: CurriculumStandardsReviewMutationInput) {
      const { entities, ...review } = input
      const value = await request(basePath, 'POST', {
        ...review,
        findingIds: entities.map((entity) => entity.findingId),
      })
      const projected = mutation(value)
      if (!projected) throw new CurriculumStandardsReviewError('unavailable')
      return projected
    },
  })
}

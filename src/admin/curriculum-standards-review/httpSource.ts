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

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key)) && keys.every((key) => key in value)
}

function bounded(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value)
}

function decision(
  value: unknown,
  expectedContextKind?: CurriculumStandardsReviewContextKind,
  expectedContextRef?: string,
): CurriculumStandardsReviewDecision | null {
  if (!isRecord(value) || !exact(value, [
    'schemaVersion', 'reviewKey', 'contextKind', 'contextRef', 'sourceLabel', 'grade',
    'courseRef', 'findingRule', 'affectedCount', 'findingIds', 'status',
    'canonicalStandardId', 'frameworkVersion', 'canonicalTitle', 'evidenceSource',
    'reviewerNote', 'revision', 'updatedAt',
  ])) return null
  if (
    value.schemaVersion !== CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION
    || typeof value.reviewKey !== 'string' || !/^csr-[0-9a-f]{16}$/.test(value.reviewKey)
    || !['published_release', 'draft'].includes(String(value.contextKind))
    || (expectedContextKind !== undefined && value.contextKind !== expectedContextKind)
    || !bounded(value.contextRef, 128) || (expectedContextRef !== undefined && value.contextRef !== expectedContextRef)
    || !bounded(value.sourceLabel, 240)
    // Deliberately a RANGE bound, not curriculum-supported membership: standards
    // review covers findings across the whole 0-12 span (including grade 6 and
    // the 0 sentinel), so isSupportedAcademyGrade would reject valid findings.
    || !Number.isSafeInteger(value.grade) || Number(value.grade) < 0 || Number(value.grade) > 12
    || typeof value.courseRef !== 'string' || !/^[a-z0-9][a-z0-9:-]{2,127}$/.test(value.courseRef)
    || value.findingRule !== 'standards.human_review_required'
    || !Number.isSafeInteger(value.affectedCount) || Number(value.affectedCount) < 1
    || !Array.isArray(value.findingIds) || value.findingIds.length !== value.affectedCount || value.findingIds.length > 1_000
    || value.findingIds.some((findingId) => typeof findingId !== 'string' || !/^cvf-[0-9a-f]{16}$/.test(findingId))
    || new Set(value.findingIds).size !== value.findingIds.length
    || !CURRICULUM_STANDARDS_REVIEW_STATES.includes(value.status as never)
    || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1
    || typeof value.updatedAt !== 'string' || value.updatedAt.length > 40 || Number.isNaN(Date.parse(value.updatedAt))
  ) return null
  for (const [key, maximum] of [
    ['canonicalStandardId', 160], ['frameworkVersion', 160], ['canonicalTitle', 500],
    ['evidenceSource', 1000], ['reviewerNote', 500],
  ] as const) {
    if (value[key] !== null && !bounded(value[key], maximum)) return null
  }
  return Object.freeze({ ...value, findingIds: Object.freeze([...value.findingIds]) }) as unknown as CurriculumStandardsReviewDecision
}

function list(value: unknown, expectedContextKind: CurriculumStandardsReviewContextKind, expectedContextRef: string) {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'decisions']) || value.schemaVersion !== 1
    || !Array.isArray(value.decisions) || value.decisions.length > 10_000) return null
  const decisions = value.decisions.map((item) => decision(item, expectedContextKind, expectedContextRef))
  return decisions.some((item) => item === null) ? null : {
    schemaVersion: CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION,
    decisions: decisions as readonly CurriculumStandardsReviewDecision[],
  }
}

function mutation(
  value: unknown,
  input: CurriculumStandardsReviewMutationInput,
): CurriculumStandardsReviewMutationResult | null {
  if (!isRecord(value) || !exact(value, ['schemaVersion', 'replayed', 'decision'])
    || value.schemaVersion !== 1 || typeof value.replayed !== 'boolean') return null
  const projected = decision(value.decision, input.contextKind, input.contextRef)
  return projected && projected.reviewKey === input.reviewKey
    && projected.findingIds.length === input.entities.length
    && projected.findingIds.every((findingId, index) => findingId === input.entities[index]?.findingId)
    ? { schemaVersion: 1, replayed: value.replayed, decision: projected }
    : null
}

function occurrence(value: unknown): CurriculumStandardsReviewOccurrence | null {
  if (!isRecord(value) || !exact(value, ['finding', 'sourceLabel', 'grade', 'courseRef']) || !isRecord(value.finding)) return null
  const finding = value.finding
  const findingKeys = ['id', 'severity', 'category', 'entity', 'path', 'rule', 'explanation', 'blocking']
  if (!exact(finding, [...findingKeys, ...(finding.remediation === undefined ? [] : ['remediation'])])
    || !isRecord(finding.entity) || !exact(finding.entity, ['type', 'id'])) return null
  const entity = finding.entity
  if (
    !bounded(value.sourceLabel, 240)
    || !Number.isSafeInteger(value.grade) || Number(value.grade) < 0 || Number(value.grade) > 12
    || typeof value.courseRef !== 'string' || !/^[a-z0-9][a-z0-9:-]{2,127}$/.test(value.courseRef)
    || typeof finding.id !== 'string' || !/^cvf-[0-9a-f]{16}$/.test(finding.id)
    || !['error', 'warning', 'info'].includes(String(finding.severity))
    || !bounded(finding.category, 80)
    || !bounded(entity.type, 80)
    || (entity.id !== null && !bounded(entity.id, 160))
    || !bounded(finding.path, 500)
    || !bounded(finding.rule, 160)
    || !bounded(finding.explanation, 1000)
    || typeof finding.blocking !== 'boolean'
    || (finding.remediation !== undefined && !bounded(finding.remediation, 1000))
  ) return null
  return Object.freeze({
    sourceLabel: value.sourceLabel,
    grade: value.grade,
    courseRef: value.courseRef,
    finding: Object.freeze({ ...finding, entity: Object.freeze({ ...entity }) }),
  }) as unknown as CurriculumStandardsReviewOccurrence
}

export function adaptCurriculumDraftStandardsReviewWorkspace(
  value: unknown,
  expectedDraftId: string,
  expectedDraftRevision: number,
): CurriculumDraftStandardsReviewWorkspace | null {
  if (
    !isRecord(value)
    || !exact(value, [
      'schemaVersion', 'draftId', 'draftRevision', 'baseReleaseVersion',
      'targetVersion', 'occurrences', 'decisions',
    ])
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
  const decisions = value.decisions.map((item) => decision(item, 'draft', expectedDraftId))
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
      const projected = list(value, contextKind, contextRef)
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
      const projected = mutation(value, input)
      if (!projected) throw new CurriculumStandardsReviewError('unavailable')
      return projected
    },
  })
}

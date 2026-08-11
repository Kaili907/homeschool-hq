import type { CurriculumSnapshotValidationRun, CurriculumValidationFinding } from '../curriculum-validation/engine'
import type {
  CurriculumDraftEntityOrigin,
  CurriculumDraftEntityType,
  CurriculumResourceKind,
  CurriculumResourceMetadata,
  CurriculumResourceLibrary,
  CurriculumResourceLibraryItem,
  CurriculumResourceReference,
  CurriculumResourceReferenceStatus,
} from '../curriculum-authoring/contracts'

export const CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT = 100 as const
export const CURRICULUM_RESOURCE_REFERENCE_LIMIT = 100 as const
export const CURRICULUM_RESOURCE_VALIDATION_FINDING_LIMIT = 100 as const
const RESOURCE_REF = /^[a-z0-9][a-z0-9:-]{2,127}$/
const RESOURCE_KINDS = new Set<CurriculumResourceKind>([
  'text', 'image', 'audio', 'video', 'interactive', 'document', 'physical',
])

export interface CurriculumResourceAnalysisEntity {
  readonly entityType: CurriculumDraftEntityType
  readonly entityRef: string
  readonly origin: 'base' | CurriculumDraftEntityOrigin
  readonly revision: number | null
  readonly position: number
  readonly tombstoned: boolean
  readonly payload: unknown
}

export interface CurriculumResourceLibraryFilters {
  readonly query?: string
  readonly kind?: CurriculumResourceKind | 'all'
  readonly origin?: 'all' | 'base' | 'base_override' | 'draft_created'
  readonly status?: 'all' | CurriculumResourceReferenceStatus | 'tombstoned'
  readonly requirement?: 'all' | 'required' | 'optional'
  readonly validation?: 'all' | 'valid' | 'invalid' | 'not-applicable'
}

export interface FilteredCurriculumResourceLibrary {
  readonly items: readonly CurriculumResourceLibraryItem[]
  readonly total: number
  readonly limited: boolean
  readonly searchIncomplete: boolean
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function string(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function resourceMetadata(value: unknown): CurriculumResourceMetadata | null {
  const candidate = record(value)
  if (
    !candidate
    || candidate.schema_set_version !== '2.0.0'
    || typeof candidate.resource_id !== 'string'
    || typeof candidate.kind !== 'string' || !RESOURCE_KINDS.has(candidate.kind as CurriculumResourceKind)
    || typeof candidate.title !== 'string'
    || typeof candidate.locator !== 'string'
    || typeof candidate.rights !== 'string'
    || typeof candidate.required !== 'boolean'
    || typeof candidate.text_fallback !== 'string'
  ) return null
  const optional = (key: 'caption_or_transcript' | 'alt_text' | 'long_description') =>
    typeof candidate[key] === 'string' ? { [key]: candidate[key] } : {}
  return {
    schema_set_version: '2.0.0',
    resource_id: candidate.resource_id,
    kind: candidate.kind as CurriculumResourceKind,
    title: candidate.title,
    rights: candidate.rights,
    required: candidate.required,
    text_fallback: candidate.text_fallback,
    ...optional('caption_or_transcript'),
    ...optional('alt_text'),
    ...optional('long_description'),
  }
}

function referenceStatus(
  lifecycle: CurriculumResourceLibraryItem['lifecycle'],
  referenceCount: number,
  hasInvalidReference: boolean,
): CurriculumResourceReferenceStatus {
  if (hasInvalidReference) return 'invalid-reference'
  if (lifecycle === 'missing') return 'missing-reference'
  if (lifecycle === 'invalid') return 'invalid-reference'
  if (lifecycle === 'tombstoned' && referenceCount > 0) return 'tombstoned-but-referenced'
  return referenceCount > 0 ? 'referenced' : 'unreferenced'
}

function entitySort(left: CurriculumResourceAnalysisEntity, right: CurriculumResourceAnalysisEntity): number {
  return left.position - right.position || left.entityRef.localeCompare(right.entityRef)
}

/**
 * Deterministically projects only provider-safe Schema v2 media metadata and the minimum
 * curriculum identities needed to navigate its references. No lesson bodies,
 * prompts, protected interpretations, locators, or runtime/learner records are returned.
 */
export function buildCurriculumResourceLibrary(input: {
  readonly origin: 'published-release' | 'draft'
  readonly baseReleaseVersion: string
  readonly draftId?: string | null
  readonly draftRevision?: number | null
  readonly entities: readonly CurriculumResourceAnalysisEntity[]
  readonly validation: Pick<CurriculumSnapshotValidationRun, 'findings'>
}): CurriculumResourceLibrary {
  const deduplicated = new Map<string, CurriculumResourceAnalysisEntity>()
  input.entities.forEach((entity) => deduplicated.set(`${entity.entityType}:${entity.entityRef}`, entity))
  const entities = [...deduplicated.values()]
  const resourceEntities = entities
    .filter((entity) => entity.entityType === 'media_resource')
    .sort(entitySort)
  const referenceOwners = entities
    .filter((entity) => !entity.tombstoned && (entity.entityType === 'lesson' || entity.entityType === 'assessment'))
    .sort((left, right) => left.entityType.localeCompare(right.entityType) || entitySort(left, right))
  type ReferenceAggregate = {
    count: number
    hasInvalidReference: boolean
    hasBlockingFinding: boolean
    navigationIds: Set<string>
    references: CurriculumResourceReference[]
    findingIds: Set<string>
    findings: CurriculumValidationFinding[]
  }
  const referencesByResource = new Map<string, ReferenceAggregate>()
  const invalidItems: Array<{ readonly key: string; readonly reference: CurriculumResourceReference }> = []
  const findingsByPath = new Map<string, CurriculumValidationFinding[]>()
  const findingsByResource = new Map<string, CurriculumValidationFinding[]>()
  input.validation.findings.forEach((finding) => {
    const atPath = findingsByPath.get(finding.path) ?? []
    atPath.push(finding)
    findingsByPath.set(finding.path, atPath)
    if (finding.entity.type === 'resource' && finding.entity.id) {
      const forResource = findingsByResource.get(finding.entity.id) ?? []
      forResource.push(finding)
      findingsByResource.set(finding.entity.id, forResource)
    }
  })
  const referenceFindings = (reference: CurriculumResourceReference) => findingsByPath.get(reference.path) ?? []

  function referenceAggregate(resourceRef: string): ReferenceAggregate {
    const existing = referencesByResource.get(resourceRef)
    if (existing) return existing
    const created: ReferenceAggregate = {
      count: 0,
      hasInvalidReference: false,
      hasBlockingFinding: false,
      navigationIds: new Set(),
      references: [],
      findingIds: new Set(),
      findings: [],
    }
    referencesByResource.set(resourceRef, created)
    return created
  }

  function addReference(rawResourceRef: unknown, reference: Omit<CurriculumResourceReference, 'valid'>, duplicate: boolean) {
    if (typeof rawResourceRef !== 'string' || !RESOURCE_REF.test(rawResourceRef)) {
      invalidItems.push({ key: `invalid:${reference.entityType}:${reference.entityRef}:${reference.path}`, reference: { ...reference, valid: false } })
      return
    }
    const aggregate = referenceAggregate(rawResourceRef)
    const projected = { ...reference, valid: !duplicate }
    aggregate.count += 1
    aggregate.hasInvalidReference ||= duplicate
    aggregate.navigationIds.add(reference.navigationId)
    if (aggregate.references.length < CURRICULUM_RESOURCE_REFERENCE_LIMIT) {
      aggregate.references.push(projected)
    }
    for (const finding of referenceFindings(projected)) {
      if (aggregate.findingIds.has(finding.id)) continue
      aggregate.findingIds.add(finding.id)
      aggregate.hasBlockingFinding ||= finding.blocking
      if (aggregate.findings.length < CURRICULUM_RESOURCE_VALIDATION_FINDING_LIMIT) {
        aggregate.findings.push(finding)
      }
    }
  }

  let lessonIndex = 0
  let assessmentIndex = 0
  for (const entity of referenceOwners) {
    const payload = record(entity.payload)
    if (!payload) {
      if (entity.entityType === 'lesson') lessonIndex += 1
      else assessmentIndex += 1
      continue
    }
    const entityTitle = string(payload.title, entity.entityRef)
    if (entity.entityType === 'lesson') {
      const values = Array.isArray(payload.resource_refs) ? payload.resource_refs : []
      const seen = new Set<unknown>()
      values.forEach((resourceRef, referenceIndex) => {
        const duplicate = seen.has(resourceRef)
        seen.add(resourceRef)
        addReference(resourceRef, {
          entityType: 'lesson', entityRef: entity.entityRef, entityTitle, promptRef: null,
          path: `lessons[${lessonIndex}].resource_refs[${referenceIndex}]`,
          navigationId: `lesson:${entity.entityRef}`,
        }, duplicate)
      })
      lessonIndex += 1
      continue
    }
    const prompts = Array.isArray(payload.prompts) ? payload.prompts : []
    prompts.forEach((promptValue, promptIndex) => {
      const prompt = record(promptValue)
      const values = Array.isArray(prompt?.resource_refs) ? prompt.resource_refs : []
      const seen = new Set<unknown>()
      values.forEach((resourceRef, referenceIndex) => {
        const duplicate = seen.has(resourceRef)
        seen.add(resourceRef)
        addReference(resourceRef, {
          entityType: 'assessment', entityRef: entity.entityRef, entityTitle,
          promptRef: typeof prompt?.prompt_id === 'string' ? prompt.prompt_id : null,
          path: `assessments[${assessmentIndex}].prompts[${promptIndex}].resource_refs[${referenceIndex}]`,
          navigationId: `assessment:${entity.entityRef}`,
        }, duplicate)
      })
    })
    assessmentIndex += 1
  }

  const knownResourceIds = new Set(resourceEntities.map((entity) => entity.entityRef))
  const items: CurriculumResourceLibraryItem[] = resourceEntities.map((entity) => {
    const metadata = resourceMetadata(entity.payload)
    const aggregate = referencesByResource.get(entity.entityRef)
    const references = aggregate?.references ?? []
    const referenceCount = aggregate?.count ?? 0
    const lifecycle = entity.tombstoned ? 'tombstoned' as const : 'active' as const
    const status = referenceStatus(lifecycle, referenceCount, aggregate?.hasInvalidReference ?? false)
    const directFindings = findingsByResource.get(entity.entityRef) ?? []
    const findingIds = new Set(aggregate?.findingIds ?? [])
    directFindings.forEach((finding) => findingIds.add(finding.id))
    const hasBlockingFinding = (aggregate?.hasBlockingFinding ?? false)
      || directFindings.some((finding) => finding.blocking)
    const uniqueFindings = [...new Map([...directFindings, ...(aggregate?.findings ?? [])]
      .map((finding) => [finding.id, finding])).values()]
      .slice(0, CURRICULUM_RESOURCE_VALIDATION_FINDING_LIMIT)
    const validationStatus = lifecycle === 'tombstoned' && referenceCount === 0
      ? 'not-applicable' as const
      : metadata === null || status === 'tombstoned-but-referenced' || status === 'invalid-reference' || hasBlockingFinding
        ? 'invalid' as const
        : 'valid' as const
    return {
      key: `resource:${entity.entityRef}`,
      resourceId: entity.entityRef,
      metadata,
      title: string(metadata?.title, entity.entityRef),
      kind: metadata?.kind ?? null,
      required: metadata?.required ?? null,
      origin: entity.origin,
      revision: entity.revision,
      position: entity.position,
      lifecycle,
      overridden: entity.origin === 'base_override',
      referenceStatus: status,
      referenceCount,
      referencingEntityCount: aggregate?.navigationIds.size ?? 0,
      referencesLimited: referenceCount > CURRICULUM_RESOURCE_REFERENCE_LIMIT,
      references,
      validationStatus,
      validationFindingCount: findingIds.size,
      validationFindingsLimited: findingIds.size > CURRICULUM_RESOURCE_VALIDATION_FINDING_LIMIT,
      validationFindings: uniqueFindings,
    }
  })

  for (const [resourceId, aggregate] of referencesByResource) {
    if (knownResourceIds.has(resourceId)) continue
    const findings = aggregate.findings
    items.push({
      key: `missing:${resourceId}`,
      resourceId,
      metadata: null,
      title: `Missing resource: ${resourceId}`,
      kind: null,
      required: null,
      origin: 'missing',
      revision: null,
      position: null,
      lifecycle: 'missing',
      overridden: false,
      referenceStatus: 'missing-reference',
      referenceCount: aggregate.count,
      referencingEntityCount: aggregate.navigationIds.size,
      referencesLimited: aggregate.count > CURRICULUM_RESOURCE_REFERENCE_LIMIT,
      references: aggregate.references,
      validationStatus: 'invalid',
      validationFindingCount: aggregate.findingIds.size,
      validationFindingsLimited: aggregate.findingIds.size > CURRICULUM_RESOURCE_VALIDATION_FINDING_LIMIT,
      validationFindings: findings,
    })
  }

  invalidItems.forEach(({ key, reference }) => {
    const findings = referenceFindings(reference)
    items.push({
      key,
      resourceId: null,
      metadata: null,
      title: 'Invalid resource reference',
      kind: null,
      required: null,
      origin: 'invalid',
      revision: null,
      position: null,
      lifecycle: 'invalid',
      overridden: false,
      referenceStatus: 'invalid-reference',
      referenceCount: 1,
      referencingEntityCount: 1,
      referencesLimited: false,
      references: [reference],
      validationStatus: 'invalid',
      validationFindingCount: findings.length,
      validationFindingsLimited: false,
      validationFindings: findings,
    })
  })

  items.sort((left, right) =>
    left.title.localeCompare(right.title)
    || (left.resourceId ?? left.key).localeCompare(right.resourceId ?? right.key),
  )
  const resourceItems = items.filter((item) => item.lifecycle === 'active' || item.lifecycle === 'tombstoned')
  return {
    schemaVersion: 1,
    source: {
      origin: input.origin,
      baseReleaseVersion: input.baseReleaseVersion,
      draftId: input.draftId ?? null,
      draftRevision: input.draftRevision ?? null,
    },
    totals: {
      resources: resourceItems.length,
      active: resourceItems.filter((item) => item.lifecycle === 'active').length,
      referenced: resourceItems.filter((item) => item.referenceStatus === 'referenced').length,
      unreferenced: resourceItems.filter((item) => item.referenceStatus === 'unreferenced').length,
      overridden: resourceItems.filter((item) => item.overridden).length,
      draftCreated: resourceItems.filter((item) => item.origin === 'draft_created').length,
      tombstoned: resourceItems.filter((item) => item.lifecycle === 'tombstoned').length,
      missingReferences: items.filter((item) => item.lifecycle === 'missing').length,
      invalidReferences: items.filter((item) => item.referenceStatus === 'invalid-reference').length,
      referenceOccurrences: items.reduce((sum, item) => sum + item.referenceCount, 0),
      validationInvalid: items.filter((item) => item.validationStatus === 'invalid').length,
    },
    items,
  }
}

export function filterCurriculumResourceLibrary(
  library: Pick<CurriculumResourceLibrary, 'items'>,
  filters: CurriculumResourceLibraryFilters,
  limit = CURRICULUM_RESOURCE_LIBRARY_RENDER_LIMIT,
  offset = 0,
): FilteredCurriculumResourceLibrary {
  const query = filters.query?.trim().toLocaleLowerCase('en-US') ?? ''
  const items = library.items.filter((item) => {
    if (filters.kind && filters.kind !== 'all' && item.kind !== filters.kind) return false
    if (filters.origin && filters.origin !== 'all' && item.origin !== filters.origin) return false
    if (filters.status && filters.status !== 'all') {
      if (filters.status === 'tombstoned' ? item.lifecycle !== 'tombstoned' : item.referenceStatus !== filters.status) return false
    }
    if (filters.requirement && filters.requirement !== 'all') {
      if (item.required !== (filters.requirement === 'required')) return false
    }
    if (filters.validation && filters.validation !== 'all' && item.validationStatus !== filters.validation) return false
    if (query) {
      const search = [
        item.resourceId ?? '', item.title, item.kind ?? '', item.origin, item.lifecycle,
        item.referenceStatus, item.metadata?.rights ?? '',
        ...item.references.flatMap((reference) => [reference.entityRef, reference.entityTitle, reference.promptRef ?? '']),
      ].join(' ').toLocaleLowerCase('en-US')
      if (!search.includes(query)) return false
    }
    return true
  })
  const safeLimit = Math.max(1, limit)
  const safeOffset = Math.max(0, offset)
  return {
    items: items.slice(safeOffset, safeOffset + safeLimit),
    total: items.length,
    limited: items.length > safeLimit,
    searchIncomplete: Boolean(query) && library.items.some((item) => item.referencesLimited),
  }
}

import { getGatewayAccessToken } from '../../tutor/gatewayAuth'
import {
  CURRICULUM_DRAFT_ENTITY_TYPES,
  CurriculumDraftAuthoringError,
  validateCurriculumDraftEntity,
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
  type CurriculumPreviewResult,
  type CurriculumResourceLibrary,
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
  async function request(path: string, method = 'GET', body?: object): Promise<unknown> {
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
      return await response.json()
    } catch {
      throw new CurriculumDraftAuthoringError('unavailable')
    }
  }

  const entityPath = (draftId: string, entityType: CurriculumDraftEntityType, entityRef: string) =>
    `${basePath}/${encodeURIComponent(draftId)}/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityRef)}`

  return Object.freeze({
    async listDrafts() {
      return requireProjection(await request(basePath), adaptDraftList)
    },
    async readDraft(draftId: string) {
      return requireProjection(
        await request(`${basePath}/${encodeURIComponent(draftId)}`),
        (value) => adaptDraftDetail(value, draftId),
      )
    },
    async readEntity(draftId: string, entityType: CurriculumDraftEntityType, entityRef: string) {
      return requireProjection(
        await request(entityPath(draftId, entityType, entityRef)),
        (value) => adaptDraftEntityDetail(value, draftId, entityType, entityRef),
      )
    },
    async createDraft(input: CreateCurriculumDraftInput) {
      return requireProjection(await request(basePath, 'POST', input), adaptDraftMutation)
    },
    async createEntity({ draftId, ...body }: CreateCurriculumDraftEntityInput) {
      return requireProjection(
        await request(`${basePath}/${encodeURIComponent(draftId)}/entities`, 'POST', body),
        (value) => adaptDraftMutation(value, draftId),
      )
    },
    async updateEntity({ draftId, entityType, entityRef, ...body }: UpdateCurriculumDraftEntityInput) {
      return requireProjection(
        await request(entityPath(draftId, entityType, entityRef), 'PUT', body),
        (value) => adaptDraftMutation(value, draftId),
      )
    },
    async tombstoneEntity({ draftId, entityType, entityRef, ...body }: TombstoneCurriculumDraftEntityInput) {
      return requireProjection(
        await request(`${entityPath(draftId, entityType, entityRef)}/tombstone`, 'POST', body),
        (value) => adaptDraftMutation(value, draftId),
      )
    },
    async listCollaborators(draftId: string) {
      return requireProjection(
        await request(`${basePath}/${encodeURIComponent(draftId)}/collaborators`),
        (value) => adaptCollaborators(value, draftId),
      )
    },
    async addCollaborator({ draftId, ...body }: AddCurriculumDraftCollaboratorInput) {
      return requireProjection(
        await request(`${basePath}/${encodeURIComponent(draftId)}/collaborators`, 'POST', body),
        (value) => adaptCollaboratorMutation(value, draftId),
      )
    },
    async revokeCollaborator({ draftId, principalRef, ...body }: RevokeCurriculumDraftCollaboratorInput) {
      return requireProjection(
        await request(
          `${basePath}/${encodeURIComponent(draftId)}/collaborators/${encodeURIComponent(principalRef)}/revoke`,
          'POST',
          body,
        ),
        (value) => adaptCollaboratorMutation(value, draftId),
      )
    },
    async readBaseIndex(baseReleaseVersion: string) {
      return requireProjection(
        await request(`/api/admin/curriculum/releases/${encodeURIComponent(baseReleaseVersion)}/authoring-index`),
        (value) => adaptBaseIndex(value, baseReleaseVersion),
      )
    },
    readBaseEntity: (
      baseReleaseVersion: string,
      entityType: CurriculumDraftEntityType,
      entityRef: string,
    ) => request(
      `/api/admin/curriculum/releases/${encodeURIComponent(baseReleaseVersion)}/authoring/entities/${encodeURIComponent(entityType)}/${encodeURIComponent(entityRef)}`,
    ).then((value) => requireProjection(
      value,
      (candidate) => adaptBaseEntity(candidate, baseReleaseVersion, entityType, entityRef),
    )),
    async readMaterialization(draftId: string, revision: number) {
      return requireProjection(
        await request(`${basePath}/${encodeURIComponent(draftId)}/materialization/${revision}`),
        (value) => adaptMaterialization(value, draftId, revision),
      )
    },
    async validateDraft(draftId: string, revision: number) {
      return requireProjection(
        await request(`${basePath}/${encodeURIComponent(draftId)}/validation/${revision}`),
        (value) => adaptDraftValidation(value, draftId, revision),
      )
    },
    readPreview: async (draftId: string, revision: number) => {
      const value = await request(`${basePath}/${encodeURIComponent(draftId)}/preview/${revision}`)
      const preview = adaptCurriculumPreview(value, draftId, revision)
      if (!preview) throw new CurriculumDraftAuthoringError('unavailable')
      return preview
    },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ENTITY_REF = /^[a-z0-9][a-z0-9:-]{2,127}$/
const ENTITY_ORIGINS = new Set(['base_override', 'draft_created'])
const COLLABORATOR_RESPONSIBILITIES = new Set(['editor', 'reviewer'])

function requireProjection<T>(value: unknown, adapt: (candidate: unknown) => T | null): T {
  const projected = adapt(value)
  if (!projected) throw new CurriculumDraftAuthoringError('unavailable')
  return projected
}

function timestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && !Number.isNaN(Date.parse(value))
}

function adaptDraftSummary(value: unknown): CurriculumDraftSummary | null {
  if (!record(value) || !exact(value, [
    'schemaVersion', 'draftId', 'baseReleaseVersion', 'targetVersion', 'authoringSchemaVersion',
    'lifecycleState', 'revision', 'createdAt', 'updatedAt',
  ]) || value.schemaVersion !== 1 || typeof value.draftId !== 'string' || !UUID.test(value.draftId)
    || typeof value.baseReleaseVersion !== 'string' || !VERSION.test(value.baseReleaseVersion)
    || typeof value.targetVersion !== 'string' || !VERSION.test(value.targetVersion)
    || value.authoringSchemaVersion !== '2.0.0' || value.lifecycleState !== 'draft'
    || !integer(value.revision, 1) || !timestamp(value.createdAt) || !timestamp(value.updatedAt)) return null
  return Object.freeze({ ...value }) as unknown as CurriculumDraftSummary
}

function adaptDraftList(value: unknown): { readonly schemaVersion: 1; readonly drafts: readonly CurriculumDraftSummary[] } | null {
  if (!record(value) || !exact(value, ['schemaVersion', 'drafts']) || value.schemaVersion !== 1
    || !Array.isArray(value.drafts) || value.drafts.length > 1_000) return null
  const drafts = value.drafts.map(adaptDraftSummary)
  return drafts.some((draft) => draft === null) ? null : Object.freeze({
    schemaVersion: 1,
    drafts: Object.freeze(drafts as CurriculumDraftSummary[]),
  })
}

function adaptDraftEntitySummary(value: unknown) {
  if (!record(value) || !exact(value, [
    'entityType', 'entityRef', 'origin', 'revision', 'position', 'tombstoned', 'digest',
    'createdAt', 'updatedAt',
  ]) || !CURRICULUM_DRAFT_ENTITY_TYPES.includes(value.entityType as CurriculumDraftEntityType)
    || typeof value.entityRef !== 'string' || !ENTITY_REF.test(value.entityRef)
    || typeof value.origin !== 'string' || !ENTITY_ORIGINS.has(value.origin)
    || !integer(value.revision, 1) || !integer(value.position)
    || typeof value.tombstoned !== 'boolean' || typeof value.digest !== 'string' || !HASH.test(value.digest)
    || !timestamp(value.createdAt) || !timestamp(value.updatedAt)) return null
  return Object.freeze({ ...value })
}

function adaptDraftDetail(value: unknown, expectedDraftId: string): CurriculumDraftDetail | null {
  if (!record(value) || !Array.isArray(value.entities) || value.entities.length > 10_000) return null
  const { entities: rawEntities, ...summaryValue } = value
  const summary = adaptDraftSummary(summaryValue)
  const entities = rawEntities.map(adaptDraftEntitySummary)
  if (!summary || summary.draftId !== expectedDraftId || entities.some((entity) => entity === null)) return null
  return Object.freeze({ ...summary, entities: Object.freeze(entities) }) as unknown as CurriculumDraftDetail
}

function adaptDraftEntityDetail(
  value: unknown,
  expectedDraftId: string,
  expectedType: CurriculumDraftEntityType,
  expectedRef: string,
): CurriculumDraftEntityDetail | null {
  if (!record(value) || !record(value.payload)) return null
  const { schemaVersion, draftId, payload, ...summaryValue } = value
  if (schemaVersion !== 1 || draftId !== expectedDraftId) return null
  const summary = adaptDraftEntitySummary(summaryValue)
  if (!summary || summary.entityType !== expectedType || summary.entityRef !== expectedRef) return null
  const validation = validateCurriculumDraftEntity(expectedType, expectedRef, payload)
  return validation.success
    ? Object.freeze({ schemaVersion: 1, draftId, ...summary, payload: Object.freeze(validation.payload) }) as CurriculumDraftEntityDetail
    : null
}

function adaptDraftMutation(value: unknown, expectedDraftId?: string): CurriculumDraftMutationResult | null {
  if (!record(value) || value.schemaVersion !== 1 || typeof value.replayed !== 'boolean'
    || typeof value.draftId !== 'string' || !UUID.test(value.draftId) || !integer(value.draftRevision, 1)
    || Object.keys(value).some((key) => !['schemaVersion', 'replayed', 'draftId', 'draftRevision', 'entity'].includes(key))
    || (expectedDraftId !== undefined && value.draftId !== expectedDraftId)) return null
  const entity = value.entity === undefined ? undefined : adaptDraftEntitySummary(value.entity)
  if (value.entity !== undefined && !entity) return null
  return Object.freeze({
    schemaVersion: 1, replayed: value.replayed, draftId: value.draftId,
    draftRevision: value.draftRevision as number, ...(entity ? { entity } : {}),
  }) as unknown as CurriculumDraftMutationResult
}

function adaptCollaborator(value: unknown) {
  if (!record(value) || !exact(value, [
    'principalRef', 'responsibility', 'status', 'assignmentRevision', 'assignedAt', 'revokedAt',
  ]) || typeof value.principalRef !== 'string' || !UUID.test(value.principalRef)
    || typeof value.responsibility !== 'string' || !COLLABORATOR_RESPONSIBILITIES.has(value.responsibility)
    || !['active', 'revoked'].includes(String(value.status)) || !integer(value.assignmentRevision, 1)
    || !timestamp(value.assignedAt) || (value.revokedAt !== null && !timestamp(value.revokedAt))) return null
  if ((value.status === 'active' && (value.assignmentRevision !== 1 || value.revokedAt !== null))
    || (value.status === 'revoked' && (value.assignmentRevision !== 2 || value.revokedAt === null))) return null
  return Object.freeze({ ...value })
}

function adaptCollaborators(value: unknown, expectedDraftId: string): CurriculumDraftCollaborators | null {
  if (!record(value) || !exact(value, [
    'schemaVersion', 'draftId', 'draftRevision', 'currentResponsibility', 'collaborators',
  ]) || value.schemaVersion !== 1 || value.draftId !== expectedDraftId || !integer(value.draftRevision, 1)
    || typeof value.currentResponsibility !== 'string' || !COLLABORATOR_RESPONSIBILITIES.has(value.currentResponsibility)
    || !Array.isArray(value.collaborators) || value.collaborators.length > 1_000) return null
  const collaborators = value.collaborators.map(adaptCollaborator)
  if (collaborators.some((collaborator) => collaborator === null || collaborator.status !== 'active')) return null
  return Object.freeze({ ...value, collaborators: Object.freeze(collaborators) }) as unknown as CurriculumDraftCollaborators
}

function adaptCollaboratorMutation(value: unknown, expectedDraftId: string): CurriculumDraftCollaboratorMutationResult | null {
  if (!record(value) || !exact(value, [
    'schemaVersion', 'replayed', 'draftId', 'draftRevision', 'collaborator',
  ]) || value.schemaVersion !== 1 || typeof value.replayed !== 'boolean' || value.draftId !== expectedDraftId
    || !integer(value.draftRevision, 1)) return null
  const collaborator = adaptCollaborator(value.collaborator)
  return collaborator
    ? Object.freeze({ ...value, collaborator }) as unknown as CurriculumDraftCollaboratorMutationResult
    : null
}

function adaptBaseEntity(
  value: unknown,
  expectedVersion: string,
  expectedType: CurriculumDraftEntityType,
  expectedRef: string,
): CurriculumBaseAuthoringEntity | null {
  if (!record(value) || !exact(value, [
    'schemaVersion', 'baseReleaseVersion', 'entityType', 'entityRef', 'payload',
  ]) || value.schemaVersion !== 1 || value.baseReleaseVersion !== expectedVersion
    || value.entityType !== expectedType || value.entityRef !== expectedRef) return null
  const validation = validateCurriculumDraftEntity(expectedType, expectedRef, value.payload)
  return validation.success
    ? Object.freeze({ ...value, payload: Object.freeze(validation.payload) }) as CurriculumBaseAuthoringEntity
    : null
}

const INDEX_ORIGINS = new Set(['base', 'base_override', 'draft_created'])
const RESOURCE_KINDS = new Set(['text', 'image', 'audio', 'video', 'interactive', 'document', 'physical'])
const RESOURCE_ORIGINS = new Set(['base', 'base_override', 'draft_created', 'missing', 'invalid'])
const RESOURCE_LIFECYCLES = new Set(['active', 'tombstoned', 'missing', 'invalid'])
const RESOURCE_REFERENCE_STATUSES = new Set([
  'referenced', 'unreferenced', 'missing-reference', 'tombstoned-but-referenced', 'invalid-reference',
])
const RESOURCE_VALIDATION_STATUSES = new Set(['valid', 'invalid', 'not-applicable'])
const RESOURCE_TOTAL_KEYS = [
  'resources', 'active', 'referenced', 'unreferenced', 'overridden', 'draftCreated',
  'tombstoned', 'missingReferences', 'invalidReferences', 'referenceOccurrences', 'validationInvalid',
] as const

function text(value: unknown, maximum: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maximum && !/[\u0000-\u001f\u007f]/.test(value)
}

function adaptIndexEntry(value: unknown) {
  const required = ['entityType', 'entityRef', 'origin', 'revision', 'position', 'parentId', 'label', 'context']
  const optional = ['grade', 'subject', 'courseRef', 'unitRef']
  if (!record(value) || Object.keys(value).some((key) => ![...required, ...optional].includes(key))
    || required.some((key) => !Object.hasOwn(value, key))
    || !CURRICULUM_DRAFT_ENTITY_TYPES.includes(value.entityType as CurriculumDraftEntityType)
    || typeof value.entityRef !== 'string' || !ENTITY_REF.test(value.entityRef)
    || typeof value.origin !== 'string' || !INDEX_ORIGINS.has(value.origin)
    || (value.revision !== null && !integer(value.revision, 1)) || !integer(value.position)
    || !text(value.parentId, 200) || !text(value.label, 500)
    || typeof value.context !== 'string' || value.context.length > 500 || /[\u0000-\u001f\u007f]/.test(value.context)
    || (value.grade !== undefined && (!integer(value.grade) || value.grade > 12))
    || (value.subject !== undefined && !text(value.subject, 160))
    || (value.courseRef !== undefined && (typeof value.courseRef !== 'string' || !ENTITY_REF.test(value.courseRef)))
    || (value.unitRef !== undefined && (typeof value.unitRef !== 'string' || !ENTITY_REF.test(value.unitRef)))) return null
  return Object.freeze({ ...value })
}

function adaptResourceMetadata(value: unknown) {
  if (value === null) return null
  const required = ['schema_set_version', 'resource_id', 'kind', 'title', 'rights', 'required', 'text_fallback']
  const optional = ['caption_or_transcript', 'alt_text', 'long_description']
  if (!record(value) || Object.keys(value).some((key) => ![...required, ...optional].includes(key))
    || required.some((key) => !Object.hasOwn(value, key)) || value.schema_set_version !== '2.0.0'
    || typeof value.resource_id !== 'string' || !ENTITY_REF.test(value.resource_id)
    || typeof value.kind !== 'string' || !RESOURCE_KINDS.has(value.kind)
    || !text(value.title, 500) || !text(value.rights, 500) || typeof value.required !== 'boolean'
    || typeof value.text_fallback !== 'string' || value.text_fallback.length > 4_000
    || optional.some((key) => value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 20_000))) return undefined
  return Object.freeze({ ...value })
}

function adaptResourceReference(value: unknown) {
  if (!record(value) || !exact(value, [
    'entityType', 'entityRef', 'entityTitle', 'promptRef', 'path', 'navigationId', 'valid',
  ]) || !['lesson', 'assessment'].includes(String(value.entityType))
    || typeof value.entityRef !== 'string' || !ENTITY_REF.test(value.entityRef)
    || !text(value.entityTitle, 500)
    || (value.promptRef !== null && (typeof value.promptRef !== 'string' || !ENTITY_REF.test(value.promptRef)))
    || !text(value.path, 500) || !text(value.navigationId, 300) || typeof value.valid !== 'boolean') return null
  return Object.freeze({ ...value })
}

function adaptResourceItem(value: unknown): CurriculumResourceLibrary['items'][number] | null {
  if (!record(value) || !exact(value, [
    'key', 'resourceId', 'metadata', 'title', 'kind', 'required', 'origin', 'revision', 'position',
    'lifecycle', 'overridden', 'referenceStatus', 'referenceCount', 'referencingEntityCount',
    'references', 'validationStatus', 'validationFindings',
  ]) || !text(value.key, 500)
    || (value.resourceId !== null && (typeof value.resourceId !== 'string' || !ENTITY_REF.test(value.resourceId)))
    || !text(value.title, 500) || (value.kind !== null && (typeof value.kind !== 'string' || !RESOURCE_KINDS.has(value.kind)))
    || (value.required !== null && typeof value.required !== 'boolean')
    || typeof value.origin !== 'string' || !RESOURCE_ORIGINS.has(value.origin)
    || (value.revision !== null && !integer(value.revision, 1)) || (value.position !== null && !integer(value.position))
    || typeof value.lifecycle !== 'string' || !RESOURCE_LIFECYCLES.has(value.lifecycle)
    || typeof value.overridden !== 'boolean' || typeof value.referenceStatus !== 'string'
    || !RESOURCE_REFERENCE_STATUSES.has(value.referenceStatus) || !integer(value.referenceCount)
    || !integer(value.referencingEntityCount) || !Array.isArray(value.references) || value.references.length > 10_000
    || typeof value.validationStatus !== 'string' || !RESOURCE_VALIDATION_STATUSES.has(value.validationStatus)
    || !Array.isArray(value.validationFindings) || value.validationFindings.length > 10_000) return null
  const metadata = adaptResourceMetadata(value.metadata)
  const references = value.references.map(adaptResourceReference)
  const validationFindings = value.validationFindings.map(adaptValidationFinding)
  if (metadata === undefined || references.some((reference) => reference === null)
    || validationFindings.some((finding) => finding === null)
    || value.referenceCount !== references.length
    || value.referencingEntityCount !== new Set(references.map((reference) => reference?.navigationId)).size
    || (metadata !== null && metadata.resource_id !== value.resourceId)) return null
  return Object.freeze({
    ...value,
    metadata,
    references: Object.freeze(references),
    validationFindings: Object.freeze(validationFindings),
  }) as unknown as CurriculumResourceLibrary['items'][number]
}

function adaptResourceLibrary(
  value: unknown,
  expectedSource: { origin: 'published-release'; baseReleaseVersion: string }
    | { origin: 'draft'; baseReleaseVersion: string; draftId: string; draftRevision: number },
): CurriculumResourceLibrary | null {
  if (!record(value) || !exact(value, ['schemaVersion', 'source', 'totals', 'items']) || value.schemaVersion !== 1
    || !record(value.source) || !exact(value.source, ['origin', 'baseReleaseVersion', 'draftId', 'draftRevision'])
    || value.source.origin !== expectedSource.origin || value.source.baseReleaseVersion !== expectedSource.baseReleaseVersion
    || (expectedSource.origin === 'published-release'
      ? value.source.draftId !== null || value.source.draftRevision !== null
      : value.source.draftId !== expectedSource.draftId || value.source.draftRevision !== expectedSource.draftRevision)
    || !record(value.totals) || !exact(value.totals, RESOURCE_TOTAL_KEYS)
    || !Array.isArray(value.items) || value.items.length > 20_000) return null
  const totals = value.totals
  if (RESOURCE_TOTAL_KEYS.some((key) => !integer(totals[key]))) return null
  const items = value.items.map(adaptResourceItem)
  if (items.some((item) => item === null)
    || new Set(items.map((item) => item?.key)).size !== items.length
    || totals.resources !== items.filter((item) => ['active', 'tombstoned'].includes(String(item?.lifecycle))).length
    || totals.referenceOccurrences !== items.reduce((sum, item) => sum + (item?.referenceCount ?? 0), 0)) return null
  return Object.freeze({
    schemaVersion: 1,
    source: Object.freeze({ ...value.source }),
    totals: Object.freeze({ ...totals }),
    items: Object.freeze(items),
  }) as unknown as CurriculumResourceLibrary
}

function adaptBaseIndex(value: unknown, expectedVersion: string): CurriculumBaseAuthoringIndex | null {
  if (!record(value) || !exact(value, ['schemaVersion', 'baseReleaseVersion', 'entities', 'resourceLibrary'])
    || value.schemaVersion !== 1 || value.baseReleaseVersion !== expectedVersion
    || !Array.isArray(value.entities) || value.entities.length > 20_000) return null
  const entities = value.entities.map(adaptIndexEntry)
  const resourceLibrary = adaptResourceLibrary(value.resourceLibrary, {
    origin: 'published-release', baseReleaseVersion: expectedVersion,
  })
  if (!resourceLibrary || entities.some((entity) => entity === null)) return null
  return Object.freeze({ schemaVersion: 1, baseReleaseVersion: expectedVersion, entities: Object.freeze(entities), resourceLibrary }) as unknown as CurriculumBaseAuthoringIndex
}

function adaptMaterialization(
  value: unknown,
  expectedDraftId: string,
  expectedRevision: number,
): CurriculumDraftMaterialization | null {
  if (!record(value) || !exact(value, [
    'schemaVersion', 'draftId', 'draftRevision', 'baseReleaseVersion', 'entities', 'resourceLibrary',
  ]) || value.schemaVersion !== 1 || value.draftId !== expectedDraftId || value.draftRevision !== expectedRevision
    || typeof value.baseReleaseVersion !== 'string' || !VERSION.test(value.baseReleaseVersion)
    || !Array.isArray(value.entities) || value.entities.length > 20_000) return null
  const entities = value.entities.map(adaptIndexEntry)
  const resourceLibrary = adaptResourceLibrary(value.resourceLibrary, {
    origin: 'draft', baseReleaseVersion: value.baseReleaseVersion,
    draftId: expectedDraftId, draftRevision: expectedRevision,
  })
  if (!resourceLibrary || entities.some((entity) => entity === null)) return null
  return Object.freeze({ ...value, entities: Object.freeze(entities), resourceLibrary }) as unknown as CurriculumDraftMaterialization
}

function adaptValidationSnapshot(value: unknown, expectedRevision: number) {
  if (!record(value) || !exact(value, [
    'validationSnapshotId', 'draftRevision', 'engineVersion', 'resultDigest', 'status',
    'publicationReady', 'blockingCount', 'blockingErrorCount', 'humanReviewBlockerCount', 'validatedAt',
  ]) || typeof value.validationSnapshotId !== 'string' || !UUID.test(value.validationSnapshotId)
    || value.draftRevision !== expectedRevision || value.engineVersion !== 'curriculum-validation-v2'
    || typeof value.resultDigest !== 'string' || !HASH.test(value.resultDigest)
    || typeof value.status !== 'string' || !VALIDATION_STATUSES.has(value.status)
    || typeof value.publicationReady !== 'boolean' || !integer(value.blockingCount)
    || !integer(value.blockingErrorCount) || value.blockingErrorCount > value.blockingCount
    || !integer(value.humanReviewBlockerCount) || value.humanReviewBlockerCount > value.blockingCount
    || !timestamp(value.validatedAt)) return null
  return Object.freeze({ ...value })
}

function adaptDraftValidation(
  value: unknown,
  expectedDraftId: string,
  expectedRevision: number,
): CurriculumDraftValidationResult | null {
  if (!record(value) || !exact(value, [
    'schemaVersion', 'draftId', 'draftRevision', 'baseReleaseVersion', 'targetVersion', 'validationSnapshot', 'run',
  ]) || value.schemaVersion !== 1 || value.draftId !== expectedDraftId || value.draftRevision !== expectedRevision
    || typeof value.baseReleaseVersion !== 'string' || !VERSION.test(value.baseReleaseVersion)
    || typeof value.targetVersion !== 'string' || !VERSION.test(value.targetVersion)) return null
  const validationSnapshot = adaptValidationSnapshot(value.validationSnapshot, expectedRevision)
  const run = adaptValidationRun(value.run)
  if (!validationSnapshot || !run || run.status !== validationSnapshot.status
    || run.publicationReady !== validationSnapshot.publicationReady
    || run.source.origin !== 'draft' || run.source.snapshotId !== `${expectedDraftId}@${expectedRevision}`
    || run.source.curriculumVersion !== value.targetVersion || run.source.schemaSetVersion !== '2.0.0'
    || run.summary.blocking !== validationSnapshot.blockingCount) return null
  return Object.freeze({ ...value, validationSnapshot, run }) as unknown as CurriculumDraftValidationResult
}

const CHANGE_TYPES = new Set(['unchanged', 'added', 'modified', 'removed'])
const VALUE_KINDS = new Set(['empty', 'text', 'number', 'boolean', 'list', 'structure', 'withheld'])
const FIELD_CATEGORIES = new Set([
  'identity', 'content', 'navigation', 'lesson-content', 'standards', 'mastery', 'tutor-routing',
  'safety-privacy', 'accessibility', 'assessment-structure', 'resources', 'extensions', 'protected',
])
const VALIDATION_STATUSES = new Set(['valid', 'invalid', 'incomplete', 'unavailable', 'error'])
const FINDING_SEVERITIES = new Set(['error', 'warning', 'info'])
const VALIDATION_CATEGORIES = new Set([
  'schema', 'structure', 'references', 'assessments', 'resources', 'standards', 'mastery',
  'tutor-routing', 'safety-privacy', 'accessibility', 'version-consistency',
])
const PREVIEW_FIELD_ROOTS = new Set([
  'grade', 'subject', 'title', 'description', 'capstone', 'days', 'order', 'unit_refs', 'standards',
  'extensions', 'course_ref', 'essential_question', 'topics', 'performance_task', 'lesson_refs',
  'assessment_ref', 'unit_ref', 'course_day', 'day_in_unit', 'phase', 'focus', 'estimated_duration',
  'learning_objectives', 'success_criteria', 'materials', 'lesson_flow', 'student_activity',
  'formative_check', 'extension_activity', 'accessibility', 'resource_refs', 'home_connection',
  'total_points', 'prompts', 'rubric_dimensions', 'accommodation_note', 'kind', 'rights', 'required',
  'text_fallback', 'caption_or_transcript', 'alt_text', 'long_description', 'position', 'protected_metadata',
])
const HASH = /^[0-9a-f]{64}$/
const VERSION = /^\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exact(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function integer(value: unknown, minimum = 0): value is number {
  return Number.isSafeInteger(value) && (value as number) >= minimum
}

function adaptCounts(value: unknown, requireExact = true) {
  if (!record(value) || (requireExact && !exact(value, ['unchanged', 'added', 'modified', 'removed']))) return null
  if (!integer(value.unchanged) || !integer(value.added) || !integer(value.modified) || !integer(value.removed)) return null
  return {
    unchanged: value.unchanged,
    added: value.added,
    modified: value.modified,
    removed: value.removed,
  }
}

function adaptFieldValue(value: unknown) {
  if (!record(value) || typeof value.kind !== 'string' || !VALUE_KINDS.has(value.kind)
    || typeof value.display !== 'string' || value.display.length > 1_000
    || Object.keys(value).some((key) => !['kind', 'display', 'itemCount', 'truncated'].includes(key))
    || (value.itemCount !== undefined && !integer(value.itemCount))
    || (value.truncated !== undefined && typeof value.truncated !== 'boolean')) return null
  return Object.freeze({
    kind: value.kind as CurriculumPreviewResult['entities'][number]['fieldChanges'][number]['before']['kind'],
    display: value.display,
    ...(value.itemCount === undefined ? {} : { itemCount: value.itemCount as number }),
    ...(value.truncated === undefined ? {} : { truncated: value.truncated }),
  })
}

function adaptFieldChange(value: unknown) {
  if (!record(value) || !exact(value, ['path', 'label', 'category', 'before', 'after'])
    || typeof value.path !== 'string' || value.path.length > 240 || !PREVIEW_FIELD_ROOTS.has(value.path.split('.')[0])
    || typeof value.label !== 'string' || value.label.length > 240
    || typeof value.category !== 'string' || !FIELD_CATEGORIES.has(value.category)) return null
  const before = adaptFieldValue(value.before)
  const after = adaptFieldValue(value.after)
  return before && after ? Object.freeze({ path: value.path, label: value.label, category: value.category, before, after }) : null
}

function adaptValidationFinding(finding: unknown) {
  const findingKeys = ['id', 'severity', 'category', 'entity', 'path', 'rule', 'explanation', 'blocking', 'remediation']
  if (!record(finding) || Object.keys(finding).some((key) => !findingKeys.includes(key))
    || typeof finding.id !== 'string' || finding.id.length > 200
    || typeof finding.severity !== 'string' || !FINDING_SEVERITIES.has(finding.severity)
    || typeof finding.category !== 'string' || !VALIDATION_CATEGORIES.has(finding.category) || !record(finding.entity)
    || !exact(finding.entity, ['type', 'id']) || typeof finding.entity.type !== 'string' || finding.entity.type.length > 100
    || (finding.entity.id !== null && (typeof finding.entity.id !== 'string' || finding.entity.id.length > 500))
    || typeof finding.path !== 'string' || finding.path.length > 500
    || typeof finding.rule !== 'string' || finding.rule.length > 300
    || typeof finding.explanation !== 'string' || finding.explanation.length > 4_000
    || typeof finding.blocking !== 'boolean'
    || (finding.remediation !== undefined && (typeof finding.remediation !== 'string' || finding.remediation.length > 4_000))) return null
  return Object.freeze({
    id: finding.id,
    severity: finding.severity,
    category: finding.category,
    entity: Object.freeze({ type: finding.entity.type, id: finding.entity.id }),
    path: finding.path,
    rule: finding.rule,
    explanation: finding.explanation,
    blocking: finding.blocking,
    ...(finding.remediation === undefined ? {} : { remediation: finding.remediation }),
  })
}

function adaptEntity(value: unknown) {
  if (!record(value) || !exact(value, [
    'entityType', 'entityRef', 'label', 'context', 'changeType', 'basePosition', 'candidatePosition',
    'fieldChangeCount', 'fieldChangesLimited', 'fieldChanges',
  ])
    || !CURRICULUM_DRAFT_ENTITY_TYPES.includes(value.entityType as typeof CURRICULUM_DRAFT_ENTITY_TYPES[number])
    || typeof value.entityRef !== 'string' || value.entityRef.length > 128
    || typeof value.label !== 'string' || value.label.length > 500
    || typeof value.context !== 'string' || value.context.length > 500
    || typeof value.changeType !== 'string' || !CHANGE_TYPES.has(value.changeType)
    || (value.basePosition !== null && !integer(value.basePosition))
    || (value.candidatePosition !== null && !integer(value.candidatePosition))
    || !integer(value.fieldChangeCount) || typeof value.fieldChangesLimited !== 'boolean'
    || !Array.isArray(value.fieldChanges) || value.fieldChanges.length > 80) return null
  const fieldChanges = value.fieldChanges.map(adaptFieldChange)
  if (fieldChanges.some((field) => field === null)
    || value.fieldChangeCount < fieldChanges.length
    || value.fieldChangesLimited !== (value.fieldChangeCount > fieldChanges.length)) return null
  return Object.freeze({
    ...value,
    fieldChanges: Object.freeze(fieldChanges),
  }) as unknown as CurriculumPreviewResult['entities'][number]
}

function adaptValidationRun(value: unknown) {
  if (!record(value) || !exact(value, ['engineVersion', 'status', 'statusMessage', 'publicationReady', 'source', 'summary', 'findings'])
    || value.engineVersion !== 'curriculum-validation-v2'
    || typeof value.status !== 'string' || !VALIDATION_STATUSES.has(value.status)
    || typeof value.statusMessage !== 'string' || value.statusMessage.length > 2_000
    || typeof value.publicationReady !== 'boolean'
    || !record(value.source) || !record(value.summary) || !Array.isArray(value.findings) || value.findings.length > 10_000) return null
  if (!exact(value.source, ['origin', 'snapshotId', 'curriculumVersion', 'schemaSetVersion'])
    || !['draft', 'published-release'].includes(value.source.origin as string)
    || (value.source.snapshotId !== null && (typeof value.source.snapshotId !== 'string' || value.source.snapshotId.length > 500))
    || (value.source.curriculumVersion !== null && (typeof value.source.curriculumVersion !== 'string' || value.source.curriculumVersion.length > 100))
    || (value.source.schemaSetVersion !== null && (typeof value.source.schemaSetVersion !== 'string' || value.source.schemaSetVersion.length > 100))) return null
  if (!exact(value.summary, ['total', 'errors', 'warnings', 'info', 'blocking', 'nonBlocking'])
    || !integer(value.summary.total) || !integer(value.summary.errors) || !integer(value.summary.warnings)
    || !integer(value.summary.info) || !integer(value.summary.blocking) || !integer(value.summary.nonBlocking)
    || value.summary.errors + value.summary.warnings + value.summary.info !== value.summary.total
    || value.summary.blocking + value.summary.nonBlocking !== value.summary.total) return null
  const findings = value.findings.map(adaptValidationFinding)
  if (findings.some((finding) => finding === null)) return null
  return Object.freeze({
    engineVersion: 'curriculum-validation-v2',
    status: value.status,
    statusMessage: value.statusMessage,
    publicationReady: value.publicationReady,
    source: Object.freeze({ ...value.source }),
    summary: Object.freeze({ ...value.summary }),
    findings: Object.freeze(findings),
  }) as unknown as CurriculumPreviewResult['validation']['run']
}

export function adaptCurriculumPreview(
  value: unknown,
  expectedDraftId: string,
  expectedRevision: number,
): CurriculumPreviewResult | null {
  if (!record(value) || !exact(value, ['schemaVersion', 'previewRef', 'authority', 'freshness', 'summary', 'validation', 'entities'])
    || value.schemaVersion !== 1 || typeof value.previewRef !== 'string' || value.previewRef.length > 500
    || value.freshness !== 'current' || !record(value.authority) || !record(value.summary)
    || !record(value.validation) || !Array.isArray(value.entities) || value.entities.length > 10_000) return null
  const authority = value.authority
  if (!exact(authority, ['draftId', 'draftRevision', 'baseReleaseVersion', 'targetVersion', 'schemaSetVersion', 'candidateDigest'])
    || authority.draftId !== expectedDraftId || authority.draftRevision !== expectedRevision
    || typeof authority.baseReleaseVersion !== 'string' || !VERSION.test(authority.baseReleaseVersion)
    || typeof authority.targetVersion !== 'string' || !VERSION.test(authority.targetVersion)
    || authority.schemaSetVersion !== '2.0.0' || typeof authority.candidateDigest !== 'string' || !HASH.test(authority.candidateDigest)
    || value.previewRef !== `curriculum-preview:${expectedDraftId}:${expectedRevision}:${authority.candidateDigest}`) return null
  const summary = value.summary
  const counts = adaptCounts(summary, false)
  if (!counts || !exact(summary, [
    'baseEntities', 'candidateEntities', 'totalCompared', 'unchanged', 'added', 'modified', 'removed',
    'byEntityType', 'validationStatus', 'publicationReady', 'validationBlockers', 'humanReviewBlockers', 'standardsBlockers',
  ]) || !integer(summary.baseEntities) || !integer(summary.candidateEntities) || !integer(summary.totalCompared)
    || counts.unchanged + counts.modified + counts.removed !== summary.baseEntities
    || counts.unchanged + counts.modified + counts.added !== summary.candidateEntities
    || counts.unchanged + counts.added + counts.modified + counts.removed !== summary.totalCompared
    || !record(summary.byEntityType) || typeof summary.validationStatus !== 'string' || !VALIDATION_STATUSES.has(summary.validationStatus)
    || typeof summary.publicationReady !== 'boolean' || !integer(summary.validationBlockers)
    || !integer(summary.humanReviewBlockers) || !integer(summary.standardsBlockers)) return null
  const rawByEntityType = summary.byEntityType
  if (!record(rawByEntityType)) return null
  const byEntityType = Object.fromEntries(CURRICULUM_DRAFT_ENTITY_TYPES.map((entityType) => {
    const projected = adaptCounts(rawByEntityType[entityType])
    return [entityType, projected]
  }))
  if (Object.values(byEntityType).some((typed) => typed === null)) return null
  const entities = value.entities.map(adaptEntity)
  if (entities.some((entity) => entity === null) || entities.length !== summary.totalCompared) return null
  const actual = adaptCounts({
    unchanged: entities.filter((entity) => entity?.changeType === 'unchanged').length,
    added: entities.filter((entity) => entity?.changeType === 'added').length,
    modified: entities.filter((entity) => entity?.changeType === 'modified').length,
    removed: entities.filter((entity) => entity?.changeType === 'removed').length,
  })
  if (!actual || Object.keys(actual).some((key) => actual[key as keyof typeof actual] !== counts[key as keyof typeof counts])) return null
  for (const entityType of CURRICULUM_DRAFT_ENTITY_TYPES) {
    const typed = byEntityType[entityType]
    if (!typed) return null
    for (const changeType of ['unchanged', 'added', 'modified', 'removed'] as const) {
      if (typed[changeType] !== entities.filter((entity) =>
        entity?.entityType === entityType && entity.changeType === changeType).length) return null
    }
  }
  if (!exact(value.validation, ['state', 'draftRevision', 'run'])) return null
  const validationRevision = value.validation.draftRevision
  const run = adaptValidationRun(value.validation.run)
  const validation = validationRevision === expectedRevision && value.validation.state === 'current' && run
    && run.source.snapshotId === `${expectedDraftId}@${expectedRevision}`
    && run.source.curriculumVersion === authority.targetVersion
    && run.source.schemaSetVersion === authority.schemaSetVersion
    ? { state: 'current' as const, draftRevision: validationRevision, run }
    : { state: 'not-current' as const, draftRevision: integer(validationRevision, 1) ? validationRevision : null, run: null }
  return Object.freeze({
    schemaVersion: 1,
    previewRef: value.previewRef,
    authority: Object.freeze(authority) as unknown as CurriculumPreviewResult['authority'],
    freshness: 'current',
    summary: Object.freeze({ ...summary, byEntityType: Object.freeze(byEntityType) }) as unknown as CurriculumPreviewResult['summary'],
    validation,
    entities: Object.freeze(entities) as unknown as CurriculumPreviewResult['entities'],
  })
}

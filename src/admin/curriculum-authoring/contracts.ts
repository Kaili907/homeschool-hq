import {
  assessmentSchema,
  courseSchema,
  lessonSchema,
  mediaResourceSchema,
  unitSchema,
  type Assessment,
  type Course,
  type Lesson,
  type MediaResource,
  type Unit,
} from '../../curriculum-authoring/v2/contracts'
import { validateWithSchema, type AuthoringSchema, type ValidationIssue } from '../../curriculum-authoring/v2/schema'
import type { CurriculumSnapshotValidationRun, CurriculumValidationFinding } from '../curriculum-validation/engine'
import type { CurriculumValidationSnapshotSummary } from '../curriculum-approval/contracts'

export const CURRICULUM_DRAFT_SCHEMA_VERSION = 1 as const
export const CURRICULUM_AUTHORING_SCHEMA_VERSION = '2.0.0' as const
export const CURRICULUM_DRAFT_READ_CAPABILITY = 'curriculum:read' as const
export const CURRICULUM_DRAFT_WRITE_CAPABILITY = 'curriculum:drafts:write' as const

export const CURRICULUM_DRAFT_ENTITY_TYPES = [
  'course',
  'unit',
  'lesson',
  'assessment',
  'media_resource',
] as const

export type CurriculumDraftEntityType = (typeof CURRICULUM_DRAFT_ENTITY_TYPES)[number]
export type CurriculumDraftEntityOrigin = 'base_override' | 'draft_created'
export type CurriculumDraftEntityPayload = Course | Unit | Lesson | Assessment | MediaResource
export type CurriculumDraftCollaboratorResponsibility = 'editor' | 'reviewer'

const schemas: Readonly<Record<CurriculumDraftEntityType, AuthoringSchema<unknown>>> = Object.freeze({
  course: courseSchema,
  unit: unitSchema,
  lesson: lessonSchema,
  assessment: assessmentSchema,
  media_resource: mediaResourceSchema,
})

const identityKeys: Readonly<Record<CurriculumDraftEntityType, string>> = Object.freeze({
  course: 'course_id',
  unit: 'unit_id',
  lesson: 'lesson_id',
  assessment: 'assessment_id',
  media_resource: 'resource_id',
})

export type CurriculumDraftEntityValidation =
  | { readonly success: true; readonly payload: CurriculumDraftEntityPayload }
  | { readonly success: false; readonly issues: readonly ValidationIssue[] }

/**
 * Save-time validation is deliberately entity-local. Cross-entity referential,
 * count, schedule, projection, and publication checks remain ADMIN-18 work.
 */
export function validateCurriculumDraftEntity(
  entityType: CurriculumDraftEntityType,
  entityRef: string,
  payload: unknown,
): CurriculumDraftEntityValidation {
  const result = validateWithSchema(schemas[entityType], payload)
  if (!result.success) return result
  const identityKey = identityKeys[entityType]
  const identity = (result.data as Record<string, unknown>)[identityKey]
  if (identity !== entityRef) {
    return {
      success: false,
      issues: [{
        code: 'invalid_value',
        path: `$.${identityKey}`,
        message: `must equal the authoritative entity reference ${entityRef}`,
      }],
    }
  }
  return { success: true, payload: result.data as CurriculumDraftEntityPayload }
}

export interface CurriculumDraftSummary {
  readonly schemaVersion: typeof CURRICULUM_DRAFT_SCHEMA_VERSION
  readonly draftId: string
  readonly baseReleaseVersion: string
  readonly targetVersion: string
  readonly authoringSchemaVersion: typeof CURRICULUM_AUTHORING_SCHEMA_VERSION
  readonly lifecycleState: 'draft'
  readonly revision: number
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CurriculumDraftEntitySummary {
  readonly entityType: CurriculumDraftEntityType
  readonly entityRef: string
  readonly origin: CurriculumDraftEntityOrigin
  readonly revision: number
  readonly position: number
  readonly tombstoned: boolean
  readonly digest: string
  readonly createdAt: string
  readonly updatedAt: string
}

export interface CurriculumDraftDetail extends CurriculumDraftSummary {
  readonly entities: readonly CurriculumDraftEntitySummary[]
}

export interface CurriculumDraftEntityDetail extends CurriculumDraftEntitySummary {
  readonly schemaVersion: typeof CURRICULUM_DRAFT_SCHEMA_VERSION
  readonly draftId: string
  readonly payload: CurriculumDraftEntityPayload
}

export interface CurriculumDraftMutationResult {
  readonly schemaVersion: typeof CURRICULUM_DRAFT_SCHEMA_VERSION
  readonly replayed: boolean
  readonly draftId: string
  readonly draftRevision: number
  readonly entity?: CurriculumDraftEntitySummary
}

export interface CurriculumDraftCollaborator {
  readonly principalRef: string
  readonly responsibility: CurriculumDraftCollaboratorResponsibility
  readonly status: 'active' | 'revoked'
  readonly assignmentRevision: number
  readonly assignedAt: string
  readonly revokedAt: string | null
}

export interface CurriculumDraftCollaborators {
  readonly schemaVersion: typeof CURRICULUM_DRAFT_SCHEMA_VERSION
  readonly draftId: string
  readonly draftRevision: number
  readonly currentResponsibility: CurriculumDraftCollaboratorResponsibility
  readonly collaborators: readonly CurriculumDraftCollaborator[]
}

export interface CurriculumDraftCollaboratorMutationResult {
  readonly schemaVersion: typeof CURRICULUM_DRAFT_SCHEMA_VERSION
  readonly replayed: boolean
  readonly draftId: string
  readonly draftRevision: number
  readonly collaborator: CurriculumDraftCollaborator
}

export interface CurriculumStudioEntityIndexEntry {
  readonly entityType: CurriculumDraftEntityType
  readonly entityRef: string
  readonly origin: 'base' | CurriculumDraftEntityOrigin
  readonly revision: number | null
  readonly position: number
  readonly parentId: string
  readonly label: string
  readonly context: string
  readonly grade?: number
  readonly subject?: string
  readonly courseRef?: string
  readonly unitRef?: string
}

export type CurriculumResourceKind = MediaResource['kind']
export type CurriculumResourceOrigin = 'base' | CurriculumDraftEntityOrigin | 'missing' | 'invalid'
export type CurriculumResourceLifecycle = 'active' | 'tombstoned' | 'missing' | 'invalid'
export type CurriculumResourceReferenceStatus =
  | 'referenced'
  | 'unreferenced'
  | 'missing-reference'
  | 'tombstoned-but-referenced'
  | 'invalid-reference'
export type CurriculumResourceValidationStatus = 'valid' | 'invalid' | 'not-applicable'

export interface CurriculumResourceReference {
  readonly entityType: 'lesson' | 'assessment'
  readonly entityRef: string
  readonly entityTitle: string
  readonly promptRef: string | null
  readonly path: string
  readonly navigationId: string
  readonly valid: boolean
}

export interface CurriculumResourceLibraryItem {
  /** Stable UI identity. Missing and invalid references do not masquerade as entities. */
  readonly key: string
  readonly resourceId: string | null
  readonly metadata: MediaResource | null
  readonly title: string
  readonly kind: CurriculumResourceKind | null
  readonly required: boolean | null
  readonly origin: CurriculumResourceOrigin
  readonly revision: number | null
  readonly position: number | null
  readonly lifecycle: CurriculumResourceLifecycle
  readonly overridden: boolean
  readonly referenceStatus: CurriculumResourceReferenceStatus
  readonly referenceCount: number
  readonly referencingEntityCount: number
  /** True when references is a bounded sample and referenceCount remains authoritative. */
  readonly referencesLimited: boolean
  readonly references: readonly CurriculumResourceReference[]
  readonly validationStatus: CurriculumResourceValidationStatus
  /** Authoritative unique finding count; validationFindings may be a bounded sample. */
  readonly validationFindingCount: number
  readonly validationFindingsLimited: boolean
  readonly validationFindings: readonly CurriculumValidationFinding[]
}

export interface CurriculumResourceLibrary {
  readonly schemaVersion: 1
  readonly source: {
    readonly origin: 'published-release' | 'draft'
    readonly baseReleaseVersion: string
    readonly draftId: string | null
    readonly draftRevision: number | null
  }
  readonly totals: {
    readonly resources: number
    readonly active: number
    readonly referenced: number
    readonly unreferenced: number
    readonly overridden: number
    readonly draftCreated: number
    readonly tombstoned: number
    readonly missingReferences: number
    readonly invalidReferences: number
    readonly referenceOccurrences: number
    readonly validationInvalid: number
  }
  readonly items: readonly CurriculumResourceLibraryItem[]
}

export interface CurriculumBaseAuthoringIndex {
  readonly schemaVersion: 1
  readonly baseReleaseVersion: string
  readonly entities: readonly CurriculumStudioEntityIndexEntry[]
  readonly resourceLibrary: CurriculumResourceLibrary
}

export interface CurriculumBaseAuthoringEntity {
  readonly schemaVersion: 1
  readonly baseReleaseVersion: string
  readonly entityType: CurriculumDraftEntityType
  readonly entityRef: string
  readonly payload: CurriculumDraftEntityPayload
}

export interface CurriculumDraftMaterialization {
  readonly schemaVersion: 1
  readonly draftId: string
  readonly draftRevision: number
  readonly baseReleaseVersion: string
  readonly entities: readonly CurriculumStudioEntityIndexEntry[]
  readonly resourceLibrary: CurriculumResourceLibrary
}

export interface CurriculumDraftValidationResult {
  readonly schemaVersion: 1
  readonly draftId: string
  readonly draftRevision: number
  readonly baseReleaseVersion: string
  readonly targetVersion: string
  readonly validationSnapshot: CurriculumValidationSnapshotSummary
  readonly run: CurriculumSnapshotValidationRun
}

export const CURRICULUM_PREVIEW_CHANGE_TYPES = ['unchanged', 'added', 'modified', 'removed'] as const
export type CurriculumPreviewChangeType = (typeof CURRICULUM_PREVIEW_CHANGE_TYPES)[number]

export type CurriculumPreviewFieldCategory =
  | 'identity'
  | 'content'
  | 'navigation'
  | 'lesson-content'
  | 'standards'
  | 'mastery'
  | 'tutor-routing'
  | 'safety-privacy'
  | 'accessibility'
  | 'assessment-structure'
  | 'resources'
  | 'extensions'
  | 'protected'

export interface CurriculumPreviewFieldValue {
  readonly kind: 'empty' | 'text' | 'number' | 'boolean' | 'list' | 'structure' | 'withheld'
  readonly display: string
  readonly itemCount?: number
  readonly truncated?: boolean
}

export interface CurriculumPreviewFieldChange {
  readonly path: string
  readonly label: string
  readonly category: CurriculumPreviewFieldCategory
  readonly before: CurriculumPreviewFieldValue
  readonly after: CurriculumPreviewFieldValue
}

export interface CurriculumPreviewEntityDiff {
  readonly entityType: CurriculumDraftEntityType
  readonly entityRef: string
  readonly label: string
  readonly context: string
  readonly changeType: CurriculumPreviewChangeType
  readonly basePosition: number | null
  readonly candidatePosition: number | null
  readonly fieldChangeCount: number
  readonly fieldChangesLimited: boolean
  readonly fieldChanges: readonly CurriculumPreviewFieldChange[]
}

export interface CurriculumPreviewChangeCounts {
  readonly unchanged: number
  readonly added: number
  readonly modified: number
  readonly removed: number
}

export interface CurriculumPreviewResult {
  readonly schemaVersion: 1
  readonly previewRef: string
  readonly authority: {
    readonly draftId: string
    readonly draftRevision: number
    readonly baseReleaseVersion: string
    readonly targetVersion: string
    readonly schemaSetVersion: typeof CURRICULUM_AUTHORING_SCHEMA_VERSION
    readonly candidateDigest: string
  }
  readonly freshness: 'current'
  readonly summary: CurriculumPreviewChangeCounts & {
    readonly baseEntities: number
    readonly candidateEntities: number
    readonly totalCompared: number
    readonly byEntityType: Readonly<Record<CurriculumDraftEntityType, CurriculumPreviewChangeCounts>>
    readonly validationStatus: CurriculumSnapshotValidationRun['status']
    readonly publicationReady: boolean
    readonly validationBlockers: number
    readonly humanReviewBlockers: number
    readonly standardsBlockers: number
  }
  readonly validation: {
    readonly state: 'current' | 'not-current' | 'unavailable'
    readonly draftRevision: number | null
    readonly run: CurriculumSnapshotValidationRun | null
  }
  readonly entities: readonly CurriculumPreviewEntityDiff[]
}

export interface CreateCurriculumDraftInput {
  readonly baseReleaseVersion: string
  readonly targetVersion: string
  readonly authoringSchemaVersion: typeof CURRICULUM_AUTHORING_SCHEMA_VERSION
  readonly idempotencyKey: string
}

export interface CreateCurriculumDraftEntityInput {
  readonly draftId: string
  readonly entityType: CurriculumDraftEntityType
  readonly entityRef: string
  readonly origin: CurriculumDraftEntityOrigin
  readonly position: number
  readonly payload: CurriculumDraftEntityPayload
  readonly expectedDraftRevision: number
  readonly idempotencyKey: string
}

export interface UpdateCurriculumDraftEntityInput {
  readonly draftId: string
  readonly entityType: CurriculumDraftEntityType
  readonly entityRef: string
  readonly position: number
  readonly payload: CurriculumDraftEntityPayload
  readonly expectedRevision: number
  readonly expectedDraftRevision: number
  readonly idempotencyKey: string
}

export interface TombstoneCurriculumDraftEntityInput {
  readonly draftId: string
  readonly entityType: CurriculumDraftEntityType
  readonly entityRef: string
  readonly expectedRevision: number
  readonly expectedDraftRevision: number
  readonly idempotencyKey: string
}

export interface AddCurriculumDraftCollaboratorInput {
  readonly draftId: string
  readonly principalRef: string
  readonly responsibility: CurriculumDraftCollaboratorResponsibility
  readonly expectedDraftRevision: number
  readonly idempotencyKey: string
}

export interface RevokeCurriculumDraftCollaboratorInput {
  readonly draftId: string
  readonly principalRef: string
  readonly expectedDraftRevision: number
  readonly idempotencyKey: string
}

export interface CurriculumDraftAuthoringSource {
  listDrafts(): Promise<{ readonly schemaVersion: 1; readonly drafts: readonly CurriculumDraftSummary[] }>
  readDraft(draftId: string): Promise<CurriculumDraftDetail>
  readEntity(draftId: string, entityType: CurriculumDraftEntityType, entityRef: string): Promise<CurriculumDraftEntityDetail>
  createDraft(input: CreateCurriculumDraftInput): Promise<CurriculumDraftMutationResult>
  createEntity(input: CreateCurriculumDraftEntityInput): Promise<CurriculumDraftMutationResult>
  updateEntity(input: UpdateCurriculumDraftEntityInput): Promise<CurriculumDraftMutationResult>
  tombstoneEntity(input: TombstoneCurriculumDraftEntityInput): Promise<CurriculumDraftMutationResult>
  listCollaborators(draftId: string): Promise<CurriculumDraftCollaborators>
  addCollaborator(input: AddCurriculumDraftCollaboratorInput): Promise<CurriculumDraftCollaboratorMutationResult>
  revokeCollaborator(input: RevokeCurriculumDraftCollaboratorInput): Promise<CurriculumDraftCollaboratorMutationResult>
  readBaseIndex(baseReleaseVersion: string): Promise<CurriculumBaseAuthoringIndex>
  readBaseEntity(
    baseReleaseVersion: string,
    entityType: CurriculumDraftEntityType,
    entityRef: string,
  ): Promise<CurriculumBaseAuthoringEntity>
  readMaterialization(draftId: string, revision: number): Promise<CurriculumDraftMaterialization>
  validateDraft(draftId: string, revision: number): Promise<CurriculumDraftValidationResult>
  readPreview(draftId: string, revision: number): Promise<CurriculumPreviewResult>
}

export class CurriculumDraftAuthoringError extends Error {
  readonly code: 'unauthenticated' | 'forbidden' | 'invalid' | 'conflict' | 'not-found' | 'unavailable'
  readonly reason?:
    | 'revision-conflict'
    | 'idempotency-conflict'
    | 'schema-v2-rejected'
    | 'verified-principal-required'
    | 'last-editor'
    | 'already-assigned'

  constructor(code: CurriculumDraftAuthoringError['code'], reason?: CurriculumDraftAuthoringError['reason']) {
    super(code)
    this.name = 'CurriculumDraftAuthoringError'
    this.code = code
    this.reason = reason
  }
}

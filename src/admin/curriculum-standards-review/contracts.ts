import type { CurriculumEntityType, CurriculumValidationFinding } from '../curriculum-validation/engine'

export const CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION = 1 as const
export const CURRICULUM_STANDARDS_REVIEW_READ_CAPABILITY = 'curriculum:read' as const
export const CURRICULUM_STANDARDS_REVIEW_WRITE_CAPABILITY = 'curriculum:drafts:write' as const
export const CURRICULUM_STANDARDS_REVIEW_APPROVE_CAPABILITY = 'curriculum:approve' as const

export const CURRICULUM_STANDARDS_REVIEW_STATES = [
  'unreviewed',
  'in_review',
  'approved_mapping',
  'rejected_mapping',
  'needs_evidence',
] as const

export type CurriculumStandardsReviewState = (typeof CURRICULUM_STANDARDS_REVIEW_STATES)[number]
export type CurriculumStandardsReviewContextKind = 'published_release' | 'draft'

export interface CurriculumStandardsReviewEntity {
  readonly findingId: string
  readonly entityType: Extract<CurriculumEntityType, 'course' | 'unit' | 'lesson' | 'assessment'>
  readonly entityRef: string
  readonly path: string
}

export interface CurriculumStandardsReviewCandidate {
  readonly reviewKey: string
  readonly contextKind: CurriculumStandardsReviewContextKind
  readonly contextRef: string
  readonly sourceLabel: string
  readonly grade: number
  readonly courseRef: string
  readonly findingRule: 'standards.human_review_required'
  readonly affectedCount: number
  readonly entities: readonly CurriculumStandardsReviewEntity[]
}

export interface CurriculumStandardsReviewOccurrence {
  readonly finding: CurriculumValidationFinding
  readonly sourceLabel: string
  readonly grade: number
  readonly courseRef: string
}

export interface CurriculumStandardsReviewDecision {
  readonly schemaVersion: typeof CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION
  readonly reviewKey: string
  readonly contextKind: CurriculumStandardsReviewContextKind
  readonly contextRef: string
  readonly sourceLabel: string
  readonly grade: number
  readonly courseRef: string
  readonly findingRule: 'standards.human_review_required'
  readonly affectedCount: number
  readonly findingIds: readonly string[]
  readonly status: CurriculumStandardsReviewState
  readonly canonicalStandardId: string | null
  readonly frameworkVersion: string | null
  readonly canonicalTitle: string | null
  readonly evidenceSource: string | null
  readonly reviewerNote: string | null
  readonly revision: number
  readonly updatedAt: string
}

export interface CurriculumStandardsReviewItem extends CurriculumStandardsReviewCandidate {
  readonly decision: CurriculumStandardsReviewDecision | null
  readonly status: CurriculumStandardsReviewState
}

export interface CurriculumStandardsReviewMutationInput extends CurriculumStandardsReviewCandidate {
  readonly status: Exclude<CurriculumStandardsReviewState, 'unreviewed'>
  readonly canonicalStandardId: string | null
  readonly frameworkVersion: string | null
  readonly canonicalTitle: string | null
  readonly evidenceSource: string | null
  readonly reviewerNote: string | null
  readonly expectedRevision: number
  readonly idempotencyKey: string
}

export interface CurriculumStandardsReviewMutationResult {
  readonly schemaVersion: typeof CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION
  readonly replayed: boolean
  readonly decision: CurriculumStandardsReviewDecision
}

export interface CurriculumDraftStandardsReviewWorkspace {
  readonly schemaVersion: typeof CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION
  readonly draftId: string
  readonly draftRevision: number
  readonly baseReleaseVersion: string
  readonly targetVersion: string
  readonly occurrences: readonly CurriculumStandardsReviewOccurrence[]
  readonly decisions: readonly CurriculumStandardsReviewDecision[]
}

export interface CurriculumStandardsReviewSource {
  list(contextKind: CurriculumStandardsReviewContextKind, contextRef: string): Promise<{
    readonly schemaVersion: typeof CURRICULUM_STANDARDS_REVIEW_SCHEMA_VERSION
    readonly decisions: readonly CurriculumStandardsReviewDecision[]
  }>
  readDraftWorkspace(draftId: string, draftRevision: number): Promise<CurriculumDraftStandardsReviewWorkspace>
  update(input: CurriculumStandardsReviewMutationInput): Promise<CurriculumStandardsReviewMutationResult>
}

export class CurriculumStandardsReviewError extends Error {
  readonly code: 'unauthenticated' | 'forbidden' | 'invalid' | 'conflict' | 'unavailable'

  constructor(code: CurriculumStandardsReviewError['code']) {
    super(code)
    this.name = 'CurriculumStandardsReviewError'
    this.code = code
  }
}

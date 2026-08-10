export const CURRICULUM_STAGING_SCHEMA_VERSION = 1 as const
export const CURRICULUM_STAGING_CAPABILITY = 'curriculum:publish' as const

export type CurriculumStagingBlockingReason =
  | 'validation_missing'
  | 'validation_blocked'
  | 'approval_missing'
  | 'approval_stale'
  | 'changes_requested'
  | 'target_version_collision'
  | 'revision_mismatch'
  | 'schema_set_unsupported'

export interface CurriculumStagedCandidate {
  readonly stagingId: string
  readonly status: 'staged'
  readonly publicationStatus: 'not_published'
  readonly validationSnapshotId: string
  readonly approvalId: string
  readonly entityCounts: Readonly<Record<string, number>>
  readonly fileCount: number
  readonly byteCount: number
  readonly contentHash: string
  readonly manifestHash: string
  readonly packageHash: string
  readonly stagedAt: string
  readonly authority: typeof CURRICULUM_STAGING_CAPABILITY
}

export interface CurriculumStagingStatusResult {
  readonly schemaVersion: typeof CURRICULUM_STAGING_SCHEMA_VERSION
  readonly draftId: string
  readonly draftRevision: number
  readonly baseReleaseVersion: string
  readonly targetVersion: string
  readonly schemaSetVersion: '2.0.0'
  readonly stageState: 'blocked' | 'eligible' | 'staged'
  readonly eligible: boolean
  readonly blockingReasons: readonly CurriculumStagingBlockingReason[]
  readonly validation: {
    readonly status: 'valid' | 'invalid' | 'incomplete' | 'unavailable' | 'error'
    readonly validationSnapshotId: string
  } | null
  readonly approval: {
    readonly status: 'approved' | 'changes_requested' | 'stale'
    readonly approvalId: string | null
  } | null
  readonly candidate: CurriculumStagedCandidate | null
}

export interface CurriculumStagingMutationResult extends CurriculumStagingStatusResult {
  readonly replayed: boolean
}

export interface CurriculumStagingInput {
  readonly draftId: string
  readonly draftRevision: number
  readonly idempotencyKey: string
}

export interface CurriculumStagingSource {
  readStaging(draftId: string): Promise<CurriculumStagingStatusResult>
  stageDraft(input: CurriculumStagingInput): Promise<CurriculumStagingMutationResult>
}

export class CurriculumStagingError extends Error {
  readonly code: 'unauthenticated' | 'forbidden' | 'invalid' | 'conflict' | 'not-found' | 'unavailable'
  readonly reason?:
    | 'revision-conflict'
    | 'idempotency-conflict'
    | 'gate-blocked'
    | 'target-version-collision'
    | 'package-conflict'

  constructor(code: CurriculumStagingError['code'], reason?: CurriculumStagingError['reason']) {
    super(code)
    this.name = 'CurriculumStagingError'
    this.code = code
    this.reason = reason
  }
}

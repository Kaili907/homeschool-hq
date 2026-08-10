export const CURRICULUM_PUBLISHING_SCHEMA_VERSION = 1 as const
export const CURRICULUM_PUBLISHING_CAPABILITY = 'curriculum:publish' as const

export type CurriculumPublishingBlockingReason =
  | 'staged_candidate_missing'
  | 'staging_identity_mismatch'
  | 'artifact_set_incomplete'
  | 'artifact_tampered'
  | 'manifest_mismatch'
  | 'package_mismatch'
  | 'approval_stale'
  | 'validation_blocked'
  | 'human_review_blocked'
  | 'target_version_collision'

export interface CurriculumPublicationVerification {
  readonly artifactSetComplete: boolean
  readonly contentVerified: boolean
  readonly manifestVerified: boolean
  readonly packageVerified: boolean
  readonly actualFileCount: number
  readonly actualByteCount: number
}

export interface CurriculumPublicationCandidate {
  readonly stagingId: string
  readonly status: 'staged'
  readonly draftRevision: number
  readonly validationSnapshotId: string
  readonly validationStatus: 'publication_ready' | 'blocked'
  readonly approvalId: string
  readonly approvalStatus: 'current' | 'stale'
  readonly humanReviewStatus: 'clear' | 'blocked'
  readonly fileCount: number
  readonly byteCount: number
  readonly contentHash: string
  readonly manifestHash: string
  readonly packageHash: string
  readonly verification: CurriculumPublicationVerification
}

export interface PublishedCurriculumRelease {
  readonly releaseId: string
  readonly version: string
  readonly status: 'published'
  readonly activationStatus: 'not_active'
  readonly stagingId: string
  readonly contentHash: string
  readonly manifestHash: string
  readonly packageHash: string
  readonly fileCount: number
  readonly byteCount: number
  readonly publishedAt: string
  readonly authority: typeof CURRICULUM_PUBLISHING_CAPABILITY
}

export interface CurriculumPublishingStatusResult {
  readonly schemaVersion: typeof CURRICULUM_PUBLISHING_SCHEMA_VERSION
  readonly draftId: string
  readonly draftRevision: number
  readonly baseReleaseVersion: string
  readonly targetVersion: string
  readonly schemaSetVersion: '2.0.0'
  readonly publicationState: 'not_staged' | 'blocked' | 'eligible' | 'published'
  readonly eligible: boolean
  readonly blockingReasons: readonly CurriculumPublishingBlockingReason[]
  readonly candidate: CurriculumPublicationCandidate | null
  readonly published: PublishedCurriculumRelease | null
}

export interface CurriculumPublishingMutationResult extends CurriculumPublishingStatusResult {
  readonly replayed: boolean
}

export interface CurriculumPublishingInput {
  readonly draftId: string
  readonly stagingId: string
  readonly idempotencyKey: string
}

export interface CurriculumPublishingSource {
  readPublication(draftId: string): Promise<CurriculumPublishingStatusResult>
  publishStaged(input: CurriculumPublishingInput): Promise<CurriculumPublishingMutationResult>
}

export class CurriculumPublishingError extends Error {
  readonly code: 'unauthenticated' | 'forbidden' | 'invalid' | 'conflict' | 'not-found' | 'unavailable'
  readonly reason?:
    | 'artifact-invalid'
    | 'manifest-mismatch'
    | 'package-mismatch'
    | 'approval-stale'
    | 'validation-blocked'
    | 'human-review-blocked'
    | 'target-version-collision'
    | 'revision-conflict'
    | 'idempotency-conflict'
    | 'gate-blocked'

  constructor(code: CurriculumPublishingError['code'], reason?: CurriculumPublishingError['reason']) {
    super(code)
    this.name = 'CurriculumPublishingError'
    this.code = code
    this.reason = reason
  }
}

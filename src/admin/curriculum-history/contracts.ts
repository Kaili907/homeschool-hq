import type { CurriculumActivationHistoryEntry } from '../curriculum-activation'

export const CURRICULUM_RELEASE_HISTORY_SCHEMA_VERSION = 1 as const
export const CURRICULUM_RELEASE_HISTORY_READ_CAPABILITY = 'curriculum:read' as const

export interface CurriculumReleaseRegistryCounts {
  readonly courses: number
  readonly units: number
  readonly lessons: number
  readonly assessments: number
  readonly texts: number
  readonly schedules: number
}

interface CurriculumReleaseRegistrySummaryBase {
  readonly packageId: string
  readonly version: string
  readonly status: 'published'
  readonly registeredAt: string
  readonly authoredOn: string | null
  readonly fileCount: number
  readonly byteCount: number
  readonly counts: CurriculumReleaseRegistryCounts
}

export type CurriculumReleaseRegistrySummary = CurriculumReleaseRegistrySummaryBase & (
  | {
    readonly provenanceClass: 'legacy_import'
    readonly sourceCommit: string
    readonly sourceRoot: string
    readonly stagingId: null
  }
  | {
    readonly provenanceClass: 'staged_publish'
    readonly sourceCommit: null
    readonly sourceRoot: null
    readonly stagingId: string
  }
)

export type CurriculumReleaseLifecycle = 'active' | 'previously_active' | 'published'
export type CurriculumRollbackEligibilityState = 'eligible' | 'ineligible' | 'unverified'
export type CurriculumReleaseIntegrityState =
  | 'verified_evidence_available'
  | 'evidence_unavailable'
  | 'unverified'

export type CurriculumRollbackBlockingReason =
  | 'current_release'
  | 'not_previously_active'
  | 'integrity_evidence_unavailable'
  | 'pointer_evidence_unavailable'
  | null

export interface CurriculumRollbackEligibility {
  readonly state: CurriculumRollbackEligibilityState
  readonly blockingReason: CurriculumRollbackBlockingReason
  readonly explanation: string
}

interface CurriculumReleaseGovernanceEntryBase {
  readonly packageId: string
  readonly version: string
  readonly publishedAt: string
  readonly authoredOn: string | null
  readonly publishedStatus: 'published'
  readonly lifecycle: CurriculumReleaseLifecycle
  readonly active: boolean
  readonly previouslyActive: boolean
  readonly pointerRevisions: readonly number[]
  readonly integrityState: CurriculumReleaseIntegrityState
  readonly provenanceEvidenceAvailable: true
  readonly baseReleaseVersion: null
  readonly rollbackEligibility: CurriculumRollbackEligibility
  readonly counts: CurriculumReleaseRegistryCounts
}

export type CurriculumReleaseGovernanceEntry = CurriculumReleaseGovernanceEntryBase & (
  | {
    readonly provenanceKind: 'legacy'
    readonly provenanceCompleteness: 'incomplete'
    readonly sourceCommit: string
    readonly sourceRoot: string
    readonly stagingId: null
  }
  | {
    readonly provenanceKind: 'staged_publish'
    readonly provenanceCompleteness: 'complete'
    readonly sourceCommit: null
    readonly sourceRoot: null
    readonly stagingId: string
  }
)

export interface CurriculumReleaseTransition {
  readonly pointerRevision: number
  readonly previousReleaseVersion: string | null
  readonly newReleaseVersion: string
  readonly transitionKind: CurriculumActivationHistoryEntry['transitionKind']
  readonly reasonCode: CurriculumActivationHistoryEntry['reasonCode']
  readonly transitionedAt: string
}

export interface CurriculumReleaseHistoryModel {
  readonly schemaVersion: typeof CURRICULUM_RELEASE_HISTORY_SCHEMA_VERSION
  readonly environment: 'production'
  readonly authority: 'default_current_curriculum'
  readonly activeReleaseVersion: string
  readonly pointerRevision: number
  readonly pointerTransitionKind: CurriculumActivationHistoryEntry['transitionKind']
  readonly pointerTransitionedAt: string
  readonly releases: readonly CurriculumReleaseGovernanceEntry[]
  readonly transitions: readonly CurriculumReleaseTransition[]
  readonly historyTruncated: boolean
}

export interface CurriculumReleaseHistorySource {
  read(): Promise<CurriculumReleaseHistoryModel>
}

export class CurriculumReleaseHistoryError extends Error {
  readonly code: 'unauthenticated' | 'forbidden' | 'unavailable'

  constructor(code: CurriculumReleaseHistoryError['code']) {
    super(code)
    this.name = 'CurriculumReleaseHistoryError'
    this.code = code
  }
}

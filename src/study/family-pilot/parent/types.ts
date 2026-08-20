import type { StudyReviewRecommendation } from '../../types'

/**
 * First-party, plain typed contracts for the family-pilot Parent Hub. Every
 * value here is composed directly from src/study/types.ts — there is no
 * generic/structural handling of untrusted objects (see the deferred H5
 * prototype-pollution hardening in src/study/parent-production/wire.ts, which
 * this module deliberately does not reuse).
 */

export interface FamilyPilotLearnerOption {
  readonly hostProfileRef: string
  readonly learnerRef: string
  readonly displayName: string
}

export type FamilyPilotWorkStatus = 'not-started' | 'in-progress' | 'paused' | 'completed'

export type FamilyPilotPauseCategory = 'outside' | 'technical' | 'unspecified'

export interface FamilyPilotPauseState {
  readonly blockRef: string
  readonly category: FamilyPilotPauseCategory
}

export interface FamilyPilotWorkItem {
  readonly blockRef: string
  readonly title: string
  readonly status: FamilyPilotWorkStatus
  readonly scheduledLocalDate: string
  readonly requiredWorkCompletionPercent: number
  readonly currentSegmentTitle: string | null
  readonly currentSegmentOrdinal: number | null
  readonly totalSegments: number
  readonly completedSegmentCount: number
  readonly timeOnTaskSeconds: number | null
  readonly pauseState: FamilyPilotPauseState | null
}

export interface FamilyPilotReviewItem {
  readonly recommendationRef: string
  readonly dueDate: string
  readonly reasonCodes: readonly string[]
  readonly status: StudyReviewRecommendation['status']
}

export interface FamilyPilotSafetyStatus {
  readonly hasActiveStop: boolean
  readonly mostRecentStopAt: string | null
  readonly historyState: 'available' | 'unavailable' | 'incomplete'
}

export interface FamilyPilotWorkCounts {
  readonly notStarted: number
  readonly inProgress: number
  readonly paused: number
  readonly completed: number
}

export interface FamilyPilotStudentSnapshot {
  readonly learner: FamilyPilotLearnerOption
  readonly workItems: readonly FamilyPilotWorkItem[]
  readonly reviewItems: readonly FamilyPilotReviewItem[]
  readonly safety: FamilyPilotSafetyStatus
  readonly counts: FamilyPilotWorkCounts
}

export interface FamilyPilotActionOutcome {
  readonly ok: boolean
  readonly message: string
}

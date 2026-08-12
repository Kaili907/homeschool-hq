import type { StudyReviewRecommendation } from '../../types'
import type { SafetyHoldV1 } from '../safety'

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

/**
 * The Family Pilot safety-hold surface (mac/family-pilot-safety-r1), a
 * separate and resolvable concept from FamilyPilotSafetyStatus above, which
 * reflects the Study Engine's own PERMANENT local-stop ledger and is never
 * resolvable from this Hub. Absent when the safety-hold bridge is not wired
 * (e.g. an existing FamilyPilotParentHub caller/test that predates it), in
 * which case no hold section renders — identical to today's behavior.
 */
export interface FamilyPilotSafetyHoldsView {
  readonly openHoldsFor: (studentRef: string) => readonly SafetyHoldV1[]
  readonly resolveHold: (holdRef: string, clearedBy: string) => { readonly ok: boolean; readonly message: string }
}

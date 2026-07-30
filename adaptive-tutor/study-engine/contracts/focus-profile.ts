import type {
  AccommodationId,
  ActorReference,
  AdjustmentId,
  ContractHeader,
  EffectiveWorkBlockRange,
  FocusProfileId,
  GradeBand,
  ISODateTime,
  SkillId,
  StudentId,
  SubjectId,
} from './common.ts'
import type { StudyTaskType } from './study-plan.ts'

export type TimerPresentationPreference =
  | 'hidden'
  | 'count-up'
  | 'count-down'
  | 'progress-bar'
  | 'milestones-only'

export interface InsufficientFocusData {
  readonly status: 'insufficient-data'
  readonly eligibleObservationCount: number
  readonly minimumObservationCount: number
  /**
   * Generic planning guidance only; this is not a personalized measurement.
   */
  readonly gradeBandStartingRange: EffectiveWorkBlockRange
  readonly reason: 'new-profile' | 'too-few-sessions' | 'inconsistent-contexts' | 'data-withheld'
}

export interface EstablishedFocusEstimate {
  readonly status: 'established'
  readonly eligibleObservationCount: number
  readonly assessedAt: ISODateTime
  readonly confidence: 'low' | 'moderate' | 'high'
  readonly baselineWorkDurationMinutes: number
  readonly currentTargetWorkDurationMinutes: number
  readonly comfortableMaximumWorkDurationMinutes: number
  /**
   * Contextual, revisable range inferred from eligible study observations.
   */
  readonly effectiveWorkBlockRange: EffectiveWorkBlockRange
  readonly evidenceIds: readonly string[]
}

export type FocusEstimate = InsufficientFocusData | EstablishedFocusEstimate

export interface ScopedFocusProfile {
  readonly effectiveWorkBlockRange: EffectiveWorkBlockRange
  readonly breakDurationMinutes: number
  readonly evidenceIds: readonly string[]
}

export interface TaskSpecificFocusProfile extends ScopedFocusProfile {
  readonly taskType: StudyTaskType
  readonly customTaskTypeId?: string
}

export interface SubjectSpecificFocusProfile extends ScopedFocusProfile {
  readonly subjectId: SubjectId
}

export interface AccessibilitySettings {
  readonly textScalePercent: number
  readonly reducedMotion: boolean
  readonly highContrast: boolean
  readonly narration: 'off' | 'available' | 'preferred'
  readonly captions: boolean
  readonly inputModes: readonly ('keyboard' | 'touch' | 'speech' | 'paper' | 'switch')[]
  readonly lowDistractionPresentation: boolean
}

export interface AccommodationSetting {
  readonly id: AccommodationId
  readonly category:
    | 'presentation'
    | 'response'
    | 'setting'
    | 'timing'
    | 'assistive-technology'
    | 'other'
  readonly enabled: boolean
  readonly functionalDescription: string
  readonly approvedBy: 'parent' | 'teacher' | 'school-plan'
  readonly reviewAt?: ISODateTime
}

export interface FocusAdjustment {
  readonly id: AdjustmentId
  readonly changedAt: ISODateTime
  readonly changedBy: ActorReference
  readonly previousTargetMinutes?: number
  readonly nextTargetMinutes: number
  readonly reason:
    | 'new-evidence'
    | 'student-feedback'
    | 'accommodation'
    | 'parent-override'
    | 'teacher-override'
    | 'context-change'
  readonly evidenceIds: readonly string[]
}

export interface ParentFocusOverride {
  readonly active: boolean
  readonly maximumWorkDurationMinutes?: number
  readonly targetWorkDurationMinutes?: number
  readonly breakDurationMinutes?: number
  readonly setBy: ActorReference & { readonly role: 'parent' | 'teacher' }
  readonly reason: string
  readonly createdAt: ISODateTime
  readonly expiresAt?: ISODateTime
  readonly reviewAt: ISODateTime
}

export interface StudentFocusProfile
  extends ContractHeader<'student-focus-profile', FocusProfileId> {
  readonly studentId: StudentId
  readonly gradeBand: GradeBand
  readonly estimate: FocusEstimate
  readonly breakDurationMinutes: number
  readonly timerPresentationPreference: TimerPresentationPreference
  readonly taskSpecificProfiles: readonly TaskSpecificFocusProfile[]
  readonly subjectSpecificProfiles: readonly SubjectSpecificFocusProfile[]
  readonly accessibility: AccessibilitySettings
  readonly accommodations: readonly AccommodationSetting[]
  readonly adjustmentHistory: readonly FocusAdjustment[]
  readonly parentOverride?: ParentFocusOverride
  /** Optional skill refs that should be considered when comparing contexts. */
  readonly contextSkillIds?: readonly SkillId[]
}

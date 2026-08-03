import type {
  AccommodationId,
  ActorReference,
  ContractHeader,
  ControlSetId,
  ISODateTime,
  PrivateRecordId,
  RecommendationId,
  ReviewId,
  StudentId,
} from './common.ts'
import type { TimerPresentationPreference } from './focus-profile.ts'

export type ApprovedInterruptionCategory =
  | 'accessibility-need'
  | 'technology-issue'
  | 'scheduled-appointment'
  | 'family-need'
  | 'teacher-directed'
  | 'parent-directed'
  | 'wellbeing'
  | 'emergency'

export interface ManualStudyOverride {
  readonly id: string
  readonly target: 'work-duration' | 'break-duration' | 'timer-visibility' | 'schedule' | 'accommodation'
  readonly setBy: ActorReference & { readonly role: 'parent' | 'teacher' }
  readonly reason: string
  readonly createdAt: ISODateTime
  readonly expiresAt?: ISODateTime
  readonly maximumWorkDurationMinutes?: number
  readonly breakDurationMinutes?: number
  readonly timerPresentation?: TimerPresentationPreference
  /** Required for schedule and accommodation override targets. */
  readonly referenceId?: string
}

export interface RecommendationDecision {
  readonly id: string
  readonly recommendationId: RecommendationId
  readonly decision: 'accepted' | 'rejected'
  readonly decidedBy: ActorReference & { readonly role: 'parent' | 'teacher' }
  readonly decidedAt: ISODateTime
  readonly reason?: string
}

export interface ControlAccommodation {
  readonly id: AccommodationId
  readonly enabled: boolean
  readonly functionalDescription: string
  readonly source: 'parent' | 'teacher' | 'school-plan'
  readonly reviewAt?: ISODateTime
}

export interface ReschedulingRecord {
  readonly id: string
  readonly studyPlanId: string
  readonly originalStartAt: ISODateTime
  readonly replacementStartAt: ISODateTime
  readonly changedBy: ActorReference & { readonly role: 'parent' | 'teacher' }
  readonly reason: string
  readonly changedAt: ISODateTime
}

export interface AdultReviewRequest {
  readonly id: ReviewId
  readonly requestedAt: ISODateTime
  readonly requestedBy: ActorReference
  readonly category:
    | 'reteaching'
    | 'prerequisite-review'
    | 'accommodation-review'
    | 'schedule-review'
    | 'student-support'
  readonly status: 'open' | 'acknowledged' | 'resolved'
  readonly basisEvidenceIds: readonly string[]
}

export interface ParentTeacherControls
  extends ContractHeader<'parent-teacher-controls', ControlSetId> {
  readonly studentId: StudentId
  /**
   * Operational guardrail only. It must not be described as a child trait.
   */
  readonly maximumWorkDurationMinutes: number
  readonly breakDuration: {
    readonly minimumMinutes: number
    readonly defaultMinutes: number
    readonly maximumMinutes: number
  }
  readonly timerVisibility: TimerPresentationPreference
  readonly manualOverrides: readonly ManualStudyOverride[]
  readonly recommendationDecisions: readonly RecommendationDecision[]
  readonly accommodations: readonly ControlAccommodation[]
  readonly rescheduling: readonly ReschedulingRecord[]
  readonly reviewRequests: readonly AdultReviewRequest[]
  readonly approvedInterruptionCategories: readonly ApprovedInterruptionCategory[]
  /** Adult-private bodies are stored only in the separately authorized record. */
  readonly privateRecordRef?: PrivateRecordId
}

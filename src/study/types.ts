export type StudySubject = 'math' | 'reading' | 'writing' | 'other'

export type CanonicalStudyTaskType =
  | 'retrieval-practice'
  | 'direct-instruction'
  | 'worked-example'
  | 'guided-practice'
  | 'independent-practice'
  | 'prerequisite-remediation'
  | 'reading'
  | 'writing'
  | 'project-work'
  | 'problem-solving'
  | 'discussion'
  | 'reflection'
  | 'mastery-check'
  | 'custom'

export interface StudyAccessibilitySettings {
  readonly largeText: boolean
  readonly reducedMotion: boolean
  readonly noAudio: boolean
  readonly captions: boolean
  readonly transientTranscript: boolean
  readonly highContrast: boolean
  readonly oneTaskAtATime: boolean
}

export interface StudyTimerPreference {
  readonly visibility: 'shown' | 'hidden'
  readonly milestonesOnly: boolean
}

export interface StudyDurationLimits {
  readonly maximumWorkMinutes: number
  readonly breakMinutes: number
}

export interface StudyAccommodationLimits {
  readonly maximumWorkMinutes?: number
  readonly minimumBreakMinutes?: number
  readonly timerMustBeHidden?: boolean
}

export interface HostStudyLaunchContext {
  readonly householdRef: string
  readonly learnerRef: string
  readonly hostProfileRef: string
  readonly grade: number
  readonly subject: StudySubject
  readonly lessonRef: string
  readonly skillRefs: readonly string[]
  readonly householdTimeZone: string
  readonly learnerLocalDate: string
  readonly accessibility: StudyAccessibilitySettings
  readonly timerPreference: StudyTimerPreference
  readonly parentLimits: StudyDurationLimits
  readonly accommodationLimits: StudyAccommodationLimits
}

export interface StudyScope {
  readonly householdRef: string
  readonly learnerRef: string
  readonly sessionRef: string
}

export interface StudyLearnerScope {
  readonly householdRef: string
  readonly learnerRef: string
}

export interface StudyPlanSegment {
  readonly segmentRef: string
  readonly title: string
  readonly taskType: CanonicalStudyTaskType
  readonly customTaskTypeId?: string
  readonly estimatedMinutes: number
  readonly required: boolean
}

export interface StudyLessonPlan {
  readonly lessonRef: string
  readonly title: string
  readonly subject: StudySubject
  readonly skillRefs: readonly string[]
  readonly segments: readonly StudyPlanSegment[]
  readonly masteryAuthority: 'tutor-core' | 'completion-only'
  readonly source: 'manuel-academy' | 'parent' | 'romeo-virtual-academy'
}

export type StudyCalendarBlockKind =
  | 'new_instruction'
  | 'guided_practice'
  | 'independent_practice'
  | 'reading'
  | 'writing'
  | 'memorization'
  | 'assessment'
  | 'project_work'
  | 'review'
  | 'parent_created_activity'
  | 'physical_education'
  | 'outside_activity'
  | 'romeo_virtual_academy_activity'

export interface StudyCalendarDraft {
  readonly blockRef: string
  readonly externalItemRef: string
  readonly plan: StudyLessonPlan
  readonly blockKind: StudyCalendarBlockKind
  readonly scheduledLocalStart: string
  readonly scheduledStart: string
  readonly intendedLocalDate: string
  readonly householdTimeZone: string
  readonly timerVisibility: 'shown' | 'hidden'
}

export interface StudyResumePoint {
  readonly segmentRef: string
  readonly segmentOrdinal: number
  readonly elapsedActiveSecondsInSegment: number
  readonly completedSegmentRefs: readonly string[]
  readonly remainingSegmentRefs: readonly string[]
  readonly capturedAt: string
}

export interface StudyCalendarEntry {
  readonly blockRef: string
  readonly externalItemRef: string
  readonly learnerRef: string
  readonly title: string
  readonly lessonRef: string
  readonly subject: StudySubject
  readonly skillRefs: readonly string[]
  readonly source: StudyLessonPlan['source']
  readonly masteryAuthority: StudyLessonPlan['masteryAuthority']
  readonly blockKind: StudyCalendarBlockKind
  readonly scheduledStart: string
  readonly intendedLocalDate: string
  readonly householdTimeZone: string
  readonly timerVisibility: 'shown' | 'hidden'
  readonly state: 'scheduled' | 'active' | 'paused' | 'completed'
  readonly segments: readonly StudyPlanSegment[]
  readonly completedSegmentRefs: readonly string[]
  readonly resumePoint?: StudyResumePoint
  readonly requiredWorkCompletionPercent: number
  readonly estimatedRemainingMinutes: number
  readonly continuationOf?: string
}

export interface StudyCheckpoint {
  readonly checkpointRef: string
  readonly householdRef: string
  readonly learnerRef: string
  readonly sessionRef: string
  readonly lessonRef: string
  readonly segmentRef: string
  readonly revision: number
  readonly capturedAt: string
  readonly completedSegmentRefs: readonly string[]
  readonly elapsedActiveSecondsInSegment: number
  readonly responseDraftRef: string | null
  readonly rawAnswerIncluded: false
  readonly transcriptIncluded: false
}

export interface StudyReviewRecommendation {
  readonly recommendationRef: string
  readonly householdRef: string
  readonly learnerRef: string
  readonly sourceEvidenceRef: string
  readonly lessonRef: string
  readonly dueDate: string
  readonly reasonCodes: readonly string[]
  readonly status: 'pending-parent' | 'accepted' | 'rejected'
  readonly rawAnswerIncluded: false
  readonly transcriptIncluded: false
}

export interface StudySessionSnapshot {
  readonly scope: StudyScope
  readonly lessonRef: string
  readonly segmentRef: string
  readonly status: 'ready' | 'active' | 'paused' | 'completed' | 'stopped'
  readonly updatedAt: string
  readonly lastAcceptedEventRef: string | null
  readonly rawAnswerIncluded: false
  readonly transcriptIncluded: false
}

export interface StudySafeEvent {
  readonly eventRef: string
  readonly occurredAt: string
  readonly type:
    | 'session-launched'
    | 'tutor-directive'
    | 'checkpoint-saved'
    | 'session-completed'
    | 'safety-stop'
    | 'parent-control'
  readonly payload: Readonly<Record<string, string | number | boolean | null | readonly string[]>>
}

export interface StudyOutboxProposal {
  readonly proposalRef: string
  readonly route: 'adult-review' | 'calendar-review'
  readonly evidenceRefs: readonly string[]
  readonly status: 'proposed-not-delivered'
}

export interface StudySafetyRequest {
  readonly scope: StudyScope
  readonly requestRef: string
  readonly studentRef:
    | { readonly kind: 'academy-student-id'; readonly value: string }
    | { readonly kind: 'legacy-profile-id'; readonly value: string }
  readonly contentKind: 'learner-input' | 'tutor-output'
  readonly transientText: string
}

/**
 * Why a Study turn could not be evaluated, when the reason was never the
 * learner. A refused adult bearer, a refused Study session and a shed request
 * all fail closed exactly like a safety stop, but none of them is one: the
 * classifier never judged this child, so nothing about her may be recorded,
 * locked, or shown to her parent as an incident.
 *
 * The whole value is this closed set of codes. There is deliberately no field
 * for a message, a status, a session reference, a bearer, an identifier, or a
 * server body, so nothing a caller reads here can leak, and nothing a caller
 * writes has to be parsed out of a string.
 */
export type StudyRuntimeInterruption =
  | {
      readonly kind: 'session-authorization'
      /**
       * The two halves need different recovery: a refused bearer needs the
       * adult to sign in again, a refused session needs the learner's Study
       * session cleared and re-issued.
       */
      readonly reason: 'adult-authentication-rejected' | 'study-session-rejected'
    }
  | { readonly kind: 'rate-limit' }

export interface StudySafetyResult {
  readonly outcome: 'clear' | 'urgent' | 'uncertain' | 'invalid'
  readonly mayContinue: boolean
  readonly adultHelpState: 'not-needed' | 'proposed-not-delivered' | 'not-confirmed'
  /**
   * Set only by the trusted mounted client/port boundary, and only on a
   * fail-closed `invalid` result. A server response can never carry one: the
   * safety client validates the wire body against an exact four-key shape and
   * reduces anything else to a plain classifier failure.
   */
  readonly interruption?: StudyRuntimeInterruption
}

export interface StudyAccommodation {
  readonly accommodationRef: string
  readonly functionalDescription: string
  readonly studentMessage: string
  readonly maximumWorkMinutes?: number
  readonly breakMinutes?: number
  readonly timerHidden?: boolean
}

export interface StudyParentSettings {
  readonly maximumWorkMinutes: number
  readonly breakMinutes: number
  readonly timerHidden: boolean
  readonly accommodations: readonly StudyAccommodation[]
  readonly recommendationDecisions: readonly {
    readonly recommendationRef: string
    readonly decision: 'accepted' | 'rejected'
    readonly reasonCode: string
  }[]
  readonly interruptions: readonly {
    readonly blockRef: string
    readonly kind: 'outside' | 'technical'
    readonly at: string
  }[]
  readonly reschedules: readonly {
    readonly blockRef: string
    readonly replacementStart: string
  }[]
  readonly adultReviewRequests: readonly {
    readonly requestRef: string
    readonly audience: 'tutor' | 'teacher'
    readonly status: 'local-only-not-delivered'
    readonly reason: string
  }[]
  readonly revision: number
}

export interface StudyAdultAuthorization {
  readonly householdRef: string
  readonly actorRef: string
  readonly role: 'parent' | 'teacher'
  readonly adultAuthorized: boolean
}

export type StudyParentPublicCommand =
  | { readonly type: 'accept-recommendation'; readonly recommendationRef: string }
  | { readonly type: 'reject-recommendation'; readonly recommendationRef: string }
  | { readonly type: 'set-maximum-duration'; readonly minutes: number }
  | { readonly type: 'set-break-duration'; readonly minutes: number }
  | { readonly type: 'hide-timer'; readonly hidden: boolean }
  | { readonly type: 'add-accommodation'; readonly accommodation: StudyAccommodation }
  | {
      readonly type: 'reschedule-incomplete-work'
      readonly blockRef: string
      readonly replacementStart: string
    }
  | {
      readonly type: 'mark-interruption'
      readonly blockRef: string
      readonly kind: 'outside' | 'technical'
      readonly occurredAt: string
    }
  | {
      readonly type: 'request-adult-review'
      readonly requestRef: string
      readonly audience: 'tutor' | 'teacher'
      readonly reason: string
      readonly evidenceRefs: readonly string[]
    }

export type StudyParentCommand =
  | StudyParentPublicCommand
  | {
      readonly type: 'add-adult-private-note'
      readonly noteRef: string
      readonly category: 'instruction' | 'wellbeing' | 'coordination'
      readonly body: string
    }

export interface StudyParentControlResult {
  readonly status: 'applied' | 'duplicate-ignored' | 'authorized-and-committed'
  readonly revision: number
  readonly deliveryStatus?: 'local-only-not-delivered'
}

export interface StudyLearnerPreferences {
  readonly accessibility: StudyAccessibilitySettings
  readonly timerPreference: StudyTimerPreference
}

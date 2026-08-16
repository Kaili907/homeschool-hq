import type { HostLessonDescriptor } from '../../curriculumAdapter'
import type { StudyCalendarEntry } from '../../types'

/**
 * The whole reload-safe handle for one Family Pilot Study assignment. It is
 * minimized on purpose: opaque references only, no lesson content, no learner
 * text, no draft. A pilot client may keep this in local storage, so every
 * field in it is treated as untrusted on the way back in.
 */
export interface FamilyPilotStudySession {
  readonly householdRef: string
  readonly learnerRef: string
  readonly blockRef: string
  readonly sessionRef: string
}

/**
 * Either an existing Study calendar block, or a host lesson that is projected
 * through the existing static-curriculum adapter when no block exists yet.
 */
export type FamilyPilotAssignment =
  | { readonly kind: 'calendar-block'; readonly entry: StudyCalendarEntry }
  | { readonly kind: 'static-curriculum'; readonly lesson: HostLessonDescriptor }

export type FamilyPilotRejection =
  | 'ports-unavailable'
  | 'runtime-unsupported'
  | 'household-mismatch'
  | 'student-mismatch'
  | 'session-binding-mismatch'
  | 'unknown-assignment'
  | 'assignment-already-complete'
  | 'assignment-not-active'
  | 'assignment-not-pausable'
  | 'assignment-not-resumable'
  | 'assignment-incomplete'
  | 'no-active-segment'
  | 'response-draft-not-opaque'
  | 'session-stopped'
  | 'quarantined'
  | 'lifecycle-cancelled'
  | 'study-unavailable'

/** The exact restorable position of one assignment. Carries no learner text. */
export interface FamilyPilotStudySnapshot {
  readonly session: FamilyPilotStudySession
  readonly lessonRef: string
  readonly title: string
  readonly assignmentState: StudyCalendarEntry['state']
  readonly sessionStatus: 'ready' | 'active' | 'paused' | 'completed' | 'stopped' | null
  readonly segmentRef: string | null
  readonly segmentOrdinal: number | null
  readonly completedSegmentRefs: readonly string[]
  readonly remainingSegmentRefs: readonly string[]
  readonly elapsedActiveSecondsInSegment: number
  readonly checkpointRef: string | null
  readonly checkpointRevision: number
  /** Opaque presentation cursor restored from the existing Study checkpoint contract. */
  readonly presentationProgressRef?: string | null
  readonly lastAcceptedEventRef: string | null
  readonly masteryAuthority: StudyCalendarEntry['masteryAuthority']
  readonly tutorBridgeAvailable: boolean
  readonly requiredWorkCompletionPercent: number
  readonly rawAnswerIncluded: false
  readonly transcriptIncluded: false
}

export type FamilyPilotStudyResult =
  | { readonly status: 'ok'; readonly snapshot: FamilyPilotStudySnapshot }
  | { readonly status: 'rejected'; readonly reason: FamilyPilotRejection; readonly message: string }

export type FamilyPilotStudyActionResult =
  | {
      readonly status: 'accepted'
      readonly snapshot: FamilyPilotStudySnapshot
      readonly eventRef: string
      readonly directive: 'continue' | 'reteach'
      readonly visibleText: string
    }
  | {
      /** Completion-only work: recorded without any Tutor Core mastery decision. */
      readonly status: 'recorded'
      readonly snapshot: FamilyPilotStudySnapshot
      readonly visibleText: string
    }
  | {
      readonly status: 'stopped'
      readonly snapshot: FamilyPilotStudySnapshot
      readonly reasonCode: string
      readonly studentMessage: string
    }
  | { readonly status: 'rejected'; readonly reason: FamilyPilotRejection; readonly message: string }

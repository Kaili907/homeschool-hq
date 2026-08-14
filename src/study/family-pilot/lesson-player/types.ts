import type { FamilyPilotStudySnapshot } from '../study'
import type {
  LearnerResponseItem,
  LearnerResponseType,
  LearnerStudySegmentRole,
} from '../final-app/learner-response'

/**
 * UI status for the player, supplied by the host. It is intentionally not
 * derived from FamilyPilotStudyResult/-ActionResult here: the host already
 * has to interpret those unions to drive its own data flow, and duplicating
 * that interpretation inside a display component would be a second place a
 * status mapping could drift out of sync with the runtime.
 */
export type FamilyPilotLessonPlayerStatus = 'loading' | 'active' | 'paused' | 'completed' | 'error'

export interface FamilyPilotLessonPlayerChoice {
  readonly id: string
  readonly label: string
}

/**
 * Optional instructional content for the current segment. The Study runtime's
 * own snapshot carries only opaque references and no lesson content by design
 * (see FamilyPilotStudySnapshot), so this is assembled by the host from
 * wherever lesson content actually lives. Every field is optional: the player
 * renders sensibly with none of them present.
 */
export interface FamilyPilotLessonSegmentContent {
  /** The current segment's own display title (distinct from the lesson title on the snapshot). */
  readonly title?: string
  readonly instruction?: string
  readonly prompt?: string
  readonly example?: string
  readonly lessonRef?: string
  readonly sectionRef?: string
  readonly itemRef?: string
  /** Uppercase kinds are the production learner-response contract. Lowercase values remain for legacy callers. */
  readonly responseKind?: LearnerResponseType | 'text' | 'choice' | 'none'
  readonly choices?: readonly FamilyPilotLessonPlayerChoice[]
  readonly pendingAssessmentCount?: number
  /** Durable response refs, never response text. Used to restore one-question-at-a-time presentation. */
  readonly answeredItemRefs?: readonly string[]
  readonly requiredItemRefs?: readonly string[]
  readonly canCompleteSegment?: boolean
}

export type RichLessonSectionKind =
  | 'lesson-goal'
  | 'teaching'
  | 'vocabulary'
  | 'worked-example'
  | 'guided-practice'
  | 'independent-practice'
  | 'mastery-check'
  | 'remediation'
  | 'challenge'
  | 'reflection'
  | 'materials-safety'
  | 'source'
  | 'data'
  | 'map'
  | 'image'
  | 'reference'

export interface RichLessonDetail {
  readonly label?: string
  readonly text?: string
  readonly items?: readonly string[]
  readonly href?: string
  readonly imageSrc?: string
  readonly alt?: string
}

export interface RichLessonPage {
  readonly pageRef: string
  /** Opaque, bounded Study checkpoint value. Contains no learner text. */
  readonly progressRef: string
  readonly sectionRef: string
  readonly role: LearnerStudySegmentRole
  readonly kind: RichLessonSectionKind
  readonly title: string
  readonly body?: string
  readonly directions?: string
  readonly details: readonly RichLessonDetail[]
  readonly item: LearnerResponseItem | null
  readonly position: number
  readonly total: number
}

export interface RichLessonSubjectAdapter {
  readonly subject: string
  readonly label: string
  readonly shortLabel: string
}

export interface RichLessonRenderModel {
  readonly version: 1
  readonly mode: 'rich' | 'legacy'
  readonly lessonRef: string
  readonly title: string
  readonly subject: RichLessonSubjectAdapter
  readonly pages: readonly RichLessonPage[]
}

export interface RichLessonTutorRequest {
  readonly lessonRef: string
  readonly sectionRef: string | null
  readonly itemRef: string | null
}

export interface FamilyPilotLessonPlayerProps {
  readonly status: FamilyPilotLessonPlayerStatus
  readonly snapshot: FamilyPilotStudySnapshot | null
  readonly segmentContent?: FamilyPilotLessonSegmentContent
  /** Optional projection only. When absent, the established segment presentation is used unchanged. */
  readonly renderModel?: RichLessonRenderModel
  readonly errorMessage?: string | null
  /** Supplied by the host; not derived from the snapshot. */
  readonly tutorHelpAvailable?: boolean
  /** True while a host action triggered by a callback below is in flight. */
  readonly busy?: boolean
  /** A typed or structured learner response. Never persisted by this component. */
  readonly onSubmitAction: (responseText: string) => void
  readonly onPause: (presentationProgressRef?: string) => void
  readonly onResume: () => void
  /** Advances past a segment that needs no learner response. */
  readonly onNext: () => void
  readonly onCompleteSegment: () => void
  /** A narrow future seam. The player imports no Tutor runtime or API. */
  readonly onOpenTutor: (request?: RichLessonTutorRequest) => void
  readonly onExit: (presentationProgressRef?: string) => void
}

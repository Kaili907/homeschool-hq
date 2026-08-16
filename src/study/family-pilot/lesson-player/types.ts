import type { FamilyPilotStudySnapshot } from '../study'

export interface LearnerMaterialSection {
  readonly sectionRef?: string
  readonly sectionId?: string
  readonly kind?: string
  readonly sectionKind?: string
  readonly title: string
  readonly body?: string
  readonly directions?: string
  readonly items?: readonly unknown[]
  readonly answerKey?: unknown
}

/** Flexible learner-safe projection accepted from all ten production families. */
export interface FinalLearnerMaterial {
  readonly materialRef?: string
  readonly lessonRef: string
  readonly title: string
  readonly subject?: string
  readonly essentialQuestion?: string
  readonly lessonGoal?: string
  readonly learningObjectives?: readonly string[]
  readonly successCriteria?: readonly string[]
  readonly materials?: readonly string[]
  readonly safetyRules?: readonly string[]
  readonly sections?: readonly LearnerMaterialSection[]
}

export interface RichLessonSubjectAdapter {
  readonly subject: string
  readonly label: string
  readonly shortLabel: string
}

export type RichLessonSectionKind =
  | 'lesson-goal'
  | 'materials-safety'
  | 'teaching'
  | 'guided-practice'
  | 'independent-practice'
  | 'mastery-check'
  | 'reflection'
  | 'source'
  | 'reference'

export interface RichLessonPage {
  readonly pageRef: string
  readonly progressRef: string
  readonly sectionRef: string
  readonly kind: RichLessonSectionKind
  readonly title: string
  readonly body?: string
  readonly directions?: string
  readonly details: readonly string[]
  readonly position: number
  readonly total: number
}

export interface RichLessonRenderModel {
  readonly version: 1
  readonly mode: 'rich' | 'legacy'
  readonly lessonRef: string
  readonly title: string
  readonly subject: RichLessonSubjectAdapter
  readonly pages: readonly RichLessonPage[]
}

export interface FamilyPilotLessonPlayerChoice {
  readonly id: string
  readonly label: string
}

export type FamilyPilotLessonResponseKind =
  | 'CHOICE'
  | 'TEXT'
  | 'NUMERIC'
  | 'CONSTRUCTED_RESPONSE'
  | 'ACTIVITY_EVIDENCE'
  | 'READ'
  | 'NONE'
  | 'RUBRIC_REVIEW_PENDING'
  | 'GUARDIAN_ATTESTATION'
  | 'text'
  | 'choice'
  | 'none'

export interface FamilyPilotLessonSegmentContent {
  readonly title?: string
  readonly instruction?: string
  readonly prompt?: string
  readonly example?: string
  readonly lessonRef?: string
  readonly sectionRef?: string
  readonly itemRef?: string
  readonly responseKind?: FamilyPilotLessonResponseKind
  readonly choices?: readonly FamilyPilotLessonPlayerChoice[]
  readonly pendingAssessmentCount?: number
  readonly answeredItemRefs?: readonly string[]
  readonly requiredItemRefs?: readonly string[]
  readonly canCompleteSegment?: boolean
}

export interface FamilyPilotLessonPlayerProps {
  readonly status: 'loading' | 'ready' | 'active' | 'paused' | 'completed' | 'blocked' | 'error'
  readonly snapshot: FamilyPilotStudySnapshot | null
  readonly segmentContent?: FamilyPilotLessonSegmentContent
  readonly renderModel?: RichLessonRenderModel | null
  readonly tutorHelpAvailable?: boolean
  readonly busy?: boolean
  readonly errorMessage?: string | null
  readonly onContinue?: () => void
  readonly onSubmitAction?: (responseText: string) => void
  readonly onPause?: (presentationProgressRef?: string) => void
  readonly onResume?: () => void
  readonly onNext?: () => void
  readonly onCompleteSegment?: () => void
  readonly onOpenTutor?: (request?: {
    readonly lessonRef: string
    readonly sectionRef: string | null
    readonly itemRef: string | null
  }) => void
  readonly onExit?: (presentationProgressRef?: string) => void
}

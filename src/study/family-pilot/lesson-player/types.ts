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
  readonly [key: string]: unknown
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
  readonly [key: string]: unknown
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

export interface FamilyPilotLessonPlayerProps {
  readonly status: 'loading' | 'ready' | 'paused' | 'completed' | 'blocked'
  readonly snapshot: FamilyPilotStudySnapshot | null
  readonly renderModel: RichLessonRenderModel | null
  readonly errorMessage?: string | null
  readonly onContinue?: () => void
  readonly onPause?: () => void
  readonly onExit?: () => void
}

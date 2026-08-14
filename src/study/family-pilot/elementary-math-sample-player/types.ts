import type { LearnerResponseItem, LearnerResponseRuntime } from '../final-app/learner-response'

export type ElementaryMathStage = 'LEARN' | 'EXAMPLE' | 'GUIDED' | 'INDEPENDENT' | 'MASTERY'

export interface ElementaryMathPresentationStep {
  readonly stage: ElementaryMathStage
  readonly item: LearnerResponseItem
  readonly position: number
  readonly total: number
}

export interface ElementaryMathSavedPlace {
  readonly stepIndex: number
  readonly itemRef: string
}

export interface ElementaryMathSamplePlayerProps {
  /** The current learner-response runtime; this component creates no store. */
  readonly runtime: LearnerResponseRuntime
  /** Optional presentation-preview entry point. It is not saved as learner progress. */
  readonly initialItemRef?: string
  readonly onNeedHelp?: (itemRef: string) => void
  readonly onTakeBreak?: (place: ElementaryMathSavedPlace) => void
  readonly onSaveForLater?: (place: ElementaryMathSavedPlace) => void
  readonly onComplete?: () => void
}

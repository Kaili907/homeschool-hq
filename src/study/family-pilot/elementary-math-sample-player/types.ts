import type { LearnerMaterialDto, LearnerResponseItem, LearnerResponseRuntime } from '../final-app/learner-response'

export type ElementaryMathStage = 'LEARN' | 'EXAMPLE' | 'GUIDED' | 'INDEPENDENT' | 'MASTERY' | 'REMEDIATION' | 'CHALLENGE'

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
  /** Learner-safe material owned by the supplied runtime. */
  readonly material?: LearnerMaterialDto
  /** Child-facing title. The canonical lesson identity is unchanged. */
  readonly displayTitle?: string
  /** Optional presentation-preview entry point. It is not saved as learner progress. */
  readonly initialItemRef?: string
  readonly onNeedHelp?: (itemRef: string) => void
  readonly onTakeBreak?: (place: ElementaryMathSavedPlace) => void
  readonly onSaveForLater?: (place: ElementaryMathSavedPlace) => void
  readonly onComplete?: () => void
  readonly onExit?: () => void
}

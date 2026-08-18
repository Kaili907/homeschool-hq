/**
 * ELA Production R3 — author-facing input and built-lesson record types.
 *
 * These types carry exactly the fields the nine frozen ELA Director samples
 * carry, plus the placement identity a production lesson needs in order to sit
 * in an existing course (`unitNumber`, `dayInUnit`, `courseDay`). Placement is
 * corpus metadata that already exists in
 * `curriculum-production/student-work/english-language-arts/packages/`; it is
 * not a new learner-contract decision.
 *
 * No field here is new instructional surface. Adding one would be a contract
 * extension and must go through OPEN-QUESTIONS.md first.
 */
import type { LearnerMaterialDto, LearnerResponseType } from '../final-app/learner-response'
import type { ElaProductionGrade } from './contract'

export interface ElaProductionVocabularyEntry {
  readonly term: string
  readonly definition: string
}

export interface ElaProductionChoiceResponse {
  readonly type: 'CHOICE'
  readonly prompt: string
  readonly choices: readonly string[]
}

export interface ElaProductionConstructedResponse {
  readonly type: 'CONSTRUCTED_RESPONSE'
  readonly prompt: string
}

/** Readability record. Shape derived from `ElaDirectorReadability`. */
export interface ElaProductionReadability {
  readonly instructionLength: string
  readonly sentenceComplexity: string
  readonly vocabularyLoad: string
  readonly passageLength: string
  readonly expectedWrittenResponse: string
  readonly scaffolding: string
}

/** The seven review pages. Titles are fixed by the frozen contract. */
export interface ElaProductionReview {
  readonly learned: string
  readonly howYouDid: string
  readonly didWell: string
  readonly practice: string
  readonly reviewLesson: string
  readonly courseProgress: string
  readonly nextAction: string
}

/** Where the lesson sits in an existing ELA course. */
export interface ElaProductionPlacement {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: ElaProductionGrade
  readonly unitNumber: number
  readonly unitTitle: string
  readonly dayInUnit: number
  readonly courseDay: number
}

export interface ElaProductionLessonInput {
  readonly placement: ElaProductionPlacement
  readonly topic: string
  readonly standards: readonly string[]
  readonly textType: string
  readonly title: string
  readonly welcome: string
  readonly instruction: string
  readonly vocabulary: readonly ElaProductionVocabularyEntry[]
  readonly model: string
  readonly modelPrompt: string
  readonly passageTitle: string
  readonly passage: string
  readonly passageDirections: string
  readonly guidedDirections: string
  readonly guided: ElaProductionChoiceResponse
  readonly guidedFeedback: string
  readonly independentDirections: string
  readonly independent: ElaProductionConstructedResponse
  readonly processFeedback: string
  readonly revisionDirections: string
  readonly revision: ElaProductionConstructedResponse
  readonly rubricCriteria: readonly string[]
  readonly review: ElaProductionReview
  readonly readability: ElaProductionReadability
}

export interface ElaProductionFeedbackLink {
  readonly responseItemRef: string
  readonly feedbackSectionRef: string
}

export interface ElaProductionLesson {
  readonly lessonId: string
  readonly courseId: string
  readonly courseTitle: string
  readonly grade: ElaProductionGrade
  readonly placement: ElaProductionPlacement
  readonly topic: string
  readonly standards: readonly string[]
  readonly textType: string
  readonly passageTitle: string
  readonly passageWordCount: number
  readonly responseTypes: readonly LearnerResponseType[]
  readonly feedbackLinks: readonly ElaProductionFeedbackLink[]
  readonly readability: ElaProductionReadability
  readonly reviewPresent: true
  readonly parentReviewRequired: true
  readonly material: LearnerMaterialDto
}

export type ElaProductionFindingSeverity = 'error' | 'observation'

export interface ElaProductionFinding {
  readonly severity: ElaProductionFindingSeverity
  readonly code: string
  /** The frozen artifact and clause this finding is derived from. */
  readonly derivedFrom: string
  readonly message: string
  readonly lessonId?: string
}

export interface ElaProductionValidation {
  readonly lessonId: string
  readonly errors: readonly ElaProductionFinding[]
  readonly observations: readonly ElaProductionFinding[]
  readonly valid: boolean
}

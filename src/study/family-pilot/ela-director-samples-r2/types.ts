import type {
  LearnerMaterialDto,
  LearnerResponseType,
} from '../final-app/learner-response'

export const ELA_DIRECTOR_SAMPLE_GRADES = Object.freeze([3, 4, 5, 7, 8, 9, 10, 11, 12] as const)

export type ElaDirectorSampleGrade = typeof ELA_DIRECTOR_SAMPLE_GRADES[number]

export interface ElaDirectorReadability {
  readonly instructionLength: string
  readonly sentenceComplexity: string
  readonly vocabularyLoad: string
  readonly passageLength: string
  readonly expectedWrittenResponse: string
  readonly scaffolding: string
}
export interface ElaDirectorFeedbackLink {
  readonly responseItemRef: string
  readonly feedbackSectionRef: string
}

export interface ElaDirectorSample {
  readonly sampleId: string
  readonly grade: ElaDirectorSampleGrade
  readonly courseId: string
  readonly courseTitle: string
  readonly canonicalLessonRef: string
  readonly canonicalPackagePath: string
  readonly topic: string
  readonly standards: readonly string[]
  readonly textType: string
  readonly responseTypes: readonly LearnerResponseType[]
  readonly passageWordCount: number
  readonly readability: ElaDirectorReadability
  readonly feedbackLinks: readonly ElaDirectorFeedbackLink[]
  readonly reviewPresent: true
  readonly parentReviewRequired: true
  readonly material: LearnerMaterialDto
}

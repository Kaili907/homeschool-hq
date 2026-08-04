export type GradeLevel = 3 | 4 | 5 | 6
export type SubjectId = 'math'
export type DifficultyBand = 'prerequisite' | 'entry' | 'target' | 'extension' | 'independent'
export type InteractionMode = 'showMe' | 'talkMeThroughIt' | 'letsDoOneTogether' | 'differentExample'
export type AssessmentItemType = 'multiple-choice' | 'open-response'
export type VisualKind =
  | 'base-ten-blocks'
  | 'place-value-chart'
  | 'column-arithmetic'
  | 'array'
  | 'equal-groups'
  | 'number-line'
  | 'fraction-bar'
  | 'area-model'
  | 'step-diagram'
  | 'word-problem-organizer'
  | 'multiples-list'
  | 'expanded-form'
  | 'fact-family'
  | 'equation'
  | 'symbolic'
  | 'word-context'
  | 'mixed'

export interface GradeBand {
  minimum: GradeLevel
  maximum: GradeLevel
  primary: GradeLevel[]
  extension: GradeLevel[]
  prerequisiteSupport: GradeLevel[]
}

export interface Choice {
  id: string
  text: string
}

export interface AssessmentItem {
  id: string
  type: AssessmentItemType
  prompt: string
  choices?: Choice[]
  correctChoiceId?: string
  acceptableEvidence?: string[]
  reasoning: string
  misconceptionSignals: Record<string, string[]>
  representation: VisualKind | string
  difficultyBand: DifficultyBand | string
  answerRevealPolicy: 'after-attempt-and-reasoning'
}

export interface MisconceptionPattern {
  id: string
  label: string
  likelyEvidence: string[]
  distinguishingEvidence: string[]
  firstResponse: string
  route: string
}

export interface VisualBoardCommand {
  id: string
  kind: VisualKind
  action: string
  payload: Record<string, unknown>
  altText: string
  narrationCue: string
}

export interface AdaptiveStep {
  id: string
  prompt: string
  expectedEvidence: string
  hint: string
  visualCommandId: string
  answerRevealPolicy: 'never-on-first-turn' | 'after-worked-steps' | 'after-learner-solution'
  onePromptOnly: true
}

export interface AdaptiveMode {
  purpose: string
  example: string
  steps: AdaptiveStep[]
}

export interface AdaptiveMathSequence {
  sequenceId: string
  lessonId: string
  version: string
  order: string
  title: string
  summary: string
  gradeBand: GradeBand
  estimatedMinutes: Record<string, number>
  skillIds: string[]
  legacySkillMappings: string[]
  prerequisites: string[]
  objectives: string[]
  diagnostic: { items: AssessmentItem[]; routingRules: Record<string, string>[] }
  misconceptions: MisconceptionPattern[]
  visualExplanationPlan: { representations: string[]; boards: VisualBoardCommand[]; accessibility: string[] }
  spokenExplanation: { voice: string; segments: [string, string][] }
  modes: Record<InteractionMode, AdaptiveMode>
  guidedPractice: { items: AssessmentItem[]; scaffolding: string }
  independentMasteryCheck: { items: AssessmentItem[]; masteryRule: string; retryRule: string }
  reteachingBranches: Record<string, unknown>[]
  prerequisiteRemediationBranches: Record<string, unknown>[]
  parentTeacherReview: Record<string, unknown>
  noMediaFallback: { instructions: string[]; fullyFunctionalWithoutMedia: true }
  policy: Record<string, string>
}

export interface MathSubjectManifest {
  subjectId: SubjectId
  version: string
  title: string
  gradeBand: GradeBand
  sequenceIds: string[]
  lessons: AdaptiveMathSequence[]
}

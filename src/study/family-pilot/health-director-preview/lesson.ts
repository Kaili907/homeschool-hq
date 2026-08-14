import lessonSource from '../../../../curriculum-production/final/health-physical-education/packages/health/grade-05/ma-g5-health-u01-l01.json?raw'

export const HEALTH_DIRECTOR_LESSON_ID = 'ma-g5-health-u01-l01' as const

type EntryCheck = Readonly<{
  ref: string
  heading: string
  directions: string
  choices: readonly string[]
  support: string
  treatment: string
}>

type Explanation = Readonly<{
  ref: string
  heading: string
  paragraphs: readonly string[]
  importantDistinction: string
  decisionRule: string
}>

type Vocabulary = Readonly<{
  ref: string
  heading: string
  terms: readonly Readonly<{ term: string; meaning: string; example: string; boundary: string }>[]
}>

type VocabularyCheck = Readonly<{
  ref: string
  heading: string
  directions: string
  items: readonly Readonly<{ prompt: string; choices: readonly string[] }>[]
  selfCheck: string
}>

type ModelExample = Readonly<{
  ref: string
  heading: string
  situation: string
  possibleActions: readonly string[]
  thinkingSteps: readonly Readonly<{ label: string; text: string }>[]
  successCheck: string
}>

type GuidedReasoning = Readonly<{
  ref: string
  heading: string
  situation: string
  turnOne: readonly string[]
  cue: string
  feedbackMoves: readonly string[]
  turnTwo: string
  releaseCondition: string
}>

type EvidenceBlock = Readonly<{
  ref: string
  heading: string
  situation: string
  directions: readonly string[]
  permittedSupports: readonly string[]
  independenceBoundary: string
  successCriteria: readonly string[]
}>

type FreshCheck = Readonly<{
  ref: string
  heading: string
  situation: string
  directions: readonly string[]
  freshnessNote: string
}>

type Remediation = Readonly<{
  ref: string
  heading: string
  trigger: string
  alternateExplanation: string
  contrast: readonly string[]
  guidedCorrection: string
  freshRetry: Readonly<{ situation: string; directions: readonly string[] }>
  exitCriterion: string
}>

export type HealthDirectorLesson = Readonly<{
  lessonId: typeof HEALTH_DIRECTOR_LESSON_ID
  courseId: 'ma-g5-health'
  grade: 5
  subject: 'health'
  title: string
  unitTitle: string
  standards: readonly string[]
  primaryLessonType: 'CONCEPT_VOCABULARY'
  secondaryLessonTypes: readonly ['DECISION_REASONING']
  estimatedMinutes: string
  learningGoal: string
  completionCriteria: readonly string[]
  trustedAdultNote: string
  optionalReflection: Readonly<{ prompt: string; private: true; graded: false; optional: true }>
  reflectionPolicy: Readonly<{
    mode: 'PRIVATE_OPTIONAL'
    visibleTo: readonly ['LEARNER']
    scored: false
    contributesToCompletion: false
    contributesToMastery: false
  }>
  lessonExperience: Readonly<{
    experienceVersion: 'health-director-sample-r1'
    learnerTitle: string
    privacyNotice: string
    entryCheck: EntryCheck
    explanation: Explanation
    vocabulary: Vocabulary
    vocabularyCheck: VocabularyCheck
    modelExample: ModelExample
    guidedReasoning: GuidedReasoning
    independentEvidence: EvidenceBlock
    freshConceptCheck: FreshCheck
    remediation: Remediation
  }>
}>

function parseLesson(source: string): HealthDirectorLesson {
  const value = JSON.parse(source) as HealthDirectorLesson
  if (value.lessonId !== HEALTH_DIRECTOR_LESSON_ID) throw new Error('Health Director preview resolved the wrong lesson.')
  if (value.subject !== 'health' || value.grade !== 5) throw new Error('Health Director preview requires the Grade 5 Health sample.')
  if (value.primaryLessonType !== 'CONCEPT_VOCABULARY') throw new Error('Health Director sample lesson type changed unexpectedly.')
  if (value.lessonExperience.experienceVersion !== 'health-director-sample-r1') throw new Error('Health Director sample teaching supply is unavailable.')
  if (value.reflectionPolicy.scored || value.reflectionPolicy.contributesToCompletion || value.reflectionPolicy.contributesToMastery) {
    throw new Error('Health Director sample private-reflection boundary is invalid.')
  }
  return Object.freeze(value)
}

export const healthDirectorLesson = parseLesson(lessonSource)

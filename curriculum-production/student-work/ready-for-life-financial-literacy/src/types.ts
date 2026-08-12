export type Subject = 'ready-for-life' | 'financial-literacy'
export type SubjectFamily = 'ARTS_RFL_PE_PROJECT' | 'MATH_STRUCTURED_FINLIT'
export type CompletionAuthority = 'learner' | 'guardian'

export interface LessonRef {
  readonly lessonId: string
  readonly courseId: string
  readonly grade: 3 | 4 | 5 | 7 | 8 | 9
  readonly subject: Subject
  readonly unitNumber: number
  readonly unitTitle: string
  readonly dayInUnit: number
  readonly phase: string
  readonly title: string
}

export interface SignOff {
  readonly requiresGuardianPermissionBeforeStart: true
  readonly requiresTrustedAdultSupervision: boolean
  readonly certifyingActor: 'household-authorized guardian'
  readonly studentSelfReport: 'recorded-but-not-certifying'
  readonly evidenceTypes: readonly string[]
  readonly identifiablePhotoRequired: false
}

export interface SimulationAlternative {
  readonly present: true
  readonly description: string
}

export type PromptType = 'fixed-numeric' | 'fixed-choice' | 'short-response' | 'extended-response' | 'checklist-item'

export interface TaskPrompt {
  readonly ref: string
  readonly promptType: PromptType
  readonly text: string
  readonly choices?: readonly string[]
  readonly unit?: string
}

export interface Task {
  readonly taskId: string
  readonly kind: 'warm-up' | 'guided' | 'independent' | 'performance-task' | 'reflection'
  readonly directions: string
  readonly prompts: readonly TaskPrompt[]
}

export interface FinancialSafety {
  readonly neverRequestsRealCredentials: true
  readonly noIndividualizedAdvice: true
}

export interface TaskSheetPackage {
  readonly schemaVersion: '1.0'
  readonly packageId: string
  readonly lessonRef: LessonRef
  readonly subjectFamily: SubjectFamily
  readonly standardsRefs?: readonly string[]
  readonly objective: string
  readonly scenario: string
  readonly isFictionalSimulation: boolean
  readonly completionAuthority: CompletionAuthority
  readonly realWorldAction: boolean
  readonly signOff: SignOff | null
  readonly safetyNotes: readonly string[]
  readonly simulationAlternative: SimulationAlternative | null
  readonly materials: readonly string[]
  readonly tasks: readonly Task[]
  readonly remediation: string
  readonly extension: string
  readonly scoringRef: string
  readonly financialSafety?: FinancialSafety
  readonly integrity: {
    readonly sourceCorpusVersion: string
    readonly sourceLessonId: string
    readonly authoredBy: 'manual'
  }
}

export type ScoringAuthorityKind = 'ANSWER_KEY' | 'RUBRIC' | 'SCORING_JUDGMENT'

export interface AnswerKeyItem {
  readonly ref: string
  readonly answer: string
  readonly verification: {
    readonly method: 'recomputed' | 'asserted-fixed-value'
    readonly reasoning: string
  }
}

export interface RubricLevel {
  readonly label: string
  readonly descriptor: string
}

export interface RubricCriterion {
  readonly dimension: string
  readonly levels: readonly RubricLevel[]
}

export interface ScoringRecord {
  readonly schemaVersion: '1.0'
  readonly packageId: string
  readonly lessonId: string
  readonly scoringAuthority:
    | { readonly kind: 'ANSWER_KEY'; readonly items: readonly AnswerKeyItem[] }
    | { readonly kind: 'RUBRIC' | 'SCORING_JUDGMENT'; readonly criteria: readonly RubricCriterion[]; readonly lookFors?: readonly string[] }
  readonly completionAuthority: CompletionAuthority
  readonly nonDiagnosticGuard: 'Do not infer effort, motivation, diagnosis, or character from an error.'
}

export interface CorpusEntry {
  readonly pkg: TaskSheetPackage
  readonly scoring: ScoringRecord
  readonly packagePath: string
  readonly scoringPath: string
}

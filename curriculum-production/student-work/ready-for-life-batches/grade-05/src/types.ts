export type SubjectFamily = 'ARTS_RFL_PE_PROJECT'
export type CompletionAuthority = 'learner' | 'guardian'
export type CorpusStage = 'released'

export interface LessonRef {
  readonly lessonId: string
  readonly courseId: 'ma-g5-ready-for-life'
  readonly grade: 5
  readonly subject: 'ready-for-life'
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

export type PromptType = 'short-response' | 'extended-response' | 'checklist-item' | 'fixed-choice'

export interface TaskPrompt {
  readonly ref: string
  readonly promptType: PromptType
  readonly text: string
  readonly choices?: readonly string[]
}

export interface Task {
  readonly taskId: string
  readonly kind: 'warm-up' | 'guided' | 'independent' | 'performance-task' | 'reflection'
  readonly directions: string
  readonly prompts: readonly TaskPrompt[]
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
  readonly integrity: {
    readonly sourceStage: CorpusStage
    readonly sourceCorpusRef: string
    readonly sourceLessonId: string
    readonly authoredBy: 'manual'
  }
}

export type ScoringAuthorityKind = 'RUBRIC' | 'SCORING_JUDGMENT'

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
  readonly scoringAuthority: {
    readonly kind: ScoringAuthorityKind
    readonly criteria: readonly RubricCriterion[]
    readonly lookFors?: readonly string[]
  }
  readonly completionAuthority: CompletionAuthority
  readonly nonDiagnosticGuard: 'Do not infer effort, motivation, diagnosis, or character from an error.'
}

export interface CorpusEntry {
  readonly pkg: TaskSheetPackage
  readonly scoring: ScoringRecord
  readonly packagePath: string
  readonly scoringPath: string
}

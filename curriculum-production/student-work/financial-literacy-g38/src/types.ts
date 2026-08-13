/**
 * Types for the Financial Literacy grades 3,4,5,7,8 student-work corpus.
 *
 * Two layers live here:
 *   1. AUTHORED layer — what a human writes per lesson (`AuthoredLesson`).
 *      Every fixed-answer prompt carries BOTH a hand-authored `expected`
 *      literal and a machine-evaluable `compute` spec. They are written
 *      independently; the build fails closed when they disagree.
 *   2. EMITTED layer — the student-facing `TaskSheetPackage` and the
 *      adult-only `ScoringRecord` written to disk by `build.ts`.
 *
 * Nothing here derives an answer from the source corpus's
 * `answer_or_scoring_guidance`, which contains no calculations at all.
 */

export type Grade = 3 | 4 | 5 | 7 | 8
export type SubjectFamily = 'MATH_STRUCTURED_FINLIT'
export type CompletionAuthority = 'learner'
export type PromptType = 'fixed-numeric' | 'fixed-choice' | 'short-response' | 'extended-response'
export type TaskKind = 'warm-up' | 'guided' | 'independent' | 'performance-task' | 'reflection'

/** How a lesson's scoring authority is constituted. */
export type AuthorityClass = 'FIXED' | 'JUDGMENT'

// ---------------------------------------------------------------------------
// Computation algebra — all money is integer cents, never floating point.
// ---------------------------------------------------------------------------

export type ComputeSpec =
  /** A stated figure from the scenario, in cents. */
  | { readonly op: 'money'; readonly cents: number }
  /** A stated count from the scenario (items, weeks, people). */
  | { readonly op: 'count'; readonly n: number }
  | { readonly op: 'sum'; readonly of: readonly ComputeSpec[] }
  | { readonly op: 'diff'; readonly from: ComputeSpec; readonly less: ComputeSpec }
  /** Repeated addition / multiplication by a whole number. */
  | { readonly op: 'scale'; readonly of: ComputeSpec; readonly times: number }
  /** Percentage in basis points (750 = 7.5%). */
  | { readonly op: 'percent'; readonly of: ComputeSpec; readonly bps: number; readonly round: Rounding }
  /** Division by a whole number (unit price, per-person share, how many weeks). */
  | { readonly op: 'divide'; readonly of: ComputeSpec; readonly by: number; readonly round: Rounding }
  /** Whole periods of compounding at a fixed rate, rounded to the cent each period. */
  | { readonly op: 'compound'; readonly principal: ComputeSpec; readonly bps: number; readonly periods: number }
  | { readonly op: 'min'; readonly of: readonly ComputeSpec[] }
  | { readonly op: 'max'; readonly of: readonly ComputeSpec[] }
  /** Ceiling division: how many whole periods to reach a target. */
  | { readonly op: 'periodsToReach'; readonly target: ComputeSpec; readonly perPeriod: ComputeSpec }
  /** Chooses one of three authored labels by comparing two values. */
  | {
      readonly op: 'select'
      readonly left: ComputeSpec
      readonly right: ComputeSpec
      readonly whenLess: string
      readonly whenEqual: string
      readonly whenGreater: string
    }

/** 'exact' fails closed when the operation does not divide evenly. */
export type Rounding = 'exact' | 'half-up'

export type ComputedValue =
  | { readonly kind: 'money'; readonly cents: number }
  | { readonly kind: 'count'; readonly n: number }
  | { readonly kind: 'label'; readonly label: string }

export interface OracleResult {
  readonly value: ComputedValue
  /** Formatted answer, e.g. "$4.50", "6", "Runs short". */
  readonly formatted: string
  /** Human-readable arithmetic, e.g. "2.00 + 1.50 + 1.00 = 4.50". */
  readonly trace: string
}

// ---------------------------------------------------------------------------
// Authored layer
// ---------------------------------------------------------------------------

export interface FixedAnswerAuthority {
  /** Hand-authored answer literal, written independently of `compute`. */
  readonly expected: string
  readonly compute: ComputeSpec
  /** Optional adult-facing note where the arithmetic alone under-explains. */
  readonly note?: string
}

export interface AuthoredPrompt {
  readonly ref: string
  readonly promptType: PromptType
  readonly text: string
  readonly unit?: string
  readonly choices?: readonly string[]
  /** Present exactly when promptType is fixed-numeric or fixed-choice. */
  readonly fixed?: FixedAnswerAuthority
}

export interface AuthoredTask {
  readonly taskId: string
  readonly kind: TaskKind
  readonly directions: string
  readonly prompts: readonly AuthoredPrompt[]
}

export interface RubricLevel {
  readonly label: 'Not yet' | 'Approaching' | 'Meets'
  readonly descriptor: string
}

export interface RubricCriterion {
  readonly dimension: string
  readonly levels: readonly RubricLevel[]
}

export interface AuthoredLesson {
  /** e.g. "g5-u03-l05" — joins to exactly one source lesson. */
  readonly key: string
  readonly authority: AuthorityClass
  /** Fictional character(s) named in the scenario; used by distinctness checks. */
  readonly character: string
  readonly objective: string
  readonly scenario: string
  readonly materials?: readonly string[]
  readonly tasks: readonly AuthoredTask[]
  readonly remediation: string
  readonly extension: string
  /** Required for JUDGMENT lessons and for any FIXED lesson with open prompts. */
  readonly rubric?: readonly RubricCriterion[]
  readonly lookFors?: readonly string[]
  /** Authored safety notes beyond the corpus-wide fictional-simulation guard. */
  readonly safetyNotes?: readonly string[]
}

// ---------------------------------------------------------------------------
// Source inventory
// ---------------------------------------------------------------------------

export interface SourceLesson {
  readonly key: string
  readonly lessonId: string
  readonly courseId: string
  readonly grade: Grade
  readonly unitNumber: number
  readonly unitTitle: string
  readonly dayInUnit: number
  readonly phase: string
  readonly title: string
  readonly focus: string
  readonly standards: readonly string[]
  readonly sourceRef: string
  readonly sourcePath: string
}

// ---------------------------------------------------------------------------
// Emitted layer
// ---------------------------------------------------------------------------

export interface TaskSheetPackage {
  readonly schemaVersion: '2.0'
  readonly packageId: string
  readonly lessonRef: {
    readonly lessonId: string
    readonly courseId: string
    readonly grade: Grade
    readonly subject: 'financial-literacy'
    readonly unitNumber: number
    readonly unitTitle: string
    readonly dayInUnit: number
    readonly phase: string
    readonly title: string
    readonly focus: string
  }
  readonly subjectFamily: SubjectFamily
  readonly standardsRefs: readonly string[]
  readonly objective: string
  readonly scenario: string
  readonly isFictionalSimulation: true
  readonly completionAuthority: CompletionAuthority
  readonly realWorldAction: false
  readonly signOff: null
  readonly safetyNotes: readonly string[]
  readonly materials: readonly string[]
  readonly tasks: readonly {
    readonly taskId: string
    readonly kind: TaskKind
    readonly directions: string
    readonly prompts: readonly {
      readonly ref: string
      readonly promptType: PromptType
      readonly text: string
      readonly unit?: string
      readonly choices?: readonly string[]
    }[]
  }[]
  readonly remediation: string
  readonly extension: string
  readonly scoringRef: string
  readonly financialSafety: {
    readonly neverRequestsRealCredentials: true
    readonly noIndividualizedAdvice: true
  }
  readonly integrity: {
    readonly sourceCorpusVersion: '1.0.0'
    readonly sourceRef: string
    readonly sourcePath: string
    readonly sourceLessonId: string
    readonly authoredBy: 'manual'
    readonly answerDerivedFromSourceGuidance: false
  }
}

export interface AnswerKeyItem {
  readonly ref: string
  readonly promptText: string
  readonly answer: string
  readonly verification: {
    readonly method: 'independent-recompute'
    readonly reasoning: string
    /** The committed spec, so any second implementation can re-verify. */
    readonly computation: ComputeSpec
    readonly trace: string
  }
}

/** Machine-readable claim a hardened (Gate H2) readiness check can consume. */
export interface AuthorityTag {
  readonly gate: 'H2'
  readonly authorityClass: 'FIXED_ANSWER_KEY' | 'RUBRIC_JUDGMENT'
  readonly answerTextPresent: boolean
  readonly fixedItemCount: number
  readonly rubricCriterionCount: number
  readonly answerDerivation: 'independent-recompute' | 'not-applicable-judgment'
  readonly derivedFromSourceGenericGuidance: false
  readonly oracleId: string
  readonly oracleVerdict: 'AGREES'
}

export interface ScoringRecord {
  readonly schemaVersion: '2.0'
  readonly packageId: string
  readonly lessonId: string
  readonly adultOnly: true
  readonly scoringAuthority:
    | {
        readonly kind: 'ANSWER_KEY'
        readonly items: readonly AnswerKeyItem[]
        readonly criteria?: readonly RubricCriterion[]
        readonly lookFors?: readonly string[]
      }
    | {
        readonly kind: 'RUBRIC'
        readonly criteria: readonly RubricCriterion[]
        readonly acceptableAnswerCriteria: readonly string[]
        readonly lookFors?: readonly string[]
      }
  readonly authorityTag: AuthorityTag
  readonly completionAuthority: CompletionAuthority
  readonly nonDiagnosticGuard: 'Do not infer effort, motivation, diagnosis, or character from an error.'
}

export interface CorpusEntry {
  readonly source: SourceLesson
  readonly authored: AuthoredLesson
  readonly pkg: TaskSheetPackage
  readonly scoring: ScoringRecord
  readonly packagePath: string
  readonly scoringPath: string
}

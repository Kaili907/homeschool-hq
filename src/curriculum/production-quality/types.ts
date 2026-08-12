/**
 * Generic, curriculum-branch-agnostic input contracts for the production
 * readiness gate. Callers project their own lesson/course records into these
 * shapes — this module has no dependency on any specific curriculum source,
 * so it keeps working as curriculum branches move, merge, or get renamed.
 */

export type SubjectFamily =
  | 'MATH_STRUCTURED_FINLIT'
  | 'ELA_SOCIAL_STUDIES'
  | 'SCIENCE'
  | 'ARTS_RFL_PE_PROJECT'

export interface LessonContentBlock {
  /** Whether this component exists at all in the lesson record. */
  readonly present: boolean
  /**
   * Raw student/teacher-facing text for the component, when available.
   * Optional — callers that only track presence, not text, can omit it;
   * the specificity heuristic simply won't run for that component.
   */
  readonly text?: string
}

export type ScoringAuthorityKind = 'ANSWER_KEY' | 'RUBRIC' | 'SCORING_JUDGMENT'

export interface ScoringAuthority {
  readonly kind: ScoringAuthorityKind
  readonly content: LessonContentBlock
  /** ELA/Social Studies: what counts as an acceptable answer, alongside a rubric. */
  readonly acceptableAnswerCriteria?: LessonContentBlock
}

export type AlignmentStatus = 'ALIGNED' | 'NOT_ALIGNED' | 'UNKNOWN'
export type IntegrityStatus = 'VERIFIED' | 'GAP' | 'UNKNOWN' | 'NOT_APPLICABLE'

export interface LessonProductionInput {
  readonly lessonId: string
  readonly title: string
  readonly courseId?: string
  readonly unitId?: string
  readonly subjectFamily: SubjectFamily

  /**
   * Instruction / source text the lesson opens with. Structured MATH/FinLit
   * lessons are expected to fold worked-example content in via
   * `workedExample` — ARTS/RFL/PE/PROJECT lessons are not required to have
   * this at all, since the activity itself carries the instructional load.
   */
  readonly instruction?: LessonContentBlock
  readonly workedExample?: LessonContentBlock

  /**
   * Scaffolded practice step. Only structured MATH/FinLit lessons are
   * required to have this — other subject families are not penalized for
   * lacking it.
   */
  readonly guidedPractice?: LessonContentBlock

  /**
   * The independent/summative work: independent + mastery questions (math),
   * student task + independent response (ELA/Social Studies),
   * investigation/data task + student evidence (science), student
   * activity/performance task + completion requirements (arts/RFL/PE).
   */
  readonly independentWork?: LessonContentBlock

  readonly scoringAuthority?: ScoringAuthority | null

  readonly remediation?: LessonContentBlock
  readonly extension?: LessonContentBlock

  /**
   * Set when the lesson's assessment can be checked against a stated
   * objective/standard. Leave undefined/'UNKNOWN' rather than guessing —
   * this is not something the gate can verify on its own.
   */
  readonly assessmentAlignment?: AlignmentStatus

  /**
   * Set true for lessons that draw on an external source/text/dataset whose
   * provenance needs to be intact (ELA passages, Social Studies primary
   * sources, science reference data).
   */
  readonly requiresSourceIntegrity?: boolean
  readonly sourceIntegrityStatus?: IntegrityStatus

  /**
   * Set true for lessons with a physical, personal-disclosure, or otherwise
   * sensitive component (science labs, PE, arts performance, RFL discussion
   * topics).
   */
  readonly requiresSafetyOrPrivacyReview?: boolean
  readonly safetyOrPrivacyStatus?: IntegrityStatus
  readonly safeAlternative?: LessonContentBlock
}

export interface CourseProductionInput {
  readonly courseId: string
  readonly title: string
  readonly lessons: readonly LessonProductionInput[]
}

export const READINESS_CODES = [
  'READY',
  'MISSING_INSTRUCTION',
  'MISSING_STUDENT_WORK',
  'MISSING_GUIDED_PRACTICE',
  'MISSING_INDEPENDENT_WORK',
  'MISSING_SCORING_AUTHORITY',
  'MISSING_ANSWER_KEY',
  'MISSING_RUBRIC',
  'MISSING_REMEDIATION',
  'MISSING_EXTENSION',
  'ASSESSMENT_NOT_ALIGNED',
  'SOURCE_INTEGRITY_GAP',
  'SAFETY_OR_PRIVACY_GAP',
  'NEEDS_HUMAN_REVIEW',
] as const

export type ReadinessCode = (typeof READINESS_CODES)[number]

export type LessonReadinessStatus = 'READY' | 'NEEDS_HUMAN_REVIEW' | 'NOT_READY'

export interface LessonReadinessResult {
  readonly lessonId: string
  readonly status: LessonReadinessStatus
  /** Every gap/flag code that applies. `['READY']` when fully clean. */
  readonly codes: readonly ReadinessCode[]
  /** Human-readable detail behind each code, for report output. */
  readonly notes: readonly string[]
}

export interface ProductionGapSummary {
  readonly totalLessons: number
  readonly readyCount: number
  readonly needsHumanReviewCount: number
  readonly notReadyCount: number
  readonly codeCounts: Readonly<Record<ReadinessCode, number>>
  readonly lessonsByCode: Readonly<Partial<Record<ReadinessCode, readonly string[]>>>
}

export interface CourseReadinessResult {
  readonly courseId: string
  readonly status: LessonReadinessStatus
  readonly lessonResults: readonly LessonReadinessResult[]
  readonly gapSummary: ProductionGapSummary
  readonly notes: readonly string[]
}

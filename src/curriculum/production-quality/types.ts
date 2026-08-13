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

/**
 * `MATH_STRUCTURED_FINLIT` covers two disciplines with different scoring
 * needs. This names which one, and only Financial Literacy changes behaviour.
 */
export type StructuredDiscipline = 'MATH' | 'FINANCIAL_LITERACY'

export interface LessonContentBlock {
  /** Whether this component exists at all in the lesson record. */
  readonly present: boolean
  /**
   * Raw student/teacher-facing text for the component, when available.
   * Optional — callers that only track presence, not text, can omit it;
   * the specificity heuristic simply won't run for that component.
   *
   * The one exception is `ScoringAuthority.content` for an `ANSWER_KEY`,
   * which must carry text: an answer key the gate cannot read is one it
   * cannot call authoritative.
   */
  readonly text?: string
}

export type ScoringAuthorityKind = 'ANSWER_KEY' | 'RUBRIC' | 'SCORING_JUDGMENT'

/**
 * How an answer key's correctness was established. The gate cannot prove an
 * answer true on its own, so it requires the caller to record *how* the key
 * was checked, and treats an absent or `UNVERIFIED` method as unproven rather
 * than as either correct or incorrect.
 */
export type ScoringAuthorityVerificationMethod =
  /** Recomputed/derived independently of the authored key (solver, checker, second generation pass). */
  | 'INDEPENDENT_ORACLE'
  /** Checked against the authoritative source, dataset, or standard the item is drawn from. */
  | 'SOURCE_AUTHORITY'
  /** A qualified human worked the items and confirmed the key. */
  | 'HUMAN_VERIFIED'
  /** Some other defensible verified method; `evidence` must say what it was. */
  | 'OTHER_VERIFIED_METHOD'
  /** Explicitly recorded as not yet verified. */
  | 'UNVERIFIED'

export interface ScoringAuthorityVerification {
  readonly method: ScoringAuthorityVerificationMethod
  /**
   * What was actually done, against what, and by whom — substantive enough for
   * a reviewer to tell the recorded method apart from a bare claim. A declared
   * method with no evidence is treated as unverified.
   */
  readonly evidence?: string
}

export interface ScoringAuthority {
  readonly kind: ScoringAuthorityKind
  readonly content: LessonContentBlock
  /** ELA/Social Studies: what counts as an acceptable answer, alongside a rubric. */
  readonly acceptableAnswerCriteria?: LessonContentBlock
  /**
   * Rubric criteria governing the open-response portion of a lesson whose
   * primary authority is a fixed key. A `MIXED` lesson needs both, and the
   * fixed key cannot stand in for the judgment half — that substitution is
   * exactly what leaves open work unscored.
   */
  readonly rubric?: LessonContentBlock
  /**
   * Required for `ANSWER_KEY` to reach READY. Not consulted for RUBRIC or
   * SCORING_JUDGMENT, where the criteria themselves are the authority.
   */
  readonly verification?: ScoringAuthorityVerification
}

/**
 * How a lesson's student work is scored, declared by the author rather than
 * inferred. The gate will not read this off `scoringAuthority.kind` or off
 * whether a rubric happens to be attached: both are things an author can set
 * to whatever makes the gate quiet, and neither says what the student is
 * actually being asked to produce.
 */
export type ResponseScoringMode =
  /** Every item has one settleable correct answer — arithmetic, a total, a fixed choice. */
  | 'FIXED_OR_COMPUTATIONAL'
  /** Every item is a judgment, justification, or application with no single correct answer. */
  | 'JUDGMENT_APPLICATION'
  /** Both kinds of item in one lesson; both authorities are then required. */
  | 'MIXED'

export type ItemResponseMode = 'FIXED' | 'OPEN'

/**
 * One student-facing item, tagged with the kind of response it demands. The
 * inventory is what stops a declared mode from being a bare assertion: a
 * lesson that calls itself judgment while its items are fixed contradicts
 * itself, and the gate can see that without judging any answer's truth.
 */
export interface LessonResponseItem {
  /** Author's item reference, used to say which item contradicts the mode. */
  readonly ref: string
  readonly responseMode: ItemResponseMode
  /**
   * The student-facing prompt. Optional, but the contradiction check between
   * a declared-open item and a prompt that plainly demands a computation can
   * only run when it is supplied.
   */
  readonly promptText?: string
}

export interface ResponseScoringContract {
  readonly mode: ResponseScoringMode
  readonly items: readonly LessonResponseItem[]
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

  /**
   * Which discipline inside `MATH_STRUCTURED_FINLIT` this lesson belongs to.
   * Financial Literacy legitimately mixes fixed computation with genuine
   * judgment work, so it carries `responseScoring` and is failed closed
   * without it. A lesson that does not say is treated as math and keeps the
   * fixed-answer-key requirement exactly as it was.
   */
  readonly structuredDiscipline?: StructuredDiscipline

  /**
   * The explicit scoring contract. Required for Financial Literacy; any other
   * structured lesson may opt in, and every other subject family ignores it.
   */
  readonly responseScoring?: ResponseScoringContract

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
  'ANSWER_KEY_NOT_SUBSTANTIVE',
  'ANSWER_KEY_CONTENT_UNCERTAIN',
  'ANSWER_KEY_UNVERIFIED',
  'MISSING_RUBRIC',
  'RUBRIC_NOT_SUBSTANTIVE',
  'RUBRIC_CONTENT_UNCERTAIN',
  'MISSING_RESPONSE_SCORING_MODE',
  'CONTRADICTORY_RESPONSE_SCORING',
  'MISSING_REMEDIATION',
  'MISSING_EXTENSION',
  'ASSESSMENT_NOT_ALIGNED',
  'SOURCE_INTEGRITY_GAP',
  'SAFETY_OR_PRIVACY_GAP',
  'CREDENTIAL_REQUEST',
  'CREDENTIAL_REQUEST_QUOTED',
  'NEEDS_HUMAN_REVIEW',
] as const

export type ReadinessCode = (typeof READINESS_CODES)[number]

export type LessonReadinessStatus = 'READY' | 'NEEDS_HUMAN_REVIEW' | 'NOT_READY'

export interface LessonReadinessResult {
  readonly lessonId: string
  readonly status: LessonReadinessStatus
  /**
   * Every gap/flag code that applies. `['READY']` when fully clean. When any
   * blocking gap applies the list is the blocking gaps alone; when only
   * review-level signals apply it is those signals plus `NEEDS_HUMAN_REVIEW`.
   */
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

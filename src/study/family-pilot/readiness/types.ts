/**
 * Full Family Readiness Gate — types.
 *
 * This module is intentionally self-contained: it depends on no other
 * family-pilot subtree and no App/Study/Tutor/catalog runtime. Every
 * capability it needs is expressed as a small "port" interface here and
 * supplied by the caller. Later convergence work plugs real modules in by
 * implementing these ports — nothing in this file should change when that
 * happens.
 */

export type StudentRef = string
export type SubjectId = string

/** A grade level as configured, e.g. 3, 9, 12. Never normalized by this module. */
export type GradeLevel = number

/**
 * One configured student. `nominalGrade` is the student's overall grade
 * placement; it is NOT what readiness is evaluated against. Each enabled
 * subject is evaluated against its own entry in `workingGradeBySubject`,
 * because a student's working grade can differ per subject (e.g. a Grade 8
 * student working Grade 7 math and Grade 8 ELA).
 */
export interface StudentConfiguration {
  readonly studentRef: StudentRef
  /** Display label only. Two students may share this; studentRef is the identity. */
  readonly displayName: string
  readonly nominalGrade: GradeLevel
  readonly enabledSubjects: readonly SubjectId[]
  /** Working grade per subject. Subjects absent from `enabledSubjects` are ignored even if present here. */
  readonly workingGradeBySubject: Readonly<Record<SubjectId, GradeLevel>>
}

/** Curriculum catalog. `isAvailable` is service-level; `hasCourse` is content-level. */
export interface CatalogCapabilityPort {
  readonly isAvailable: () => boolean
  readonly hasCourse: (subject: SubjectId, grade: GradeLevel) => boolean
}

/** Whether a Study session can actually be run for this subject/grade. */
export interface StudyCapabilityPort {
  readonly isAvailable: (subject: SubjectId, grade: GradeLevel) => boolean
}

/** Whether an assignment/schedule path exists for this subject/grade. */
export interface AssignmentCapabilityPort {
  readonly isAvailable: (subject: SubjectId, grade: GradeLevel) => boolean
}

/** Whether durable save/resume exists for this student's work in this subject. */
export interface PersistenceCapabilityPort {
  readonly isAvailable: (studentRef: StudentRef, subject: SubjectId) => boolean
}

/** Whether a safe completion path (moderation, guardrails, etc.) exists. */
export interface SafetyCapabilityPort {
  readonly isAvailable: (studentRef: StudentRef, subject: SubjectId, grade: GradeLevel) => boolean
}

/**
 * Tutor/help. Never blocking on its own — a working static help path is
 * enough — but both signals are reported so gaps stay visible.
 */
export interface TutorCapabilityPort {
  readonly isTutorAvailable: (subject: SubjectId, grade: GradeLevel) => boolean
  readonly isStaticHelpAvailable: (subject: SubjectId, grade: GradeLevel) => boolean
}

export interface ReadinessCapabilityPorts {
  readonly catalog: CatalogCapabilityPort
  readonly study: StudyCapabilityPort
  readonly assignment: AssignmentCapabilityPort
  readonly persistence: PersistenceCapabilityPort
  readonly safety: SafetyCapabilityPort
  readonly tutor: TutorCapabilityPort
}

/**
 * Closed vocabulary of blocking outcomes, in the precedence order
 * evaluateSubjectReadiness checks them. A subject's status is the first of
 * these that applies; earlier checks short-circuit later ones because a
 * downstream capability can't meaningfully be evaluated once an upstream one
 * has already failed (e.g. there is no "Study availability" to report once
 * the requested grade has no course at all).
 */
export type BlockingReadinessCode =
  | 'INVALID_CONFIGURATION'
  | 'CATALOG_UNAVAILABLE'
  | 'CONTENT_GAP'
  | 'STUDY_UNAVAILABLE'
  | 'ASSIGNMENT_UNAVAILABLE'
  | 'PERSISTENCE_UNAVAILABLE'
  | 'SAFETY_UNAVAILABLE'

export type SubjectReadinessStatus = 'READY' | BlockingReadinessCode

/**
 * Non-blocking observations about the tutor/help path. These never affect
 * `status` — they ride alongside a READY (or blocked) result so tutor gaps
 * stay visible to parent reporting without gating the subject.
 */
export type NonBlockingReadinessNote =
  | 'TUTOR_UNAVAILABLE_BUT_NONBLOCKING'
  | 'STATIC_HELP_AVAILABLE'
  | 'TUTOR_AND_STATIC_HELP_UNAVAILABLE'

export interface SubjectReadinessResult {
  readonly studentRef: StudentRef
  readonly subject: SubjectId
  /** undefined when the subject is enabled but no working grade was configured for it. */
  readonly requestedWorkingGrade: GradeLevel | undefined
  readonly status: SubjectReadinessStatus
  readonly blocking: boolean
  readonly notes: readonly NonBlockingReadinessNote[]
  /** Human-readable detail identifying exactly what is missing and for whom. */
  readonly detail: string
}

export interface StudentReadinessResult {
  readonly studentRef: StudentRef
  readonly displayName: string
  /** One entry per enabled subject; disabled subjects are not evaluated at all. */
  readonly subjects: readonly SubjectReadinessResult[]
  readonly ready: boolean
  readonly blockingSubjects: readonly SubjectReadinessResult[]
}

export type FullFamilyReadinessStatus = 'FULL_FAMILY_READY' | 'BLOCKED'

export interface FullFamilyReadinessResult {
  readonly status: FullFamilyReadinessStatus
  readonly students: readonly StudentReadinessResult[]
}

export interface FullFamilyGap {
  readonly studentRef: StudentRef
  readonly displayName: string
  readonly subject: SubjectId
  readonly requestedWorkingGrade: GradeLevel | undefined
  readonly status: BlockingReadinessCode
  readonly detail: string
}

export interface FullFamilyGapSummary {
  readonly totalGaps: number
  readonly gaps: readonly FullFamilyGap[]
  readonly gapsByCode: Readonly<Record<BlockingReadinessCode, readonly FullFamilyGap[]>>
  readonly gapsByStudent: Readonly<Record<StudentRef, readonly FullFamilyGap[]>>
}

import type { CurriculumAuthoringSet } from '../../curriculum-authoring/v2/contracts.ts'
import type { AuthoringIssue } from '../../curriculum-authoring/v2/validation.ts'

/**
 * CURRICULUM-RELEASE-ADMISSION — the contract a curriculum release candidate is
 * admitted against.
 *
 * Admission is the seam between AUTHORING (a draft set that satisfies the
 * 2.0.0 schema set) and RELEASE (a version the app is allowed to ship). The
 * schema set already answers "is this well-formed content?" — see
 * src/curriculum-authoring/v2/validation.ts, which this module composes rather
 * than re-implements. Admission answers the questions authoring cannot:
 * does the candidate cover the grades it claims, is its standards provenance
 * held by someone, did its safety/privacy gate actually pass, and is its
 * graduation claim true?
 *
 * Everything here is expressed against fixtures and interfaces. Nothing in this
 * module reads a specific in-flight curriculum package, so it is stable while
 * grade and high-school normalization work is still moving.
 */

/**
 * The grades Manuel Academy publishes. Grade 6 is deliberately absent: the
 * Academy has never published it, and coverage math must not invent it. A
 * candidate carrying grade 6 content is rejected as an unsupported grade
 * rather than silently treated as a hole in the sequence.
 */
export const CANONICAL_GRADES = [3, 4, 5, 7, 8, 9, 10, 11, 12] as const
export type CanonicalGrade = (typeof CANONICAL_GRADES)[number]

/**
 * The subjects a release may publish. Mirrors ACADEMY_SUBJECTS in src/types.ts
 * and the 2.0.0 schema set's subject enum; admission.test.ts pins all three
 * together so the lists cannot drift apart unnoticed.
 */
export const SUPPORTED_SUBJECTS = [
  'mathematics',
  'english-language-arts',
  'science',
  'social-studies',
  'health',
  'physical-education',
  'ready-for-life',
  'technology',
  'arts-and-music',
  'financial-literacy',
] as const
export type SupportedSubject = (typeof SUPPORTED_SUBJECTS)[number]

/** The schema set this admission machinery understands. */
export const ADMISSION_SCHEMA_SET_VERSION = '2.0.0' as const

/** Result envelope version, so consumers can key off a stable shape. */
export const ADMISSION_REPORT_VERSION = 1 as const

/**
 * Who holds the provenance for a standards framework the candidate cites.
 * The framework's own authority_status stays the single source of truth for
 * whether the mapping is verified; custody adds the accountable party and the
 * durable evidence locator that authoring does not carry.
 */
export interface StandardsCustodyRecord {
  readonly framework_ref: string
  readonly custodian: string
  readonly attested_framework_version: string
  readonly evidence_locator: string
}

/** The candidate's own record of its safety/privacy review. */
export interface SafetyPrivacyGateAttestation {
  readonly gate_id: string
  readonly status: 'passed' | 'failed' | 'not-run'
  /** The release version actually reviewed — a gate for an older cut is stale. */
  readonly reviewed_release_version: string
  readonly evidence_locator: string
}

/**
 * A release candidate: an authoring set plus the release-level claims that
 * authoring has no way to express.
 */
export interface ReleaseCandidate {
  readonly candidate_id: string
  /** Semver of the release this candidate proposes to become. */
  readonly release_version: string
  /** The schema set the candidate declares it was authored against. */
  readonly schema_set_version: string
  /** The grades this candidate claims to publish. */
  readonly declared_grades: readonly number[]
  /** Claims the release completes the published path through graduation. */
  readonly graduation_complete: boolean
  readonly standards_custody: readonly StandardsCustodyRecord[]
  readonly safety_privacy_gate: SafetyPrivacyGateAttestation
  readonly authoring_set: CurriculumAuthoringSet
}

/**
 * Why a candidate was refused. The first nine are the required admission
 * rejections; RELEASE_GRADE_UNSUPPORTED is the companion to
 * RELEASE_SUBJECT_UNSUPPORTED and is what a grade 6 course trips.
 */
export type AdmissionRejectionCode =
  | 'RELEASE_SCHEMA_MISMATCH'
  | 'RELEASE_GRADE_MISSING'
  | 'RELEASE_DUPLICATE_ID'
  | 'RELEASE_SCHEDULE_UNRESOLVED'
  | 'RELEASE_SUBJECT_UNSUPPORTED'
  | 'RELEASE_STANDARDS_CUSTODY_MISSING'
  | 'RELEASE_SAFETY_PRIVACY_GATE_FAILED'
  | 'RELEASE_SCHEMA_FUTURE'
  | 'RELEASE_GRADUATION_CLAIM_FALSE'
  | 'RELEASE_GRADE_UNSUPPORTED'

export const ADMISSION_REJECTION_CODES: readonly AdmissionRejectionCode[] = [
  'RELEASE_SCHEMA_MISMATCH',
  'RELEASE_SCHEMA_FUTURE',
  'RELEASE_GRADE_MISSING',
  'RELEASE_GRADE_UNSUPPORTED',
  'RELEASE_SUBJECT_UNSUPPORTED',
  'RELEASE_DUPLICATE_ID',
  'RELEASE_SCHEDULE_UNRESOLVED',
  'RELEASE_STANDARDS_CUSTODY_MISSING',
  'RELEASE_SAFETY_PRIVACY_GATE_FAILED',
  'RELEASE_GRADUATION_CLAIM_FALSE',
]

export interface AdmissionRejection {
  readonly code: AdmissionRejectionCode
  /** Where the problem is, in the candidate's own vocabulary. */
  readonly path: string
  readonly detail: string
}

/** What one canonical grade actually contains in this candidate. */
export interface GradeCoverage {
  readonly grade: CanonicalGrade
  readonly declared: boolean
  readonly courses: number
  readonly units: number
  readonly lessons: number
  readonly subjects: readonly string[]
  /** A grade is scheduled when a schedule exists for it and resolves. */
  readonly scheduled: boolean
}

/**
 * A read-only census of the candidate. inspectCandidate returns this and
 * reaches no verdict — the same numbers feed validation, the operator CLI, and
 * the readiness evidence, so they are computed exactly once.
 */
export interface CandidateInspection {
  readonly candidate_id: string
  readonly release_version: string
  readonly declared_schema_set_version: string
  readonly supported_schema_set_version: typeof ADMISSION_SCHEMA_SET_VERSION
  readonly declared_grades: readonly number[]
  readonly observed_grades: readonly number[]
  readonly unsupported_grades: readonly number[]
  readonly observed_subjects: readonly string[]
  readonly unsupported_subjects: readonly string[]
  readonly graduation_complete_claimed: boolean
  readonly counts: {
    readonly courses: number
    readonly units: number
    readonly lessons: number
    readonly assessments: number
    readonly schedules: number
    readonly resources: number
    readonly standard_frameworks: number
  }
  readonly coverage: readonly GradeCoverage[]
  readonly referenced_frameworks: readonly string[]
  readonly custody_frameworks: readonly string[]
  readonly safety_privacy_gate: SafetyPrivacyGateAttestation
}

export interface CandidateValidation {
  readonly report_version: typeof ADMISSION_REPORT_VERSION
  readonly candidate_id: string
  readonly release_version: string
  readonly admissible: boolean
  readonly rejections: readonly AdmissionRejection[]
  /** Verbatim authoring issues, so nothing is lost in the mapping to codes. */
  readonly authoring_issues: readonly AuthoringIssue[]
  readonly inspection: CandidateInspection
}

/**
 * Set only by admitCandidate. A real symbol rather than a declared one, so the
 * brand survives into runtime and a fabricated object cannot pass for an
 * admitted release just because a cast said it could.
 */
export const ADMITTED_RELEASE: unique symbol = Symbol.for('manuel-academy/admitted-release')

/**
 * An admitted release. Only admitCandidate produces one, and the projection,
 * registry, and evidence builders accept nothing else — so a rejected
 * candidate cannot be projected into the catalog by mistake. The type gate
 * documents the rule; the branded property enforces it.
 */
export interface AdmittedRelease {
  readonly [ADMITTED_RELEASE]: true
  readonly candidate: ReleaseCandidate
  readonly inspection: CandidateInspection
}

export type AdmissionDecision =
  | {
      readonly status: 'ADMITTED'
      readonly validation: CandidateValidation
      readonly release: AdmittedRelease
    }
  | {
      readonly status: 'REJECTED'
      readonly validation: CandidateValidation
      readonly rejection_codes: readonly AdmissionRejectionCode[]
    }

/**
 * Self-contained data contracts for the Admin high-school programme module.
 *
 * All types are local to this module. Nothing here couples to
 * `src/types.ts::AcademyGrade` (which is intentionally still `5|7|8`) or the
 * curriculum runtime — the DASH-4 wave is UI-only and must not silently
 * broaden runtime unions.
 *
 * Provenance rule: every fact in the snapshot MUST carry a `sourceDoc`. If a
 * fact cannot be traced to the read-only source, it does not belong here.
 */

export const HIGH_SCHOOL_PROGRAM_CONTRACT_ID = 'manuel-academy-high-school-9-12-release-contract'
export const HIGH_SCHOOL_PROGRAM_SOURCE_REF = 'origin/mac/hs912-release-r1'

export const HIGH_SCHOOL_GRADES = [8, 9, 10, 11, 12] as const
export type HighSchoolGrade = (typeof HIGH_SCHOOL_GRADES)[number]

export const HIGH_SCHOOL_SUBJECTS = [
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
export type HighSchoolSubject = (typeof HIGH_SCHOOL_SUBJECTS)[number]

/**
 * Verdict vocabulary used across the Admin UI for coverage rulings.
 *
 * These are UI status labels derived from the source contract. They are NOT
 * equivalent to the raw contract verdicts (which include
 * REQUIRES_DIRECTOR_DECISION and PARTIALLY_COVERED); the mapping is done in
 * the model layer.
 */
export const COVERAGE_STATUS = ['COVERED', 'PARTIAL', 'NOT_COVERED', 'UNVERIFIED'] as const
export type CoverageStatus = (typeof COVERAGE_STATUS)[number]

/** Raw coverage verdicts as they appear in the contract itself. */
export const RAW_COVERAGE_VERDICTS = [
  'COVERED',
  'PARTIALLY_COVERED',
  'NOT_COVERED',
  'REQUIRES_DIRECTOR_DECISION',
] as const
export type RawCoverageVerdict = (typeof RAW_COVERAGE_VERDICTS)[number]

/** Raw seam continuity verdicts as they appear in the contract itself. */
export const SEAM_CONTINUITY_VERDICTS = [
  'CONTINUOUS',
  'CONTINUOUS_WITH_DESIGN_DECISION',
  'CONTINUOUS_WITH_CADENCE_CHANGE',
  'DELIBERATE_OVERLAP',
  'NO_ANCHOR',
] as const
export type SeamContinuityVerdict = (typeof SEAM_CONTINUITY_VERDICTS)[number]

/** Standards verification verdicts. */
export const STANDARDS_VERIFICATION = [
  'VERIFIED',
  'PARTIALLY_VERIFIED',
  'UNVERIFIED',
  'NO_ANCHOR',
] as const
export type StandardsVerification = (typeof STANDARDS_VERIFICATION)[number]

export const GRADUATION_VERDICTS = [
  'GRADUATION_COMPLETE',
  'NOT_GRADUATION_COMPLETE',
  'UNVERIFIED',
] as const
export type GraduationVerdict = (typeof GRADUATION_VERDICTS)[number]

export const COURSE_ORIGINS = ['EXISTING_GRADE_8_ANCHOR', 'NEW_HIGH_SCHOOL_COURSE'] as const
export type CourseOrigin = (typeof COURSE_ORIGINS)[number]

export const COURSE_AUTHORING_STATUSES = ['FROZEN_DO_NOT_MODIFY', 'TO_BE_AUTHORED', 'ADMITTED_RELEASE'] as const
export type CourseAuthoringStatus = (typeof COURSE_AUTHORING_STATUSES)[number]

/** A single course in the programme, as stated by the contract matrix. */
export interface HighSchoolCourse {
  readonly courseId: string
  readonly grade: HighSchoolGrade
  readonly subject: HighSchoolSubject
  readonly courseName: string
  readonly origin: CourseOrigin
  readonly authoringStatus: CourseAuthoringStatus
  /** null when the source records no credit (grade 8 anchor courses). */
  readonly creditRecommendation: number | null
  readonly sessions: number
  readonly unitCount?: number
  readonly lessonCount?: number
  readonly cadence: string | null
  readonly prerequisiteCourseIds: readonly string[]
  readonly satisfiesStateRequirements: readonly string[]
  readonly standardsFramework: string | null
  readonly scopeSummary: string
  /** Provenance: path in the read-only source tree. */
  readonly sourceDoc: string
}

/** Grade 8 → Grade 9 seam fact for a single subject family. */
export interface SeamFact {
  readonly family: HighSchoolSubject | 'world-language'
  readonly familyLabel: string
  readonly grade8CourseId: string | null
  readonly grade9CourseId: string | null
  readonly ruling: SeamContinuityVerdict
  readonly namedDiscontinuities: readonly string[]
  readonly note: string
  readonly sourceDoc: string
}

/** Standards traceability fact for one subject family. */
export interface StandardsFact {
  readonly family: HighSchoolSubject | 'world-language'
  readonly familyLabel: string
  readonly framework: string | null
  readonly verification: StandardsVerification
  readonly note: string
  readonly sourceDoc: string
}

/** A declared coverage gap or director-decision item from the audit. */
export interface CoverageGap {
  readonly requirement: string
  readonly requirementLabel: string
  readonly authority: string | null
  readonly rawVerdict: RawCoverageVerdict
  readonly displayStatus: CoverageStatus
  readonly creditsRequired: number
  /** For NOT_COVERED gaps, credits that cannot be substituted away. */
  readonly irreducibleRemainderCredits: number | null
  readonly detail: string
  readonly owner: string
  readonly sourceDoc: string
}

/** Graduation completeness ruling — never invented. */
export interface GraduationRuling {
  readonly verdict: GraduationVerdict
  readonly basis: string
  readonly note: string
  readonly sourceDoc: string
}

/**
 * Role a read-only source plays in the programme evidence catalog.
 *
 * `RELEASE_PLANNING_CONTRACT` — the contracted PROGRAM matrix (course names,
 *   recommended sessions/credits, prerequisite chain, coverage rulings). This
 *   is a PLANNING document, not proof of served or built content.
 * `AUTHORED_SUBJECT_EVIDENCE` — a subject branch that carries actual authored
 *   units/lessons/assessments and validation reports. May diverge from the
 *   contract; those divergences are recorded explicitly.
 * `SUPERSEDED_SUBJECT_EVIDENCE` — an earlier science revision (r1, h2, h3)
 *   that a later `hN` fix chain has replaced. Retained for lineage.
 */
export const EVIDENCE_ROLES = [
  'RELEASE_PLANNING_CONTRACT',
  'AUTHORED_SUBJECT_EVIDENCE',
  'SUPERSEDED_SUBJECT_EVIDENCE',
] as const
export type EvidenceRole = (typeof EVIDENCE_ROLES)[number]

/** Coverage projection for a source-evidence entry. */
export const EVIDENCE_COVERAGE = ['COVERED', 'PARTIAL', 'NOT_COVERED', 'UNVERIFIED'] as const
export type EvidenceCoverage = (typeof EVIDENCE_COVERAGE)[number]

/** Verdict for the reconciliation of one course between contract and subject branch. */
export const RECONCILIATION_VERDICTS = [
  'MATCHES_CONTRACT',
  'DIVERGES_TITLE',
  'DIVERGES_SESSIONS',
  'DIVERGES_TITLE_AND_SESSIONS',
  'DIVERGES_ID_SCHEME',
  'DIVERGES_MULTIPLE',
  'NO_SUBJECT_EVIDENCE',
] as const
export type ReconciliationVerdict = (typeof RECONCILIATION_VERDICTS)[number]

/**
 * A single source in the evidence catalog. `sha` is the SHORT git SHA
 * observed at the moment this snapshot was authored; verify by re-inspecting
 * the ref before acting on any specific field value.
 */
export interface SubjectEvidenceSource {
  readonly key: string
  readonly ref: string
  readonly sha: string
  readonly headSubject: string
  readonly role: EvidenceRole
  readonly familiesCovered: readonly HighSchoolSubject[]
  readonly authoringRootPaths: readonly string[]
  readonly validationSummary: string
  readonly coverage: EvidenceCoverage
  readonly note: string
  readonly supersededBy: string | null
}

/**
 * Per-course reconciliation between the contract matrix and the subject
 * branch that authored the course.
 *
 * `sessionsMatch`/`titleMatch`/`idMatch` compare the SUBJECT-BRANCH observed
 * value against the RELEASE-MATRIX contracted value. When the subject branch
 * did not author the course at all, `subjectSessions` and `subjectTitle` are
 * `null` and `verdict` is `NO_SUBJECT_EVIDENCE`.
 */
export interface CourseReconciliation {
  readonly courseId: string
  readonly grade: HighSchoolGrade
  readonly subject: HighSchoolSubject
  readonly contractTitle: string
  readonly contractSessions: number
  readonly contractCreditRecommendation: number | null
  readonly subjectRef: string | null
  readonly subjectSha: string | null
  readonly subjectCourseId: string | null
  readonly subjectTitle: string | null
  readonly subjectSessions: number | null
  readonly subjectSourceDoc: string | null
  readonly titleMatch: boolean
  readonly sessionsMatch: boolean
  readonly idMatch: boolean
  readonly verdict: ReconciliationVerdict
  readonly note: string
}

/**
 * A delivery/integration fact — whether authored content is actually served
 * by the runtime today. The release contract explicitly documents that
 * Grades 9-12 cannot be served without shared-file changes this wave does not
 * perform, so the default fact is `served: false` and the evidence is the
 * released authoring-boundaries note plus the subject branches' own README
 * disclaimers.
 */
export interface DeliveryFact {
  readonly fact: string
  readonly servedInRelease: boolean
  readonly evidenceRef: string
  readonly evidencePath: string
  readonly note: string
}

/** The complete data-source contract this module is built on. */
export interface HighSchoolProgramSnapshot {
  readonly contractId: typeof HIGH_SCHOOL_PROGRAM_CONTRACT_ID
  readonly sourceRef: typeof HIGH_SCHOOL_PROGRAM_SOURCE_REF
  readonly sourceSha: string
  readonly contractStatus: string
  readonly authoredOn: string
  readonly gradeSpan: readonly HighSchoolGrade[]
  readonly courses: readonly HighSchoolCourse[]
  readonly seam: readonly SeamFact[]
  readonly standards: readonly StandardsFact[]
  readonly gaps: readonly CoverageGap[]
  readonly graduationRuling: GraduationRuling
  readonly sources: readonly SubjectEvidenceSource[]
  readonly reconciliations: readonly CourseReconciliation[]
  readonly delivery: readonly DeliveryFact[]
  readonly release?: {
    readonly releaseId: string
    readonly releaseVersion: string
    readonly admissionStatus: string
    readonly sourceCommit: string
    readonly sourcePaths: readonly string[]
    readonly counts: {
      readonly grades: number
      readonly courses: number
      readonly units: number
      readonly lessons: number
      readonly assessments: number
    }
  }
}

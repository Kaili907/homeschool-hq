import type { AcademyGrade, AcademySubject, Grade } from '../../../types'

export type FinalReadinessStudentRef = string

/**
 * The configured value is intentionally wider than AcademyGrade. Readiness is
 * a trust boundary and must report a canonical-but-unsupported Grade instead
 * of making that state unrepresentable with a TypeScript cast.
 */
export type ConfiguredWorkingGrade = Grade | string | number | null | undefined

export interface DynamicSourceMetadata {
  readonly sourceRef: string
  readonly title: string
  readonly publisher: string
  readonly publishedAt: string
  readonly attachedAt: string
}

export type DynamicSourceRequirement = 'NONE' | 'SOCIAL_STUDIES_SOURCE_ATTACHMENT'
export type CompletionRequirement = 'STANDARD' | 'GUARDIAN_ATTESTATION'

export interface FinalReadinessAssignmentConfiguration {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly requiredProductionMaterialRefs: readonly string[]
  readonly dynamicSourceRequirement: DynamicSourceRequirement
  readonly dynamicSourceMetadata?: DynamicSourceMetadata | null
  readonly completionRequirement: CompletionRequirement
}

export interface FinalReadinessSubjectConfiguration {
  readonly subject: AcademySubject
  readonly workingGrade: ConfiguredWorkingGrade
  readonly requiredProductionMaterialRefs: readonly string[]
  readonly assignments: readonly FinalReadinessAssignmentConfiguration[]
}

export interface FinalReadinessStudentConfiguration {
  readonly studentRef: FinalReadinessStudentRef
  readonly displayName: string
  /** Every entry is enabled. Disabled subjects must be omitted by convergence. */
  readonly enabledSubjects: readonly FinalReadinessSubjectConfiguration[]
}

export interface SubjectGradeScope {
  readonly studentRef: FinalReadinessStudentRef
  readonly subject: AcademySubject
  readonly workingGrade: AcademyGrade
}

export interface AssignmentLessonScope extends SubjectGradeScope {
  readonly assignmentRef: string
  readonly lessonRef: string
}

export interface CurriculumAdmissionCapability {
  readonly isAdmitted: (scope: SubjectGradeScope) => boolean
}

export interface ProductionMaterialCapability {
  readonly isAvailable: (
    scope: SubjectGradeScope | AssignmentLessonScope,
    materialRef: string,
  ) => boolean
}

export type StudyStorageHealthStatus = 'HEALTHY' | 'DEGRADED' | 'READ_ONLY' | 'UNAVAILABLE'

export type StudyStorageHealthReasonCode =
  | 'NONE'
  | 'RECOVERED_STATE'
  | 'SCHEMA_VERSION_AHEAD'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_WRITE_FAILED'
  | 'HEALTH_PROBE_FAILED'

export interface StudyStorageHealth {
  readonly status: StudyStorageHealthStatus
  readonly reasonCode: StudyStorageHealthReasonCode
}

export interface StudyStorageHealthCapability {
  readonly health: (studentRef: FinalReadinessStudentRef) => StudyStorageHealth
}

export interface AssignmentCapability {
  readonly isSubjectAvailable: (scope: SubjectGradeScope) => boolean
  readonly isAssignmentAvailable: (scope: AssignmentLessonScope) => boolean
}

export interface SafetyCapability {
  readonly isAvailable: (scope: SubjectGradeScope | AssignmentLessonScope) => boolean
}

export interface CompletionAuthorityCapability {
  readonly isAvailable: (scope: SubjectGradeScope | AssignmentLessonScope) => boolean
}

export interface DynamicSourceReadinessCapability {
  readonly isQualifying: (
    scope: AssignmentLessonScope,
    metadata: DynamicSourceMetadata,
  ) => boolean
}

export interface GuardianAttestationCapability {
  readonly isAvailable: (scope: AssignmentLessonScope) => boolean
}

export interface TutorAvailabilityCapability {
  readonly isTutorAvailable: (scope: SubjectGradeScope) => boolean
  readonly isStaticHelpAvailable: (scope: SubjectGradeScope) => boolean
}

export interface FinalReadinessCapabilities {
  readonly curriculumAdmission: CurriculumAdmissionCapability
  readonly productionMaterial: ProductionMaterialCapability
  readonly studyStorage: StudyStorageHealthCapability
  readonly assignment: AssignmentCapability
  readonly safety: SafetyCapability
  readonly completionAuthority: CompletionAuthorityCapability
  readonly dynamicSource: DynamicSourceReadinessCapability
  readonly guardianAttestation: GuardianAttestationCapability
  readonly tutor: TutorAvailabilityCapability
}

/** Closed, versioned vocabulary emitted by every evaluator level. */
export const FINAL_READINESS_CODES = Object.freeze([
  'READY',
  'INVALID_CONFIGURATION',
  'UNSUPPORTED_CURRICULUM_GRADE',
  'CURRICULUM_NOT_ADMITTED',
  'REQUIRED_PRODUCTION_MATERIAL_MISSING',
  'STUDY_PERSISTENCE_UNAVAILABLE',
  'ASSIGNMENT_UNAVAILABLE',
  'SAFETY_UNAVAILABLE',
  'COMPLETION_AUTHORITY_UNAVAILABLE',
  'TUTOR_HELP_UNAVAILABLE',
  'PENDING_SOURCE_ATTACHMENT',
  'ATTESTATION_CAPABILITY_REQUIRED',
  'TUTOR_UNAVAILABLE_STATIC_HELP_AVAILABLE',
  'STUDY_PERSISTENCE_DEGRADED',
] as const)

export type FinalReadinessCode = typeof FINAL_READINESS_CODES[number]

export const HARD_BLOCKING_READINESS_CODES = Object.freeze([
  'INVALID_CONFIGURATION',
  'UNSUPPORTED_CURRICULUM_GRADE',
  'CURRICULUM_NOT_ADMITTED',
  'REQUIRED_PRODUCTION_MATERIAL_MISSING',
  'STUDY_PERSISTENCE_UNAVAILABLE',
  'ASSIGNMENT_UNAVAILABLE',
  'SAFETY_UNAVAILABLE',
  'COMPLETION_AUTHORITY_UNAVAILABLE',
  'TUTOR_HELP_UNAVAILABLE',
] as const satisfies readonly FinalReadinessCode[])

export type HardBlockingReadinessCode = typeof HARD_BLOCKING_READINESS_CODES[number]
export type AssignmentReadinessStatus = 'READY' | 'PENDING' | 'BLOCKED'
export type SubjectReadinessStatus = 'READY' | 'BLOCKED'
export type FinalFamilyReadinessStatus = 'FINAL_FAMILY_READY' | 'BLOCKED'

export interface FinalAssignmentReadinessResult {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly status: AssignmentReadinessStatus
  /** False for both hard-blocked work and localized pending work. */
  readonly assignableAsNormalFamilyPilotTask: boolean
  readonly codes: readonly FinalReadinessCode[]
}

export interface FinalSubjectReadinessResult {
  readonly subject: AcademySubject
  readonly workingGrade: ConfiguredWorkingGrade
  readonly status: SubjectReadinessStatus
  readonly codes: readonly FinalReadinessCode[]
  readonly assignments: readonly FinalAssignmentReadinessResult[]
}

export interface FinalStudentReadinessResult {
  readonly studentRef: FinalReadinessStudentRef
  readonly displayName: string
  readonly ready: boolean
  readonly codes: readonly FinalReadinessCode[]
  readonly storageHealth: StudyStorageHealth
  readonly subjects: readonly FinalSubjectReadinessResult[]
}

export interface FinalFamilyReadinessResult {
  readonly status: FinalFamilyReadinessStatus
  readonly codes: readonly FinalReadinessCode[]
  readonly students: readonly FinalStudentReadinessResult[]
}

export const FAMILY_PILOT_ASSESSMENT_WORKFLOW_LABEL = 'FAMILY PILOT — ASSESSMENT WORKFLOW R1' as const

export type AssessmentSubject =
  | 'arts-and-music'
  | 'english-language-arts'
  | 'financial-literacy'
  | 'health'
  | 'mathematics'
  | 'physical-education'
  | 'ready-for-life'
  | 'science'
  | 'social-studies'
  | 'technology'

export type AssessmentAuthorityClass =
  | 'AUTO_SCOREABLE'
  | 'RUBRIC_REQUIRED'
  | 'GUARDIAN_REQUIRED'
  | 'COMPLETION_ONLY'

export interface LearnerAssessmentTask {
  readonly taskRef: string
  readonly kind: string
  readonly prompt: string
  readonly directions?: string
  readonly choices?: readonly string[]
  readonly responseUnit?: string
  readonly standardRef?: string
  readonly possiblePoints?: number
}

export interface LearnerAssessmentPackage {
  readonly schemaVersion: '1.0'
  readonly kind: 'canonical-learner-assessment-package'
  readonly assessmentRef: string
  readonly courseRef: string
  readonly grade: number
  readonly subject: AssessmentSubject
  readonly location: {
    readonly unitRef: string
    readonly unitNumber: number
    readonly unitTitle: string
    readonly courseTitle: string
    readonly assessmentLessonRef: string | null
  }
  readonly instructions: readonly string[]
  readonly learnerTasks: readonly LearnerAssessmentTask[]
  readonly responseMode: string
  readonly completionScoringAuthorityClass: AssessmentAuthorityClass
  readonly adultScoringAuthorityRef: string
  readonly learnerSuccessCriteria: readonly string[]
  readonly productionReadiness: {
    readonly status: 'READY'
    readonly structuralOnly: false
    readonly answerMaterialIncluded: false
    readonly requiresSourceAttachment?: boolean
    readonly sourceResolverKey?: string | null
  }
}

/** Learner projection: restricted authority references and all answer custody are omitted. */
export interface LearnerAssessmentDto {
  readonly assessmentRef: string
  readonly courseRef: string
  readonly grade: number
  readonly subject: AssessmentSubject
  readonly location: LearnerAssessmentPackage['location']
  readonly instructions: readonly string[]
  readonly learnerTasks: readonly LearnerAssessmentTask[]
  readonly responseMode: string
  readonly completionScoringAuthorityClass: AssessmentAuthorityClass
  readonly learnerSuccessCriteria: readonly string[]
}

export interface AssessmentLaunchBinding {
  readonly origin: 'assignment' | 'schedule'
  readonly workRef: string
  readonly learnerRef: string
  readonly assessmentRef: string
  readonly courseRef: string
  readonly grade: number
  readonly subject: AssessmentSubject
  readonly sourceAttachmentRef?: string | null
}

export interface AssessmentCatalogPort {
  resolve(assessmentRef: string): Promise<LearnerAssessmentPackage | null> | LearnerAssessmentPackage | null
  hasRestrictedAuthority(authorityRef: string): Promise<boolean> | boolean
}

export interface AssessmentSourceReadinessPort {
  check(input: {
    readonly assessmentRef: string
    readonly resolverKey: string
    readonly sourceAttachmentRef: string | null
  }): Promise<{ readonly ready: boolean; readonly reasonCode?: string }> | { readonly ready: boolean; readonly reasonCode?: string }
}

export interface AssessmentResponse {
  readonly taskRef: string
  readonly value: string | number | readonly string[]
}

export interface ProductionAssessmentAssessor {
  assess(input: {
    readonly assessmentRef: string
    readonly submissionRef: string
    readonly responseMode: string
    readonly restrictedAuthorityRef: string
    readonly responses: readonly AssessmentResponse[]
  }): Promise<{
    readonly status: 'SCORED' | 'REQUIRES_ADULT_REVIEW' | 'REJECTED'
    readonly assessmentRecordRef?: string
    readonly reasonCode?: string
  }>
}

export interface GuardianAssessmentCertificationPort {
  certify(input: {
    readonly launchRef: string
    readonly assessmentRef: string
    readonly learnerRef: string
    readonly guardianRef: string
    readonly certifiedAt: string
  }): Promise<{ readonly certificationRef: string }>
}

export type AssessmentWorkflowReason =
  | 'assessment-not-found'
  | 'assessment-empty'
  | 'assessment-binding-mismatch'
  | 'assessment-material-invalid'
  | 'answer-material-exposed'
  | 'structural-only-assessment'
  | 'adult-authority-unavailable'
  | 'source-not-ready'
  | 'guardian-certification-unavailable'
  | 'launch-not-found'
  | 'submission-empty'
  | 'submission-task-mismatch'
  | 'assessor-rejected'
  | 'guardian-authority-required'
  | 'guardian-certification-not-applicable'

export type AssessmentWorkflowResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'rejected'; readonly reason: AssessmentWorkflowReason; readonly detailCode?: string }

export interface AssessmentWorkflowApi {
  readonly label: typeof FAMILY_PILOT_ASSESSMENT_WORKFLOW_LABEL
  launch(binding: AssessmentLaunchBinding): Promise<AssessmentWorkflowResult<{
    readonly launchRef: string
    readonly assessment: LearnerAssessmentDto
  }>>
  submit(input: {
    readonly launchRef: string
    readonly submissionRef: string
    readonly responses: readonly AssessmentResponse[]
  }): Promise<AssessmentWorkflowResult<{
    readonly completionStatus: 'CERTIFIED' | 'PENDING_GUARDIAN_ATTESTATION' | 'SCORING_COMPLETE' | 'ADULT_REVIEW_REQUIRED'
    readonly assessmentRecordRef?: string
  }>>
  certifyGuardian(input: {
    readonly launchRef: string
    readonly actor: { readonly kind: 'learner' | 'guardian'; readonly actorRef: string }
    readonly certifiedAt: string
  }): Promise<AssessmentWorkflowResult<{ readonly completionStatus: 'CERTIFIED'; readonly certificationRef: string }>>
}

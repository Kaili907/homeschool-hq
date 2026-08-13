import {
  FAMILY_PILOT_ASSESSMENT_WORKFLOW_LABEL,
  type AssessmentLaunchBinding,
  type AssessmentWorkflowApi,
  type AssessmentWorkflowReason,
  type AssessmentWorkflowResult,
  type GuardianAssessmentCertificationPort,
  type LearnerAssessmentDto,
  type LearnerAssessmentPackage,
  type ProductionAssessmentAssessor,
  type AssessmentCatalogPort,
  type AssessmentSourceReadinessPort,
} from './contracts'

const forbiddenKeys = new Set([
  'answer', 'answers', 'answerKey', 'answerKeyRef', 'answerAuthorityRef', 'correctAnswer',
  'correctChoice', 'answerIndex', 'expectedAnswer', 'solution', 'solutions', 'scoringGuide',
])

function containsForbiddenKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenKey)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, child]) => forbiddenKeys.has(key) || containsForbiddenKey(child))
}

function rejected<T>(reason: AssessmentWorkflowReason, detailCode?: string): AssessmentWorkflowResult<T> {
  return { status: 'rejected', reason, ...(detailCode ? { detailCode } : {}) }
}

function learnerDto(pkg: LearnerAssessmentPackage): LearnerAssessmentDto {
  return Object.freeze({
    assessmentRef: pkg.assessmentRef,
    courseRef: pkg.courseRef,
    grade: pkg.grade,
    subject: pkg.subject,
    location: pkg.location,
    instructions: pkg.instructions,
    learnerTasks: pkg.learnerTasks,
    responseMode: pkg.responseMode,
    completionScoringAuthorityClass: pkg.completionScoringAuthorityClass,
    learnerSuccessCriteria: pkg.learnerSuccessCriteria,
  })
}

function packageFailure(pkg: LearnerAssessmentPackage): AssessmentWorkflowReason | null {
  if (pkg.productionReadiness?.structuralOnly !== false) return 'structural-only-assessment'
  if (pkg.productionReadiness?.status !== 'READY') return 'assessment-material-invalid'
  if (pkg.productionReadiness?.answerMaterialIncluded !== false || containsForbiddenKey(pkg)) return 'answer-material-exposed'
  if (!pkg.instructions?.length || !pkg.learnerTasks?.length || !pkg.learnerSuccessCriteria?.length) return 'assessment-empty'
  if (pkg.learnerTasks.some((task) => !task.taskRef?.trim() || !task.prompt?.trim())) return 'assessment-empty'
  if (!pkg.adultScoringAuthorityRef?.startsWith('restricted:')) return 'assessment-material-invalid'
  return null
}

interface LaunchState {
  readonly binding: AssessmentLaunchBinding
  readonly pkg: LearnerAssessmentPackage
  submitted: boolean
}

export function createAssessmentWorkflowAdapter(options: {
  readonly catalog: AssessmentCatalogPort
  readonly assessor: ProductionAssessmentAssessor
  readonly sourceReadiness?: AssessmentSourceReadinessPort
  readonly guardianCertification?: GuardianAssessmentCertificationPort
  readonly idFactory: (kind: 'launch') => string
}): AssessmentWorkflowApi {
  const launches = new Map<string, LaunchState>()

  return {
    label: FAMILY_PILOT_ASSESSMENT_WORKFLOW_LABEL,

    async launch(binding) {
      const pkg = await options.catalog.resolve(binding.assessmentRef)
      if (!pkg) return rejected('assessment-not-found')
      const invalid = packageFailure(pkg)
      if (invalid) return rejected(invalid)
      if (pkg.assessmentRef !== binding.assessmentRef
        || pkg.courseRef !== binding.courseRef
        || pkg.grade !== binding.grade
        || pkg.subject !== binding.subject) return rejected('assessment-binding-mismatch')
      if (!await options.catalog.hasRestrictedAuthority(pkg.adultScoringAuthorityRef)) return rejected('adult-authority-unavailable')
      if (pkg.completionScoringAuthorityClass === 'GUARDIAN_REQUIRED' && !options.guardianCertification) {
        return rejected('guardian-certification-unavailable')
      }
      if (pkg.productionReadiness.requiresSourceAttachment) {
        const resolverKey = pkg.productionReadiness.sourceResolverKey
        if (!resolverKey || !options.sourceReadiness) return rejected('source-not-ready', 'source-resolver-unavailable')
        const source = await options.sourceReadiness.check({
          assessmentRef: pkg.assessmentRef,
          resolverKey,
          sourceAttachmentRef: binding.sourceAttachmentRef ?? null,
        })
        if (!source.ready) return rejected('source-not-ready', source.reasonCode)
      }
      const launchRef = options.idFactory('launch')
      if (!launchRef || launches.has(launchRef)) return rejected('assessment-material-invalid', 'invalid-launch-ref')
      launches.set(launchRef, { binding, pkg, submitted: false })
      return { status: 'ok', value: { launchRef, assessment: learnerDto(pkg) } }
    },

    async submit(input) {
      const launched = launches.get(input.launchRef)
      if (!launched) return rejected('launch-not-found')
      if (!input.submissionRef.trim() || input.responses.length === 0) return rejected('submission-empty')
      const taskRefs = new Set(launched.pkg.learnerTasks.map((task) => task.taskRef))
      const responseRefs = new Set(input.responses.map((response) => response.taskRef))
      if (responseRefs.size !== input.responses.length || [...responseRefs].some((ref) => !taskRefs.has(ref))) {
        return rejected('submission-task-mismatch')
      }
      if (input.responses.some((response) => typeof response.value === 'string' && !response.value.trim())) return rejected('submission-empty')

      launched.submitted = true
      if (launched.pkg.completionScoringAuthorityClass === 'GUARDIAN_REQUIRED') {
        return { status: 'ok', value: { completionStatus: 'PENDING_GUARDIAN_ATTESTATION' } }
      }
      if (launched.pkg.completionScoringAuthorityClass === 'COMPLETION_ONLY') {
        return { status: 'ok', value: { completionStatus: 'CERTIFIED' } }
      }

      const assessed = await options.assessor.assess({
        assessmentRef: launched.pkg.assessmentRef,
        submissionRef: input.submissionRef,
        responseMode: launched.pkg.responseMode,
        restrictedAuthorityRef: launched.pkg.adultScoringAuthorityRef,
        responses: input.responses,
      })
      if (assessed.status === 'REJECTED') return rejected('assessor-rejected', assessed.reasonCode)
      return {
        status: 'ok',
        value: {
          completionStatus: assessed.status === 'SCORED' ? 'SCORING_COMPLETE' : 'ADULT_REVIEW_REQUIRED',
          ...(assessed.assessmentRecordRef ? { assessmentRecordRef: assessed.assessmentRecordRef } : {}),
        },
      }
    },

    async certifyGuardian(input) {
      const launched = launches.get(input.launchRef)
      if (!launched) return rejected('launch-not-found')
      if (launched.pkg.completionScoringAuthorityClass !== 'GUARDIAN_REQUIRED') {
        return rejected('guardian-certification-not-applicable')
      }
      if (input.actor.kind !== 'guardian') return rejected('guardian-authority-required')
      if (!launched.submitted) return rejected('submission-empty')
      if (!options.guardianCertification) return rejected('guardian-certification-unavailable')
      const certified = await options.guardianCertification.certify({
        launchRef: input.launchRef,
        assessmentRef: launched.pkg.assessmentRef,
        learnerRef: launched.binding.learnerRef,
        guardianRef: input.actor.actorRef,
        certifiedAt: input.certifiedAt,
      })
      return { status: 'ok', value: { completionStatus: 'CERTIFIED', certificationRef: certified.certificationRef } }
    },
  }
}

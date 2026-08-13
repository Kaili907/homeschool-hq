import { describe, expect, it, vi } from 'vitest'
import {
  createAssessmentWorkflowAdapter,
  type AssessmentCatalogPort,
  type LearnerAssessmentPackage,
} from '.'

const basePackage = (overrides: Partial<LearnerAssessmentPackage> = {}): LearnerAssessmentPackage => ({
  schemaVersion: '1.0',
  kind: 'canonical-learner-assessment-package',
  assessmentRef: 'ma-g5-mathematics-u01-assessment',
  courseRef: 'ma-g5-mathematics',
  grade: 5,
  subject: 'mathematics',
  location: {
    unitRef: 'ma-g5-mathematics-u01', unitNumber: 1, unitTitle: 'Unit 1',
    courseTitle: 'Grade 5 Mathematics', assessmentLessonRef: 'ma-g5-mathematics-u01-l16',
  },
  instructions: ['Work independently.'],
  learnerTasks: [{ taskRef: 'item-1', kind: 'fixed-response', prompt: 'Compute 2 + 3.' }],
  responseMode: 'fixed-and-work-shown',
  completionScoringAuthorityClass: 'AUTO_SCOREABLE',
  adultScoringAuthorityRef: 'restricted:adult/ma-g5-mathematics-u01-assessment',
  learnerSuccessCriteria: ['Show the requested work.'],
  productionReadiness: { status: 'READY', structuralOnly: false, answerMaterialIncluded: false },
  ...overrides,
})

const binding = (overrides = {}) => ({
  origin: 'assignment' as const,
  workRef: 'assignment:1',
  learnerRef: 'learner:1',
  assessmentRef: 'ma-g5-mathematics-u01-assessment',
  courseRef: 'ma-g5-mathematics',
  grade: 5,
  subject: 'mathematics' as const,
  ...overrides,
})

function fixture(pkg: LearnerAssessmentPackage, authorityAvailable = true) {
  const catalog: AssessmentCatalogPort = {
    resolve: async () => pkg,
    hasRestrictedAuthority: async () => authorityAvailable,
  }
  const assess = vi.fn(async () => ({ status: 'SCORED' as const, assessmentRecordRef: 'assessment-record:1' }))
  const certify = vi.fn(async () => ({ certificationRef: 'certification:1' }))
  let sequence = 0
  const workflow = createAssessmentWorkflowAdapter({
    catalog,
    assessor: { assess },
    guardianCertification: { certify },
    sourceReadiness: { check: async ({ sourceAttachmentRef }) => ({ ready: Boolean(sourceAttachmentRef), reasonCode: 'qualifying-source-required' }) },
    idFactory: () => `launch:${++sequence}`,
  })
  return { workflow, assess, certify }
}

describe('assessment workflow adapter', () => {
  it('launches from assignment or schedule and delegates scoring to the injected production assessor', async () => {
    const { workflow, assess } = fixture(basePackage())
    const launched = await workflow.launch(binding({ origin: 'schedule', workRef: 'schedule:1' }))
    expect(launched.status).toBe('ok')
    if (launched.status !== 'ok') return
    expect(launched.value.assessment).not.toHaveProperty('adultScoringAuthorityRef')
    expect(JSON.stringify(launched.value.assessment)).not.toMatch(/answerKey|correctAnswer|answerIndex/)

    const submitted = await workflow.submit({
      launchRef: launched.value.launchRef,
      submissionRef: 'submission:1',
      responses: [{ taskRef: 'item-1', value: '5; work shown separately' }],
    })
    expect(submitted).toEqual({
      status: 'ok',
      value: { completionStatus: 'SCORING_COMPLETE', assessmentRecordRef: 'assessment-record:1' },
    })
    expect(assess).toHaveBeenCalledWith(expect.objectContaining({
      assessmentRef: 'ma-g5-mathematics-u01-assessment',
      restrictedAuthorityRef: 'restricted:adult/ma-g5-mathematics-u01-assessment',
    }))
  })

  it.each([
    ['empty assessment', basePackage({ learnerTasks: [] }), 'assessment-empty'],
    ['answer leak', { ...basePackage(), answerKeyRef: 'restricted:key' } as unknown as LearnerAssessmentPackage, 'answer-material-exposed'],
    ['structural-only launch', {
      ...basePackage(), productionReadiness: { status: 'READY', structuralOnly: true, answerMaterialIncluded: false },
    } as unknown as LearnerAssessmentPackage, 'structural-only-assessment'],
  ])('fails closed for %s', async (_label, pkg, reason) => {
    const { workflow } = fixture(pkg)
    await expect(workflow.launch(binding())).resolves.toEqual({ status: 'rejected', reason })
  })

  it('rejects a wrong-subject binding', async () => {
    const { workflow } = fixture(basePackage())
    await expect(workflow.launch(binding({ subject: 'science' }))).resolves.toEqual({
      status: 'rejected', reason: 'assessment-binding-mismatch',
    })
  })

  it('treats a missing restricted rubric/scoring authority as unavailable', async () => {
    const { workflow } = fixture(basePackage({ completionScoringAuthorityClass: 'RUBRIC_REQUIRED' }), false)
    await expect(workflow.launch(binding())).resolves.toEqual({ status: 'rejected', reason: 'adult-authority-unavailable' })
  })

  it('requires an attached qualifying source for dynamic Social Studies material', async () => {
    const pkg = basePackage({
      assessmentRef: 'ma-g5-social-studies-u01-assessment',
      courseRef: 'ma-g5-social-studies',
      subject: 'social-studies',
      completionScoringAuthorityClass: 'RUBRIC_REQUIRED',
      productionReadiness: {
        status: 'READY', structuralOnly: false, answerMaterialIncluded: false,
        requiresSourceAttachment: true, sourceResolverKey: 'social-dynamic-source-attachment-v1',
      },
    })
    const { workflow } = fixture(pkg)
    const socialBinding = binding({
      assessmentRef: pkg.assessmentRef, courseRef: pkg.courseRef, subject: 'social-studies',
    })
    await expect(workflow.launch(socialBinding)).resolves.toEqual({
      status: 'rejected', reason: 'source-not-ready', detailCode: 'qualifying-source-required',
    })
    await expect(workflow.launch({ ...socialBinding, sourceAttachmentRef: 'source:qualified' })).resolves.toMatchObject({ status: 'ok' })
  })

  it('keeps RFL guardian certification guardian-only', async () => {
    const pkg = basePackage({
      assessmentRef: 'ma-g5-ready-for-life-u01-assessment',
      courseRef: 'ma-g5-ready-for-life',
      subject: 'ready-for-life',
      completionScoringAuthorityClass: 'GUARDIAN_REQUIRED',
    })
    const { workflow, certify, assess } = fixture(pkg)
    const launched = await workflow.launch(binding({ assessmentRef: pkg.assessmentRef, courseRef: pkg.courseRef, subject: 'ready-for-life' }))
    if (launched.status !== 'ok') throw new Error('fixture did not launch')
    await workflow.submit({ launchRef: launched.value.launchRef, submissionRef: 'submission:rfl', responses: [{ taskRef: 'item-1', value: 'done' }] })
    await expect(workflow.certifyGuardian({
      launchRef: launched.value.launchRef,
      actor: { kind: 'learner', actorRef: 'learner:1' },
      certifiedAt: '2026-08-13T12:00:00.000Z',
    })).resolves.toEqual({ status: 'rejected', reason: 'guardian-authority-required' })
    await expect(workflow.certifyGuardian({
      launchRef: launched.value.launchRef,
      actor: { kind: 'guardian', actorRef: 'guardian:1' },
      certifiedAt: '2026-08-13T12:00:00.000Z',
    })).resolves.toEqual({ status: 'ok', value: { completionStatus: 'CERTIFIED', certificationRef: 'certification:1' } })
    expect(certify).toHaveBeenCalledWith(expect.objectContaining({ guardianRef: 'guardian:1', learnerRef: 'learner:1' }))
    expect(assess).not.toHaveBeenCalled()
  })
})

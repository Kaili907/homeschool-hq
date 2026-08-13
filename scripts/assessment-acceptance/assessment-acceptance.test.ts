import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { auditAssessmentAcceptance } from './audit.mjs'
import {
  createAssessmentWorkflowAdapter,
  type AssessmentCatalogPort,
  type AssessmentLaunchBinding,
  type LearnerAssessmentPackage,
} from '../../src/study/family-pilot/final-app/assessment'

const root = process.cwd()
const manifest = JSON.parse(readFileSync(resolve(root, 'curriculum-production/final/assessments/manifest.json'), 'utf8'))
const packages = manifest.assessments.map((row: { packageRef: string }) =>
  JSON.parse(readFileSync(resolve(root, row.packageRef), 'utf8')) as LearnerAssessmentPackage)
const packageByRef = new Map(packages.map((pkg) => [pkg.assessmentRef, pkg]))

function binding(pkg: LearnerAssessmentPackage, origin: 'assignment' | 'schedule'): AssessmentLaunchBinding {
  return {
    origin,
    workRef: `${origin}:${pkg.assessmentRef}`,
    learnerRef: 'learner:acceptance',
    assessmentRef: pkg.assessmentRef,
    courseRef: pkg.courseRef,
    grade: pkg.grade,
    subject: pkg.subject,
    ...(pkg.productionReadiness.requiresSourceAttachment ? { sourceAttachmentRef: 'source:qualified' } : {}),
  }
}

function workflowFor(assessStatus: 'BY_AUTHORITY' | 'SCORED' = 'BY_AUTHORITY') {
  const catalog: AssessmentCatalogPort = {
    resolve: async (assessmentRef) => packageByRef.get(assessmentRef) ?? null,
    hasRestrictedAuthority: async () => true,
  }
  let launch = 0
  const assess = vi.fn(async (input: { readonly assessmentRef: string }) => ({
    status: assessStatus === 'SCORED' ||
      packageByRef.get(input.assessmentRef)?.completionScoringAuthorityClass === 'AUTO_SCOREABLE'
      ? 'SCORED' as const
      : 'REQUIRES_ADULT_REVIEW' as const,
    assessmentRecordRef: 'record:acceptance',
  }))
  const certify = vi.fn(async () => ({ certificationRef: 'certification:acceptance' }))
  return {
    assess,
    certify,
    workflow: createAssessmentWorkflowAdapter({
      catalog,
      assessor: { assess },
      guardianCertification: { certify },
      sourceReadiness: { check: async ({ sourceAttachmentRef }) => ({
        ready: Boolean(sourceAttachmentRef),
        reasonCode: 'qualifying-source-required',
      }) },
      idFactory: () => `launch:${++launch}`,
    }),
  }
}

describe('assessment acceptance R1 audit', () => {
  it('exhaustively verifies the 699 material, response, authority, classification, and leakage records', () => {
    const result = auditAssessmentAcceptance()
    expect(result.total).toBe(699)
    expect(result.learnerMaterial).toBe(699)
    expect(result.responseModes).toBe(699)
    expect(result.authorityPaths).toBe(699)
    expect(result.structuralOnly).toBe(0)
    expect(result.answerLeaks).toBe(0)
    expect(result.failures).toEqual([])
    expect(result.subjectCounts).toEqual({
      'arts-and-music': 54,
      'english-language-arts': 90,
      'financial-literacy': 59,
      health: 54,
      mathematics: 91,
      'physical-education': 81,
      'ready-for-life': 54,
      science: 81,
      'social-studies': 81,
      technology: 54,
    })
    expect(result.authorityCounts).toEqual({
      AUTO_SCOREABLE: 90,
      COMPLETION_ONLY: 29,
      GUARDIAN_REQUIRED: 25,
      RUBRIC_REQUIRED: 555,
    })
  })

  it('launches every package through the isolated adapter for assignment and schedule bindings', async () => {
    const { workflow } = workflowFor()
    for (const pkg of packages) {
      for (const origin of ['assignment', 'schedule'] as const) {
        const launched = await workflow.launch(binding(pkg, origin))
        expect(launched, `${origin}:${pkg.assessmentRef}`).toMatchObject({ status: 'ok' })
        if (launched.status !== 'ok') continue
        expect(Object.keys(launched.value.assessment).sort()).toEqual([
          'assessmentRef', 'completionScoringAuthorityClass', 'courseRef', 'grade', 'instructions',
          'learnerSuccessCriteria', 'learnerTasks', 'location', 'responseMode', 'subject',
        ])
        expect(JSON.stringify(launched.value.assessment)).not.toMatch(
          /adultScoringAuthorityRef|answerKey|answerAuthority|correctAnswer|answerIndex|expectedAnswer|scoringGuide/,
        )
      }
    }
  })

  it('routes all four authority classes through their isolated expected paths', async () => {
    const { workflow, assess } = workflowFor()
    for (const pkg of packages) {
      const launched = await workflow.launch(binding(pkg, 'assignment'))
      expect(launched.status, pkg.assessmentRef).toBe('ok')
      if (launched.status !== 'ok') continue
      const submitted = await workflow.submit({
        launchRef: launched.value.launchRef,
        submissionRef: `submission:${pkg.assessmentRef}`,
        responses: [{ taskRef: pkg.learnerTasks[0].taskRef, value: 'acceptance evidence' }],
      })
      expect(submitted.status, pkg.assessmentRef).toBe('ok')
      if (submitted.status !== 'ok') continue
      const expected = pkg.completionScoringAuthorityClass === 'GUARDIAN_REQUIRED'
        ? 'PENDING_GUARDIAN_ATTESTATION'
        : pkg.completionScoringAuthorityClass === 'COMPLETION_ONLY'
          ? 'CERTIFIED'
          : pkg.completionScoringAuthorityClass === 'AUTO_SCOREABLE'
            ? 'SCORING_COMPLETE'
            : 'ADULT_REVIEW_REQUIRED'
      expect(submitted.value.completionStatus, pkg.assessmentRef).toBe(expected)
    }
    expect(assess).toHaveBeenCalledTimes(645)
  })

  it('proves every guardian assessment rejects learner certification', async () => {
    const guardians = packages.filter((pkg) => pkg.completionScoringAuthorityClass === 'GUARDIAN_REQUIRED')
    expect(guardians).toHaveLength(25)
    const { workflow, certify, assess } = workflowFor()
    for (const pkg of guardians) {
      const launched = await workflow.launch(binding(pkg, 'assignment'))
      if (launched.status !== 'ok') throw new Error(`Could not launch ${pkg.assessmentRef}`)
      await workflow.submit({
        launchRef: launched.value.launchRef,
        submissionRef: `submission:${pkg.assessmentRef}`,
        responses: [{ taskRef: pkg.learnerTasks[0].taskRef, value: 'completed' }],
      })
      await expect(workflow.certifyGuardian({
        launchRef: launched.value.launchRef,
        actor: { kind: 'learner', actorRef: 'learner:acceptance' },
        certifiedAt: '2026-08-13T12:00:00.000Z',
      }), pkg.assessmentRef).resolves.toEqual({ status: 'rejected', reason: 'guardian-authority-required' })
    }
    expect(certify).not.toHaveBeenCalled()
    expect(assess).not.toHaveBeenCalled()
  })

  it('proves the actual dynamic-source assessment fails closed without its source', async () => {
    const dynamic = packages.filter((pkg) => pkg.productionReadiness.requiresSourceAttachment)
    expect(dynamic).toHaveLength(1)
    const pkg = dynamic[0]
    expect(pkg.assessmentRef).toBe('ma-g3-social-studies-u09-assessment')
    const { workflow } = workflowFor()
    await expect(workflow.launch({ ...binding(pkg, 'schedule'), sourceAttachmentRef: null })).resolves.toEqual({
      status: 'rejected', reason: 'source-not-ready', detailCode: 'qualifying-source-required',
    })
    await expect(workflow.launch(binding(pkg, 'schedule'))).resolves.toMatchObject({ status: 'ok' })
  })

  it('records the rubric false-auto-score defect without repairing it', async () => {
    const rubric = packages.find((pkg) => pkg.completionScoringAuthorityClass === 'RUBRIC_REQUIRED')
    if (!rubric) throw new Error('Missing rubric fixture')
    const { workflow, assess } = workflowFor('SCORED')
    const launched = await workflow.launch(binding(rubric, 'assignment'))
    if (launched.status !== 'ok') throw new Error('Rubric fixture did not launch')
    const submitted = await workflow.submit({
      launchRef: launched.value.launchRef,
      submissionRef: 'submission:false-auto-score-proof',
      responses: [{ taskRef: rubric.learnerTasks[0].taskRef, value: 'constructed learner work' }],
    })
    expect(assess).toHaveBeenCalledOnce()
    expect(submitted).toEqual({
      status: 'ok',
      value: { completionStatus: 'SCORING_COMPLETE', assessmentRecordRef: 'record:acceptance' },
    })
  })

  it('records the missing production browser and assignment/schedule integration', () => {
    const result = auditAssessmentAcceptance()
    expect(result.blockers.map((item) => item.code)).toEqual([
      'BROWSER_ASSESSMENT_DTO_UNAVAILABLE',
      'ASSIGNMENT_SCHEDULE_ASSESSMENT_LAUNCH_UNWIRED',
      'RUBRIC_FALSE_AUTO_SCORE_GUARD_MISSING',
      'CANONICAL_SCORING_REVIEW_PATH_UNWIRED',
    ])
    expect(result.classification).toBe('BLOCKED')
  })
})

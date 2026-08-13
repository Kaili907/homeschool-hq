import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { createAssessmentWorkflowAdapter } from '../../../src/study/family-pilot/final-app/assessment/workflow'

async function jsonFilesBelow(root: string): Promise<string[]> {
  const files: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) files.push(...await jsonFilesBelow(path))
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(path)
  }
  return files
}

function assessmentPackage(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: '1.0',
    kind: 'canonical-learner-assessment-package',
    assessmentRef: 'ma-g3-mathematics-u01-assessment',
    courseRef: 'ma-g3-mathematics',
    grade: 3,
    subject: 'mathematics',
    location: {
      unitRef: 'ma-g3-mathematics-u01', unitNumber: 1, unitTitle: 'Unit 1',
      courseTitle: 'Grade 3 Mathematics', assessmentLessonRef: 'ma-g3-mathematics-u01-l18',
    },
    instructions: ['Work independently.'],
    learnerTasks: [{ taskRef: 'item-1', kind: 'fixed-response', prompt: 'Compute 2 + 3.' }],
    responseMode: 'fixed-and-work-shown',
    completionScoringAuthorityClass: 'AUTO_SCOREABLE',
    adultScoringAuthorityRef: 'restricted:adult/ma-g3-mathematics-u01-assessment',
    learnerSuccessCriteria: ['Show the requested work.'],
    productionReadiness: { status: 'READY', structuralOnly: false, answerMaterialIncluded: false },
    ...overrides,
  } as any
}

const binding = {
  origin: 'assignment' as const,
  workRef: 'assignment:1',
  learnerRef: 'learner:1',
  assessmentRef: 'ma-g3-mathematics-u01-assessment',
  courseRef: 'ma-g3-mathematics',
  grade: 3,
  subject: 'mathematics' as const,
}

test('all 699 canonical assessment packages parse and pair with restricted adult authorities', async () => {
  const root = join(process.cwd(), 'curriculum-production', 'final', 'assessments')
  const packageFiles = await jsonFilesBelow(join(root, 'packages'))
  const authorityFiles = await jsonFilesBelow(join(root, 'adult-authorities'))
  const packageRefs = new Set<string>()
  const authorityRefs = new Set<string>()
  for (const file of packageFiles) {
    const value = JSON.parse(await readFile(file, 'utf8'))
    expect(value).toMatchObject({ schemaVersion: '1.0', kind: 'canonical-learner-assessment-package' })
    expect(value.productionReadiness).toMatchObject({ status: 'READY', structuralOnly: false, answerMaterialIncluded: false })
    expect(value.learnerTasks.length).toBeGreaterThan(0)
    expect(value.adultScoringAuthorityRef).toMatch(/^restricted:/)
    packageRefs.add(value.assessmentRef)
  }
  for (const file of authorityFiles) {
    const value = JSON.parse(await readFile(file, 'utf8'))
    expect(value).toMatchObject({ schemaVersion: '1.0', kind: 'restricted-adult-assessment-authority' })
    authorityRefs.add(value.assessmentRef)
  }
  expect(packageFiles).toHaveLength(699)
  expect(authorityFiles).toHaveLength(699)
  expect(packageRefs).toEqual(authorityRefs)
})

test('schedule/assignment adapter launch and static scoring return only a minimized result', async () => {
  const pkg = assessmentPackage()
  let launchSequence = 0
  const workflow = createAssessmentWorkflowAdapter({
    catalog: { resolve: async () => pkg, hasRestrictedAuthority: async () => true },
    assessor: {
      assess: async () => ({ status: 'SCORED', assessmentRecordRef: 'assessment-record:opaque' }),
    },
    idFactory: () => `launch:opaque:${++launchSequence}`,
  })
  for (const origin of ['assignment', 'schedule'] as const) {
    const launched = await workflow.launch({ ...binding, origin, workRef: `${origin}:1` })
    expect(launched.status).toBe('ok')
    if (launched.status !== 'ok') continue
    expect(JSON.stringify(launched.value.assessment)).not.toMatch(/answerKey|correctAnswer|answerIndex|adultScoringAuthorityRef|restricted:/i)
    const result = await workflow.submit({
      launchRef: launched.value.launchRef,
      submissionRef: `submission:${origin}`,
      responses: [{ taskRef: 'item-1', value: '5; work shown separately' }],
    })
    expect(result).toEqual({
      status: 'ok',
      value: { completionStatus: 'SCORING_COMPLETE', assessmentRecordRef: 'assessment-record:opaque' },
    })
  }
})

test('negative controls reject answer material and learner guardian self-certification', async () => {
  const leaked = assessmentPackage({ answerKey: { 'item-1': '5' } })
  const leakedWorkflow = createAssessmentWorkflowAdapter({
    catalog: { resolve: async () => leaked, hasRestrictedAuthority: async () => true },
    assessor: { assess: async () => ({ status: 'SCORED' }) },
    idFactory: () => 'launch:leaked',
  })
  await expect(leakedWorkflow.launch(binding)).resolves.toEqual({ status: 'rejected', reason: 'answer-material-exposed' })

  const guardian = assessmentPackage({
    assessmentRef: 'ma-g3-ready-for-life-u01-assessment',
    courseRef: 'ma-g3-ready-for-life',
    subject: 'ready-for-life',
    completionScoringAuthorityClass: 'GUARDIAN_REQUIRED',
  })
  const workflow = createAssessmentWorkflowAdapter({
    catalog: { resolve: async () => guardian, hasRestrictedAuthority: async () => true },
    assessor: { assess: async () => ({ status: 'PENDING_REVIEW' }) },
    guardianCertification: { certify: async () => ({ certificationRef: 'certification:opaque' }) },
    idFactory: () => 'launch:guardian',
  })
  const launched = await workflow.launch({
    ...binding,
    assessmentRef: guardian.assessmentRef,
    courseRef: guardian.courseRef,
    subject: 'ready-for-life',
  })
  if (launched.status !== 'ok') throw new Error('guardian fixture did not launch')
  await workflow.submit({ launchRef: launched.value.launchRef, submissionRef: 'submission:rfl', responses: [{ taskRef: 'item-1', value: 'done' }] })
  await expect(workflow.certifyGuardian({
    launchRef: launched.value.launchRef,
    actor: { kind: 'learner', actorRef: 'learner:1' },
    certifiedAt: '2026-08-13T12:00:00.000Z',
  })).resolves.toEqual({ status: 'rejected', reason: 'guardian-authority-required' })
})

test('the production browser exposes assessment launch from schedule or assignment', async ({ page }) => {
  await page.goto('/family-pilot')
  await page.getByLabel('Student display name').fill('Assessment Browser')
  await page.getByLabel('Nominal grade').selectOption('3')
  await page.getByRole('button', { name: 'Add student' }).click()
  await page.getByRole('button', { name: 'Finish family setup' }).click()
  await page.getByLabel('Parent student').selectOption({ label: 'Assessment Browser' })
  await expect(page.getByRole('button', { name: /start.*assessment|launch.*assessment/i }).first()).toBeVisible()
})

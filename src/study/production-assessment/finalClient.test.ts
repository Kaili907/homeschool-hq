import { describe, expect, it, vi } from 'vitest'
import { loadProductionFinalAssessment } from './finalClient'

describe('release 2.0.0 final assessment client adapter', () => {
  it('loads the source learner package from the exact binding and strips restricted custody', async () => {
    const load = vi.fn(async ({ request }) => ({
      schemaVersion: '1.0',
      kind: 'canonical-learner-assessment-package',
      assessmentRef: request.assessmentRef,
      courseRef: request.courseRef,
      grade: request.grade,
      subject: request.subject,
      location: {
        unitRef: request.unitRef,
        unitNumber: 1,
        unitTitle: 'Earth Systems and Climate',
        courseTitle: 'Earth, Space, and Environmental Science',
        assessmentLessonRef: null,
      },
      instructions: ['Use the source directions.'],
      learnerTasks: [
        {
          taskRef: `${request.assessmentRef}#task-1`,
          kind: 'response',
          prompt: 'Source task',
        },
      ],
      responseMode: 'investigation-data-and-evidence',
      completionScoringAuthorityClass: 'RUBRIC_REQUIRED',
      adultScoringAuthorityRef: 'restricted:source-adult-authority.json',
      learnerSuccessCriteria: ['Use source criteria.'],
      productionReadiness: {
        status: 'READY',
        structuralOnly: false,
        answerMaterialIncluded: false,
      },
    }))
    const projection = await loadProductionFinalAssessment(
      { load },
      {
        assignmentRef: 'assignment-12-science',
        assessmentRef: 'ma-hs12-earth-space-environmental-u01-assessment',
      },
    )
    expect(projection).toMatchObject({
      releaseVersion: '2.0.0',
      assessmentRef: 'ma-hs12-earth-space-environmental-u01-assessment',
      courseRef: 'ma-g12-science',
      unitRef: 'ma-hs12-earth-space-environmental-u01',
      grade: 12,
      subject: 'science',
    })
    expect(projection).not.toHaveProperty('adultScoringAuthorityRef')
    expect(load).toHaveBeenCalledWith({
      request: expect.objectContaining({
        schemaVersion: 1,
        releaseVersion: '2.0.0',
        assignmentRef: 'assignment-12-science',
        assessmentRef: 'ma-hs12-earth-space-environmental-u01-assessment',
        courseRef: 'ma-g12-science',
        unitRef: 'ma-hs12-earth-space-environmental-u01',
        grade: 12,
        subject: 'science',
      }),
      binding: expect.objectContaining({
        packageRef:
          'curriculum-production/final/assessments/packages/grade-12/science/ma-hs12-earth-space-environmental-u01-assessment.json',
      }),
    })
  })

  it('fails closed for an unknown release or mismatched source-package identity', async () => {
    await expect(
      loadProductionFinalAssessment(
        { load: vi.fn() },
        {
          assignmentRef: 'assignment-1',
          assessmentRef: 'ma-g3-mathematics-u01-assessment',
          releaseVersion: '1.0.0',
        },
      ),
    ).rejects.toThrow('production_final_assessment_binding_not_found')

    await expect(
      loadProductionFinalAssessment(
        {
          load: vi.fn(async ({ request }) => ({
            schemaVersion: 1,
            releaseVersion: request.releaseVersion,
            assessmentRef: request.assessmentRef,
            courseRef: request.courseRef,
            unitRef: 'ma-g3-mathematics-u02',
            grade: request.grade,
            subject: request.subject,
            unitNumber: 1,
            unitTitle: 'Unit',
            courseTitle: 'Course',
            assessmentLessonRef: null,
            instructions: ['Directions'],
            learnerTasks: [
              { taskRef: 'task-1', kind: 'text', prompt: 'Prompt' },
            ],
            responseMode: 'written',
            completionScoringAuthorityClass: 'RUBRIC_REQUIRED',
            learnerSuccessCriteria: ['Criteria'],
          })),
        },
        {
          assignmentRef: 'assignment-1',
          assessmentRef: 'ma-g3-mathematics-u01-assessment',
        },
      ),
    ).rejects.toThrow('production_final_assessment_projection_contract')
  })
})

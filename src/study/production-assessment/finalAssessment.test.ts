import { describe, expect, it } from 'vitest'
import {
  PRODUCTION_FINAL_ASSESSMENT_COUNT,
  PRODUCTION_FINAL_ASSESSMENT_SUBJECTS,
  createProductionFinalAssessmentProjectionRequest,
  listProductionFinalAssessmentBindings,
  parseProductionFinalAssessmentProjection,
  resolveProductionFinalAssessmentBinding,
} from './finalAssessment'

describe('release 2.0.0 final assessment bindings', () => {
  const bindings = listProductionFinalAssessmentBindings()

  function countsBy<T extends string | number>(
    values: readonly T[],
  ): Record<string, number> {
    return values.reduce<Record<string, number>>((counts, value) => {
      const key = String(value)
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, {})
  }

  it('materializes the complete admitted 699-reference catalog', () => {
    expect(bindings).toHaveLength(PRODUCTION_FINAL_ASSESSMENT_COUNT)
    expect(new Set(bindings.map((row) => row.assessmentRef)).size).toBe(699)
    expect(countsBy(bindings.map((row) => row.subject))).toEqual({
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
    expect(countsBy(bindings.map((row) => row.grade))).toEqual({
      3: 77,
      4: 77,
      5: 77,
      7: 77,
      8: 79,
      9: 78,
      10: 78,
      11: 78,
      12: 78,
    })
  })

  it('resolves every assessment ref to its exact admitted course, unit, grade, and subject', () => {
    for (const binding of bindings) {
      const resolved = resolveProductionFinalAssessmentBinding(
        binding.assessmentRef,
        '2.0.0',
      )
      expect(resolved).toBe(binding)
      expect(
        createProductionFinalAssessmentProjectionRequest({
          assignmentRef: 'assignment-resolution-check',
          assessmentRef: binding.assessmentRef,
        }),
      ).toMatchObject({
        assessmentRef: binding.assessmentRef,
        courseRef: binding.courseRef,
        unitRef: binding.unitRef,
        grade: binding.grade,
        subject: binding.subject,
      })
    }
  })

  it.each([3, 8, 10, 11, 12])(
    'exercises grade %i across every subject family',
    (grade) => {
      const subjects = new Set(
        bindings.filter((row) => row.grade === grade).map((row) => row.subject),
      )
      expect(subjects).toEqual(new Set(PRODUCTION_FINAL_ASSESSMENT_SUBJECTS))
      for (const subject of PRODUCTION_FINAL_ASSESSMENT_SUBJECTS) {
        const binding = bindings.find(
          (row) => row.grade === grade && row.subject === subject,
        )
        expect(
          resolveProductionFinalAssessmentBinding(binding?.assessmentRef ?? ''),
        ).toBe(binding)
        expect(binding?.courseRef).toBeTruthy()
        expect(binding?.unitRef).toBeTruthy()
      }
    },
  )

  it('preserves the admitted grade 8 checkpoint exception instead of deriving a unit name', () => {
    expect(
      resolveProductionFinalAssessmentBinding(
        'ma-g8-mathematics-c01-assessment',
      ),
    ).toMatchObject({
      courseRef: 'ma-g8-mathematics',
      unitRef: 'ma-g8-mathematics-u01',
      grade: 8,
      subject: 'mathematics',
    })
  })

  it('builds requests only from the admitted binding and rejects a mismatched projection', () => {
    const request = createProductionFinalAssessmentProjectionRequest({
      assignmentRef: 'assignment-1',
      assessmentRef: 'ma-g10-mathematics-u01-assessment',
    })
    expect(request).toMatchObject({
      releaseVersion: '2.0.0',
      courseRef: 'ma-g10-mathematics',
      unitRef: 'ma-g10-mathematics-u01',
      grade: 10,
      subject: 'mathematics',
    })
    const projection = {
      schemaVersion: 1,
      releaseVersion: '2.0.0',
      assessmentRef: request?.assessmentRef,
      courseRef: request?.courseRef,
      unitRef: request?.unitRef,
      grade: request?.grade,
      subject: request?.subject,
      unitNumber: 1,
      unitTitle: 'Geometric Foundations and Constructions',
      courseTitle: 'Geometry',
      assessmentLessonRef: 'ma-g10-mathematics-u01-l16',
      instructions: ['Work independently.'],
      learnerTasks: [
        {
          taskRef: 'ma-g10-mathematics-u01-l16#mc-01',
          kind: 'multiple-choice',
          prompt: 'Source-authored prompt',
          choices: ['A', 'B'],
        },
      ],
      responseMode: 'fixed-and-work-shown',
      completionScoringAuthorityClass: 'AUTO_SCOREABLE',
      learnerSuccessCriteria: ['Provide the requested evidence.'],
    }
    expect(parseProductionFinalAssessmentProjection(projection)).toMatchObject({
      assessmentRef: 'ma-g10-mathematics-u01-assessment',
      courseRef: 'ma-g10-mathematics',
    })
    expect(
      parseProductionFinalAssessmentProjection({ ...projection, grade: 11 }),
    ).toBeNull()
    expect(
      parseProductionFinalAssessmentProjection({
        ...projection,
        adultScoringAuthorityRef: 'restricted:authority.json',
      }),
    ).toBeNull()
  })
})

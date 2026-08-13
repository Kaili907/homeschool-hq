import { describe, expect, it } from 'vitest'
import { evaluateLessonProductionReadiness } from './evaluateLessonProductionReadiness'
import { summarizeProductionGaps } from './summarizeProductionGaps'
import { readyElaLesson, readyMathLesson } from './productionReadinessFixtures.testSupport'

describe('summarizeProductionGaps — multi-lesson course summary', () => {
  it('tallies codes and lesson ids across a whole course', () => {
    const lessonResults = [
      evaluateLessonProductionReadiness(readyMathLesson({ lessonId: 'l1' })),
      evaluateLessonProductionReadiness(
        readyMathLesson({ lessonId: 'l2', independentWork: { present: false } }),
      ),
      evaluateLessonProductionReadiness(
        readyMathLesson({ lessonId: 'l3', remediation: { present: false } }),
      ),
      evaluateLessonProductionReadiness(
        readyElaLesson({ lessonId: 'l4', assessmentAlignment: 'UNKNOWN' }),
      ),
    ]

    const summary = summarizeProductionGaps(lessonResults)

    expect(summary.totalLessons).toBe(4)
    expect(summary.readyCount).toBe(1)
    expect(summary.notReadyCount).toBe(2)
    expect(summary.needsHumanReviewCount).toBe(1)
    expect(summary.codeCounts.MISSING_INDEPENDENT_WORK).toBe(1)
    expect(summary.codeCounts.MISSING_REMEDIATION).toBe(1)
    expect(summary.codeCounts.NEEDS_HUMAN_REVIEW).toBe(1)
    expect(summary.codeCounts.READY).toBe(1)
    expect(summary.lessonsByCode.MISSING_INDEPENDENT_WORK).toEqual(['l2'])
    expect(summary.lessonsByCode.MISSING_REMEDIATION).toEqual(['l3'])
    expect(summary.lessonsByCode.READY).toEqual(['l1'])
  })

  it('returns all-zero counts for an empty result set', () => {
    const summary = summarizeProductionGaps([])
    expect(summary.totalLessons).toBe(0)
    expect(summary.readyCount).toBe(0)
    expect(summary.codeCounts.READY).toBe(0)
    expect(summary.lessonsByCode).toEqual({})
  })
})

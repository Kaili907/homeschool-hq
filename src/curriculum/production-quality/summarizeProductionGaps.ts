import { READINESS_CODES } from './types'
import type { LessonReadinessResult, ProductionGapSummary, ReadinessCode } from './types'

export function summarizeProductionGaps(
  lessonResults: readonly LessonReadinessResult[],
): ProductionGapSummary {
  const codeCounts = Object.fromEntries(
    READINESS_CODES.map((code) => [code, 0]),
  ) as Record<ReadinessCode, number>
  const lessonsByCode: Partial<Record<ReadinessCode, string[]>> = {}

  for (const result of lessonResults) {
    for (const code of result.codes) {
      codeCounts[code] += 1
      const lessonIds = lessonsByCode[code] ?? (lessonsByCode[code] = [])
      lessonIds.push(result.lessonId)
    }
  }

  return {
    totalLessons: lessonResults.length,
    readyCount: lessonResults.filter((result) => result.status === 'READY').length,
    needsHumanReviewCount: lessonResults.filter((result) => result.status === 'NEEDS_HUMAN_REVIEW')
      .length,
    notReadyCount: lessonResults.filter((result) => result.status === 'NOT_READY').length,
    codeCounts,
    lessonsByCode,
  }
}

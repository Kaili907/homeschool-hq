import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateCourseProductionReadiness } from '../../../../src/curriculum/production-quality/index.ts'
import { CORPUS_ROOT, EXPECTED_LESSONS_PER_GRADE, SUPPORTED_GRADES, gradeCounts, loadCorpusEntries, toH3LessonInput } from '../scripts/corpus.mjs'

describe('Ready for Life final production corpus — Gate H3', () => {
  it('admits all 324 canonical lessons as READY', () => {
    const entries = loadCorpusEntries()
    const result = evaluateCourseProductionReadiness({
      courseId: 'manuel-academy-ready-for-life-production-depth-r1',
      title: 'Manuel Academy Ready for Life — production depth R1',
      lessons: entries.map(toH3LessonInput),
    })
    const h3 = {
      inputGateBranch: 'mac/curriculum-production-gate-h3',
      inputGateSha: '49b3c4b86cc7764627bd4cfbd752222849831abf',
      status: result.status,
      totalLessons: result.gapSummary.totalLessons,
      readyCount: result.gapSummary.readyCount,
      needsHumanReviewCount: result.gapSummary.needsHumanReviewCount,
      notReadyCount: result.gapSummary.notReadyCount,
      codeCounts: result.gapSummary.codeCounts,
      nonReadyLessons: result.lessonResults.filter((lesson) => lesson.status !== 'READY'),
    }

    if (process.env.RFL_WRITE_GATE_REPORT === '1') {
      const reportPath = join(CORPUS_ROOT, 'reports/gate-report.json')
      const report = JSON.parse(readFileSync(reportPath, 'utf8'))
      writeFileSync(reportPath, `${JSON.stringify({ ...report, h3 }, null, 2)}\n`)
    } else {
      const recorded = JSON.parse(readFileSync(join(CORPUS_ROOT, 'reports/gate-report.json'), 'utf8'))
      expect(recorded.h3).toEqual(h3)
    }

    expect(entries).toHaveLength(SUPPORTED_GRADES.length * EXPECTED_LESSONS_PER_GRADE)
    expect(gradeCounts(entries)).toEqual(Object.fromEntries(SUPPORTED_GRADES.map((grade) => [String(grade), EXPECTED_LESSONS_PER_GRADE])))
    expect(result.status).toBe('READY')
    expect(result.gapSummary.readyCount).toBe(324)
    expect(result.gapSummary.needsHumanReviewCount).toBe(0)
    expect(result.gapSummary.notReadyCount).toBe(0)
  })
})

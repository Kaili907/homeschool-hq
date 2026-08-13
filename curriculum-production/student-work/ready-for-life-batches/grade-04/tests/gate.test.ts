import { describe, expect, it } from 'vitest'
import { loadCombinedGrade4Corpus } from '../src/loadCorpus.ts'
import { evaluateCorpus } from '../src/gateProjection.ts'

/**
 * Runs the real, shared production-readiness gate (src/curriculum/
 * production-quality, owned elsewhere, imported read-only) against the
 * combined grade-4 corpus: this batch's 34 newly authored lessons plus the
 * 2 already-authored R3 reference lessons. Real gate code, real authored
 * content, no fabricated pass/fail claim. Per this task's instructions,
 * marked for mandatory re-check against Production Gate H3 during final
 * reconciliation, since H3 is moving in parallel and has not evaluated this
 * corpus.
 */
describe('production-quality gate over the combined grade-4 ready-for-life corpus', () => {
  const entries = loadCombinedGrade4Corpus()
  const result = evaluateCorpus(entries)

  it('never returns NOT_READY for any lesson', () => {
    const notReady = result.lessonResults.filter((r) => r.status === 'NOT_READY')
    if (notReady.length > 0) {
      throw new Error(notReady.map((r) => `${r.lessonId}: ${r.codes.join(',')} — ${r.notes.join(' | ')}`).join('\n'))
    }
    expect(notReady).toEqual([])
  })

  it('every lesson has a rubric/scoring-judgment authority (never MISSING_RUBRIC or MISSING_ANSWER_KEY)', () => {
    const codes = result.lessonResults.flatMap((r) => r.codes)
    expect(codes).not.toContain('MISSING_RUBRIC')
    expect(codes).not.toContain('MISSING_ANSWER_KEY')
  })

  it('records an honest gap summary matching the corpus size', () => {
    expect(result.gapSummary.totalLessons).toBe(result.lessonResults.length)
    expect(result.gapSummary.totalLessons).toBe(entries.length)
    expect(result.gapSummary.totalLessons).toBe(36)
  })

  it('the course-level status is READY for every lesson (no lesson needs human review or is not ready)', () => {
    const needsReview = result.lessonResults.filter((r) => r.status === 'NEEDS_HUMAN_REVIEW')
    if (needsReview.length > 0) {
      throw new Error(needsReview.map((r) => `${r.lessonId}: ${r.notes.join(' | ')}`).join('\n'))
    }
    expect(result.status).toBe('READY')
  })
})

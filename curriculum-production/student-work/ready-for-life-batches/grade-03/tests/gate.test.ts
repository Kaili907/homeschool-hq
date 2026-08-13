import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { evaluateCorpus } from '../src/gateProjection.ts'

/**
 * Runs the real, shared production-readiness gate (src/curriculum/
 * production-quality, merged separately from this branch and imported
 * read-only) against this Grade 3 batch's authored corpus, projected
 * through gateProjection.ts. This is the "Run Production Quality Gate"
 * step: real gate code, real authored content, no fabricated pass/fail
 * claim. Result is marked REQUIRES_FINAL_GATE_H3_RECHECK in the README
 * because Gate H3 is moving in parallel and has not evaluated this batch.
 */
describe('production-quality gate over the authored Grade 3 Ready for Life batch', () => {
  const entries = loadCorpus()
  const result = evaluateCorpus(entries)

  it('never returns NOT_READY for any authored lesson', () => {
    const notReady = result.lessonResults.filter((r) => r.status === 'NOT_READY')
    if (notReady.length > 0) {
      throw new Error(notReady.map((r) => `${r.lessonId}: ${r.codes.join(',')} — ${r.notes.join(' | ')}`).join('\n'))
    }
    expect(notReady).toEqual([])
  })

  it('every lesson has a rubric/scoring-judgment authority (never MISSING_RUBRIC)', () => {
    const codes = result.lessonResults.flatMap((r) => r.codes)
    expect(codes).not.toContain('MISSING_RUBRIC')
    expect(codes).not.toContain('MISSING_ANSWER_KEY')
  })

  it('records an honest gap summary matching the actual corpus size', () => {
    expect(result.gapSummary.totalLessons).toBe(result.lessonResults.length)
    expect(result.gapSummary.totalLessons).toBe(entries.length)
    expect(entries.length).toBe(36)
  })

  it('the course-level status is READY for every authored lesson (no lesson needs human review or is not ready)', () => {
    const needsReview = result.lessonResults.filter((r) => r.status === 'NEEDS_HUMAN_REVIEW')
    if (needsReview.length > 0) {
      throw new Error(needsReview.map((r) => `${r.lessonId}: ${r.notes.join(' | ')}`).join('\n'))
    }
    expect(result.status).toBe('READY')
  })
})

import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { evaluateCorpus } from '../src/gateProjection.ts'

/**
 * Runs the real, shared production-readiness gate (src/curriculum/
 * production-quality, owned elsewhere and imported read-only) against this
 * grade-5 corpus, projected through gateProjection.ts. Real gate code, real
 * authored content, no fabricated pass/fail claim.
 */
describe('production-quality gate over the authored grade-05 ready-for-life corpus', () => {
  const entries = loadCorpus()
  const result = evaluateCorpus(entries)

  it('never returns NOT_READY for any authored lesson', () => {
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

  it('records an honest gap summary matching the full 36-lesson corpus', () => {
    expect(result.gapSummary.totalLessons).toBe(36)
    expect(result.gapSummary.totalLessons).toBe(result.lessonResults.length)
    expect(result.gapSummary.totalLessons).toBe(entries.length)
  })

  it('the course-level status is READY — zero NEEDS_HUMAN_REVIEW, zero NOT_READY', () => {
    const needsReview = result.lessonResults.filter((r) => r.status === 'NEEDS_HUMAN_REVIEW')
    if (needsReview.length > 0) {
      throw new Error(needsReview.map((r) => `${r.lessonId}: ${r.notes.join(' | ')}`).join('\n'))
    }
    expect(result.status).toBe('READY')
  })
})

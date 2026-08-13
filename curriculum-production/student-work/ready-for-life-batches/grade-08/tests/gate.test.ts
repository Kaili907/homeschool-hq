import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { evaluateCorpus } from '../src/gateProjection.ts'

/**
 * Runs the real, shared production-readiness gate (src/curriculum/
 * production-quality, merged separately from this branch and imported
 * read-only) against this batch's full 36-lesson authored corpus,
 * projected through gateProjection.ts. Real gate code, real authored
 * content, no fabricated pass/fail claim.
 */
describe('production-quality gate over the Grade 8 Ready for Life production batch', () => {
  const entries = loadCorpus()
  const result = evaluateCorpus(entries)

  it('covers all 36 Grade 8 lessons', () => {
    expect(entries.length).toBe(36)
  })

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

  it('records an honest gap summary rather than a silently green report', () => {
    expect(result.gapSummary.totalLessons).toBe(result.lessonResults.length)
    expect(result.gapSummary.totalLessons).toBe(entries.length)
  })

  it('the course-level status is READY (no lesson needs human review or is not ready)', () => {
    const needsReview = result.lessonResults.filter((r) => r.status === 'NEEDS_HUMAN_REVIEW')
    if (needsReview.length > 0) {
      throw new Error(needsReview.map((r) => `${r.lessonId}: ${r.notes.join(' | ')}`).join('\n'))
    }
    expect(result.status).toBe('READY')
  })
})

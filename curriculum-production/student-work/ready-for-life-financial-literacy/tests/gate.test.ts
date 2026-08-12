import { describe, expect, it } from 'vitest'
import { loadCorpus } from '../src/loadCorpus.ts'
import { evaluateCorpus } from '../src/gateProjection.ts'

/**
 * Runs the real, shared production-readiness gate (src/curriculum/
 * production-quality, merged separately from this branch and imported
 * read-only) against this branch's authored corpus, projected through
 * gateProjection.ts. This is the "Run Production Quality Gate" step: real
 * gate code, real authored content, no fabricated pass/fail claim.
 */
describe('production-quality gate over the authored RFL/FinLit corpus', () => {
  const entries = loadCorpus()
  const { readyForLife, financialLiteracy } = evaluateCorpus(entries)

  it('never returns NOT_READY for either subject', () => {
    for (const result of [readyForLife, financialLiteracy]) {
      const notReady = result.lessonResults.filter((r) => r.status === 'NOT_READY')
      if (notReady.length > 0) {
        // Surface exactly which lessons and codes failed, not just a boolean.
        throw new Error(notReady.map((r) => `${r.lessonId}: ${r.codes.join(',')} — ${r.notes.join(' | ')}`).join('\n'))
      }
      expect(notReady).toEqual([])
    }
  })

  it('every financial-literacy lesson passes with a fixed ANSWER_KEY (never MISSING_ANSWER_KEY)', () => {
    const codes = financialLiteracy.lessonResults.flatMap((r) => r.codes)
    expect(codes).not.toContain('MISSING_ANSWER_KEY')
    expect(codes).not.toContain('MISSING_GUIDED_PRACTICE')
  })

  it('every ready-for-life lesson has a rubric/scoring-judgment authority (never MISSING_RUBRIC)', () => {
    const codes = readyForLife.lessonResults.flatMap((r) => r.codes)
    expect(codes).not.toContain('MISSING_RUBRIC')
  })

  it('records the gap summary so the report is honest about NEEDS_HUMAN_REVIEW, not silently green', () => {
    expect(readyForLife.gapSummary.totalLessons).toBe(readyForLife.lessonResults.length)
    expect(financialLiteracy.gapSummary.totalLessons).toBe(financialLiteracy.lessonResults.length)
  })

  it('both course-level statuses are READY (no lesson needs human review or is not ready)', () => {
    expect(readyForLife.status).toBe('READY')
    expect(financialLiteracy.status).toBe('READY')
  })
})

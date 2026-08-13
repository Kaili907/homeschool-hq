import { describe, expect, it } from 'vitest'
import { buildCorpus } from '../src/build.ts'
import { evaluateCorpus, toLessonProductionInput } from '../src/gateProjection.ts'

/**
 * These assertions run the real, unmodified readiness gate from
 * src/curriculum/production-quality over all 216 projections.
 *
 * The split they pin is a finding, not a defect in the corpus: the gate models
 * every MATH_STRUCTURED_FINLIT lesson as requiring a fixed answer key, so the
 * 36 lessons whose work is genuinely a judgment (dignity, privacy, scam
 * recognition, ethics) are reported NOT_READY for lacking an answer they
 * should not have. Relabelling them ANSWER_KEY would buy a green gate with a
 * claim this corpus cannot verify.
 */
describe('the shared production-readiness gate', () => {
  const entries = buildCorpus()
  const results = evaluateCorpus(entries)

  it('passes every fixed-answer lesson with no notes', () => {
    const lessons = results.flatMap((result) => result.lessonResults)
    const ready = lessons.filter((lesson) => lesson.status === 'READY')
    expect(ready).toHaveLength(180)
    expect(ready.every((lesson) => lesson.notes.length === 0)).toBe(true)
  })

  it('reports exactly the 36 judgment lessons as missing an answer key, and nothing else', () => {
    const notReady = results.flatMap((result) => result.lessonResults).filter((lesson) => lesson.status !== 'READY')
    expect(notReady).toHaveLength(36)
    for (const lesson of notReady) {
      expect(lesson.codes).toEqual(['MISSING_ANSWER_KEY'])
    }
    const judgmentIds = entries
      .filter((entry) => entry.scoring.scoringAuthority.kind === 'RUBRIC')
      .map((entry) => entry.pkg.lessonRef.lessonId)
      .sort()
    expect(notReady.map((lesson) => lesson.lessonId).sort()).toEqual(judgmentIds)
  })

  it('never flags authored content as generic or insufficiently specific', () => {
    const notes = results.flatMap((result) => result.lessonResults).flatMap((lesson) => lesson.notes)
    expect(notes.filter((note) => note.includes('insufficiently specific'))).toEqual([])
    expect(notes.filter((note) => note.includes('MISSING_REMEDIATION') || note.includes('MISSING_EXTENSION'))).toEqual([])
  })

  it('projects the authored scoring authority as authored, never upgraded to pass', () => {
    for (const entry of entries) {
      expect(toLessonProductionInput(entry).scoringAuthority?.kind).toBe(entry.scoring.scoringAuthority.kind)
    }
  })
})

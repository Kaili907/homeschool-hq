import { describe, expect, it } from 'vitest'
import type { StudyCalendarEntry } from '../../../types'
import { getAssignments } from './catalog'
import { loadFinancialLiteracyCatalog } from './source.node'
import { completionEvidenceFromEntry, parentLessonSummary } from './progressMetadata'

const catalog = loadFinancialLiteracyCatalog()
const lesson = getAssignments(catalog, { studentRef: 'stu-1', grade: '8' })[0]

function fakeEntry(overrides: Partial<StudyCalendarEntry>): StudyCalendarEntry {
  return {
    lessonRef: lesson.lessonId,
    learnerRef: 'learner-a',
    state: 'active',
    scheduledStart: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as StudyCalendarEntry
}

describe('FAMILY-PILOT-FINLIT-1 progressMetadata (parent visibility + presence vs. evidence)', () => {
  it('builds a parent-visible summary from catalog presence', () => {
    const summary = parentLessonSummary(catalog, lesson.lessonId)
    expect(summary?.lessonRef).toBe(lesson.lessonId)
    expect(summary?.title).toBe(lesson.title)
    expect(summary?.grade).toBe('8')
    expect(summary?.unitTitle.length).toBeGreaterThan(0)
  })

  it('returns null for an unknown lesson ref, never a guessed summary', () => {
    expect(parentLessonSummary(catalog, 'does-not-exist')).toBeNull()
  })

  it('never derives completion evidence from a non-completed entry (no auto-credit)', () => {
    for (const state of ['scheduled', 'active', 'paused'] as const) {
      expect(completionEvidenceFromEntry(fakeEntry({ state }))).toBeNull()
    }
  })

  it('derives completion evidence only from an actually completed entry', () => {
    const evidence = completionEvidenceFromEntry(fakeEntry({ state: 'completed' }))
    expect(evidence).toEqual({ learnerRef: 'learner-a', lessonRef: lesson.lessonId, completedAt: '2026-01-01T00:00:00.000Z' })
  })

  it('scopes completion evidence to the entry’s own learner and never conflates two students (student isolation)', () => {
    const evidenceA = completionEvidenceFromEntry(fakeEntry({ state: 'completed', learnerRef: 'learner-a' }))
    const evidenceB = completionEvidenceFromEntry(fakeEntry({ state: 'completed', learnerRef: 'learner-b' }))
    expect(evidenceA?.learnerRef).toBe('learner-a')
    expect(evidenceB?.learnerRef).toBe('learner-b')
    expect(evidenceA?.learnerRef).not.toBe(evidenceB?.learnerRef)
  })

  it('lesson presence alone (parentLessonSummary) never implies completion evidence exists', () => {
    // Presence has no state field at all — it cannot represent completion,
    // so a caller cannot mistake "imported" for "done."
    const summary = parentLessonSummary(catalog, lesson.lessonId)
    expect(summary && 'state' in summary).toBe(false)
    expect(summary && 'completedAt' in summary).toBe(false)
  })
})

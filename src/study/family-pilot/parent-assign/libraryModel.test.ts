import { describe, expect, it } from 'vitest'
import {
  assessmentCandidateStatus,
  lessonCandidateStatus,
  matchesManualLibrarySearch,
} from './libraryModel'

describe('manual assignment library candidate status', () => {
  it('projects exact lesson lifecycle states and never treats completed work as assignable again', () => {
    const assignments = [
      { assignmentRef: 'assignment:planned', lessonRef: 'lesson:planned', state: 'planned' as const },
      { assignmentRef: 'assignment:active', lessonRef: 'lesson:active', state: 'active' as const },
      { assignmentRef: 'assignment:done', lessonRef: 'lesson:done', state: 'completed' as const },
    ]
    expect(lessonCandidateStatus({ lessonRef: 'lesson:new', assignments })).toBeNull()
    expect(lessonCandidateStatus({ lessonRef: 'lesson:planned', assignments })?.status).toBe('assigned')
    expect(lessonCandidateStatus({ lessonRef: 'lesson:active', assignments })?.status).toBe('current')
    expect(lessonCandidateStatus({ lessonRef: 'lesson:done', assignments })?.status).toBe('completed')
  })

  it('gives authoritative blocked and waiting state precedence over the core lifecycle', () => {
    const assignments = [
      { assignmentRef: 'assignment:blocked', lessonRef: 'lesson:blocked', state: 'active' as const },
      { assignmentRef: 'assignment:waiting', lessonRef: 'lesson:waiting', state: 'active' as const },
    ]
    expect(lessonCandidateStatus({
      lessonRef: 'lesson:blocked', assignments,
      blockedAssignmentRefs: new Set(['assignment:blocked']),
    })?.status).toBe('blocked')
    expect(lessonCandidateStatus({
      lessonRef: 'lesson:waiting', assignments,
      waitingAssignmentRefs: new Set(['assignment:waiting']),
    })?.status).toBe('waiting')
  })

  it('projects assessment assigned, current, waiting, completed, and blocked states', () => {
    const assignments = [
      { assignmentRef: 'assessment:a', assessmentRef: 'a', status: 'PLANNED' as const },
      { assignmentRef: 'assessment:b', assessmentRef: 'b', status: 'ACTIVE' as const },
      { assignmentRef: 'assessment:c', assessmentRef: 'c', status: 'PENDING_ASSESSMENT' as const },
      { assignmentRef: 'assessment:d', assessmentRef: 'd', status: 'CERTIFIED' as const },
      { assignmentRef: 'assessment:e', assessmentRef: 'e', status: 'PLANNED' as const },
    ]
    expect(assessmentCandidateStatus({ assessmentRef: 'a', assignments })?.status).toBe('assigned')
    expect(assessmentCandidateStatus({ assessmentRef: 'b', assignments })?.status).toBe('current')
    expect(assessmentCandidateStatus({ assessmentRef: 'c', assignments })?.status).toBe('waiting')
    expect(assessmentCandidateStatus({ assessmentRef: 'd', assignments })?.status).toBe('completed')
    expect(assessmentCandidateStatus({ assessmentRef: 'e', assignments, blockedAssignmentRefs: new Set(['assessment:e']) })?.status).toBe('blocked')
  })
})

describe('manual assignment library canonical search', () => {
  const fields = {
    title: 'Compare Fractions with Unlike Denominators',
    unitTitle: 'Fraction Operations',
    subjectTitle: 'Mathematics',
    unitNumber: 3,
    lessonNumber: 4,
  }

  it.each(['fractions', 'fraction operations', 'mathematics', 'unit 3', 'lesson 4', 'MATH fractions'])(
    'matches canonical title, unit, subject, and ordinal search: %s',
    (query) => expect(matchesManualLibrarySearch(query, fields)).toBe(true),
  )

  it('does not match metadata that the catalog did not supply', () => {
    expect(matchesManualLibrarySearch('advanced honors', fields)).toBe(false)
  })
})

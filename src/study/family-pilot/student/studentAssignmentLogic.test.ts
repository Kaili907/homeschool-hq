import { describe, expect, it } from 'vitest'
import {
  assignmentStatusLabel,
  resolveCurrentSegment,
  resolvePrimaryAction,
  resolveSegmentProgress,
} from './studentAssignmentLogic'
import type { StudentAssignment } from './types'

function assignment(overrides: Partial<StudentAssignment> = {}): StudentAssignment {
  return {
    assignmentRef: 'assignment-1',
    title: 'Fractions review',
    status: 'NOT_STARTED',
    segments: [
      { segmentRef: 'seg-1', title: 'Warm-up' },
      { segmentRef: 'seg-2', title: 'Guided practice' },
      { segmentRef: 'seg-3', title: 'Independent practice' },
    ],
    ...overrides,
  }
}

describe('assignmentStatusLabel', () => {
  it('renders a human label for each status', () => {
    expect(assignmentStatusLabel('NOT_STARTED')).toBe('Not started')
    expect(assignmentStatusLabel('IN_PROGRESS')).toBe('In progress')
    expect(assignmentStatusLabel('COMPLETED')).toBe('Completed')
  })
})

describe('resolveCurrentSegment', () => {
  it('prefers an explicit currentSegmentRef when it matches a real segment', () => {
    const segment = resolveCurrentSegment(assignment({ currentSegmentRef: 'seg-2' }))
    expect(segment?.segmentRef).toBe('seg-2')
  })

  it('falls back to the first incomplete segment when currentSegmentRef is absent', () => {
    const segment = resolveCurrentSegment(assignment({ completedSegmentRefs: ['seg-1'] }))
    expect(segment?.segmentRef).toBe('seg-2')
  })

  it('ignores a stale currentSegmentRef that no longer exists on the assignment', () => {
    const segment = resolveCurrentSegment(
      assignment({ currentSegmentRef: 'seg-does-not-exist', completedSegmentRefs: ['seg-1'] }),
    )
    expect(segment?.segmentRef).toBe('seg-2')
  })

  it('returns null once every segment is complete', () => {
    const segment = resolveCurrentSegment(
      assignment({ completedSegmentRefs: ['seg-1', 'seg-2', 'seg-3'] }),
    )
    expect(segment).toBeNull()
  })

  it('returns null for an assignment with no segments', () => {
    const segment = resolveCurrentSegment(assignment({ segments: [] }))
    expect(segment).toBeNull()
  })
})

describe('resolveSegmentProgress', () => {
  it('counts completed segments against the total', () => {
    expect(resolveSegmentProgress(assignment({ completedSegmentRefs: ['seg-1'] }))).toEqual({
      completed: 1,
      total: 3,
    })
  })

  it('treats a missing completedSegmentRefs as zero progress', () => {
    expect(resolveSegmentProgress(assignment())).toEqual({ completed: 0, total: 3 })
  })
})

describe('resolvePrimaryAction', () => {
  it('is "start" for NOT_STARTED assignments', () => {
    expect(resolvePrimaryAction(assignment({ status: 'NOT_STARTED' }))).toBe('start')
  })

  it('is "resume" for IN_PROGRESS assignments regardless of session state', () => {
    expect(resolvePrimaryAction(assignment({ status: 'IN_PROGRESS', sessionState: 'paused' }))).toBe('resume')
    expect(resolvePrimaryAction(assignment({ status: 'IN_PROGRESS', sessionState: 'active' }))).toBe('resume')
  })

  it('is "none" for COMPLETED assignments', () => {
    expect(resolvePrimaryAction(assignment({ status: 'COMPLETED' }))).toBe('none')
  })
})

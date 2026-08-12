import type { AssignmentStatus, StudentAssignment, StudentSegment } from './types'

export function assignmentStatusLabel(status: AssignmentStatus): string {
  switch (status) {
    case 'NOT_STARTED':
      return 'Not started'
    case 'IN_PROGRESS':
      return 'In progress'
    case 'COMPLETED':
      return 'Completed'
  }
}

export function resolveCurrentSegment(assignment: StudentAssignment): StudentSegment | null {
  const completed = assignment.completedSegmentRefs ?? []
  if (assignment.currentSegmentRef) {
    const bySegmentRef = assignment.segments.find((segment) => segment.segmentRef === assignment.currentSegmentRef)
    if (bySegmentRef) return bySegmentRef
  }
  return assignment.segments.find((segment) => !completed.includes(segment.segmentRef)) ?? null
}

export function resolveSegmentProgress(assignment: StudentAssignment): { completed: number; total: number } {
  const completed = assignment.completedSegmentRefs ?? []
  return {
    completed: assignment.segments.filter((segment) => completed.includes(segment.segmentRef)).length,
    total: assignment.segments.length,
  }
}

export type AssignmentPrimaryAction = 'start' | 'resume' | 'none'

export function resolvePrimaryAction(assignment: StudentAssignment): AssignmentPrimaryAction {
  if (assignment.status === 'NOT_STARTED') return 'start'
  if (assignment.status === 'IN_PROGRESS') return 'resume'
  return 'none'
}

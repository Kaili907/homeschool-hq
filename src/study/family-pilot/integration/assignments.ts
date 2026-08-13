import type { HostLessonDescriptor } from '../../curriculumAdapter'
import type {
  FamilyPilotAssignmentRecordV1,
  FamilyPilotAssignmentState,
  FamilyPilotStudentRecordV1,
} from '../core/schema'
import type { AssignmentStatus, StudentAssignment, StudentSegment } from '../student/types'
import { lessonSegments } from './curriculum'

// FAMILY-PILOT-INTEGRATION: Core records -> the Student Experience view.
//
// Core persists the durable facts (which lesson, which segments are done,
// paused or not). The Student Experience renders a different vocabulary
// (NOT_STARTED / IN_PROGRESS / COMPLETED plus a session state). This file is
// the single mapping between them, so the student surface can never disagree
// with what was persisted.
//
// Segment TITLES are not persisted by Core — deliberately, since they are
// derivable — so they are recomputed from the lesson descriptor here. That
// keeps one source of truth for what a lesson's steps are called.

/** Core state -> the status the student surface renders. */
export function toAssignmentStatus(state: FamilyPilotAssignmentState): AssignmentStatus {
  switch (state) {
    case 'completed':
      return 'COMPLETED'
    case 'active':
    case 'paused':
      return 'IN_PROGRESS'
    case 'planned':
    case 'abandoned':
      // An abandoned assignment is offered again as fresh work rather than
      // being shown as in-progress work the student cannot actually resume.
      return 'NOT_STARTED'
  }
}

function toSegments(lesson: HostLessonDescriptor | undefined): readonly StudentSegment[] {
  if (!lesson) return []
  try {
    return lessonSegments(lesson).map((segment) => ({
      segmentRef: segment.segmentRef,
      title: segment.title,
      estimatedMinutes: segment.estimatedMinutes,
    }))
  } catch {
    // A descriptor the Study adapter refuses must not blank the whole list.
    return []
  }
}

/**
 * One Core record -> one Student Experience assignment.
 *
 * `currentSegmentRef` prefers the resume point Core recorded at pause time, so
 * a student who comes back after a break lands exactly where they stopped
 * rather than at the first unfinished step.
 */
export function toStudentAssignment(
  record: FamilyPilotAssignmentRecordV1,
  lesson: HostLessonDescriptor | undefined,
): StudentAssignment {
  const status = toAssignmentStatus(record.state)
  const segments = toSegments(lesson)
  const completedSegmentRefs = record.progress.completedSegmentRefs
  const currentSegmentRef = record.pause.resumeSegmentRef ??
    record.progress.lastSegmentRef ??
    segments.find((segment) => !completedSegmentRefs.includes(segment.segmentRef))?.segmentRef ??
    null
  return {
    assignmentRef: record.assignmentRef,
    title: record.title,
    subject: record.subject,
    status,
    ...(status === 'IN_PROGRESS'
      ? { sessionState: record.state === 'paused' ? ('paused' as const) : ('active' as const) }
      : {}),
    segments,
    currentSegmentRef,
    completedSegmentRefs,
    awaitingAdultAttestation:
      record.completion.status === 'PENDING_GUARDIAN_ATTESTATION',
  }
}

/**
 * A student's whole assignment list.
 *
 * The caller passes ONE student's record. There is no variant of this function
 * that takes the full state and a ref, because that shape is what makes it easy
 * to hand the wrong student's assignments to a rendered surface.
 */
export function toStudentAssignments(
  student: FamilyPilotStudentRecordV1,
  lessonsByRef: ReadonlyMap<string, HostLessonDescriptor>,
): readonly StudentAssignment[] {
  return student.assignments.map((record) =>
    toStudentAssignment(record, lessonsByRef.get(record.lessonRef)))
}

import type { FamilyPilotCatalog, PilotLessonRef } from '../../../curriculum/family-pilot/types'
import type { AcademySubject } from '../../../types'
import {
  addFamilyPilotAssignment,
  completeFamilyPilotAssignment,
  createFamilyPilotStudent,
  findFamilyPilotStudent,
  type FamilyPilotStateV1,
} from '../core'
import { effectivePilotGrade, pilotAssignmentRef, type PilotAssignmentStudentConfig } from './types'

// FAMILY-PILOT-ASSIGN-1 — turns the catalog into a course a student actually
// progresses through. This module owns NO persistence of its own: it reads
// FamilyPilotStateV1 and only ever writes to it through the existing core
// operations, so an assignment plan is nothing more than "the right core
// records, created in the right order." Segment content stays with the Study
// runtime; a plan carries lessonRef/title only, never lesson content.

function courseFor(
  catalog: FamilyPilotCatalog,
  config: PilotAssignmentStudentConfig,
  subject: AcademySubject,
) {
  const grade = effectivePilotGrade(config, subject)
  return catalog.courses.find((course) => course.subject === subject && course.grade === grade)
}

/**
 * The next lesson this student should work on in `subject`, in course order.
 * An assignment that is not yet completed or abandoned IS the next thing to
 * do (resume, not a new copy). Otherwise this walks past every completed OR
 * abandoned lesson and returns the first one that's neither — deterministic
 * regardless of how many lessons have been resolved so far, and never stalls
 * a subject just because one lesson was abandoned rather than finished.
 * undefined when the catalog has no matching course, or every lesson in it
 * is already resolved.
 */
export function getNextAssignment(
  catalog: FamilyPilotCatalog,
  config: PilotAssignmentStudentConfig,
  state: FamilyPilotStateV1,
  subject: AcademySubject,
): PilotLessonRef | undefined {
  const course = courseFor(catalog, config, subject)
  if (!course) return undefined
  const subjectAssignments = findFamilyPilotStudent(state, config.studentRef)?.assignments.filter(
    (assignment) => assignment.subject === subject,
  ) ?? []
  const open = subjectAssignments.find(
    (assignment) => assignment.state !== 'completed' && assignment.state !== 'abandoned',
  )
  if (open) return course.lessons.find((lesson) => lesson.lessonId === open.lessonRef)
  const resolvedLessonRefs = new Set(
    subjectAssignments
      .filter((assignment) => assignment.state === 'completed' || assignment.state === 'abandoned')
      .map((a) => a.lessonRef),
  )
  return course.lessons.find((lesson) => !resolvedLessonRefs.has(lesson.lessonId))
}

/** Creates the next-assignment record for `subject` if one doesn't already
 * exist. A no-op when the student already has an open assignment there, or
 * the catalog has nothing left (or nothing at all) to assign. */
function ensureSubjectAssignment(
  catalog: FamilyPilotCatalog,
  config: PilotAssignmentStudentConfig,
  subject: AcademySubject,
  state: FamilyPilotStateV1,
  now: string,
): FamilyPilotStateV1 {
  const lesson = getNextAssignment(catalog, config, state, subject)
  if (!lesson) return state
  return addFamilyPilotAssignment(
    state,
    config.studentRef,
    {
      assignmentRef: pilotAssignmentRef(config.studentRef, lesson.lessonId),
      lessonRef: lesson.lessonId,
      subject,
      title: lesson.title,
      totalSegments: 0,
    },
    now,
  )
}

/**
 * Registers the student (if new) and ensures every enabled subject has its
 * next assignment in place — resuming whatever is already in flight rather
 * than assigning a second copy. Safe to call repeatedly with the same
 * config; each call only ever advances state that has since completed.
 */
export function createPilotAssignmentPlan(
  catalog: FamilyPilotCatalog,
  config: PilotAssignmentStudentConfig,
  state: FamilyPilotStateV1,
  now: string,
): FamilyPilotStateV1 {
  let next = createFamilyPilotStudent(
    state,
    { studentRef: config.studentRef, displayName: config.displayName ?? config.studentRef },
    now,
  )
  for (const subject of config.enabledSubjects) {
    next = ensureSubjectAssignment(catalog, config, subject, next, now)
  }
  return next
}

/**
 * Marks an assignment complete and, if its course has a next lesson, assigns
 * it immediately — "completion advances." An unknown assignmentRef is a
 * no-op, same contract as the core operations this wraps.
 */
export function markAssignmentCompleted(
  catalog: FamilyPilotCatalog,
  config: PilotAssignmentStudentConfig,
  state: FamilyPilotStateV1,
  assignmentRef: string,
  now: string,
): FamilyPilotStateV1 {
  const assignment = findFamilyPilotStudent(state, config.studentRef)?.assignments.find(
    (item) => item.assignmentRef === assignmentRef,
  )
  if (!assignment) return state
  const completed = completeFamilyPilotAssignment(state, config.studentRef, assignmentRef, now)
  return ensureSubjectAssignment(catalog, config, assignment.subject as AcademySubject, completed, now)
}

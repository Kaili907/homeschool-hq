import type {
  BlockingReadinessCode,
  GradeLevel,
  NonBlockingReadinessNote,
  ReadinessCapabilityPorts,
  StudentConfiguration,
  SubjectId,
  SubjectReadinessResult,
} from './types'

function isValidGrade(grade: GradeLevel | undefined): grade is GradeLevel {
  return typeof grade === 'number' && Number.isInteger(grade) && grade > 0
}

/**
 * Evaluates one enabled subject for one student against injected capability
 * ports. Never normalizes the requested working grade — if a configured
 * grade has no course, that surfaces as a concrete CONTENT_GAP rather than
 * being rounded to a nearby supported grade.
 *
 * Checks run in precedence order (see BlockingReadinessCode) and stop at the
 * first failure: a downstream capability can't be meaningfully evaluated
 * once an upstream one has already failed.
 */
export function evaluateSubjectReadiness(
  student: StudentConfiguration,
  subject: SubjectId,
  capabilities: ReadinessCapabilityPorts,
): SubjectReadinessResult {
  const requestedWorkingGrade = student.workingGradeBySubject[subject]

  const blocked = (status: BlockingReadinessCode, detail: string): SubjectReadinessResult => ({
    studentRef: student.studentRef,
    subject,
    requestedWorkingGrade,
    status,
    blocking: true,
    notes: [],
    detail,
  })

  const who = `${student.displayName} (${student.studentRef})`

  if (!isValidGrade(requestedWorkingGrade)) {
    return blocked(
      'INVALID_CONFIGURATION',
      `${who} has ${subject} enabled but no valid working grade configured.`,
    )
  }

  if (!capabilities.catalog.isAvailable()) {
    return blocked('CATALOG_UNAVAILABLE', `Catalog is unavailable; cannot resolve ${subject} for ${who}.`)
  }

  if (!capabilities.catalog.hasCourse(subject, requestedWorkingGrade)) {
    return blocked(
      'CONTENT_GAP',
      `No ${subject} course exists for grade ${requestedWorkingGrade} (requested by ${who}).`,
    )
  }

  if (!capabilities.study.isAvailable(subject, requestedWorkingGrade)) {
    return blocked(
      'STUDY_UNAVAILABLE',
      `Study is unavailable for ${subject} at grade ${requestedWorkingGrade} for ${who}.`,
    )
  }

  if (!capabilities.assignment.isAvailable(subject, requestedWorkingGrade)) {
    return blocked(
      'ASSIGNMENT_UNAVAILABLE',
      `No assignment/schedule path exists for ${subject} at grade ${requestedWorkingGrade} for ${who}.`,
    )
  }

  if (!capabilities.persistence.isAvailable(student.studentRef, subject)) {
    return blocked(
      'PERSISTENCE_UNAVAILABLE',
      `Durable save/resume is unavailable for ${subject} for ${who}.`,
    )
  }

  if (!capabilities.safety.isAvailable(student.studentRef, subject, requestedWorkingGrade)) {
    return blocked(
      'SAFETY_UNAVAILABLE',
      `No safe completion path exists for ${subject} at grade ${requestedWorkingGrade} for ${who}.`,
    )
  }

  const tutorAvailable = capabilities.tutor.isTutorAvailable(subject, requestedWorkingGrade)
  const staticHelpAvailable = capabilities.tutor.isStaticHelpAvailable(subject, requestedWorkingGrade)
  const notes: NonBlockingReadinessNote[] = []
  if (!tutorAvailable) {
    notes.push('TUTOR_UNAVAILABLE_BUT_NONBLOCKING')
    notes.push(staticHelpAvailable ? 'STATIC_HELP_AVAILABLE' : 'TUTOR_AND_STATIC_HELP_UNAVAILABLE')
  }

  return {
    studentRef: student.studentRef,
    subject,
    requestedWorkingGrade,
    status: 'READY',
    blocking: false,
    notes,
    detail: `${subject} at grade ${requestedWorkingGrade} is ready for ${who}.`,
  }
}

import { evaluateSubjectReadiness } from './evaluateSubjectReadiness'
import type { ReadinessCapabilityPorts, StudentConfiguration, StudentReadinessResult } from './types'

/**
 * Evaluates every enabled subject for one student. Subjects not in
 * `enabledSubjects` are skipped entirely — even if a working grade happens
 * to be configured for them — so a disabled subject never contributes a gap.
 */
export function evaluateStudentReadiness(
  student: StudentConfiguration,
  capabilities: ReadinessCapabilityPorts,
): StudentReadinessResult {
  const subjects = student.enabledSubjects.map((subject) =>
    evaluateSubjectReadiness(student, subject, capabilities),
  )
  const blockingSubjects = subjects.filter((subject) => subject.blocking)

  return {
    studentRef: student.studentRef,
    displayName: student.displayName,
    subjects,
    ready: blockingSubjects.length === 0,
    blockingSubjects,
  }
}

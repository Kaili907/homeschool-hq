import type { AcademyGrade, AcademySubject, WorkingLevels } from '../../../types'

/**
 * FAMILY-PILOT-ASSIGN-1 — one student's assignment configuration. No family
 * names live here; `studentRef` is the same opaque device-local ref the
 * pilot core keys its records on.
 */
export interface PilotAssignmentStudentConfig {
  readonly studentRef: string
  /** Only used the first time this student is planned for, to seed the
   * core record. Falls back to `studentRef` when omitted. */
  readonly displayName?: string
  readonly nominalGrade: AcademyGrade
  /** A subject rides the nominal grade when it has no entry here — same
   * override shape as the existing academy WorkingLevels. */
  readonly workingGradeBySubject?: WorkingLevels
  readonly enabledSubjects: readonly AcademySubject[]
}

/** The grade a subject's content is actually drawn from for this student. */
export function effectivePilotGrade(
  config: PilotAssignmentStudentConfig,
  subject: AcademySubject,
): AcademyGrade {
  return config.workingGradeBySubject?.[subject] ?? config.nominalGrade
}

/**
 * Deterministic assignment identity: the same student assigned the same
 * catalog lesson always produces the same ref, so re-planning is idempotent
 * (core/operations.addFamilyPilotAssignment already no-ops on a duplicate ref).
 */
export function pilotAssignmentRef(studentRef: string, lessonRef: string): string {
  return `${studentRef}:${lessonRef}`
}

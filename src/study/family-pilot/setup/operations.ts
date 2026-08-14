import { ACADEMY_GRADES, ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject, type Grade } from '../../../types'
import { generateStudentRef, isValidStudentRef } from './identifiers'
import type {
  FamilySetupMutationResult,
  FamilySetupRemovalContext,
  FamilySetupState,
  FamilySetupStudent,
  FamilySetupStudentRef,
  FamilySetupValidationIssue,
  FamilySetupValidationResult,
} from './types'

/** Bounds the local roster to a size a single family setup screen can reasonably hold. */
export const MAX_STUDENTS = 24

const VALID_GRADES: readonly Grade[] = ['3', '4', '5', '6', '7', '8', '9', '10', '11', '12']
const VALID_ACADEMY_GRADES: readonly AcademyGrade[] = ACADEMY_GRADES

function isValidGrade(value: unknown): value is Grade {
  return typeof value === 'string' && (VALID_GRADES as readonly string[]).includes(value)
}

function isValidAcademyGrade(value: unknown): value is AcademyGrade {
  return typeof value === 'string' && (VALID_ACADEMY_GRADES as readonly string[]).includes(value)
}

function isAcademySubject(value: unknown): value is AcademySubject {
  return typeof value === 'string' && (ACADEMY_SUBJECTS as readonly string[]).includes(value)
}

function isNonEmptyTrimmed(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function dedupeSubjects(subjects: readonly AcademySubject[]): AcademySubject[] {
  return Array.from(new Set(subjects))
}

function findStudent(state: FamilySetupState, studentRef: FamilySetupStudentRef): FamilySetupStudent | undefined {
  return state.students.find((student) => student.studentRef === studentRef)
}

function replaceStudent(
  students: readonly FamilySetupStudent[],
  updated: FamilySetupStudent,
): readonly FamilySetupStudent[] {
  return students.map((student) => (student.studentRef === updated.studentRef ? updated : student))
}

function withStudents(state: FamilySetupState, students: readonly FamilySetupStudent[]): FamilySetupState {
  return Object.freeze({ ...state, students: Object.freeze(students) })
}

export interface CreateFamilySetupStudentInput {
  readonly displayName: string
  readonly nominalGrade: Grade
  readonly enabledSubjects: readonly AcademySubject[]
  /** Supply to reuse a caller-generated ref; otherwise one is generated. */
  readonly studentRef?: FamilySetupStudentRef
}

export function createStudent(
  state: FamilySetupState,
  input: CreateFamilySetupStudentInput,
  now: string,
  idSource?: () => string,
): FamilySetupMutationResult {
  if (!isNonEmptyTrimmed(input.displayName)) {
    return { status: 'blocked', reason: 'invalid-display-name' }
  }
  if (!isValidGrade(input.nominalGrade)) {
    return { status: 'blocked', reason: 'invalid-nominal-grade' }
  }

  const enabledSubjects = dedupeSubjects(input.enabledSubjects)
  if (enabledSubjects.length === 0) {
    return { status: 'blocked', reason: 'no-enabled-subjects' }
  }
  if (!enabledSubjects.every(isAcademySubject)) {
    return { status: 'blocked', reason: 'invalid-subject' }
  }
  if (state.students.length >= MAX_STUDENTS) {
    return { status: 'blocked', reason: 'max-students-reached' }
  }

  const studentRef = input.studentRef ?? generateStudentRef(idSource)
  if (!isValidStudentRef(studentRef)) {
    return { status: 'blocked', reason: 'invalid-student-ref' }
  }
  if (findStudent(state, studentRef)) {
    return { status: 'blocked', reason: 'duplicate-ref', studentRef }
  }

  const student: FamilySetupStudent = Object.freeze({
    studentRef,
    displayName: input.displayName.trim(),
    nominalGrade: input.nominalGrade,
    workingGradeBySubject: Object.freeze({}),
    enabledSubjects: Object.freeze(enabledSubjects),
    pinRequired: false,
    createdAt: now,
    updatedAt: now,
  })

  return { status: 'ok', state: withStudents(state, [...state.students, student]) }
}

export interface UpdateFamilySetupStudentPatch {
  readonly displayName?: string
  readonly nominalGrade?: Grade
  readonly enabledSubjects?: readonly AcademySubject[]
}

/** Edits profile metadata. studentRef and pinRequired are untouched; disabling a
 * subject also removes its now-inapplicable working-grade override. */
export function updateStudent(
  state: FamilySetupState,
  studentRef: FamilySetupStudentRef,
  patch: UpdateFamilySetupStudentPatch,
  now: string,
): FamilySetupMutationResult {
  const existing = findStudent(state, studentRef)
  if (!existing) {
    return { status: 'blocked', reason: 'student-not-found', studentRef }
  }

  let displayName = existing.displayName
  if (patch.displayName !== undefined) {
    if (!isNonEmptyTrimmed(patch.displayName)) {
      return { status: 'blocked', reason: 'invalid-display-name', studentRef }
    }
    displayName = patch.displayName.trim()
  }

  let nominalGrade = existing.nominalGrade
  if (patch.nominalGrade !== undefined) {
    if (!isValidGrade(patch.nominalGrade)) {
      return { status: 'blocked', reason: 'invalid-nominal-grade', studentRef }
    }
    nominalGrade = patch.nominalGrade
  }

  let enabledSubjects = existing.enabledSubjects
  if (patch.enabledSubjects !== undefined) {
    const deduped = dedupeSubjects(patch.enabledSubjects)
    if (deduped.length === 0) {
      return { status: 'blocked', reason: 'no-enabled-subjects', studentRef }
    }
    if (!deduped.every(isAcademySubject)) {
      return { status: 'blocked', reason: 'invalid-subject', studentRef }
    }
    enabledSubjects = Object.freeze(deduped)
  }

  const updated: FamilySetupStudent = Object.freeze({
    ...existing,
    displayName,
    nominalGrade,
    enabledSubjects,
    workingGradeBySubject: Object.freeze(
      Object.fromEntries(
        Object.entries(existing.workingGradeBySubject).filter(([subject]) =>
          enabledSubjects.includes(subject as AcademySubject),
        ),
      ),
    ),
    updatedAt: now,
  })

  return { status: 'ok', state: withStudents(state, replaceStudent(state.students, updated)) }
}

/**
 * Removes a student. If `context.hasProgress` is true and the host hasn't
 * confirmed the removal, the removal is blocked rather than silently
 * discarding progress — callers should surface a confirmation prompt and
 * retry with `confirmed: true`.
 */
export function removeStudent(
  state: FamilySetupState,
  studentRef: FamilySetupStudentRef,
  context: FamilySetupRemovalContext,
): FamilySetupMutationResult {
  const existing = findStudent(state, studentRef)
  if (!existing) {
    return { status: 'blocked', reason: 'student-not-found', studentRef }
  }

  if (context.hasProgress && !context.confirmed) {
    return { status: 'blocked', reason: 'progress-confirmation-required', studentRef }
  }

  return {
    status: 'ok',
    state: withStudents(
      state,
      state.students.filter((student) => student.studentRef !== studentRef),
    ),
  }
}

/** Sets or clears (via `grade: null`) a per-subject working-grade override. */
export function setWorkingGrade(
  state: FamilySetupState,
  studentRef: FamilySetupStudentRef,
  subject: AcademySubject,
  grade: AcademyGrade | null,
  now: string,
): FamilySetupMutationResult {
  const existing = findStudent(state, studentRef)
  if (!existing) {
    return { status: 'blocked', reason: 'student-not-found', studentRef }
  }
  if (!existing.enabledSubjects.includes(subject)) {
    return { status: 'blocked', reason: 'subject-not-enabled', studentRef }
  }
  if (grade !== null && !isValidAcademyGrade(grade)) {
    return { status: 'blocked', reason: 'invalid-working-grade', studentRef }
  }
  if (grade === null && existing.nominalGrade === '6') {
    return { status: 'blocked', reason: 'invalid-working-grade', studentRef }
  }

  const workingGradeBySubject = { ...existing.workingGradeBySubject }
  if (grade === null) {
    delete workingGradeBySubject[subject]
  } else {
    workingGradeBySubject[subject] = grade
  }

  const updated: FamilySetupStudent = Object.freeze({
    ...existing,
    workingGradeBySubject: Object.freeze(workingGradeBySubject),
    updatedAt: now,
  })

  return { status: 'ok', state: withStudents(state, replaceStudent(state.students, updated)) }
}

export function setPinRequirement(
  state: FamilySetupState,
  studentRef: FamilySetupStudentRef,
  pinRequired: boolean,
  now: string,
): FamilySetupMutationResult {
  const existing = findStudent(state, studentRef)
  if (!existing) {
    return { status: 'blocked', reason: 'student-not-found', studentRef }
  }

  const updated: FamilySetupStudent = Object.freeze({ ...existing, pinRequired, updatedAt: now })
  return { status: 'ok', state: withStudents(state, replaceStudent(state.students, updated)) }
}

/** Display name is not identity: duplicate display names across students are not an issue. */
export function validateFamilySetup(state: FamilySetupState): FamilySetupValidationResult {
  const issues: FamilySetupValidationIssue[] = []

  if (state.students.length === 0) {
    issues.push({ reason: 'empty-roster' })
  }

  for (const student of state.students) {
    if (!isNonEmptyTrimmed(student.displayName)) {
      issues.push({ studentRef: student.studentRef, reason: 'invalid-display-name' })
    }
    if (!isValidGrade(student.nominalGrade)) {
      issues.push({ studentRef: student.studentRef, reason: 'invalid-nominal-grade' })
    }
    if (student.enabledSubjects.length === 0) {
      issues.push({ studentRef: student.studentRef, reason: 'no-enabled-subjects' })
    }
    if (
      student.nominalGrade === '6' &&
      student.enabledSubjects.some((subject) => student.workingGradeBySubject[subject] === undefined)
    ) {
      issues.push({ studentRef: student.studentRef, reason: 'invalid-working-grade' })
    }
    for (const subject of Object.keys(student.workingGradeBySubject)) {
      if (!student.enabledSubjects.includes(subject as AcademySubject)) {
        issues.push({ studentRef: student.studentRef, reason: 'subject-not-enabled' })
      }
    }
  }

  return Object.freeze({ valid: issues.length === 0, issues: Object.freeze(issues) })
}

export function completeSetup(state: FamilySetupState, now: string): FamilySetupMutationResult {
  const validation = validateFamilySetup(state)
  if (!validation.valid) {
    return { status: 'blocked', reason: 'invalid-configuration', issues: validation.issues }
  }

  return { status: 'ok', state: Object.freeze({ ...state, completedAt: now }) }
}

import { describe, expect, it } from 'vitest'
import { evaluateFullFamilyReadiness } from './evaluateFullFamilyReadiness'
import { createFakeReadinessCapabilities, createFakeStudent, everyCourse } from './fixtures'
import { CURRENTLY_SUPPORTED_WORKING_GRADES, REQUIRED_FAMILY_PILOT_SUBJECTS } from './constants'

const ALL_COURSES = everyCourse(REQUIRED_FAMILY_PILOT_SUBJECTS, CURRENTLY_SUPPORTED_WORKING_GRADES)

function fullMatrixWorkingGrades(grade: number) {
  return Object.fromEntries(REQUIRED_FAMILY_PILOT_SUBJECTS.map((subject) => [subject, grade]))
}

describe('evaluateFullFamilyReadiness', () => {
  it('is FULL_FAMILY_READY across all 90 supported grade-subject cells', () => {
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })
    const students = CURRENTLY_SUPPORTED_WORKING_GRADES.map((grade) =>
      createFakeStudent({
        studentRef: `grade-${grade}`,
        displayName: `Grade ${grade}`,
        nominalGrade: grade,
        enabledSubjects: REQUIRED_FAMILY_PILOT_SUBJECTS,
        workingGradeBySubject: fullMatrixWorkingGrades(grade),
      }),
    )

    const result = evaluateFullFamilyReadiness(students, capabilities)

    expect(result.status).toBe('FULL_FAMILY_READY')
    expect(result.students).toHaveLength(9)
    expect(result.students.flatMap((student) => student.subjects)).toHaveLength(90)
    expect(result.students.flatMap((student) => student.blockingSubjects)).toEqual([])
  })

  it('is FULL_FAMILY_READY when every configured student is ready across all ten subjects', () => {
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })
    const students = [
      createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: REQUIRED_FAMILY_PILOT_SUBJECTS,
        workingGradeBySubject: fullMatrixWorkingGrades(5),
      }),
      createFakeStudent({
        studentRef: 'student-2',
        displayName: 'Grace',
        enabledSubjects: REQUIRED_FAMILY_PILOT_SUBJECTS,
        workingGradeBySubject: fullMatrixWorkingGrades(8),
      }),
    ]

    const result = evaluateFullFamilyReadiness(students, capabilities)

    expect(result.status).toBe('FULL_FAMILY_READY')
    expect(result.students).toHaveLength(2)
  })

  it('is BLOCKED when any single student has any single gap', () => {
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })
    const students = [
      createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: REQUIRED_FAMILY_PILOT_SUBJECTS,
        workingGradeBySubject: fullMatrixWorkingGrades(5),
      }),
      createFakeStudent({
        studentRef: 'student-2',
        displayName: 'Grace',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 6 },
      }),
    ]

    const result = evaluateFullFamilyReadiness(students, capabilities)

    expect(result.status).toBe('BLOCKED')
    expect(result.students[1].blockingSubjects).toEqual([
      expect.objectContaining({
        requestedWorkingGrade: 6,
        status: 'CONTENT_GAP',
        blocking: true,
      }),
    ])
  })

  it('keeps two same-name students independent by studentRef', () => {
    const capabilities = createFakeReadinessCapabilities({
      courses: ALL_COURSES,
      persistenceUnavailableFor: [{ studentRef: 'student-a', subject: 'mathematics' }],
    })
    const students = [
      createFakeStudent({
        studentRef: 'student-a',
        displayName: 'Riley',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 7 },
      }),
      createFakeStudent({
        studentRef: 'student-b',
        displayName: 'Riley',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 7 },
      }),
    ]

    const result = evaluateFullFamilyReadiness(students, capabilities)

    const studentA = result.students.find((s) => s.studentRef === 'student-a')
    const studentB = result.students.find((s) => s.studentRef === 'student-b')

    expect(studentA?.ready).toBe(false)
    expect(studentA?.blockingSubjects[0]?.status).toBe('PERSISTENCE_UNAVAILABLE')
    expect(studentB?.ready).toBe(true)
  })

  it('is FULL_FAMILY_READY for a single student across all ten subjects', () => {
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })
    const students = [
      createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: REQUIRED_FAMILY_PILOT_SUBJECTS,
        workingGradeBySubject: fullMatrixWorkingGrades(5),
      }),
    ]

    const result = evaluateFullFamilyReadiness(students, capabilities)

    expect(result.status).toBe('FULL_FAMILY_READY')
    expect(result.students[0].subjects).toHaveLength(10)
  })
})

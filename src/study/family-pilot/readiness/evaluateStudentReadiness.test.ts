import { describe, expect, it } from 'vitest'
import { evaluateStudentReadiness } from './evaluateStudentReadiness'
import { createFakeReadinessCapabilities, createFakeStudent, everyCourse } from './fixtures'
import { CURRENTLY_SUPPORTED_WORKING_GRADES, REQUIRED_FAMILY_PILOT_SUBJECTS } from './constants'

const ALL_COURSES = everyCourse(REQUIRED_FAMILY_PILOT_SUBJECTS, CURRENTLY_SUPPORTED_WORKING_GRADES)

describe('evaluateStudentReadiness', () => {
  it('is ready when all ten required subjects are enabled and resolvable', () => {
    const workingGradeBySubject = Object.fromEntries(
      REQUIRED_FAMILY_PILOT_SUBJECTS.map((subject) => [subject, 8]),
    )
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: REQUIRED_FAMILY_PILOT_SUBJECTS,
      workingGradeBySubject,
    })
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })

    const result = evaluateStudentReadiness(student, capabilities)

    expect(result.ready).toBe(true)
    expect(result.subjects).toHaveLength(10)
    expect(result.blockingSubjects).toHaveLength(0)
  })

  it('supports different working grades per subject for the same student', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      nominalGrade: 8,
      enabledSubjects: ['mathematics', 'english-language-arts'],
      workingGradeBySubject: { mathematics: 7, 'english-language-arts': 8 },
    })
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })

    const result = evaluateStudentReadiness(student, capabilities)

    expect(result.ready).toBe(true)
    const math = result.subjects.find((s) => s.subject === 'mathematics')
    const ela = result.subjects.find((s) => s.subject === 'english-language-arts')
    expect(math?.requestedWorkingGrade).toBe(7)
    expect(ela?.requestedWorkingGrade).toBe(8)
  })

  it('ignores a disabled subject even if a working grade is configured for it', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 7, science: 6 },
    })
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })

    const result = evaluateStudentReadiness(student, capabilities)

    expect(result.subjects).toHaveLength(1)
    expect(result.subjects[0].subject).toBe('mathematics')
    expect(result.ready).toBe(true)
  })

  it('is not ready when one of several enabled subjects has a gap', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics', 'science'],
      workingGradeBySubject: { mathematics: 7, science: 6 },
    })
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })

    const result = evaluateStudentReadiness(student, capabilities)

    expect(result.ready).toBe(false)
    expect(result.blockingSubjects).toHaveLength(1)
    expect(result.blockingSubjects[0].subject).toBe('science')
    expect(result.blockingSubjects[0].status).toBe('CONTENT_GAP')
  })

  it.each(CURRENTLY_SUPPORTED_WORKING_GRADES)(
    'is ready across the whole subject matrix at working grade %s',
    (grade) => {
      const workingGradeBySubject = Object.fromEntries(
        REQUIRED_FAMILY_PILOT_SUBJECTS.map((subject) => [subject, grade]),
      )
      const student = createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        nominalGrade: grade,
        enabledSubjects: REQUIRED_FAMILY_PILOT_SUBJECTS,
        workingGradeBySubject,
      })
      const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })

      const result = evaluateStudentReadiness(student, capabilities)

      expect(result.ready).toBe(true)
    },
  )

  it('is missing a subject entirely when it is simply not enabled', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 7 },
    })
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })

    const result = evaluateStudentReadiness(student, capabilities)

    expect(result.subjects.some((s) => s.subject === 'science')).toBe(false)
  })
})

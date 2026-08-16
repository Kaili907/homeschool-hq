import { describe, expect, it } from 'vitest'
import { evaluateFullFamilyReadiness } from './evaluateFullFamilyReadiness'
import { summarizeFullFamilyGaps } from './summarizeFullFamilyGaps'
import { createFakeReadinessCapabilities, createFakeStudent, everyCourse } from './fixtures'
import { CURRENTLY_SUPPORTED_WORKING_GRADES, REQUIRED_FAMILY_PILOT_SUBJECTS } from './constants'

const ALL_COURSES = everyCourse(REQUIRED_FAMILY_PILOT_SUBJECTS, CURRENTLY_SUPPORTED_WORKING_GRADES)

describe('summarizeFullFamilyGaps', () => {
  it('is empty when the family is fully ready', () => {
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })
    const students = [
      createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 7 },
      }),
    ]

    const summary = summarizeFullFamilyGaps(evaluateFullFamilyReadiness(students, capabilities))

    expect(summary.totalGaps).toBe(0)
    expect(summary.gaps).toEqual([])
  })

  it('groups an unsupported-grade CONTENT_GAP by code and by student', () => {
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })
    const students = [
      createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        nominalGrade: 8,
        enabledSubjects: ['mathematics', 'science'],
        // science requires grade 6, which does not exist in the supported matrix.
        workingGradeBySubject: { mathematics: 7, science: 6 },
      }),
    ]

    const summary = summarizeFullFamilyGaps(evaluateFullFamilyReadiness(students, capabilities))

    expect(summary.totalGaps).toBe(1)
    expect(summary.gapsByCode.CONTENT_GAP).toHaveLength(1)
    expect(summary.gapsByCode.CONTENT_GAP[0]).toMatchObject({
      studentRef: 'student-1',
      subject: 'science',
      requestedWorkingGrade: 6,
      status: 'CONTENT_GAP',
    })
    expect(summary.gapsByStudent['student-1']).toHaveLength(1)
  })

  it('surfaces a missing Study path as a blocker distinct from a content gap', () => {
    const capabilities = createFakeReadinessCapabilities({
      courses: ALL_COURSES,
      studyUnavailableFor: [{ subject: 'mathematics', grade: 7 }],
    })
    const students = [
      createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 7 },
      }),
    ]

    const summary = summarizeFullFamilyGaps(evaluateFullFamilyReadiness(students, capabilities))

    expect(summary.gapsByCode.STUDY_UNAVAILABLE).toHaveLength(1)
    expect(summary.gapsByCode.CONTENT_GAP).toHaveLength(0)
  })

  it('surfaces missing durable persistence as a blocker', () => {
    const capabilities = createFakeReadinessCapabilities({
      courses: ALL_COURSES,
      persistenceUnavailableFor: [{ studentRef: 'student-1', subject: 'mathematics' }],
    })
    const students = [
      createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 7 },
      }),
    ]

    const summary = summarizeFullFamilyGaps(evaluateFullFamilyReadiness(students, capabilities))

    expect(summary.gapsByCode.PERSISTENCE_UNAVAILABLE).toHaveLength(1)
  })

  it('separates gaps across multiple students with multiple gaps each', () => {
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })
    const students = [
      createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics', 'science'],
        workingGradeBySubject: { mathematics: 6, science: 6 },
      }),
      createFakeStudent({
        studentRef: 'student-2',
        displayName: 'Grace',
        enabledSubjects: ['health'],
        workingGradeBySubject: {},
      }),
    ]

    const summary = summarizeFullFamilyGaps(evaluateFullFamilyReadiness(students, capabilities))

    expect(summary.totalGaps).toBe(3)
    expect(summary.gapsByStudent['student-1']).toHaveLength(2)
    expect(summary.gapsByStudent['student-2']).toHaveLength(1)
    expect(summary.gapsByCode.CONTENT_GAP).toHaveLength(2)
    expect(summary.gapsByCode.INVALID_CONFIGURATION).toHaveLength(1)
  })

  it('groups by student even when studentRef collides with an Object.prototype key', () => {
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })
    const students = [
      createFakeStudent({
        studentRef: '__proto__',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 6 },
      }),
    ]

    const summary = summarizeFullFamilyGaps(evaluateFullFamilyReadiness(students, capabilities))

    expect(summary.gapsByStudent['__proto__']).toHaveLength(1)
    expect(Array.isArray(summary.gapsByStudent['__proto__'])).toBe(true)
  })
})

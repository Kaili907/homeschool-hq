import { describe, expect, it } from 'vitest'
import { evaluateSubjectReadiness } from './evaluateSubjectReadiness'
import { createFakeReadinessCapabilities, createFakeStudent, everyCourse } from './fixtures'
import { CURRENTLY_SUPPORTED_WORKING_GRADES, REQUIRED_FAMILY_PILOT_SUBJECTS } from './constants'

const ALL_COURSES = everyCourse(REQUIRED_FAMILY_PILOT_SUBJECTS, CURRENTLY_SUPPORTED_WORKING_GRADES)

describe('evaluateSubjectReadiness', () => {
  it('is READY when every capability is available', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 7 },
    })
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })

    const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

    expect(result.status).toBe('READY')
    expect(result.blocking).toBe(false)
    expect(result.notes).toEqual([])
    expect(result.requestedWorkingGrade).toBe(7)
  })

  it('returns INVALID_CONFIGURATION when the subject has no configured working grade', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: {},
    })
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })

    const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

    expect(result.status).toBe('INVALID_CONFIGURATION')
    expect(result.blocking).toBe(true)
    expect(result.requestedWorkingGrade).toBeUndefined()
  })

  it.each([0, -1, 1.5, Number.NaN])(
    'returns INVALID_CONFIGURATION for an out-of-range working grade (%s)',
    (grade) => {
      const student = createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: grade },
      })
      const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })

      const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

      expect(result.status).toBe('INVALID_CONFIGURATION')
    },
  )

  it('returns CATALOG_UNAVAILABLE when the catalog service itself is down', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 7 },
    })
    const capabilities = createFakeReadinessCapabilities({ catalogAvailable: false, courses: ALL_COURSES })

    const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

    expect(result.status).toBe('CATALOG_UNAVAILABLE')
  })

  it('returns a concrete CONTENT_GAP for an unsupported grade instead of normalizing it', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 6 },
    })
    const capabilities = createFakeReadinessCapabilities({ courses: ALL_COURSES })

    const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

    expect(result.status).toBe('CONTENT_GAP')
    expect(result.requestedWorkingGrade).toBe(6)
    expect(result.detail).toContain('grade 6')
  })

  it('returns STUDY_UNAVAILABLE when Study cannot run the course', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 7 },
    })
    const capabilities = createFakeReadinessCapabilities({
      courses: ALL_COURSES,
      studyUnavailableFor: [{ subject: 'mathematics', grade: 7 }],
    })

    const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

    expect(result.status).toBe('STUDY_UNAVAILABLE')
  })

  it('returns ASSIGNMENT_UNAVAILABLE when no assignment path exists', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 7 },
    })
    const capabilities = createFakeReadinessCapabilities({
      courses: ALL_COURSES,
      assignmentUnavailableFor: [{ subject: 'mathematics', grade: 7 }],
    })

    const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

    expect(result.status).toBe('ASSIGNMENT_UNAVAILABLE')
  })

  it('returns PERSISTENCE_UNAVAILABLE when durable save/resume is missing', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 7 },
    })
    const capabilities = createFakeReadinessCapabilities({
      courses: ALL_COURSES,
      persistenceUnavailableFor: [{ studentRef: 'student-1', subject: 'mathematics' }],
    })

    const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

    expect(result.status).toBe('PERSISTENCE_UNAVAILABLE')
  })

  it('returns SAFETY_UNAVAILABLE when no safe completion path exists', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 7 },
    })
    const capabilities = createFakeReadinessCapabilities({
      courses: ALL_COURSES,
      safetyUnavailableFor: [{ studentRef: 'student-1', subject: 'mathematics', grade: 7 }],
    })

    const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

    expect(result.status).toBe('SAFETY_UNAVAILABLE')
  })

  it('stays READY with a non-blocking note when Tutor is unavailable but static help works', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 7 },
    })
    const capabilities = createFakeReadinessCapabilities({
      courses: ALL_COURSES,
      tutorUnavailableFor: [{ subject: 'mathematics', grade: 7 }],
    })

    const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

    expect(result.status).toBe('READY')
    expect(result.blocking).toBe(false)
    expect(result.notes).toContain('TUTOR_UNAVAILABLE_BUT_NONBLOCKING')
    expect(result.notes).toContain('STATIC_HELP_AVAILABLE')
  })

  it('stays READY but flags when neither Tutor nor static help is available', () => {
    const student = createFakeStudent({
      studentRef: 'student-1',
      displayName: 'Ada',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: 7 },
    })
    const capabilities = createFakeReadinessCapabilities({
      courses: ALL_COURSES,
      tutorUnavailableFor: [{ subject: 'mathematics', grade: 7 }],
      staticHelpUnavailableFor: [{ subject: 'mathematics', grade: 7 }],
    })

    const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

    expect(result.status).toBe('READY')
    expect(result.notes).toContain('TUTOR_AND_STATIC_HELP_UNAVAILABLE')
  })

  describe('precedence order under simultaneous failures', () => {
    it('reports INVALID_CONFIGURATION over CATALOG_UNAVAILABLE', () => {
      const student = createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: {},
      })
      const capabilities = createFakeReadinessCapabilities({ catalogAvailable: false, courses: [] })

      const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

      expect(result.status).toBe('INVALID_CONFIGURATION')
    })

    it('reports CATALOG_UNAVAILABLE over CONTENT_GAP', () => {
      const student = createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 7 },
      })
      // Catalog service is down AND the course would be missing anyway.
      const capabilities = createFakeReadinessCapabilities({ catalogAvailable: false, courses: [] })

      const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

      expect(result.status).toBe('CATALOG_UNAVAILABLE')
    })

    it('reports CONTENT_GAP over STUDY_UNAVAILABLE', () => {
      const student = createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 6 },
      })
      // No grade-6 course AND Study is also unavailable for it.
      const capabilities = createFakeReadinessCapabilities({
        courses: ALL_COURSES,
        studyUnavailableFor: [{ subject: 'mathematics', grade: 6 }],
      })

      const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

      expect(result.status).toBe('CONTENT_GAP')
    })

    it('reports STUDY_UNAVAILABLE over ASSIGNMENT_UNAVAILABLE', () => {
      const student = createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 7 },
      })
      const capabilities = createFakeReadinessCapabilities({
        courses: ALL_COURSES,
        studyUnavailableFor: [{ subject: 'mathematics', grade: 7 }],
        assignmentUnavailableFor: [{ subject: 'mathematics', grade: 7 }],
      })

      const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

      expect(result.status).toBe('STUDY_UNAVAILABLE')
    })

    it('reports ASSIGNMENT_UNAVAILABLE over PERSISTENCE_UNAVAILABLE', () => {
      const student = createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 7 },
      })
      const capabilities = createFakeReadinessCapabilities({
        courses: ALL_COURSES,
        assignmentUnavailableFor: [{ subject: 'mathematics', grade: 7 }],
        persistenceUnavailableFor: [{ studentRef: 'student-1', subject: 'mathematics' }],
      })

      const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

      expect(result.status).toBe('ASSIGNMENT_UNAVAILABLE')
    })

    it('reports PERSISTENCE_UNAVAILABLE over SAFETY_UNAVAILABLE', () => {
      const student = createFakeStudent({
        studentRef: 'student-1',
        displayName: 'Ada',
        enabledSubjects: ['mathematics'],
        workingGradeBySubject: { mathematics: 7 },
      })
      const capabilities = createFakeReadinessCapabilities({
        courses: ALL_COURSES,
        persistenceUnavailableFor: [{ studentRef: 'student-1', subject: 'mathematics' }],
        safetyUnavailableFor: [{ studentRef: 'student-1', subject: 'mathematics', grade: 7 }],
      })

      const result = evaluateSubjectReadiness(student, 'mathematics', capabilities)

      expect(result.status).toBe('PERSISTENCE_UNAVAILABLE')
    })
  })
})

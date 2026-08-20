import { describe, expect, it } from 'vitest'
import type { FinalCatalogCourse, FinalCatalogUnit, FinalCurriculumGrade } from '../../../curriculum/final-runtime'
import { ACADEMY_GRADES, ACADEMY_SUBJECTS, type AcademySubject } from '../../../types'
import type { FamilyPilotAssignmentRecordV1 } from '../core'
import type { FinalFamilyPilotAssessmentAssignment } from '../final-app/state'
import { deriveCanonicalCourseCompletion, type CanonicalCourseCatalog } from './model'

const STUDENT = 'student:ada'
const T0 = '2026-08-14T13:00:00.000Z'
const T1 = '2026-08-14T14:00:00.000Z'

function course(grade: FinalCurriculumGrade, subject: AcademySubject): FinalCatalogCourse {
  return {
    courseRef: `ma-g${grade}-${subject}`,
    grade,
    subject,
    title: `Grade ${grade} ${subject}`,
    days: 1,
    unitCount: 1,
    lessonCount: 1,
  }
}

function unit(held: FinalCatalogCourse, withAssessment = false): FinalCatalogUnit {
  return {
    unitRef: `${held.courseRef}-u01`,
    courseRef: held.courseRef,
    grade: held.grade,
    subject: held.subject,
    unitNumber: 1,
    title: 'Unit 1',
    days: 1,
    essentialQuestion: '?',
    assessmentRef: withAssessment ? `${held.courseRef}-u01-assessment` : null,
    lessonRefs: [`${held.courseRef}-u01-l01`],
  }
}

function catalog(courses: readonly FinalCatalogCourse[], withAssessment = false): CanonicalCourseCatalog {
  const units = courses.map((held) => unit(held, withAssessment))
  return {
    listCourses: (grade) => courses.filter((held) => grade === undefined || held.grade === grade),
    listUnits: (courseRef) => units.filter((held) => held.courseRef === courseRef),
  }
}

function assignment(
  held: FinalCatalogCourse,
  state: FamilyPilotAssignmentRecordV1['state'] = 'completed',
  completedAt: string | null = state === 'completed' ? T0 : null,
): FamilyPilotAssignmentRecordV1 {
  return {
    assignmentRef: `assignment:${held.courseRef}`,
    lessonRef: `${held.courseRef}-u01-l01`,
    subject: held.subject,
    title: `${held.title} lesson`,
    state,
    sessionRef: null,
    progress: { completedSegmentRefs: state === 'completed' ? ['segment:1'] : [], totalSegments: 1, lastSegmentRef: null, activeSeconds: 1 },
    pause: { pausedAt: null, resumedAt: null, pausedSeconds: 0, resumeSegmentRef: null },
    completedAt,
    createdAt: T0,
    updatedAt: T0,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

function assessment(
  held: FinalCatalogCourse,
  status: FinalFamilyPilotAssessmentAssignment['status'],
  completedAt: string | null = status === 'CERTIFIED' ? T1 : null,
): FinalFamilyPilotAssessmentAssignment {
  return {
    assignmentRef: `assessment:${held.courseRef}`,
    assessmentRef: `${held.courseRef}-u01-assessment`,
    studentRef: STUDENT,
    courseRef: held.courseRef,
    subject: held.subject,
    grade: held.grade,
    title: `${held.title} assessment`,
    authorityClass: status === 'PENDING_GUARDIAN_ATTESTATION' ? 'GUARDIAN_REQUIRED' : 'AUTO_SCOREABLE',
    status,
    createdAt: T0,
    updatedAt: T1,
    completedAt,
  }
}

describe('canonical course completion', () => {
  it.each(ACADEMY_GRADES)('is terminal for every canonical subject at Grade %s', (grade) => {
    const gradeCourses = ACADEMY_SUBJECTS.map((subject) => course(Number(grade) as FinalCurriculumGrade, subject))
    const allCourses = ACADEMY_GRADES.flatMap((candidate) =>
      ACADEMY_SUBJECTS.map((subject) => course(Number(candidate) as FinalCurriculumGrade, subject)))
    const heldCatalog = catalog(allCourses)

    for (const held of gradeCourses) {
      const result = deriveCanonicalCourseCompletion({
        catalog: heldCatalog,
        studentRef: STUDENT,
        subject: held.subject,
        workingGrade: grade,
        assignments: [assignment(held)],
        assessments: [],
      })
      expect(result.status, `${held.courseRef} should be complete`).toBe('COMPLETE')
      expect(result.completedAt).toBe(T0)
      const gradeIndex = ACADEMY_GRADES.indexOf(grade)
      const expectedNext = ACADEMY_GRADES[gradeIndex + 1]
      expect(result.nextCourseOptions.map((option) => String(option.grade))).toEqual(expectedNext ? [expectedNext] : [])
      expect(result.nextCourseOptions.every((option) => option.subject === held.subject)).toBe(true)
    }
  })

  it.each(['PLANNED', 'ACTIVE', 'PENDING_ASSESSMENT', 'ADULT_REVIEW_REQUIRED', 'PENDING_GUARDIAN_ATTESTATION'] as const)(
    'does not complete while the final assessment is %s',
    (status) => {
      const held = course(5, 'mathematics')
      const result = deriveCanonicalCourseCompletion({
        catalog: catalog([held], true),
        studentRef: STUDENT,
        subject: held.subject,
        workingGrade: '5',
        assignments: [assignment(held)],
        assessments: [assessment(held, status)],
      })
      expect(result.status).toBe('PENDING_CERTIFICATION')
      expect(result.pendingAssessment).toBe(true)
      expect(result.guardianGate).toBe(status === 'PENDING_GUARDIAN_ATTESTATION')
      expect(result.completedAt).toBeNull()
      expect(result.nextCourseOptions).toEqual([])
    },
  )

  it('completes only after the required assessment is certified and uses the last authoritative date', () => {
    const held = course(5, 'mathematics')
    const result = deriveCanonicalCourseCompletion({
      catalog: catalog([held], true), studentRef: STUDENT, subject: held.subject, workingGrade: '5',
      assignments: [assignment(held)], assessments: [assessment(held, 'CERTIFIED')],
    })
    expect(result).toMatchObject({ status: 'COMPLETE', completedAt: T1, pendingAssessment: false, guardianGate: false })
  })

  it('keeps a guardian-gated final lesson incomplete until Core records certification', () => {
    const held = course(5, 'ready-for-life')
    const pending = assignment(held, 'active')
    const result = deriveCanonicalCourseCompletion({
      catalog: catalog([held]), studentRef: STUDENT, subject: held.subject, workingGrade: '5',
      assignments: [pending], assessments: [], pendingGuardianAssignmentRefs: new Set([pending.assignmentRef]),
    })
    expect(result).toMatchObject({ status: 'IN_PROGRESS', guardianGate: true, completedAt: null })
  })

  it('does not count an abandoned required lesson as complete', () => {
    const held = course(5, 'science')
    expect(deriveCanonicalCourseCompletion({
      catalog: catalog([held]), studentRef: STUDENT, subject: held.subject, workingGrade: '5',
      assignments: [assignment(held, 'abandoned')], assessments: [],
    }).status).toBe('IN_PROGRESS')
  })

  it('reports completion without inventing a date when a legacy completion timestamp is absent', () => {
    const held = course(5, 'health')
    expect(deriveCanonicalCourseCompletion({
      catalog: catalog([held]), studentRef: STUDENT, subject: held.subject, workingGrade: '5',
      assignments: [assignment(held, 'completed', null)], assessments: [],
    })).toMatchObject({ status: 'COMPLETE', completedAt: null })
  })

  it('handles nominal Grade 6 honestly and never invents curriculum or a promotion', () => {
    const held = course(7, 'mathematics')
    const result = deriveCanonicalCourseCompletion({
      catalog: catalog([held]), studentRef: STUDENT, subject: 'mathematics', workingGrade: '6',
      assignments: [], assessments: [],
    })
    expect(result).toMatchObject({ status: 'UNAVAILABLE', workingGrade: '6', courseRef: null })
    expect(result.nextCourseOptions).toEqual([])
  })
})

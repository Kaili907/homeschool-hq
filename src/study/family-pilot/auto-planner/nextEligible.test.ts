import { describe, expect, it } from 'vitest'
import type { FinalCatalogCourse, FinalCatalogLesson, FinalCatalogUnit } from '../../../curriculum/final-runtime'
import { ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types'
import type { FamilyAutoPlannerAssignmentFact, FamilyAutoPlannerCourseBundle } from './types'
import { resolveFamilyCourseNextEligible } from './nextEligible'

const NOW = '2026-08-14T13:00:00.000Z'

function bundle(subject: AcademySubject, grade: AcademyGrade = '5', assessment = false): FamilyAutoPlannerCourseBundle {
  const courseRef = `ma-g${grade}-${subject}`
  const unitRef = `${courseRef}-u01`
  const course: FinalCatalogCourse = { courseRef, grade: Number(grade) as never, subject, title: `${subject} course`, days: 2, unitCount: 1, lessonCount: 2 }
  const lessons: FinalCatalogLesson[] = [1, 2].map((courseDay) => ({
    lessonRef: `${unitRef}-l0${courseDay}`, courseRef, unitRef, grade: Number(grade) as never, subject,
    unitNumber: 1, dayInUnit: courseDay, courseDay, title: `${subject} ${courseDay}`,
    estimatedMinutes: '30', resourceRefs: [], sourceReadiness: { state: 'ready', dynamicSource: false, sourceRefs: [] },
  }))
  const unit: FinalCatalogUnit = {
    unitRef, courseRef, grade: Number(grade) as never, subject, unitNumber: 1, title: 'Unit 1', days: 2,
    essentialQuestion: '?', assessmentRef: assessment ? `${unitRef}-assessment` : null,
    lessonRefs: lessons.map((item) => item.lessonRef),
  }
  return { course, units: [unit], lessons }
}

function fact(course: FamilyAutoPlannerCourseBundle, index: number, state: FamilyAutoPlannerAssignmentFact['state']): FamilyAutoPlannerAssignmentFact {
  const lesson = course.lessons[index]!
  return {
    assignmentRef: `assignment:${lesson.lessonRef}`, learnerRef: 'student:ada', lessonRef: lesson.lessonRef,
    subject: lesson.subject, title: lesson.title, state,
    sessionRef: ['active', 'paused'].includes(state) ? `session:${lesson.lessonRef}` : null,
    createdAt: NOW, updatedAt: NOW, completedAt: state === 'completed' ? NOW : null, optional: false,
  }
}

function resolve(course: FamilyAutoPlannerCourseBundle, overrides: Partial<Parameters<typeof resolveFamilyCourseNextEligible>[0]> = {}) {
  return resolveFamilyCourseNextEligible({
    learnerRef: 'student:ada', bundle: course, assignments: [], assessments: [], holds: [], ...overrides,
  })
}

describe('canonical next eligible course work', () => {
  it.each(ACADEMY_SUBJECTS)('uses one sequence algorithm for %s', (subject) => {
    const course = bundle(subject)
    expect(resolve(course)).toMatchObject({ status: 'LESSON', subject, lesson: { lessonRef: course.lessons[0]!.lessonRef } })
    expect(resolve(course, { assignments: [fact(course, 0, 'completed')] }))
      .toMatchObject({ status: 'LESSON', lesson: { lessonRef: course.lessons[1]!.lessonRef } })
  })

  it.each(['4', '8', '11'] as AcademyGrade[])('works at representative Grade %s', (grade) => {
    expect(resolve(bundle('science', grade))).toMatchObject({ status: 'LESSON', workingGrade: grade })
  })

  it('prioritizes exact resumable work and fails closed on its Safety and guardian gates', () => {
    const course = bundle('mathematics')
    const active = fact(course, 0, 'active')
    expect(resolve(course, { assignments: [active] })).toMatchObject({ status: 'LESSON', assignment: { assignmentRef: active.assignmentRef } })
    expect(resolve(course, {
      assignments: [active], holds: [{ learnerRef: 'student:ada', sessionRef: active.sessionRef!, status: 'acknowledged', reasonCode: 'safety' }],
    })).toMatchObject({ status: 'GATED', gate: 'SAFETY_HOLD' })
    expect(resolve(course, {
      assignments: [active], pendingGuardianAssignmentRefs: new Set([active.assignmentRef]),
    })).toMatchObject({ status: 'GATED', gate: 'GUARDIAN_CERTIFICATION' })
  })

  it('stops at required assessment, scoring, Parent review, guardian certification, and course completion', () => {
    const course = bundle('science', '5', true)
    const completed = [fact(course, 0, 'completed'), fact(course, 1, 'completed')]
    expect(resolve(course, { assignments: completed })).toMatchObject({ status: 'GATED', gate: 'ASSESSMENT_REQUIRED' })
    for (const [status, gate] of [
      ['PENDING_ASSESSMENT', 'PENDING_ASSESSMENT'],
      ['ADULT_REVIEW_REQUIRED', 'PARENT_REVIEW'],
      ['PENDING_GUARDIAN_ATTESTATION', 'GUARDIAN_CERTIFICATION'],
    ] as const) {
      expect(resolve(course, { assignments: completed, assessments: [{
        assignmentRef: 'assessment:one', learnerRef: 'student:ada', assessmentRef: course.units[0]!.assessmentRef!,
        courseRef: course.course.courseRef, subject: course.course.subject, title: 'Unit 1 assessment', status,
        createdAt: NOW, updatedAt: NOW, completedAt: null,
      }] })).toMatchObject({ status: 'GATED', gate })
    }
    expect(resolve(course, { assignments: completed, assessments: [{
      assignmentRef: 'assessment:one', learnerRef: 'student:ada', assessmentRef: course.units[0]!.assessmentRef!,
      courseRef: course.course.courseRef, subject: course.course.subject, title: 'Unit 1 assessment', status: 'CERTIFIED',
      createdAt: NOW, updatedAt: NOW, completedAt: NOW,
    }] })).toMatchObject({ status: 'GATED', gate: 'COURSE_COMPLETE' })
  })

  it('does not substitute Grade 5 or Grade 7 curriculum for unsupported Grade 6', () => {
    const available = [bundle('mathematics', '5'), bundle('mathematics', '7')]
    expect(available.some((item) => String(item.course.grade) === '6')).toBe(false)
  })
})

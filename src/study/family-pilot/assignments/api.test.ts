import { describe, expect, it } from 'vitest'
import { emptyFamilyPilotState, findFamilyPilotStudent } from '../core'
import type { FamilyPilotCatalog } from '../../../curriculum/family-pilot/types'
import { createPilotAssignmentPlan } from './plan'
import { getTodayAssignments, markAssignmentStarted } from './api'
import type { PilotAssignmentStudentConfig } from './types'

const T0 = '2026-08-12T09:00:00.000Z'
const T1 = '2026-08-12T09:30:00.000Z'

function lesson(courseId: string, grade: '5' | '7', day: number) {
  return {
    lessonId: `${courseId}-l${day}`,
    courseId,
    grade,
    unitId: 'u01',
    unitNumber: 1,
    dayInUnit: day,
    courseDay: day,
    title: `${courseId} lesson ${day}`,
  }
}

function fixtureCatalog(): FamilyPilotCatalog {
  const g5Lessons = [1, 2].map((day) => lesson('ma-g5-mathematics', '5', day))
  const g7Lessons = [1, 2].map((day) => lesson('ma-g7-mathematics', '7', day))
  return {
    releaseVersion: '0.0.0-fixture',
    courses: [
      {
        courseId: 'ma-g5-mathematics',
        grade: '5',
        subject: 'mathematics',
        title: 'Grade 5 Mathematics',
        units: [{ unitId: 'u01', courseId: 'ma-g5-mathematics', unitNumber: 1, title: 'Unit 1', assessmentId: null, lessonIds: g5Lessons.map((l) => l.lessonId) }],
        lessons: g5Lessons,
      },
      {
        courseId: 'ma-g7-mathematics',
        grade: '7',
        subject: 'mathematics',
        title: 'Grade 7 Mathematics',
        units: [{ unitId: 'u01', courseId: 'ma-g7-mathematics', unitNumber: 1, title: 'Unit 1', assessmentId: null, lessonIds: g7Lessons.map((l) => l.lessonId) }],
        lessons: g7Lessons,
      },
    ],
  }
}

function configFor(studentRef: string, nominalGrade: '5' | '7'): PilotAssignmentStudentConfig {
  return { studentRef, nominalGrade, enabledSubjects: ['mathematics'] }
}

describe('getTodayAssignments', () => {
  it('returns the open assignment for a planned student', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:ada', '5')
    const state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    const today = getTodayAssignments(state, 'student:ada')
    expect(today).toHaveLength(1)
    expect(today[0].lessonRef).toBe('ma-g5-mathematics-l1')
    expect(today[0].state).toBe('planned')
  })

  it('is empty for an unplanned or unknown student', () => {
    const state = emptyFamilyPilotState(T0)
    expect(getTodayAssignments(state, 'student:ghost')).toEqual([])
  })

  it('keeps two students fully independent', () => {
    const catalog = fixtureCatalog()
    let state = emptyFamilyPilotState(T0)
    state = createPilotAssignmentPlan(catalog, configFor('student:ada', '5'), state, T0)
    state = createPilotAssignmentPlan(catalog, configFor('student:bo', '7'), state, T0)

    expect(getTodayAssignments(state, 'student:ada').map((a) => a.lessonRef)).toEqual(['ma-g5-mathematics-l1'])
    expect(getTodayAssignments(state, 'student:bo').map((a) => a.lessonRef)).toEqual(['ma-g7-mathematics-l1'])
  })
})

describe('markAssignmentStarted', () => {
  it('binds a session and moves the assignment to active', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:ada', '5')
    let state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    const assignmentRef = getTodayAssignments(state, 'student:ada')[0].assignmentRef

    state = markAssignmentStarted(state, 'student:ada', assignmentRef, 'session:1', T1)

    const student = findFamilyPilotStudent(state, 'student:ada')!
    expect(student.activeAssignmentRef).toBe(assignmentRef)
    expect(student.assignments[0].state).toBe('active')
    expect(student.assignments[0].sessionRef).toBe('session:1')
  })

  it('only affects the addressed student', () => {
    const catalog = fixtureCatalog()
    let state = emptyFamilyPilotState(T0)
    state = createPilotAssignmentPlan(catalog, configFor('student:ada', '5'), state, T0)
    state = createPilotAssignmentPlan(catalog, configFor('student:bo', '7'), state, T0)
    const adaRef = getTodayAssignments(state, 'student:ada')[0].assignmentRef

    state = markAssignmentStarted(state, 'student:ada', adaRef, 'session:1', T1)

    expect(findFamilyPilotStudent(state, 'student:bo')!.activeAssignmentRef).toBeNull()
    expect(getTodayAssignments(state, 'student:bo')[0].state).toBe('planned')
  })
})

import { describe, expect, it } from 'vitest'
import { abandonFamilyPilotAssignment, emptyFamilyPilotState, findFamilyPilotStudent, type FamilyPilotStateV1 } from '../core'
import type { FamilyPilotCatalog } from '../../../curriculum/family-pilot/types'
import { createPilotAssignmentPlan, getNextAssignment, markAssignmentCompleted } from './plan'
import type { PilotAssignmentStudentConfig } from './types'

const T0 = '2026-08-12T09:00:00.000Z'
const T1 = '2026-08-12T09:30:00.000Z'
const T2 = '2026-08-12T10:00:00.000Z'

function lesson(courseId: string, grade: '5' | '7' | '8', unitId: string, unitNumber: number, day: number) {
  return {
    lessonId: `${courseId}-l${day}`,
    courseId,
    grade,
    unitId,
    unitNumber,
    dayInUnit: day,
    courseDay: day,
    title: `${courseId} lesson ${day}`,
  }
}

/** Two-lesson math courses for grades 5, 7, and 8 — small enough to reach
 * "end of course" without a giant fixture, independent of the real catalog
 * loader so these tests pin plan.ts behavior rather than curriculum content. */
function fixtureCatalog(): FamilyPilotCatalog {
  const courses = (['5', '7', '8'] as const).map((grade) => {
    const courseId = `ma-g${grade}-mathematics`
    const lessons = [1, 2].map((day) => lesson(courseId, grade, 'u01', 1, day))
    return {
      courseId,
      grade,
      subject: 'mathematics' as const,
      title: `Grade ${grade} Mathematics`,
      units: [{ unitId: 'u01', courseId, unitNumber: 1, title: 'Unit 1', assessmentId: null, lessonIds: lessons.map((l) => l.lessonId) }],
      lessons,
    }
  })
  return { releaseVersion: '0.0.0-fixture', courses }
}

function configFor(studentRef: string, overrides: Partial<PilotAssignmentStudentConfig> = {}): PilotAssignmentStudentConfig {
  return {
    studentRef,
    nominalGrade: '5',
    enabledSubjects: ['mathematics'],
    ...overrides,
  }
}

function openAssignments(state: FamilyPilotStateV1, studentRef: string) {
  return (findFamilyPilotStudent(state, studentRef)?.assignments ?? []).filter(
    (assignment) => assignment.state !== 'completed' && assignment.state !== 'abandoned',
  )
}

describe('createPilotAssignmentPlan', () => {
  it('assigns the grade 5 course in course order', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:ada', { nominalGrade: '5' })
    const state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    const assignments = openAssignments(state, 'student:ada')
    expect(assignments).toHaveLength(1)
    expect(assignments[0].lessonRef).toBe('ma-g5-mathematics-l1')
    expect(assignments[0].state).toBe('planned')
  })

  it('assigns the grade 7 course in course order', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:bo', { nominalGrade: '7' })
    const state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    expect(openAssignments(state, 'student:bo')[0]?.lessonRef).toBe('ma-g7-mathematics-l1')
  })

  it('assigns the grade 8 course in course order', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:cy', { nominalGrade: '8' })
    const state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    expect(openAssignments(state, 'student:cy')[0]?.lessonRef).toBe('ma-g8-mathematics-l1')
  })

  it('uses the working grade for a subject instead of the nominal grade', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:dee', {
      nominalGrade: '7',
      workingGradeBySubject: { mathematics: '5' },
    })
    const state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    expect(openAssignments(state, 'student:dee')[0]?.lessonRef).toBe('ma-g5-mathematics-l1')
  })

  it('leaves two students with different working grades fully independent', () => {
    const catalog = fixtureCatalog()
    let state = emptyFamilyPilotState(T0)
    const ada = configFor('student:ada', { nominalGrade: '5' })
    const bo = configFor('student:bo', { nominalGrade: '7', workingGradeBySubject: { mathematics: '5' } })
    state = createPilotAssignmentPlan(catalog, ada, state, T0)
    state = createPilotAssignmentPlan(catalog, bo, state, T0)
    expect(openAssignments(state, 'student:ada')[0]?.lessonRef).toBe('ma-g5-mathematics-l1')
    expect(openAssignments(state, 'student:bo')[0]?.lessonRef).toBe('ma-g5-mathematics-l1')
    // Same lessonRef, but deterministic assignmentRefs keep the two records distinct.
    expect(openAssignments(state, 'student:ada')[0]?.assignmentRef).not.toBe(
      openAssignments(state, 'student:bo')[0]?.assignmentRef,
    )
  })

  it('does not assign a second copy while one is already in flight (resume, not duplicate)', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:ada')
    let state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    const firstRef = openAssignments(state, 'student:ada')[0]?.assignmentRef

    // Re-planning (e.g. app restart) before the first lesson is finished must
    // not create a duplicate — the same in-progress record comes back.
    state = createPilotAssignmentPlan(catalog, config, state, T1)
    const assignments = openAssignments(state, 'student:ada')
    expect(assignments).toHaveLength(1)
    expect(assignments[0].assignmentRef).toBe(firstRef)
    expect(assignments[0].createdAt).toBe(T0)
  })

  it('does not assign anything for a subject the catalog has no course for (catalog resolution)', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:ada', { enabledSubjects: ['mathematics', 'science'] })
    const state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    const assignments = openAssignments(state, 'student:ada')
    expect(assignments).toHaveLength(1)
    expect(assignments.every((a) => a.subject === 'mathematics')).toBe(true)
    // Every assignment that was created resolves to a real catalog lesson.
    const lessonIds = new Set(catalog.courses.flatMap((c) => c.lessons.map((l) => l.lessonId)))
    expect(assignments.every((a) => lessonIds.has(a.lessonRef))).toBe(true)
  })

  it('never targets a grade the catalog has no course for', () => {
    const catalog: FamilyPilotCatalog = { releaseVersion: '0.0.0-fixture', courses: [] }
    const config = configFor('student:ada', { nominalGrade: '5' })
    const state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    expect(openAssignments(state, 'student:ada')).toHaveLength(0)
  })
})

describe('getNextAssignment', () => {
  it('is undefined once every lesson in the course has been completed (end of course)', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:ada', { nominalGrade: '5' })
    let state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    const first = openAssignments(state, 'student:ada')[0]!
    state = markAssignmentCompleted(catalog, config, state, first.assignmentRef, T1)
    const second = openAssignments(state, 'student:ada')[0]!
    expect(second.lessonRef).toBe('ma-g5-mathematics-l2')
    state = markAssignmentCompleted(catalog, config, state, second.assignmentRef, T2)

    expect(openAssignments(state, 'student:ada')).toHaveLength(0)
    expect(getNextAssignment(catalog, config, state, 'mathematics')).toBeUndefined()
  })

  it('moves on to the next lesson when the current one is abandoned, instead of stalling', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:ada', { nominalGrade: '5' })
    let state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    const first = openAssignments(state, 'student:ada')[0]!
    expect(first.lessonRef).toBe('ma-g5-mathematics-l1')

    state = abandonFamilyPilotAssignment(state, 'student:ada', first.assignmentRef, T1)
    expect(getNextAssignment(catalog, config, state, 'mathematics')?.lessonId).toBe('ma-g5-mathematics-l2')

    state = createPilotAssignmentPlan(catalog, config, state, T1)
    const open = openAssignments(state, 'student:ada')
    expect(open).toHaveLength(1)
    expect(open[0].lessonRef).toBe('ma-g5-mathematics-l2')
  })
})

describe('markAssignmentCompleted', () => {
  it('advances to the next lesson in course order on completion', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:ada', { nominalGrade: '5' })
    let state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    const first = openAssignments(state, 'student:ada')[0]!
    expect(first.lessonRef).toBe('ma-g5-mathematics-l1')

    state = markAssignmentCompleted(catalog, config, state, first.assignmentRef, T1)

    const assignments = findFamilyPilotStudent(state, 'student:ada')!.assignments
    expect(assignments.find((a) => a.assignmentRef === first.assignmentRef)?.state).toBe('completed')
    const open = assignments.filter((a) => a.state !== 'completed')
    expect(open).toHaveLength(1)
    expect(open[0].lessonRef).toBe('ma-g5-mathematics-l2')
  })

  it('never reassigns a completed lesson', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:ada', { nominalGrade: '5' })
    let state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    const first = openAssignments(state, 'student:ada')[0]!
    state = markAssignmentCompleted(catalog, config, state, first.assignmentRef, T1)

    // Re-running the planner after completion must not reopen lesson 1.
    state = createPilotAssignmentPlan(catalog, config, state, T2)
    const lessonRefs = findFamilyPilotStudent(state, 'student:ada')!.assignments.map((a) => a.lessonRef)
    expect(lessonRefs.filter((ref) => ref === 'ma-g5-mathematics-l1')).toHaveLength(1)
  })

  it('is a no-op for an unknown assignmentRef', () => {
    const catalog = fixtureCatalog()
    const config = configFor('student:ada', { nominalGrade: '5' })
    const state = createPilotAssignmentPlan(catalog, config, emptyFamilyPilotState(T0), T0)
    const next = markAssignmentCompleted(catalog, config, state, 'assignment:does-not-exist', T1)
    expect(next).toBe(state)
  })
})

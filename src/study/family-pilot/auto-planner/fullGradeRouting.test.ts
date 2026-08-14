import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  FINAL_CURRICULUM_GRADES,
  createFinalCurriculumRuntime,
  type FinalCourseLessonRow,
  type FinalRuntimeManifest,
} from '../../../curriculum/final-runtime'
import { ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types'
import { FamilyAutoPlanner, newFamilyAutoPlannerDocument } from './coordinator'
import { autoPlannerCatalogFromFinalRuntime } from './existingArchitecture'
import type { FamilyAutoPlannerPorts } from './ports'
import type {
  FamilyAutoPlannerAssignmentFact,
  FamilyAutoPlannerDocumentV1,
  FamilyAutoPlannerLearner,
  FamilyAutoPlannerSchoolPlanV1,
  FamilyAutoPlannerScope,
  FamilyAutoPlannerStoreLoad,
  FamilyAutoPlannerStoreSave,
} from './types'

const NOW = new Date('2026-08-14T13:00:00.000Z')
const MONDAY = new Date('2026-08-17T13:00:00.000Z')
const RELEASE_ROOT = '../../../../curriculum-release-admitted/family-pilot-r1/runtime/'

const manifest = JSON.parse(readFileSync(new URL(`${RELEASE_ROOT}runtime-manifest.json`, import.meta.url), 'utf8')) as FinalRuntimeManifest
const rowsByCourse = JSON.parse(readFileSync(new URL(`${RELEASE_ROOT}lesson-rows-by-course.json`, import.meta.url), 'utf8')) as Record<string, readonly FinalCourseLessonRow[]>
const lessonLoaders = Object.fromEntries(Object.entries(rowsByCourse).map(([courseRef, rows]) => [
  courseRef,
  async () => ({ default: rows }),
]))
const runtime = createFinalCurriculumRuntime<never>({
  manifest,
  lessonLoaders,
  productionMaterialResolver: {
    resolve: async () => ({ status: 'not-found', reason: 'Planner routing does not load lesson material.' }),
  },
})

function scope(learnerRef: string): FamilyAutoPlannerScope {
  return { householdRef: 'household:manuel', learnerRef }
}

function schoolPlan(subjects: readonly AcademySubject[]): FamilyAutoPlannerSchoolPlanV1 {
  return {
    schemaVersion: 1,
    householdTimeZone: 'America/Detroit',
    schoolYearStart: '2026-08-01',
    schoolYearEnd: '2027-06-30',
    schoolWeekdays: [1, 2, 3, 4, 5],
    nonSchoolDates: [],
    addedSchoolDates: [],
    subjects: subjects.map((subject, order) => ({
      subject,
      order,
      paused: false,
      lessonsPerDay: 1,
      startLocalTime: `${String(8 + Math.floor(order / 2)).padStart(2, '0')}:${order % 2 ? '30' : '00'}`,
    })),
    configuredAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  }
}

class MemoryStore {
  readonly documents = new Map<string, FamilyAutoPlannerDocumentV1>()

  key(value: FamilyAutoPlannerScope): string {
    return `${value.householdRef}\u0000${value.learnerRef}`
  }

  async load(value: FamilyAutoPlannerScope): Promise<FamilyAutoPlannerStoreLoad> {
    return {
      status: 'ready',
      document: this.documents.get(this.key(value)) ?? newFamilyAutoPlannerDocument(value, NOW.toISOString()),
    }
  }

  async save(
    value: FamilyAutoPlannerScope,
    document: FamilyAutoPlannerDocumentV1,
    expectedRevision: number,
  ): Promise<FamilyAutoPlannerStoreSave> {
    const current = this.documents.get(this.key(value))
    if ((current?.revision ?? 0) !== expectedRevision) return { status: 'conflict' }
    this.documents.set(this.key(value), document)
    return { status: 'saved', document }
  }
}

function harness() {
  const store = new MemoryStore()
  const learners = new Map<string, FamilyAutoPlannerLearner>()
  const assignments = new Map<string, FamilyAutoPlannerAssignmentFact[]>()
  let creates = 0

  function rows(learnerRef: string): FamilyAutoPlannerAssignmentFact[] {
    const held = assignments.get(learnerRef) ?? []
    assignments.set(learnerRef, held)
    return held
  }

  const ports: FamilyAutoPlannerPorts = {
    store,
    learners: { read: async ({ learnerRef }) => learners.get(learnerRef) ?? null },
    catalog: autoPlannerCatalogFromFinalRuntime(runtime),
    assignments: {
      list: async ({ learnerRef }) => Object.freeze([...rows(learnerRef)]),
      materializeLesson: async ({ learnerRef }, intent) => {
        const assignmentRef = `${learnerRef}:${intent.lesson.lessonRef}`
        const existing = rows(learnerRef).find((entry) => entry.assignmentRef === assignmentRef)
        if (existing) return existing
        creates += 1
        const created: FamilyAutoPlannerAssignmentFact = {
          assignmentRef,
          learnerRef,
          lessonRef: intent.lesson.lessonRef,
          subject: intent.subject,
          title: intent.lesson.title,
          state: 'planned',
          sessionRef: null,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
          completedAt: null,
          optional: false,
        }
        rows(learnerRef).push(created)
        return created
      },
    },
    assessments: {
      list: async () => [],
      materializeAssessment: async () => { throw new Error('First-unit lessons should precede assessment materialization.') },
    },
    holds: { list: async () => [] },
  }

  return {
    store,
    learners,
    assignments,
    creates: () => creates,
    planner: new FamilyAutoPlanner(ports, () => NOW),
  }
}

function addLearner(
  h: ReturnType<typeof harness>,
  learnerRef: string,
  nominalGrade: FamilyAutoPlannerLearner['nominalGrade'],
  workingGradeBySubject: FamilyAutoPlannerLearner['workingGradeBySubject'] = {},
  subjects: readonly AcademySubject[] = ACADEMY_SUBJECTS,
): void {
  h.learners.set(learnerRef, {
    learnerRef,
    displayName: learnerRef,
    nominalGrade,
    workingGradeBySubject,
    enabledSubjects: subjects,
    assignedCourseRefs: [],
  })
}

describe('Family Auto Planner R2 — canonical admitted curriculum matrix', () => {
  it('derives the nine supported grades and all 90 existing subject routes from the admitted runtime', () => {
    expect(runtime.listGrades()).toEqual(FINAL_CURRICULUM_GRADES)
    expect(runtime.listGrades()).not.toContain(6)
    const matrix = runtime.listGrades().flatMap((grade) =>
      runtime.listSubjects(grade).map((subject) => `${grade}:${subject}`),
    )
    expect(matrix).toHaveLength(90)
    for (const grade of runtime.listGrades()) {
      expect(runtime.listSubjects(grade)).toEqual(ACADEMY_SUBJECTS)
    }
  })

  describe.each(FINAL_CURRICULUM_GRADES)('GRADE_%s', (numericGrade) => {
    it('resolves every canonical course, advances to its next lesson, and never duplicates an assignment', async () => {
      const grade = String(numericGrade) as AcademyGrade
      const learnerRef = `learner:grade-${grade}`
      const h = harness()
      addLearner(h, learnerRef, grade)
      await h.planner.configure(scope(learnerRef), schoolPlan(ACADEMY_SUBJECTS))

      const first = await h.planner.today(scope(learnerRef), NOW)
      const repeatedFirst = await h.planner.today(scope(learnerRef), NOW)
      const coursesBySubject = new Map(runtime.listCourses(numericGrade).map((course) => [course.subject, course]))
      expect(first.status).toBe('READY')
      expect(first.items).toHaveLength(ACADEMY_SUBJECTS.length)
      expect(repeatedFirst).toEqual(first)
      expect(h.creates()).toBe(ACADEMY_SUBJECTS.length)
      for (const item of first.items) {
        const course = coursesBySubject.get(item.subject)!
        const lessons = await runtime.listLessons(course.courseRef)
        expect(item).toMatchObject({
          workingGrade: grade,
          courseRef: course.courseRef,
          lessonRef: lessons[0].lessonRef,
        })
      }

      h.assignments.set(learnerRef, h.assignments.get(learnerRef)!.map((entry) => ({
        ...entry,
        state: 'completed',
        updatedAt: NOW.toISOString(),
        completedAt: NOW.toISOString(),
      })))
      expect((await h.planner.today(scope(learnerRef), NOW)).status).toBe('COMPLETE_FOR_TODAY')

      const next = await h.planner.today(scope(learnerRef), MONDAY)
      const repeatedNext = await h.planner.today(scope(learnerRef), MONDAY)
      expect(next.status).toBe('READY')
      expect(next.items).toHaveLength(ACADEMY_SUBJECTS.length)
      expect(repeatedNext).toEqual(next)
      expect(h.creates()).toBe(ACADEMY_SUBJECTS.length * 2)
      for (const item of next.items) {
        const course = coursesBySubject.get(item.subject)!
        const lessons = await runtime.listLessons(course.courseRef)
        expect(item).toMatchObject({
          workingGrade: grade,
          courseRef: course.courseRef,
          lessonRef: lessons[1].lessonRef,
        })
      }
    })
  })

  it('explicitly refuses Grade 6 and only routes it through an authorized supported working level', async () => {
    const h = harness()
    addLearner(h, 'learner:grade-6', '6', {}, ['mathematics'])
    await h.planner.configure(scope('learner:grade-6'), schoolPlan(['mathematics']))
    const refused = await h.planner.today(scope('learner:grade-6'), NOW)
    expect(refused).toMatchObject({ status: 'NEEDS_PLAN_SETUP', reason: 'WORKING_GRADE_UNSUPPORTED' })
    expect(refused.items).toEqual([])
    expect(h.creates()).toBe(0)

    addLearner(h, 'learner:grade-6', '6', { mathematics: '5' }, ['mathematics'])
    const routed = await h.planner.today(scope('learner:grade-6'), NOW)
    expect(routed).toMatchObject({ status: 'READY' })
    expect(routed.items[0]).toMatchObject({ workingGrade: '5', courseRef: 'ma-g5-mathematics' })
    expect(h.learners.get('learner:grade-6')?.nominalGrade).toBe('6')
  })

  it('isolates concurrent elementary, middle, and high-school learners', async () => {
    const h = harness()
    const learners = [
      { ref: 'learner:elementary', grade: '3' as const },
      { ref: 'learner:middle', grade: '7' as const },
      { ref: 'learner:high', grade: '12' as const },
    ]
    for (const learner of learners) {
      addLearner(h, learner.ref, learner.grade)
      await h.planner.configure(scope(learner.ref), schoolPlan(ACADEMY_SUBJECTS))
    }
    const plans = await Promise.all(learners.map((learner) => h.planner.today(scope(learner.ref), NOW)))
    plans.forEach((plan, index) => {
      expect(plan.items).toHaveLength(ACADEMY_SUBJECTS.length)
      expect(new Set(plan.items.map((item) => item.learnerRef))).toEqual(new Set([learners[index].ref]))
      expect(plan.items.every((item) => item.workingGrade === learners[index].grade)).toBe(true)
    })
    expect(h.store.documents).toHaveLength(learners.length)
    expect(h.assignments).toHaveLength(learners.length)
    expect(h.creates()).toBe(learners.length * ACADEMY_SUBJECTS.length)
  })
})

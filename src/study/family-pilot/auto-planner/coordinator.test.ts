import { describe, expect, it } from 'vitest'
import type { FinalCatalogCourse, FinalCatalogLesson, FinalCatalogUnit } from '../../../curriculum/final-runtime'
import type { AcademySubject } from '../../../types'
import { FamilyAutoPlanner } from './coordinator'
import { createFamilyAutoPlannerDashboardPort, toExistingDailyScheduleInput } from './dashboardPort'
import { emptyFamilyAutoPlannerDocument } from './plan'
import type { FamilyAutoPlannerPorts } from './ports'
import { nextFamilyAutoPlannerStudyTarget } from './studyPort'
import type {
  FamilyAutoPlannerAssessmentFact,
  FamilyAutoPlannerAssignmentFact,
  FamilyAutoPlannerDocumentV1,
  FamilyAutoPlannerLearner,
  FamilyAutoPlannerSchoolPlanV1,
  FamilyAutoPlannerScope,
  FamilyAutoPlannerStorePort,
} from './types'

const HOUSEHOLD = 'household:manuel'
const NOW = new Date('2026-08-14T13:00:00.000Z')

function scope(learnerRef: string): FamilyAutoPlannerScope {
  return { householdRef: HOUSEHOLD, learnerRef }
}

function plan(subjects: readonly AcademySubject[] = ['mathematics']): FamilyAutoPlannerSchoolPlanV1 {
  return {
    schemaVersion: 1,
    householdTimeZone: 'America/Detroit',
    schoolYearStart: '2026-08-01',
    schoolYearEnd: '2027-06-30',
    schoolWeekdays: [1, 2, 3, 4, 5],
    nonSchoolDates: [], addedSchoolDates: [],
    subjects: subjects.map((subject, order) => ({ subject, order, paused: false, lessonsPerDay: 1, startLocalTime: '09:00' })),
    configuredAt: NOW.toISOString(), updatedAt: NOW.toISOString(),
  }
}

function catalog(subject: AcademySubject = 'mathematics') {
  const courseRef = `ma-g5-${subject}`
  const unitRef = `${courseRef}-u01`
  const course: FinalCatalogCourse = {
    courseRef, grade: 5, subject, title: subject, days: 2, unitCount: 1, lessonCount: 2,
  }
  const lessons: FinalCatalogLesson[] = [1, 2].map((number) => ({
    lessonRef: `${unitRef}-l0${number}`, courseRef, unitRef, grade: 5, subject,
    unitNumber: 1, dayInUnit: number, courseDay: number, title: `${subject} ${number}`,
    estimatedMinutes: '30', resourceRefs: [],
    sourceReadiness: { state: 'ready', dynamicSource: false, sourceRefs: [] },
  }))
  const unit: FinalCatalogUnit = {
    unitRef, courseRef, grade: 5, subject, unitNumber: 1, title: 'Unit 1', days: 2,
    essentialQuestion: '?', assessmentRef: null, lessonRefs: lessons.map((entry) => entry.lessonRef),
  }
  return { course, unit, lessons }
}

class MemoryStore implements FamilyAutoPlannerStorePort {
  readonly documents = new Map<string, FamilyAutoPlannerDocumentV1>()

  key(value: FamilyAutoPlannerScope) { return `${value.householdRef}|${value.learnerRef}` }

  async load(value: FamilyAutoPlannerScope) {
    return { status: 'ready' as const, document: this.documents.get(this.key(value)) ?? emptyFamilyAutoPlannerDocument(value, NOW.toISOString()) }
  }

  async save(value: FamilyAutoPlannerScope, document: FamilyAutoPlannerDocumentV1, expectedRevision: number) {
    const current = this.documents.get(this.key(value))
    if ((current?.revision ?? 0) !== expectedRevision) return { status: 'conflict' as const }
    this.documents.set(this.key(value), document)
    return { status: 'saved' as const, document }
  }
}

function harness() {
  const store = new MemoryStore()
  const learners = new Map<string, FamilyAutoPlannerLearner>()
  const assignments = new Map<string, FamilyAutoPlannerAssignmentFact[]>()
  const assessments = new Map<string, FamilyAutoPlannerAssessmentFact[]>()
  const math = catalog()
  let offline = false
  let lessonCreates = 0
  let assessmentCreates = 0

  function rows(ref: string): FamilyAutoPlannerAssignmentFact[] {
    const held = assignments.get(ref) ?? []
    assignments.set(ref, held)
    return held
  }

  const ports: FamilyAutoPlannerPorts = {
    store,
    learners: { read: async ({ learnerRef }) => learners.get(learnerRef) ?? null },
    catalog: {
      listCourses: () => {
        if (offline) throw new Error('offline')
        return [math.course]
      },
      listUnits: () => [math.unit],
      listLessons: async () => math.lessons,
    },
    assignments: {
      list: async ({ learnerRef }) => Object.freeze([...rows(learnerRef)]),
      materializeLesson: async ({ learnerRef }, intent) => {
        lessonCreates += 1
        const assignmentRef = `${learnerRef}:${intent.lesson.lessonRef}`
        const existing = rows(learnerRef).find((entry) => entry.assignmentRef === assignmentRef)
        if (existing) return existing
        const created: FamilyAutoPlannerAssignmentFact = {
          assignmentRef, learnerRef, lessonRef: intent.lesson.lessonRef, subject: intent.subject,
          title: intent.lesson.title, state: 'planned', sessionRef: null,
          createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), completedAt: null, optional: false,
        }
        rows(learnerRef).push(created)
        return created
      },
    },
    assessments: {
      list: async ({ learnerRef }) => Object.freeze([...(assessments.get(learnerRef) ?? [])]),
      materializeAssessment: async ({ learnerRef }, intent) => {
        assessmentCreates += 1
        const created: FamilyAutoPlannerAssessmentFact = {
          assignmentRef: `${learnerRef}:${intent.assessmentRef}`, learnerRef,
          assessmentRef: intent.assessmentRef, courseRef: intent.courseRef, subject: intent.subject,
          title: intent.title, status: 'PLANNED', createdAt: NOW.toISOString(), updatedAt: NOW.toISOString(), completedAt: null,
        }
        assessments.set(learnerRef, [created])
        return created
      },
    },
    holds: { list: async () => [] },
  }
  return {
    store, learners, assignments, assessments, math, ports,
    planner: new FamilyAutoPlanner(ports, () => NOW),
    setOffline: (value: boolean) => { offline = value },
    lessonCreates: () => lessonCreates,
    assessmentCreates: () => assessmentCreates,
  }
}

function addLearner(h: ReturnType<typeof harness>, ref: string): void {
  h.learners.set(ref, {
    learnerRef: ref, displayName: ref, nominalGrade: '5', workingGradeBySubject: {},
    enabledSubjects: ['mathematics'], assignedCourseRefs: [],
  })
}

describe('FamilyAutoPlanner coordinator', () => {
  it('requires one explicit school-plan configuration before materializing work', async () => {
    const h = harness()
    addLearner(h, 'learner:ada')
    const before = await h.planner.today(scope('learner:ada'), NOW)
    expect(before).toMatchObject({ status: 'NEEDS_PLAN_SETUP', reason: 'SCHOOL_PLAN_MISSING' })
    expect(h.lessonCreates()).toBe(0)

    await expect(h.planner.configure(scope('learner:ada'), plan())).resolves.toMatchObject({ status: 'saved' })
    expect((await h.planner.today(scope('learner:ada'), NOW)).status).toBe('READY')
  })

  it('is idempotent on repeated same-day calls and keeps deterministic refs', async () => {
    const h = harness()
    addLearner(h, 'learner:ada')
    await h.planner.configure(scope('learner:ada'), plan())
    const first = await h.planner.today(scope('learner:ada'), NOW)
    const second = await h.planner.today(scope('learner:ada'), NOW)
    expect(first).toEqual(second)
    expect(h.lessonCreates()).toBe(1)
    expect(first.items).toHaveLength(1)
    expect(h.store.documents.get(h.store.key(scope('learner:ada')))?.materializations).toHaveLength(1)
  })

  it('carries incomplete work, closes today at the cap, and advances next school day', async () => {
    const h = harness()
    addLearner(h, 'learner:ada')
    await h.planner.configure(scope('learner:ada'), plan())
    const friday = await h.planner.today(scope('learner:ada'), NOW)
    const fact = h.assignments.get('learner:ada')![0]
    const mondayBeforeCompletion = await h.planner.today(scope('learner:ada'), new Date('2026-08-17T13:00:00.000Z'))
    expect(mondayBeforeCompletion.items[0]).toMatchObject({ assignmentRef: fact.assignmentRef, carriedForwardFromDate: '2026-08-14' })
    expect(h.lessonCreates()).toBe(1)

    h.assignments.set('learner:ada', [{ ...fact, state: 'completed', completedAt: NOW.toISOString() }])
    const sameFriday = await h.planner.today(scope('learner:ada'), NOW)
    expect(sameFriday.status).toBe('COMPLETE_FOR_TODAY')
    const monday = await h.planner.today(scope('learner:ada'), new Date('2026-08-17T13:00:00.000Z'))
    expect(monday.items[0].lessonRef).toBe(h.math.lessons[1].lessonRef)
    expect(h.lessonCreates()).toBe(2)
    expect(friday.items[0].assignmentRef).not.toBe(monday.items[0].assignmentRef)
  })

  it('keeps learners isolated in assignments and durable provenance', async () => {
    const h = harness()
    addLearner(h, 'learner:ada')
    addLearner(h, 'learner:bea')
    await h.planner.configure(scope('learner:ada'), plan())
    await h.planner.configure(scope('learner:bea'), plan())
    const [ada, bea] = await Promise.all([
      h.planner.today(scope('learner:ada'), NOW),
      h.planner.today(scope('learner:bea'), NOW),
    ])
    expect(ada.items[0].learnerRef).toBe('learner:ada')
    expect(bea.items[0].learnerRef).toBe('learner:bea')
    expect(ada.items[0].assignmentRef).not.toBe(bea.items[0].assignmentRef)
    expect(h.store.documents).toHaveLength(2)
  })

  it('remains usable offline after work has been materialized', async () => {
    const h = harness()
    addLearner(h, 'learner:ada')
    await h.planner.configure(scope('learner:ada'), plan())
    const online = await h.planner.today(scope('learner:ada'), NOW)
    h.setOffline(true)
    const offline = await h.planner.today(scope('learner:ada'), NOW)
    expect(offline).toMatchObject({ status: 'READY', offlineMaterializedWorkAvailable: true })
    expect(offline.items[0].assignmentRef).toBe(online.items[0].assignmentRef)
    expect(h.lessonCreates()).toBe(1)
  })

  it('exposes existing schedule and Study integration ports without another engine', async () => {
    const h = harness()
    addLearner(h, 'learner:ada')
    await h.planner.configure(scope('learner:ada'), plan())
    const dashboard = createFamilyAutoPlannerDashboardPort(h.planner)
    const today = await dashboard.getTodayWork(scope('learner:ada'), NOW)
    const schedule = toExistingDailyScheduleInput(today)
    expect(schedule).toMatchObject({ studentRef: 'learner:ada', date: '2026-08-14' })
    expect(schedule.items[0]).toMatchObject({ kind: 'assignment', assignmentRef: today.items[0].assignmentRef })
    expect(nextFamilyAutoPlannerStudyTarget(today)).toEqual({
      learnerRef: 'learner:ada', assignmentRef: today.items[0].assignmentRef, lessonRef: today.items[0].lessonRef,
    })
  })
})

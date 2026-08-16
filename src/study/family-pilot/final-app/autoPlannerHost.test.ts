import { describe, expect, it } from 'vitest'
import type { FinalCatalogCourse, FinalCatalogLesson, FinalCatalogUnit } from '../../../curriculum/final-runtime'
import type { AcademyGrade, AcademySubject } from '../../../types'
import type { FamilyPilotAssignmentRecordV1, FamilyPilotStateV1 } from '../core'
import {
  emptyFamilyAutoPlannerDocument,
  type FamilyAutoPlannerDocumentV1,
  type FamilyAutoPlannerSchoolPlanV1,
  type FamilyAutoPlannerScope,
  type FamilyAutoPlannerStorePort,
} from '../auto-planner'
import type { FamilySetupStudent } from '../setup'
import { FinalFamilyAutoPlannerHost } from './autoPlannerHost'
import type { FinalFamilyPilotController } from './controller'

const FRIDAY = new Date('2026-08-14T13:00:00.000Z')

class MemoryStore implements FamilyAutoPlannerStorePort {
  readonly documents = new Map<string, FamilyAutoPlannerDocumentV1>()
  key(scope: FamilyAutoPlannerScope) { return `${scope.householdRef}|${scope.learnerRef}` }
  async load(scope: FamilyAutoPlannerScope) {
    return { status: 'ready' as const, document: this.documents.get(this.key(scope)) ?? emptyFamilyAutoPlannerDocument(scope, FRIDAY.toISOString()) }
  }
  async save(scope: FamilyAutoPlannerScope, document: FamilyAutoPlannerDocumentV1, expectedRevision: number) {
    const current = this.documents.get(this.key(scope))
    if ((current?.revision ?? 0) !== expectedRevision) return { status: 'conflict' as const }
    this.documents.set(this.key(scope), document)
    return { status: 'saved' as const, document }
  }
}

function curriculum(grade: AcademyGrade, subject: AcademySubject) {
  const courseRef = `ma-g${grade}-${subject}`
  const unitRef = `${courseRef}-u01`
  const course: FinalCatalogCourse = { courseRef, grade: Number(grade) as never, subject, title: `${subject} ${grade}`, days: 2, unitCount: 1, lessonCount: 2 }
  const lessons: FinalCatalogLesson[] = [1, 2].map((day) => ({
    lessonRef: `${unitRef}-l0${day}`, courseRef, unitRef, grade: Number(grade) as never, subject,
    unitNumber: 1, dayInUnit: day, courseDay: day, title: `${subject} lesson ${day}`,
    estimatedMinutes: '30', resourceRefs: [], sourceReadiness: { state: 'ready', dynamicSource: false, sourceRefs: [] },
  }))
  const unit: FinalCatalogUnit = {
    unitRef, courseRef, grade: Number(grade) as never, subject, unitNumber: 1, title: 'Unit 1', days: 2,
    essentialQuestion: '?', assessmentRef: null, lessonRefs: lessons.map((item) => item.lessonRef),
  }
  return { course, unit, lessons }
}

function student(ref: string, nominalGrade: FamilySetupStudent['nominalGrade'], workingGrade?: AcademyGrade): FamilySetupStudent {
  return Object.freeze({
    studentRef: ref, displayName: ref, nominalGrade,
    workingGradeBySubject: Object.freeze(workingGrade ? { mathematics: workingGrade } : {}),
    enabledSubjects: Object.freeze(['mathematics'] as AcademySubject[]), pinRequired: false,
    createdAt: FRIDAY.toISOString(), updatedAt: FRIDAY.toISOString(),
  })
}

function plan(courseRef: string, overrides: Partial<FamilyAutoPlannerSchoolPlanV1> = {}): FamilyAutoPlannerSchoolPlanV1 {
  return Object.freeze({
    schemaVersion: 1, householdTimeZone: 'America/Detroit', schoolYearStart: '2026-08-01', schoolYearEnd: '2027-06-30',
    schoolWeekdays: Object.freeze([1, 2, 3, 4, 5] as const), nonSchoolDates: Object.freeze([]), addedSchoolDates: Object.freeze([]),
    subjects: Object.freeze([{ subject: 'mathematics' as const, order: 0, paused: false, courseRef, lessonsPerDay: 1, startLocalTime: '09:00' }]),
    configuredAt: FRIDAY.toISOString(), updatedAt: FRIDAY.toISOString(), ...overrides,
  })
}

function harness() {
  const grade5 = curriculum('5', 'mathematics')
  const grade7 = curriculum('7', 'mathematics')
  const learners = [student('student:elementary', '5'), student('student:middle', '7'), student('student:high', '10', '5')]
  const assignments = new Map<string, FamilyPilotAssignmentRecordV1[]>()
  let creates = 0
  const rows = (learnerRef: string) => {
    const held = assignments.get(learnerRef) ?? []
    assignments.set(learnerRef, held)
    return held
  }
  const state = (): FamilyPilotStateV1 => Object.freeze({
    schemaVersion: 1, updatedAt: FRIDAY.toISOString(), activeStudentRef: null,
    students: Object.freeze(learners.map((learner) => Object.freeze({
      studentRef: learner.studentRef, displayName: learner.displayName, createdAt: FRIDAY.toISOString(), updatedAt: FRIDAY.toISOString(),
      activeAssignmentRef: null, assignments: Object.freeze([...rows(learner.studentRef)]),
    }))),
  })
  const all = [grade5, grade7]
  const fake = {
    catalog: {
      runtime: {
        listGrades: () => [5, 7],
        listCourses: (grade?: number) => all.filter((item) => grade === undefined || item.course.grade === grade).map((item) => item.course),
        listUnits: (courseRef: string) => all.filter((item) => item.course.courseRef === courseRef).map((item) => item.unit),
        listLessons: async (courseRef: string) => all.find((item) => item.course.courseRef === courseRef)?.lessons ?? [],
      },
    },
    appSnapshot: {
      status: 'ready', safetyRecovery: 'available', reasonCode: null,
      state: {
        householdRef: 'household:test', setup: { students: learners, completedAt: FRIDAY.toISOString() },
        safety: { schemaVersion: 1, holds: [] }, attestations: [], assessmentAssignments: [],
      },
    },
    get coreSnapshot() { return { status: 'ready', reasonCode: null, state: state() } },
    coursesFor: (learner: FamilySetupStudent, subject?: AcademySubject) => {
      const grade = learner.workingGradeBySubject.mathematics ?? learner.nominalGrade
      return all.filter((item) => item.course.grade === Number(grade) && (!subject || subject === item.course.subject)).map((item) => item.course)
    },
    assignLesson: async (learnerRef: string, lessonRef: string) => {
      const lesson = all.flatMap((item) => item.lessons).find((item) => item.lessonRef === lessonRef)!
      const assignmentRef = `assignment:${learnerRef}:${lessonRef}`
      const existing = rows(learnerRef).find((item) => item.assignmentRef === assignmentRef)
      if (existing) return existing
      creates += 1
      const created: FamilyPilotAssignmentRecordV1 = Object.freeze({
        assignmentRef, lessonRef, subject: lesson.subject, title: lesson.title, state: 'planned', sessionRef: null,
        progress: Object.freeze({ completedSegmentRefs: Object.freeze([]), totalSegments: 2, lastSegmentRef: null, activeSeconds: 0 }),
        pause: Object.freeze({ pausedAt: null, resumedAt: null, pausedSeconds: 0, resumeSegmentRef: null }),
        completedAt: null, createdAt: FRIDAY.toISOString(), updatedAt: FRIDAY.toISOString(), rawAnswerIncluded: false, transcriptIncluded: false,
      })
      rows(learnerRef).push(created)
      return created
    },
    assessmentAssignments: () => [],
    assignAssessment: async () => { throw new Error('not used') },
  }
  const store = new MemoryStore()
  const controller = fake as unknown as FinalFamilyPilotController
  const host = new FinalFamilyAutoPlannerHost(controller, { store, now: () => FRIDAY })
  return { host, store, assignments, learners, grade5, grade7, creates: () => creates }
}

describe('FinalFamilyAutoPlannerHost convergence', () => {
  it('requires explicit Parent setup, then materializes through existing assignment authority exactly once', async () => {
    const h = harness()
    const before = await h.host.dashboardFor('student:elementary', FRIDAY)
    expect(before).toMatchObject({ plan: { status: 'NEEDS_PLAN_SETUP', reason: 'SCHOOL_PLAN_MISSING' }, schedule: [] })
    expect(h.creates()).toBe(0)

    await expect(h.host.configure(h.host.scope('student:elementary'), plan(h.grade5.course.courseRef))).resolves.toMatchObject({ status: 'saved' })
    const first = await h.host.dashboardFor('student:elementary', FRIDAY)
    const repeat = await h.host.dashboardFor('student:elementary', FRIDAY)
    expect(first.plan.status).toBe('READY')
    expect(first.schedule).toHaveLength(1)
    expect(repeat.schedule[0]?.assignmentRef).toBe(first.schedule[0]?.assignmentRef)
    expect(h.creates()).toBe(1)
  })

  it('carries unfinished work, retains same-day completion, and chooses the next canonical lesson next school day', async () => {
    const h = harness()
    await h.host.configure(h.host.scope('student:elementary'), plan(h.grade5.course.courseRef))
    const friday = await h.host.dashboardFor('student:elementary', FRIDAY)
    const record = h.assignments.get('student:elementary')![0]!
    const monday = new Date('2026-08-17T13:00:00.000Z')
    const carried = await h.host.dashboardFor('student:elementary', monday)
    expect(carried.plan.items[0]).toMatchObject({ assignmentRef: record.assignmentRef, carriedForwardFromDate: '2026-08-14' })
    expect(h.creates()).toBe(1)

    h.assignments.set('student:elementary', [Object.freeze({ ...record, state: 'completed', completedAt: FRIDAY.toISOString(), updatedAt: FRIDAY.toISOString() })])
    const completeFriday = await h.host.dashboardFor('student:elementary', FRIDAY)
    expect(completeFriday.plan.status).toBe('COMPLETE_FOR_TODAY')
    expect(completeFriday.schedule[0]).toMatchObject({ assignmentRef: record.assignmentRef, status: 'completed' })
    const next = await h.host.dashboardFor('student:elementary', monday)
    expect(next.plan.items[0]?.lessonRef).toBe(h.grade5.lessons[1]?.lessonRef)
    expect(next.plan.items[0]?.assignmentRef).not.toBe(friday.plan.items[0]?.assignmentRef)
  })

  it('isolates elementary, middle, and nominal/working-grade-divergent high-school learners', async () => {
    const h = harness()
    await Promise.all([
      h.host.configure(h.host.scope('student:elementary'), plan(h.grade5.course.courseRef)),
      h.host.configure(h.host.scope('student:middle'), plan(h.grade7.course.courseRef)),
      h.host.configure(h.host.scope('student:high'), plan(h.grade5.course.courseRef)),
    ])
    const [elementary, middle, high] = await Promise.all(h.learners.map((learner) => h.host.dashboardFor(learner.studentRef, FRIDAY)))
    expect(elementary.plan.items[0]).toMatchObject({ learnerRef: 'student:elementary', workingGrade: '5' })
    expect(middle.plan.items[0]).toMatchObject({ learnerRef: 'student:middle', workingGrade: '7' })
    expect(high.plan.items[0]).toMatchObject({ learnerRef: 'student:high', workingGrade: '5' })
    expect(new Set([elementary, middle, high].map((item) => item.plan.items[0]?.assignmentRef)).size).toBe(3)
    expect(h.store.documents).toHaveLength(3)
  })

  it('creates no ordinary work on weekends or explicit days off and honors an explicit added school day', async () => {
    const h = harness()
    const configured = plan(h.grade5.course.courseRef, { nonSchoolDates: ['2026-08-14'], addedSchoolDates: ['2026-08-15'] })
    await h.host.configure(h.host.scope('student:elementary'), configured)
    expect((await h.host.dashboardFor('student:elementary', FRIDAY)).plan.status).toBe('NO_SCHOOL_TODAY')
    expect(h.creates()).toBe(0)
    const saturday = await h.host.dashboardFor('student:elementary', new Date('2026-08-15T13:00:00.000Z'))
    expect(saturday.plan.status).toBe('READY')
    expect(h.creates()).toBe(1)
  })

  it('uses accepted CAS/idempotency semantics under two fast dashboard requests', async () => {
    const h = harness()
    await h.host.configure(h.host.scope('student:elementary'), plan(h.grade5.course.courseRef))
    const [left, right] = await Promise.all([
      h.host.dashboardFor('student:elementary', FRIDAY),
      h.host.dashboardFor('student:elementary', FRIDAY),
    ])
    expect(left.schedule[0]?.assignmentRef).toBe(right.schedule[0]?.assignmentRef)
    expect(h.assignments.get('student:elementary')).toHaveLength(1)
    expect(h.store.documents.get(h.store.key(h.host.scope('student:elementary')))?.materializations).toHaveLength(1)
  })

  it('materializes optional work only on the learner action and adopts the same unfinished assignment later', async () => {
    const h = harness()
    const mondayOnly = plan(h.grade5.course.courseRef, {
      allowWorkAhead: true,
      subjects: [{
        subject: 'mathematics', order: 0, paused: false,
        schoolWeekdays: [1], courseRef: h.grade5.course.courseRef,
        lessonsPerDay: 1, startLocalTime: '09:00',
      }],
    })
    await h.host.configure(h.host.scope('student:elementary'), mondayOnly)
    const friday = await h.host.dashboardFor('student:elementary', FRIDAY)
    expect(friday).toMatchObject({ plan: { status: 'COMPLETE_FOR_TODAY' }, schedule: [] })
    expect(h.creates()).toBe(0)

    const course = await h.host.courseViewFor('student:elementary', h.grade5.course.courseRef, friday.plan)
    expect(course).toMatchObject({
      todayStatus: 'NOT_REQUIRED_TODAY', workAheadAllowed: true,
      next: { lessonRef: h.grade5.lessons[0].lessonRef, assignmentRef: null },
      action: { type: 'START_WORK_AHEAD' },
    })
    expect(h.creates()).toBe(0)

    const assignmentRef = await h.host.startWorkAhead('student:elementary', h.grade5.course.courseRef, h.grade5.lessons[0].lessonRef)
    expect(h.creates()).toBe(1)
    expect(h.store.documents.get(h.store.key(h.host.scope('student:elementary')))?.materializations[0]).toMatchObject({
      assignmentRef, provenance: 'LEARNER_WORK_AHEAD', localDate: '2026-08-14',
    })
    const stillOptional = await h.host.dashboardFor('student:elementary', FRIDAY)
    expect(stillOptional).toMatchObject({ plan: { status: 'COMPLETE_FOR_TODAY' }, schedule: [] })

    const monday = await h.host.dashboardFor('student:elementary', new Date('2026-08-17T13:00:00.000Z'))
    expect(monday.plan.items).toHaveLength(1)
    expect(monday.plan.items[0]).toMatchObject({
      assignmentRef, origin: 'LEARNER_WORK_AHEAD', carriedForwardFromDate: '2026-08-14',
    })
    expect(monday.schedule[0]?.assignmentRef).toBe(assignmentRef)
    expect(h.creates()).toBe(1)
  })

  it('skips early completion on the next planned day and honors the Parent disable policy', async () => {
    const h = harness()
    const mondayOnly = plan(h.grade5.course.courseRef, {
      allowWorkAhead: true,
      subjects: [{
        subject: 'mathematics', order: 0, paused: false, schoolWeekdays: [1],
        courseRef: h.grade5.course.courseRef, lessonsPerDay: 1, startLocalTime: '09:00',
      }],
    })
    await h.host.configure(h.host.scope('student:elementary'), mondayOnly)
    const friday = await h.host.dashboardFor('student:elementary', FRIDAY)
    const firstRef = await h.host.startWorkAhead('student:elementary', h.grade5.course.courseRef, h.grade5.lessons[0].lessonRef)
    const first = h.assignments.get('student:elementary')![0]!
    h.assignments.set('student:elementary', [Object.freeze({
      ...first, state: 'completed', completedAt: FRIDAY.toISOString(), updatedAt: FRIDAY.toISOString(),
    })])
    const optionalComplete = await h.host.dashboardFor('student:elementary', FRIDAY)
    expect(optionalComplete.schedule).toEqual([])
    const monday = await h.host.dashboardFor('student:elementary', new Date('2026-08-17T13:00:00.000Z'))
    expect(monday.plan.items[0]).toMatchObject({ lessonRef: h.grade5.lessons[1].lessonRef })
    expect(monday.plan.items[0]?.assignmentRef).not.toBe(firstRef)

    const disabled = plan(h.grade5.course.courseRef, {
      allowWorkAhead: false,
      subjects: [{
        subject: 'mathematics', order: 0, paused: false, schoolWeekdays: [1],
        courseRef: h.grade5.course.courseRef, lessonsPerDay: 1, startLocalTime: '09:00',
      }],
    })
    const other = h.host.scope('student:high')
    await h.host.configure(other, disabled)
    const highFriday = await h.host.dashboardFor('student:high', FRIDAY)
    const course = await h.host.courseViewFor('student:high', h.grade5.course.courseRef, highFriday.plan)
    expect(course).toMatchObject({ workAheadAllowed: false, action: null })
    expect(course.gate?.message).toContain('according to your School Plan')
    await expect(h.host.startWorkAhead('student:high', h.grade5.course.courseRef, h.grade5.lessons[0].lessonRef))
      .rejects.toThrow('not enabled')
  })
})

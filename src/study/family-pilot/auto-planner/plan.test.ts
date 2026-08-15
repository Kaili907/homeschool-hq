import { describe, expect, it } from 'vitest'
import type { FinalCatalogCourse, FinalCatalogLesson, FinalCatalogUnit } from '../../../curriculum/final-runtime'
import { ACADEMY_GRADES, ACADEMY_SUBJECTS, type AcademyGrade, type AcademySubject } from '../../../types'
import { computeFamilyAutoPlanner, emptyFamilyAutoPlannerDocument } from './plan'
import type {
  FamilyAutoPlannerAssessmentFact,
  FamilyAutoPlannerAssignmentFact,
  FamilyAutoPlannerCourseBundle,
  FamilyAutoPlannerDocumentV1,
  FamilyAutoPlannerLearner,
  FamilyAutoPlannerMaterializationV1,
  FamilyAutoPlannerSchoolPlanV1,
  FamilyAutoPlannerScope,
} from './types'

const SCOPE: FamilyAutoPlannerScope = { householdRef: 'household:manuel', learnerRef: 'learner:ada' }
const NOW = '2026-08-14T13:00:00.000Z'

function schoolPlan(
  subjects: readonly AcademySubject[],
  patch: Partial<FamilyAutoPlannerSchoolPlanV1> = {},
): FamilyAutoPlannerSchoolPlanV1 {
  return {
    schemaVersion: 1,
    householdTimeZone: 'America/Detroit',
    schoolYearStart: '2026-08-01',
    schoolYearEnd: '2027-06-30',
    schoolWeekdays: [1, 2, 3, 4, 5],
    nonSchoolDates: [],
    addedSchoolDates: [],
    subjects: subjects.map((subject, order) => ({
      subject, order, paused: false, lessonsPerDay: 1, startLocalTime: `${String(9 + Math.floor(order / 2)).padStart(2, '0')}:${order % 2 ? '30' : '00'}`,
    })),
    configuredAt: NOW,
    updatedAt: NOW,
    ...patch,
  }
}

function learner(
  grade: FamilyAutoPlannerLearner['nominalGrade'] = '5',
  subjects: readonly AcademySubject[] = ['mathematics'],
  working: FamilyAutoPlannerLearner['workingGradeBySubject'] = {},
  ref = SCOPE.learnerRef,
): FamilyAutoPlannerLearner {
  return {
    learnerRef: ref,
    displayName: ref,
    nominalGrade: grade,
    workingGradeBySubject: working,
    enabledSubjects: subjects,
    assignedCourseRefs: [],
  }
}

function bundle(
  grade: AcademyGrade,
  subject: AcademySubject,
  lessonCount = 2,
  withAssessment = false,
): FamilyAutoPlannerCourseBundle {
  const courseRef = `ma-g${grade}-${subject}`
  const unitRef = `${courseRef}-u01`
  const course: FinalCatalogCourse = {
    courseRef, grade: Number(grade) as FinalCatalogCourse['grade'], subject,
    title: `${grade} ${subject}`, days: lessonCount, unitCount: 1, lessonCount,
  }
  const lessons: FinalCatalogLesson[] = Array.from({ length: lessonCount }, (_, index) => ({
    lessonRef: `${unitRef}-l${String(index + 1).padStart(2, '0')}`,
    courseRef,
    unitRef,
    grade: Number(grade) as FinalCatalogLesson['grade'],
    subject,
    unitNumber: 1,
    dayInUnit: index + 1,
    courseDay: index + 1,
    title: `${subject} lesson ${index + 1}`,
    estimatedMinutes: '30',
    resourceRefs: [],
    sourceReadiness: { state: 'ready', dynamicSource: false, sourceRefs: [] },
  }))
  const unit: FinalCatalogUnit = {
    unitRef, courseRef, grade: Number(grade) as FinalCatalogUnit['grade'], subject,
    unitNumber: 1, title: 'Unit 1', days: lessonCount, essentialQuestion: '?',
    assessmentRef: withAssessment ? `${unitRef}-assessment` : null,
    lessonRefs: lessons.map((lesson) => lesson.lessonRef),
  }
  return { course, units: [unit], lessons }
}

function document(plan: FamilyAutoPlannerSchoolPlanV1, materializations: readonly FamilyAutoPlannerMaterializationV1[] = []): FamilyAutoPlannerDocumentV1 {
  return { ...emptyFamilyAutoPlannerDocument(SCOPE, NOW), revision: 1, schoolPlan: plan, materializations }
}

function assignment(
  lessonRef: string,
  subject: AcademySubject = 'mathematics',
  state: FamilyAutoPlannerAssignmentFact['state'] = 'planned',
  patch: Partial<FamilyAutoPlannerAssignmentFact> = {},
): FamilyAutoPlannerAssignmentFact {
  return {
    assignmentRef: `assignment:${lessonRef}`,
    learnerRef: SCOPE.learnerRef,
    lessonRef,
    subject,
    title: lessonRef,
    state,
    sessionRef: state === 'active' || state === 'paused' ? `session:${lessonRef}` : null,
    createdAt: '2026-08-13T13:00:00.000Z',
    updatedAt: NOW,
    completedAt: state === 'completed' ? NOW : null,
    optional: false,
    ...patch,
  }
}

function materialized(
  fact: FamilyAutoPlannerAssignmentFact,
  course: FamilyAutoPlannerCourseBundle,
  localDate = '2026-08-13',
): FamilyAutoPlannerMaterializationV1 {
  return {
    materializationRef: `auto:${localDate}:${fact.subject}:fixture`,
    kind: 'LESSON',
    localDate,
    subject: fact.subject,
    workingGrade: String(course.course.grade) as AcademyGrade,
    courseRef: course.course.courseRef,
    unitRef: course.units[0].unitRef,
    itemRef: fact.lessonRef,
    assignmentRef: fact.assignmentRef,
    title: fact.title,
    createdAt: '2026-08-13T13:00:00.000Z',
  }
}

function compute(input: {
  plan?: FamilyAutoPlannerSchoolPlanV1 | null
  learner?: FamilyAutoPlannerLearner | null
  assignments?: readonly FamilyAutoPlannerAssignmentFact[]
  assessments?: readonly FamilyAutoPlannerAssessmentFact[]
  materializations?: readonly FamilyAutoPlannerMaterializationV1[]
  catalog?: readonly FamilyAutoPlannerCourseBundle[] | null
  instant?: string
  holds?: readonly { learnerRef: string; sessionRef: string; status: string; reasonCode: string }[]
}) {
  const plan = input.plan === undefined ? schoolPlan(['mathematics']) : input.plan
  return computeFamilyAutoPlanner({
    scope: SCOPE,
    instant: new Date(input.instant ?? NOW),
    document: document(plan ?? schoolPlan(['mathematics']), input.materializations ?? []),
    learner: input.learner === undefined ? learner() : input.learner,
    assignments: input.assignments ?? [],
    assessments: input.assessments ?? [],
    holds: input.holds ?? [],
    catalog: input.catalog === undefined ? [bundle('5', 'mathematics')] : input.catalog,
  })
}

describe('Family Auto Planner R1 — school-local calendar', () => {
  it('uses the configured school time zone across the UTC midnight boundary', () => {
    const fridayInDetroit = compute({ instant: '2026-08-15T03:30:00.000Z' })
    expect(fridayInDetroit.plan.localDate).toBe('2026-08-14')
    expect(fridayInDetroit.plan.status).toBe('READY')

    const saturdayInDetroit = compute({ instant: '2026-08-15T04:30:00.000Z' })
    expect(saturdayInDetroit.plan.localDate).toBe('2026-08-15')
    expect(saturdayInDetroit.plan.status).toBe('NO_SCHOOL_TODAY')
    expect(saturdayInDetroit.intents).toEqual([])
  })

  it('honors explicit days off and added school days deterministically', () => {
    const off = schoolPlan(['mathematics'], { nonSchoolDates: ['2026-08-14'] })
    expect(compute({ plan: off }).plan.status).toBe('NO_SCHOOL_TODAY')
    const added = schoolPlan(['mathematics'], { addedSchoolDates: ['2026-08-15'] })
    expect(compute({ plan: added, instant: '2026-08-15T13:00:00.000Z' }).plan.status).toBe('READY')
  })
})

describe('Family Auto Planner R1 — carry-forward and overrides', () => {
  it('preserves the exact unfinished assignment across rollover', () => {
    const course = bundle('5', 'mathematics')
    const fact = assignment(course.lessons[0].lessonRef, 'mathematics', 'active')
    const result = compute({ assignments: [fact], materializations: [materialized(fact, course)], catalog: null })
    expect(result.plan).toMatchObject({ status: 'READY', offlineMaterializedWorkAvailable: true })
    expect(result.plan.items[0]).toMatchObject({
      assignmentRef: fact.assignmentRef,
      state: 'IN_PROGRESS',
      materializedForDate: '2026-08-13',
      carriedForwardFromDate: '2026-08-13',
    })
    expect(result.intents).toEqual([])
  })

  it('treats an untracked parent assignment as the same-subject override', () => {
    const course = bundle('5', 'mathematics')
    const manual = assignment(course.lessons[1].lessonRef)
    const result = compute({ assignments: [manual], catalog: [course] })
    expect(result.plan.manualOverrideActive).toBe(true)
    expect(result.plan.items).toHaveLength(1)
    expect(result.plan.items[0]).toMatchObject({ origin: 'MANUAL_OVERRIDE', assignmentRef: manual.assignmentRef })
    expect(result.intents).toEqual([])
  })

  it('never silently replaces an abandoned automatic assignment', () => {
    const course = bundle('5', 'mathematics')
    const abandoned = assignment(course.lessons[0].lessonRef, 'mathematics', 'abandoned')
    const result = compute({ assignments: [abandoned], materializations: [materialized(abandoned, course)], catalog: [course] })
    expect(result.plan.status).toBe('BLOCKED')
    expect(result.plan.reason).toBe('AUTO_ASSIGNMENT_ABANDONED')
    expect(result.intents).toEqual([])
  })

  it('respects paused subjects and exact-session safety holds without discarding work', () => {
    const course = bundle('5', 'mathematics')
    const active = assignment(course.lessons[0].lessonRef, 'mathematics', 'active')
    const pausedPlan = schoolPlan(['mathematics'], { subjects: [{ subject: 'mathematics', order: 0, paused: true, lessonsPerDay: 1, startLocalTime: '09:00' }] })
    const paused = compute({ plan: pausedPlan, assignments: [active], materializations: [materialized(active, course)] })
    expect(paused.plan.items[0]).toMatchObject({ state: 'BLOCKED', blockedReason: 'SUBJECT_PAUSED' })

    const held = compute({
      assignments: [active],
      materializations: [materialized(active, course)],
      holds: [{ learnerRef: SCOPE.learnerRef, sessionRef: active.sessionRef!, status: 'acknowledged', reasonCode: 'parent-review-requested' }],
    })
    expect(held.plan.items[0]).toMatchObject({ state: 'BLOCKED', blockedReason: 'SAFETY_HOLD' })
  })
})

describe('Family Auto Planner R1 — order, completion, and assessment authority', () => {
  it('walks past completed work but never repeats it', () => {
    const course = bundle('5', 'mathematics', 2)
    const first = assignment(course.lessons[0].lessonRef, 'mathematics', 'completed', { completedAt: '2026-08-13T13:00:00.000Z' })
    const result = compute({ assignments: [first], catalog: [course] })
    expect(result.intents).toHaveLength(1)
    expect(result.intents[0]).toMatchObject({ kind: 'LESSON', lesson: { lessonRef: course.lessons[1].lessonRef } })
  })

  it('stops at the daily cap and selects the next lesson on the next school day', () => {
    const course = bundle('5', 'mathematics', 2)
    const first = assignment(course.lessons[0].lessonRef, 'mathematics', 'completed')
    const today = compute({ assignments: [first], materializations: [materialized(first, course, '2026-08-14')], catalog: [course] })
    expect(today.plan.status).toBe('COMPLETE_FOR_TODAY')
    expect(today.intents).toEqual([])
    const monday = compute({ assignments: [first], materializations: [materialized(first, course, '2026-08-14')], catalog: [course], instant: '2026-08-17T13:00:00.000Z' })
    expect(monday.intents[0]).toMatchObject({ kind: 'LESSON', lesson: { lessonRef: course.lessons[1].lessonRef } })
  })

  it('counts carried work on the day it is completed, not its original materialization day', () => {
    const course = bundle('5', 'mathematics', 2)
    const carried = assignment(course.lessons[0].lessonRef, 'mathematics', 'completed', { completedAt: NOW })
    const result = compute({
      assignments: [carried],
      materializations: [materialized(carried, course, '2026-08-13')],
      catalog: [course],
    })
    expect(result.plan.status).toBe('COMPLETE_FOR_TODAY')
    expect(result.intents).toEqual([])
  })

  it('advances immediately when the parent configured more than one lesson per day', () => {
    const course = bundle('5', 'mathematics', 2)
    const first = assignment(course.lessons[0].lessonRef, 'mathematics', 'completed')
    const twoPerDay = schoolPlan(['mathematics'], {
      subjects: [{ subject: 'mathematics', order: 0, paused: false, lessonsPerDay: 2, startLocalTime: '09:00' }],
    })
    const result = compute({
      plan: twoPerDay,
      assignments: [first],
      materializations: [materialized(first, course, '2026-08-14')],
      catalog: [course],
    })
    expect(result.intents[0]).toMatchObject({ kind: 'LESSON', lesson: { lessonRef: course.lessons[1].lessonRef } })
  })

  it('materializes an assessment gate, waits for its authority, then advances', () => {
    const firstUnit = bundle('5', 'mathematics', 1, true)
    const courseRef = firstUnit.course.courseRef
    const secondUnitRef = `${courseRef}-u02`
    const secondLesson: FinalCatalogLesson = {
      ...firstUnit.lessons[0], lessonRef: `${secondUnitRef}-l01`, unitRef: secondUnitRef,
      unitNumber: 2, courseDay: 2, title: 'Next unit lesson',
    }
    const secondUnit: FinalCatalogUnit = {
      ...firstUnit.units[0], unitRef: secondUnitRef, unitNumber: 2, title: 'Unit 2',
      assessmentRef: null, lessonRefs: [secondLesson.lessonRef],
    }
    const course: FamilyAutoPlannerCourseBundle = {
      course: { ...firstUnit.course, unitCount: 2, lessonCount: 2 },
      units: [...firstUnit.units, secondUnit], lessons: [...firstUnit.lessons, secondLesson],
    }
    const completed = assignment(firstUnit.lessons[0].lessonRef, 'mathematics', 'completed', { completedAt: '2026-08-13T13:00:00.000Z' })
    const assessmentRef = firstUnit.units[0].assessmentRef!
    const needed = compute({ assignments: [completed], catalog: [course] })
    expect(needed.intents[0]).toMatchObject({ kind: 'ASSESSMENT', assessmentRef })

    const assessment: FamilyAutoPlannerAssessmentFact = {
      assignmentRef: `assessment:${assessmentRef}`, learnerRef: SCOPE.learnerRef,
      assessmentRef, courseRef, subject: 'mathematics', title: 'Unit 1 assessment',
      status: 'ADULT_REVIEW_REQUIRED', createdAt: NOW, updatedAt: NOW, completedAt: null,
    }
    const waiting = compute({ assignments: [completed], assessments: [assessment], catalog: [course] })
    expect(waiting.plan.status).toBe('WAITING_FOR_ASSESSMENT')
    expect(waiting.plan.items[0]).toMatchObject({ kind: 'ASSESSMENT', state: 'WAITING' })
    expect(waiting.intents).toEqual([])

    const assessmentMaterialization: FamilyAutoPlannerMaterializationV1 = {
      materializationRef: 'auto:2026-08-13:mathematics:assessment',
      kind: 'ASSESSMENT', localDate: '2026-08-13', subject: 'mathematics', workingGrade: '5',
      courseRef, unitRef: firstUnit.units[0].unitRef, itemRef: assessmentRef,
      assignmentRef: assessment.assignmentRef, title: assessment.title, createdAt: '2026-08-13T13:00:00.000Z',
    }
    const offlineAssessment = compute({
      assignments: [completed], assessments: [{ ...assessment, status: 'PLANNED' }],
      materializations: [assessmentMaterialization], catalog: null,
    })
    expect(offlineAssessment.plan).toMatchObject({ status: 'READY', offlineMaterializedWorkAvailable: true })
    expect(offlineAssessment.plan.items[0]).toMatchObject({ kind: 'ASSESSMENT', assignmentRef: assessment.assignmentRef })

    const certified = compute({ assignments: [completed], assessments: [{ ...assessment, status: 'CERTIFIED', completedAt: NOW }], catalog: [course] })
    expect(certified.intents[0]).toMatchObject({ kind: 'LESSON', lesson: { lessonRef: secondLesson.lessonRef } })
  })

  it.each(['PLANNED', 'ACTIVE', 'PENDING_ASSESSMENT', 'ADULT_REVIEW_REQUIRED', 'PENDING_GUARDIAN_ATTESTATION'] as const)(
    'does not report course completion while the final assessment is %s',
    (status) => {
      const held = bundle('5', 'mathematics', 1, true)
      const completed = assignment(held.lessons[0].lessonRef, 'mathematics', 'completed', { completedAt: '2026-08-13T13:00:00.000Z' })
      const assessmentRef = held.units[0].assessmentRef!
      const pending: FamilyAutoPlannerAssessmentFact = {
        assignmentRef: `assessment:${assessmentRef}`, learnerRef: SCOPE.learnerRef,
        assessmentRef, courseRef: held.course.courseRef, subject: 'mathematics', title: 'Final assessment',
        status, createdAt: NOW, updatedAt: NOW, completedAt: null,
      }
      const result = compute({ assignments: [completed], assessments: [pending], catalog: [held] })
      expect(result.plan.status).not.toBe('COURSE_COMPLETE')
      expect(result.plan.completedCourses).toEqual([])
      expect(result.intents).toEqual([])
    },
  )

  it('reports a terminal course only after its final assessment is certified', () => {
    const held = bundle('5', 'mathematics', 1, true)
    const completed = assignment(held.lessons[0].lessonRef, 'mathematics', 'completed', { completedAt: '2026-08-13T13:00:00.000Z' })
    const assessmentRef = held.units[0].assessmentRef!
    const certified: FamilyAutoPlannerAssessmentFact = {
      assignmentRef: `assessment:${assessmentRef}`, learnerRef: SCOPE.learnerRef,
      assessmentRef, courseRef: held.course.courseRef, subject: 'mathematics', title: 'Final assessment',
      status: 'CERTIFIED', createdAt: NOW, updatedAt: NOW, completedAt: NOW,
    }
    const result = compute({ assignments: [completed], assessments: [certified], catalog: [held] })
    expect(result.plan).toMatchObject({ status: 'COURSE_COMPLETE', reason: 'COURSE_COMPLETE' })
    expect(result.plan.completedCourses).toEqual([expect.objectContaining({
      courseRef: held.course.courseRef, subject: 'mathematics', workingGrade: '5', completedAt: NOW,
    })])
    expect(result.intents).toEqual([])
  })
})

describe('Family Auto Planner R1 — one planner for the whole admitted catalog', () => {
  it('prefers the learner\'s existing course assignment and refuses ambiguity', () => {
    const first = bundle('5', 'mathematics', 1)
    const secondBase = bundle('5', 'mathematics', 1)
    const second: FamilyAutoPlannerCourseBundle = {
      course: { ...secondBase.course, courseRef: 'ma-g5-mathematics-alternate' },
      units: secondBase.units.map((unit) => ({ ...unit, courseRef: 'ma-g5-mathematics-alternate' })),
      lessons: secondBase.lessons.map((lesson) => ({ ...lesson, courseRef: 'ma-g5-mathematics-alternate' })),
    }
    const assigned = { ...learner(), assignedCourseRefs: [second.course.courseRef] }
    const selected = compute({ learner: assigned, catalog: [first, second] })
    expect(selected.intents[0]).toMatchObject({ courseRef: second.course.courseRef })

    const ambiguous = compute({ catalog: [first, second] })
    expect(ambiguous.plan).toMatchObject({ status: 'NEEDS_PLAN_SETUP', reason: 'COURSE_ASSIGNMENT_AMBIGUOUS' })
    expect(ambiguous.intents).toEqual([])
  })

  it.each(ACADEMY_GRADES)('selects all ten subjects at supported Grade %s', (grade) => {
    const subjects = [...ACADEMY_SUBJECTS]
    const catalog = subjects.map((subject) => bundle(grade, subject, 1))
    const result = compute({
      plan: schoolPlan(subjects),
      learner: learner(grade, subjects),
      catalog,
    })
    expect(result.plan.status).toBe('READY')
    expect(result.intents).toHaveLength(ACADEMY_SUBJECTS.length)
    expect(new Set(result.intents.map((intent) => intent.subject))).toEqual(new Set(ACADEMY_SUBJECTS))
  })

  it.each(ACADEMY_GRADES)('stops all ten canonical subjects at terminal Grade %s courses', (grade) => {
    const subjects = [...ACADEMY_SUBJECTS]
    const catalog = subjects.map((subject) => bundle(grade, subject, 1))
    const assignments = catalog.map((held) => assignment(held.lessons[0].lessonRef, held.course.subject, 'completed', {
      completedAt: '2026-08-13T13:00:00.000Z',
    }))
    const result = compute({
      plan: schoolPlan(subjects),
      learner: learner(grade, subjects),
      assignments,
      catalog,
    })
    expect(result.plan).toMatchObject({ status: 'COURSE_COMPLETE', reason: 'COURSE_COMPLETE' })
    expect(result.plan.completedCourses).toHaveLength(ACADEMY_SUBJECTS.length)
    expect(new Set(result.plan.completedCourses.map((held) => held.subject))).toEqual(new Set(ACADEMY_SUBJECTS))
    expect(result.intents).toEqual([])
  })

  it('makes Grade 6 absence explicit and never changes the official grade', () => {
    const absent = compute({ learner: learner('6'), catalog: [bundle('5', 'mathematics')] })
    expect(absent.plan).toMatchObject({ status: 'NEEDS_PLAN_SETUP', reason: 'WORKING_GRADE_UNSUPPORTED' })
    expect(absent.intents).toEqual([])
    const routed = compute({ learner: learner('6', ['mathematics'], { mathematics: '5' }), catalog: [bundle('5', 'mathematics')] })
    expect(routed.plan.status).toBe('READY')
    expect(routed.intents[0]).toMatchObject({ workingGrade: '5' })
    expect(routed.plan.scope.learnerRef).toBe(SCOPE.learnerRef)
  })
})

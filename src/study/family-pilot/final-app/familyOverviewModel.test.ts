import { describe, expect, it } from 'vitest'
import type { AcademySubject } from '../../../types'
import type { ScheduleItemV1 } from '../schedule'
import type { FamilySetupStudent } from '../setup'
import {
  emptyFamilyAutoPlannerDocument,
  type FamilyAutoPlannerStoreLoad,
  type FamilyAutoPlannerTodayItem,
  type FamilyAutoPlannerTodayPlan,
} from '../auto-planner'
import type { FinalFamilyPilotAssessmentAssignment } from './state'
import { buildFamilyOverviewLearner, summarizeFamilyOverview } from './familyOverviewModel'

const NOW = '2026-08-14T13:00:00.000Z'
const DATE = '2026-08-14'

function student(ref: string, displayName: string, nominalGrade: FamilySetupStudent['nominalGrade'], workingGrade?: string): FamilySetupStudent {
  return Object.freeze({
    studentRef: ref,
    displayName,
    nominalGrade,
    enabledSubjects: Object.freeze(['mathematics'] as AcademySubject[]),
    workingGradeBySubject: Object.freeze(workingGrade ? { mathematics: workingGrade } : {}) as FamilySetupStudent['workingGradeBySubject'],
    pinRequired: false,
    createdAt: NOW,
    updatedAt: NOW,
  })
}

function item(studentRef: string, assignmentRef: string, state: FamilyAutoPlannerTodayItem['state'], options: Partial<FamilyAutoPlannerTodayItem> = {}): FamilyAutoPlannerTodayItem {
  return Object.freeze({
    kind: 'LESSON', origin: 'AUTO', learnerRef: studentRef, assignmentRef,
    itemRef: `lesson:${assignmentRef}`, lessonRef: `lesson:${assignmentRef}`, assessmentRef: null,
    courseRef: 'ma-g5-mathematics', unitRef: 'unit:1', subject: 'mathematics', workingGrade: '5',
    title: `Work ${assignmentRef}`, state, scheduledLocalTime: '09:00', materializedForDate: DATE,
    carriedForwardFromDate: null, blockedReason: null, ...options,
  })
}

function plan(studentRef: string, status: FamilyAutoPlannerTodayPlan['status'], items: readonly FamilyAutoPlannerTodayItem[] = [], reason: FamilyAutoPlannerTodayPlan['reason'] = 'NONE'): FamilyAutoPlannerTodayPlan {
  return Object.freeze({
    status, reason, scope: Object.freeze({ householdRef: 'household:test', learnerRef: studentRef }),
    householdTimeZone: 'America/Detroit', localDate: DATE, generatedAt: NOW,
    items: Object.freeze(items), blockers: Object.freeze([]), manualOverrideActive: false,
    offlineMaterializedWorkAvailable: false,
  })
}

function schedule(studentRef: string, assignmentRef: string, status: ScheduleItemV1['status']): ScheduleItemV1 {
  return Object.freeze({
    scheduleItemRef: `schedule|${studentRef}|${DATE}|${assignmentRef}`, studentRef, date: DATE,
    title: `Work ${assignmentRef}`, kind: 'assignment', order: 0, status,
    assignmentRef, lessonRef: `lesson:${assignmentRef}`,
  })
}

function schoolPlan(studentRef: string, configured = true): FamilyAutoPlannerStoreLoad {
  const document = emptyFamilyAutoPlannerDocument({ householdRef: 'household:test', learnerRef: studentRef }, NOW)
  return configured ? {
    status: 'ready',
    document: Object.freeze({ ...document, schoolPlan: Object.freeze({
      schemaVersion: 1, householdTimeZone: 'America/Detroit', schoolYearStart: '2026-08-01', schoolYearEnd: '2027-06-30',
      schoolWeekdays: Object.freeze([1, 2, 3, 4, 5] as const), nonSchoolDates: Object.freeze([]), addedSchoolDates: Object.freeze([]),
      subjects: Object.freeze([{ subject: 'mathematics' as const, order: 0, paused: false, courseRef: 'ma-g5-mathematics', lessonsPerDay: 1, startLocalTime: '09:00' }]),
      configuredAt: NOW, updatedAt: NOW,
    }) }),
  } : { status: 'ready', document }
}

function assessment(studentRef: string, status: FinalFamilyPilotAssessmentAssignment['status']): FinalFamilyPilotAssessmentAssignment {
  return Object.freeze({
    assignmentRef: `assessment:${studentRef}`, assessmentRef: 'assessment:math', studentRef,
    courseRef: 'ma-g5-mathematics', subject: 'mathematics', grade: 5, title: 'Math assessment',
    authorityClass: 'RUBRIC_REQUIRED', status, createdAt: NOW, updatedAt: NOW, completedAt: null,
  })
}

function build(overrides: Partial<Parameters<typeof buildFamilyOverviewLearner>[0]> & Pick<Parameters<typeof buildFamilyOverviewLearner>[0], 'student' | 'plan'>) {
  return buildFamilyOverviewLearner({
    schedule: [], schoolPlan: schoolPlan(overrides.student.studentRef), assessments: [],
    openSafetyHolds: 0, pendingGuardianAttestations: 0, courseTitles: { mathematics: 'Grade 5 Mathematics' }, completedCourseTitles: [],
    ...overrides,
  })
}

describe('Parent family overview projection', () => {
  it('shows elementary, middle, and high-school learners with distinct persisted states', () => {
    const elementary = student('student:elementary', 'Ella', '5')
    const elementaryWork = item(elementary.studentRef, 'assignment:ella', 'NOT_STARTED')
    const done = build({
      student: elementary,
      plan: plan(elementary.studentRef, 'COMPLETE_FOR_TODAY', [], 'COURSE_COMPLETE'),
      schedule: [schedule(elementary.studentRef, elementaryWork.assignmentRef, 'completed')], completedCourseTitles: ['Grade 5 Mathematics'],
    })

    const middle = student('student:middle', 'Micah', '7')
    const held = item(middle.studentRef, 'assignment:micah', 'BLOCKED', { carriedForwardFromDate: '2026-08-13', blockedReason: 'SAFETY_HOLD' })
    const blocked = build({
      student: middle,
      plan: plan(middle.studentRef, 'BLOCKED', [held], 'SAFETY_HOLD'),
      schedule: [schedule(middle.studentRef, held.assignmentRef, 'in-progress')],
      assessments: [assessment(middle.studentRef, 'ADULT_REVIEW_REQUIRED')],
      openSafetyHolds: 1,
    })

    const high = student('student:high', 'Harper', '10', '5')
    const needsPlan = build({ student: high, plan: plan(high.studentRef, 'NEEDS_PLAN_SETUP', [], 'SCHOOL_PLAN_MISSING'), schoolPlan: schoolPlan(high.studentRef, false) })

    expect(done).toMatchObject({ todayState: 'DONE', completedToday: 1, remainingToday: 0, courseComplete: true })
    expect(blocked).toMatchObject({ todayState: 'BLOCKED', carriedUnfinished: 1, openSafetyHolds: 1, pendingAssessments: 1, needsParent: true })
    expect(needsPlan).toMatchObject({ todayState: 'NEEDS_PLAN', schoolPlanState: 'MISSING', nominalGrade: '10', needsParentReasons: ['School Plan setup'] })
    expect(needsPlan.workingLevels[0]).toMatchObject({ workingGrade: '5', courseTitle: 'Grade 5 Mathematics' })
    expect(summarizeFamilyOverview([done, blocked, needsPlan])).toEqual({ done: 1, workRemaining: 1, blocked: 1, needsParent: 2, assessmentsWaiting: 1 })
  })

  it('handles no-school, pending scoring, and offline saved-work states without percentages', () => {
    const learner = student('student:offline', 'Olive', '8')
    const assessmentWork = item(learner.studentRef, 'assessment:offline', 'WAITING', { kind: 'ASSESSMENT', assessmentRef: 'assessment:math', lessonRef: null, blockedReason: 'ASSESSMENT_PENDING' })
    const waitingPlan = { ...plan(learner.studentRef, 'WAITING_FOR_ASSESSMENT', [assessmentWork], 'ASSESSMENT_PENDING'), offlineMaterializedWorkAvailable: true }
    const waiting = build({
      student: learner,
      plan: waitingPlan,
      schedule: [schedule(learner.studentRef, assessmentWork.assignmentRef, 'in-progress')],
      assessments: [assessment(learner.studentRef, 'PENDING_ASSESSMENT')],
    })
    const noSchool = build({ student: learner, plan: plan(learner.studentRef, 'NO_SCHOOL_TODAY', [], 'NON_SCHOOL_DAY') })
    expect(waiting).toMatchObject({ todayState: 'ASSESSMENT_WAITING', pendingAssessments: 1, pendingAdultAssessmentReviews: 0, needsParent: false, offlineMaterializedWorkAvailable: true })
    expect(noSchool).toMatchObject({ todayState: 'NO_SCHOOL', scheduledToday: 0 })
    expect(JSON.stringify([waiting, noSchool])).not.toContain('Percent')
  })

  it('fails closed instead of accepting a sibling schedule or assessment', () => {
    const ada = student('student:ada', 'Ada', '5')
    expect(() => build({ student: ada, plan: plan(ada.studentRef, 'READY'), schedule: [schedule('student:sibling', 'assignment:sibling', 'pending')] })).toThrow('another learner')
    expect(() => build({ student: ada, plan: plan(ada.studentRef, 'READY'), assessments: [assessment('student:sibling', 'PENDING_ASSESSMENT')] })).toThrow('safely learner-scoped')
  })

  it('reflects the same persisted assignment changing from remaining to completed on refresh', () => {
    const studentRecord = student('student:refresh', 'Riley', '5')
    const planned = item(studentRecord.studentRef, 'assignment:refresh', 'NOT_STARTED')
    const before = build({ student: studentRecord, plan: plan(studentRecord.studentRef, 'READY', [planned]), schedule: [schedule(studentRecord.studentRef, planned.assignmentRef, 'pending')] })
    const after = build({ student: studentRecord, plan: plan(studentRecord.studentRef, 'COMPLETE_FOR_TODAY'), schedule: [schedule(studentRecord.studentRef, planned.assignmentRef, 'completed')] })
    expect(before).toMatchObject({ scheduledToday: 1, completedToday: 0, remainingToday: 1, todayState: 'WORK_REMAINING' })
    expect(after).toMatchObject({ scheduledToday: 1, completedToday: 1, remainingToday: 0, todayState: 'DONE' })
    expect(after.workItems[0]?.assignmentRef).toBe(before.workItems[0]?.assignmentRef)
  })

  it('still answers who is done when manual work is complete and School Plan setup remains due', () => {
    const studentRecord = student('student:manual', 'Morgan', '5')
    const manual = schedule(studentRecord.studentRef, 'assignment:manual', 'completed')
    const result = build({
      student: studentRecord,
      plan: plan(studentRecord.studentRef, 'NEEDS_PLAN_SETUP', [], 'SCHOOL_PLAN_MISSING'),
      schedule: [manual],
      schoolPlan: schoolPlan(studentRecord.studentRef, false),
    })
    expect(result).toMatchObject({ todayState: 'DONE', completedToday: 1, remainingToday: 0, schoolPlanState: 'MISSING', needsParent: true })
  })
})

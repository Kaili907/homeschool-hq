import { describe, expect, it } from 'vitest'
import { FAMILY_AUTO_PLANNER_SCHEMA_VERSION } from '../auto-planner'
import type { FamilySetupState, FamilySetupStudent } from '../setup'
import {
  composeFamilySetup,
  formatStartTime,
  schoolDaysPhrase,
  schoolPlanSummary,
  toPlannerSchoolPlan,
  type SchoolPlanDraft,
} from './schoolPlanPresentation'

const NOW = '2026-08-14T13:00:00.000Z'

function learner(
  studentRef: string,
  displayName: string,
  enabledSubjects: FamilySetupStudent['enabledSubjects'] = ['mathematics', 'science'],
): FamilySetupStudent {
  return Object.freeze({
    studentRef,
    displayName,
    nominalGrade: '6',
    workingGradeBySubject: Object.freeze({ mathematics: '5', science: '7' }),
    enabledSubjects: Object.freeze(enabledSubjects),
    pinRequired: false,
    createdAt: NOW,
    updatedAt: NOW,
  })
}

function draft(): SchoolPlanDraft {
  return Object.freeze({
    householdTimeZone: 'America/Detroit',
    schoolYearStart: '2026-08-24',
    schoolYearEnd: '2027-06-04',
    schoolWeekdays: Object.freeze([1, 2, 3, 4, 5] as const),
    nonSchoolDates: Object.freeze(['2026-11-26']),
    addedSchoolDates: Object.freeze(['2026-11-28']),
    enabledSubjects: Object.freeze(['mathematics', 'science'] as const),
    workingGradeBySubject: Object.freeze({ mathematics: '5', science: '7' }),
    subjects: Object.freeze([
      Object.freeze({ subject: 'science' as const, order: 1, paused: true, courseRef: 'course:science:7', lessonsPerDay: 1, startLocalTime: '10:15' }),
      Object.freeze({ subject: 'mathematics' as const, order: 0, paused: false, courseRef: 'course:math:5', lessonsPerDay: 2, startLocalTime: '09:00' }),
    ]),
    configuredAt: NOW,
  })
}

describe('School Plan parent presentation', () => {
  it('uses readable school-day and time language', () => {
    expect(schoolDaysPhrase([1, 2, 3, 4, 5])).toBe('Monday through Friday')
    expect(schoolDaysPhrase([1, 3, 5])).toBe('Monday, Wednesday, and Friday')
    expect(formatStartTime('13:05')).toBe('1:05 p.m.')
  })

  it('builds a plain-English review without planner terms', () => {
    const summary = schoolPlanSummary(learner('learner:emma', 'Emma'), draft())
    expect(summary.introduction).toBe('Emma will have Math on Monday through Friday.')
    expect(summary.subjects).toEqual([
      'Math: 2 lessons per school day, starting at 9:00 a.m.',
      'Science is paused. Unfinished work stays available, but no new lesson will be added.',
    ])
    expect(JSON.stringify(summary)).not.toMatch(/IANA|cadence|materialization|planner state|CAS/i)
  })

  it('composes subject and level edits for one child without changing a sibling or nominal grade', () => {
    const emma = learner('learner:emma', 'Emma')
    const noah = learner('learner:noah', 'Noah', ['mathematics'])
    const state: FamilySetupState = Object.freeze({ students: Object.freeze([emma, noah]), completedAt: NOW })
    const next = composeFamilySetup(state, emma, {
      enabledSubjects: Object.freeze(['mathematics']),
      workingGradeBySubject: Object.freeze({ mathematics: '3' }),
    }, '2026-08-14T14:00:00.000Z')

    expect(next).not.toBeNull()
    expect(next?.students[0]).toMatchObject({
      studentRef: 'learner:emma',
      nominalGrade: '6',
      enabledSubjects: ['mathematics'],
      workingGradeBySubject: { mathematics: '3' },
    })
    expect(next?.students[1]).toEqual(noah)
  })

  it('translates the reviewed draft into only the accepted planner contract fields', () => {
    const plan = toPlannerSchoolPlan(draft(), FAMILY_AUTO_PLANNER_SCHEMA_VERSION, '2026-08-14T14:00:00.000Z')
    expect(Object.keys(plan).sort()).toEqual([
      'addedSchoolDates',
      'configuredAt',
      'householdTimeZone',
      'nonSchoolDates',
      'schemaVersion',
      'schoolWeekdays',
      'schoolYearEnd',
      'schoolYearStart',
      'subjects',
      'updatedAt',
    ])
    expect(plan.subjects).toEqual([
      { subject: 'mathematics', order: 0, paused: false, courseRef: 'course:math:5', lessonsPerDay: 2, startLocalTime: '09:00' },
      { subject: 'science', order: 1, paused: true, courseRef: 'course:science:7', lessonsPerDay: 1, startLocalTime: '10:15' },
    ])
    expect(plan).not.toHaveProperty('workingGradeBySubject')
    expect(plan.subjects[0]).not.toHaveProperty('weekdays')
    expect(plan.subjects[0]).not.toHaveProperty('cadence')
  })
})

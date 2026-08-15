import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { FinalCatalogCourse, FinalCatalogUnit } from '../../../curriculum/final-runtime'
import type { FamilyPilotAssignmentRecordV1, FamilyPilotStateV1 } from '../core'
import type { FinalFamilyPilotAssessmentAssignment } from '../final-app'
import type { FamilySetupStudent } from '../setup'
import { ParentProgressReport } from './ParentProgressReport'
import {
  buildParentProgressReport,
  parentProgressReportToJson,
  parentSchoolLogToCsv,
  resolveParentReportRange,
  type ParentReportRange,
} from './parentReport'

const NOW = '2026-08-14T16:00:00.000Z'
const RANGE: ParentReportRange = { preset: 'custom', startDate: '2026-08-10', endDate: '2026-08-14', label: 'Custom range' }
const HERE = dirname(fileURLToPath(import.meta.url))

function student(studentRef = 'student:ada', displayName = 'Ada'): FamilySetupStudent {
  return {
    studentRef,
    displayName,
    nominalGrade: '7',
    workingGradeBySubject: { mathematics: '7', science: '8' },
    enabledSubjects: ['mathematics', 'science'],
    pinRequired: false,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

function assignment(
  studentRef: string,
  subject: 'mathematics' | 'science',
  lessonRef: string,
  overrides: Partial<FamilyPilotAssignmentRecordV1> = {},
): FamilyPilotAssignmentRecordV1 {
  return {
    assignmentRef: `assignment:${studentRef}:${lessonRef}`,
    lessonRef,
    subject,
    title: subject === 'mathematics' ? 'Ratios in tables' : 'Forces and motion',
    state: 'planned',
    sessionRef: null,
    progress: { completedSegmentRefs: [], totalSegments: 3, lastSegmentRef: null, activeSeconds: 0, activeSecondsByDate: [] },
    pause: { pausedAt: null, resumedAt: null, pausedSeconds: 0, resumeSegmentRef: null },
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

function core(records: Readonly<Record<string, readonly FamilyPilotAssignmentRecordV1[]>>): FamilyPilotStateV1 {
  return {
    schemaVersion: 1,
    updatedAt: NOW,
    activeStudentRef: null,
    students: Object.entries(records).map(([studentRef, assignments]) => ({
      studentRef,
      displayName: 'Same household name',
      createdAt: NOW,
      updatedAt: NOW,
      activeAssignmentRef: null,
      assignments,
    })),
  }
}

const mathCourse: FinalCatalogCourse = {
  courseRef: 'ma-g7-mathematics', grade: 7, subject: 'mathematics', title: 'Grade 7 Mathematics', days: 180, unitCount: 1, lessonCount: 2,
}
const scienceCourse: FinalCatalogCourse = {
  courseRef: 'ma-g8-science', grade: 8, subject: 'science', title: 'Grade 8 Science', days: 180, unitCount: 1, lessonCount: 1,
}
const units: readonly FinalCatalogUnit[] = [
  {
    unitRef: 'ma-g7-mathematics-u01', courseRef: mathCourse.courseRef, grade: 7, subject: 'mathematics', unitNumber: 1,
    title: 'Ratios', days: 2, essentialQuestion: 'How do ratios compare?', assessmentRef: 'assessment:math',
    lessonRefs: ['ma-g7-mathematics-u01-l01', 'ma-g7-mathematics-u01-l02'],
  },
  {
    unitRef: 'ma-g8-science-u01', courseRef: scienceCourse.courseRef, grade: 8, subject: 'science', unitNumber: 1,
    title: 'Motion', days: 1, essentialQuestion: 'How do forces change motion?', assessmentRef: null,
    lessonRefs: ['ma-g8-science-u01-l01'],
  },
]
const catalog = {
  listCourses: (grade?: number) => grade === undefined ? [mathCourse, scienceCourse] : [mathCourse, scienceCourse].filter((course) => course.grade === grade),
  listUnits: (courseRef: string) => units.filter((unit) => unit.courseRef === courseRef),
}

function assessment(
  studentRef: string,
  status: FinalFamilyPilotAssessmentAssignment['status'],
  date: string,
): FinalFamilyPilotAssessmentAssignment {
  return {
    assignmentRef: `assessment-assignment:${studentRef}:${status}`,
    assessmentRef: `assessment:${studentRef}:${status}`,
    studentRef,
    courseRef: mathCourse.courseRef,
    subject: 'mathematics',
    grade: 7,
    title: status === 'CERTIFIED' ? 'Ratios unit assessment' : 'Expressions unit assessment',
    authorityClass: 'AUTO_SCOREABLE',
    status,
    createdAt: date,
    updatedAt: date,
    completedAt: status === 'CERTIFIED' ? date : null,
  }
}

function source() {
  const completed = assignment('student:ada', 'mathematics', 'ma-g7-mathematics-u01-l01', {
    state: 'completed',
    completedAt: '2026-08-12T15:00:00.000Z',
    progress: { completedSegmentRefs: ['one', 'two', 'three'], totalSegments: 3, lastSegmentRef: 'three', activeSeconds: 600, activeSecondsByDate: [{ date: '2026-08-12', activeSeconds: 600 }] },
  })
  const active = assignment('student:ada', 'science', 'ma-g8-science-u01-l01', {
    state: 'active',
    sessionRef: 'session:ada',
    progress: { completedSegmentRefs: ['one'], totalSegments: 3, lastSegmentRef: 'one', activeSeconds: 300, activeSecondsByDate: [{ date: '2026-08-14', activeSeconds: 300 }] },
  })
  const sibling = assignment('student:bea', 'mathematics', 'ma-g7-mathematics-u01-l02', {
    title: 'Sibling private lesson title',
    state: 'completed',
    completedAt: '2026-08-13T15:00:00.000Z',
  })
  return {
    student: student(),
    coreState: core({ 'student:ada': [completed, active], 'student:bea': [sibling] }),
    assessments: [
      assessment('student:ada', 'CERTIFIED', '2026-08-13T15:00:00.000Z'),
      assessment('student:ada', 'PENDING_ASSESSMENT', '2026-08-14T15:00:00.000Z'),
      { ...assessment('student:bea', 'CERTIFIED', '2026-08-11T15:00:00.000Z'), title: 'Sibling private assessment title' },
    ],
    catalog,
    courseRefBySubject: { mathematics: mathCourse.courseRef, science: scienceCourse.courseRef },
  }
}

describe('resolveParentReportRange', () => {
  it('resolves week, month, saved school year, and inclusive custom ranges', () => {
    expect(resolveParentReportRange({ preset: 'this-week', today: '2026-08-14' })).toMatchObject({ status: 'ready', range: { startDate: '2026-08-10', endDate: '2026-08-14' } })
    expect(resolveParentReportRange({ preset: 'month', today: '2026-08-14' })).toMatchObject({ status: 'ready', range: { startDate: '2026-08-01', endDate: '2026-08-14' } })
    expect(resolveParentReportRange({ preset: 'school-year', today: '2026-08-14', schoolYear: { startDate: '2026-08-01', endDate: '2027-06-30' } })).toMatchObject({ status: 'ready', range: { startDate: '2026-08-01', endDate: '2027-06-30' } })
    expect(resolveParentReportRange({ preset: 'custom', today: '2026-08-14', customStart: '2026-01-15', customEnd: '2026-03-20' })).toMatchObject({ status: 'ready', range: { startDate: '2026-01-15', endDate: '2026-03-20' } })
  })

  it('refuses an unsaved school year and a reversed custom range', () => {
    expect(resolveParentReportRange({ preset: 'school-year', today: '2026-08-14' }).status).toBe('unavailable')
    expect(resolveParentReportRange({ preset: 'custom', today: '2026-08-14', customStart: '2026-08-15', customEnd: '2026-08-14' }).status).toBe('unavailable')
  })
})

describe('buildParentProgressReport', () => {
  it('projects nominal grade, working levels, courses, position, certified/pending assessments, active time, and chronological activity days', () => {
    const report = buildParentProgressReport({ ...source(), range: RANGE, generatedOn: '2026-08-14' })
    expect(report.learner).toEqual({ studentRef: 'student:ada', displayName: 'Ada', nominalGrade: '7' })
    expect(report.totals).toEqual({
      lessonsCompleted: 1,
      recordedStudyTime: { activeSeconds: 900, coverage: 'recorded' },
      schoolDaysWithRecordedActivity: 3,
      certifiedAssessments: 1,
      pendingAssessments: 1,
    })
    expect(report.subjects).toEqual(expect.arrayContaining([
      expect.objectContaining({ subject: 'mathematics', workingGrade: '7', courseTitle: 'Grade 7 Mathematics', completedLessonsInPeriod: 1, position: expect.objectContaining({ unitNumber: 1, courseLessonNumber: 1 }) }),
      expect.objectContaining({ subject: 'science', workingGrade: '8', courseTitle: 'Grade 8 Science', recordedStudyTime: { activeSeconds: 300, coverage: 'recorded' }, position: expect.objectContaining({ lessonState: 'active' }) }),
    ]))
    expect(report.certifiedAssessments.map((item) => item.title)).toEqual(['Ratios unit assessment'])
    expect(report.pendingAssessments.map((item) => item.status)).toEqual(['PENDING_ASSESSMENT'])
    expect(report.schoolLog.map((day) => day.date)).toEqual(['2026-08-12', '2026-08-13', '2026-08-14'])
    expect(report.schoolLog[0].lessonsCompleted.map((lesson) => lesson.title)).toEqual(['Ratios in tables'])
    expect(report.schoolLog[2].assessmentStates.map((item) => item.status)).toEqual(['PENDING_ASSESSMENT'])
  })

  it('isolates exact studentRef records even when siblings share a display name', () => {
    const sameName = student('student:ada', 'Jordan')
    const report = buildParentProgressReport({ ...source(), student: sameName, range: RANGE, generatedOn: '2026-08-14' })
    const serialized = JSON.stringify(report)
    expect(serialized).not.toContain('Sibling private lesson title')
    expect(serialized).not.toContain('Sibling private assessment title')
    expect(report.totals.lessonsCompleted).toBe(1)
  })

  it('reports missing historical time as unavailable instead of inventing zero', () => {
    const legacy = assignment('student:ada', 'mathematics', 'ma-g7-mathematics-u01-l01', {
      state: 'completed',
      completedAt: '2026-08-12T15:00:00.000Z',
      progress: { completedSegmentRefs: [], totalSegments: 3, lastSegmentRef: null, activeSeconds: 120 },
    })
    const report = buildParentProgressReport({
      ...source(),
      coreState: core({ 'student:ada': [legacy] }),
      assessments: [],
      range: RANGE,
      generatedOn: '2026-08-14',
    })
    expect(report.totals.recordedStudyTime).toEqual({ activeSeconds: null, coverage: 'not-recorded' })
    expect(report.schoolLog[0].recordedStudyTime).toEqual({ activeSeconds: null, coverage: 'not-recorded' })
  })
})

describe('parent report export and print surface', () => {
  it('exports whitelist-only CSV and JSON without record refs, responses, Tutor text, or sibling content', () => {
    const report = buildParentProgressReport({ ...source(), range: RANGE, generatedOn: '2026-08-14' })
    const csv = parentSchoolLogToCsv(report)
    const json = parentProgressReportToJson(report)
    expect(csv.split('\n')[0]).toBe('date,learner,nominalGrade,subjectsWorked,lessonsCompleted,recordedActiveStudySeconds,assessmentStates')
    expect(json).toContain('manuel-academy-parent-factual-progress-report')
    for (const forbidden of ['student:ada', 'assignment:', 'lessonRef', 'assessmentRef', 'rawAnswer', 'response', 'transcript', 'reflection', 'Sibling private']) {
      expect(`${csv}\n${json}`).not.toContain(forbidden)
    }
  })

  it('renders parent-only print/export controls, grading boundary, working levels, and non-attendance-claim copy', () => {
    const html = renderToStaticMarkup(createElement(ParentProgressReport, {
      source: source(),
      today: '2026-08-14',
      schoolYear: { startDate: '2026-08-01', endDate: '2027-06-30' },
    }))
    expect(html).toContain('Print / Save as PDF')
    expect(html).toContain('Export school log CSV')
    expect(html).toContain('Nominal grade:')
    expect(html).toContain('Working Grade 8')
    expect(html).toContain('Chronological school activity log')
    expect(html).toContain('No score, letter grade, GPA, or class rank is calculated')
    expect(html).toContain('not labeled as legally sufficient attendance documentation')
    expect(html).not.toContain('Sibling private')
  })

  it('is mounted only inside the Parent Hub path that follows parent PIN authorization', () => {
    const app = readFileSync(join(HERE, '../final-app/FinalFamilyPilotApp.tsx'), 'utf8')
    expect(app).toMatch(/!parentAuthorized\s*\?\s*\(\s*<ParentPinGate[\s\S]*?\)\s*:\s*\(\s*<ParentSurface/)
    expect(app).toMatch(/function ParentReports[\s\S]*?<ParentProgressReport/)
    expect(app.match(/<ParentProgressReport/g)).toHaveLength(1)
    const learnerDashboardSource = app.slice(app.indexOf('function ActiveStudentDashboard'), app.indexOf('function ParentSurface'))
    expect(learnerDashboardSource).not.toContain('ParentProgressReport')
  })
})

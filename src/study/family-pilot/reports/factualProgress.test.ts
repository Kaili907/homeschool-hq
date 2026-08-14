import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { FinalCatalogCourse, FinalCatalogUnit } from '../../../curriculum/final-runtime'
import type { FamilyPilotAssignmentRecordV1, FamilyPilotStateV1 } from '../core'
import type { FinalFamilyPilotAssessmentAssignment } from '../final-app'
import type { FamilySetupStudent } from '../setup'
import { FamilyFactualProgress, LearnerFactualProgress } from './FamilyFactualProgress'
import { buildFamilyFactualProgress } from './factualProgress'

const NOW = '2026-08-14T12:00:00.000Z'

function student(studentRef: string, displayName: string): FamilySetupStudent {
  return {
    studentRef, displayName, nominalGrade: '7', workingGradeBySubject: {},
    enabledSubjects: ['mathematics', 'science'], pinRequired: false, createdAt: NOW, updatedAt: NOW,
  }
}

function assignment(studentRef: string, lesson: number, overrides: Partial<FamilyPilotAssignmentRecordV1> = {}): FamilyPilotAssignmentRecordV1 {
  return {
    assignmentRef: `assignment:${studentRef}:${lesson}`,
    lessonRef: `ma-g7-mathematics-u01-l0${lesson}`,
    subject: 'mathematics',
    title: `Math lesson ${lesson}`,
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
    activeStudentRef: 'student:ada',
    students: Object.entries(records).map(([studentRef, assignments]) => ({
      studentRef, displayName: studentRef, createdAt: NOW, updatedAt: NOW, activeAssignmentRef: null, assignments,
    })),
  }
}

const course: FinalCatalogCourse = {
  courseRef: 'ma-g7-mathematics', grade: 7, subject: 'mathematics', title: 'Grade 7 Mathematics', days: 180, unitCount: 1, lessonCount: 2,
}
const science: FinalCatalogCourse = {
  courseRef: 'ma-g7-science', grade: 7, subject: 'science', title: 'Grade 7 Science', days: 180, unitCount: 1, lessonCount: 2,
}
const units: FinalCatalogUnit[] = [{
  unitRef: 'ma-g7-mathematics-u01', courseRef: course.courseRef, grade: 7, subject: 'mathematics', unitNumber: 1,
  title: 'Ratios', days: 2, essentialQuestion: 'How?', assessmentRef: 'assessment:math',
  lessonRefs: ['ma-g7-mathematics-u01-l01', 'ma-g7-mathematics-u01-l02'],
}]
const catalog = {
  listCourses: () => [course, science],
  listUnits: (courseRef: string) => units.filter((item) => item.courseRef === courseRef),
}

function assessment(studentRef: string, status: FinalFamilyPilotAssessmentAssignment['status']): FinalFamilyPilotAssessmentAssignment {
  return {
    assignmentRef: `assessment:${studentRef}:${status}`, assessmentRef: 'assessment:math', studentRef,
    courseRef: course.courseRef, subject: 'mathematics', grade: 7, title: 'Math assessment', authorityClass: 'AUTO_SCOREABLE',
    status, createdAt: NOW, updatedAt: NOW, completedAt: status === 'CERTIFIED' ? NOW : null,
  }
}

describe('buildFamilyFactualProgress', () => {
  it('reports today, this week, subject position, certified/pending assessments, and recorded active time without percentages', () => {
    const ada = student('student:ada', 'Ada')
    const completed = assignment(ada.studentRef, 1, {
      state: 'completed', completedAt: '2026-08-12T15:00:00.000Z',
      progress: { completedSegmentRefs: ['s1', 's2', 's3'], totalSegments: 3, lastSegmentRef: 's3', activeSeconds: 600, activeSecondsByDate: [{ date: '2026-08-12', activeSeconds: 600 }] },
    })
    const active = assignment(ada.studentRef, 2, {
      state: 'active', sessionRef: 'session:ada',
      progress: { completedSegmentRefs: ['s1'], totalSegments: 3, lastSegmentRef: 's1', activeSeconds: 300, activeSecondsByDate: [{ date: '2026-08-14', activeSeconds: 300 }] },
    })
    const model = buildFamilyFactualProgress({
      student: ada,
      coreState: core({ 'student:ada': [completed, active] }),
      assessments: [assessment(ada.studentRef, 'CERTIFIED'), assessment(ada.studentRef, 'PENDING_ASSESSMENT')],
      catalog,
      today: '2026-08-14',
    })
    expect(model.today).toEqual({ date: '2026-08-14', lessonsCompleted: 0, studyTime: { activeSeconds: 300, coverage: 'recorded' } })
    expect(model.thisWeek).toMatchObject({ startDate: '2026-08-10', endDate: '2026-08-16', lessonsCompleted: 1, studyTime: { activeSeconds: 900, coverage: 'recorded' } })
    expect(model.lessons).toEqual({ assigned: 2, completed: 1 })
    expect(model.assessments).toMatchObject({ assigned: 2, certified: 1, pending: 1 })
    expect(model.subjects[0]).toMatchObject({
      courseRef: course.courseRef, assignedLessons: 2, completedLessons: 1, totalCourseLessons: 2,
      currentUnit: { unitNumber: 1, title: 'Ratios' }, currentLesson: { title: 'Math lesson 2', state: 'active' },
    })
    expect(JSON.stringify(model)).not.toContain('percent')
  })

  it('reports missing historical period time as unavailable instead of zero', () => {
    const ada = student('student:ada', 'Ada')
    const legacy = assignment(ada.studentRef, 1, {
      progress: { completedSegmentRefs: [], totalSegments: 3, lastSegmentRef: null, activeSeconds: 120 },
    })
    const model = buildFamilyFactualProgress({ student: ada, coreState: core({ 'student:ada': [legacy] }), assessments: [], catalog, today: '2026-08-14' })
    expect(model.today.studyTime).toEqual({ activeSeconds: null, coverage: 'not-recorded' })
  })

  it('selects records by exact studentRef and never blends same-name siblings or ranks them', () => {
    const ada = student('student:ada', 'Jordan')
    const adaWork = assignment('student:ada', 1, { state: 'completed', completedAt: NOW })
    const siblingWork = assignment('student:bea', 1, { state: 'completed', completedAt: NOW })
    const model = buildFamilyFactualProgress({
      student: ada,
      coreState: core({ 'student:ada': [adaWork], 'student:bea': [siblingWork, assignment('student:bea', 2)] }),
      assessments: [assessment('student:ada', 'CERTIFIED'), assessment('student:bea', 'CERTIFIED')],
      catalog,
      today: '2026-08-14',
    })
    expect(model.lessons).toEqual({ assigned: 1, completed: 1 })
    expect(model.assessments.assigned).toBe(1)
    expect(JSON.stringify(model).toLowerCase()).not.toMatch(/rank|sibling|comparison/)
  })

  it('keeps parent and learner rendering factual, non-diagnostic, and grading-boundary explicit', () => {
    const ada = student('student:ada', 'Ada')
    const model = buildFamilyFactualProgress({ student: ada, coreState: core({ 'student:ada': [] }), assessments: [], catalog, today: '2026-08-14' })
    const html = `${renderToStaticMarkup(createElement(FamilyFactualProgress, { model }))}${renderToStaticMarkup(createElement(LearnerFactualProgress, { model }))}`
    expect(html).toContain('No GPA or report-card grade is calculated')
    expect(html).toContain('not a comparison or rank')
    for (const forbidden of ['lazy', 'distracted', 'unfocused', 'personality', 'mood', 'adhd', 'transcript', 'raw answer']) {
      expect(html.toLowerCase()).not.toContain(forbidden)
    }
  })
})

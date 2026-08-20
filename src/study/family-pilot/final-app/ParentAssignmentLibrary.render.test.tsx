import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { FamilySetupStudent } from '../setup'
import type { FinalFamilyPilotController } from './controller'
import { ParentAssignmentLibrary } from './ParentAssignmentLibrary'

const student: FamilySetupStudent = {
  studentRef: 'student:ada',
  displayName: 'Ada',
  nominalGrade: '5',
  workingGradeBySubject: {},
  enabledSubjects: ['mathematics'],
  pinRequired: false,
  createdAt: '2026-08-14T12:00:00.000Z',
  updatedAt: '2026-08-14T12:00:00.000Z',
}

function controllerFixture(): FinalFamilyPilotController {
  const course = {
    courseRef: 'course:math-5', grade: 5 as const, subject: 'mathematics' as const,
    title: 'Grade 5 Mathematics', days: 180, unitCount: 1, lessonCount: 1,
  }
  const unit = {
    unitRef: 'unit:fractions', courseRef: course.courseRef, grade: 5 as const,
    subject: 'mathematics' as const, unitNumber: 1, title: 'Fractions', days: 10,
    essentialQuestion: 'How do fractions describe equal parts?', assessmentRef: null, lessonRefs: ['lesson:fractions-1'],
  }
  return {
    catalog: {
      runtime: {
        listGrades: () => [5],
        listCourses: () => [course],
        listUnits: () => [unit],
        listLessons: async () => [],
      },
      listAssessments: () => [],
      getBinding: async () => null,
      getAssessment: async () => null,
    },
    appSnapshot: {
      state: { attestations: [], safety: { holds: [] }, sessions: [], sourceAttachments: [] },
    },
    coreSnapshot: { state: { students: [{ studentRef: student.studentRef, assignments: [] }] } },
    assessmentAssignments: () => [],
    pendingAttestations: () => [],
    openSafetyHolds: () => [],
  } as unknown as FinalFamilyPilotController
}

describe('ParentAssignmentLibrary responsive accessibility shell', () => {
  it('renders labeled learner-to-unit navigation, canonical search, and Parent precedence guidance', () => {
    const html = renderToStaticMarkup(
      <ParentAssignmentLibrary controller={controllerFixture()} student={student} onOpen={() => {}} refresh={() => {}} />,
    )
    expect(html).toContain('<fieldset')
    expect(html).toContain('Browse the admitted curriculum for Ada')
    expect(html).toContain('Subject')
    expect(html).toContain('Working level to browse')
    expect(html).toContain('Course')
    expect(html).toContain('Unit')
    expect(html).toContain('type="search"')
    expect(html).toContain('Title, unit, lesson, or subject')
    expect(html).toContain('Auto Planner is the everyday scheduling path.')
    expect(html).toContain('extra or override')
    expect(html).toContain('never changes Ada’s official subject working level')
  })

  it('uses single-column-first responsive grids and 44px-minimum form controls', () => {
    const html = renderToStaticMarkup(
      <ParentAssignmentLibrary controller={controllerFixture()} student={student} onOpen={() => {}} refresh={() => {}} />,
    )
    expect(html).toContain('grid gap-4 sm:grid-cols-2 lg:grid-cols-4')
    expect(html.match(/min-h-11/g)?.length).toBeGreaterThanOrEqual(5)
  })
})

import { describe, expect, it, vi } from 'vitest'
import type { FinalLearnerAssessmentMaterial } from '../../../curriculum/final-app-data'
import type {
  FinalCatalogCourse,
  FinalCatalogLesson,
  FinalCatalogUnit,
} from '../../../curriculum/final-runtime'
import type { AcademySubject, Grade } from '../../../types'
import type { FamilyPilotAssignmentRecordV1, FamilyPilotStateV1 } from '../core'
import type { FinalFamilyPilotAssessmentAssignment } from '../final-app'
import type { ScheduleItemV1 } from '../schedule'
import type { FamilySetupState, FamilySetupStudent } from '../setup'
import { openDashboardTutor } from './actions'
import { buildFamilyPilotStudentDashboardModel } from './buildDashboardModel'
import type {
  BuildFamilyPilotStudentDashboardInput,
  FamilyPilotDashboardCatalog,
} from './types'

const NOW = '2026-08-13T12:00:00.000Z'
const TODAY = '2026-08-13'

function student(
  studentRef: string,
  displayName: string,
  nominalGrade: Grade,
  enabledSubjects: readonly AcademySubject[],
  workingGradeBySubject: FamilySetupStudent['workingGradeBySubject'] = {},
): FamilySetupStudent {
  return Object.freeze({
    studentRef,
    displayName,
    nominalGrade,
    enabledSubjects,
    workingGradeBySubject,
    pinRequired: false,
    createdAt: NOW,
    updatedAt: NOW,
  })
}

function assignment(
  studentRef: string,
  subject: AcademySubject,
  grade: number,
  state: FamilyPilotAssignmentRecordV1['state'] = 'planned',
  lesson = 1,
): FamilyPilotAssignmentRecordV1 {
  const lessonRef = `ma-g${grade}-${subject}-u01-l${String(lesson).padStart(2, '0')}`
  return Object.freeze({
    assignmentRef: `${studentRef}:${lessonRef}`,
    lessonRef,
    subject,
    title: `${subject} lesson ${lesson}`,
    state,
    sessionRef: state === 'planned' ? null : `session:${studentRef}:${subject}:${lesson}`,
    progress: Object.freeze({
      completedSegmentRefs: state === 'completed' ? Object.freeze(['segment:1']) : Object.freeze([]),
      totalSegments: 1,
      lastSegmentRef: state === 'completed' ? 'segment:1' : null,
      activeSeconds: state === 'planned' ? 0 : 120,
    }),
    pause: Object.freeze({
      pausedAt: state === 'paused' ? NOW : null,
      resumedAt: null,
      pausedSeconds: state === 'paused' ? 60 : 0,
      resumeSegmentRef: state === 'paused' ? 'segment:1' : null,
    }),
    completedAt: state === 'completed' ? NOW : null,
    createdAt: NOW,
    updatedAt: NOW,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
}

function assessment(
  studentRef: string,
  subject: AcademySubject,
  grade: number,
  status: FinalFamilyPilotAssessmentAssignment['status'],
): FinalFamilyPilotAssessmentAssignment {
  return Object.freeze({
    assignmentRef: `assessment:${studentRef}:${subject}`,
    assessmentRef: `ma-g${grade}-${subject}-u01-assessment`,
    studentRef,
    courseRef: `ma-g${grade}-${subject}`,
    subject,
    grade,
    title: `${subject} assessment`,
    authorityClass: 'AUTO_SCOREABLE',
    status,
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: status === 'CERTIFIED' ? NOW : null,
  })
}

function scheduled(
  studentRef: string,
  assignmentRef: string | null,
  order: number,
  date = TODAY,
  kind: ScheduleItemV1['kind'] = 'assignment',
): ScheduleItemV1 {
  return Object.freeze({
    scheduleItemRef: `schedule:${studentRef}:${date}:${order}`,
    studentRef,
    date,
    title: `Scheduled item ${order}`,
    kind,
    order,
    status: 'pending',
    assignmentRef,
    lessonRef: null,
  })
}

function course(subject: AcademySubject, grade: 3 | 4 | 5 | 7 | 8 | 9 | 10 | 11 | 12): FinalCatalogCourse {
  return Object.freeze({
    courseRef: `ma-g${grade}-${subject}`,
    grade,
    subject,
    title: `Grade ${grade} ${subject}`,
    days: 180,
    unitCount: 1,
    lessonCount: 2,
  })
}

function unit(held: FinalCatalogCourse): FinalCatalogUnit {
  return Object.freeze({
    unitRef: `${held.courseRef}-u01`,
    courseRef: held.courseRef,
    grade: held.grade,
    subject: held.subject,
    unitNumber: 1,
    title: `${held.title} unit`,
    days: 2,
    essentialQuestion: 'How can we use this?',
    assessmentRef: `${held.courseRef}-u01-assessment`,
    lessonRefs: Object.freeze([`${held.courseRef}-u01-l01`, `${held.courseRef}-u01-l02`]),
  })
}

function lesson(
  held: FinalCatalogCourse,
  sourceReadiness: FinalCatalogLesson['sourceReadiness'] = {
    state: 'ready', dynamicSource: false, sourceRefs: [],
  },
): FinalCatalogLesson {
  return Object.freeze({
    lessonRef: `${held.courseRef}-u01-l01`,
    courseRef: held.courseRef,
    unitRef: `${held.courseRef}-u01`,
    grade: held.grade,
    subject: held.subject,
    unitNumber: 1,
    dayInUnit: 1,
    courseDay: 1,
    title: `${held.title} lesson`,
    estimatedMinutes: '30',
    resourceRefs: Object.freeze([]),
    sourceReadiness,
  })
}

function assessmentMaterial(held: FinalFamilyPilotAssessmentAssignment): FinalLearnerAssessmentMaterial {
  return Object.freeze({
    schemaVersion: '1.0',
    kind: 'canonical-learner-assessment-package',
    assessmentRef: held.assessmentRef,
    courseRef: held.courseRef,
    grade: held.grade,
    subject: held.subject,
    location: Object.freeze({
      unitRef: `${held.courseRef}-u01`,
      unitNumber: 1,
      unitTitle: 'Unit one',
      courseTitle: held.courseRef,
      assessmentLessonRef: null,
    }),
    standards: Object.freeze([]),
    instructions: Object.freeze(['Complete the assessment.']),
    learnerTasks: Object.freeze([{ taskRef: 'task:1', kind: 'response', prompt: 'Respond.' }]),
    responseMode: 'written',
    completionScoringAuthorityClass: held.authorityClass,
    learnerSuccessCriteria: Object.freeze([]),
    accommodations: 'Available',
    productionReadiness: Object.freeze({
      status: 'READY', structuralOnly: false, answerMaterialIncluded: false,
    }),
  })
}

function catalog(
  courses: readonly FinalCatalogCourse[],
  lessons: readonly FinalCatalogLesson[],
  assessments: readonly FinalFamilyPilotAssessmentAssignment[] = [],
  getLesson = vi.fn(async (lessonRef: string) => lessons.find((item) => item.lessonRef === lessonRef)),
): FamilyPilotDashboardCatalog & { readonly getLessonSpy: typeof getLesson } {
  const units = courses.map(unit)
  return {
    runtime: {
      listGrades: () => Object.freeze([3, 4, 5, 7, 8, 9, 10, 11, 12]),
      listCourses: (grade) => courses.filter((item) => grade === undefined || item.grade === grade),
      listUnits: (courseRef) => units.filter((item) => item.courseRef === courseRef),
      getLesson,
    },
    getAssessment: async (assessmentRef) => {
      const held = assessments.find((item) => item.assessmentRef === assessmentRef)
      return held ? assessmentMaterial(held) : null
    },
    getLessonSpy: getLesson,
  }
}

function input(overrides: Partial<BuildFamilyPilotStudentDashboardInput> = {}): BuildFamilyPilotStudentDashboardInput {
  const ada = student('student:ada', 'Ada', '3', ['mathematics'])
  const math = course('mathematics', 3)
  const setup: FamilySetupState = Object.freeze({ students: Object.freeze([ada]), completedAt: NOW })
  const coreState: FamilyPilotStateV1 = Object.freeze({
    schemaVersion: 1,
    updatedAt: NOW,
    activeStudentRef: ada.studentRef,
    students: Object.freeze([{ studentRef: ada.studentRef, displayName: ada.displayName, createdAt: NOW, updatedAt: NOW, activeAssignmentRef: null, assignments: Object.freeze([]) }]),
  })
  return {
    today: TODAY,
    activeStudentRef: ada.studentRef,
    setup,
    coreState,
    schedule: Object.freeze([]),
    assessments: Object.freeze([]),
    attestations: Object.freeze([]),
    sourceAttachments: Object.freeze([]),
    safetyHolds: Object.freeze([]),
    safetyRecovery: 'available',
    appStoreStatus: 'ready',
    studyStorageHealth: { ready: true, reasonCode: null, previousWriteFailed: false },
    catalog: catalog([math], [lesson(math)]),
    ...overrides,
  }
}

function withAssignments(
  source: BuildFamilyPilotStudentDashboardInput,
  byStudent: Readonly<Record<string, readonly FamilyPilotAssignmentRecordV1[]>>,
): FamilyPilotStateV1 {
  return Object.freeze({
    ...source.coreState,
    students: Object.freeze(source.setup.students.map((held) => Object.freeze({
      studentRef: held.studentRef,
      displayName: held.displayName,
      createdAt: NOW,
      updatedAt: NOW,
      activeAssignmentRef: byStudent[held.studentRef]?.find((item) => item.state === 'active')?.assignmentRef ?? null,
      assignments: Object.freeze([...(byStudent[held.studentRef] ?? [])]),
    }))),
  })
}

describe('Family Pilot student dashboard data adapter', () => {
  it('builds an honest fresh-learner empty state from eager course summaries', async () => {
    const source = input()
    const model = await buildFamilyPilotStudentDashboardModel(source)
    expect(model).toMatchObject({
      learner: { studentRef: 'student:ada', displayName: 'Ada', nominalGrade: '3' },
      today: { state: 'EMPTY', emptyReason: 'NO_SCHEDULED_WORK', scheduledCount: 0 },
      progressSummary: { lessonsAssigned: 0, lessonsCompleted: 0 },
      courses: [{ courseRef: 'ma-g3-mathematics', workingGrade: '3', curriculumStatus: 'AVAILABLE' }],
      jarvis: { mode: 'VISUAL_ONLY', status: 'STATIC_HELP_AVAILABLE', interactive: false },
    })
    expect((source.catalog as ReturnType<typeof catalog>).getLessonSpy).not.toHaveBeenCalled()
  })

  it('projects today across multiple subjects, completed progress, and a pending assessment', async () => {
    const ada = student('student:ada', 'Ada', '7', ['mathematics', 'english-language-arts'])
    const math = course('mathematics', 7)
    const ela = course('english-language-arts', 7)
    const completed = assignment(ada.studentRef, 'mathematics', 7, 'completed')
    const active = assignment(ada.studentRef, 'english-language-arts', 7, 'active')
    const pending = assessment(ada.studentRef, 'mathematics', 7, 'PENDING_ASSESSMENT')
    let source = input({
      activeStudentRef: ada.studentRef,
      setup: { students: [ada], completedAt: NOW },
      assessments: [pending],
      schedule: [
        { ...scheduled(ada.studentRef, completed.assignmentRef, 0), status: 'completed' },
        { ...scheduled(ada.studentRef, active.assignmentRef, 1), status: 'in-progress' },
        scheduled(ada.studentRef, pending.assignmentRef, 2),
      ],
      catalog: catalog([math, ela], [lesson(math), lesson(ela)], [pending]),
    })
    source = { ...source, coreState: withAssignments(source, { [ada.studentRef]: [completed, active] }) }
    const model = await buildFamilyPilotStudentDashboardModel(source)
    expect(model?.today.items.map((item) => [item.kind, item.status, item.action?.type])).toEqual([
      ['LESSON', 'COMPLETED', undefined],
      ['LESSON', 'IN_PROGRESS', 'CONTINUE'],
      ['ASSESSMENT', 'WAITING', undefined],
    ])
    expect(model?.today.items[2].blocked).toEqual({
      kind: 'ASSESSMENT_SCORING_PENDING',
      message: 'Waiting for grading',
    })
    expect(model?.progressSummary).toMatchObject({
      lessonsAssigned: 2, lessonsCompleted: 1, assessmentsAssigned: 1, assessmentsCertified: 0,
    })
    expect(model?.courses.map((item) => item.subject)).toEqual(['mathematics', 'english-language-arts'])
  })

  it.each([
    ['PENDING_ASSESSMENT', 'Waiting for grading'],
    ['ADULT_REVIEW_REQUIRED', 'Waiting for review'],
    ['PENDING_GUARDIAN_ATTESTATION', 'Ask your parent'],
  ] as const)('uses plain learner copy for assessment state %s', async (status, message) => {
    const held = assessment('student:ada', 'mathematics', 3, status)
    const math = course('mathematics', 3)
    const model = await buildFamilyPilotStudentDashboardModel(input({
      assessments: [held],
      schedule: [scheduled('student:ada', held.assignmentRef, 0)],
      catalog: catalog([math], [lesson(math)], [held]),
    }))
    expect(model?.today.items[0]).toMatchObject({
      status: 'WAITING',
      action: null,
      blocked: { message },
    })
  })

  it('never assumes nominal grade is the working level', async () => {
    const learner = student('student:mia', 'Mia', '8', ['mathematics'], { mathematics: '11' })
    const math11 = course('mathematics', 11)
    const work = assignment(learner.studentRef, 'mathematics', 11)
    const priorLevelWork = assignment(learner.studentRef, 'mathematics', 8, 'completed')
    let source = input({
      activeStudentRef: learner.studentRef,
      setup: { students: [learner], completedAt: NOW },
      schedule: [scheduled(learner.studentRef, work.assignmentRef, 0)],
      catalog: catalog([math11], [lesson(math11)]),
    })
    source = { ...source, coreState: withAssignments(source, { [learner.studentRef]: [priorLevelWork, work] }) }
    const model = await buildFamilyPilotStudentDashboardModel(source)
    expect(model?.learner.nominalGrade).toBe('8')
    expect(model?.courses[0]).toMatchObject({
      workingGrade: '11', courseRef: 'ma-g11-mathematics', assignedLessons: 1, completedLessons: 0,
    })
    expect(model?.progressSummary).toMatchObject({ lessonsAssigned: 2, lessonsCompleted: 1 })
    expect(model?.today.items[0]).toMatchObject({ workingGrade: '11', courseRef: 'ma-g11-mathematics' })
  })

  it.each([
    ['guardian attestation', 'GUARDIAN_PENDING'],
    ['Social source', 'SOCIAL_SOURCE_REQUIRED'],
    ['safety hold', 'SAFETY_HOLD'],
    ['safety recovery', 'SAFETY_HOLD'],
    ['storage failure', 'STORAGE_UNAVAILABLE'],
  ] as const)('blocks %s without creating a launch command', async (scenario, expected) => {
    const subject: AcademySubject = scenario === 'guardian attestation' ? 'ready-for-life' : 'mathematics'
    const work = assignment('student:ada', subject, 3, 'active')
    const heldCourse = course(subject, 3)
    const dynamic = lesson(heldCourse, {
      state: 'dynamic', dynamicSource: true, sourceRefs: [], resolverKey: 'social-current-source',
    })
    let source = input({
      setup: { students: [student('student:ada', 'Ada', '3', [subject])], completedAt: NOW },
      schedule: [scheduled('student:ada', work.assignmentRef, 0)],
      catalog: catalog([heldCourse], [scenario === 'Social source' ? dynamic : lesson(heldCourse)]),
      attestations: scenario === 'guardian attestation' ? [{
        studentRef: 'student:ada', assignmentRef: work.assignmentRef, lessonRef: work.lessonRef,
        status: 'PENDING_GUARDIAN_ATTESTATION',
      }] : [],
      safetyHolds: scenario === 'safety hold' ? [{
        studentRef: 'student:ada', sessionRef: work.sessionRef!, status: 'open',
      }] : [],
      safetyRecovery: scenario === 'safety recovery' ? 'unavailable' : 'available',
      studyStorageHealth: scenario === 'storage failure'
        ? { ready: false, reasonCode: 'STORAGE_WRITE_FAILED', previousWriteFailed: true }
        : { ready: true, reasonCode: null, previousWriteFailed: false },
    })
    source = { ...source, coreState: withAssignments(source, { 'student:ada': [work] }) }
    const model = await buildFamilyPilotStudentDashboardModel(source)
    expect(model?.today.items[0]).toMatchObject({ status: 'WAITING', action: null, blocked: { kind: expected } })
    if (scenario === 'guardian attestation' || scenario === 'safety hold' || scenario === 'safety recovery') {
      expect(model?.today.items[0].blocked?.message).toBe('Ask your parent')
    }
  })

  it('accepts an attached source only for the exact learner and lesson assignment', async () => {
    const work = assignment('student:ada', 'social-studies', 3, 'planned')
    const social = course('social-studies', 3)
    let source = input({
      setup: { students: [student('student:ada', 'Ada', '3', ['social-studies'])], completedAt: NOW },
      schedule: [scheduled('student:ada', work.assignmentRef, 0)],
      catalog: catalog([social], [lesson(social, {
        state: 'dynamic', dynamicSource: true, sourceRefs: [], resolverKey: 'social-current-source',
      })]),
      sourceAttachments: [{
        studentRef: 'student:other', assignmentRef: work.assignmentRef, lessonRef: work.lessonRef,
        status: 'ATTACHED_SATISFIED',
      }],
    })
    source = { ...source, coreState: withAssignments(source, { 'student:ada': [work] }) }
    expect((await buildFamilyPilotStudentDashboardModel(source))?.today.items[0].blocked?.kind)
      .toBe('SOCIAL_SOURCE_REQUIRED')
    const ready = await buildFamilyPilotStudentDashboardModel({
      ...source,
      sourceAttachments: [{
        studentRef: 'student:ada', assignmentRef: work.assignmentRef, lessonRef: work.lessonRef,
        status: 'ATTACHED_SATISFIED',
      }],
    })
    expect(ready?.today.items[0]).toMatchObject({ status: 'NOT_STARTED', blocked: null, action: { type: 'START' } })
  })

  it('isolates three students with different grades, assignments, progress, and levels', async () => {
    const ada = student('student:ada', 'Ada', '3', ['mathematics'])
    const bo = student('student:bo', 'Bo', '7', ['english-language-arts'])
    const cy = student('student:cy', 'Cy', '10', ['science'], { science: '12' })
    const students = [ada, bo, cy]
    const courses = [course('mathematics', 3), course('english-language-arts', 7), course('science', 12)]
    const works = [
      assignment(ada.studentRef, 'mathematics', 3, 'completed'),
      assignment(bo.studentRef, 'english-language-arts', 7, 'active'),
      assignment(cy.studentRef, 'science', 12, 'planned'),
    ]
    let source = input({
      activeStudentRef: bo.studentRef,
      setup: { students, completedAt: NOW },
      schedule: works.map((item, index) => scheduled(students[index].studentRef, item.assignmentRef, index)),
      catalog: catalog(courses, courses.map((item) => lesson(item))),
      attestations: [{ studentRef: cy.studentRef, assignmentRef: works[2].assignmentRef, lessonRef: works[2].lessonRef, status: 'PENDING_GUARDIAN_ATTESTATION' }],
    })
    source = { ...source, coreState: withAssignments(source, {
      [ada.studentRef]: [works[0]], [bo.studentRef]: [works[1]], [cy.studentRef]: [works[2]],
    }) }
    const model = await buildFamilyPilotStudentDashboardModel(source)
    expect(model?.learner).toMatchObject({ studentRef: bo.studentRef, nominalGrade: '7' })
    expect(model?.today.items).toHaveLength(1)
    expect(model?.today.items[0]).toMatchObject({ assignmentRef: works[1].assignmentRef, subject: 'english-language-arts' })
    expect(model?.progressSummary).toMatchObject({ lessonsAssigned: 1, lessonsCompleted: 0 })
    expect(JSON.stringify(model)).not.toContain(ada.studentRef)
    expect(JSON.stringify(model)).not.toContain(cy.studentRef)
  })

  it('generates only typed learner-bound route commands, including sign out', async () => {
    const work = assignment('student:ada', 'mathematics', 3)
    let source = input({ schedule: [scheduled('student:ada', work.assignmentRef, 0)] })
    source = { ...source, coreState: withAssignments(source, { 'student:ada': [work] }) }
    const model = await buildFamilyPilotStudentDashboardModel(source)
    expect(model?.today.items[0].action).toEqual({
      type: 'START', studentRef: 'student:ada', assignmentRef: work.assignmentRef, workKind: 'LESSON',
    })
    expect(model?.tools.map((tool) => tool.action.type)).toEqual([
      'OPEN_SCHEDULE', 'OPEN_REPORTS', 'OPEN_ASSIGNMENTS',
    ])
    expect(model?.courses[0].action).toEqual({
      type: 'OPEN_COURSE', studentRef: 'student:ada', courseRef: 'ma-g3-mathematics',
    })
    expect(model?.actions.signOut).toEqual({ type: 'SIGN_OUT', studentRef: 'student:ada' })
  })

  it('keeps the model free of access, answer, transcript, backup, and sibling-private fields', async () => {
    const model = await buildFamilyPilotStudentDashboardModel(input())
    const serialized = JSON.stringify(model)
    for (const forbidden of [
      'pin', 'digest', 'bearer', 'token', 'correctAnswer', 'answerIndex',
      'transcript', 'scoringGuide', 'householdRef', 'backup', 'privateNote',
    ]) expect(serialized.toLowerCase()).not.toContain(forbidden.toLowerCase())
  })

  it('bounds lazy lesson work to visible today and upcoming cards', async () => {
    const ada = student('student:ada', 'Ada', '3', ['mathematics'])
    const math = course('mathematics', 3)
    const work = assignment(ada.studentRef, 'mathematics', 3)
    const getLesson = vi.fn(async () => lesson(math))
    const source = input({
      schedule: [
        ...Array.from({ length: 30 }, (_, index) => scheduled(ada.studentRef, work.assignmentRef, index)),
        ...Array.from({ length: 10 }, (_, index) => scheduled(ada.studentRef, work.assignmentRef, index, '2026-08-14')),
      ],
      catalog: catalog([math], [lesson(math)], [], getLesson),
    })
    const held = { ...source, coreState: withAssignments(source, { [ada.studentRef]: [work] }) }
    const model = await buildFamilyPilotStudentDashboardModel(held)
    expect(model?.today).toMatchObject({ scheduledCount: 30, omittedCount: 6 })
    expect(model?.upcoming).toHaveLength(5)
    expect(getLesson).toHaveBeenCalledTimes(29)
  })

  it('keeps Jarvis non-interactive while exposing a future injected Tutor V2 port', async () => {
    const onOpenTutor = vi.fn()
    const port = { tutorCapability: 'AVAILABLE' as const, onOpenTutor }
    const model = await buildFamilyPilotStudentDashboardModel(input({ jarvisPort: port }))
    expect(model?.jarvis).toEqual({
      mode: 'VISUAL_ONLY', status: 'AVAILABLE_VISUAL', tutorCapability: 'AVAILABLE',
      interactive: false, staticHelpAvailable: true,
    })
    expect(onOpenTutor).not.toHaveBeenCalled()
    expect(openDashboardTutor(port, 'student:ada')).toBe(true)
    expect(onOpenTutor).toHaveBeenCalledWith({ studentRef: 'student:ada' })
  })

  it('returns no model when the active ref is absent or does not match a roster learner', async () => {
    expect(await buildFamilyPilotStudentDashboardModel(input({ activeStudentRef: null }))).toBeNull()
    expect(await buildFamilyPilotStudentDashboardModel(input({ activeStudentRef: 'student:missing' }))).toBeNull()
  })
})

import { ACADEMY_SUBJECT_LABELS } from '../../../academy/contentTypes'
import {
  parseFinalCurriculumGrade,
  type FinalCatalogCourse,
  type FinalCatalogLesson,
} from '../../../curriculum/final-runtime'
import { ACADEMY_SUBJECTS, type AcademySubject, type Grade } from '../../../types'
import type { FamilyPilotAssignmentRecordV1 } from '../core'
import { deriveCanonicalCourseCompletion } from '../course-completion'
import type { FinalFamilyPilotAssessmentAssignment } from '../final-app'
import type { ScheduleItemV1 } from '../schedule'
import {
  continueDashboardWork,
  FAMILY_PILOT_VISUAL_ONLY_JARVIS_PORT,
  openDashboardCourse,
  openDashboardSurface,
  startDashboardWork,
} from './actions'
import type {
  BuildFamilyPilotStudentDashboardInput,
  FamilyPilotDashboardAlert,
  FamilyPilotDashboardBlockedKind,
  FamilyPilotDashboardBlockedState,
  FamilyPilotDashboardCommand,
  FamilyPilotDashboardCourseModel,
  FamilyPilotDashboardProgressModel,
  FamilyPilotDashboardWorkItem,
  FamilyPilotDashboardWorkStatus,
  FamilyPilotStudentDashboardModel,
} from './types'
import {
  FAMILY_PILOT_DASHBOARD_RECENT_LIMIT,
  FAMILY_PILOT_DASHBOARD_TODAY_LIMIT,
  FAMILY_PILOT_DASHBOARD_UPCOMING_LIMIT,
} from './types'

const BLOCKED_COPY: Readonly<Record<FamilyPilotDashboardBlockedKind, string>> = Object.freeze({
  STORAGE_UNAVAILABLE: 'This work cannot open until progress storage is available again.',
  SAFETY_HOLD: 'Ask your parent',
  GUARDIAN_PENDING: 'Ask your parent',
  SOCIAL_SOURCE_REQUIRED: 'A grown-up needs to attach today’s approved source before this can open.',
  ASSESSMENT_SCORING_PENDING: 'Waiting for grading',
  ADULT_REVIEW_REQUIRED: 'Waiting for review',
  ASSIGNMENT_UNAVAILABLE: 'This scheduled item is not available to open right now.',
})

function blocked(kind: FamilyPilotDashboardBlockedKind): FamilyPilotDashboardBlockedState {
  return Object.freeze({ kind, message: BLOCKED_COPY[kind] })
}

function academySubject(value: string): AcademySubject | null {
  return ACADEMY_SUBJECTS.includes(value as AcademySubject) ? value as AcademySubject : null
}

function initials(displayName: string): string {
  return Array.from(displayName.trim())[0]?.toUpperCase() ?? 'L'
}

function storageBlocked(input: BuildFamilyPilotStudentDashboardInput): boolean {
  if (input.appStoreStatus === 'unavailable' || input.appStoreStatus === 'read-only') return true
  return input.studyStorageHealth?.ready === false
}

function safetyUnavailable(input: BuildFamilyPilotStudentDashboardInput): boolean {
  return input.safetyRecovery !== 'available'
}

function openHoldFor(
  input: BuildFamilyPilotStudentDashboardInput,
  studentRef: string,
  assignment: FamilyPilotAssignmentRecordV1,
): boolean {
  if (!assignment.sessionRef) return false
  return input.safetyHolds.some((hold) =>
    hold.studentRef === studentRef &&
    hold.sessionRef === assignment.sessionRef &&
    hold.status !== 'cleared')
}

function guardianPendingFor(
  input: BuildFamilyPilotStudentDashboardInput,
  studentRef: string,
  assignmentRef: string,
): boolean {
  return input.attestations.some((attestation) =>
    attestation.studentRef === studentRef &&
    attestation.assignmentRef === assignmentRef &&
    attestation.status === 'PENDING_GUARDIAN_ATTESTATION')
}

function attachedSourceForLesson(
  input: BuildFamilyPilotStudentDashboardInput,
  studentRef: string,
  lessonRef: string,
  assignmentRef?: string,
): boolean {
  return input.sourceAttachments.some((source) =>
    source.studentRef === studentRef &&
    source.lessonRef === lessonRef &&
    source.status === 'ATTACHED_SATISFIED' &&
    (assignmentRef === undefined || source.assignmentRef === assignmentRef))
}

function lessonStatus(state: FamilyPilotAssignmentRecordV1['state']): FamilyPilotDashboardWorkStatus {
  if (state === 'planned') return 'NOT_STARTED'
  if (state === 'active') return 'IN_PROGRESS'
  if (state === 'paused') return 'PAUSED'
  if (state === 'completed') return 'COMPLETED'
  return 'UNAVAILABLE'
}

function scheduleStatus(item: ScheduleItemV1): FamilyPilotDashboardWorkStatus {
  if (item.status === 'pending') return 'NOT_STARTED'
  if (item.status === 'in-progress') return 'IN_PROGRESS'
  return 'COMPLETED'
}

function actionForLesson(
  studentRef: string,
  assignment: FamilyPilotAssignmentRecordV1,
  held: FamilyPilotDashboardBlockedState | null,
): FamilyPilotDashboardCommand | null {
  if (held || assignment.state === 'completed' || assignment.state === 'abandoned') return null
  return assignment.state === 'planned'
    ? startDashboardWork(studentRef, assignment.assignmentRef, 'LESSON')
    : continueDashboardWork(studentRef, assignment.assignmentRef, 'LESSON')
}

function actionForAssessment(
  studentRef: string,
  assessment: FinalFamilyPilotAssessmentAssignment,
  held: FamilyPilotDashboardBlockedState | null,
): FamilyPilotDashboardCommand | null {
  if (held || assessment.status === 'CERTIFIED') return null
  return assessment.status === 'PLANNED'
    ? startDashboardWork(studentRef, assessment.assignmentRef, 'ASSESSMENT')
    : assessment.status === 'ACTIVE'
      ? continueDashboardWork(studentRef, assessment.assignmentRef, 'ASSESSMENT')
      : null
}

function courseForSubject(
  input: BuildFamilyPilotStudentDashboardInput,
  subject: AcademySubject,
  workingGrade: Grade,
): FinalCatalogCourse | null {
  const numericGrade = parseFinalCurriculumGrade(workingGrade)
  if (numericGrade === null || !input.catalog.runtime.listGrades().includes(numericGrade)) return null
  return input.catalog.runtime.listCourses(numericGrade)
    .find((course) => course.subject === subject) ?? null
}

async function lessonWorkItem(
  input: BuildFamilyPilotStudentDashboardInput,
  scheduleItem: ScheduleItemV1,
  assignment: FamilyPilotAssignmentRecordV1,
  studentRef: string,
  timing: 'TODAY' | 'UPCOMING',
): Promise<FamilyPilotDashboardWorkItem> {
  let lesson: FinalCatalogLesson | undefined
  try {
    lesson = await input.catalog.runtime.getLesson(assignment.lessonRef)
  } catch {
    lesson = undefined
  }

  let held: FamilyPilotDashboardBlockedState | null = null
  if (
    !lesson ||
    lesson.lessonRef !== assignment.lessonRef ||
    lesson.subject !== assignment.subject ||
    lesson.sourceReadiness.state === 'unavailable'
  ) {
    held = blocked('ASSIGNMENT_UNAVAILABLE')
  } else if (assignment.state !== 'completed') {
    if (storageBlocked(input)) held = blocked('STORAGE_UNAVAILABLE')
    else if (safetyUnavailable(input)) held = blocked('SAFETY_HOLD')
    else if (openHoldFor(input, studentRef, assignment)) held = blocked('SAFETY_HOLD')
    else if (guardianPendingFor(input, studentRef, assignment.assignmentRef)) held = blocked('GUARDIAN_PENDING')
    else if (
      lesson.sourceReadiness.state === 'dynamic' &&
      !attachedSourceForLesson(input, studentRef, assignment.lessonRef, assignment.assignmentRef)
    ) held = blocked('SOCIAL_SOURCE_REQUIRED')
  }

  const status = held && assignment.state !== 'completed'
    ? held.kind === 'ASSIGNMENT_UNAVAILABLE' ? 'UNAVAILABLE' : 'WAITING'
    : lessonStatus(assignment.state)
  return Object.freeze({
    scheduleItemRef: scheduleItem.scheduleItemRef,
    assignmentRef: assignment.assignmentRef,
    kind: 'LESSON',
    title: assignment.title,
    subject: academySubject(assignment.subject),
    courseRef: lesson?.courseRef ?? null,
    workingGrade: lesson ? String(lesson.grade) as Grade : null,
    date: scheduleItem.date,
    timing,
    status,
    blocked: held,
    action: actionForLesson(studentRef, assignment, held),
  })
}

async function assessmentWorkItem(
  input: BuildFamilyPilotStudentDashboardInput,
  scheduleItem: ScheduleItemV1,
  assessment: FinalFamilyPilotAssessmentAssignment,
  studentRef: string,
  timing: 'TODAY' | 'UPCOMING',
): Promise<FamilyPilotDashboardWorkItem> {
  let material: Awaited<ReturnType<typeof input.catalog.getAssessment>> = null
  try {
    material = await input.catalog.getAssessment(assessment.assessmentRef)
  } catch {
    material = null
  }

  let held: FamilyPilotDashboardBlockedState | null = null
  if (
    !material ||
    material.assessmentRef !== assessment.assessmentRef ||
    material.courseRef !== assessment.courseRef ||
    material.grade !== assessment.grade ||
    material.subject !== assessment.subject
  ) held = blocked('ASSIGNMENT_UNAVAILABLE')
  else if (assessment.status !== 'CERTIFIED') {
    if (storageBlocked(input)) held = blocked('STORAGE_UNAVAILABLE')
    else if (assessment.status === 'PENDING_ASSESSMENT') held = blocked('ASSESSMENT_SCORING_PENDING')
    else if (assessment.status === 'ADULT_REVIEW_REQUIRED') held = blocked('ADULT_REVIEW_REQUIRED')
    else if (assessment.status === 'PENDING_GUARDIAN_ATTESTATION') held = blocked('GUARDIAN_PENDING')
    else if (
      material.productionReadiness.requiresSourceAttachment &&
      material.location.assessmentLessonRef &&
      !attachedSourceForLesson(input, studentRef, material.location.assessmentLessonRef)
    ) held = blocked('SOCIAL_SOURCE_REQUIRED')
  }

  const status: FamilyPilotDashboardWorkStatus = assessment.status === 'CERTIFIED'
    ? 'COMPLETED'
    : held
      ? held.kind === 'ASSIGNMENT_UNAVAILABLE' ? 'UNAVAILABLE' : 'WAITING'
      : assessment.status === 'PLANNED' ? 'NOT_STARTED' : 'IN_PROGRESS'
  return Object.freeze({
    scheduleItemRef: scheduleItem.scheduleItemRef,
    assignmentRef: assessment.assignmentRef,
    kind: 'ASSESSMENT',
    title: assessment.title,
    subject: assessment.subject,
    courseRef: assessment.courseRef,
    workingGrade: String(assessment.grade) as Grade,
    date: scheduleItem.date,
    timing,
    status,
    blocked: held,
    action: actionForAssessment(studentRef, assessment, held),
  })
}

async function projectScheduleItem(
  input: BuildFamilyPilotStudentDashboardInput,
  scheduleItem: ScheduleItemV1,
  studentRef: string,
  assignments: readonly FamilyPilotAssignmentRecordV1[],
  assessments: readonly FinalFamilyPilotAssessmentAssignment[],
  timing: 'TODAY' | 'UPCOMING',
): Promise<FamilyPilotDashboardWorkItem> {
  if (scheduleItem.kind === 'break') {
    return Object.freeze({
      scheduleItemRef: scheduleItem.scheduleItemRef,
      assignmentRef: null,
      kind: 'BREAK',
      title: scheduleItem.title,
      subject: null,
      courseRef: null,
      workingGrade: null,
      date: scheduleItem.date,
      timing,
      status: scheduleStatus(scheduleItem),
      blocked: null,
      action: null,
    })
  }
  if (scheduleItem.kind === 'study-session' || !scheduleItem.assignmentRef) {
    return Object.freeze({
      scheduleItemRef: scheduleItem.scheduleItemRef,
      assignmentRef: null,
      kind: 'STUDY_SESSION',
      title: scheduleItem.title,
      subject: null,
      courseRef: null,
      workingGrade: null,
      date: scheduleItem.date,
      timing,
      status: scheduleStatus(scheduleItem),
      blocked: null,
      action: null,
    })
  }
  const assignment = assignments.find((item) => item.assignmentRef === scheduleItem.assignmentRef)
  if (assignment) return lessonWorkItem(input, scheduleItem, assignment, studentRef, timing)
  const assessment = assessments.find((item) => item.assignmentRef === scheduleItem.assignmentRef)
  if (assessment) return assessmentWorkItem(input, scheduleItem, assessment, studentRef, timing)
  return Object.freeze({
    scheduleItemRef: scheduleItem.scheduleItemRef,
    assignmentRef: scheduleItem.assignmentRef,
    kind: 'UNAVAILABLE',
    title: scheduleItem.title,
    subject: null,
    courseRef: null,
    workingGrade: null,
    date: scheduleItem.date,
    timing,
    status: 'UNAVAILABLE',
    blocked: blocked('ASSIGNMENT_UNAVAILABLE'),
    action: null,
  })
}

function assessmentStatus(
  assessments: readonly FinalFamilyPilotAssessmentAssignment[],
): FamilyPilotDashboardCourseModel['assessmentStatus'] {
  if (assessments.length === 0) return 'NONE'
  if (assessments.every((item) => item.status === 'CERTIFIED')) return 'COMPLETE'
  if (assessments.some((item) =>
    item.status === 'PENDING_ASSESSMENT' ||
    item.status === 'ADULT_REVIEW_REQUIRED' ||
    item.status === 'PENDING_GUARDIAN_ATTESTATION')) return 'WAITING'
  return 'OPEN'
}

function buildCourses(
  input: BuildFamilyPilotStudentDashboardInput,
  studentRef: string,
  assignments: readonly FamilyPilotAssignmentRecordV1[],
  assessments: readonly FinalFamilyPilotAssessmentAssignment[],
): readonly FamilyPilotDashboardCourseModel[] {
  const learner = input.setup.students.find((student) => student.studentRef === studentRef)
  if (!learner) return Object.freeze([])
  const pendingGuardianAssignmentRefs = new Set(input.attestations
    .filter((attestation) => attestation.studentRef === studentRef && attestation.status === 'PENDING_GUARDIAN_ATTESTATION')
    .map((attestation) => attestation.assignmentRef))
  return Object.freeze(learner.enabledSubjects.map((subject) => {
    const workingGrade = learner.workingGradeBySubject[subject] ?? learner.nominalGrade
    const course = courseForSubject(input, subject, workingGrade)
    const courseLessonRefs = course
      ? new Set(input.catalog.runtime.listUnits(course.courseRef).flatMap((unit) => unit.lessonRefs))
      : null
    const lessonAssignments = assignments.filter((item) =>
      item.subject === subject &&
      item.state !== 'abandoned' &&
      (!courseLessonRefs || courseLessonRefs.has(item.lessonRef)))
    const completedLessons = lessonAssignments.filter((item) => item.state === 'completed').length
    const courseAssessments = assessments.filter((item) =>
      item.subject === subject && (!course || item.courseRef === course.courseRef))
    const completion = deriveCanonicalCourseCompletion({
      catalog: input.catalog.runtime,
      studentRef,
      subject,
      workingGrade,
      assignments,
      assessments,
      pendingGuardianAssignmentRefs,
    })
    const current = lessonAssignments.find((item) => item.state === 'active')
      ?? lessonAssignments.find((item) => item.state === 'paused')
      ?? lessonAssignments.find((item) => item.state === 'planned')
    const unit = course && current
      ? input.catalog.runtime.listUnits(course.courseRef).find((item) => item.lessonRefs.includes(current.lessonRef))
      : undefined
    return Object.freeze({
      subject,
      workingGrade,
      curriculumStatus: course ? 'AVAILABLE' : 'UNAVAILABLE',
      courseRef: course?.courseRef ?? null,
      title: course?.title ?? `${ACADEMY_SUBJECT_LABELS[subject] ?? subject} · Grade ${workingGrade}`,
      assignedLessons: lessonAssignments.length,
      completedLessons,
      totalLessons: completion.requiredLessonCount,
      requiredAssessments: completion.requiredAssessmentCount,
      completionPercent: completion.requiredLessonCount + completion.requiredAssessmentCount > 0
        ? Math.round((completion.completedLessonCount + completion.certifiedAssessmentCount) /
          (completion.requiredLessonCount + completion.requiredAssessmentCount) * 100)
        : null,
      completionStatus: completion.status,
      completionDate: completion.completedAt,
      nextCourseOptions: completion.nextCourseOptions,
      currentUnit: unit ? Object.freeze({
        unitRef: unit.unitRef,
        unitNumber: unit.unitNumber,
        title: unit.title,
      }) : null,
      assessmentsAssigned: courseAssessments.length,
      assessmentsCertified: courseAssessments.filter((item) => item.status === 'CERTIFIED').length,
      assessmentStatus: assessmentStatus(courseAssessments),
      action: course ? openDashboardCourse(studentRef, course.courseRef) : null,
    })
  }))
}

function buildProgress(
  assignments: readonly FamilyPilotAssignmentRecordV1[],
  assessments: readonly FinalFamilyPilotAssessmentAssignment[],
): FamilyPilotDashboardProgressModel {
  const learnerAssignments = assignments.filter((item) => item.state !== 'abandoned')
  const completed = learnerAssignments.filter((item) => item.state === 'completed')
  return Object.freeze({
    lessonsAssigned: learnerAssignments.length,
    lessonsCompleted: completed.length,
    assessmentsAssigned: assessments.length,
    assessmentsCertified: assessments.filter((item) => item.status === 'CERTIFIED').length,
    recentCompletions: Object.freeze(completed
      .filter((item): item is FamilyPilotAssignmentRecordV1 & { readonly completedAt: string } => Boolean(item.completedAt))
      .sort((a, b) => b.completedAt.localeCompare(a.completedAt))
      .slice(0, FAMILY_PILOT_DASHBOARD_RECENT_LIMIT)
      .map((item) => Object.freeze({
        assignmentRef: item.assignmentRef,
        title: item.title,
        subject: academySubject(item.subject),
        completedAt: item.completedAt,
      }))),
  })
}

function buildAlerts(
  input: BuildFamilyPilotStudentDashboardInput,
  studentRef: string,
  today: readonly FamilyPilotDashboardWorkItem[],
): readonly FamilyPilotDashboardAlert[] {
  const counts = new Map<FamilyPilotDashboardBlockedKind, number>()
  for (const item of today) {
    if (item.blocked) counts.set(item.blocked.kind, (counts.get(item.blocked.kind) ?? 0) + 1)
  }
  const openHolds = input.safetyHolds.filter((hold) => hold.studentRef === studentRef && hold.status !== 'cleared').length
  const pendingGuardians = input.attestations.filter((attestation) =>
    attestation.studentRef === studentRef && attestation.status === 'PENDING_GUARDIAN_ATTESTATION').length
  if (openHolds > (counts.get('SAFETY_HOLD') ?? 0)) counts.set('SAFETY_HOLD', openHolds)
  if (safetyUnavailable(input) && !counts.has('SAFETY_HOLD')) counts.set('SAFETY_HOLD', 1)
  if (pendingGuardians > (counts.get('GUARDIAN_PENDING') ?? 0)) counts.set('GUARDIAN_PENDING', pendingGuardians)
  if (storageBlocked(input) && !counts.has('STORAGE_UNAVAILABLE')) counts.set('STORAGE_UNAVAILABLE', 1)
  return Object.freeze(Array.from(counts, ([kind, count]) => Object.freeze({
    kind,
    message: BLOCKED_COPY[kind],
    count,
  })))
}

/**
 * Pure composition over current Family Pilot authorities, except for bounded
 * lazy catalog lookups for the visible today/upcoming items. Returns null when
 * there is no exact active learner; it never falls back to a sibling.
 */
export async function buildFamilyPilotStudentDashboardModel(
  input: BuildFamilyPilotStudentDashboardInput,
): Promise<FamilyPilotStudentDashboardModel | null> {
  const studentRef = input.activeStudentRef
  if (!studentRef) return null
  const learner = input.setup.students.find((item) => item.studentRef === studentRef)
  if (!learner) return null

  const coreStudent = input.coreState.students.find((item) => item.studentRef === studentRef)
  const assignments = coreStudent?.assignments ?? Object.freeze([])
  const assessments = input.assessments.filter((item) => item.studentRef === studentRef)
  const learnerSchedule = input.schedule.filter((item) => item.studentRef === studentRef)
  const todaySource = learnerSchedule
    .filter((item) => item.date === input.today)
    .sort((a, b) => a.order - b.order)
  const upcomingSource = learnerSchedule
    .filter((item) => item.date > input.today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order)
    .slice(0, FAMILY_PILOT_DASHBOARD_UPCOMING_LIMIT)
  const todayItems = await Promise.all(todaySource
    .slice(0, FAMILY_PILOT_DASHBOARD_TODAY_LIMIT)
    .map((item) => projectScheduleItem(input, item, studentRef, assignments, assessments, 'TODAY')))
  const upcoming = await Promise.all(upcomingSource
    .map((item) => projectScheduleItem(input, item, studentRef, assignments, assessments, 'UPCOMING')))
  const jarvisPort = input.jarvisPort ?? FAMILY_PILOT_VISUAL_ONLY_JARVIS_PORT

  return Object.freeze({
    learner: Object.freeze({
      studentRef,
      displayName: learner.displayName,
      avatarInitial: initials(learner.displayName),
      nominalGrade: learner.nominalGrade,
      greeting: `Welcome, ${learner.displayName}`,
    }),
    today: Object.freeze({
      date: input.today,
      state: todaySource.length > 0 ? 'SCHEDULED' : 'EMPTY',
      emptyReason: todaySource.length > 0 ? null : 'NO_SCHEDULED_WORK',
      items: Object.freeze(todayItems),
      scheduledCount: todaySource.length,
      omittedCount: Math.max(0, todaySource.length - FAMILY_PILOT_DASHBOARD_TODAY_LIMIT),
      academicCount: todaySource.filter((item) => item.kind !== 'break').length,
      completedAcademicCount: todaySource.filter((item) => {
        if (item.kind === 'break') return false
        if (!item.assignmentRef) return item.status === 'completed'
        const lessonAssignment = assignments.find((assignment) => assignment.assignmentRef === item.assignmentRef)
        if (lessonAssignment) return lessonAssignment.state === 'completed'
        return assessments.some((assessment) =>
          assessment.assignmentRef === item.assignmentRef && assessment.status === 'CERTIFIED')
      }).length,
    }),
    courses: buildCourses(input, studentRef, assignments, assessments),
    progressSummary: buildProgress(assignments, assessments),
    upcoming: Object.freeze(upcoming),
    alerts: buildAlerts(input, studentRef, todayItems),
    tools: Object.freeze([
      Object.freeze({ kind: 'SCHEDULE' as const, action: openDashboardSurface(studentRef, 'OPEN_SCHEDULE') }),
      Object.freeze({ kind: 'REPORTS' as const, action: openDashboardSurface(studentRef, 'OPEN_REPORTS') }),
      Object.freeze({ kind: 'ASSIGNMENTS' as const, action: openDashboardSurface(studentRef, 'OPEN_ASSIGNMENTS') }),
    ]),
    jarvis: Object.freeze({
      mode: 'VISUAL_ONLY',
      status: jarvisPort.tutorCapability === 'AVAILABLE' ? 'AVAILABLE_VISUAL' : 'STATIC_HELP_AVAILABLE',
      tutorCapability: jarvisPort.tutorCapability,
      interactive: false,
      staticHelpAvailable: true,
    }),
    actions: Object.freeze({
      signOut: openDashboardSurface(studentRef, 'SIGN_OUT'),
    }),
  })
}

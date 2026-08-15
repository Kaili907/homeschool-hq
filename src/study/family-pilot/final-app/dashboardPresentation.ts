import type { AcademySubject } from '../../../types'
import type {
  FamilyPilotDashboardBlockedKind,
  FamilyPilotDashboardWorkItem,
  FamilyPilotStudentDashboardModel,
} from '../dashboard-adapter'
import type {
  StudentDashboardItemState,
  StudentDashboardMission,
  StudentDashboardMissionState,
  StudentDashboardModel,
} from '../student-dashboard'

const SUBJECT_LABEL: Readonly<Record<AcademySubject, string>> = Object.freeze({
  mathematics: 'Mathematics',
  'english-language-arts': 'English Language Arts',
  science: 'Science',
  'social-studies': 'Social Studies',
  health: 'Health',
  'physical-education': 'Physical Education',
  'ready-for-life': 'Ready for Life',
  technology: 'Technology / Computer Science',
  'arts-and-music': 'Arts / Music',
  'financial-literacy': 'Financial Literacy',
})

const STATUS_LABEL: Readonly<Record<FamilyPilotDashboardWorkItem['status'], string>> = Object.freeze({
  NOT_STARTED: 'Not started',
  IN_PROGRESS: 'In progress',
  PAUSED: 'Paused',
  COMPLETED: 'Complete',
  WAITING: 'Waiting',
  UNAVAILABLE: 'Unavailable',
})

const BLOCKED_MISSION: Readonly<Record<FamilyPilotDashboardBlockedKind, StudentDashboardMissionState>> = Object.freeze({
  STORAGE_UNAVAILABLE: 'storage-unavailable',
  SAFETY_HOLD: 'safety-blocked',
  GUARDIAN_PENDING: 'guardian-pending',
  SOCIAL_SOURCE_REQUIRED: 'social-source-blocked',
  ASSESSMENT_SCORING_PENDING: 'assessment-pending',
  ADULT_REVIEW_REQUIRED: 'assessment-pending',
  ASSIGNMENT_UNAVAILABLE: 'assessment-pending',
})

function formatDate(date: string, options: Intl.DateTimeFormatOptions): string {
  const parsed = new Date(`${date}T12:00:00.000Z`)
  if (!Number.isFinite(parsed.getTime())) return date
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(parsed)
}

function contextFor(item: FamilyPilotDashboardWorkItem): string {
  const subject = item.subject ? SUBJECT_LABEL[item.subject] : item.kind === 'BREAK' ? 'Break' : 'Study'
  return item.workingGrade ? `${subject} · Working Grade ${item.workingGrade}` : subject
}

function itemState(item: FamilyPilotDashboardWorkItem): StudentDashboardItemState {
  if (item.blocked) return 'blocked'
  if (item.status === 'COMPLETED') return 'complete'
  if (item.status === 'IN_PROGRESS' || item.status === 'PAUSED') return 'in-progress'
  if (item.status === 'NOT_STARTED') return 'ready'
  if (item.status === 'WAITING') return 'pending'
  return 'unavailable'
}

function actionLabel(item: FamilyPilotDashboardWorkItem): string | undefined {
  if (item.action?.type === 'START') return 'Start'
  if (item.action?.type === 'CONTINUE') return 'Continue'
  return undefined
}

function missionFor(model: FamilyPilotStudentDashboardModel): StudentDashboardMission {
  const next = model.today.items.find((item) =>
    item.action?.type === 'CONTINUE' && (item.status === 'IN_PROGRESS' || item.status === 'PAUSED'))
    ?? model.today.items.find((item) => item.action?.type === 'START')
    ?? model.today.items.find((item) => item.blocked || item.status === 'WAITING' || item.status === 'UNAVAILABLE')

  if (!next) {
    const complete = model.today.academicCount > 0 && model.today.completedAcademicCount === model.today.academicCount
    return {
      state: 'no-work',
      eyebrow: complete ? 'Today’s plan' : 'Today’s schedule',
      title: complete ? 'Today’s work is complete' : 'No work scheduled today',
      statusLabel: complete ? 'All scheduled work complete' : 'Your schedule is clear',
      description: complete
        ? 'Your completed work is reflected in your real learner progress.'
        : 'There are no current schedule items for this learner.',
    }
  }

  const blockedKind = next.blocked?.kind
  const isAssessment = next.kind === 'ASSESSMENT'
  const action = actionLabel(next)
  const state: StudentDashboardMissionState = blockedKind
    ? BLOCKED_MISSION[blockedKind]
    : next.status === 'IN_PROGRESS' || next.status === 'PAUSED'
      ? 'continue-lesson'
      : next.status === 'WAITING'
        ? 'assessment-pending'
        : 'lesson-ready'
  const statusLabel = next.blocked?.message ?? STATUS_LABEL[next.status]

  return {
    state,
    eyebrow: action === 'Continue' ? 'Continue your work' : isAssessment ? 'Assessment' : 'Up next',
    title: next.title,
    context: contextFor(next),
    statusLabel,
    description: next.blocked?.message ?? (action === 'Continue'
      ? 'Continue from the exact place saved by Study.'
      : action === 'Start'
        ? 'This scheduled work is ready to open in Study.'
        : 'This work is waiting and cannot be opened yet.'),
    ...(next.assignmentRef && action ? {
      workRef: next.assignmentRef,
      actionLabel: `${action} ${isAssessment ? 'assessment' : 'lesson'}`,
    } : {}),
  }
}

/** Pure presentation projection. It preserves adapter refs and never creates authority. */
export function toStudentDashboardPresentation(
  model: FamilyPilotStudentDashboardModel,
): StudentDashboardModel {
  return {
    student: {
      displayName: model.learner.displayName,
      avatarInitial: model.learner.avatarInitial,
    },
    periodEyebrow: 'Today’s Academy plan',
    periodLabel: formatDate(model.today.date, { weekday: 'long', month: 'long', day: 'numeric' }),
    progressLabel: model.today.academicCount > 0
      ? `${model.today.completedAcademicCount} of ${model.today.academicCount} complete today`
      : 'No work scheduled today',
    mission: missionFor(model),
    todayItems: model.today.items.map((item) => ({
      workRef: item.assignmentRef ?? item.scheduleItemRef,
      title: item.title,
      context: contextFor(item),
      state: itemState(item),
      stateLabel: item.blocked?.message ?? STATUS_LABEL[item.status],
      actionable: Boolean(item.action && (item.action.type === 'START' || item.action.type === 'CONTINUE')),
      actionLabel: actionLabel(item),
    })),
    todayEmptyLabel: model.today.state === 'EMPTY'
      ? 'No assignments or study blocks are scheduled for this learner today.'
      : undefined,
    courses: model.courses.map((course) => ({
      courseRef: course.courseRef ?? `unavailable:${course.subject}`,
      title: course.title,
      context: `${SUBJECT_LABEL[course.subject]} · Working Grade ${course.workingGrade}${course.currentUnit ? ` · Unit ${course.currentUnit.unitNumber}: ${course.currentUnit.title}` : ''}`,
      completed: course.completedLessons + course.assessmentsCertified,
      total: course.totalLessons + course.requiredAssessments,
      completionPercent: course.completionPercent,
      progressLabel: course.completionStatus === 'COMPLETE'
        ? 'Course complete'
        : course.completionStatus === 'PENDING_CERTIFICATION'
          ? 'Final assessment or guardian certification pending — course not complete'
          : course.curriculumStatus === 'AVAILABLE' && course.totalLessons > 0
            ? `${course.completedLessons} of ${course.totalLessons} required lessons complete`
            : course.curriculumStatus === 'AVAILABLE'
              ? 'No assigned work yet'
              : 'Curriculum unavailable for this working grade',
      actionable: Boolean(course.action),
    })),
    upcoming: model.upcoming.map((item) => ({
      upcomingRef: item.scheduleItemRef,
      when: formatDate(item.date, { weekday: 'short', month: 'short', day: 'numeric' }),
      title: item.title,
      detail: `${contextFor(item)} · ${item.blocked?.message ?? STATUS_LABEL[item.status]}`,
    })),
    upcomingEmptyLabel: model.upcoming.length === 0 ? 'No upcoming schedule items are available yet.' : undefined,
    quickTools: model.tools.map((tool) => ({
      toolRef: tool.action.type,
      label: tool.kind === 'SCHEDULE' ? 'Schedule' : tool.kind === 'REPORTS' ? 'My progress' : 'All assignments',
      description: tool.kind === 'SCHEDULE'
        ? 'Review today and upcoming work'
        : tool.kind === 'REPORTS'
          ? 'Open the authorized progress surface'
          : 'Open the authorized assignment tools',
    })),
  }
}

import type { StudentDashboardMissionState, StudentDashboardModel } from './types'

const BASE_MODEL: StudentDashboardModel = {
  student: { displayName: 'Avery Synthetic', avatarInitial: 'A' },
  periodEyebrow: 'Today’s Academy plan',
  periodLabel: 'Thursday · Week 1',
  progressLabel: '1 of 3 complete today',
  mission: {
    state: 'lesson-ready',
    eyebrow: 'Up next',
    title: 'Fractions in real-world situations',
    context: 'Mathematics · Grade 5',
    statusLabel: 'Ready to begin',
    description: 'Your next scheduled lesson is ready.',
    workRef: 'work:math-fractions',
    actionLabel: 'Start lesson',
  },
  todayItems: [
    { workRef: 'work:ela-evidence', title: 'Evidence in a text', context: 'English Language Arts · Grade 7', state: 'complete', stateLabel: 'Complete' },
    { workRef: 'work:math-fractions', title: 'Fractions in real-world situations', context: 'Mathematics · Grade 5', state: 'ready', stateLabel: 'Ready', actionable: true },
    { workRef: 'work:science-motion', title: 'Forces and motion', context: 'Science · Grade 8', state: 'ready', stateLabel: 'Not started', actionable: true },
  ],
  courses: [
    { courseRef: 'course:math', title: 'Mathematics', context: 'Working Grade 5', completed: 18, total: 36 },
    { courseRef: 'course:ela', title: 'English Language Arts', context: 'Working Grade 7', completed: 24, total: 40 },
    { courseRef: 'course:science', title: 'Science', context: 'Working Grade 8', completed: 9, total: 32 },
    { courseRef: 'course:social', title: 'Social Studies', context: 'Working Grade 6', completed: 6, total: 30 },
  ],
  upcoming: [
    { upcomingRef: 'upcoming:1', when: 'Tomorrow', title: 'Reading reflection', detail: 'English Language Arts' },
    { upcomingRef: 'upcoming:2', when: 'Monday', title: 'Unit assessment', detail: 'Mathematics' },
  ],
  quickTools: [
    { toolRef: 'tool:progress', label: 'My progress', description: 'See course progress' },
    { toolRef: 'tool:assignments', label: 'All assignments', description: 'Review current work' },
  ],
}

const MISSION_BY_STATE: Readonly<Record<StudentDashboardMissionState, StudentDashboardModel['mission']>> = {
  'no-work': {
    state: 'no-work', eyebrow: 'Today’s plan', title: 'No work scheduled today', statusLabel: 'Your schedule is clear',
    description: 'No assignments were supplied for today.',
  },
  'course-complete': {
    state: 'course-complete', eyebrow: 'Course progress', title: 'Course complete', statusLabel: 'Grade 5 Mathematics',
    description: 'Every required lesson and assessment is complete. The working level has not changed.',
  },
  'lesson-ready': BASE_MODEL.mission,
  'continue-lesson': {
    state: 'continue-lesson', eyebrow: 'Continue your mission', title: 'Evidence in a text', context: 'English Language Arts · Grade 7',
    statusLabel: 'In progress', description: 'Continue from your saved place.', workRef: 'work:ela-evidence', actionLabel: 'Continue lesson',
  },
  'assessment-pending': {
    state: 'assessment-pending', eyebrow: 'Assessment', title: 'Mathematics unit assessment', context: 'Mathematics · Grade 5',
    statusLabel: 'Assessment pending', description: 'This assessment is waiting for its next supplied step.', workRef: 'assessment:math-1', actionLabel: 'Open assessment',
  },
  'guardian-pending': {
    state: 'guardian-pending', eyebrow: 'Waiting for review', title: 'Application or project: hazard recognition', context: 'Ready for Life · Grade 5',
    statusLabel: 'Guardian pending', description: 'A guardian action is required before this work can continue.',
  },
  'safety-blocked': {
    state: 'safety-blocked', eyebrow: 'Study paused', title: 'Safety check-in', statusLabel: 'Safety blocked',
    description: 'This session is paused for the supplied safety check-in.',
  },
  'social-source-blocked': {
    state: 'social-source-blocked', eyebrow: 'Source required', title: 'Specialization and interdependence', context: 'Social Studies · Grade 3',
    statusLabel: 'Social source blocked', description: 'The required source has not been supplied for this assignment.',
  },
  'storage-unavailable': {
    state: 'storage-unavailable', eyebrow: 'Device storage', title: 'Your work cannot open on this device', statusLabel: 'Storage unavailable',
    description: 'The dashboard model reports that required device storage is unavailable.',
  },
}

export function studentDashboardFixture(state: StudentDashboardMissionState): StudentDashboardModel {
  const noWork = state === 'no-work'
  return {
    ...BASE_MODEL,
    mission: MISSION_BY_STATE[state],
    todayItems: noWork ? [] : BASE_MODEL.todayItems,
    todayEmptyLabel: noWork ? 'No work items were supplied for today.' : undefined,
    progressLabel: noWork ? 'No work scheduled today' : BASE_MODEL.progressLabel,
  }
}

export const STUDENT_DASHBOARD_FIXTURE_STATES: readonly StudentDashboardMissionState[] = [
  'no-work',
  'course-complete',
  'lesson-ready',
  'continue-lesson',
  'assessment-pending',
  'guardian-pending',
  'safety-blocked',
  'social-source-blocked',
  'storage-unavailable',
]

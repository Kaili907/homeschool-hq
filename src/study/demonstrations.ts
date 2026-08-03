import type { HostStudyLaunchContext } from './types'
import { DEFAULT_STUDY_ACCESSIBILITY } from './hostContext'

export const SESSION_12_DEMONSTRATIONS = Object.freeze([
  'grade-5-math-study-session',
  'grade-5-reading-study-session',
  'water-break-exact-resume',
  'partial-lesson-continuation',
  'review-recommendation-calendar',
  'parent-rejects-duration-increase',
  'hidden-timer-accommodation',
  'missing-voice-and-media',
  'safety-port-stop',
  'feature-disabled-legacy-parity',
] as const)

export function syntheticGrade5StudyContext(subject: 'math' | 'reading'): HostStudyLaunchContext {
  return {
    householdRef: 'household:synthetic-session12',
    learnerRef: `learner:synthetic-grade5-${subject}`,
    hostProfileRef: `synthetic-grade5-${subject}`,
    grade: 5,
    subject,
    lessonRef: `synthetic:grade5:${subject}:lesson`,
    skillRefs: [`synthetic:grade5:${subject}:skill`],
    householdTimeZone: 'America/New_York',
    learnerLocalDate: '2026-08-01',
    accessibility: DEFAULT_STUDY_ACCESSIBILITY,
    timerPreference: { visibility: 'shown', milestonesOnly: false },
    parentLimits: { maximumWorkMinutes: 30, breakMinutes: 5 },
    accommodationLimits: {},
  }
}

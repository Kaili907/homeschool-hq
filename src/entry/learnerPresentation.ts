import type { Grade, Profile } from '../types'

export interface LearnerPresentation {
  profileId: string
  fullName: string
  gradeLabel: string
  initials: string
  /** Presentation-only path for a future approved portrait. Never persisted. */
  portraitSrc?: string
}

/** Visual order only. Names and grades always come from the authoritative Profile. */
export const LEARNER_PROFILE_ORDER = ['p5', 'p4', 'p3', 'p2', 'p1'] as const

const GRADE_LABELS: Record<Grade, string> = {
  '3': '3rd Grade',
  '4': '4th Grade',
  '5': '5th Grade',
  '6': '6th Grade',
  '7': '7th Grade',
  '8': '8th Grade',
  '10': '10th Grade',
  '12': '12th Grade',
}

function initialsFor(name: string): string {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('')
  return initials.toUpperCase() || 'MA'
}

export function learnerPresentationForProfile(profile: Profile): LearnerPresentation {
  return {
    profileId: profile.id,
    fullName: profile.name,
    gradeLabel: GRADE_LABELS[profile.grade],
    initials: initialsFor(profile.name),
  }
}

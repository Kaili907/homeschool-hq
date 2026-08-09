export interface LearnerPresentation {
  profileId: string
  fullName: string
  gradeLabel: string
  initials: string
  /** Presentation-only path for a future approved portrait. Never persisted. */
  portraitSrc?: string
}

/**
 * UI-only learner identities, deliberately separate from Profile and AppState.
 * Real portraits can be added here later without touching PIN, auth, or learner data.
 */
export const LEARNER_PRESENTATIONS: readonly LearnerPresentation[] = [
  { profileId: 'p5', fullName: 'Kaili Manuel', gradeLabel: '12th Grade', initials: 'KM' },
  { profileId: 'p4', fullName: 'Arianna Manuel', gradeLabel: '10th Grade', initials: 'AM' },
  { profileId: 'p3', fullName: 'Stephanie Manuel', gradeLabel: '7th Grade', initials: 'SM' },
  { profileId: 'p2', fullName: 'Lucia Manuel', gradeLabel: '4th Grade', initials: 'LM' },
  { profileId: 'p1', fullName: 'Aly Manuel', gradeLabel: '3rd Grade', initials: 'AM' },
] as const

export function learnerPresentationForProfile(profileId: string): LearnerPresentation {
  return (
    LEARNER_PRESENTATIONS.find((learner) => learner.profileId === profileId) ?? {
      profileId,
      fullName: 'Academy Learner',
      gradeLabel: 'Manuel Academy',
      initials: 'MA',
    }
  )
}

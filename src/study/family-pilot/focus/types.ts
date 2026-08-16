/**
 * The whole reload-safe handle for one Family Pilot focus tracker. It is
 * observational only: local time-on-task and break advisory bookkeeping, not
 * a second copy of Study Runtime's pause/resume state. Every field is plain
 * data, so a pilot client may serialize this to local storage as-is.
 */
export interface FamilyPilotFocusSession {
  readonly studentRef: string
  readonly sessionRef: string
  readonly startedAt: string
  /** Null while on a break or otherwise not accumulating active time. */
  readonly activeSince: string | null
  /** Total active seconds recorded for the whole session. */
  readonly elapsedActiveSeconds: number
  /** Active seconds recorded since the last break started; feeds break cadence. */
  readonly activeSecondsSinceLastBreak: number
  readonly lastBreakAt: string | null
  readonly breakSuggested: boolean
}

/** A read-model projection of a session; never extrapolates beyond recorded intervals. */
export interface FamilyPilotFocusSnapshot {
  readonly studentRef: string
  readonly sessionRef: string
  readonly startedAt: string
  readonly isActive: boolean
  readonly elapsedActiveSeconds: number
  readonly elapsedActiveMinutes: number
  readonly lastBreakAt: string | null
  readonly breakSuggested: boolean
}

/**
 * The active-minutes-before-break threshold used to advise a break. This is
 * advisory pilot guidance, not a diagnosis, and never overrides Study
 * Runtime's own pause/resume or safety controls.
 */
export interface FamilyPilotBreakGuidance {
  readonly source: 'study-effective-settings' | 'pilot-guidance'
  readonly activeMinutesBeforeBreak: number
}

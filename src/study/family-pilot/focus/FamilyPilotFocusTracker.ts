import type {
  FamilyPilotBreakGuidance,
  FamilyPilotFocusSession,
  FamilyPilotFocusSnapshot,
} from './types'

/**
 * Conservative pilot default when no resolved Study effective settings break
 * interval is available. Labeled pilot guidance, not a diagnosis or a
 * clinical recommendation.
 */
const PILOT_DEFAULT_ACTIVE_MINUTES_BEFORE_BREAK = 25

export const DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE: FamilyPilotBreakGuidance = Object.freeze({
  source: 'pilot-guidance',
  activeMinutesBeforeBreak: PILOT_DEFAULT_ACTIVE_MINUTES_BEFORE_BREAK,
})

/**
 * Reuses the resolved Study effective settings break interval (see
 * `StudyEffectiveSettingsV2.requiredBreakIntervalMinutes`) when the host
 * already has one, so the pilot never invents a second break policy.
 */
export function resolveFamilyPilotBreakGuidance(
  requiredBreakIntervalMinutes?: number,
): FamilyPilotBreakGuidance {
  if (
    requiredBreakIntervalMinutes !== undefined &&
    Number.isFinite(requiredBreakIntervalMinutes) &&
    requiredBreakIntervalMinutes > 0
  ) {
    return { source: 'study-effective-settings', activeMinutesBeforeBreak: requiredBreakIntervalMinutes }
  }
  return DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE
}

function activeSecondsBetween(from: string, to: string): number {
  const fromMs = Date.parse(from)
  const toMs = Date.parse(to)
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs <= fromMs) return 0
  return Math.round((toMs - fromMs) / 1000)
}

export function startFocusSession(input: {
  readonly studentRef: string
  readonly sessionRef: string
  readonly startedAt: string
}): FamilyPilotFocusSession {
  return {
    studentRef: input.studentRef,
    sessionRef: input.sessionRef,
    startedAt: input.startedAt,
    activeSince: input.startedAt,
    elapsedActiveSeconds: 0,
    activeSecondsSinceLastBreak: 0,
    lastBreakAt: null,
    breakSuggested: false,
  }
}

/**
 * Records a closed span of wall-clock time the host has already determined
 * was actively spent on task. A no-op while the tracker is on a break (see
 * `recordBreakStarted`) or when the span is empty/out of order — Study
 * Runtime, not this tracker, decides what counts as paused.
 */
export function recordActiveInterval(
  session: FamilyPilotFocusSession,
  interval: { readonly from: string; readonly to: string },
): FamilyPilotFocusSession {
  if (session.activeSince === null) return session
  const seconds = activeSecondsBetween(interval.from, interval.to)
  if (seconds === 0) return session
  return {
    ...session,
    activeSince: interval.to,
    elapsedActiveSeconds: session.elapsedActiveSeconds + seconds,
    activeSecondsSinceLastBreak: session.activeSecondsSinceLastBreak + seconds,
  }
}

/** Advisory only: flags that a break would be reasonable now. Idempotent. */
export function suggestBreak(
  session: FamilyPilotFocusSession,
  guidance: FamilyPilotBreakGuidance = DEFAULT_FAMILY_PILOT_BREAK_GUIDANCE,
): FamilyPilotFocusSession {
  if (session.breakSuggested) return session
  if (session.activeSecondsSinceLastBreak < guidance.activeMinutesBeforeBreak * 60) return session
  return { ...session, breakSuggested: true }
}

export function recordBreakStarted(
  session: FamilyPilotFocusSession,
  input: { readonly startedAt: string },
): FamilyPilotFocusSession {
  if (session.activeSince === null) return session
  return {
    ...session,
    activeSince: null,
    activeSecondsSinceLastBreak: 0,
    lastBreakAt: input.startedAt,
    breakSuggested: false,
  }
}

/** Resume-after-break: accumulation continues from here via `recordActiveInterval`. */
export function recordBreakEnded(
  session: FamilyPilotFocusSession,
  input: { readonly resumedAt: string },
): FamilyPilotFocusSession {
  if (session.activeSince !== null) return session
  return { ...session, activeSince: input.resumedAt }
}

/** A pure projection of recorded state. Never extrapolates from the current clock. */
export function focusSnapshot(session: FamilyPilotFocusSession): FamilyPilotFocusSnapshot {
  return {
    studentRef: session.studentRef,
    sessionRef: session.sessionRef,
    startedAt: session.startedAt,
    isActive: session.activeSince !== null,
    elapsedActiveSeconds: session.elapsedActiveSeconds,
    elapsedActiveMinutes: Math.floor(session.elapsedActiveSeconds / 60),
    lastBreakAt: session.lastBreakAt,
    breakSuggested: session.breakSuggested,
  }
}

import type { CreateSafetyHoldInputV1 } from './types'

/**
 * The minimized shape of the MT-2 Tutor's existing concerning-content signal
 * (src/tutor/tutorEngine.ts isConcerning()) — a boolean plus the identifiers
 * needed to place a hold, never the learner text that produced it. Kept as a
 * duck-typed boundary rather than importing Tutor's own types, since
 * src/tutor is outside this module's ownership.
 */
export interface TutorConcerningContentSignalV1 {
  readonly studentRef: string
  readonly sessionRef: string
  readonly concerning: boolean
  readonly occurredAt: string
}

/**
 * Converts an existing Tutor/Core concerning-content signal into a Family
 * Pilot safety hold input. Returns null when the signal isn't concerning —
 * there is nothing to hold. Reuses the 'tutor-concerning-content' reason
 * code rather than inventing a new one for the same underlying concept.
 */
export function safetyHoldInputFromTutorConcerningSignal(
  signal: TutorConcerningContentSignalV1,
): CreateSafetyHoldInputV1 | null {
  if (!signal.concerning) return null
  return {
    studentRef: signal.studentRef,
    sessionRef: signal.sessionRef,
    createdAt: signal.occurredAt,
    reasonCode: 'tutor-concerning-content',
    source: 'tutor-core',
  }
}

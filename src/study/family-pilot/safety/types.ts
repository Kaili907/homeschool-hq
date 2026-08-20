export const FAMILY_PILOT_SAFETY_HOLD_SCHEMA_VERSION = 1 as const
export const FAMILY_PILOT_SAFETY_STATE_SCHEMA_VERSION = 1 as const

/**
 * Closed set of reasons a Family Pilot safety hold can exist for. Reuses
 * existing repository safety vocabulary rather than inventing new terms:
 * the two `study-safety-*` codes mirror the `SafetyClassification` values
 * ('urgent' | 'uncertain') from src/study/contracts/safety, and
 * 'tutor-concerning-content' mirrors the MT-2 Tutor's existing isConcerning()
 * signal (src/tutor/tutorEngine.ts). 'parent-review-requested' covers a
 * manual parent/student-initiated check-in that isn't driven by a classifier.
 */
export type FamilyPilotSafetyReasonCode =
  | 'study-safety-urgent'
  | 'study-safety-uncertain'
  | 'tutor-concerning-content'
  | 'parent-review-requested'

export type FamilyPilotSafetyHoldSource = 'study-safety' | 'tutor-core' | 'parent'

export type FamilyPilotSafetyHoldStatus = 'open' | 'acknowledged' | 'cleared'

/**
 * Minimized hold record. Deliberately carries no field capable of holding raw
 * learner text or Tutor conversation content — only stable identifiers and a
 * closed reasonCode/source. `status` and `reasonCode`/`source` accept unknown
 * forward-written string values (matches the ServerCaptureStatus pattern in
 * src/study/safety/localStopLedger.ts) so a record written by a newer build is
 * never discarded by an older one; only the literal string 'cleared' is ever
 * treated as non-blocking, so an unrecognised status stays conservative.
 */
export interface SafetyHoldV1 {
  readonly schemaVersion: typeof FAMILY_PILOT_SAFETY_HOLD_SCHEMA_VERSION
  readonly holdRef: string
  readonly studentRef: string
  readonly sessionRef: string
  readonly createdAt: string
  readonly status: FamilyPilotSafetyHoldStatus | (string & {})
  readonly reasonCode: FamilyPilotSafetyReasonCode | (string & {})
  readonly source: FamilyPilotSafetyHoldSource | (string & {})
  /** Stable per (studentRef, sessionRef, reasonCode) — how repeat creation is deduplicated. */
  readonly dedupeKey: string
  readonly acknowledgedAt?: string
  readonly clearedAt?: string
  readonly clearedBy?: string
}

/** Writer-side input. reasonCode/source are the strict closed set (no forward-compat escape hatch on write). */
export interface CreateSafetyHoldInputV1 {
  readonly studentRef: string
  readonly sessionRef: string
  readonly createdAt: string
  readonly reasonCode: FamilyPilotSafetyReasonCode
  readonly source: FamilyPilotSafetyHoldSource
}

/** The narrow serializable shape a future Family Pilot Core session can persist. */
export interface FamilyPilotSafetyStateV1 {
  readonly schemaVersion: typeof FAMILY_PILOT_SAFETY_STATE_SCHEMA_VERSION
  readonly holds: readonly SafetyHoldV1[]
}

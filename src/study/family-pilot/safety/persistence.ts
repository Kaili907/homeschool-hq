import { createInitialSafetyState, dedupeKeyFor, snapshotSafetyState } from './holdStore'
import { FAMILY_PILOT_SAFETY_STATE_SCHEMA_VERSION, type FamilyPilotSafetyStateV1, type SafetyHoldV1 } from './types'

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}

/**
 * Recovers one hold from an already-parsed value. Only the fields that
 * identify *who* and *which session* are load-bearing: a record missing
 * holdRef/studentRef/sessionRef/createdAt is dropped — there is no student or
 * session to conservatively block on. `status`, `reasonCode`, `source`, and
 * `dedupeKey` are all descriptive metadata, not identity — a corrupt or
 * missing one of those must never cause the whole record (and the block it
 * represents) to disappear, or a single corrupted byte could silently
 * unblock a student who should still be held. Each is instead coerced to a
 * safe default: `status` to 'open' (never silently read as 'cleared'),
 * `reasonCode`/`source` to an 'unknown-*' forward-compat value (both types
 * accept arbitrary strings), and `dedupeKey` is recomputed from the
 * surviving identity fields so future dedup still works.
 */
function recoverHold(value: unknown): SafetyHoldV1 | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (
    record.schemaVersion !== 1 ||
    !nonEmptyString(record.holdRef) ||
    !nonEmptyString(record.studentRef) ||
    !nonEmptyString(record.sessionRef) ||
    !nonEmptyString(record.createdAt)
  ) return null
  const reasonCode = nonEmptyString(record.reasonCode) ? record.reasonCode : 'unknown-reason'
  return Object.freeze({
    schemaVersion: 1,
    holdRef: record.holdRef,
    studentRef: record.studentRef,
    sessionRef: record.sessionRef,
    createdAt: record.createdAt,
    status: nonEmptyString(record.status) ? record.status : 'open',
    reasonCode,
    source: nonEmptyString(record.source) ? record.source : 'unknown-source',
    dedupeKey: nonEmptyString(record.dedupeKey)
      ? record.dedupeKey
      : dedupeKeyFor({ studentRef: record.studentRef, sessionRef: record.sessionRef, reasonCode }),
    ...(nonEmptyString(record.acknowledgedAt) ? { acknowledgedAt: record.acknowledgedAt } : {}),
    ...(nonEmptyString(record.clearedAt) ? { clearedAt: record.clearedAt } : {}),
    ...(nonEmptyString(record.clearedBy) ? { clearedBy: record.clearedBy } : {}),
  })
}

/**
 * 'available' — parsed cleanly (including the legitimate "nothing persisted
 * yet" case). 'incomplete' — the container parsed, but one or more entries
 * were unrecoverable garbage (no identifiable student/session) and were
 * dropped. 'unavailable' — the container itself was unparseable or the wrong
 * shape, so recovery could not even be attempted. A host must not treat
 * 'unavailable' the same as "no holds ever existed": an empty holds list
 * looks identical in both cases, which is exactly why this signal exists —
 * this module cannot resurrect a hold from data it cannot parse at all, but
 * it can tell the host that happened so the host can apply its own
 * conservative fallback (e.g. surfacing a parent-visible warning) instead of
 * silently treating the student as never having had a hold.
 */
export type SafetyStateRecoveryState = 'available' | 'incomplete' | 'unavailable'

export interface SafetyStateRecoveryResult {
  readonly state: FamilyPilotSafetyStateV1
  readonly recoveryState: SafetyStateRecoveryState
}

/**
 * Recovers state from an already-parsed value (e.g. from a host's own
 * session document), reporting whether recovery was clean, partial, or
 * failed outright. `null`/`undefined` is the legitimate "nothing persisted
 * yet" case and is 'available', not 'unavailable'.
 */
export function parseSafetyStateValueWithRecovery(value: unknown): SafetyStateRecoveryResult {
  if (value === null || value === undefined) {
    return { state: createInitialSafetyState(), recoveryState: 'available' }
  }
  if (typeof value !== 'object' || Array.isArray(value) || !Array.isArray((value as Record<string, unknown>).holds)) {
    return { state: createInitialSafetyState(), recoveryState: 'unavailable' }
  }
  const rawHolds = (value as Record<string, unknown>).holds as unknown[]
  let droppedAny = false
  const holds: SafetyHoldV1[] = []
  for (const item of rawHolds) {
    const hold = recoverHold(item)
    if (hold) holds.push(hold)
    else droppedAny = true
  }
  return {
    state: Object.freeze({ schemaVersion: FAMILY_PILOT_SAFETY_STATE_SCHEMA_VERSION, holds: Object.freeze(holds) }),
    recoveryState: droppedAny ? 'incomplete' : 'available',
  }
}

/** Recovers state from a raw JSON string (e.g. `storage.getItem(key)`), reporting recovery quality. Never throws. */
export function parseSafetyStateJsonWithRecovery(raw: string | null | undefined): SafetyStateRecoveryResult {
  if (!raw) return { state: createInitialSafetyState(), recoveryState: 'available' }
  try {
    return parseSafetyStateValueWithRecovery(JSON.parse(raw))
  } catch {
    return { state: createInitialSafetyState(), recoveryState: 'unavailable' }
  }
}

/** Convenience wrapper over parseSafetyStateValueWithRecovery for callers that don't need the recovery signal. */
export function parseSafetyStateValue(value: unknown): FamilyPilotSafetyStateV1 {
  return parseSafetyStateValueWithRecovery(value).state
}

/** Convenience wrapper over parseSafetyStateJsonWithRecovery for callers that don't need the recovery signal. */
export function parseSafetyStateJson(raw: string | null | undefined): FamilyPilotSafetyStateV1 {
  return parseSafetyStateJsonWithRecovery(raw).state
}

/**
 * Serializes the current state to a JSON string. This module never writes
 * this string anywhere itself — persistence is the Family Pilot Core
 * session's responsibility; this is a pure load/save helper only.
 */
export function serializeSafetyState(state: FamilyPilotSafetyStateV1): string {
  return JSON.stringify(snapshotSafetyState(state))
}

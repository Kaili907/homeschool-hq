import {
  FAMILY_PILOT_SAFETY_HOLD_SCHEMA_VERSION,
  FAMILY_PILOT_SAFETY_STATE_SCHEMA_VERSION,
  type CreateSafetyHoldInputV1,
  type FamilyPilotSafetyStateV1,
  type SafetyHoldV1,
} from './types'

export function createInitialSafetyState(): FamilyPilotSafetyStateV1 {
  return Object.freeze({ schemaVersion: FAMILY_PILOT_SAFETY_STATE_SCHEMA_VERSION, holds: Object.freeze([]) })
}

/**
 * Exported so persistence.ts can recompute a dropped/corrupt dedupeKey
 * conservatively on recovery. Takes the widened `reasonCode` type (not the
 * strict `CreateSafetyHoldInputV1` one) so a recovered forward-compat or
 * fallback reason code can still be hashed into a key.
 */
export function dedupeKeyFor(input: { readonly studentRef: string; readonly sessionRef: string; readonly reasonCode: string }): string {
  return [input.studentRef, input.sessionRef, input.reasonCode].join('')
}

// Mirrors src/study/safety/localStopLedger.ts recordId(): identity is derived
// from the input, uniqueness from a random suffix.
function generateHoldRef(input: Pick<CreateSafetyHoldInputV1, 'studentRef' | 'sessionRef' | 'reasonCode'>): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Math.random()}-${Date.now()}`
  return `family-pilot-safety-hold:${input.studentRef}:${input.sessionRef}:${input.reasonCode}:${random}`
}

/** Anything other than the literal 'cleared' blocks resume — see SafetyHoldV1 status docs. */
function isBlocking(hold: SafetyHoldV1): boolean {
  return hold.status !== 'cleared'
}

function replaceHold(
  state: FamilyPilotSafetyStateV1,
  holdRef: string,
  patch: Partial<Pick<SafetyHoldV1, 'status' | 'acknowledgedAt' | 'clearedAt' | 'clearedBy'>>,
): FamilyPilotSafetyStateV1 {
  return Object.freeze({
    ...state,
    holds: Object.freeze(state.holds.map((hold) => (hold.holdRef === holdRef ? Object.freeze({ ...hold, ...patch }) : hold))),
  })
}

/**
 * Creates an OPEN hold. Idempotent: a semantically identical open hold
 * (same studentRef + sessionRef + reasonCode) already present is returned
 * unchanged rather than duplicated, so repeated safety signals for the same
 * unresolved concern never grow an endless list.
 */
export function createSafetyHold(
  state: FamilyPilotSafetyStateV1,
  input: CreateSafetyHoldInputV1,
): { readonly state: FamilyPilotSafetyStateV1; readonly hold: SafetyHoldV1 } {
  const dedupeKey = dedupeKeyFor(input)
  const existing = state.holds.find((hold) => hold.dedupeKey === dedupeKey && isBlocking(hold))
  if (existing) return { state, hold: existing }
  const hold: SafetyHoldV1 = Object.freeze({
    schemaVersion: FAMILY_PILOT_SAFETY_HOLD_SCHEMA_VERSION,
    holdRef: generateHoldRef(input),
    studentRef: input.studentRef,
    sessionRef: input.sessionRef,
    createdAt: input.createdAt,
    status: 'open',
    reasonCode: input.reasonCode,
    source: input.source,
    dedupeKey,
  })
  return { state: Object.freeze({ ...state, holds: Object.freeze([...state.holds, hold]) }), hold }
}

/** Records that a parent has seen the hold. Does not itself allow resume — only clearSafetyHold does. */
export function acknowledgeSafetyHold(
  state: FamilyPilotSafetyStateV1,
  holdRef: string,
  input: { readonly acknowledgedAt: string },
): FamilyPilotSafetyStateV1 {
  const hold = state.holds.find((item) => item.holdRef === holdRef)
  if (!hold) throw new Error('unknown_safety_hold')
  if (hold.status !== 'open') return state
  return replaceHold(state, holdRef, { status: 'acknowledged', acknowledgedAt: input.acknowledgedAt })
}

/** The only way a hold stops blocking resume. Idempotent on an already-cleared hold. */
export function clearSafetyHold(
  state: FamilyPilotSafetyStateV1,
  holdRef: string,
  input: { readonly clearedAt: string; readonly clearedBy: string },
): FamilyPilotSafetyStateV1 {
  const hold = state.holds.find((item) => item.holdRef === holdRef)
  if (!hold) throw new Error('unknown_safety_hold')
  if (hold.status === 'cleared') return state
  return replaceHold(state, holdRef, { status: 'cleared', clearedAt: input.clearedAt, clearedBy: input.clearedBy })
}

/** All still-open holds for one student, oldest first. Never filtered by sessionRef — a parent reviews by student. */
export function listOpenSafetyHolds(state: FamilyPilotSafetyStateV1, studentRef: string): readonly SafetyHoldV1[] {
  return state.holds
    .filter((hold) => hold.studentRef === studentRef && isBlocking(hold))
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export function getOpenSafetyHold(state: FamilyPilotSafetyStateV1, studentRef: string): SafetyHoldV1 | null {
  return listOpenSafetyHolds(state, studentRef)[0] ?? null
}

/**
 * The resume gate. Requires an EXACT (studentRef, sessionRef) match on a
 * blocking hold — a hold never blocks on studentRef or sessionRef alone, so
 * Student A's hold can never block Student B even if a sessionRef were ever
 * reused, and a stale hold from an old session cannot silently attach itself
 * to a different student's session.
 */
export function canStudentResume(state: FamilyPilotSafetyStateV1, studentRef: string, sessionRef: string): boolean {
  return !state.holds.some((hold) => hold.studentRef === studentRef && hold.sessionRef === sessionRef && isBlocking(hold))
}

/** A frozen, serializable copy of the current state — what a host persists. */
export function snapshotSafetyState(state: FamilyPilotSafetyStateV1): FamilyPilotSafetyStateV1 {
  return Object.freeze({ schemaVersion: state.schemaVersion, holds: Object.freeze([...state.holds]) })
}

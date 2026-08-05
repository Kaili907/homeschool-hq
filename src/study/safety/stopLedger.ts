import type { StudyScope } from '../types'

/**
 * A6-5-C — the durable, local-first record of every Study safety stop.
 *
 * Two jobs share one storage slot:
 *
 *  1. The per-session STOP LOCK. A stop must survive a refresh, navigation away
 *     and back, and a new tab, so a flagged learner cannot continue by reloading
 *     the page. Nothing in the app clears it (see clearsThisLock in the A6-5-C
 *     report); the student surface offers no control that touches it.
 *
 *  2. The STOP LEDGER the adult surface reads. It is written at the moment of
 *     the stop — including stops where no server proposal was ever created — so
 *     a parent is never shown an empty safety record after a stop happened.
 *
 * Kept in its own localStorage slot, OUTSIDE AppState, on the pattern
 * mindset/journalStore.ts uses: because it is not part of AppState it is never
 * carried by the standard export or the Supabase sync payload. It stores only
 * opaque refs and a classification — never the transient learner text, never
 * Tutor output.
 */

const STOP_LEDGER_LS = 'homeschool-hq:study-safety-stops:v1'

export type StudyStopClassification = 'urgent' | 'uncertain' | 'invalid'

/**
 * Whether the adult-review proposal for this stop reached durable server
 * storage. `never-attempted` means the gateway was never successfully reached
 * at all (auth, network, timeout, gateway error, malformed response), so there
 * is no server record of the stop anywhere — only this one.
 */
export type StudyStopCaptureStatus = 'captured' | 'not-confirmed' | 'never-attempted'

export interface StudySafetyStopRecord {
  readonly stopRef: string
  readonly occurredAt: string
  readonly householdRef: string
  readonly learnerRef: string
  readonly sessionRef: string
  readonly classification: StudyStopClassification
  readonly captureStatus: StudyStopCaptureStatus
  /** Why capture did not complete, when it did not. */
  readonly captureReasonCode: string | null
}

function ls(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null
  } catch {
    return null
  }
}

const CLASSIFICATIONS: readonly string[] = ['urgent', 'uncertain', 'invalid']
const CAPTURE_STATUSES: readonly string[] = ['captured', 'not-confirmed', 'never-attempted']
const ref = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 192

/**
 * Deliberately permissive: this guard only rejects entries that could not be
 * rendered or matched at all. A stop record is never dropped for cosmetic
 * reasons — dropping one would silently unlock a stopped session.
 */
function validRecord(value: unknown): value is StudySafetyStopRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const entry = value as Record<string, unknown>
  return (
    ref(entry.stopRef) &&
    typeof entry.occurredAt === 'string' && Number.isFinite(Date.parse(entry.occurredAt)) &&
    ref(entry.householdRef) && ref(entry.learnerRef) && ref(entry.sessionRef) &&
    CLASSIFICATIONS.includes(String(entry.classification)) &&
    CAPTURE_STATUSES.includes(String(entry.captureStatus)) &&
    (entry.captureReasonCode === null || typeof entry.captureReasonCode === 'string')
  )
}

/**
 * Records localStorage refused (quota, disabled storage). A refused write must
 * not also lose the record from the adult surface in this browser session.
 */
const unpersisted: StudySafetyStopRecord[] = []

function readStored(): StudySafetyStopRecord[] {
  const store = ls()
  if (!store) return []
  try {
    const parsed = JSON.parse(store.getItem(STOP_LEDGER_LS) ?? '[]') as unknown
    return Array.isArray(parsed) ? parsed.filter(validRecord) : []
  } catch {
    return []
  }
}

/** Every recorded stop, newest first. Adult surfaces read this. */
export function readSafetyStopLedger(): readonly StudySafetyStopRecord[] {
  const byRef = new Map<string, StudySafetyStopRecord>()
  for (const record of [...readStored(), ...unpersisted]) byRef.set(record.stopRef, record)
  return Object.freeze(
    [...byRef.values()].sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt)),
  )
}

/** True when this exact session was stopped. This is the lock. */
export function isStudySessionStopped(scope: StudyScope): boolean {
  return readSafetyStopLedger().some((record) =>
    record.householdRef === scope.householdRef &&
    record.learnerRef === scope.learnerRef &&
    record.sessionRef === scope.sessionRef)
}

/**
 * Client-side classification failures observed by the mounted safety port. A
 * fail-closed response means the gateway was never successfully reached, so no
 * server proposal exists for the stop that follows it.
 */
const clientSideFailures = new Map<string, string>()

const sessionKey = (scope: StudyScope) => `${scope.householdRef}|${scope.learnerRef}|${scope.sessionRef}`

export function noteClientSideSafetyFailure(scope: StudyScope, reasonCode: string): void {
  clientSideFailures.set(sessionKey(scope), reasonCode)
}

function resolveCapture(
  scope: StudyScope,
  deliveryStatus: 'proposed-not-delivered' | 'not-confirmed',
): { readonly captureStatus: StudyStopCaptureStatus; readonly captureReasonCode: string | null } {
  const clientFailure = clientSideFailures.get(sessionKey(scope))
  clientSideFailures.delete(sessionKey(scope))
  if (clientFailure) return { captureStatus: 'never-attempted', captureReasonCode: clientFailure }
  return deliveryStatus === 'proposed-not-delivered'
    ? { captureStatus: 'captured', captureReasonCode: null }
    : { captureStatus: 'not-confirmed', captureReasonCode: 'server-capture-not-confirmed' }
}

/**
 * Records one safety stop durably and locks the session. Called at the moment
 * of the stop, before any step that can fail, so neither an event-ledger write
 * nor a failed server proposal can leave the stop unrecorded.
 */
export function recordSafetyStop(input: {
  readonly scope: StudyScope
  readonly occurredAt: string
  readonly classification: StudyStopClassification
  readonly deliveryStatus: 'proposed-not-delivered' | 'not-confirmed'
}): StudySafetyStopRecord {
  const capture = resolveCapture(input.scope, input.deliveryStatus)
  const record: StudySafetyStopRecord = Object.freeze({
    stopRef: `stop:${input.scope.sessionRef}:${input.occurredAt}`,
    occurredAt: input.occurredAt,
    householdRef: input.scope.householdRef,
    learnerRef: input.scope.learnerRef,
    sessionRef: input.scope.sessionRef,
    classification: input.classification,
    captureStatus: capture.captureStatus,
    captureReasonCode: capture.captureReasonCode,
  })
  const store = ls()
  try {
    if (!store) throw new Error('no-local-storage')
    const kept = readStored().filter((entry) => entry.stopRef !== record.stopRef)
    store.setItem(STOP_LEDGER_LS, JSON.stringify([...kept, record]))
  } catch {
    // Storage refused. The stop is not durable across a refresh, but it stays
    // visible to the adult for the rest of this browser session.
    unpersisted.push(record)
  }
  return record
}

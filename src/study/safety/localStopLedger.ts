export const LOCAL_SAFETY_STOP_LEDGER_KEY = 'manuel-academy.study.local-safety-stops.v1'
const HEALTH_KEY = `${LOCAL_SAFETY_STOP_LEDGER_KEY}:health`

export type PreAcceptanceSafetyFailureMode = 'classifier-unreachable' | 'request-timeout' | 'gateway-503' | 'authentication-failure' | 'malformed-server-response' | 'non-production-safety-port' | 'network-failure-mid-request'
// A6-5-C adds the third value. A6-4's two keep their exact meanings and remain
// the canonical local-capture-only split: 'server-not-contacted' means the
// gateway was never reached, 'server-acceptance-not-confirmed' means it was sent
// but acceptance could not be confirmed. 'server-answered-stop' is written only
// when the safety service actually returned a non-clear answer, which the host
// can prove: a fail-closed client result can never carry 'proposed-not-delivered'.
export type ServerCaptureStatus = 'server-not-contacted' | 'server-acceptance-not-confirmed' | 'server-answered-stop' | (string & {})
// Where the record was written, not what the server did. A6-4's safety port
// writes 'local-pre-acceptance-stop' before any acceptance; the Study session
// container writes 'local-session-stop' at the moment the session stopped.
export type LocalSafetyStopCaptureOrigin = 'local-pre-acceptance-stop' | 'local-session-stop' | (string & {})
export interface LocalSafetyStopRecordV1 {
  readonly schemaVersion: 1 | 2
  readonly recordId: string
  readonly occurredAt: string
  readonly studentRef: string
  readonly sessionRef?: string
  readonly failureMode?: PreAcceptanceSafetyFailureMode | string
  readonly serverCaptureStatus: ServerCaptureStatus
  readonly captureOrigin: LocalSafetyStopCaptureOrigin
}
export type LocalSafetyStopHistoryState = 'available' | 'unavailable' | 'incomplete'
export interface LocalSafetyStopLedgerView { readonly records: readonly LocalSafetyStopRecordV1[]; readonly historyState: LocalSafetyStopHistoryState }
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
export interface LedgerLockPort { request<T>(name: string, callback: () => Promise<T>): Promise<T> }
let lastStorageFailure = false
function browserStorage(): StorageLike | undefined { try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { lastStorageFailure = true; return undefined } }
// Deliberately permissive, and it must stay that way. The durable stop lock is
// derived from these records, so a record dropped here silently unlocks a stopped
// session for the student. schemaVersion 1 and 2 are both accepted; failureMode
// and sessionRef stay optional; an unrecognised serverCaptureStatus or
// captureOrigin is kept rather than filtered, so a record written by a newer
// build is never discarded by an older one.
function valid(record: unknown): record is LocalSafetyStopRecordV1 {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false
  const value = record as Record<string, unknown>
  return (value.schemaVersion === 1 || value.schemaVersion === 2) && typeof value.recordId === 'string' && typeof value.occurredAt === 'string' && typeof value.studentRef === 'string' && typeof value.serverCaptureStatus === 'string' && typeof value.captureOrigin === 'string' && value.captureOrigin.length > 0
}
export function readLocalSafetyStopLedger(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): LocalSafetyStopLedgerView {
  if (!storage) return { records: [], historyState: 'unavailable' }
  try {
    const raw = storage.getItem(LOCAL_SAFETY_STOP_LEDGER_KEY)
    const health = storage.getItem(HEALTH_KEY)
    const parsed: unknown = JSON.parse(raw ?? '[]')
    if (!Array.isArray(parsed)) return { records: [], historyState: 'incomplete' }
    return { records: parsed.filter(valid), historyState: lastStorageFailure || health !== 'ready' ? 'incomplete' : 'available' }
  } catch { lastStorageFailure = true; return { records: [], historyState: 'unavailable' }
  }
}
export function readLocalSafetyStops(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): readonly LocalSafetyStopRecordV1[] { return readLocalSafetyStopLedger(storage).records }
// Keyed on the session, never on failureMode: failureMode is optional and a
// server-answered stop has none, so interpolating it would key two stops in one
// session to the same id. The random suffix is what actually guarantees
// uniqueness — two stops in the same session at the same instant must both
// survive, because losing the second would drop a real safety event.
function recordId(input: Pick<LocalSafetyStopRecordV1, 'occurredAt' | 'studentRef' | 'sessionRef'>): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Math.random()}-${performance.now()}`
  return `local-safety-stop:${input.occurredAt}:${input.studentRef}:${input.sessionRef ?? 'no-session'}:${random}`
}
function markIncomplete(storage: StorageLike | undefined): void {
  lastStorageFailure = true
  try { storage?.setItem(HEALTH_KEY, 'failed') } catch { /* total storage failure is unavailable on reload */ }
}
function availableLocks(): LedgerLockPort | undefined {
  return (globalThis.navigator as (Navigator & { locks?: LedgerLockPort }) | undefined)?.locks
}
export async function recordLocalPreAcceptanceSafetyStop(input: Omit<LocalSafetyStopRecordV1, 'schemaVersion' | 'recordId' | 'captureOrigin'>, storage: StorageLike | undefined = browserStorage(), locks: LedgerLockPort | undefined = availableLocks()): Promise<LocalSafetyStopRecordV1 | null> {
  return append(input, 'local-pre-acceptance-stop', storage, locks)
}

/**
 * A6-5-C — a stop recorded by the Study session itself, including stops the
 * safety service answered. Same ledger, same lock, so the Safety panel and the
 * durable lock see one unified history rather than two half-histories.
 */
export async function recordLocalSessionSafetyStop(input: Omit<LocalSafetyStopRecordV1, 'schemaVersion' | 'recordId' | 'captureOrigin' | 'failureMode'>, storage: StorageLike | undefined = browserStorage(), locks: LedgerLockPort | undefined = availableLocks()): Promise<LocalSafetyStopRecordV1 | null> {
  return append(input, 'local-session-stop', storage, locks)
}

/**
 * A6-5-C — the durable stop lock. True when ANY valid record in the unified
 * ledger belongs to this student and session: A6-4's outage records, the
 * server-answered records above, and any record a future build writes. It
 * deliberately does not filter on serverCaptureStatus, failureMode or
 * captureOrigin — a stop is a stop, whatever the capture outcome was, and
 * narrowing this would let a flagged learner back in by refreshing.
 */
export function isSessionStoppedByLocalLedger(session: { readonly studentRef: string; readonly sessionRef: string }, storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): boolean {
  return readLocalSafetyStops(storage).some((record) => record.sessionRef === session.sessionRef && record.studentRef === session.studentRef)
}

async function append(input: Omit<LocalSafetyStopRecordV1, 'schemaVersion' | 'recordId' | 'captureOrigin'>, captureOrigin: LocalSafetyStopCaptureOrigin, storage: StorageLike | undefined, locks: LedgerLockPort | undefined): Promise<LocalSafetyStopRecordV1 | null> {
  const record: LocalSafetyStopRecordV1 = Object.freeze({ schemaVersion: 2, recordId: recordId(input), ...input, captureOrigin })
  if (!storage) { markIncomplete(undefined); return null }
  const write = () => {
    // Fallback retry+verify is deliberately retained for browsers without Web
    // Locks. A failed verification marks history incomplete rather than hiding it.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = readLocalSafetyStops(storage)
      storage.setItem(LOCAL_SAFETY_STOP_LEDGER_KEY, JSON.stringify([...existing, record]))
      storage.setItem(HEALTH_KEY, 'ready')
      if (readLocalSafetyStops(storage).some((item) => item.recordId === record.recordId)) return record
    }
    markIncomplete(storage)
    return null
  }
  try {
    if (locks) return await locks.request('homeschool-hq:study-safety-stops', async () => write())
    return write()
  } catch { markIncomplete(storage) }
  return null
}

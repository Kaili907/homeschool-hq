export const LOCAL_SAFETY_STOP_LEDGER_KEY = 'manuel-academy.study.local-safety-stops.v1'
const HEALTH_KEY = `${LOCAL_SAFETY_STOP_LEDGER_KEY}:health`

export type PreAcceptanceSafetyFailureMode = 'classifier-unreachable' | 'request-timeout' | 'gateway-503' | 'authentication-failure' | 'malformed-server-response' | 'non-production-safety-port' | 'network-failure-mid-request'
export type ServerCaptureStatus = 'server-not-contacted' | 'server-acceptance-not-confirmed' | (string & {})
export interface LocalSafetyStopRecordV1 {
  readonly schemaVersion: 1 | 2
  readonly recordId: string
  readonly occurredAt: string
  readonly studentRef: string
  readonly sessionRef?: string
  readonly failureMode?: PreAcceptanceSafetyFailureMode | string
  readonly serverCaptureStatus: ServerCaptureStatus
  readonly captureOrigin: 'local-pre-acceptance-stop'
}
export type LocalSafetyStopHistoryState = 'available' | 'unavailable' | 'incomplete'
export interface LocalSafetyStopLedgerView { readonly records: readonly LocalSafetyStopRecordV1[]; readonly historyState: LocalSafetyStopHistoryState }
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
let lastStorageFailure = false
function browserStorage(): StorageLike | undefined { try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { lastStorageFailure = true; return undefined } }
function valid(record: unknown): record is LocalSafetyStopRecordV1 {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false
  const value = record as Record<string, unknown>
  return (value.schemaVersion === 1 || value.schemaVersion === 2) && typeof value.recordId === 'string' && typeof value.occurredAt === 'string' && typeof value.studentRef === 'string' && typeof value.serverCaptureStatus === 'string' && value.captureOrigin === 'local-pre-acceptance-stop'
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
function recordId(input: Pick<LocalSafetyStopRecordV1, 'occurredAt' | 'studentRef'>): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Math.random()}-${performance.now()}`
  return `local-safety-stop:${input.occurredAt}:${input.studentRef}:${random}`
}
export function recordLocalPreAcceptanceSafetyStop(input: Omit<LocalSafetyStopRecordV1, 'schemaVersion' | 'recordId' | 'captureOrigin'>, storage: StorageLike | undefined = browserStorage()): LocalSafetyStopRecordV1 | null {
  const record: LocalSafetyStopRecordV1 = Object.freeze({ schemaVersion: 2, recordId: recordId(input), ...input, captureOrigin: 'local-pre-acceptance-stop' })
  if (!storage) { lastStorageFailure = true; return null }
  try {
    // Re-read immediately before each write and verify afterward. This preserves
    // other-tab entries in the normal RMW race; a lost verification is surfaced.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const existing = readLocalSafetyStops(storage)
      storage.setItem(LOCAL_SAFETY_STOP_LEDGER_KEY, JSON.stringify([...existing, record]))
      storage.setItem(HEALTH_KEY, 'ready')
      if (readLocalSafetyStops(storage).some((item) => item.recordId === record.recordId)) return record
    }
    lastStorageFailure = true
  } catch { lastStorageFailure = true }
  return null
}

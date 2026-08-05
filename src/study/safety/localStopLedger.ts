export const LOCAL_SAFETY_STOP_LEDGER_KEY = 'manuel-academy.study.local-safety-stops.v1'

export type PreAcceptanceSafetyFailureMode = 'classifier-unreachable' | 'request-timeout' | 'gateway-503' | 'authentication-failure' | 'malformed-server-response' | 'non-production-safety-port' | 'network-failure-mid-request'

export interface LocalSafetyStopRecordV1 {
  readonly schemaVersion: 1
  readonly recordId: string
  readonly occurredAt: string
  readonly studentRef: string
  readonly failureMode: PreAcceptanceSafetyFailureMode
  readonly serverCaptureStatus: 'server-not-contacted' | 'server-acceptance-not-confirmed'
  readonly captureOrigin: 'local-pre-acceptance-stop'
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>
function browserStorage(): StorageLike | undefined { try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { return undefined } }
function valid(record: unknown): record is LocalSafetyStopRecordV1 {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false
  const value = record as Record<string, unknown>
  return value.schemaVersion === 1 && typeof value.recordId === 'string' && typeof value.occurredAt === 'string' && typeof value.studentRef === 'string' && typeof value.failureMode === 'string' && (value.serverCaptureStatus === 'server-not-contacted' || value.serverCaptureStatus === 'server-acceptance-not-confirmed') && value.captureOrigin === 'local-pre-acceptance-stop'
}
export function readLocalSafetyStops(storage: Pick<Storage, 'getItem'> | undefined = browserStorage()): readonly LocalSafetyStopRecordV1[] {
  if (!storage) return []
  try { const parsed: unknown = JSON.parse(storage.getItem(LOCAL_SAFETY_STOP_LEDGER_KEY) ?? '[]'); return Array.isArray(parsed) ? parsed.filter(valid) : [] } catch { return [] }
}
export function recordLocalPreAcceptanceSafetyStop(input: Omit<LocalSafetyStopRecordV1, 'schemaVersion' | 'recordId' | 'captureOrigin'>, storage: StorageLike | undefined = browserStorage()): LocalSafetyStopRecordV1 | null {
  if (!storage) return null
  const record: LocalSafetyStopRecordV1 = Object.freeze({ schemaVersion: 1, recordId: `local-safety-stop:${input.occurredAt}:${input.studentRef}:${input.failureMode}`, ...input, captureOrigin: 'local-pre-acceptance-stop' })
  try { const records = readLocalSafetyStops(storage); if (!records.some((item) => item.recordId === record.recordId)) storage.setItem(LOCAL_SAFETY_STOP_LEDGER_KEY, JSON.stringify([...records, record])); return record } catch { return null }
}

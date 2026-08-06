import { useEffect, useState } from 'react'
import { LOCAL_SAFETY_STOP_LEDGER_KEY, readLocalSafetyStopLedger, type LocalSafetyStopHistoryState, type LocalSafetyStopRecordV1 } from '../../study/safety/localStopLedger'

const FAILURE_LABEL: Record<string, string> = { 'classifier-unreachable': 'Classifier unreachable', 'request-timeout': 'Safety check timed out', 'gateway-503': 'Safety gateway unavailable', 'authentication-failure': 'Safety authentication failed', 'malformed-server-response': 'Safety gateway response was invalid', 'non-production-safety-port': 'Non-production safety port rejected', 'network-failure-mid-request': 'Network failed during safety check' }
const KNOWN_CAPTURE_ORIGINS = new Set(['local-pre-acceptance-stop', 'local-session-stop'])
// Per-row provenance in parent-readable language. A6-4's two answers keep their
// exact wording; A6-5-C adds the answered case. An unrecognised status still
// renders a row — it says the status is unknown rather than hiding the stop.
function provenance(status: string): string { return status === 'server-not-contacted' ? 'The safety service was never reached.' : status === 'server-acceptance-not-confirmed' ? 'Sent, but we could not confirm it was received.' : status === 'server-answered-stop' ? 'The safety service answered and stopped the lesson.' : 'The safety service capture status is unknown.' }
function summary(record: LocalSafetyStopRecordV1): string { return FAILURE_LABEL[record.failureMode ?? ''] ?? (record.captureOrigin === 'local-session-stop' ? 'Lesson stopped by a safety check' : 'Safety check stopped') }
function isRecognizedOrigin(record: LocalSafetyStopRecordV1): boolean { return KNOWN_CAPTURE_ORIGINS.has(record.captureOrigin) }

/** Storage events arrive only in the other same-origin tab that owns the open panel. */
export function refreshSafetyStopsForStorageEvent(event: Pick<StorageEvent, 'key'>, refresh: () => void): void {
  if (event.key === LOCAL_SAFETY_STOP_LEDGER_KEY || event.key === `${LOCAL_SAFETY_STOP_LEDGER_KEY}:health` || event.key === null) refresh()
}

export function StudyLocalSafetyStopsSurface({ records, historyState = 'available' }: { records: readonly LocalSafetyStopRecordV1[]; historyState?: LocalSafetyStopHistoryState }) {
  return <section className="rounded-xl border border-amber-300 bg-amber-50 p-5"><h2 className="text-xl font-bold text-slate-900">Safety events</h2><p className="mt-1 text-sm text-slate-700">Device-local, best-effort capture. It may be incomplete; a stopped lesson tells the student to get an adult.</p><p className="mt-1 text-sm text-slate-700">Device-local records are not tamper-proof. This accidental-refresh and ordinary-navigation guard is not a security boundary: it can be cleared through browser settings or DevTools, and it does not follow a learner to another browser, incognito window, or device.</p>{historyState === 'unavailable' ? <p role="alert" className="mt-3 text-sm font-semibold text-red-900">This device could not record safety events.</p> : historyState === 'incomplete' ? <p role="alert" className="mt-3 text-sm font-semibold text-amber-900">Safety-event history may be incomplete on this device.</p> : records.length === 0 ? <p className="mt-3 text-sm text-slate-600">No safety stops have been recorded on this device.</p> : <ul className="mt-3 space-y-3">{records.map((record) => <li key={record.recordId} className="rounded-lg border border-amber-200 bg-white p-3"><p className="font-semibold">{summary(record)}</p><p className="text-sm">Student: {record.studentRef}</p><time className="text-sm text-slate-600" dateTime={record.occurredAt}>{record.occurredAt}</time><p className="text-sm text-slate-600">{provenance(record.serverCaptureStatus)}</p>{!isRecognizedOrigin(record) && <p className="text-sm font-semibold text-amber-900">This record could not be verified as written by this app.</p>}</li>)}</ul>}</section>
}
export function StudyLocalSafetyStopsPanel() {
  const [view, setView] = useState(() => readLocalSafetyStopLedger())
  useEffect(() => { setView(readLocalSafetyStopLedger()) }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (event: StorageEvent) => refreshSafetyStopsForStorageEvent(event, () => setView(readLocalSafetyStopLedger()))
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return <StudyLocalSafetyStopsSurface {...view} />
}

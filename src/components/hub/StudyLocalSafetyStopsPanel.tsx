import { useEffect, useState } from 'react'
import { readLocalSafetyStopLedger, type LocalSafetyStopHistoryState, type LocalSafetyStopRecordV1 } from '../../study/safety/localStopLedger'

const FAILURE_LABEL: Record<string, string> = { 'classifier-unreachable': 'Classifier unreachable', 'request-timeout': 'Safety check timed out', 'gateway-503': 'Safety gateway unavailable', 'authentication-failure': 'Safety authentication failed', 'malformed-server-response': 'Safety gateway response was invalid', 'non-production-safety-port': 'Non-production safety port rejected', 'network-failure-mid-request': 'Network failed during safety check' }
function provenance(status: string): string { return status === 'server-not-contacted' ? 'The safety service was never reached.' : status === 'server-acceptance-not-confirmed' ? 'Sent, but we could not confirm it was received.' : 'The safety service capture status is unknown.' }
export function StudyLocalSafetyStopsSurface({ records, historyState = 'available' }: { records: readonly LocalSafetyStopRecordV1[]; historyState?: LocalSafetyStopHistoryState }) {
  return <section className="rounded-xl border border-amber-300 bg-amber-50 p-5"><h2 className="text-xl font-bold text-slate-900">Safety events</h2><p className="mt-1 text-sm text-slate-700">Device-local safety stops are listed with their capture status.</p>{historyState === 'unavailable' ? <p role="alert" className="mt-3 text-sm font-semibold text-red-900">This device could not record safety events.</p> : historyState === 'incomplete' ? <p role="alert" className="mt-3 text-sm font-semibold text-amber-900">Safety-event history may be incomplete on this device.</p> : records.length === 0 ? <p className="mt-3 text-sm text-slate-600">No safety stops have been recorded on this device.</p> : <ul className="mt-3 space-y-3">{records.map((record) => <li key={record.recordId} className="rounded-lg border border-amber-200 bg-white p-3"><p className="font-semibold">{FAILURE_LABEL[record.failureMode ?? ''] ?? 'Safety check stopped'}</p><p className="text-sm">Student: {record.studentRef}</p><time className="text-sm text-slate-600" dateTime={record.occurredAt}>{record.occurredAt}</time><p className="text-sm text-slate-600">{provenance(record.serverCaptureStatus)}</p></li>)}</ul>}</section>
}
export function StudyLocalSafetyStopsPanel() {
  const [view, setView] = useState(() => readLocalSafetyStopLedger())
  useEffect(() => { setView(readLocalSafetyStopLedger()) }, [])
  return <StudyLocalSafetyStopsSurface {...view} />
}

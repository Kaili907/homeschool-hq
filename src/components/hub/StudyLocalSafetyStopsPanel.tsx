import { useEffect, useState } from 'react'
import { readLocalSafetyStops, type LocalSafetyStopRecordV1 } from '../../study/safety/localStopLedger'

const FAILURE_LABEL: Record<LocalSafetyStopRecordV1['failureMode'], string> = {
  'classifier-unreachable': 'Classifier unreachable', 'request-timeout': 'Safety check timed out', 'gateway-503': 'Safety gateway unavailable', 'authentication-failure': 'Safety authentication failed', 'malformed-server-response': 'Safety gateway response was invalid', 'non-production-safety-port': 'Non-production safety port rejected', 'network-failure-mid-request': 'Network failed during safety check',
}
export function StudyLocalSafetyStopsSurface({ records }: { records: readonly LocalSafetyStopRecordV1[] }) {
  return <section className="rounded-xl border border-amber-300 bg-amber-50 p-5"><h2 className="text-xl font-bold text-slate-900">Safety events</h2><p className="mt-1 text-sm text-slate-700">Device-local outage stops. These were not server-captured events.</p>{records.length === 0 ? <p className="mt-3 text-sm text-slate-600">No locally captured outage stops on this device.</p> : <ul className="mt-3 space-y-3">{records.map((record) => <li key={record.recordId} className="rounded-lg border border-amber-200 bg-white p-3"><p className="font-semibold">{FAILURE_LABEL[record.failureMode]}</p><p className="text-sm">Student: {record.studentRef}</p><time className="text-sm text-slate-600" dateTime={record.occurredAt}>{record.occurredAt}</time><p className="text-sm text-slate-600">Local capture only · {record.serverCaptureStatus}</p></li>)}</ul>}</section>
}
export function StudyLocalSafetyStopsPanel() {
  const [records, setRecords] = useState<readonly LocalSafetyStopRecordV1[]>([])
  useEffect(() => { setRecords(readLocalSafetyStops()) }, [])
  return <StudyLocalSafetyStopsSurface records={records} />
}

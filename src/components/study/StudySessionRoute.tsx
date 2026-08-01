import { useEffect, useState } from 'react'
import type { StudyPortBundle } from '../../study/ports'
import type { HostStudyLaunchContext, StudyCalendarEntry } from '../../study/types'
import { StudySessionContainer } from './StudySessionContainer'
import './study-host.css'

export function StudySessionRoute({ context, ports, blockRef, learnerRef, onBack }: {
  context: HostStudyLaunchContext
  ports: StudyPortBundle
  blockRef: string
  learnerRef: string
  onBack: () => void
}) {
  const [entry, setEntry] = useState<StudyCalendarEntry | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let current = true
    if (learnerRef !== context.learnerRef) {
      setError('The selected learner changed. This Study Session was not opened.')
      return () => { current = false }
    }
    ports.calendar.list({ householdRef: context.householdRef, learnerRef })
      .then((entries) => entries.find((candidate) => candidate.blockRef === blockRef))
      .then((candidate) => {
        if (!current) return
        if (!candidate || candidate.learnerRef !== context.learnerRef) setError('The learner-scoped Study block was not found.')
        else setEntry(candidate)
      })
      .catch(() => current && setError('The learner-scoped Study block could not be loaded safely.'))
    return () => { current = false }
  }, [blockRef, context.householdRef, context.learnerRef, learnerRef, ports])

  if (error) return <main className="study-runtime-host min-h-screen bg-slate-50 p-6"><h1 className="text-2xl font-bold" tabIndex={-1}>Study Session unavailable</h1><p className="mt-2" role="alert">{error}</p><button className="mt-4 rounded-lg border bg-white px-4 py-2" onClick={onBack}>Back to Study plan</button></main>
  if (!entry) return <main className="study-runtime-host min-h-screen bg-slate-50 p-6" aria-busy="true"><h1 className="text-2xl font-bold">Loading Study Session</h1><p role="status">Rechecking the selected learner and calendar block…</p><button className="mt-4 rounded-lg border bg-white px-4 py-2" onClick={onBack}>Cancel</button></main>
  return <StudySessionContainer context={context} initialEntry={entry} ports={ports} onBack={onBack} />
}

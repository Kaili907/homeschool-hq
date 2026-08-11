import { useEffect, useRef, useState } from 'react'
import {
  attachHostStudySurface,
  type HostStudyLifecycleSeam,
} from '../../study/composition/hostStudyLifecycle'
import type { StudyPortBundle } from '../../study/ports'
import { runCurrentStudyWork } from '../../study/production/lifecycleBoundary'
import type { HostStudyLaunchContext, StudyCalendarEntry } from '../../study/types'
import { StudySessionContainer } from './StudySessionContainer'
import './study-host.css'

export function StudySessionRoute({ context, ports, studyLifecycle, blockRef, learnerRef, onBack }: {
  context: HostStudyLaunchContext
  ports: StudyPortBundle
  /**
   * STUDY-A1-COMP Phase 8 — the App's own Study lifecycle, required rather than
   * invented here. This route used to build an unbound StudyLifecycleBoundary,
   * whose tokens are stale from birth, so the guarded calendar lookup below
   * aborted before it started and the live route was unreachable. The same seam
   * is handed to the container, so both surfaces share one epoch.
   */
  studyLifecycle: HostStudyLifecycleSeam
  blockRef: string
  learnerRef: string
  onBack: () => void
}) {
  const [entry, setEntry] = useState<StudyCalendarEntry | null>(null)
  const [error, setError] = useState('')
  const headingRef = useRef<HTMLHeadingElement>(null)
  const lifecycle = studyLifecycle.boundary
  /**
   * STUDY-A1-STRICTMODE-PREVIEW — the real exit, and the ONLY place this surface
   * retires the App's epoch. A learner leaving Study is an authority decision and
   * belongs to a user-initiated handler, not to an effect cleanup that React also
   * runs as a development probe. The container's `onBack` is this same function,
   * so "Save and exit" from inside the session lands here too.
   */
  const leaveStudy = () => {
    lifecycle.cancel('navigation-away')
    onBack()
  }

  useEffect(() => {
    // Attach to the epoch the App owns. This never begins one and — unlike the
    // cleanup below used to — never cancels one, so React's StrictMode
    // setup → cleanup → setup probe leaves the epoch exactly as it found it.
    const surface = attachHostStudySurface(studyLifecycle)
    if (learnerRef !== context.learnerRef) {
      setError('The selected learner changed. This Study Session was not opened.')
      // Still the epoch, and deliberately: a learner mismatch is a real
      // authorization failure, not a lifecycle probe, and it must fail closed
      // however many times React replays it.
      lifecycle.cancel('learner-switch')
      return
    }
    runCurrentStudyWork(
      surface.token,
      () => ports.calendar.list({ householdRef: context.householdRef, learnerRef }),
      { signals: [surface.signal] },
    )
      .then((entries) => entries.find((candidate) => candidate.blockRef === blockRef))
      .then((candidate) => {
        if (!surface.isAttached()) return
        if (!candidate || candidate.learnerRef !== context.learnerRef) {
          setError('The learner-scoped Study block was not found.')
        } else {
          setEntry(candidate)
        }
      })
      .catch(() => {
        if (surface.isAttached()) setError('The learner-scoped Study block could not be loaded safely.')
      })
    return () => { surface.detach() }
  }, [blockRef, context.householdRef, context.learnerRef, learnerRef, lifecycle, ports, studyLifecycle])

  useEffect(() => { headingRef.current?.focus() }, [error])

  if (error) return <main className="study-runtime-host min-h-screen bg-slate-50 p-6"><h1 ref={headingRef} className="text-2xl font-bold" tabIndex={-1}>Study Session unavailable</h1><p className="mt-2" role="alert">{error}</p><button type="button" className="mt-4 rounded-lg border bg-white px-4 py-2" onClick={leaveStudy}>Back to Study plan</button></main>
  if (!entry) return <main className="study-runtime-host min-h-screen bg-slate-50 p-6" aria-busy="true"><h1 ref={headingRef} className="text-2xl font-bold" tabIndex={-1}>Loading Study Session</h1><p role="status">Rechecking the selected learner and calendar block…</p><button type="button" className="mt-4 rounded-lg border bg-white px-4 py-2" onClick={leaveStudy}>Cancel</button></main>
  return <StudySessionContainer context={context} initialEntry={entry} ports={ports} studyLifecycle={studyLifecycle} onBack={leaveStudy} />
}

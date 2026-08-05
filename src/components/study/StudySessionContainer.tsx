import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { JarvisCore } from '../../../adaptive-tutor/study-engine/ui/JarvisCore.tsx'
import { assertCompleteStudyPortBundle, type StudyPortBundle } from '../../study/ports'
import { AcceptedRc1HostRuntime } from '../../study/runtimeFacade'
import { runCurrentStudyWork, StudyLifecycleBoundary } from '../../study/production/lifecycleBoundary'
import { STUDY_LEARNER_STOP_MESSAGE } from '../../study/safety/learnerSafe'
import { isStudySessionStopped, recordSafetyStop } from '../../study/safety/stopLedger'
import type { HostStudyLaunchContext, StudyAccessibilitySettings, StudyCalendarEntry, StudyCheckpoint } from '../../study/types'
import './study-host.css'

export const STUDY_TUTOR_OUTPUT_PENDING_MESSAGE = 'I’m checking the Tutor reply before showing it.'

export function studyAccessibilityProjection(settings: StudyAccessibilitySettings) {
  return Object.freeze({
    motionMode: settings.reducedMotion ? 'none' as const : 'minimal' as const,
    voiceMode: settings.noAudio ? 'no-audio' as const : 'unavailable' as const,
    captionsAlwaysVisible: true as const,
  })
}

export function StudyTutorSafetySurface({
  busy,
  checkingTutorSafety,
  stopped,
  visibleText,
  accessibility,
  transcript,
  transcriptOpen,
  onTranscriptOpenChange,
}: {
  busy: boolean
  checkingTutorSafety: boolean
  stopped: boolean
  visibleText: string
  accessibility: ReturnType<typeof studyAccessibilityProjection>
  transcript?: ReactNode
  transcriptOpen: boolean
  onTranscriptOpenChange?: (open: boolean) => void
}) {
  return (
    <JarvisCore
      activity={busy ? 'thinking' : stopped ? 'paused' : 'idle'}
      statusText={stopped ? 'Study paused safely' : checkingTutorSafety ? 'Checking safely' : busy ? 'Saving safely' : 'Ready'}
      currentUtterance={checkingTutorSafety ? STUDY_TUTOR_OUTPUT_PENDING_MESSAGE : visibleText}
      captionLabel="Jarvis captions (always visible)"
      motionMode={accessibility.motionMode}
      voiceMode={accessibility.voiceMode}
      transcript={transcript}
      transcriptOpen={transcriptOpen}
      onTranscriptOpenChange={onTranscriptOpenChange}
    />
  )
}

export function StudySessionContainer({ context: baseContext, initialEntry, ports, onBack }: {
  context: HostStudyLaunchContext
  initialEntry: StudyCalendarEntry
  ports: Partial<StudyPortBundle>
  onBack: () => void
}) {
  const context: HostStudyLaunchContext = {
    ...baseContext,
    subject: initialEntry.subject,
    lessonRef: initialEntry.lessonRef,
    skillRefs: initialEntry.skillRefs,
  }
  // Derived from the block, so the same block yields the same session key on
  // every mount. The durable stop lock is keyed on it.
  const sessionRef = `${initialEntry.blockRef}:session`
  const scope = { householdRef: context.householdRef, learnerRef: context.learnerRef, sessionRef }
  const [entry, setEntry] = useState(initialEntry)
  const [answer, setAnswer] = useState('')
  const [jarvisText, setJarvisText] = useState('I’m ready when you are. Complete the current Manuel Academy activity, then confirm below.')
  const [approvedTranscript, setApprovedTranscript] = useState<readonly string[]>([])
  const [transcriptOpen, setTranscriptOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [checkingTutorSafety, setCheckingTutorSafety] = useState(false)
  // A6-5-C: a stop is durable. A remount — refresh, navigation away and back,
  // or a new tab — starts stopped again, so a flagged learner cannot continue
  // by reloading the page.
  const [stopped, setStopped] = useState(() => isStudySessionStopped(scope))
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bindingRef = useRef(`${context.householdRef}|${context.learnerRef}|${initialEntry.blockRef}`)
  const lifecycle = useMemo(() => new StudyLifecycleBoundary(), [])
  const runtime = useMemo(() => new AcceptedRc1HostRuntime(ports), [ports])
  const learnerScope = { householdRef: context.householdRef, learnerRef: context.learnerRef }
  const currentSegment = entry.segments.find((segment) => !entry.completedSegmentRefs.includes(segment.segmentRef))
  const accessibilityProjection = studyAccessibilityProjection(context.accessibility)
  const isCurrentBinding = () => bindingRef.current === `${context.householdRef}|${context.learnerRef}|${initialEntry.blockRef}`

  useEffect(() => {
    const token = lifecycle.token()
    const prepare = async () => {
      try {
        token.assertCurrent()
        // A stopped session is never relaunched, so no lesson work, no Tutor
        // turn and no calendar transition can happen behind the locked surface.
        if (isStudySessionStopped(scope)) return
        assertCompleteStudyPortBundle(ports)
        runtime.launch(context, initialEntry, sessionRef)
        let next = initialEntry
        const now = new Date().toISOString()
        if (next.state === 'scheduled') next = await runCurrentStudyWork(token, () => ports.calendar.start(learnerScope, next.blockRef, now))
        if (next.state === 'paused') next = await runCurrentStudyWork(token, () => ports.calendar.resume(learnerScope, next.blockRef, now))
        const segment = next.segments.find((candidate) => !next.completedSegmentRefs.includes(candidate.segmentRef))
        if (!segment) throw new Error('This Study block is already complete.')
        await runCurrentStudyWork(token, () => ports.eventLedger.append(scope, {
          eventRef: `launch:${sessionRef}`,
          occurredAt: now,
          type: 'session-launched',
          payload: { lessonRef: next.lessonRef, segmentRef: segment.segmentRef },
        }))
        await runCurrentStudyWork(token, () => ports.persistence.saveSession({
          scope,
          lessonRef: next.lessonRef,
          segmentRef: segment.segmentRef,
          status: 'active',
          updatedAt: now,
          lastAcceptedEventRef: null,
          rawAnswerIncluded: false,
          transcriptIncluded: false,
        }))
        token.assertCurrent()
        setEntry(next)
      } catch {
        if (token.isCurrent()) setError('This Study Session could not start safely. Check the learner, runtime version, and required ports.')
      } finally {
        if (token.isCurrent()) setLoading(false)
      }
    }
    prepare()
    return () => {
      lifecycle.cancel('navigation-away')
      bindingRef.current = 'closed'
    }
  }, [context.learnerRef, initialEntry.blockRef, lifecycle, ports, runtime])

  useEffect(() => { headingRef.current?.focus() }, [loading, error, entry.state, currentSegment?.segmentRef])

  const saveBreak = async () => {
    if (!currentSegment || stopped) return
    const token = lifecycle.token()
    setBusy(true)
    setAnswer('')
    try {
      const at = new Date().toISOString()
      const paused = await runCurrentStudyWork(token, () => (ports as StudyPortBundle).calendar.pause(learnerScope, entry.blockRef, at, 'planned_break'))
      const previous = await runCurrentStudyWork(token, () => (ports as StudyPortBundle).checkpoint.loadLatest(scope))
      const checkpoint: StudyCheckpoint = {
        checkpointRef: `${sessionRef}:checkpoint`,
        householdRef: context.householdRef,
        learnerRef: context.learnerRef,
        sessionRef,
        lessonRef: entry.lessonRef,
        segmentRef: paused.resumePoint?.segmentRef ?? currentSegment.segmentRef,
        revision: (previous?.revision ?? 0) + 1,
        capturedAt: at,
        completedSegmentRefs: paused.resumePoint?.completedSegmentRefs ?? paused.completedSegmentRefs,
        elapsedActiveSecondsInSegment: paused.resumePoint?.elapsedActiveSecondsInSegment ?? 0,
        responseDraftRef: null,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      }
      await runCurrentStudyWork(token, () => (ports as StudyPortBundle).checkpoint.save(checkpoint))
      await runCurrentStudyWork(token, () => (ports as StudyPortBundle).persistence.saveSession({
        scope,
        lessonRef: entry.lessonRef,
        segmentRef: checkpoint.segmentRef,
        status: 'paused',
        updatedAt: at,
        lastAcceptedEventRef: null,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      }))
      token.assertCurrent()
      setEntry(paused)
      setJarvisText(`Water break saved. You’ll return to step ${checkpoint.segmentRef}.`)
    } catch {
      if (token.isCurrent()) setError('The break could not be saved safely. Your answer was not persisted.')
    } finally { if (token.isCurrent()) setBusy(false) }
  }

  const resume = async () => {
    const token = lifecycle.token()
    setBusy(true)
    try {
      const resumed = await runCurrentStudyWork(token, () => (ports as StudyPortBundle).calendar.resume(learnerScope, entry.blockRef, new Date().toISOString()))
      setEntry(resumed)
      setJarvisText('Welcome back. Your exact Study step is ready.')
    } catch {
      if (token.isCurrent()) setError('The exact resume point could not be restored safely.')
    } finally { if (token.isCurrent()) setBusy(false) }
  }

  const completeStep = async () => {
    if (!currentSegment || !answer.trim() || busy || stopped) return
    const token = lifecycle.token()
    setBusy(true)
    setCheckingTutorSafety(entry.masteryAuthority === 'tutor-core')
    const transient = answer
    setAnswer('')
    try {
      const at = new Date().toISOString()
      let acceptedEventRef: string | null = null
      if (entry.masteryAuthority === 'tutor-core') {
        const result = await runCurrentStudyWork(token, () => runtime.submit({
          context,
          entry,
          scope,
          requestRef: `request:${sessionRef}:${currentSegment.segmentRef}:${Date.now()}`,
          segmentRef: currentSegment.segmentRef,
          transientLearnerText: transient,
          expectedAnswer: 'ready',
          occurredAt: at,
          isCurrentBinding: () => token.isCurrent() && isCurrentBinding(),
        }))
        if (result.status === 'stopped') {
          // Durable first, before anything that can fail. The lock and the
          // adult-visible record must survive a refresh and must exist even
          // when no server proposal was ever created for this stop.
          recordSafetyStop({
            scope,
            occurredAt: at,
            classification: result.classification,
            deliveryStatus: result.deliveryStatus,
          })
          setStopped(true)
          setCheckingTutorSafety(false)
          setJarvisText(result.studentMessage)
          setBusy(false)
          try {
            await runCurrentStudyWork(token, () => (ports as StudyPortBundle).eventLedger.append(scope, {
              eventRef: `stop:${sessionRef}:${Date.now()}`,
              occurredAt: at,
              type: 'safety-stop',
              payload: { reasonCode: result.reasonCode, deliveryStatus: result.deliveryStatus },
            }))
          } catch {
            // The stop is already recorded durably; a failed event append must
            // not undo it or surface as a recoverable error to the student.
          }
          lifecycle.cancel('safety-stop')
          return
        }
        if (result.status === 'quarantined') throw new Error('quarantined')
        acceptedEventRef = result.eventRef
        setCheckingTutorSafety(false)
        setJarvisText(result.presentation.visibleText)
        setApprovedTranscript((items) => [...items, result.presentation.visibleText])
      } else {
        setJarvisText('Activity completion recorded. No mastery decision was made.')
      }
      const next = await runCurrentStudyWork(token, () => (ports as StudyPortBundle).calendar.completeCurrentSegment(
        learnerScope,
        entry.blockRef,
        currentSegment.segmentRef,
        new Date().toISOString(),
      ))
      const status = next.state === 'completed' ? 'completed' : 'active'
      if (status === 'completed') {
        await runCurrentStudyWork(token, () => (ports as StudyPortBundle).eventLedger.append(scope, {
          eventRef: `completion:${sessionRef}:${entry.lessonRef}`,
          occurredAt: new Date().toISOString(),
          type: 'session-completed',
          payload: { blockRef: entry.blockRef, lessonRef: entry.lessonRef },
        }))
      }
      await runCurrentStudyWork(token, () => (ports as StudyPortBundle).persistence.saveSession({
        scope,
        lessonRef: entry.lessonRef,
        segmentRef: currentSegment.segmentRef,
        status,
        updatedAt: new Date().toISOString(),
        lastAcceptedEventRef: acceptedEventRef,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      }))
      token.assertCurrent()
      setEntry(next)
    } catch {
      if (token.isCurrent()) setError('The Tutor result could not be accepted. No completion was recorded.')
    } finally {
      if (token.isCurrent()) {
        setCheckingTutorSafety(false)
        setBusy(false)
      }
    }
  }

  // A6-5-C: the locked surface. It carries no response field and no submit or
  // break control, so a stopped session cannot accept input on this mount or
  // any later one. Nothing here clears the lock.
  if (stopped) return (
    <div className="study-runtime-host min-h-screen bg-slate-50 text-slate-900" data-large-text={context.accessibility.largeText} data-high-contrast={context.accessibility.highContrast} data-reduced-motion={context.accessibility.reducedMotion} data-study-stopped="true">
      <main className="mx-auto max-w-3xl px-4 py-5">
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Study paused</h1>
        <StudyTutorSafetySurface
          busy={false}
          checkingTutorSafety={false}
          stopped
          visibleText={STUDY_LEARNER_STOP_MESSAGE}
          accessibility={accessibilityProjection}
          transcriptOpen={false}
        />
        <button type="button" className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={onBack}>Back to Study plan</button>
      </main>
    </div>
  )
  if (loading) return <main className="study-runtime-host min-h-screen bg-slate-50 p-6" aria-busy="true"><h1 ref={headingRef} tabIndex={-1}>Preparing your Study Session</h1><p role="status">Checking the runtime and learner binding…</p><button type="button" className="mt-4 rounded-lg border px-4 py-2" onClick={onBack}>Cancel</button></main>
  if (error) return <main className="study-runtime-host min-h-screen bg-slate-50 p-6"><h1 ref={headingRef} tabIndex={-1}>Study Session unavailable</h1><p role="alert">{error}</p><button type="button" className="mt-4 rounded-lg border px-4 py-2" onClick={onBack}>Back to Study plan</button></main>

  return (
    <div className="study-runtime-host min-h-screen bg-slate-50 text-slate-900" data-large-text={context.accessibility.largeText} data-high-contrast={context.accessibility.highContrast} data-reduced-motion={context.accessibility.reducedMotion}>
      <a href="#current-study-task" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:bg-white focus:p-3">Skip to current activity</a>
      <main className="mx-auto max-w-5xl px-4 py-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-cyan-700">{entry.subject}</p><h1 className="text-2xl font-bold">{entry.title}</h1></div>
          <button type="button" className="rounded-lg border border-slate-300 bg-white px-4 py-2" onClick={onBack}>Save and exit</button>
        </header>
        <nav className="mt-5 rounded-xl bg-white p-4" aria-label="Study segment progress">
          <ol className="flex flex-wrap gap-2">{entry.segments.map((segment) => {
            const complete = entry.completedSegmentRefs.includes(segment.segmentRef)
            const current = currentSegment?.segmentRef === segment.segmentRef
            return <li key={segment.segmentRef} aria-current={current ? 'step' : undefined} className={`rounded-full px-3 py-2 text-sm font-semibold ${current ? 'bg-cyan-700 text-white' : complete ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100'}`}>{segment.title}: {complete ? 'completed' : current ? 'current' : 'not started'}</li>
          })}</ol>
        </nav>
        {context.timerPreference.visibility === 'hidden' ? <p className="mt-3 font-semibold" role="status">Timer hidden. Milestones will still be shown.</p> : <p className="mt-3 text-sm text-slate-600">Work-block limit: {context.parentLimits.maximumWorkMinutes} minutes · break: {context.parentLimits.breakMinutes} minutes</p>}

        {entry.state === 'paused' ? (
          <section className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
            <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Water break</h2>
            <p className="mt-2">Your exact place is saved at {entry.resumePoint?.segmentRef}. Take the time you need.</p>
            <button type="button" className="mt-4 rounded-lg bg-cyan-700 px-5 py-3 font-bold text-white" disabled={busy || stopped} onClick={resume}>Return to exact step</button>
          </section>
        ) : entry.state === 'completed' ? (
          <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-6"><h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Study block complete</h2><p>No host mastery decision was invented. Tutor Core remains the instructional authority.</p><button type="button" className="mt-4 rounded-lg border bg-white px-4 py-2" onClick={onBack}>Back to plan</button></section>
        ) : currentSegment ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_20rem]">
            <section id="current-study-task" className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">{currentSegment.title}</h2>
              <p className="mt-3">Complete this step in the existing Manuel Academy lesson. When you finish, type <strong>ready</strong>. The host will not treat this confirmation as mastery.</p>
              <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"><p className="font-semibold">Media fallback</p><p className="text-sm">No lesson media is required here. Continue with the existing text activity.</p></div>
              <label className="mt-5 block font-bold" htmlFor="study-response">Current response</label>
              <textarea id="study-response" className="mt-2 min-h-28 w-full rounded-lg border border-slate-400 p-3 text-base" value={answer} disabled={busy || stopped} onChange={(event) => setAnswer(event.target.value)} aria-describedby="study-response-help" />
              <p id="study-response-help" className="mt-1 text-sm text-slate-600">This response is transient. It is sent through the safety/Tutor bridge and is not stored in Study evidence.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button type="button" className="rounded-lg bg-cyan-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={!answer.trim() || busy || stopped} onClick={completeStep}>Send through Tutor boundary</button>
                <button type="button" className="rounded-lg border border-cyan-700 bg-white px-5 py-3 font-bold text-cyan-800 disabled:opacity-50" disabled={busy || stopped} onClick={saveBreak}>Take a water break</button>
              </div>
            </section>
            <StudyTutorSafetySurface
              busy={busy}
              checkingTutorSafety={checkingTutorSafety}
              stopped={stopped}
              visibleText={jarvisText}
              accessibility={accessibilityProjection}
              transcript={context.accessibility.transientTranscript ? <ol>{approvedTranscript.map((line, index) => <li key={`${index}-${line}`}>{line}</li>)}</ol> : undefined}
              transcriptOpen={transcriptOpen}
              onTranscriptOpenChange={context.accessibility.transientTranscript ? setTranscriptOpen : undefined}
            />
          </div>
        ) : null}
      </main>
    </div>
  )
}

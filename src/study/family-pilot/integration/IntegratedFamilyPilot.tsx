import { useCallback, useEffect, useMemo, useState } from 'react'
import { FamilyPilotStudentLogin } from '../auth'
import { StudentExperience } from '../student'
import type { FamilyPilotStudySnapshot } from '../study'
import type { FamilyPilotHelpSession } from '../tutor'
import type { FamilyPilotShellContext } from '../FamilyPilotShell'
import type { FamilyPilotController } from './controller'
import { fromStudentSelector, toStudentSelector } from './identity'

// FAMILY-PILOT-INTEGRATION: the composed pilot surface.
//
// This component owns no domain rules. It renders the Student Login, Student
// Experience and Study surfaces the parallel sessions built, and routes every
// action through the controller so that Core and the Study runtime stay the
// only authorities.
//
// The one rule it does enforce is scoping: all Study-derived view state is
// keyed to the active student and cleared the moment that student changes, so
// no snapshot, help session or message can outlive the learner it belonged to.

export interface IntegratedFamilyPilotProps {
  readonly context: FamilyPilotShellContext
  readonly controller: FamilyPilotController
}

export function IntegratedFamilyPilot({ context, controller }: IntegratedFamilyPilotProps) {
  const activeStudentRef = context.activeStudentRef
  const [study, setStudy] = useState<FamilyPilotStudySnapshot | null>(null)
  const [openAssignmentRef, setOpenAssignmentRef] = useState<string | null>(null)
  const [help, setHelp] = useState<{ readonly session: FamilyPilotHelpSession; readonly text: string } | null>(null)
  const [helpMessage, setHelpMessage] = useState('')
  const [helpBusy, setHelpBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  // Bumped whenever a start/resume is refused (clearOnReject below), and used
  // as StudentExperience's key. StudentExperience owns its own "which
  // assignment is open" state and flips to it optimistically on click,
  // independent of whether the call this component makes actually succeeds —
  // remounting it is what undoes that optimism, so a safety refusal can't
  // leave its Pause/Finish shell looking like a normal, still-open assignment.
  const [shellEpoch, setShellEpoch] = useState(0)

  // NOTE: there is deliberately no "clear on student change" effect here.
  // IntegratedPilotSurface keys this component on the active learner, so a
  // switch unmounts it and every field above starts fresh. An effect would run
  // one frame too late, after B's name had already been painted over A's Study
  // position.

  // Seeding is idempotent, so running it whenever a learner becomes active is
  // safe and means a learner added mid-session still gets their work.
  useEffect(() => {
    if (!activeStudentRef) return
    controller.ensureAssignments(activeStudentRef)
    context.reload()
    // context.reload is stable per store; re-running on every render would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStudentRef, controller])

  const profiles = useMemo(
    () => controller.studentProfiles(),
    // Recomputed whenever the shell's snapshot changes, which is the only way
    // the roster can change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.snapshot],
  )

  const assignments = useMemo(
    () => (activeStudentRef ? controller.assignmentsFor(activeStudentRef) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeStudentRef, context.snapshot],
  )

  const run = useCallback(
    async (
      action: () => Promise<{ status: string; message?: string; study?: FamilyPilotStudySnapshot | null }>,
      // clearOnReject: for start/resume only. Those set openAssignmentRef
      // optimistically before the async call settles, so a rejection — most
      // notably a safety hold — must not leave the study section rendering a
      // stale or mismatched "open" shell that looks usable but isn't.
      options?: { readonly clearOnReject?: boolean },
    ) => {
      setBusy(true)
      try {
        const result = await action()
        if (result.status === 'ok') {
          setStudy(result.study ?? null)
          setMessage('')
        } else {
          setMessage(result.message ?? 'That step could not be completed.')
          if (options?.clearOnReject) {
            setOpenAssignmentRef(null)
            setStudy(null)
            setHelp(null)
            setShellEpoch((epoch) => epoch + 1)
          }
        }
      } finally {
        setBusy(false)
        context.reload()
      }
    },
    [context],
  )

  if (!activeStudentRef) {
    return (
      <section className="mt-6" aria-labelledby="family-pilot-entry" data-testid="family-pilot-entry">
        <h2 id="family-pilot-entry" className="font-extrabold">Who is learning?</h2>
        <FamilyPilotStudentLogin
          students={profiles}
          activeStudentRef={null}
          onSelectStudent={() => undefined}
          onAuthenticated={(selector) => {
            controller.selectStudent(fromStudentSelector(selector))
            context.reload()
          }}
          onLogout={() => undefined}
          onSwitchStudent={() => undefined}
        />
      </section>
    )
  }

  const open = assignments.find((item) => item.assignmentRef === openAssignmentRef) ?? null
  // Defense in depth: disables Pause / Save my place / Finish this step /
  // Finish while a Study action or a Tutor turn (helpBusy covers the exact
  // window controller.helpTurn's pending-classification guard also covers)
  // is in flight. The controller is the authority regardless — this only
  // keeps the UI from offering a click it would refuse anyway.
  const studyMutationsDisabled = busy || helpBusy

  /**
   * Advances the open help session by one learner message. A flagged turn
   * (Tutor bridge's own isConcerning() check, via controller.helpTurn) has
   * already recorded a Family Pilot safety hold by the time this returns, so
   * re-running the SAME entry gate resume() uses is what surfaces the exact
   * "get an adult" refusal and clears the study shell — no new hold logic or
   * classifier is added here.
   */
  const sendHelpMessage = async (): Promise<void> => {
    if (!help || !open) return
    setHelpBusy(true)
    try {
      const step = await controller.helpTurn(help.session, helpMessage)
      setHelpMessage('')
      if (step.session.flaggedForAdult) {
        setHelp(null)
        await run(() => controller.resume(activeStudentRef, open.assignmentRef), { clearOnReject: true })
      } else {
        setHelp({ session: step.session, text: step.presentation.visibleText })
      }
    } finally {
      setHelpBusy(false)
    }
  }

  return (
    <section className="mt-6" data-testid="family-pilot-student-work" data-student-ref={activeStudentRef}>
      <StudentExperience
        key={shellEpoch}
        student={{ displayName: controller.parentProgress(activeStudentRef)?.displayName ?? 'Learner' }}
        assignments={assignments}
        onStart={(assignmentRef) => {
          setOpenAssignmentRef(assignmentRef)
          void run(() => controller.start(activeStudentRef, assignmentRef), { clearOnReject: true })
        }}
        onResume={(assignmentRef) => {
          setOpenAssignmentRef(assignmentRef)
          void run(() => controller.resume(activeStudentRef, assignmentRef), { clearOnReject: true })
        }}
        onPause={(assignmentRef) => void run(() => controller.pause(activeStudentRef, assignmentRef))}
        onComplete={(assignmentRef) => void run(() => controller.complete(activeStudentRef, assignmentRef))}
        onExit={() => {
          setOpenAssignmentRef(null)
          setStudy(null)
        }}
        actionsDisabled={studyMutationsDisabled}
      />

      {message && (
        <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold" role="alert">
          {message}
        </p>
      )}

      {study && open && (
        <section
          className="mt-4 rounded-lg border border-slate-300 p-3"
          aria-labelledby="family-pilot-study"
          data-testid="family-pilot-study"
        >
          <h3 id="family-pilot-study" className="font-extrabold">{study.title}</h3>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-semibold">
            <dt className="text-slate-600">Lesson</dt>
            <dd data-study="lessonRef">{study.lessonRef}</dd>
            <dt className="text-slate-600">Step</dt>
            <dd data-study="segmentRef">{study.segmentRef ?? '—'}</dd>
            <dt className="text-slate-600">Step number</dt>
            <dd data-study="segmentOrdinal">{study.segmentOrdinal ?? '—'}</dd>
            <dt className="text-slate-600">Finished steps</dt>
            <dd data-study="completedSegments">{study.completedSegmentRefs.length}</dd>
            <dt className="text-slate-600">Status</dt>
            <dd data-study="assignmentState">{study.assignmentState}</dd>
            <dt className="text-slate-600">Session</dt>
            <dd data-study="sessionStatus">{study.sessionStatus ?? '—'}</dd>
          </dl>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
              disabled={studyMutationsDisabled}
              onClick={() => void run(() => controller.checkpoint(activeStudentRef, open.assignmentRef))}
            >
              Save my place
            </button>
            <button
              type="button"
              className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
              disabled={studyMutationsDisabled}
              onClick={() => void run(() => controller.completeSegment(activeStudentRef, open.assignmentRef))}
            >
              Finish this step
            </button>
            <button
              type="button"
              data-testid="family-pilot-help"
              className="min-h-11 rounded-lg border border-cyan-800 bg-cyan-700 px-4 py-2 font-extrabold text-white"
              onClick={() => {
                // startHelp degrades to the static fallback on its own, so an
                // unavailable Tutor Core costs the student a hint, not the lesson.
                const step = controller.help(activeStudentRef, open.assignmentRef)
                if (step) setHelp({ session: step.session, text: step.presentation.visibleText })
                setHelpMessage('')
              }}
            >
              I need help
            </button>
          </div>

          {help && (
            <section className="mt-3 rounded-lg border border-cyan-200 bg-cyan-50 p-3" data-testid="family-pilot-tutor">
              <p className="font-semibold" data-tutor="path">{help.session.path}</p>
              <p className="mt-1 font-semibold" data-tutor="text">{help.text}</p>
              <label className="mt-3 block text-sm font-semibold text-slate-700" htmlFor="family-pilot-help-message">
                What&rsquo;s tricky?
              </label>
              {/* No raw learner text is ever persisted: helpMessage lives only in
                  this component's state and is cleared the moment each turn is
                  sent, matching submitTurn's own in-memory-only transcript. */}
              <textarea
                id="family-pilot-help-message"
                data-testid="family-pilot-help-input"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2"
                rows={2}
                value={helpMessage}
                disabled={helpBusy}
                onChange={(event) => setHelpMessage(event.target.value)}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  data-testid="family-pilot-help-send"
                  className="min-h-11 rounded-lg border border-cyan-800 bg-cyan-700 px-4 py-2 font-bold text-white"
                  disabled={helpBusy || !helpMessage.trim()}
                  onClick={() => void sendHelpMessage()}
                >
                  Ask
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
                  onClick={() => {
                    controller.closeHelp(help.session)
                    setHelp(null)
                    setHelpMessage('')
                  }}
                >
                  Back to my lesson
                </button>
              </div>
            </section>
          )}
        </section>
      )}

      <button
        type="button"
        data-testid="family-pilot-switch-student"
        className="mt-4 min-h-11 rounded-lg border border-slate-400 bg-white px-4 py-2 font-bold"
        onClick={() => {
          controller.selectStudent(null)
          context.reload()
        }}
      >
        Switch learner
      </button>
    </section>
  )
}

/** Re-exported so hosts can build a login selector without importing identity. */
export { toStudentSelector }

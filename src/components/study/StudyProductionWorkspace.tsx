import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { StudyCheckpointRecord } from '../../study/contracts/persistence/types'
import {
  isStudyProductionReleaseVersion,
  isStudyProductionSafeRef,
  type StudyProductionEffectiveSettings,
  type StudyProductionSessionProjection,
} from '../../study/contracts/production/session'
import type {
  StudyProductionBeginInput,
  StudyProductionCheckpointDraft,
  StudyProductionController,
  StudyProductionControllerSnapshot,
  StudyProductionResumeInput,
  StudyProductionTransitionInput,
} from '../../study/production/sessionController'
import './study-host.css'
import './study-production-workspace.css'

export const STUDY_PRODUCTION_BOUND_CONTENT_CONTRACT =
  'manuel-academy.study-bound-content.v1' as const

export interface StudyProductionBoundSegment {
  readonly segmentId: string
  readonly label: string
}

export interface StudyProductionBoundContent {
  readonly contract: typeof STUDY_PRODUCTION_BOUND_CONTENT_CONTRACT
  readonly lessonId: string
  readonly releaseVersion: string
  readonly subjectLabel: string
  readonly lessonTitle: string
  readonly goal: string
  readonly segments: readonly StudyProductionBoundSegment[]
}

interface StudyProductionContentRenderBase {
  readonly content: StudyProductionBoundContent
  readonly segment: StudyProductionBoundSegment
  readonly checkpoint: StudyCheckpointRecord | null
  readonly busy: boolean
}

export type StudyProductionContentRenderInput = StudyProductionContentRenderBase & (
  | {
      readonly mode: 'current'
      readonly actions: {
        readonly completeCurrentSegment: () => void
        readonly saveCheckpoint: (
          checkpoint: StudyProductionCheckpointDraft,
        ) => Promise<StudyProductionControllerSnapshot>
      }
    }
  | {
      readonly mode: 'review'
      readonly actions: {
        readonly returnToCurrentSegment: () => void
      }
    }
)

/**
 * The only production content seam. A future trusted resolver must supply an
 * exact curriculum binding and its renderer. There is intentionally no local,
 * demo, synthetic, or preview fallback branch.
 */
export type StudyProductionContentSlot =
  | { readonly status: 'loading' }
  | { readonly status: 'unavailable' }
  | {
      readonly status: 'bound'
      readonly content: StudyProductionBoundContent
      readonly renderSegment: (input: StudyProductionContentRenderInput) => ReactNode
    }

export type StudyProductionWorkspaceLaunch =
  | { readonly kind: 'begin'; readonly input: StudyProductionBeginInput }
  | { readonly kind: 'resume'; readonly input: StudyProductionResumeInput }

export interface StudyProductionWorkspaceProps {
  readonly controller: StudyProductionController
  readonly launch: StudyProductionWorkspaceLaunch
  readonly content: StudyProductionContentSlot
  readonly onExit: () => void
  readonly checkReadinessOnMount?: boolean
}

export interface StudyProductionWorkspaceViewActions {
  readonly checkReadiness: () => void
  readonly enter: () => void
  readonly retry: (() => void) | null
  readonly recover: (() => void) | null
  readonly pause: () => void
  readonly resume: () => void
  readonly requestBreak: () => void
  readonly startBreak: () => void
  readonly endBreak: () => void
  readonly recoverInterruption: () => void
  readonly startSegment: (segmentId: string) => void
  readonly completeCurrentSegment: () => void
  readonly completeSession: () => void
  readonly selectSegment: (segmentId: string | null) => void
  readonly saveCheckpoint: (
    checkpoint: StudyProductionCheckpointDraft,
  ) => Promise<StudyProductionControllerSnapshot>
  readonly saveAndExit: () => void
  readonly exit: () => void
}

function validDisplayText(value: string): boolean {
  return value.trim().length > 0 && value.length <= 240
}

export function isStudyProductionBoundContent(
  value: StudyProductionBoundContent,
): boolean {
  if (
    value.contract !== STUDY_PRODUCTION_BOUND_CONTENT_CONTRACT ||
    !isStudyProductionSafeRef(value.lessonId) ||
    !isStudyProductionReleaseVersion(value.releaseVersion) ||
    !validDisplayText(value.subjectLabel) ||
    !validDisplayText(value.lessonTitle) ||
    !validDisplayText(value.goal) ||
    value.segments.length < 1 ||
    value.segments.length > 64
  ) return false
  const segmentIds = new Set<string>()
  for (const segment of value.segments) {
    if (
      !isStudyProductionSafeRef(segment.segmentId) ||
      !validDisplayText(segment.label) ||
      segmentIds.has(segment.segmentId)
    ) return false
    segmentIds.add(segment.segmentId)
  }
  return true
}

function contentMatchesLaunch(
  content: StudyProductionBoundContent,
  launch: StudyProductionWorkspaceLaunch,
): boolean {
  if (!isStudyProductionBoundContent(content)) return false
  if (launch.kind === 'resume') {
    return content.releaseVersion === launch.input.curriculumReleaseVersion
  }
  return content.lessonId === launch.input.academyContext.lessonRef &&
    content.releaseVersion === launch.input.academyContext.releaseVersion &&
    content.segments.some(({ segmentId }) => segmentId === launch.input.initialSegmentId)
}

function contentMatchesSession(
  content: StudyProductionBoundContent,
  session: StudyProductionSessionProjection,
): boolean {
  return isStudyProductionBoundContent(content) &&
    content.lessonId === session.lessonId &&
    content.releaseVersion === session.curriculumBinding.releaseVersion &&
    (session.currentSegmentId === null ||
      content.segments.some(({ segmentId }) => segmentId === session.currentSegmentId))
}

function settingSummary(settings: StudyProductionEffectiveSettings): string {
  if (settings.timerMode === 'hidden') {
    return 'Timer hidden. Your learning steps are still shown.'
  }
  if (settings.timerMode === 'count_up') {
    return 'Your Study timer counts up without changing your learning steps.'
  }
  if (settings.timerMode === 'count_down') {
    return 'Your Study timer counts down without submitting or changing a learning step.'
  }
  return 'Your Study timer is visible and separate from learning progress.'
}

function announcement(snapshot: StudyProductionControllerSnapshot): string {
  if (snapshot.status === 'loading') {
    return snapshot.pendingMutation ? 'Saving your Study place.' : 'Checking your Study workspace.'
  }
  if (snapshot.status === 'ready') {
    if (!snapshot.session) return 'Your Study workspace is ready.'
    if (snapshot.session.state === 'paused') return 'Study is paused. Your place is saved.'
    if (snapshot.session.state === 'approved-break') return 'Your break is ready.'
    if (snapshot.session.state === 'student-requested-break') return 'Your break request is saved.'
    if (snapshot.session.state === 'technical-interruption') return 'Your saved Study place is ready to recover.'
    if (snapshot.session.state === 'completed') return 'This Study session is complete.'
    if (snapshot.session.state === 'abandoned') return 'This Study session has ended.'
    return 'Your current Study step is ready.'
  }
  if (snapshot.status === 'network_failure') {
    return 'Study could not confirm the last request. Wait before choosing another action.'
  }
  if (snapshot.status === 'conflict' || snapshot.status === 'resume_required') {
    return 'Study needs to reload the saved session before continuing.'
  }
  if (snapshot.status === 'manual_review') return 'This Study plan needs adult review.'
  return 'Study cannot continue from this screen yet.'
}

function StateCard({
  title,
  children,
  alert = false,
  actions,
}: {
  readonly title: string
  readonly children: ReactNode
  readonly alert?: boolean
  readonly actions?: ReactNode
}) {
  return (
    <section
      className="study-production-state rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
      role={alert ? 'alert' : undefined}
      aria-labelledby="study-production-state-title"
    >
      <h2 id="study-production-state-title" className="text-2xl font-extrabold text-slate-900">
        {title}
      </h2>
      <div className="mt-2 font-semibold text-slate-600">{children}</div>
      {actions && <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{actions}</div>}
    </section>
  )
}

const primaryButton =
  'min-h-11 rounded-lg border border-cyan-800 bg-cyan-700 px-5 py-3 font-extrabold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButton =
  'min-h-11 rounded-lg border border-slate-400 bg-white px-5 py-3 font-bold text-slate-800 hover:border-slate-600 disabled:cursor-not-allowed disabled:opacity-60'

export function StudyProductionWorkspace({
  controller,
  launch,
  content,
  onExit,
  checkReadinessOnMount = true,
}: StudyProductionWorkspaceProps) {
  const [snapshot, setSnapshot] = useState(() => controller.snapshot())
  const lastOperationRef = useRef<(() => Promise<StudyProductionControllerSnapshot>) | null>(null)

  useEffect(() => {
    setSnapshot(controller.snapshot())
    return controller.subscribe(setSnapshot)
  }, [controller])

  const runOperation = useCallback(async (
    operation: () => Promise<StudyProductionControllerSnapshot>,
  ) => {
    lastOperationRef.current = operation
    const result = await operation()
    if (result.status !== 'network_failure' && result.status !== 'resume_required') {
      lastOperationRef.current = null
    }
    return result
  }, [])

  const runTransition = useCallback((input: StudyProductionTransitionInput) => {
    void runOperation(() => controller.transition(input))
  }, [controller, runOperation])

  const recover = useCallback(() => {
    const session = controller.snapshot().session
    if (session) {
      void runOperation(() => controller.resume({
        sessionId: session.sessionId,
        curriculumReleaseVersion: session.curriculumBinding.releaseVersion,
      }))
      return
    }
    if (launch.kind === 'resume') {
      void runOperation(() => controller.resume(launch.input))
    }
  }, [controller, launch, runOperation])

  useEffect(() => {
    if (!checkReadinessOnMount || controller.snapshot().session ||
        controller.snapshot().status !== 'not_ready') return
    const abort = new AbortController()
    void runOperation(() => controller.checkReadiness(abort.signal))
    return () => abort.abort('study-workspace-unmounted')
  }, [checkReadinessOnMount, controller, runOperation])

  const enter = useCallback(() => {
    if (launch.kind === 'begin') {
      void runOperation(() => controller.begin(launch.input))
    } else {
      void runOperation(() => controller.resume(launch.input))
    }
  }, [controller, launch, runOperation])

  const transitionForCurrent = useCallback((type: StudyProductionTransitionInput['type']) => {
    const session = controller.snapshot().session
    if (!session) return
    runTransition({ type, segmentId: session.currentSegmentId })
  }, [controller, runTransition])

  const saveAndExit = useCallback(async () => {
    const session = controller.snapshot().session
    if (!session || session.state !== 'active') {
      onExit()
      return
    }
    const result = await runOperation(() => controller.transition({
      type: 'pause-started',
      segmentId: session.currentSegmentId,
    }))
    if (result.status === 'ready' && result.session?.state === 'paused') onExit()
  }, [controller, onExit, runOperation])

  const actions: StudyProductionWorkspaceViewActions = {
    checkReadiness: () => { void runOperation(() => controller.checkReadiness()) },
    enter,
    retry: lastOperationRef.current
      ? () => { void runOperation(lastOperationRef.current!) }
      : null,
    recover: snapshot.session || launch.kind === 'resume' ? recover : null,
    pause: () => transitionForCurrent('pause-started'),
    resume: () => transitionForCurrent('session-resumed'),
    requestBreak: () => transitionForCurrent('break-requested'),
    startBreak: () => transitionForCurrent('break-started'),
    endBreak: () => transitionForCurrent('break-ended'),
    recoverInterruption: () => transitionForCurrent('technical-interruption-ended'),
    startSegment: (segmentId) => runTransition({ type: 'segment-started', segmentId }),
    completeCurrentSegment: () => transitionForCurrent('segment-completed'),
    completeSession: () => runTransition({ type: 'session-completed', segmentId: null }),
    selectSegment: (segmentId) => { setSnapshot(controller.selectSegment(segmentId)) },
    saveCheckpoint: (checkpoint) => runOperation(() => controller.saveCheckpoint(checkpoint)),
    saveAndExit: () => { void saveAndExit() },
    exit: onExit,
  }

  return (
    <StudyProductionWorkspaceView
      snapshot={snapshot}
      launch={launch}
      content={content}
      actions={actions}
    />
  )
}

export function StudyProductionWorkspaceView({
  snapshot,
  launch,
  content,
  actions,
}: {
  readonly snapshot: StudyProductionControllerSnapshot
  readonly launch: StudyProductionWorkspaceLaunch
  readonly content: StudyProductionContentSlot
  readonly actions: StudyProductionWorkspaceViewActions
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const session = snapshot.session
  const busy = snapshot.status === 'loading'
  const settings = session?.effectiveSettings
  const bound = content.status === 'bound' &&
    typeof content.renderSegment === 'function' &&
    contentMatchesLaunch(content.content, launch)
    ? content
    : null
  const sessionContentReady = Boolean(
    bound && session && contentMatchesSession(bound.content, session),
  )
  const savedSessionCanExit = snapshot.status === 'ready' && Boolean(
    session && session.state !== 'completed' && session.state !== 'abandoned',
  )
  const activeSessionNeedsSave = savedSessionCanExit && session?.state === 'active'
  const currentTaskAvailable = snapshot.status === 'ready' && sessionContentReady &&
    session?.state === 'active' && session.currentSegmentId !== null
  const focusKey = `${snapshot.status}:${session?.state ?? 'entry'}:${session?.currentSegmentId ?? 'none'}:${snapshot.selection.segmentId ?? 'none'}`

  useEffect(() => {
    headingRef.current?.focus()
  }, [focusKey])

  return (
    <div
      className="study-runtime-host study-production-workspace min-h-screen bg-slate-50 text-slate-900"
      data-large-text={settings?.largeText ?? false}
      data-reduced-motion={settings?.reducedMotion ?? false}
    >
      <a
        href={currentTaskAvailable ? '#study-production-current-task' : '#study-production-main'}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3"
      >
        {currentTaskAvailable ? 'Skip to current Study task' : 'Skip to Study workspace'}
      </a>
      <main
        id="study-production-main"
        className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7"
        aria-busy={busy}
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-extrabold text-cyan-800">Manuel Academy</p>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-extrabold sm:text-3xl">
              Study workspace
            </h1>
            {bound && <p className="mt-1 font-semibold text-slate-600">{bound.content.subjectLabel}</p>}
          </div>
          <button
            type="button"
            className={secondaryButton}
            disabled={busy}
            onClick={activeSessionNeedsSave ? actions.saveAndExit : actions.exit}
          >
            {savedSessionCanExit ? 'Save and exit' : 'Back to Study plan'}
          </button>
        </header>

        <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {announcement(snapshot)}
        </p>

        <div className="mt-5">
          {snapshot.status === 'loading' ? (
            <StateCard title={session ? 'Saving your Study place' : 'Preparing Study'}>
              <p>{snapshot.pendingMutation
                ? 'Please wait for this one request to finish before choosing another action.'
                : 'Checking the current Study plan and saved place.'}</p>
            </StateCard>
          ) : snapshot.status === 'not_ready' ? (
            <StateCard
              title="Study is getting ready"
              actions={<button type="button" className={primaryButton} onClick={actions.checkReadiness}>Check again</button>}
            >
              <p>Your Study session has not started. Check again when you are ready.</p>
            </StateCard>
          ) : snapshot.status === 'manual_review' ? (
            <StateCard
              title="This Study plan needs a review"
              alert
              actions={<button type="button" className={secondaryButton} onClick={actions.exit}>Back to Study plan</button>}
            >
              <p>Ask a parent or teacher to review the plan. Your work has not moved forward.</p>
            </StateCard>
          ) : snapshot.status === 'unavailable' ? (
            <StateCard
              title="Study is unavailable right now"
              alert
              actions={<button type="button" className={secondaryButton} onClick={actions.exit}>Back to Study plan</button>}
            >
              <p>Your saved work was not changed. Return to the Study plan and try again later.</p>
            </StateCard>
          ) : snapshot.status === 'network_failure' ? (
            <StateCard
              title="Study could not confirm that request"
              alert
              actions={actions.retry
                ? <button type="button" className={primaryButton} onClick={actions.retry}>Check the same request once</button>
                : <button type="button" className={secondaryButton} onClick={actions.exit}>Back to Study plan</button>}
            >
              <p>Do not repeat a different action yet. The button below checks the same saved request so Study can resolve it safely.</p>
            </StateCard>
          ) : snapshot.status === 'conflict' ? (
            <StateCard
              title="Study changed somewhere else"
              alert
              actions={actions.recover
                ? <button type="button" className={primaryButton} onClick={actions.recover}>Reload the saved Study state</button>
                : <button type="button" className={secondaryButton} onClick={actions.exit}>Back to Study plan</button>}
            >
              <p>Reload the server-saved session before continuing. No newer change will be replaced.</p>
            </StateCard>
          ) : snapshot.status === 'resume_required' && snapshot.recovery?.kind === 'student_session_invalid' ? (
            <StateCard
              title="Sign in again to resume Study"
              alert
              actions={<button type="button" className={secondaryButton} onClick={actions.exit}>Back to Study plan</button>}
            >
              <p>Your saved work was not changed. Return to the Study plan to start a new verified session.</p>
            </StateCard>
          ) : snapshot.status === 'resume_required' ? (
            <StateCard
              title="Study needs to restore your saved place"
              alert
              actions={actions.retry
                ? <button type="button" className={primaryButton} onClick={actions.retry}>Check the pending request</button>
                : actions.recover
                  ? <button type="button" className={primaryButton} onClick={actions.recover}>Restore my saved Study place</button>
                  : <button type="button" className={secondaryButton} onClick={actions.exit}>Back to Study plan</button>}
            >
              <p>Wait for the saved session to be checked before starting another action.</p>
            </StateCard>
          ) : snapshot.status === 'rejected' ? (
            <StateCard
              title="That Study action is not available"
              alert
              actions={actions.recover
                ? <button type="button" className={primaryButton} onClick={actions.recover}>Reload my saved place</button>
                : <button type="button" className={secondaryButton} onClick={actions.exit}>Back to Study plan</button>}
            >
              <p>Your progress did not move. Reload the saved session before choosing what comes next.</p>
            </StateCard>
          ) : !session ? (
            content.status === 'loading' ? (
              <StateCard title="Preparing lesson content"><p role="status">Checking the bound curriculum lesson.</p></StateCard>
            ) : !bound ? (
              <ContentUnavailable actions={actions} />
            ) : (
              <StateCard
                title={bound.content.lessonTitle}
                actions={<button type="button" className={primaryButton} onClick={actions.enter}>
                  {launch.kind === 'resume' ? 'Resume exact step' : 'Start Study'}
                </button>}
              >
                <p className="text-sm font-extrabold uppercase tracking-wide text-cyan-800">Today&apos;s goal</p>
                <p className="mt-1 text-lg text-slate-800">{bound.content.goal}</p>
                {launch.kind === 'resume' && <p className="mt-3">Your saved place will be restored from the server before the lesson opens.</p>}
              </StateCard>
            )
          ) : content.status === 'loading' ? (
            <StateCard title="Preparing lesson content"><p role="status">Your saved session is ready while its bound lesson is checked.</p></StateCard>
          ) : !sessionContentReady || !bound ? (
            <ContentUnavailable actions={actions} />
          ) : (
            <SessionWorkspace snapshot={snapshot} content={bound} actions={actions} />
          )}
        </div>
      </main>
    </div>
  )
}

function ContentUnavailable({ actions }: { readonly actions: StudyProductionWorkspaceViewActions }) {
  return (
    <StateCard
      title="This lesson content is unavailable"
      alert
      actions={<button type="button" className={secondaryButton} onClick={actions.exit}>Back to Study plan</button>}
    >
      <p>Study will not substitute a practice or preview lesson. Your saved session was not changed.</p>
    </StateCard>
  )
}

function SessionWorkspace({
  snapshot,
  content,
  actions,
}: {
  readonly snapshot: StudyProductionControllerSnapshot
  readonly content: Extract<StudyProductionContentSlot, { readonly status: 'bound' }>
  readonly actions: StudyProductionWorkspaceViewActions
}) {
  const session = snapshot.session!
  const completed = new Set(snapshot.checkpoint?.completedSegmentIds ?? [])
  const selectedId = snapshot.selection.segmentId ?? session.currentSegmentId
  const selected = content.content.segments.find(({ segmentId }) => segmentId === selectedId) ?? null
  const current = content.content.segments.find(
    ({ segmentId }) => segmentId === session.currentSegmentId,
  ) ?? null
  const next = snapshot.checkpoint
    ? content.content.segments.find(({ segmentId }) => !completed.has(segmentId)) ?? null
    : null
  const allSegmentsCompleted = Boolean(
    snapshot.checkpoint &&
    content.content.segments.every(({ segmentId }) => completed.has(segmentId)),
  )

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="study-production-progress-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-extrabold uppercase tracking-wide text-cyan-800">Today&apos;s goal</p>
            <h2 id="study-production-progress-title" className="mt-1 text-xl font-extrabold">{content.content.lessonTitle}</h2>
            <p className="mt-1 font-semibold text-slate-600">{content.content.goal}</p>
          </div>
          {session.state === 'active' && (
            <button type="button" className={secondaryButton} onClick={actions.pause}>Pause</button>
          )}
        </div>
        <nav className="mt-4" aria-label="Learning progress">
          <ol className="study-production-progress-list grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {content.content.segments.map((segment, index) => {
              const isCurrent = segment.segmentId === session.currentSegmentId
              const isSelected = segment.segmentId === selectedId
              const isComplete = completed.has(segment.segmentId)
              const label = `${index + 1}. ${segment.label}`
              return (
                <li key={segment.segmentId}>
                  {isComplete || isCurrent ? (
                    <button
                      type="button"
                      className={`w-full rounded-xl border p-3 text-left font-bold ${
                        isSelected ? 'border-cyan-700 bg-cyan-50' : 'border-slate-300 bg-white'
                      }`}
                      aria-current={isCurrent ? 'step' : undefined}
                      onClick={() => actions.selectSegment(segment.segmentId)}
                    >
                      <span className="block">{label}</span>
                      <span className="block text-sm font-semibold text-slate-600">
                        {isCurrent ? 'Current step' : 'Completed - review only'}
                      </span>
                    </button>
                  ) : (
                    <div className="min-h-11 rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold text-slate-500">
                      <span className="block">{label}</span>
                      <span className="block text-sm font-semibold">Not started</span>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </nav>
        <p className="mt-3 text-sm font-semibold text-slate-600">{settingSummary(session.effectiveSettings)}</p>
        {session.effectiveSettings.noAudio && (
          <p className="mt-1 text-sm font-semibold text-slate-600">Text-only Study is on. Audio is not required.</p>
        )}
      </section>

      <div className="mt-5">
        {session.state === 'paused' ? (
          <StateCard
            title="Paused"
            actions={<button type="button" className={primaryButton} onClick={actions.resume}>Resume exact step</button>}
          >
            <p>Your place and your work are saved. Return when you are ready.</p>
          </StateCard>
        ) : session.state === 'student-requested-break' ? (
          <StateCard
            title="Your break request is saved"
            actions={<button type="button" className={primaryButton} onClick={actions.startBreak}>Start my break</button>}
          >
            <p>Study is checking the server-approved plan before the break begins.</p>
          </StateCard>
        ) : session.state === 'approved-break' ? (
          <BreakSurface session={session} onReturn={actions.endBreak} />
        ) : session.state === 'technical-interruption' ? (
          <StateCard
            title="Your work is safe"
            actions={<button type="button" className={primaryButton} onClick={actions.recoverInterruption}>Return to my lesson</button>}
          >
            <p>The page was interrupted. Study will restore the same saved step without replaying an answer.</p>
          </StateCard>
        ) : session.state === 'completed' ? (
          <StateCard
            title="Study session complete"
            actions={<button type="button" className={primaryButton} onClick={actions.exit}>Back to Study plan</button>}
          >
            <p>Your completed learning steps are saved.</p>
          </StateCard>
        ) : session.state === 'abandoned' ? (
          <StateCard
            title="This Study session has ended"
            actions={<button type="button" className={secondaryButton} onClick={actions.exit}>Back to Study plan</button>}
          >
            <p>Your Study plan can guide you to what is available next.</p>
          </StateCard>
        ) : selected ? (
          <div className="study-production-task-grid grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
            <section id="study-production-current-task" className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6" aria-labelledby="study-production-task-title">
              <p className="text-sm font-extrabold uppercase tracking-wide text-cyan-800">
                {selected.segmentId === session.currentSegmentId ? 'Current Study task' : 'Reviewing a completed step'}
              </p>
              <h2 id="study-production-task-title" className="mt-1 text-2xl font-extrabold">{selected.label}</h2>
              {selected.segmentId !== session.currentSegmentId && (
                <p className="mt-2 rounded-lg bg-slate-100 p-3 font-semibold">Review only. This does not change your saved progress.</p>
              )}
              <div className="mt-4">
                {selected.segmentId === session.currentSegmentId
                  ? content.renderSegment({
                      content: content.content,
                      segment: selected,
                      mode: 'current',
                      checkpoint: snapshot.checkpoint,
                      busy: snapshot.status === 'loading',
                      actions: {
                        completeCurrentSegment: actions.completeCurrentSegment,
                        saveCheckpoint: actions.saveCheckpoint,
                      },
                    })
                  : content.renderSegment({
                      content: content.content,
                      segment: selected,
                      mode: 'review',
                      checkpoint: snapshot.checkpoint,
                      busy: snapshot.status === 'loading',
                      actions: {
                        returnToCurrentSegment: () => actions.selectSegment(session.currentSegmentId),
                      },
                    })}
              </div>
            </section>
            <aside className="rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="study-production-actions-title">
              <h2 id="study-production-actions-title" className="text-xl font-extrabold">Study controls</h2>
              <p className="mt-2 font-semibold text-slate-600">Your server-approved settings stay in effect for this session.</p>
              <div className="mt-4 grid gap-3">
                {selected.segmentId !== session.currentSegmentId && current && (
                  <button type="button" className={primaryButton} onClick={() => actions.selectSegment(current.segmentId)}>Return to current step</button>
                )}
                <button type="button" className={secondaryButton} onClick={actions.requestBreak}>I need a break</button>
                <button type="button" className={secondaryButton} onClick={actions.saveAndExit}>Save and exit</button>
              </div>
            </aside>
          </div>
        ) : next ? (
          <StateCard
            title="Your next Study step is ready"
            actions={<button type="button" className={primaryButton} onClick={() => actions.startSegment(next.segmentId)}>Start {next.label}</button>}
          >
            <p>The previous step is saved. Start the next bound step when you are ready.</p>
          </StateCard>
        ) : allSegmentsCompleted ? (
          <StateCard
            title="Your learning block is ready to finish"
            actions={<button type="button" className={primaryButton} onClick={actions.completeSession}>Finish Study</button>}
          >
            <p>All bound Study steps are saved.</p>
          </StateCard>
        ) : (
          <StateCard
            title="Study needs your exact saved step"
            alert
            actions={<button type="button" className={primaryButton} onClick={actions.recover ?? actions.exit}>Restore my saved place</button>}
          >
            <p>The lesson will not guess which step comes next.</p>
          </StateCard>
        )}
      </div>
    </>
  )
}

function BreakSurface({
  session,
  onReturn,
}: {
  readonly session: StudyProductionSessionProjection
  readonly onReturn: () => void
}) {
  const settings = session.effectiveSettings
  const windowText = settings.breakMinimumMinutes === settings.breakMaximumMinutes
    ? `${settings.breakMinimumMinutes} minutes`
    : `${settings.breakMinimumMinutes}-${settings.breakMaximumMinutes} minutes`
  return (
    <section id="study-production-current-task" className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5 sm:p-7" aria-labelledby="study-production-break-title">
      <p className="text-sm font-extrabold uppercase tracking-wide text-cyan-900">Learning is paused</p>
      <h2 id="study-production-break-title" className="mt-1 text-2xl font-extrabold">Take the break you need</h2>
      <p className="mt-2 font-semibold text-slate-700">Your work and your place are saved. Your Study plan has a {windowText} break window.</p>
      <ul className="mt-4 grid gap-2 text-sm font-semibold text-slate-700 sm:grid-cols-2" aria-label="Quiet break ideas">
        <li className="rounded-lg bg-white p-3">Get water or stretch</li>
        <li className="rounded-lg bg-white p-3">Look away from the screen</li>
        <li className="rounded-lg bg-white p-3">Walk briefly in your learning space</li>
        <li className="rounded-lg bg-white p-3">Take a quiet moment</li>
      </ul>
      <p className="mt-3 text-sm font-semibold text-slate-600">There is no penalty or visible count for taking a break.</p>
      <button type="button" className={`${primaryButton} mt-5`} onClick={onReturn}>I&apos;m ready to return</button>
    </section>
  )
}

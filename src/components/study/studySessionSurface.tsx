import { useEffect, useRef, useState, type ReactNode } from 'react'
import { JarvisCore } from '../../../adaptive-tutor/study-engine/ui/JarvisCore.tsx'
import {
  attachHostStudySurface,
  type HostStudyLifecycleSeam,
} from '../../study/composition/hostStudyLifecycle'
import { assertCompleteStudyPortBundle, type StudyPortBundle } from '../../study/ports'
import { runCurrentStudyWork } from '../../study/production/lifecycleBoundary'
import {
  prepareDurableStudySession,
  settleStudyTutorLaunch,
} from '../../study/production/tutorLaunchOrdering'
import { STUDY_LEARNER_STOP_MESSAGE } from '../../study/safety/learnerSafe'
import { isSessionStoppedByLocalLedger, recordLocalSessionSafetyStop } from '../../study/safety/localStopLedger'
import { createStudyTurnRequestRef } from '../../study/studyRequestRef'
import type {
  HostStudyLaunchContext,
  StudyAccessibilitySettings,
  StudyCalendarEntry,
  StudyCheckpoint,
  StudyRuntimeInterruption,
  StudyScope,
} from '../../study/types'
import './study-host.css'

/**
 * STUDY-A1-PRODUCTION-SAFE-CONTAINER — the Study session body, with runtime
 * selection lifted out of it and nothing else.
 *
 * The measured bundle boundary found exactly ONE reason the mounted container
 * cannot ship to production: `src/study/runtimeFacade.ts`, whose import closure
 * carries the release-candidate learner sentinel, the `LOCAL DEVELOPMENT ONLY`
 * marker and the frozen Tutor content. Everything else the container reaches is
 * production-safe. So the fix is not a second container; it is one container
 * that does not choose its own runtime.
 *
 * WHAT IS SHARED IS EVERY RULE THAT PROTECTS A CHILD, and that is deliberate to
 * the point of being the whole design constraint. There is ONE implementation
 * of each of:
 *
 *   HOST_AWAIT ordering    `settleStudyTutorLaunch` → `prepareDurableStudySession`
 *   stale-authority checks `surface.token`, `token.isCurrent()`, `bindingRef`
 *   safety-stop mapping    the durable ledger write, the lock, the cancel
 *   interruption mapping   `interruptionMessage` and the retry rule
 *   privacy behaviour      what the durable branches are allowed to carry
 *
 * A preview copy and a production copy of any of those is the failure this file
 * exists to prevent: they would agree on the day they were written and diverge
 * silently afterwards, and the divergence would only be visible at the moment
 * it mattered — a safety stop that locked one surface and not the other.
 *
 * WHAT IS NOT SHARED is which Tutor answers, and how its answer is normalised
 * to `StudyHostTurnResult`. That is the `StudySessionTutorSeam` below. It is the
 * only variation point, it is injected, and it is the only thing the preview and
 * production wrappers differ by.
 *
 * F4 (`unknown` → `acceptStudyTutorResult`) lives with the production seam
 * rather than here, because it is the production Tutor's own ingestion edge and
 * there is exactly one of it: ./productionTutorSeam.ts. The preview facade is
 * not a Tutor result and does not cross that parser — it never has.
 */

export const STUDY_TUTOR_OUTPUT_PENDING_MESSAGE = 'I’m checking the Tutor reply before showing it.'

// STUDY-A1-AUTH-C — neither of these is a safety message. Both say what is true
// and nothing more: the session ended, or the service is busy. Neither claims
// anything about what the learner wrote, and neither names a status, a service,
// a session, or an adult account.
export const STUDY_SESSION_UNAVAILABLE_MESSAGE = 'The Study session ended. Please ask your dad to sign in again. You are not in trouble.'
export const STUDY_BUSY_RETRY_MESSAGE = 'Study is busy right now. Wait a moment, then try again.'
// STUDY-A1-AUTH-INFRA-BOUNDARY-C — a technical interruption, worded as one. It
// says Study is unavailable, not that the learner is: no status, no service, no
// session, no adult account, and nothing about what she wrote or whether she is
// in trouble. It does not say "busy", because the service is not shedding her
// request, and it does not say the session ended, because it has not.
export const STUDY_UNAVAILABLE_RETRY_MESSAGE = 'Study is not available right now. Wait a moment, then try again.'

function interruptionMessage(interruption: StudyRuntimeInterruption): string {
  if (interruption.kind === 'rate-limit') return STUDY_BUSY_RETRY_MESSAGE
  if (interruption.kind === 'authorization-infrastructure') return STUDY_UNAVAILABLE_RETRY_MESSAGE
  return STUDY_SESSION_UNAVAILABLE_MESSAGE
}

/**
 * STUDY-A1-COMP Phase 8. The calendar runtime measures active work in whole
 * seconds and refuses an interval that does not resolve to one
 * (`addActiveTime` in calendar-parent-runtime/calendar-runtime.ts), so a block
 * started at one millisecond offset and a segment completed at another threw on
 * the very first completion. Sub-second precision means nothing to a work block,
 * so every instant this container hands the runtime is truncated to the second
 * and they all come from here. Chronology is unaffected: the runtime compares
 * with `<`, so two events landing in the same second are still in order.
 *
 * Rounded UP rather than down: a block's own creation instant keeps millisecond
 * precision, and rounding down would place the first host event before it and
 * trip the runtime's chronology check instead.
 */
function studyInstant(): string {
  return new Date(Math.ceil(Date.now() / 1_000) * 1_000).toISOString()
}

/**
 * STUDY-A1-PROD-TUTOR-WRAPPER — the one turn shape this surface renders.
 *
 * The preview facade and the production contract answer the same four
 * questions with two different shapes: the facade's accepted arm nests its
 * prose under `presentation`, and its stopped arm carries a `studentMessage`
 * and a `classification` the contract deliberately does not have.
 *
 * Both are normalized to this before the branches below, so there is ONE set of
 * durable-write branches for both runtimes rather than two that must be kept in
 * step. A safety stop writing the ledger on one path and not the other is
 * exactly the class of drift that would not show up until it mattered.
 */
export type StudyHostTurnResult =
  | { readonly status: 'accepted'; readonly eventRef: string; readonly visibleText: string }
  | {
      readonly status: 'stopped'
      readonly reasonCode: string
      readonly deliveryStatus: 'proposed-not-delivered' | 'not-confirmed'
      /**
       * NOT what a stopped child reads, despite the name, and a reader has to
       * know that before deciding anything about this field.
       *
       * It reaches `setJarvisText` and stops there. The locked surface below
       * passes STUDY_LEARNER_STOP_MESSAGE as a constant and never renders
       * `jarvisText`, and once `stopped` is true the branch that would have
       * rendered it is unreachable — so no value a seam puts here can be
       * displayed by this surface. Two mutants that changed it survived this
       * card's campaign for exactly that reason and are declared equivalent;
       * the structural pin that keeps them equivalent is in
       * src/study/production/hostResultAcceptance.integration.test.tsx.
       *
       * Kept rather than deleted because the preview facade genuinely produces
       * one and removing the field is a change to both seams that this card did
       * not need to make. Anyone wiring the locked surface to `jarvisText` is
       * making this field live and must read that pin first.
       */
      readonly studentMessage: string
    }
  | { readonly status: 'interrupted'; readonly interruption: StudyRuntimeInterruption }
  | { readonly status: 'quarantined' }

/**
 * Everything a seam is told about the session it is serving.
 *
 * Passed at every call rather than closed over when the seam is built, because
 * `entry` is live state: segments complete as the learner works, and a seam
 * holding the entry it was constructed with would send a Tutor the wrong
 * segment's task type an hour into a block.
 *
 * `initialEntry` and `entry` are BOTH carried, and the distinction is not
 * cosmetic. The mounted host has always derived the Tutor's `lessonRef` from
 * the block the mount was opened on, and the skill fallback from the live one.
 * Collapsing them to a single field would be a silent change to what crosses
 * the Tutor boundary, which is the kind of change this card must not make.
 */
export interface StudySessionBinding {
  readonly context: HostStudyLaunchContext
  /** The calendar block this mount was opened on. Never replaced. */
  readonly initialEntry: StudyCalendarEntry
  /** The block as it stands now. */
  readonly entry: StudyCalendarEntry
  readonly scope: StudyScope
  /** The host's durable session reference, derived from the block. */
  readonly sessionRef: string
}

/** One learner turn, as the shared body hands it to the selected runtime. */
export interface StudyHostTurn {
  readonly requestRef: string
  readonly segmentRef: string
  /** The learner's words, for this call only. Never persisted by this surface. */
  readonly transientLearnerText: string
  readonly occurredAt: string
  /**
   * The host's composite staleness check — the lifecycle token AND this mount's
   * learner/block binding — already combined here so a seam cannot implement
   * half of it. The production contract takes no such parameter (host lifecycle
   * staleness is host authority; see StudyTutorTurn in contracts/tutor/runtime.ts),
   * so the production seam does not read it. The preview facade does.
   */
  readonly isCurrentBinding: () => boolean
}

/**
 * The ONLY thing preview and production differ by.
 *
 * `launch` returns `unknown` for the same reason `settleStudyTutorLaunch` takes
 * `() => unknown`: a synchronous launch — the preview runtime's — is awaited on
 * exactly the same path, so there is one ordering rule and one code path that
 * implements it.
 */
export interface StudySessionTutorSeam {
  launch(binding: StudySessionBinding): unknown
  submit(binding: StudySessionBinding, turn: StudyHostTurn): Promise<StudyHostTurnResult>
}

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

export function StudySessionSurface({ context: baseContext, initialEntry, ports, studyLifecycle, tutorSeam, onBack }: {
  context: HostStudyLaunchContext
  initialEntry: StudyCalendarEntry
  ports: Partial<StudyPortBundle>
  /**
   * STUDY-A1-COMP Phase 8 — the App's own Study lifecycle, the same object the
   * route received. This container used to build an unbound
   * StudyLifecycleBoundary of its own, so every guarded operation below aborted
   * before it started and the live session path was unreachable.
   */
  studyLifecycle: HostStudyLifecycleSeam
  /**
   * STUDY-A1-PRODUCTION-SAFE-CONTAINER — which Tutor answers, decided by the
   * wrapper rather than here.
   *
   * Required, and required on BOTH wrappers. An optional seam would put a
   * "no Tutor at all" branch back in this body, which is how the preview
   * runtime got hard-wired into the production import closure in the first
   * place. This surface knows there is a Tutor; it does not know which.
   *
   * What is NOT delegated is the ORDERING. `settleStudyTutorLaunch` runs on
   * both paths, so the rule "await the launch before anything durable" is
   * enforced for the preview runtime too — a rule that only applied to the
   * production runtime would be a rule nothing currently mounted could break,
   * which is how it would rot.
   *
   * Memoise it in the wrapper. It is an effect dependency below, exactly as the
   * preview runtime it replaced was, and an identity that changes every render
   * would detach and re-attach this surface on every render.
   */
  tutorSeam: StudySessionTutorSeam
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
  // The ledger records a stop against the learner and the session, which is what
  // the durable lock matches on.
  const stopKey = { studentRef: context.learnerRef, sessionRef }
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
  const [stopped, setStopped] = useState(() => isSessionStoppedByLocalLedger(stopKey))
  // STUDY-A1-AUTH-C: deliberately not seeded from any store and never written to
  // one. An authorization or rate-limit interruption belongs to this mount only,
  // so a refresh clears it — unlike a safety stop, which must survive one.
  const [interruption, setInterruption] = useState<StudyRuntimeInterruption | null>(null)
  const [error, setError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const bindingRef = useRef(`${context.householdRef}|${context.learnerRef}|${initialEntry.blockRef}`)
  /**
   * STUDY-A1-STRICTMODE-PREVIEW — the session preparation, held per epoch and
   * session rather than per effect setup. Preparing a session launches the
   * runtime, starts or resumes the calendar block, appends the `session-launched`
   * event and writes the session record; React's StrictMode replay runs the mount
   * effect twice inside one commit, and every one of those is a durable write that
   * must happen exactly once for a learner sitting down to one block.
   */
  const preparationRef = useRef<{ readonly key: string; readonly run: Promise<StudyCalendarEntry | null> } | null>(null)
  const lifecycle = studyLifecycle.boundary
  const learnerScope = { householdRef: context.householdRef, learnerRef: context.learnerRef }
  // A refused session cannot be recovered from inside the learner's surface, so
  // no further Tutor work is offered until the App composition reissues the
  // adult bearer or the Study session. A rate limit is only a wait, so the
  // lesson stays live and the same answer may simply be sent again.
  const sessionAuthorizationLost = interruption?.kind === 'session-authorization'
  const currentSegment = entry.segments.find((segment) => !entry.completedSegmentRefs.includes(segment.segmentRef))
  const accessibilityProjection = studyAccessibilityProjection(context.accessibility)
  const isCurrentBinding = () => bindingRef.current === `${context.householdRef}|${context.learnerRef}|${initialEntry.blockRef}`

  useEffect(() => {
    // STUDY-A1-STRICTMODE-PREVIEW — attach to the App's epoch. This never begins
    // one, and the cleanup below no longer cancels one: React runs
    // setup → cleanup → setup inside a single StrictMode mount commit with no
    // render between them, so a cleanup that cancelled the shared epoch destroyed
    // the authority the second setup then had to attach to. Retiring the epoch on
    // a real exit is the route's `leaveStudy`, and on logout, learner switch or
    // authorization loss it is the App's — none of them an effect cleanup.
    const surface = attachHostStudySurface(studyLifecycle)
    // Re-armed on every setup because the cleanup closes it. Left un-armed, the
    // StrictMode probe's cleanup closed this surface permanently and every later
    // Tutor turn was refused by a binding check that nothing had invalidated.
    bindingRef.current = `${context.householdRef}|${context.learnerRef}|${initialEntry.blockRef}`
    const prepare = async (): Promise<StudyCalendarEntry | null> => {
      surface.token.assertCurrent()
      // A stopped session is never relaunched, so no lesson work, no Tutor
      // turn and no calendar transition can happen behind the locked surface.
      if (isSessionStoppedByLocalLedger(stopKey)) return null
      assertCompleteStudyPortBundle(ports)
      /**
       * STUDY-A1-PROD-TUTOR-WRAPPER — F1, closed here.
       *
       * This line used to be `runtime.launch(context, initialEntry, sessionRef)`
       * with no `await`, immediately followed by the calendar transition, the
       * session-launched event and `saveSession`. That was safe only because
       * the preview runtime's `launch` is synchronous. The production contract's
       * is `Promise<void>`, and on that shape the old ordering meant: mark the
       * block begun, write a durable record saying Study started, persist an
       * active session row — and only then discover the Tutor session does not
       * exist. Nothing rolls back, so a girl who never got a Study session had
       * one in her father's record and an active row her next visit resumed into.
       *
       * `settleStudyTutorLaunch` awaits the launch and re-asserts this epoch
       * afterwards, and it returns a witness that `prepareDurableStudySession`
       * requires. The ordering is therefore not a convention two adjacent
       * statements happen to keep: reversing it does not compile.
       *
       * STUDY-A1-PRODUCTION-SAFE-CONTAINER — the seam supplies the launch and
       * nothing else. The await, the epoch re-assertion and the witness are here,
       * on the one path both wrappers render, so neither wrapper can opt out of
       * the ordering by supplying a seam that prepares first.
       */
      const now = studyInstant()
      const settled = await settleStudyTutorLaunch(surface.token, () => tutorSeam.launch({
        context,
        initialEntry,
        entry: initialEntry,
        scope,
        sessionRef,
      }))
      return await prepareDurableStudySession(settled, {
        token: surface.token,
        ports,
        scope,
        learnerScope,
        entry: initialEntry,
        sessionRef,
        now,
      })
    }
    // One preparation per epoch and session, so the replayed setup ADOPTS the
    // first one instead of launching the session, starting the calendar block and
    // appending the launch event a second time. Idempotence, not timing: the key
    // is the identity of the work, so the answer is the same however often React
    // sets this effect up. Deliberately guarded by the EPOCH and not by this
    // surface — the preparation belongs to the session, so a probe's detach must
    // not abandon it with the calendar started and the record unwritten.
    const key = `${surface.token.epoch}|${sessionRef}`
    if (preparationRef.current?.key !== key) preparationRef.current = { key, run: prepare() }
    void preparationRef.current.run.then(
      (prepared) => { if (surface.isAttached() && prepared) setEntry(prepared) },
      () => { if (surface.isAttached()) setError('This Study Session could not start safely. Check the learner, runtime version, and required ports.') },
    ).finally(() => { if (surface.isAttached()) setLoading(false) })
    return () => {
      surface.detach()
      bindingRef.current = 'closed'
    }
  }, [context.householdRef, context.learnerRef, initialEntry.blockRef, ports, tutorSeam, studyLifecycle])

  useEffect(() => { headingRef.current?.focus() }, [loading, error, entry.state, currentSegment?.segmentRef])

  const saveBreak = async () => {
    if (!currentSegment || stopped || sessionAuthorizationLost) return
    const token = lifecycle.token()
    setBusy(true)
    setAnswer('')
    try {
      const at = studyInstant()
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
      const resumed = await runCurrentStudyWork(token, () => (ports as StudyPortBundle).calendar.resume(learnerScope, entry.blockRef, studyInstant()))
      setEntry(resumed)
      setJarvisText('Welcome back. Your exact Study step is ready.')
    } catch {
      if (token.isCurrent()) setError('The exact resume point could not be restored safely.')
    } finally { if (token.isCurrent()) setBusy(false) }
  }

  const completeStep = async () => {
    if (!currentSegment || !answer.trim() || busy || stopped || sessionAuthorizationLost) return
    const token = lifecycle.token()
    setBusy(true)
    setInterruption(null)
    setCheckingTutorSafety(entry.masteryAuthority === 'tutor-core')
    const transient = answer
    setAnswer('')
    try {
      const at = studyInstant()
      let acceptedEventRef: string | null = null
      if (entry.masteryAuthority === 'tutor-core') {
        // STUDY-A1-COMP Phase 9. This used to be built from the session and
        // the segment, so it grew with them and crossed the Tutor bridge's
        // 128-character opaque-id bound on ordinary host lesson references —
        // and a clear turn came back as `bridge-stop-invalid-input`, which the
        // stopped branch below then wrote to the durable ledger as a safety
        // incident. The session and the segment still travel to the bridge as
        // `sessionId` and `segmentId`; only this identifier is now bounded.
        const requestRef = createStudyTurnRequestRef()
        const result = await runCurrentStudyWork(token, () => tutorSeam.submit(
          { context, initialEntry, entry, scope, sessionRef },
          {
            requestRef,
            segmentRef: currentSegment.segmentRef,
            transientLearnerText: transient,
            occurredAt: at,
            isCurrentBinding: () => token.isCurrent() && isCurrentBinding(),
          },
        ))
        // STUDY-A1-AUTH-C — handled before the safety-stop branch, and sharing
        // none of it. Nothing durable is written, no safety event is appended,
        // the lifecycle is not cancelled, and no claim is made about what the
        // learner wrote: the classifier never judged her.
        if (result.status === 'interrupted') {
          setInterruption(result.interruption)
          setJarvisText(interruptionMessage(result.interruption))
          // A shed request means only "try again", so the answer she already
          // typed is put back rather than made her retype it. It stays in this
          // component's state exactly as before and is never persisted. A
          // refused session is not retryable here, so its text stays discarded.
          //
          // STUDY-A1-AUTH-INFRA-BOUNDARY-C — an unreachable authorization
          // verifier is retryable in exactly the same way and for the same
          // reason: the request never reached a verdict, so the next attempt is
          // an ordinary first attempt. The lesson stays live because
          // `sessionAuthorizationLost` below matches only 'session-authorization',
          // and nothing durable was written to stand in the way of the retry.
          if (
            result.interruption.kind === 'rate-limit' ||
            result.interruption.kind === 'authorization-infrastructure'
          ) setAnswer(transient)
          setCheckingTutorSafety(false)
          setBusy(false)
          return
        }
        if (result.status === 'stopped') {
          // STUDY-A1-BRIDGE-STATUS-C — every result reaching here is a safety
          // determination, and that is now the runtime's guarantee rather than
          // this branch's assumption. A structural Tutor bridge failure — an
          // event-ledger collision, a replayed turn, an identifier the bridge
          // refuses — arrives as `quarantined` below and never as a stop, so it
          // writes none of what follows. See runtimeFacade's
          // `classifiedBridgeFailure`.
          //
          // Durable first, before anything that can fail. The lock and the
          // adult-visible record must survive a refresh and must exist even
          // when no server proposal was ever created for this stop.
          //
          // Only 'proposed-not-delivered' proves the safety service answered:
          // a fail-closed client result is always classified 'invalid', which can
          // only ever carry 'not-confirmed'. A non-production port reached no
          // server at all, so it is recorded as such rather than as an answer.
          // The classification is deliberately not recorded — the ledger stores
          // no learner text and nothing about which check fired.
          await recordLocalSessionSafetyStop({
            occurredAt: at,
            studentRef: context.learnerRef,
            sessionRef,
            serverCaptureStatus: ports.safety?.mode !== 'production'
              ? 'server-not-contacted'
              : result.deliveryStatus === 'proposed-not-delivered'
                ? 'server-answered-stop'
                : 'server-acceptance-not-confirmed',
          }).catch(() => null)
          // The local ledger may have waited on a Web Lock. The token above is
          // the authority that classified THIS stop; never reacquire a token
          // here, because a fresh token would name whichever learner/session
          // replaced it while the lock was held.
          token.assertCurrent()
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
            // A stale-authority rejection is different: it ends every remaining
            // effect owned by this completion instead of being permission to
            // continue against the current epoch.
            token.assertCurrent()
          }
          token.assertCurrent()
          setStopped(true)
          setCheckingTutorSafety(false)
          setJarvisText(result.studentMessage)
          setBusy(false)
          lifecycle.cancelIfCurrent(token, 'safety-stop')
          return
        }
        // A structural refusal, carrying no classification, no delivery status
        // and no student message: nothing durable, no safety event, no lock, no
        // safety-stop cancellation. It fails closed into the neutral technical
        // surface below, which offers no way to continue Tutor work.
        if (result.status === 'quarantined') throw new Error('quarantined')
        acceptedEventRef = result.eventRef
        setCheckingTutorSafety(false)
        setJarvisText(result.visibleText)
        setApprovedTranscript((items) => [...items, result.visibleText])
      } else {
        setJarvisText('Activity completion recorded. No mastery decision was made.')
      }
      const next = await runCurrentStudyWork(token, () => (ports as StudyPortBundle).calendar.completeCurrentSegment(
        learnerScope,
        entry.blockRef,
        currentSegment.segmentRef,
        studyInstant(),
      ))
      const status = next.state === 'completed' ? 'completed' : 'active'
      if (status === 'completed') {
        await runCurrentStudyWork(token, () => (ports as StudyPortBundle).eventLedger.append(scope, {
          eventRef: `completion:${sessionRef}:${entry.lessonRef}`,
          occurredAt: studyInstant(),
          type: 'session-completed',
          payload: { blockRef: entry.blockRef, lessonRef: entry.lessonRef },
        }))
      }
      await runCurrentStudyWork(token, () => (ports as StudyPortBundle).persistence.saveSession({
        scope,
        lessonRef: entry.lessonRef,
        segmentRef: currentSegment.segmentRef,
        status,
        updatedAt: studyInstant(),
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
        {interruption ? <p className="mt-3 rounded-xl border border-slate-300 bg-white p-4 font-semibold" role="status" data-study-interrupted={interruption.kind}>{interruptionMessage(interruption)}</p> : null}

        {entry.state === 'paused' ? (
          <section className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
            <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-bold">Water break</h2>
            <p className="mt-2">Your exact place is saved at {entry.resumePoint?.segmentRef}. Take the time you need.</p>
            <button type="button" className="mt-4 rounded-lg bg-cyan-700 px-5 py-3 font-bold text-white" disabled={busy || stopped || sessionAuthorizationLost} onClick={resume}>Return to exact step</button>
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
              <textarea id="study-response" className="mt-2 min-h-28 w-full rounded-lg border border-slate-400 p-3 text-base" value={answer} disabled={busy || stopped || sessionAuthorizationLost} onChange={(event) => setAnswer(event.target.value)} aria-describedby="study-response-help" />
              <p id="study-response-help" className="mt-1 text-sm text-slate-600">This response is transient. It is sent through the safety/Tutor bridge and is not stored in Study evidence.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button type="button" className="rounded-lg bg-cyan-700 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={!answer.trim() || busy || stopped || sessionAuthorizationLost} onClick={completeStep}>Send through Tutor boundary</button>
                <button type="button" className="rounded-lg border border-cyan-700 bg-white px-5 py-3 font-bold text-cyan-800 disabled:opacity-50" disabled={busy || stopped || sessionAuthorizationLost} onClick={saveBreak}>Take a water break</button>
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

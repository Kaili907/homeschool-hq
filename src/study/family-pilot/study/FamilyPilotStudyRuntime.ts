import { calendarDraftForPlan } from '../../calendarAdapter'
import { adaptHostLessonToStudyPlan } from '../../curriculumAdapter'
import {
  runCurrentStudyWork,
  StudyLifecycleAbortError,
  StudyLifecycleBoundary,
  type StudyLifecycleToken,
} from '../../lifecycle'
import { assertCompleteStudyPortBundle, type StudyPortBundle } from '../../ports'
import { AcceptedRc1HostRuntime } from '../../runtimeFacade'
import { isSessionStoppedByLocalLedger, recordLocalSessionSafetyStop } from '../../safety/localStopLedger'
import type {
  CanonicalStudyTaskType,
  HostStudyLaunchContext,
  StudyCalendarEntry,
  StudyCheckpoint,
  StudyLearnerScope,
  StudyScope,
  StudySessionSnapshot,
  StudySubject,
} from '../../types'
import type {
  FamilyPilotAssignment,
  FamilyPilotRejection,
  FamilyPilotStudyActionResult,
  FamilyPilotStudyResult,
  FamilyPilotStudySession,
  FamilyPilotStudySnapshot,
} from './types'

export const FAMILY_PILOT_STUDY_RUNTIME_LABEL =
  'FAMILY PILOT — REUSES THE ACCEPTED RC1 STUDY RUNTIME' as const

/** Same shape the durable ports enforce; drafts are references, never text. */
const OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/

// The Tutor Core bridge accepts only the subjects and task types mapped in
// runtimeFacade. Work outside that set is not a new engine case: the Study
// Engine already models it as completion-only, so the pilot records completion
// instead of forcing a bridge turn that would quarantine.
const BRIDGE_SUBJECTS: readonly StudySubject[] = ['math', 'reading', 'writing']
const BRIDGE_TASKS: readonly CanonicalStudyTaskType[] = [
  'retrieval-practice',
  'direct-instruction',
  'guided-practice',
  'independent-practice',
  'reflection',
  'mastery-check',
  'reading',
  'writing',
]

/** One block yields one session reference on every mount, reload, and process. */
export function familyPilotSessionRef(blockRef: string): string {
  return `${blockRef}:session`
}

export function familyPilotStudySession(
  context: Pick<HostStudyLaunchContext, 'householdRef' | 'learnerRef'>,
  blockRef: string,
): FamilyPilotStudySession {
  return {
    householdRef: context.householdRef,
    learnerRef: context.learnerRef,
    blockRef,
    sessionRef: familyPilotSessionRef(blockRef),
  }
}

export function familyPilotTutorBridgeAvailable(entry: StudyCalendarEntry): boolean {
  return entry.masteryAuthority === 'tutor-core' &&
    BRIDGE_SUBJECTS.includes(entry.subject) &&
    entry.segments.every((segment) => BRIDGE_TASKS.includes(segment.taskType))
}

const REJECTION_MESSAGES: Readonly<Record<FamilyPilotRejection, string>> = {
  'ports-unavailable': 'Study storage is not available on this device yet.',
  'runtime-unsupported': 'This Study runtime version cannot be used here.',
  'household-mismatch': 'That saved Study session belongs to a different household.',
  'student-mismatch': 'That saved Study session belongs to a different student.',
  'session-binding-mismatch': 'That saved Study session no longer matches its assignment.',
  'unknown-assignment': 'That Study assignment is not on this student’s calendar.',
  'assignment-already-complete': 'This Study assignment is already finished.',
  'assignment-not-active': 'Start or resume this Study assignment first.',
  'assignment-not-pausable': 'Only active Study work can take a break.',
  'assignment-not-resumable': 'Only paused Study work can be resumed.',
  'assignment-incomplete': 'This Study assignment still has required work left.',
  'no-active-segment': 'This Study assignment has no remaining step.',
  'response-draft-not-opaque': 'A checkpoint may reference a draft, never its text.',
  'session-stopped': 'This Study session is paused. Please go get an adult.',
  quarantined: 'That Study step could not be accepted. Nothing was recorded.',
  'lifecycle-cancelled': 'This Study session was closed. Open Study again to continue.',
  'study-unavailable': 'Study could not complete that step safely. Nothing was recorded.',
}

function reject(reason: FamilyPilotRejection): { status: 'rejected'; reason: FamilyPilotRejection; message: string } {
  return { status: 'rejected', reason, message: REJECTION_MESSAGES[reason] }
}

function cancellation(error: unknown): boolean {
  return error instanceof StudyLifecycleAbortError ||
    (error instanceof Error && error.name === 'AbortError')
}

export interface FamilyPilotStudySafetyStopSignal {
  readonly studentRef: string
  readonly sessionRef: string
  readonly classification: 'urgent' | 'uncertain' | 'invalid'
  readonly occurredAt: string
}

export interface FamilyPilotStudyRuntimeOptions {
  readonly ports: Partial<StudyPortBundle>
  /** Shared with the host when Study must be cancelled by sign-out or learner switch. */
  readonly lifecycle?: StudyLifecycleBoundary
  readonly now?: () => Date
  /** Injectable only so the durable stop lock can be exercised outside a browser. */
  readonly safetyStopStorage?: Pick<Storage, 'getItem' | 'setItem'>
  /**
   * Purely observational side channel, fired alongside (never instead of) the
   * durable permanent stop write below. It exists so an optional, additive
   * layer (e.g. the Family Pilot safety-hold bridge) can react to the same
   * classification without this runtime knowing that layer exists. It never
   * gates or reverses anything this runtime decides.
   */
  readonly onSafetyStop?: (signal: FamilyPilotStudySafetyStopSignal) => void
}

/**
 * The Family Pilot seam over the accepted RC1 Study runtime. It owns no state
 * machine of its own: every transition is delegated to the existing calendar
 * runtime, Tutor Core bridge, and Study ports, and every durable write goes
 * through the same minimized contracts the commercial wire will use.
 */
export class FamilyPilotStudyRuntime {
  readonly label = FAMILY_PILOT_STUDY_RUNTIME_LABEL
  readonly #ports: Partial<StudyPortBundle>
  readonly #runtime: AcceptedRc1HostRuntime
  readonly #lifecycle: StudyLifecycleBoundary
  readonly #now: () => Date
  readonly #stopStorage: Pick<Storage, 'getItem' | 'setItem'> | undefined
  readonly #onSafetyStop: ((signal: FamilyPilotStudySafetyStopSignal) => void) | undefined
  #turn = 0

  constructor(options: FamilyPilotStudyRuntimeOptions) {
    this.#ports = options.ports
    this.#runtime = new AcceptedRc1HostRuntime(options.ports)
    this.#lifecycle = options.lifecycle ?? new StudyLifecycleBoundary()
    this.#now = options.now ?? (() => new Date())
    this.#stopStorage = options.safetyStopStorage
    this.#onSafetyStop = options.onSafetyStop
  }

  get lifecycle(): StudyLifecycleBoundary {
    return this.#lifecycle
  }

  async startAssignment(input: {
    readonly context: HostStudyLaunchContext
    readonly assignment: FamilyPilotAssignment
  }): Promise<FamilyPilotStudyResult> {
    const ports = this.#ports
    try {
      assertCompleteStudyPortBundle(ports)
    } catch {
      return reject('ports-unavailable')
    }
    const learnerScope: StudyLearnerScope = {
      householdRef: input.context.householdRef,
      learnerRef: input.context.learnerRef,
    }
    try {
      let entry: StudyCalendarEntry
      if (input.assignment.kind === 'calendar-block') {
        entry = input.assignment.entry
      } else {
        const plan = adaptHostLessonToStudyPlan(input.assignment.lesson)
        entry = await ports.calendar.create(learnerScope, calendarDraftForPlan({
          scope: learnerScope,
          plan,
          householdTimeZone: input.context.householdTimeZone,
          instant: this.#now(),
          timerHidden: input.context.timerPreference.visibility === 'hidden',
        }))
      }
      if (entry.learnerRef !== input.context.learnerRef) return reject('student-mismatch')

      const session = familyPilotStudySession(input.context, entry.blockRef)
      if (this.#stopped(session)) return reject('session-stopped')
      const scope: StudyScope = { ...learnerScope, sessionRef: session.sessionRef }
      const token = this.#bind(input.context, session)
      if (entry.state === 'completed') return reject('assignment-already-complete')

      try {
        this.#runtime.launch(this.#lessonContext(input.context, entry), entry, session.sessionRef)
      } catch (error) {
        return cancellation(error) ? reject('lifecycle-cancelled') : reject('runtime-unsupported')
      }

      const at = this.#at()
      if (entry.state === 'scheduled') {
        entry = await runCurrentStudyWork(token, () => ports.calendar.start(learnerScope, entry.blockRef, at))
      }
      const segment = this.#currentSegment(entry)
      if (!segment) return reject('no-active-segment')

      await runCurrentStudyWork(token, () => ports.eventLedger.append(scope, {
        eventRef: `launch:${session.sessionRef}:${segment}`,
        occurredAt: at,
        type: 'session-launched',
        payload: { lessonRef: entry.lessonRef, segmentRef: segment },
      }))
      // A relaunch must never drop the accepted Tutor receipt an already
      // running session earned, because assignment completion is proved by it.
      const persisted = await runCurrentStudyWork(token, () => ports.persistence.loadSession(scope))
      await runCurrentStudyWork(token, () => ports.persistence.saveSession({
        scope,
        lessonRef: entry.lessonRef,
        segmentRef: segment,
        status: entry.state === 'paused' ? 'paused' : 'active',
        updatedAt: at,
        lastAcceptedEventRef: persisted?.lastAcceptedEventRef ?? null,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      }))
      return { status: 'ok', snapshot: await this.#project(token, session, entry) }
    } catch (error) {
      return this.#failure(error)
    }
  }

  /**
   * Re-attaches a reloaded browser to the assignment named by a stored handle
   * and restores its exact position. It performs no transition: a paused
   * assignment stays paused until `resume` is called.
   */
  async resumeAssignment(input: {
    readonly context: HostStudyLaunchContext
    readonly session: FamilyPilotStudySession
  }): Promise<FamilyPilotStudyResult> {
    return this.#read(input, (context, entry, session) => {
      // A stopped session is never relaunched, so no reload can work past it.
      if (this.#stopped(session)) return 'session-stopped'
      try {
        this.#runtime.launch(this.#lessonContext(context, entry), entry, session.sessionRef)
      } catch (error) {
        return cancellation(error) ? 'lifecycle-cancelled' : 'runtime-unsupported'
      }
      return null
    })
  }

  async snapshot(input: {
    readonly context: HostStudyLaunchContext
    readonly session: FamilyPilotStudySession
  }): Promise<FamilyPilotStudyResult> {
    return this.#read(input, () => null)
  }

  async submitStudyAction(input: {
    readonly context: HostStudyLaunchContext
    readonly session: FamilyPilotStudySession
    /** Held for the duration of the turn only. It is never written anywhere. */
    readonly transientLearnerText: string
    readonly expectedAnswer?: string
  }): Promise<FamilyPilotStudyActionResult> {
    const ports = this.#ports
    try {
      assertCompleteStudyPortBundle(ports)
    } catch {
      return reject('ports-unavailable')
    }
    const identity = this.#identityRejection(input.context, input.session)
    if (identity) return reject(identity)
    if (this.#stopped(input.session)) return reject('session-stopped')
    try {
      const token = this.#bind(input.context, input.session)
      const scope: StudyScope = {
        householdRef: input.session.householdRef,
        learnerRef: input.session.learnerRef,
        sessionRef: input.session.sessionRef,
      }
      const entry = await this.#entry(token, input.session)
      if (!entry) return reject('unknown-assignment')
      if (entry.state !== 'active') return reject('assignment-not-active')
      const segmentRef = this.#currentSegment(entry)
      if (!segmentRef) return reject('no-active-segment')

      if (!familyPilotTutorBridgeAvailable(entry)) {
        return {
          status: 'recorded',
          snapshot: await this.#project(token, input.session, entry),
          visibleText: 'Activity completion recorded. No mastery decision was made.',
        }
      }

      const at = this.#at()
      const result = await runCurrentStudyWork(token, () => this.#runtime.submit({
        context: this.#lessonContext(input.context, entry),
        entry,
        scope,
        requestRef: this.#requestRef(at),
        segmentRef,
        transientLearnerText: input.transientLearnerText,
        expectedAnswer: input.expectedAnswer ?? 'ready',
        occurredAt: at,
        isCurrentBinding: () => token.isCurrent(),
      }))

      if (result.status === 'quarantined') return reject('quarantined')
      if (result.status === 'stopped') {
        // Durable first, exactly as the mounted session container does: the
        // stop must survive a reload even when the event append then fails.
        await recordLocalSessionSafetyStop({
          occurredAt: at,
          studentRef: input.session.learnerRef,
          sessionRef: input.session.sessionRef,
          serverCaptureStatus: ports.safety.mode !== 'production'
            ? 'server-not-contacted'
            : result.deliveryStatus === 'proposed-not-delivered'
              ? 'server-answered-stop'
              : 'server-acceptance-not-confirmed',
        }, this.#stopStorage).catch(() => null)
        try {
          this.#onSafetyStop?.({
            studentRef: input.session.learnerRef,
            sessionRef: input.session.sessionRef,
            classification: result.classification,
            occurredAt: at,
          })
        } catch {
          // Observational only. A failing subscriber must never affect the
          // permanent stop above, which has already been written.
        }
        const stoppedSnapshot = await this.#project(token, input.session, entry)
        try {
          await ports.eventLedger.append(scope, {
            eventRef: `stop:${input.session.sessionRef}:${at}`,
            occurredAt: at,
            type: 'safety-stop',
            payload: { reasonCode: result.reasonCode, deliveryStatus: result.deliveryStatus },
          })
        } catch {
          // The stop is already durable; a failed append must not undo it.
        }
        this.#lifecycle.cancel('safety-stop')
        return {
          status: 'stopped',
          snapshot: stoppedSnapshot,
          reasonCode: result.reasonCode,
          studentMessage: result.studentMessage,
        }
      }
      // The accepted turn already wrote the minimized session row, including
      // the accepted event reference that later proves the completion.
      return {
        status: 'accepted',
        snapshot: await this.#project(token, input.session, entry),
        eventRef: result.eventRef,
        directive: result.directive,
        visibleText: result.presentation.visibleText,
      }
    } catch (error) {
      return this.#failure(error)
    }
  }

  async pause(input: {
    readonly context: HostStudyLaunchContext
    readonly session: FamilyPilotStudySession
    readonly category?: 'planned_break' | 'requested_break' | 'outside_interruption' | 'technical_interruption'
  }): Promise<FamilyPilotStudyResult> {
    return this.#write(input, async (ports, token, entry, session) => {
      if (entry.state !== 'active') return reject('assignment-not-pausable')
      const learnerScope: StudyLearnerScope = { householdRef: session.householdRef, learnerRef: session.learnerRef }
      const scope: StudyScope = { ...learnerScope, sessionRef: session.sessionRef }
      const at = this.#at()
      const paused = await runCurrentStudyWork(token, () => ports.calendar.pause(
        learnerScope,
        session.blockRef,
        at,
        input.category ?? 'planned_break',
      ))
      const checkpoint = await this.#saveCheckpoint(token, session, paused, at, null)
      const persisted = await runCurrentStudyWork(token, () => ports.persistence.loadSession(scope))
      await runCurrentStudyWork(token, () => ports.persistence.saveSession({
        scope,
        lessonRef: paused.lessonRef,
        segmentRef: checkpoint.segmentRef,
        status: 'paused',
        updatedAt: at,
        lastAcceptedEventRef: persisted?.lastAcceptedEventRef ?? null,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      }))
      return { status: 'ok', snapshot: await this.#project(token, session, paused) }
    })
  }

  async resume(input: {
    readonly context: HostStudyLaunchContext
    readonly session: FamilyPilotStudySession
  }): Promise<FamilyPilotStudyResult> {
    return this.#write(input, async (ports, token, entry, session) => {
      if (entry.state !== 'paused') return reject('assignment-not-resumable')
      const learnerScope: StudyLearnerScope = { householdRef: session.householdRef, learnerRef: session.learnerRef }
      const scope: StudyScope = { ...learnerScope, sessionRef: session.sessionRef }
      const at = this.#at()
      const resumed = await runCurrentStudyWork(token, () => ports.calendar.resume(learnerScope, session.blockRef, at))
      const segment = this.#currentSegment(resumed)
      if (!segment) return reject('no-active-segment')
      const persisted = await runCurrentStudyWork(token, () => ports.persistence.loadSession(scope))
      await runCurrentStudyWork(token, () => ports.persistence.saveSession({
        scope,
        lessonRef: resumed.lessonRef,
        segmentRef: segment,
        status: 'active',
        updatedAt: at,
        lastAcceptedEventRef: persisted?.lastAcceptedEventRef ?? null,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      }))
      return { status: 'ok', snapshot: await this.#project(token, session, resumed) }
    })
  }

  async checkpoint(input: {
    readonly context: HostStudyLaunchContext
    readonly session: FamilyPilotStudySession
    /** An opaque draft reference. Draft text is never accepted or stored. */
    readonly responseDraftRef?: string | null
  }): Promise<FamilyPilotStudyResult> {
    return this.#write(input, async (_ports, token, entry, session) => {
      const draftRef = input.responseDraftRef ?? null
      if (draftRef !== null && !OPAQUE_REF.test(draftRef)) return reject('response-draft-not-opaque')
      if (!this.#currentSegment(entry)) return reject('no-active-segment')
      await this.#saveCheckpoint(token, session, entry, this.#at(), draftRef)
      return { status: 'ok', snapshot: await this.#project(token, session, entry) }
    })
  }

  async completeSegment(input: {
    readonly context: HostStudyLaunchContext
    readonly session: FamilyPilotStudySession
  }): Promise<FamilyPilotStudyResult> {
    return this.#write(input, async (ports, token, entry, session) => {
      if (entry.state !== 'active') return reject('assignment-not-active')
      const segmentRef = this.#currentSegment(entry)
      if (!segmentRef) return reject('no-active-segment')
      const learnerScope: StudyLearnerScope = { householdRef: session.householdRef, learnerRef: session.learnerRef }
      const scope: StudyScope = { ...learnerScope, sessionRef: session.sessionRef }
      const at = this.#at()
      const next = await runCurrentStudyWork(token, () => ports.calendar.completeCurrentSegment(
        learnerScope,
        session.blockRef,
        segmentRef,
        at,
      ))
      const persisted = await runCurrentStudyWork(token, () => ports.persistence.loadSession(scope))
      // The block reaching 'completed' does not itself complete the session:
      // completeAssignment writes that, and only against an accepted receipt.
      await runCurrentStudyWork(token, () => ports.persistence.saveSession({
        scope,
        lessonRef: next.lessonRef,
        segmentRef: this.#currentSegment(next) ?? segmentRef,
        status: 'active',
        updatedAt: at,
        lastAcceptedEventRef: persisted?.lastAcceptedEventRef ?? null,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      }))
      return { status: 'ok', snapshot: await this.#project(token, session, next) }
    })
  }

  async completeAssignment(input: {
    readonly context: HostStudyLaunchContext
    readonly session: FamilyPilotStudySession
  }): Promise<FamilyPilotStudyResult> {
    return this.#write(input, async (ports, token, entry, session) => {
      if (entry.state !== 'completed') return reject('assignment-incomplete')
      const scope: StudyScope = {
        householdRef: session.householdRef,
        learnerRef: session.learnerRef,
        sessionRef: session.sessionRef,
      }
      const at = this.#at()
      await runCurrentStudyWork(token, () => ports.eventLedger.append(scope, {
        eventRef: `completion:${session.sessionRef}:${entry.lessonRef}`,
        occurredAt: at,
        type: 'session-completed',
        payload: { blockRef: entry.blockRef, lessonRef: entry.lessonRef },
      }))
      const persisted = await runCurrentStudyWork(token, () => ports.persistence.loadSession(scope))
      await runCurrentStudyWork(token, () => ports.persistence.saveSession({
        scope,
        lessonRef: entry.lessonRef,
        segmentRef: entry.segments[entry.segments.length - 1]?.segmentRef ?? entry.lessonRef,
        status: 'completed',
        updatedAt: at,
        lastAcceptedEventRef: persisted?.lastAcceptedEventRef ?? null,
        rawAnswerIncluded: false,
        transcriptIncluded: false,
      }))
      return { status: 'ok', snapshot: await this.#project(token, session, entry) }
    })
  }

  /**
   * A safety stop is durable: it must still hold after a reload, in a new tab,
   * and in a freshly constructed runtime, so it is read before any transition.
   */
  #stopped(session: FamilyPilotStudySession): boolean {
    return isSessionStoppedByLocalLedger(
      { studentRef: session.learnerRef, sessionRef: session.sessionRef },
      this.#stopStorage,
    )
  }

  /**
   * CalendarRuntime requires every active-work interval to resolve to an
   * exact whole number of seconds, but the host clock is millisecond-precise.
   * Rounding every instant this runtime hands to the calendar port UP to the
   * next whole second (never down, so an instant never lands before the
   * block's own creation timestamp) keeps the delta between any two rounded
   * instants an exact integer, and equal instants are accepted by the
   * calendar's chronological check.
   */
  #at(): string {
    const ms = this.#now().getTime()
    return new Date(Math.ceil(ms / 1000) * 1000).toISOString()
  }

  /**
   * The bridge treats the request reference as the accepted event id and
   * rejects anything over 128 characters, so it is kept short and bounded
   * rather than composed from the session and segment references. The instant
   * plus a per-process turn counter keeps it unique inside one session.
   */
  #requestRef(at: string): string {
    this.#turn += 1
    return `request:${Date.parse(at)}:${this.#turn}`
  }

  #lessonContext(context: HostStudyLaunchContext, entry: StudyCalendarEntry): HostStudyLaunchContext {
    return { ...context, subject: entry.subject, lessonRef: entry.lessonRef, skillRefs: entry.skillRefs }
  }

  #currentSegment(entry: StudyCalendarEntry): string | null {
    return entry.segments.find((segment) => !entry.completedSegmentRefs.includes(segment.segmentRef))?.segmentRef ?? null
  }

  /**
   * A stored handle is untrusted input. A session captured for one student is
   * never allowed to open under another student, or under another household,
   * and a handle whose session reference was edited is refused outright.
   */
  #identityRejection(
    context: HostStudyLaunchContext,
    session: FamilyPilotStudySession,
  ): FamilyPilotRejection | null {
    if (session.householdRef !== context.householdRef) return 'household-mismatch'
    if (session.learnerRef !== context.learnerRef) return 'student-mismatch'
    if (session.sessionRef !== familyPilotSessionRef(session.blockRef)) return 'session-binding-mismatch'
    return null
  }

  #bind(context: HostStudyLaunchContext, session: FamilyPilotStudySession): StudyLifecycleToken {
    // Rebinding to a different learner cancels the previous epoch, so any work
    // still in flight for the previous student aborts instead of landing.
    return this.#lifecycle.beginEpoch({
      authenticatedSessionRef: `family-pilot:auth:${context.householdRef}:${context.learnerRef}`,
      householdRef: context.householdRef,
      learnerRef: context.learnerRef,
      launchGrantRef: session.sessionRef,
      featureEnabled: true,
      authorizationRevision: 1,
    })
  }

  async #entry(token: StudyLifecycleToken, session: FamilyPilotStudySession): Promise<StudyCalendarEntry | null> {
    const ports = this.#ports as StudyPortBundle
    const entries = await runCurrentStudyWork(token, () => ports.calendar.list({
      householdRef: session.householdRef,
      learnerRef: session.learnerRef,
    }))
    return entries.find((candidate) => candidate.blockRef === session.blockRef) ?? null
  }

  async #saveCheckpoint(
    token: StudyLifecycleToken,
    session: FamilyPilotStudySession,
    entry: StudyCalendarEntry,
    at: string,
    responseDraftRef: string | null,
  ): Promise<StudyCheckpoint> {
    const ports = this.#ports as StudyPortBundle
    const scope: StudyScope = {
      householdRef: session.householdRef,
      learnerRef: session.learnerRef,
      sessionRef: session.sessionRef,
    }
    const previous = await runCurrentStudyWork(token, () => ports.checkpoint.loadLatest(scope))
    const segmentRef = entry.resumePoint?.segmentRef ?? this.#currentSegment(entry) ?? entry.lessonRef
    const revision = (previous?.revision ?? 0) + 1
    const checkpoint: StudyCheckpoint = {
      checkpointRef: `${session.sessionRef}:checkpoint:${revision}`,
      householdRef: session.householdRef,
      learnerRef: session.learnerRef,
      sessionRef: session.sessionRef,
      lessonRef: entry.lessonRef,
      segmentRef,
      revision,
      capturedAt: at,
      completedSegmentRefs: entry.resumePoint?.completedSegmentRefs ?? entry.completedSegmentRefs,
      elapsedActiveSecondsInSegment: entry.resumePoint?.elapsedActiveSecondsInSegment ??
        (previous?.segmentRef === segmentRef ? previous.elapsedActiveSecondsInSegment : 0),
      responseDraftRef,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }
    await runCurrentStudyWork(token, () => ports.checkpoint.save(checkpoint))
    await runCurrentStudyWork(token, () => ports.eventLedger.append(scope, {
      eventRef: `checkpoint:${session.sessionRef}:${revision}`,
      occurredAt: at,
      type: 'checkpoint-saved',
      payload: { checkpointRef: checkpoint.checkpointRef, revision },
    }))
    return checkpoint
  }

  async #project(
    token: StudyLifecycleToken,
    session: FamilyPilotStudySession,
    entry: StudyCalendarEntry,
  ): Promise<FamilyPilotStudySnapshot> {
    const ports = this.#ports as StudyPortBundle
    const scope: StudyScope = {
      householdRef: session.householdRef,
      learnerRef: session.learnerRef,
      sessionRef: session.sessionRef,
    }
    const checkpoint = await runCurrentStudyWork(token, () => ports.checkpoint.loadLatest(scope))
    const persisted: StudySessionSnapshot | null =
      await runCurrentStudyWork(token, () => ports.persistence.loadSession(scope))
    // Exact position, in falling order of authority: the calendar runtime's own
    // resume point, then the last durable checkpoint, then the first step that
    // is still outstanding.
    const outstanding = this.#currentSegment(entry)
    const segmentRef = entry.resumePoint?.segmentRef ??
      (checkpoint && checkpoint.segmentRef === outstanding ? checkpoint.segmentRef : outstanding)
    const ordinal = segmentRef
      ? entry.segments.findIndex((segment) => segment.segmentRef === segmentRef) + 1
      : 0
    return {
      session,
      lessonRef: entry.lessonRef,
      title: entry.title,
      assignmentState: entry.state,
      sessionStatus: persisted?.status ?? null,
      segmentRef,
      segmentOrdinal: ordinal > 0 ? ordinal : null,
      completedSegmentRefs: entry.resumePoint?.completedSegmentRefs ?? entry.completedSegmentRefs,
      remainingSegmentRefs: entry.segments
        .filter((segment) => !entry.completedSegmentRefs.includes(segment.segmentRef))
        .map((segment) => segment.segmentRef),
      elapsedActiveSecondsInSegment: entry.resumePoint?.elapsedActiveSecondsInSegment ??
        (checkpoint && checkpoint.segmentRef === segmentRef ? checkpoint.elapsedActiveSecondsInSegment : 0),
      checkpointRef: checkpoint?.checkpointRef ?? null,
      checkpointRevision: checkpoint?.revision ?? 0,
      lastAcceptedEventRef: persisted?.lastAcceptedEventRef ?? null,
      masteryAuthority: entry.masteryAuthority,
      tutorBridgeAvailable: familyPilotTutorBridgeAvailable(entry),
      requiredWorkCompletionPercent: entry.requiredWorkCompletionPercent,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }
  }

  async #read(
    input: { readonly context: HostStudyLaunchContext; readonly session: FamilyPilotStudySession },
    prepare: (
      context: HostStudyLaunchContext,
      entry: StudyCalendarEntry,
      session: FamilyPilotStudySession,
    ) => FamilyPilotRejection | null,
  ): Promise<FamilyPilotStudyResult> {
    try {
      assertCompleteStudyPortBundle(this.#ports)
    } catch {
      return reject('ports-unavailable')
    }
    const identity = this.#identityRejection(input.context, input.session)
    if (identity) return reject(identity)
    try {
      const token = this.#bind(input.context, input.session)
      const entry = await this.#entry(token, input.session)
      if (!entry) return reject('unknown-assignment')
      const rejection = prepare(input.context, entry, input.session)
      if (rejection) return reject(rejection)
      return { status: 'ok', snapshot: await this.#project(token, input.session, entry) }
    } catch (error) {
      return this.#failure(error)
    }
  }

  async #write(
    input: { readonly context: HostStudyLaunchContext; readonly session: FamilyPilotStudySession },
    apply: (
      ports: StudyPortBundle,
      token: StudyLifecycleToken,
      entry: StudyCalendarEntry,
      session: FamilyPilotStudySession,
    ) => Promise<FamilyPilotStudyResult>,
  ): Promise<FamilyPilotStudyResult> {
    const ports = this.#ports
    try {
      assertCompleteStudyPortBundle(ports)
    } catch {
      return reject('ports-unavailable')
    }
    const identity = this.#identityRejection(input.context, input.session)
    if (identity) return reject(identity)
    if (this.#stopped(input.session)) return reject('session-stopped')
    try {
      const token = this.#bind(input.context, input.session)
      const entry = await this.#entry(token, input.session)
      if (!entry) return reject('unknown-assignment')
      return await apply(ports, token, entry, input.session)
    } catch (error) {
      return this.#failure(error)
    }
  }

  #failure(error: unknown): { status: 'rejected'; reason: FamilyPilotRejection; message: string } {
    return cancellation(error) ? reject('lifecycle-cancelled') : reject('study-unavailable')
  }
}

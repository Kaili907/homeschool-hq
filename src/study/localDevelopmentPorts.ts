import {
  calendarBlockView,
  completeCurrentSegment as acceptedCompleteCurrentSegment,
  createAutomaticContinuation,
  createCalendarBlock,
  interruptCalendarBlock,
  resumeCalendarBlock,
  startCalendarBlock,
  type CalendarBlock,
} from '../../adaptive-tutor/study-engine/runtime/src/calendar.ts'
import type {
  StudyAdultAuthorization,
  StudyCalendarDraft,
  StudyCalendarEntry,
  StudyCheckpoint,
  StudyLearnerPreferences,
  StudyLearnerScope,
  StudyOutboxProposal,
  StudyParentPublicCommand,
  StudyParentSettings,
  StudyReviewRecommendation,
  StudySafeEvent,
  StudySafetyRequest,
  StudySafetyResult,
  StudyScope,
  StudySessionSnapshot,
} from './types'
import type { StudyPortBundle } from './ports'
import { DEFAULT_STUDY_ACCESSIBILITY } from './hostContext'
import { assertAcceptedParentControl } from './acceptedParentAdapter'

export const LOCAL_DEVELOPMENT_ONLY_NOT_DURABLE = 'LOCAL DEVELOPMENT ONLY — NOT DURABLE' as const

const FORBIDDEN_PUBLIC_KEY = /^(?:rawanswer|rawresponse|transientlearnertext|transcript|transcripttext|captionshistory|adultprivatenotebody|providerapikey|accesstoken|answertext|responsetext)$/i
const SENSITIVE_PUBLIC_TEXT = /\b(?:raw[-_ ]?answer|transcript|bearer\s+[a-z0-9._~-]+|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token)\b/i
const SAFE_OPAQUE_REF = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/
const EVENT_ALLOWED_KEYS: Readonly<Record<StudySafeEvent['type'], readonly string[]>> = {
  'session-launched': ['lessonRef', 'segmentRef'],
  'tutor-directive': ['bridgeEventVersion', 'eventLedgerIdempotencyKey'],
  'checkpoint-saved': ['checkpointRef', 'revision'],
  'session-completed': ['blockRef', 'lessonRef'],
  'safety-stop': ['reasonCode', 'deliveryStatus'],
  'parent-control': ['controlType', 'result'],
}

function assertSafePublicValue(value: unknown, path = 'value'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertSafePublicValue(entry, `${path}[${index}]`))
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase()
      if (FORBIDDEN_PUBLIC_KEY.test(normalizedKey) && entry !== false && entry !== null) {
        throw new Error(`Sensitive Study field rejected at ${path}.${key}.`)
      }
      assertSafePublicValue(entry, `${path}.${key}`)
    }
  }
}

const clone = <T,>(value: T): T => structuredClone(value)
const learnerKey = (scope: StudyLearnerScope) => `${scope.householdRef}|${scope.learnerRef}`
const sessionKey = (scope: StudyScope) => `${learnerKey(scope)}|${scope.sessionRef}`

function defaultPreferences(): StudyLearnerPreferences {
  return {
    accessibility: DEFAULT_STUDY_ACCESSIBILITY,
    timerPreference: { visibility: 'shown', milestonesOnly: false },
  }
}

function defaultParentSettings(): StudyParentSettings {
  return {
    maximumWorkMinutes: 30,
    breakMinutes: 5,
    timerHidden: false,
    accommodations: [],
    recommendationDecisions: [],
    interruptions: [],
    reschedules: [],
    adultReviewRequests: [],
    revision: 0,
  }
}

function toCalendarEntry(block: CalendarBlock, planByBlock: Map<string, StudyCalendarDraft['plan']>): StudyCalendarEntry {
  const plan = planByBlock.get(block.internalBlockId) ?? planByBlock.get(block.lineage.rootInternalBlockId)
  if (!plan) throw new Error('Calendar plan metadata is unavailable.')
  const view = calendarBlockView(block)
  const source = block.sourceIdentity.source === 'parent'
    ? 'parent'
    : block.sourceIdentity.source === 'romeo_virtual_academy'
      ? 'romeo-virtual-academy'
      : 'manuel-academy'
  return {
    blockRef: block.internalBlockId,
    externalItemRef: block.sourceIdentity.externalItemId,
    learnerRef: block.learnerRef,
    title: block.title,
    lessonRef: plan.lessonRef,
    subject: plan.subject,
    skillRefs: [...plan.skillRefs],
    source,
    masteryAuthority: plan.masteryAuthority,
    blockKind: block.blockType,
    scheduledStart: block.scheduledStartInstant,
    intendedLocalDate: block.intendedLocalDate,
    householdTimeZone: block.householdTimeZone,
    timerVisibility: block.timerVisibility,
    state: block.state,
    segments: block.segments.map((segment) => ({
      segmentRef: segment.segmentId,
      title: segment.title,
      taskType: segment.canonicalTaskType,
      ...(segment.customTaskTypeId ? { customTaskTypeId: segment.customTaskTypeId } : {}),
      estimatedMinutes: segment.estimatedMinutes,
      required: segment.required,
    })),
    completedSegmentRefs: block.segments.filter((segment) => !!segment.completedAt).map((segment) => segment.segmentId),
    ...(block.resumePoint
      ? {
          resumePoint: {
            segmentRef: block.resumePoint.segmentId,
            segmentOrdinal: block.resumePoint.segmentOrdinal,
            elapsedActiveSecondsInSegment: block.resumePoint.elapsedActiveSecondsInSegment,
            completedSegmentRefs: [...block.resumePoint.completedSegmentIds],
            remainingSegmentRefs: [...block.resumePoint.remainingSegmentIds],
            capturedAt: block.resumePoint.capturedAt,
          },
        }
      : {}),
    requiredWorkCompletionPercent: view.requiredWorkCompletionPercent,
    estimatedRemainingMinutes: view.estimatedRemainingMinutes,
    ...(block.lineage.continuationOf ? { continuationOf: block.lineage.continuationOf } : {}),
  }
}

export class LocalDevelopmentStudyServices {
  readonly label = LOCAL_DEVELOPMENT_ONLY_NOT_DURABLE
  readonly #learnerHouseholds = new Map<string, string>()
  readonly #sessionBindings = new Map<string, string>()
  readonly #sessions = new Map<string, StudySessionSnapshot>()
  readonly #preferences = new Map<string, StudyLearnerPreferences>()
  readonly #checkpoints = new Map<string, StudyCheckpoint>()
  readonly #reviews = new Map<string, StudyReviewRecommendation>()
  readonly #reviewSemantics = new Map<string, string>()
  readonly #calendar = new Map<string, CalendarBlock>()
  readonly #planByBlock = new Map<string, StudyCalendarDraft['plan']>()
  readonly #parent = new Map<string, StudyParentSettings>()
  readonly #privateNotes = new Map<string, { category: string; body: string }>()
  readonly #events = new Map<string, string>()
  readonly #eventSemantics = new Map<string, string>()
  readonly #outbox = new Map<string, StudyOutboxProposal>()
  readonly mode = 'local-development' as const
  readonly classifierVersion = 'session12-local-forced-outcome-v1'
  readonly #forcedSafetyOutcome: StudySafetyResult['outcome']
  readonly #now: () => Date

  constructor(options: {
    readonly forcedSafetyOutcome?: StudySafetyResult['outcome']
    /** Testable clock; local preview defaults to the real wall clock. */
    readonly now?: () => Date
  } = {}) {
    this.#forcedSafetyOutcome = options.forcedSafetyOutcome ?? 'clear'
    this.#now = options.now ?? (() => new Date())
  }

  #bindLearner(scope: StudyLearnerScope): void {
    if (!scope.householdRef || !scope.learnerRef) throw new Error('Authenticated household and learner references are required.')
    const previous = this.#learnerHouseholds.get(scope.learnerRef)
    if (previous && previous !== scope.householdRef) throw new Error('Cross-household learner reference rejected.')
    this.#learnerHouseholds.set(scope.learnerRef, scope.householdRef)
  }

  #bindSession(scope: StudyScope): void {
    this.#bindLearner(scope)
    if (!scope.sessionRef) throw new Error('sessionRef is required.')
    const binding = learnerKey(scope)
    const previous = this.#sessionBindings.get(scope.sessionRef)
    if (previous && previous !== binding) throw new Error('Cross-learner session or checkpoint rejected.')
    this.#sessionBindings.set(scope.sessionRef, binding)
  }

  async loadSession(scope: StudyScope) {
    this.#bindSession(scope)
    return clone(this.#sessions.get(sessionKey(scope)) ?? null)
  }

  async saveSession(snapshot: StudySessionSnapshot) {
    this.#bindSession(snapshot.scope)
    assertSafePublicValue(snapshot)
    if (snapshot.status === 'completed') {
      const completedBlock = [...this.#calendar.values()].find(
        (block) => block.learnerRef === snapshot.scope.learnerRef && block.state === 'completed' &&
          this.#planByBlock.get(block.internalBlockId)?.lessonRef === snapshot.lessonRef,
      )
      if (!completedBlock) throw new Error('Forged completion rejected: canonical calendar work is incomplete.')
      const authority = this.#planByBlock.get(completedBlock.internalBlockId)?.masteryAuthority
      if (
        authority !== 'completion-only' &&
        (!snapshot.lastAcceptedEventRef || !this.#events.has(`${sessionKey(snapshot.scope)}|${snapshot.lastAcceptedEventRef}`))
      ) throw new Error('Forged completion rejected: an accepted Tutor event is required.')
    }
    this.#sessions.set(sessionKey(snapshot.scope), clone(snapshot))
  }

  async loadPreferences(scope: StudyLearnerScope) {
    this.#bindLearner(scope)
    return clone(this.#preferences.get(learnerKey(scope)) ?? defaultPreferences())
  }

  async savePreferences(scope: StudyLearnerScope, preferences: StudyLearnerPreferences) {
    this.#bindLearner(scope)
    assertSafePublicValue(preferences)
    this.#preferences.set(learnerKey(scope), clone(preferences))
  }

  async loadLatest(scope: StudyScope) {
    this.#bindSession(scope)
    return clone(this.#checkpoints.get(sessionKey(scope)) ?? null)
  }

  async save(checkpoint: StudyCheckpoint) {
    const scope = {
      householdRef: checkpoint.householdRef,
      learnerRef: checkpoint.learnerRef,
      sessionRef: checkpoint.sessionRef,
    }
    this.#bindSession(scope)
    assertSafePublicValue(checkpoint)
    if (!SAFE_OPAQUE_REF.test(checkpoint.checkpointRef) || !SAFE_OPAQUE_REF.test(checkpoint.segmentRef)) {
      throw new Error('Checkpoint references must be opaque identifiers.')
    }
    if (checkpoint.responseDraftRef && !SAFE_OPAQUE_REF.test(checkpoint.responseDraftRef)) {
      throw new Error('Checkpoint responseDraftRef must be an opaque reference, never draft text.')
    }
    const key = sessionKey(scope)
    const previous = this.#checkpoints.get(key)
    if (previous && checkpoint.revision < previous.revision) throw new Error('Stale checkpoint rejected.')
    if (previous && JSON.stringify(previous) === JSON.stringify(checkpoint)) return 'duplicate-ignored' as const
    if (previous && checkpoint.revision === previous.revision) throw new Error('Checkpoint revision collision rejected.')
    this.#checkpoints.set(key, clone(checkpoint))
    return 'saved' as const
  }

  async listReviews(scope: StudyLearnerScope): Promise<readonly StudyReviewRecommendation[]> {
    this.#bindLearner(scope)
    return [...this.#reviews.values()].filter((review) => review.householdRef === scope.householdRef && review.learnerRef === scope.learnerRef).map(clone)
  }

  async enqueue(recommendation: StudyReviewRecommendation) {
    this.#bindLearner(recommendation)
    assertSafePublicValue(recommendation)
    if (recommendation.reasonCodes.some((code) => !/^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(code))) {
      throw new Error('Review reason codes must be opaque codes, not learner text.')
    }
    const semanticKey = [
      recommendation.householdRef,
      recommendation.learnerRef,
      recommendation.sourceEvidenceRef,
      recommendation.lessonRef,
      recommendation.dueDate,
    ].join('|')
    const semanticPrevious = this.#reviewSemantics.get(semanticKey)
    if (semanticPrevious && semanticPrevious !== recommendation.recommendationRef) return 'duplicate-ignored' as const
    const previous = this.#reviews.get(recommendation.recommendationRef)
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(recommendation)) throw new Error('Duplicate review identity collision rejected.')
      return 'duplicate-ignored' as const
    }
    this.#reviews.set(recommendation.recommendationRef, clone(recommendation))
    this.#reviewSemantics.set(semanticKey, recommendation.recommendationRef)
    return 'enqueued' as const
  }

  async decide(scope: StudyLearnerScope, recommendationRef: string, decision: 'accepted' | 'rejected') {
    this.#bindLearner(scope)
    const review = this.#reviews.get(recommendationRef)
    if (!review || review.householdRef !== scope.householdRef || review.learnerRef !== scope.learnerRef) {
      throw new Error('Unknown learner-scoped review recommendation.')
    }
    this.#reviews.set(recommendationRef, { ...review, status: decision })
  }

  async listBlocks(scope: StudyLearnerScope): Promise<readonly StudyCalendarEntry[]> {
    this.#bindLearner(scope)
    return [...this.#calendar.values()]
      .filter((block) => block.learnerRef === scope.learnerRef)
      .map((block) => toCalendarEntry(block, this.#planByBlock))
  }

  async create(scope: StudyLearnerScope, draft: StudyCalendarDraft) {
    this.#bindLearner(scope)
    const previous = this.#calendar.get(draft.blockRef)
    if (previous) {
      if (previous.learnerRef !== scope.learnerRef || previous.sourceIdentity.externalItemId !== draft.externalItemRef) {
        throw new Error('Calendar block identity collision rejected.')
      }
      return toCalendarEntry(previous, this.#planByBlock)
    }
    const source = draft.plan.source === 'parent'
      ? 'parent'
      : draft.plan.source === 'romeo-virtual-academy'
        ? 'romeo_virtual_academy'
        : 'manuel_academy'
    const block = createCalendarBlock({
      internalBlockId: draft.blockRef,
      learnerRef: scope.learnerRef,
      sourceIdentity: { source, externalItemId: draft.externalItemRef },
      title: draft.plan.title,
      subject: draft.plan.subject,
      blockType: draft.blockKind,
      householdTimeZone: draft.householdTimeZone,
      scheduledLocalStart: draft.scheduledLocalStart,
      scheduledStart: draft.scheduledStart,
      intendedLocalDate: draft.intendedLocalDate,
      segments: draft.plan.segments.map((segment) => ({
        segmentId: segment.segmentRef,
        title: segment.title,
        estimatedMinutes: segment.estimatedMinutes,
        canonicalTaskType: segment.taskType,
        ...(segment.customTaskTypeId ? { customTaskTypeId: segment.customTaskTypeId } : {}),
        required: segment.required,
      })),
      createdAt: this.#now().toISOString(),
      timerVisibility: draft.timerVisibility,
    })
    this.#calendar.set(block.internalBlockId, block)
    this.#planByBlock.set(block.internalBlockId, clone(draft.plan))
    return toCalendarEntry(block, this.#planByBlock)
  }

  #ownedBlock(scope: StudyLearnerScope, blockRef: string): CalendarBlock {
    this.#bindLearner(scope)
    const block = this.#calendar.get(blockRef)
    if (!block || block.learnerRef !== scope.learnerRef) throw new Error('Unknown learner-scoped calendar block.')
    return block
  }

  async start(scope: StudyLearnerScope, blockRef: string, at: string) {
    const current = this.#ownedBlock(scope, blockRef)
    if (current.state === 'active') return toCalendarEntry(current, this.#planByBlock)
    const next = startCalendarBlock(current, at, 'student')
    this.#calendar.set(blockRef, next)
    return toCalendarEntry(next, this.#planByBlock)
  }

  async pause(
    scope: StudyLearnerScope,
    blockRef: string,
    at: string,
    category: 'planned_break' | 'requested_break' | 'outside_interruption' | 'technical_interruption',
  ) {
    const current = this.#ownedBlock(scope, blockRef)
    if (current.state === 'paused') return toCalendarEntry(current, this.#planByBlock)
    const next = interruptCalendarBlock(current, { at, actor: 'student', category })
    this.#calendar.set(blockRef, next)
    return toCalendarEntry(next, this.#planByBlock)
  }

  async resume(scope: StudyLearnerScope, blockRef: string, at: string) {
    const current = this.#ownedBlock(scope, blockRef)
    if (current.state === 'active') return toCalendarEntry(current, this.#planByBlock)
    const next = resumeCalendarBlock(current, at, 'student')
    this.#calendar.set(blockRef, next)
    return toCalendarEntry(next, this.#planByBlock)
  }

  async completeCurrentSegment(scope: StudyLearnerScope, blockRef: string, segmentRef: string, at: string) {
    const current = this.#ownedBlock(scope, blockRef)
    const completed = current.segments.find((segment) => segment.segmentId === segmentRef)?.completedAt
    if (completed) return toCalendarEntry(current, this.#planByBlock)
    const next = acceptedCompleteCurrentSegment(current, { segmentId: segmentRef, at, actor: 'student' })
    this.#calendar.set(blockRef, next)
    return toCalendarEntry(next, this.#planByBlock)
  }

  async createContinuation(
    scope: StudyLearnerScope,
    blockRef: string,
    continuationRef: string,
    continuationKey: string,
    scheduledLocalStart: string,
    scheduledStart: string,
    intendedLocalDate: string,
    at: string,
  ) {
    this.#ownedBlock(scope, blockRef)
    const ownedBlocks = [...this.#calendar.values()].filter((block) => block.learnerRef === scope.learnerRef)
    const result = createAutomaticContinuation(ownedBlocks, {
      originalInternalBlockId: blockRef,
      continuationInternalBlockId: continuationRef,
      continuationKey,
      scheduledLocalStart,
      scheduledStart,
      intendedLocalDate,
      at,
    })
    result.blocks.forEach((block) => this.#calendar.set(block.internalBlockId, block))
    const rootPlan = this.#planByBlock.get(blockRef)
    if (rootPlan) this.#planByBlock.set(result.continuation.internalBlockId, rootPlan)
    return { entry: toCalendarEntry(result.continuation, this.#planByBlock), created: result.created }
  }

  async read(scope: StudyLearnerScope) {
    this.#bindLearner(scope)
    return clone(this.#parent.get(learnerKey(scope)) ?? defaultParentSettings())
  }

  #assertAdult(scope: StudyLearnerScope, authorization: StudyAdultAuthorization): void {
    if (
      !authorization.adultAuthorized ||
      authorization.householdRef !== scope.householdRef ||
      (authorization.role !== 'parent' && authorization.role !== 'teacher') ||
      !authorization.actorRef
    ) throw new Error('Verified adult authorization is required.')
  }

  async apply(
    scope: StudyLearnerScope,
    authorization: StudyAdultAuthorization,
    command: StudyParentPublicCommand,
    expectedRevision: number,
  ) {
    this.#bindLearner(scope)
    this.#assertAdult(scope, authorization)
    const current = this.#parent.get(learnerKey(scope)) ?? defaultParentSettings()
    if (current.revision !== expectedRevision) throw new Error('Stale parent-control revision rejected.')
    const calendarEntry = 'blockRef' in command
      ? [...this.#calendar.values()]
          .filter((block) => block.learnerRef === scope.learnerRef)
          .map((block) => toCalendarEntry(block, this.#planByBlock))
          .find((entry) => entry.blockRef === command.blockRef)
      : undefined
    assertAcceptedParentControl({
      scope,
      authorization,
      command,
      settings: current,
      now: this.#now(),
      ...(calendarEntry ? { calendarEntry } : {}),
    })
    let next: StudyParentSettings = current
    if (command.type === 'set-maximum-duration') {
      if (!Number.isInteger(command.minutes) || command.minutes < 1 || command.minutes > 240) throw new Error('Maximum duration must be 1–240 minutes.')
      next = { ...current, maximumWorkMinutes: command.minutes }
    } else if (command.type === 'set-break-duration') {
      if (!Number.isInteger(command.minutes) || command.minutes < 1 || command.minutes > 120) throw new Error('Break duration must be 1–120 minutes.')
      next = { ...current, breakMinutes: command.minutes }
    } else if (command.type === 'hide-timer') {
      next = { ...current, timerHidden: command.hidden }
    } else if (command.type === 'add-accommodation') {
      if (
        !command.accommodation.functionalDescription.trim() ||
        /diagnos|disorder|adhd|autis/i.test(command.accommodation.functionalDescription) ||
        SENSITIVE_PUBLIC_TEXT.test(command.accommodation.functionalDescription) ||
        SENSITIVE_PUBLIC_TEXT.test(command.accommodation.studentMessage)
      ) {
        throw new Error('Accommodation must use functional, non-diagnostic language.')
      }
      const duplicate = current.accommodations.find((item) => item.accommodationRef === command.accommodation.accommodationRef)
      if (duplicate) return { status: 'duplicate-ignored' as const, revision: current.revision }
      next = { ...current, accommodations: [...current.accommodations, clone(command.accommodation)] }
    } else if (command.type === 'accept-recommendation' || command.type === 'reject-recommendation') {
      const decision = command.type === 'accept-recommendation' ? 'accepted' : 'rejected'
      const duplicate = current.recommendationDecisions.find((item) => item.recommendationRef === command.recommendationRef)
      if (duplicate) return { status: 'duplicate-ignored' as const, revision: current.revision }
      next = {
        ...current,
        recommendationDecisions: [
          ...current.recommendationDecisions,
          { recommendationRef: command.recommendationRef, decision, reasonCode: `parent-${decision}` },
        ],
      }
    } else if (command.type === 'reschedule-incomplete-work') {
      if (!Number.isFinite(Date.parse(command.replacementStart))) throw new Error('Replacement start must be an offset timestamp.')
      next = { ...current, reschedules: [...current.reschedules, { blockRef: command.blockRef, replacementStart: command.replacementStart }] }
    } else if (command.type === 'mark-interruption') {
      next = {
        ...current,
        interruptions: [...current.interruptions, { blockRef: command.blockRef, kind: command.kind, at: command.occurredAt }],
      }
    } else if (command.type === 'request-adult-review') {
      next = {
        ...current,
        adultReviewRequests: [
          ...current.adultReviewRequests,
          {
            requestRef: command.requestRef,
            audience: command.audience,
            status: 'local-only-not-delivered',
            reason: 'Parent requested an adult review.',
          },
        ],
      }
    }
    next = { ...next, revision: current.revision + 1 }
    assertSafePublicValue(next)
    this.#parent.set(learnerKey(scope), clone(next))
    return {
      status: 'applied' as const,
      revision: next.revision,
      ...(command.type === 'request-adult-review' ? { deliveryStatus: 'local-only-not-delivered' as const } : {}),
    }
  }

  async commit(
    scope: StudyLearnerScope,
    authorization: StudyAdultAuthorization,
    note: { readonly noteRef: string; readonly category: string; readonly body: string },
  ) {
    this.#bindLearner(scope)
    this.#assertAdult(scope, authorization)
    if (!note.noteRef || !note.body.trim()) throw new Error('Private note reference and body are required.')
    const key = `${learnerKey(scope)}|${note.noteRef}`
    const previous = this.#privateNotes.get(key)
    if (previous && previous.body !== note.body) throw new Error('Private note identity collision rejected.')
    this.#privateNotes.set(key, { category: note.category, body: note.body })
    return { status: 'authorized-and-committed' as const }
  }

  async append(scope: StudyScope, event: StudySafeEvent) {
    this.#bindSession(scope)
    assertSafePublicValue(event)
    const allowed = EVENT_ALLOWED_KEYS[event.type]
    const unexpected = Object.keys(event.payload).filter((key) => !allowed.includes(key))
    if (unexpected.length > 0) throw new Error('Study event payload contains a non-allowlisted field.')
    if (Object.values(event.payload).some((value) => typeof value === 'string' && SENSITIVE_PUBLIC_TEXT.test(value))) {
      throw new Error('Study event payload text failed privacy minimization.')
    }
    const key = `${sessionKey(scope)}|${event.eventRef}`
    const serialized = JSON.stringify(event)
    const semanticIdentity = event.type === 'session-completed'
      ? `${event.type}|${String(event.payload.blockRef)}|${String(event.payload.lessonRef)}`
      : event.type === 'tutor-directive'
        ? `${event.type}|${String(event.payload.eventLedgerIdempotencyKey)}`
        : `${event.type}|${event.eventRef}`
    const semanticKey = `${sessionKey(scope)}|${semanticIdentity}`
    const semanticPrevious = this.#eventSemantics.get(semanticKey)
    if (semanticPrevious && semanticPrevious !== event.eventRef) return 'duplicate-ignored' as const
    const previous = this.#events.get(key)
    if (previous === serialized) return 'duplicate-ignored' as const
    if (previous) return 'idempotency-collision' as const
    this.#events.set(key, serialized)
    this.#eventSemantics.set(semanticKey, event.eventRef)
    return 'appended' as const
  }

  async propose(scope: StudyLearnerScope, proposal: StudyOutboxProposal) {
    this.#bindLearner(scope)
    assertSafePublicValue(proposal)
    const key = `${learnerKey(scope)}|${proposal.proposalRef}`
    const previous = this.#outbox.get(key)
    if (previous && JSON.stringify(previous) !== JSON.stringify(proposal)) throw new Error('Outbox proposal identity collision rejected.')
    this.#outbox.set(key, clone(proposal))
    return 'proposed-not-delivered' as const
  }

  evaluate(_request: StudySafetyRequest): StudySafetyResult {
    const outcome = this.#forcedSafetyOutcome
    return {
      outcome,
      mayContinue: outcome === 'clear',
      adultHelpState: outcome === 'clear' ? 'not-needed' : 'not-confirmed',
    }
  }

  /** Parent-authorized test hook; never returned through an ordinary Study projection. */
  testOnlyPrivateNoteMatches(scope: StudyLearnerScope, noteRef: string, body: string): boolean {
    return this.#privateNotes.get(`${learnerKey(scope)}|${noteRef}`)?.body === body
  }

  inspectPublicStateForTest(): unknown {
    return {
      sessions: [...this.#sessions.values()],
      checkpoints: [...this.#checkpoints.values()],
      reviews: [...this.#reviews.values()],
      calendar: [...this.#calendar.values()].map((block) => toCalendarEntry(block, this.#planByBlock)),
      parent: [...this.#parent.values()],
      events: [...this.#events.values()].map((value) => JSON.parse(value)),
      outbox: [...this.#outbox.values()],
    }
  }
}

export function createLocalDevelopmentStudyPorts(
  options: {
    readonly forcedSafetyOutcome?: StudySafetyResult['outcome']
    readonly now?: () => Date
  } = {},
): { readonly ports: StudyPortBundle; readonly services: LocalDevelopmentStudyServices } {
  const services = new LocalDevelopmentStudyServices(options)
  const ports: StudyPortBundle = {
    persistence: services,
    checkpoint: services,
    reviewQueue: {
      list: (scope) => services.listReviews(scope),
      enqueue: (recommendation) => services.enqueue(recommendation),
      decide: (scope, recommendationRef, decision) => services.decide(scope, recommendationRef, decision),
    },
    calendar: {
      list: (scope) => services.listBlocks(scope),
      create: (scope, draft) => services.create(scope, draft),
      start: (scope, blockRef, at) => services.start(scope, blockRef, at),
      pause: (scope, blockRef, at, category) => services.pause(scope, blockRef, at, category),
      resume: (scope, blockRef, at) => services.resume(scope, blockRef, at),
      completeCurrentSegment: (scope, blockRef, segmentRef, at) => services.completeCurrentSegment(scope, blockRef, segmentRef, at),
      createContinuation: (scope, blockRef, continuationRef, continuationKey, scheduledLocalStart, scheduledStart, intendedLocalDate, at) =>
        services.createContinuation(scope, blockRef, continuationRef, continuationKey, scheduledLocalStart, scheduledStart, intendedLocalDate, at),
    },
    parentSettings: services,
    adultPrivate: services,
    eventLedger: services,
    outbox: services,
    safety: services,
  }
  return { ports, services }
}

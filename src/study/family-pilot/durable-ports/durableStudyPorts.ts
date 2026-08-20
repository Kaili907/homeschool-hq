// FAMILY-PILOT-DURABLE-PORTS: a browser-durable StudyPortBundle.
//
// This exists to remove one deployment blocker and nothing else. The accepted
// Family Pilot surface can only run against createLocalDevelopmentStudyPorts,
// which holds every record in memory and is therefore DEV-gated. This module
// implements the same nine StudyPortBundle roles against device storage, so a
// deployed personal-family pilot can close the tab and come back to the same
// step.
//
// What it is NOT:
//
//   • Not a second Study Engine. Every calendar transition is delegated to the
//     accepted calendar runtime and the block it returns is stored verbatim.
//   • Not a copy of the local-development provider. Nothing here imports it,
//     and no forced-outcome safety classifier is recreated: the safety port is
//     required from the caller so that the Family Pilot Safety work owns that
//     decision, in this build and in every later one.
//   • Not wired into the app. Composition is a later convergence's job.
//
// Acceptance rules are copied from the accepted provider rather than reinvented.
// Two differences are worth stating exactly, rather than claiming blanket parity:
//
//   • The accepted provider's `#bindLearner` rule — a learner reference seen
//     under a second household is rejected — is enforced here, but structurally:
//     the storage key is the learner, and a document naming another household is
//     refused on read ('household-binding-mismatch').
//   • Its `#bindSession` rule — one session reference reused across learners — is
//     NOT reproduced. Session records live inside the learner's own document, so
//     the reuse is unobservable rather than rejected, and the Study runtime's own
//     `session-binding-mismatch` guard is the check that still fires.
//
// Everything a caller can write is additionally parsed back before it lands, so
// the write side can never accept a record the read side would refuse.

import {
  calendarBlockView,
  completeCurrentSegment as acceptedCompleteCurrentSegment,
  createAutomaticContinuation,
  createCalendarBlock,
  interruptCalendarBlock,
  resumeCalendarBlock,
  startCalendarBlock,
  type CalendarBlock,
} from '../../../../adaptive-tutor/study-engine/runtime/src/calendar.ts'
import { assertAcceptedParentControl } from '../../acceptedParentAdapter'
import { DEFAULT_STUDY_ACCESSIBILITY } from '../../hostContext'
import type { StudyPortBundle, StudySafetyPort } from '../../ports'
import type {
  StudyAdultAuthorization,
  StudyCalendarDraft,
  StudyCalendarEntry,
  StudyCheckpoint,
  StudyLearnerPreferences,
  StudyLearnerScope,
  StudyLessonPlan,
  StudyOutboxProposal,
  StudyParentControlResult,
  StudyParentPublicCommand,
  StudyParentSettings,
  StudyReviewRecommendation,
  StudySafeEvent,
  StudyScope,
  StudySessionSnapshot,
} from '../../types'
import { OPAQUE_REF, SENSITIVE_PERSISTED_TEXT, assertMinimizedEvent } from './minimization'
import type { DurableCalendarRecordV1, DurableStudyDocumentV1 } from './schema'
import {
  loadDurableStudyDocument,
  resetDurableStudyDocument,
  saveDurableStudyDocument,
  type FamilyPilotDurableStoreReasonCode,
  type FamilyPilotDurableStoreStatus,
  type StorageLike,
} from './store'

export const FAMILY_PILOT_DURABLE_STUDY_PORTS_LABEL =
  'FAMILY PILOT — BROWSER-DURABLE STUDY PORTS' as const

/**
 * Every refusal that comes from persistence rather than from Study itself. The
 * Family Pilot runtime maps a thrown error to 'study-unavailable', whose message
 * to the student is "Nothing was recorded" — which is exactly true here.
 */
export class FamilyPilotDurableStudyStorageError extends Error {
  readonly reasonCode: FamilyPilotDurableStoreReasonCode

  constructor(reasonCode: FamilyPilotDurableStoreReasonCode, message: string) {
    super(message)
    this.name = 'FamilyPilotDurableStudyStorageError'
    this.reasonCode = reasonCode
  }
}

export interface FamilyPilotDurableStudyPortsOptions {
  /**
   * Required. This bundle deliberately ships no safety classifier of its own:
   * the accepted local provider's forced-clear classifier is a development
   * artefact and must not reappear in anything deployable. The Family Pilot
   * Safety Hold module supplies this seam.
   */
  readonly safety: StudySafetyPort
  /** Injectable only so durability can be exercised outside a browser. */
  readonly storage?: StorageLike
  readonly now?: () => Date
}

export interface FamilyPilotDurableStudyPortsHealth {
  readonly status: FamilyPilotDurableStoreStatus
  readonly reasonCode: FamilyPilotDurableStoreReasonCode | null
  readonly durable: boolean
  /** A write to this device failed earlier and has not succeeded since. */
  readonly previousWriteFailed: boolean
  /**
   * Always false, and surfaced rather than left implicit. The StudyAdultPrivate
   * contract's only success value is 'authorized-and-committed', so an adult who
   * writes a private note is told it committed — but this store deliberately
   * never writes the body to the device, and the note is gone on reload. A
   * parent surface has to be able to say so.
   */
  readonly adultPrivateNotesDurable: false
}

const STORAGE_REFUSAL_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
  'schema-version-ahead': 'Stored Study work was written by a newer version of this app. Nothing was changed.',
  'calendar-schema-ahead': 'Stored Study work was written by a newer version of this app. Nothing was changed.',
  'household-binding-mismatch': 'That saved Study work belongs to a different household. Nothing was changed.',
  'storage-read-failed': 'Saved Study work could not be read from this device. Nothing was changed.',
})

interface LoadedDocument {
  readonly document: DurableStudyDocumentV1
  readonly raw: string | null
}

const clone = <T,>(value: T): T => structuredClone(value)

function learnerScope(scope: StudyLearnerScope): StudyLearnerScope {
  return { householdRef: scope.householdRef, learnerRef: scope.learnerRef }
}

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

function planFor(records: readonly DurableCalendarRecordV1[], block: CalendarBlock): StudyLessonPlan {
  const own = records.find((record) => record.block.internalBlockId === block.internalBlockId)
  const root = records.find((record) => record.block.internalBlockId === block.lineage.rootInternalBlockId)
  const plan = own?.plan ?? root?.plan
  if (!plan) throw new Error('Calendar plan metadata is unavailable.')
  return plan
}

/** The accepted projection, unchanged: a calendar block becomes a Study entry. */
function toCalendarEntry(block: CalendarBlock, plan: StudyLessonPlan): StudyCalendarEntry {
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

function semanticEventIdentity(event: StudySafeEvent): string {
  if (event.type === 'session-completed') {
    return `${event.type}|${String(event.payload.blockRef)}|${String(event.payload.lessonRef)}`
  }
  if (event.type === 'tutor-directive') {
    return `${event.type}|${String(event.payload.eventLedgerIdempotencyKey)}`
  }
  return `${event.type}|${event.eventRef}`
}

/**
 * The nine roles, each reading and writing one student's durable document.
 *
 * There is no in-memory cache of that document. Every call reads storage and
 * every mutation writes it back, which is what makes a brand-new bundle over the
 * same storage indistinguishable from the one that wrote the work.
 */
export class FamilyPilotDurableStudyServices {
  readonly label = FAMILY_PILOT_DURABLE_STUDY_PORTS_LABEL
  readonly #storage: StorageLike | undefined
  readonly #now: () => Date
  readonly #safety: StudySafetyPort
  /**
   * Adult private notes are held for this process only and are never written to
   * the device. The contract asks for an authorized commit and never for a read
   * back, and `adultPrivateNoteBody` is on the list of fields that may not reach
   * browser storage at all — so the honest implementation accepts the note,
   * enforces its identity rule for as long as the page lives, and persists
   * nothing. A household that needs durable adult notes needs the server.
   */
  readonly #privateNotes = new Map<string, string>()

  constructor(options: FamilyPilotDurableStudyPortsOptions) {
    if (!options.safety) throw new Error('A Study safety port is required; this bundle ships no classifier.')
    this.#storage = options.storage
    this.#now = options.now ?? (() => new Date())
    this.#safety = options.safety
  }

  get safety(): StudySafetyPort {
    return this.#safety
  }

  /** What the parent surface shows when Study refuses: readable, and honest about durability. */
  health(scope: StudyLearnerScope): FamilyPilotDurableStudyPortsHealth {
    this.#assertScope(scope)
    const snapshot = loadDurableStudyDocument(learnerScope(scope), this.#options())
    return Object.freeze({
      status: snapshot.status,
      reasonCode: snapshot.reasonCode,
      durable: snapshot.status === 'ready',
      previousWriteFailed: snapshot.previousWriteFailed,
      adultPrivateNotesDurable: false,
    })
  }

  /** The household's explicit "start this student over"; the only discarding operation. */
  reset(scope: StudyLearnerScope): FamilyPilotDurableStudyPortsHealth {
    this.#assertScope(scope)
    const snapshot = resetDurableStudyDocument(learnerScope(scope), this.#options())
    return Object.freeze({
      status: snapshot.status,
      reasonCode: snapshot.reasonCode,
      durable: snapshot.status === 'ready',
      previousWriteFailed: snapshot.previousWriteFailed,
      adultPrivateNotesDurable: false,
    })
  }

  /** No operation, not even a diagnostic, runs without an explicit student. */
  #assertScope(scope: StudyLearnerScope): void {
    if (!scope.householdRef || !scope.learnerRef) {
      throw new Error('Authenticated household and learner references are required.')
    }
  }

  #options(): { storage?: StorageLike; now: () => string } {
    return this.#storage
      ? { storage: this.#storage, now: () => this.#now().toISOString() }
      : { now: () => this.#now().toISOString() }
  }

  /**
   * Loads one student's document, refusing rather than substituting when the
   * stored state cannot be trusted. A quarantined document must never present as
   * an empty one: an empty document would restart finished work and would let a
   * stopped session look resumable.
   */
  #load(scope: StudyLearnerScope): LoadedDocument {
    this.#assertScope(scope)
    const snapshot = loadDurableStudyDocument(learnerScope(scope), this.#options())
    if (snapshot.status === 'quarantined') {
      throw new FamilyPilotDurableStudyStorageError(
        snapshot.reasonCode ?? 'schema-unreadable',
        'Stored Study work could not be read and has been kept for recovery. Study is paused for this student.',
      )
    }
    if (snapshot.status === 'read-only') {
      const reasonCode = snapshot.reasonCode ?? 'schema-version-ahead'
      throw new FamilyPilotDurableStudyStorageError(
        reasonCode,
        STORAGE_REFUSAL_MESSAGES[reasonCode] ??
          'Stored Study work could not be used by this version of the app. Nothing was changed.',
      )
    }
    return { document: snapshot.document, raw: snapshot.raw }
  }

  #commit(scope: StudyLearnerScope, loaded: LoadedDocument, next: Partial<DurableStudyDocumentV1>): void {
    const document: DurableStudyDocumentV1 = {
      ...loaded.document,
      ...next,
      updatedAt: this.#now().toISOString(),
    }
    const written = saveDurableStudyDocument(learnerScope(scope), document, {
      ...this.#options(),
      expectedRaw: loaded.raw,
    })
    if (written.reasonCode === 'storage-write-failed') {
      throw new FamilyPilotDurableStudyStorageError(
        'storage-write-failed',
        'Study work could not be saved to this device. Nothing was recorded.',
      )
    }
    if (written.reasonCode === 'write-rejected-unreadable') {
      throw new FamilyPilotDurableStudyStorageError(
        'write-rejected-unreadable',
        'That Study step produced a record this app could not read back, so it was not saved. Nothing was recorded.',
      )
    }
    if (written.reasonCode === 'concurrent-write') {
      throw new FamilyPilotDurableStudyStorageError(
        'concurrent-write',
        'This student’s Study work changed in another tab. Nothing was recorded here.',
      )
    }
  }

  #sessionScope(scope: StudyScope): StudyScope {
    if (!scope.sessionRef) throw new Error('sessionRef is required.')
    return scope
  }

  // ---------------------------------------------------------------- persistence

  async loadSession(scope: StudyScope): Promise<StudySessionSnapshot | null> {
    this.#sessionScope(scope)
    const { document } = this.#load(scope)
    return clone(document.sessions.find((session) => session.scope.sessionRef === scope.sessionRef) ?? null)
  }

  async saveSession(snapshot: StudySessionSnapshot): Promise<void> {
    this.#sessionScope(snapshot.scope)
    const loaded = this.#load(snapshot.scope)
    if (snapshot.status === 'completed') {
      // The accepted forgery rule, unchanged: completion is only writable once
      // the canonical calendar work is complete, and — unless the work is
      // completion-only — once a Tutor event has actually been accepted.
      const completed = loaded.document.calendar.find(
        (record) => record.block.state === 'completed' && record.plan.lessonRef === snapshot.lessonRef,
      )
      if (!completed) throw new Error('Forged completion rejected: canonical calendar work is incomplete.')
      if (
        completed.plan.masteryAuthority !== 'completion-only' &&
        (!snapshot.lastAcceptedEventRef ||
          !loaded.document.events.some((record) =>
            record.sessionRef === snapshot.scope.sessionRef && record.eventRef === snapshot.lastAcceptedEventRef))
      ) throw new Error('Forged completion rejected: an accepted Tutor event is required.')
    }
    const sessions = loaded.document.sessions.filter((held) => held.scope.sessionRef !== snapshot.scope.sessionRef)
    this.#commit(snapshot.scope, loaded, { sessions: [...sessions, clone(snapshot)] })
  }

  async loadPreferences(scope: StudyLearnerScope): Promise<StudyLearnerPreferences> {
    const { document } = this.#load(scope)
    return clone(document.preferences ?? defaultPreferences())
  }

  async savePreferences(scope: StudyLearnerScope, preferences: StudyLearnerPreferences): Promise<void> {
    const loaded = this.#load(scope)
    this.#commit(scope, loaded, { preferences: clone(preferences) })
  }

  // ----------------------------------------------------------------- checkpoint

  async loadLatest(scope: StudyScope): Promise<StudyCheckpoint | null> {
    this.#sessionScope(scope)
    const { document } = this.#load(scope)
    return clone(document.checkpoints.find((checkpoint) => checkpoint.sessionRef === scope.sessionRef) ?? null)
  }

  async save(checkpoint: StudyCheckpoint): Promise<'saved' | 'duplicate-ignored'> {
    const scope: StudyScope = {
      householdRef: checkpoint.householdRef,
      learnerRef: checkpoint.learnerRef,
      sessionRef: checkpoint.sessionRef,
    }
    this.#sessionScope(scope)
    if (!OPAQUE_REF.test(checkpoint.checkpointRef) || !OPAQUE_REF.test(checkpoint.segmentRef)) {
      throw new Error('Checkpoint references must be opaque identifiers.')
    }
    if (checkpoint.responseDraftRef && !OPAQUE_REF.test(checkpoint.responseDraftRef)) {
      throw new Error('Checkpoint responseDraftRef must be an opaque reference, never draft text.')
    }
    const loaded = this.#load(scope)
    const previous = loaded.document.checkpoints.find((held) => held.sessionRef === checkpoint.sessionRef)
    if (previous && checkpoint.revision < previous.revision) throw new Error('Stale checkpoint rejected.')
    if (previous && JSON.stringify(previous) === JSON.stringify(checkpoint)) return 'duplicate-ignored'
    if (previous && checkpoint.revision === previous.revision) throw new Error('Checkpoint revision collision rejected.')
    const checkpoints = loaded.document.checkpoints.filter((held) => held.sessionRef !== checkpoint.sessionRef)
    this.#commit(scope, loaded, { checkpoints: [...checkpoints, clone(checkpoint)] })
    return 'saved'
  }

  // ---------------------------------------------------------------- reviewQueue

  async listReviews(scope: StudyLearnerScope): Promise<readonly StudyReviewRecommendation[]> {
    const { document } = this.#load(scope)
    return document.reviews.map(clone)
  }

  async enqueue(recommendation: StudyReviewRecommendation): Promise<'enqueued' | 'duplicate-ignored'> {
    if (recommendation.reasonCodes.some((code) => !/^[a-z0-9][a-z0-9._:-]{0,127}$/i.test(code))) {
      throw new Error('Review reason codes must be opaque codes, not learner text.')
    }
    const loaded = this.#load(recommendation)
    const semanticKey = [
      recommendation.sourceEvidenceRef,
      recommendation.lessonRef,
      recommendation.dueDate,
    ].join('|')
    const semanticPrevious = loaded.document.reviews.find((held) =>
      [held.sourceEvidenceRef, held.lessonRef, held.dueDate].join('|') === semanticKey)
    if (semanticPrevious && semanticPrevious.recommendationRef !== recommendation.recommendationRef) {
      return 'duplicate-ignored'
    }
    const previous = loaded.document.reviews.find((held) => held.recommendationRef === recommendation.recommendationRef)
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(recommendation)) {
        throw new Error('Duplicate review identity collision rejected.')
      }
      return 'duplicate-ignored'
    }
    this.#commit(recommendation, loaded, { reviews: [...loaded.document.reviews, clone(recommendation)] })
    return 'enqueued'
  }

  async decide(scope: StudyLearnerScope, recommendationRef: string, decision: 'accepted' | 'rejected'): Promise<void> {
    const loaded = this.#load(scope)
    const review = loaded.document.reviews.find((held) => held.recommendationRef === recommendationRef)
    if (!review) throw new Error('Unknown learner-scoped review recommendation.')
    this.#commit(scope, loaded, {
      reviews: loaded.document.reviews.map((held) =>
        held.recommendationRef === recommendationRef ? { ...held, status: decision } : held),
    })
  }

  // ------------------------------------------------------------------- calendar

  async listBlocks(scope: StudyLearnerScope): Promise<readonly StudyCalendarEntry[]> {
    const { document } = this.#load(scope)
    return document.calendar.map((record) => toCalendarEntry(record.block, planFor(document.calendar, record.block)))
  }

  async create(scope: StudyLearnerScope, draft: StudyCalendarDraft): Promise<StudyCalendarEntry> {
    const loaded = this.#load(scope)
    const previous = loaded.document.calendar.find((record) => record.block.internalBlockId === draft.blockRef)
    if (previous) {
      if (previous.block.sourceIdentity.externalItemId !== draft.externalItemRef) {
        throw new Error('Calendar block identity collision rejected.')
      }
      return toCalendarEntry(previous.block, previous.plan)
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
    const record: DurableCalendarRecordV1 = { block, plan: clone(draft.plan) }
    this.#commit(scope, loaded, { calendar: [...loaded.document.calendar, record] })
    return toCalendarEntry(block, record.plan)
  }

  #ownedRecord(document: DurableStudyDocumentV1, blockRef: string): DurableCalendarRecordV1 {
    const record = document.calendar.find((held) => held.block.internalBlockId === blockRef)
    if (!record) throw new Error('Unknown learner-scoped calendar block.')
    return record
  }

  /** Every transition is the accepted calendar runtime's; this only stores the result. */
  #transition(
    scope: StudyLearnerScope,
    blockRef: string,
    advance: (block: CalendarBlock) => CalendarBlock | null,
  ): StudyCalendarEntry {
    const loaded = this.#load(scope)
    const record = this.#ownedRecord(loaded.document, blockRef)
    const next = advance(record.block)
    if (!next) return toCalendarEntry(record.block, record.plan)
    this.#commit(scope, loaded, {
      calendar: loaded.document.calendar.map((held) =>
        held.block.internalBlockId === blockRef ? { block: next, plan: held.plan } : held),
    })
    return toCalendarEntry(next, record.plan)
  }

  async start(scope: StudyLearnerScope, blockRef: string, at: string): Promise<StudyCalendarEntry> {
    return this.#transition(scope, blockRef, (block) =>
      block.state === 'active' ? null : startCalendarBlock(block, at, 'student'))
  }

  async pause(
    scope: StudyLearnerScope,
    blockRef: string,
    at: string,
    category: 'planned_break' | 'requested_break' | 'outside_interruption' | 'technical_interruption',
  ): Promise<StudyCalendarEntry> {
    return this.#transition(scope, blockRef, (block) =>
      block.state === 'paused' ? null : interruptCalendarBlock(block, { at, actor: 'student', category }))
  }

  async resume(scope: StudyLearnerScope, blockRef: string, at: string): Promise<StudyCalendarEntry> {
    return this.#transition(scope, blockRef, (block) =>
      block.state === 'active' ? null : resumeCalendarBlock(block, at, 'student'))
  }

  async completeCurrentSegment(
    scope: StudyLearnerScope,
    blockRef: string,
    segmentRef: string,
    at: string,
  ): Promise<StudyCalendarEntry> {
    return this.#transition(scope, blockRef, (block) =>
      block.segments.find((segment) => segment.segmentId === segmentRef)?.completedAt
        ? null
        : acceptedCompleteCurrentSegment(block, { segmentId: segmentRef, at, actor: 'student' }))
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
  ): Promise<{ readonly entry: StudyCalendarEntry; readonly created: boolean }> {
    const loaded = this.#load(scope)
    const root = this.#ownedRecord(loaded.document, blockRef)
    const result = createAutomaticContinuation(loaded.document.calendar.map((held) => held.block), {
      originalInternalBlockId: blockRef,
      continuationInternalBlockId: continuationRef,
      continuationKey,
      scheduledLocalStart,
      scheduledStart,
      intendedLocalDate,
      at,
    })
    const byId = new Map(result.blocks.map((block) => [block.internalBlockId, block]))
    const calendar: DurableCalendarRecordV1[] = loaded.document.calendar.map((held) => {
      const updated = byId.get(held.block.internalBlockId)
      byId.delete(held.block.internalBlockId)
      return updated ? { block: updated, plan: held.plan } : held
    })
    // A continuation is a new occurrence of the same plan, so it inherits it.
    for (const block of byId.values()) calendar.push({ block, plan: root.plan })
    this.#commit(scope, loaded, { calendar })
    return { entry: toCalendarEntry(result.continuation, root.plan), created: result.created }
  }

  // ------------------------------------------------------------- parentSettings

  async read(scope: StudyLearnerScope): Promise<StudyParentSettings> {
    const { document } = this.#load(scope)
    return clone(document.parentSettings ?? defaultParentSettings())
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
  ): Promise<StudyParentControlResult> {
    this.#assertAdult(scope, authorization)
    const loaded = this.#load(scope)
    const current = loaded.document.parentSettings ?? defaultParentSettings()
    if (current.revision !== expectedRevision) throw new Error('Stale parent-control revision rejected.')
    const calendarEntry = 'blockRef' in command
      ? loaded.document.calendar
          .map((record) => toCalendarEntry(record.block, record.plan))
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
      if (!Number.isInteger(command.minutes) || command.minutes < 1 || command.minutes > 240) {
        throw new Error('Maximum duration must be 1–240 minutes.')
      }
      next = { ...current, maximumWorkMinutes: command.minutes }
    } else if (command.type === 'set-break-duration') {
      if (!Number.isInteger(command.minutes) || command.minutes < 1 || command.minutes > 120) {
        throw new Error('Break duration must be 1–120 minutes.')
      }
      next = { ...current, breakMinutes: command.minutes }
    } else if (command.type === 'hide-timer') {
      next = { ...current, timerHidden: command.hidden }
    } else if (command.type === 'add-accommodation') {
      if (
        !command.accommodation.functionalDescription.trim() ||
        /diagnos|disorder|adhd|autis/i.test(command.accommodation.functionalDescription) ||
        SENSITIVE_PERSISTED_TEXT.test(command.accommodation.functionalDescription) ||
        SENSITIVE_PERSISTED_TEXT.test(command.accommodation.studentMessage)
      ) {
        throw new Error('Accommodation must use functional, non-diagnostic language.')
      }
      const duplicate = current.accommodations.find(
        (item) => item.accommodationRef === command.accommodation.accommodationRef,
      )
      if (duplicate) return { status: 'duplicate-ignored', revision: current.revision }
      next = { ...current, accommodations: [...current.accommodations, clone(command.accommodation)] }
    } else if (command.type === 'accept-recommendation' || command.type === 'reject-recommendation') {
      const decision = command.type === 'accept-recommendation' ? 'accepted' : 'rejected'
      const duplicate = current.recommendationDecisions.find(
        (item) => item.recommendationRef === command.recommendationRef,
      )
      if (duplicate) return { status: 'duplicate-ignored', revision: current.revision }
      next = {
        ...current,
        recommendationDecisions: [
          ...current.recommendationDecisions,
          { recommendationRef: command.recommendationRef, decision, reasonCode: `parent-${decision}` },
        ],
      }
    } else if (command.type === 'reschedule-incomplete-work') {
      if (!Number.isFinite(Date.parse(command.replacementStart))) {
        throw new Error('Replacement start must be an offset timestamp.')
      }
      next = {
        ...current,
        reschedules: [...current.reschedules, { blockRef: command.blockRef, replacementStart: command.replacementStart }],
      }
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
    this.#commit(scope, loaded, { parentSettings: clone(next) })
    return {
      status: 'applied',
      revision: next.revision,
      ...(command.type === 'request-adult-review' ? { deliveryStatus: 'local-only-not-delivered' as const } : {}),
    }
  }

  // -------------------------------------------------------------- adultPrivate

  async commit(
    scope: StudyLearnerScope,
    authorization: StudyAdultAuthorization,
    note: { readonly noteRef: string; readonly category: string; readonly body: string },
  ): Promise<{ readonly status: 'authorized-and-committed' }> {
    this.#assertAdult(scope, authorization)
    if (!note.noteRef || !note.body.trim()) throw new Error('Private note reference and body are required.')
    // Authorization is still proved against durable state, so a corrupt or
    // future-schema document refuses the note rather than accepting it blind.
    this.#load(scope)
    const key = `${scope.householdRef}|${scope.learnerRef}|${note.noteRef}`
    const previous = this.#privateNotes.get(key)
    if (previous !== undefined && previous !== note.body) throw new Error('Private note identity collision rejected.')
    this.#privateNotes.set(key, note.body)
    return { status: 'authorized-and-committed' }
  }

  /** Parent-authorized test hook; never returned through an ordinary Study projection. */
  testOnlyPrivateNoteMatches(scope: StudyLearnerScope, noteRef: string, body: string): boolean {
    return this.#privateNotes.get(`${scope.householdRef}|${scope.learnerRef}|${noteRef}`) === body
  }

  // --------------------------------------------------------------- eventLedger

  async append(
    scope: StudyScope,
    event: StudySafeEvent,
  ): Promise<'appended' | 'duplicate-ignored' | 'idempotency-collision'> {
    this.#sessionScope(scope)
    assertMinimizedEvent(event)
    const loaded = this.#load(scope)
    const semanticKey = `${scope.sessionRef}|${semanticEventIdentity(event)}`
    const semanticPrevious = loaded.document.events.find((record) => record.semanticKey === semanticKey)
    if (semanticPrevious && semanticPrevious.eventRef !== event.eventRef) return 'duplicate-ignored'
    const previous = loaded.document.events.find(
      (record) => record.sessionRef === scope.sessionRef && record.eventRef === event.eventRef,
    )
    if (previous) {
      return JSON.stringify(previous.event) === JSON.stringify(event) ? 'duplicate-ignored' : 'idempotency-collision'
    }
    this.#commit(scope, loaded, {
      events: [
        ...loaded.document.events,
        { sessionRef: scope.sessionRef, eventRef: event.eventRef, semanticKey, event: clone(event) },
      ],
    })
    return 'appended'
  }

  // -------------------------------------------------------------------- outbox

  async propose(scope: StudyLearnerScope, proposal: StudyOutboxProposal): Promise<'proposed-not-delivered'> {
    const loaded = this.#load(scope)
    const previous = loaded.document.outbox.find((held) => held.proposalRef === proposal.proposalRef)
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(proposal)) {
        throw new Error('Outbox proposal identity collision rejected.')
      }
      return 'proposed-not-delivered'
    }
    this.#commit(scope, loaded, { outbox: [...loaded.document.outbox, clone(proposal)] })
    return 'proposed-not-delivered'
  }
}

/**
 * The composition seam. `safety` has no default on purpose: whoever wires this
 * bundle must state which classifier a real family is running against, and the
 * Family Pilot Safety Hold module is what supplies it.
 */
export function createFamilyPilotDurableStudyPorts(
  options: FamilyPilotDurableStudyPortsOptions,
): { readonly ports: StudyPortBundle; readonly services: FamilyPilotDurableStudyServices } {
  const services = new FamilyPilotDurableStudyServices(options)
  const ports: StudyPortBundle = {
    persistence: {
      loadSession: (scope) => services.loadSession(scope),
      saveSession: (snapshot) => services.saveSession(snapshot),
      loadPreferences: (scope) => services.loadPreferences(scope),
      savePreferences: (scope, preferences) => services.savePreferences(scope, preferences),
    },
    checkpoint: {
      loadLatest: (scope) => services.loadLatest(scope),
      save: (checkpoint) => services.save(checkpoint),
    },
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
      completeCurrentSegment: (scope, blockRef, segmentRef, at) =>
        services.completeCurrentSegment(scope, blockRef, segmentRef, at),
      createContinuation: (
        scope, blockRef, continuationRef, continuationKey, scheduledLocalStart, scheduledStart, intendedLocalDate, at,
      ) => services.createContinuation(
        scope, blockRef, continuationRef, continuationKey, scheduledLocalStart, scheduledStart, intendedLocalDate, at,
      ),
    },
    parentSettings: {
      read: (scope) => services.read(scope),
      apply: (scope, authorization, command, expectedRevision) =>
        services.apply(scope, authorization, command, expectedRevision),
    },
    adultPrivate: {
      commit: (scope, authorization, note) => services.commit(scope, authorization, note),
    },
    eventLedger: {
      append: (scope, event) => services.append(scope, event),
    },
    outbox: {
      propose: (scope, proposal) => services.propose(scope, proposal),
    },
    safety: options.safety,
  }
  return { ports: Object.freeze(ports), services }
}

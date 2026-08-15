// FAMILY-PILOT-DURABLE-PORTS: the on-device Study authority document.
//
// This is not a second Study Engine and not a second Family Pilot store. It is
// the durable backing for the nine roles in StudyPortBundle, so that a Family
// Pilot household can close the tab and come back to the exact step it left.
//
// Two things separate it from src/study/family-pilot/core/schema.ts, which is
// the pilot's own convenience projection:
//
//   • Calendar blocks are persisted VERBATIM as the Study Engine wrote them,
//     including the engine's own `schemaVersion`. This store validates that the
//     version is the one it was built against and otherwise refuses the whole
//     document. It never re-derives segment progression, resume points, or
//     completion from the block's fields — that authority stays in the engine.
//   • A record that fails to parse makes the WHOLE document unreadable rather
//     than being dropped. core/schema.ts can drop one bad assignment because it
//     is a projection; here a dropped calendar block would silently restart a
//     student's finished work, and a dropped session record would silently
//     unblock a session that was stopped. Fail closed, keep the evidence, tell
//     the household.

import type { CalendarBlock } from '../../../../adaptive-tutor/study-engine/runtime/src/calendar.ts'
import type {
  StudyCheckpoint,
  StudyLearnerPreferences,
  StudyLearnerScope,
  StudyLessonPlan,
  StudyOutboxProposal,
  StudyParentSettings,
  StudyReviewRecommendation,
  StudySafeEvent,
  StudySessionSnapshot,
} from '../../types'
import { EVENT_ALLOWED_KEYS, OPAQUE_REF, assertMinimizedForStorage } from './minimization'

export const FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION = 1 as const

/** The exact Study Engine calendar record version this store was built against. */
export const SUPPORTED_CALENDAR_BLOCK_SCHEMA_VERSION = 'calendar-parent-runtime.v1' as const

const MAX_CALENDAR_BLOCKS = 2_000
const MAX_SESSIONS = 2_000
const MAX_CHECKPOINTS = 2_000
const MAX_REVIEWS = 2_000
const MAX_EVENTS = 20_000
const MAX_OUTBOX = 2_000
const MAX_SEGMENTS = 512
/**
 * Must stay >= the accepted calendar runtime's own title ceiling (assertText's
 * default maximum, calendar-runtime.ts). createCalendarBlock refuses a longer
 * title before this store ever sees it; if the engine ever raises its ceiling
 * this constant has to move with it, or a long lesson title becomes a refused
 * write.
 */
const MAX_TEXT = 240

/** One calendar block plus the plan metadata the entry projection needs. */
export interface DurableCalendarRecordV1 {
  readonly block: CalendarBlock
  readonly plan: StudyLessonPlan
}

/**
 * One accepted event. `semanticKey` is stored rather than recomputed so that
 * the append-time duplicate rule survives a reload unchanged.
 */
export interface DurableEventRecordV1 {
  readonly sessionRef: string
  readonly eventRef: string
  readonly semanticKey: string
  readonly event: StudySafeEvent
}

/** Everything one student's Study work needs to survive a browser restart. */
export interface DurableStudyDocumentV1 {
  readonly schemaVersion: typeof FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION
  readonly updatedAt: string
  readonly scope: StudyLearnerScope
  readonly preferences: StudyLearnerPreferences | null
  readonly parentSettings: StudyParentSettings | null
  readonly calendar: readonly DurableCalendarRecordV1[]
  readonly sessions: readonly StudySessionSnapshot[]
  readonly checkpoints: readonly StudyCheckpoint[]
  readonly reviews: readonly StudyReviewRecommendation[]
  readonly events: readonly DurableEventRecordV1[]
  readonly outbox: readonly StudyOutboxProposal[]
}

export type DurableSchemaReasonCode =
  /** Written by a build whose document schema is newer than this one. */
  | 'schema-version-ahead'
  /**
   * Bound to a different household. The accepted provider rejects a learner
   * reference seen under a second household outright, and so does this: the
   * alternative is two divergent documents for one student, where the work done
   * under the first household simply stops appearing.
   */
  | 'household-binding-mismatch'
  /** Written against a Study Engine calendar record version this build does not know. */
  | 'calendar-schema-ahead'
  /** Structurally present but at least one record could not be read. */
  | 'record-unreadable'
  /** Not a document this build recognises at all. */
  | 'schema-unreadable'

export type DurableParseOutcome =
  | { readonly status: 'current'; readonly document: DurableStudyDocumentV1 }
  | { readonly status: 'unreadable'; readonly reasonCode: DurableSchemaReasonCode }

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/**
 * Reading is deliberately more tolerant than writing: it accepts the
 * repository's canonical identifier shape from
 * src/study/database/studyDatabaseContract.ts, which also allows `/`.
 *
 * The 512 bound is derived, not guessed. The Study runtime composes references
 * out of other references, and the longest it can build is
 * `completion:${sessionRef}:${lessonRef}` — 11 + 138 + 1 + 192 = 342 characters,
 * where 138 is the longest `blockRef` calendarAdapter can mint plus `:session`,
 * and 192 is curriculumAdapter's SAFE_REF ceiling for a lesson reference.
 * `launch:${sessionRef}:${segmentRef}` reaches 274, the calendar runtime capping
 * a segment id at 128. Every one of those is a reference upstream accepts, so a
 * bound below 342 would refuse a household's real work for the sole offence of
 * a descriptive lesson name.
 */
const STORED_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/

function isRef(value: unknown): value is string {
  return typeof value === 'string' && STORED_IDENTIFIER.test(value)
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function isText(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_TEXT
}

function isCount(value: unknown, max: number): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= max
}

function isBool(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function refList(value: unknown, max: number): readonly string[] | null {
  if (!Array.isArray(value) || value.length > max) return null
  return value.every(isRef) ? Object.freeze([...(value as string[])]) : null
}

function sameScope(value: unknown, scope: StudyLearnerScope): boolean {
  return isRecord(value) && value.householdRef === scope.householdRef && value.learnerRef === scope.learnerRef
}

/** A learner-keyed document that names another household is a binding refusal, not corruption. */
function foreignHousehold(value: Record<string, unknown>, scope: StudyLearnerScope): boolean {
  const stored = value.scope
  return isRecord(stored) &&
    stored.learnerRef === scope.learnerRef &&
    typeof stored.householdRef === 'string' &&
    stored.householdRef !== scope.householdRef
}

/** Both minimization markers must be the literal `false` they are typed as. */
function minimized(value: Record<string, unknown>): boolean {
  return value.rawAnswerIncluded === false && value.transcriptIncluded === false
}

function parsePreferences(value: unknown): StudyLearnerPreferences | null {
  if (!isRecord(value)) return null
  const accessibility = value.accessibility
  const timerPreference = value.timerPreference
  if (!isRecord(accessibility) || !isRecord(timerPreference)) return null
  const flags = ['largeText', 'reducedMotion', 'noAudio', 'captions', 'transientTranscript', 'highContrast', 'oneTaskAtATime'] as const
  if (!flags.every((flag) => isBool(accessibility[flag]))) return null
  if (timerPreference.visibility !== 'shown' && timerPreference.visibility !== 'hidden') return null
  if (!isBool(timerPreference.milestonesOnly)) return null
  return value as unknown as StudyLearnerPreferences
}

function parseParentSettings(value: unknown): StudyParentSettings | null {
  if (!isRecord(value)) return null
  if (!isCount(value.maximumWorkMinutes, 240) || !isCount(value.breakMinutes, 120)) return null
  if (!isBool(value.timerHidden) || !isCount(value.revision, Number.MAX_SAFE_INTEGER)) return null
  const lists = ['accommodations', 'recommendationDecisions', 'interruptions', 'reschedules', 'adultReviewRequests'] as const
  if (!lists.every((list) => Array.isArray(value[list]))) return null
  return value as unknown as StudyParentSettings
}

function parsePlan(value: unknown): StudyLessonPlan | null {
  if (!isRecord(value)) return null
  if (!isRef(value.lessonRef) || !isText(value.title)) return null
  if (value.masteryAuthority !== 'tutor-core' && value.masteryAuthority !== 'completion-only') return null
  if (value.source !== 'manuel-academy' && value.source !== 'parent' && value.source !== 'romeo-virtual-academy') return null
  if (!refList(value.skillRefs, MAX_SEGMENTS)) return null
  if (!Array.isArray(value.segments) || value.segments.length > MAX_SEGMENTS) return null
  if (!value.segments.every((segment: unknown) => isRecord(segment) && isRef(segment.segmentRef))) return null
  return value as unknown as StudyLessonPlan
}

/**
 * A calendar block is the Study Engine's own record. This checks that it is the
 * version we were built against, that it belongs to this student, and that it
 * carries nothing it should not — and then keeps it byte-for-byte. Every field
 * inside it is read back only by the engine.
 */
function parseCalendarRecord(
  value: unknown,
  scope: StudyLearnerScope,
): DurableCalendarRecordV1 | 'calendar-schema-ahead' | null {
  if (!isRecord(value)) return null
  const block = value.block
  if (!isRecord(block)) return null
  if (block.schemaVersion !== SUPPORTED_CALENDAR_BLOCK_SCHEMA_VERSION) {
    // A newer engine record is reported, never coerced into the shape this
    // build happens to expect.
    return typeof block.schemaVersion === 'string' ? 'calendar-schema-ahead' : null
  }
  if (!isRef(block.internalBlockId) || block.learnerRef !== scope.learnerRef) return null
  if (!Array.isArray(block.segments) || block.segments.length > MAX_SEGMENTS) return null
  if (!isRecord(block.sourceIdentity) || !isRecord(block.lineage)) return null
  // The engine's resume metadata may carry a draft REFERENCE. It is the only
  // field anywhere in a calendar block that could carry learner prose instead,
  // so it gets the same gate the checkpoint path applies on write.
  if (!resumeDraftRefsAreOpaque(block)) return null
  const plan = parsePlan(value.plan)
  if (!plan) return null
  return Object.freeze({ block: block as unknown as CalendarBlock, plan })
}

/** Every resume point reachable from one block: current, historical, and interrupted. */
function resumeDraftRefsAreOpaque(block: Record<string, unknown>): boolean {
  const points: unknown[] = [block.resumePoint]
  const current = block.currentInterruption
  if (isRecord(current)) points.push(current.resumePoint)
  if (Array.isArray(block.interruptionHistory)) {
    for (const record of block.interruptionHistory) {
      if (isRecord(record)) points.push(record.resumePoint)
    }
  }
  return points.every((point) => {
    if (!isRecord(point)) return true
    const draft = point.responseDraftRef
    return draft === undefined || draft === null || (typeof draft === 'string' && OPAQUE_REF.test(draft))
  })
}

function parseSession(value: unknown, scope: StudyLearnerScope): StudySessionSnapshot | null {
  if (!isRecord(value) || !minimized(value)) return null
  if (!sameScope(value.scope, scope) || !isRef((value.scope as Record<string, unknown>).sessionRef)) return null
  if (!isRef(value.lessonRef) || !isRef(value.segmentRef) || !isInstant(value.updatedAt)) return null
  const statuses = ['ready', 'active', 'paused', 'completed', 'stopped']
  if (!statuses.includes(value.status as string)) return null
  if (!(value.lastAcceptedEventRef === null || isRef(value.lastAcceptedEventRef))) return null
  if (!(value.lastProgressionDecisionRef === undefined || value.lastProgressionDecisionRef === null || isRef(value.lastProgressionDecisionRef))) return null
  return {
    ...(value as unknown as StudySessionSnapshot),
    lastProgressionDecisionRef: value.lastProgressionDecisionRef ?? null,
  }
}

function parseCheckpoint(value: unknown, scope: StudyLearnerScope): StudyCheckpoint | null {
  if (!isRecord(value) || !minimized(value)) return null
  if (!sameScope(value, scope) || !isRef(value.sessionRef)) return null
  if (!isRef(value.checkpointRef) || !isRef(value.lessonRef) || !isRef(value.segmentRef)) return null
  if (!isCount(value.revision, Number.MAX_SAFE_INTEGER) || !isInstant(value.capturedAt)) return null
  if (!isCount(value.elapsedActiveSecondsInSegment, Number.MAX_SAFE_INTEGER)) return null
  if (!refList(value.completedSegmentRefs, MAX_SEGMENTS)) return null
  // Never draft text: a stored draft reference must still be a reference.
  if (!(value.responseDraftRef === null || isRef(value.responseDraftRef))) return null
  return value as unknown as StudyCheckpoint
}

function parseReview(value: unknown, scope: StudyLearnerScope): StudyReviewRecommendation | null {
  if (!isRecord(value) || !minimized(value)) return null
  if (!sameScope(value, scope)) return null
  if (!isRef(value.recommendationRef) || !isRef(value.sourceEvidenceRef) || !isRef(value.lessonRef)) return null
  if (typeof value.dueDate !== 'string' || !refList(value.reasonCodes, MAX_SEGMENTS)) return null
  const statuses = ['pending-parent', 'accepted', 'rejected']
  return statuses.includes(value.status as string) ? (value as unknown as StudyReviewRecommendation) : null
}

function parseEventRecord(value: unknown): DurableEventRecordV1 | null {
  if (!isRecord(value)) return null
  if (!isRef(value.sessionRef) || !isRef(value.eventRef) || typeof value.semanticKey !== 'string') return null
  const event = value.event
  if (!isRecord(event) || event.eventRef !== value.eventRef || !isInstant(event.occurredAt)) return null
  const allowed = EVENT_ALLOWED_KEYS[event.type as StudySafeEvent['type']]
  if (!allowed || !isRecord(event.payload)) return null
  if (Object.keys(event.payload).some((key) => !allowed.includes(key))) return null
  return value as unknown as DurableEventRecordV1
}

function parseOutbox(value: unknown): StudyOutboxProposal | null {
  if (!isRecord(value)) return null
  if (!isRef(value.proposalRef) || value.status !== 'proposed-not-delivered') return null
  if (value.route !== 'adult-review' && value.route !== 'calendar-review') return null
  return refList(value.evidenceRefs, MAX_SEGMENTS) ? (value as unknown as StudyOutboxProposal) : null
}

export function emptyDurableStudyDocument(scope: StudyLearnerScope, now: string): DurableStudyDocumentV1 {
  return Object.freeze({
    schemaVersion: FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION,
    updatedAt: now,
    scope: Object.freeze({ householdRef: scope.householdRef, learnerRef: scope.learnerRef }),
    preferences: null,
    parentSettings: null,
    calendar: Object.freeze([]),
    sessions: Object.freeze([]),
    checkpoints: Object.freeze([]),
    reviews: Object.freeze([]),
    events: Object.freeze([]),
    outbox: Object.freeze([]),
  })
}

/**
 * Total parser: never throws, and answers for the document as a whole.
 *
 * `scope` is the scope the caller is asking for, taken from the storage key.
 * A document whose own recorded scope disagrees is refused rather than served,
 * so a record moved or renamed under another student's key can never be read
 * as that student's work.
 */
export function parseDurableStudyDocument(value: unknown, scope: StudyLearnerScope): DurableParseOutcome {
  if (!isRecord(value)) return { status: 'unreadable', reasonCode: 'schema-unreadable' }
  if (value.schemaVersion !== FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION) {
    if (isCount(value.schemaVersion, Number.MAX_SAFE_INTEGER) &&
        (value.schemaVersion as number) > FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION) {
      return { status: 'unreadable', reasonCode: 'schema-version-ahead' }
    }
    return { status: 'unreadable', reasonCode: 'schema-unreadable' }
  }
  if (foreignHousehold(value, scope)) {
    return { status: 'unreadable', reasonCode: 'household-binding-mismatch' }
  }
  if (!isInstant(value.updatedAt) || !sameScope(value.scope, scope)) {
    return { status: 'unreadable', reasonCode: 'schema-unreadable' }
  }
  // A stored document that carries a forbidden field is refused outright: it was
  // either written by something that is not this store, or tampered with.
  try {
    assertMinimizedForStorage(value, 'stored')
  } catch {
    return { status: 'unreadable', reasonCode: 'record-unreadable' }
  }

  const lists: readonly [unknown, number][] = [
    [value.calendar, MAX_CALENDAR_BLOCKS],
    [value.sessions, MAX_SESSIONS],
    [value.checkpoints, MAX_CHECKPOINTS],
    [value.reviews, MAX_REVIEWS],
    [value.events, MAX_EVENTS],
    [value.outbox, MAX_OUTBOX],
  ]
  if (lists.some(([list, max]) => !Array.isArray(list) || (list as unknown[]).length > max)) {
    return { status: 'unreadable', reasonCode: 'schema-unreadable' }
  }
  if (!(value.preferences === null || value.preferences === undefined) && !parsePreferences(value.preferences)) {
    return { status: 'unreadable', reasonCode: 'record-unreadable' }
  }
  if (!(value.parentSettings === null || value.parentSettings === undefined) && !parseParentSettings(value.parentSettings)) {
    return { status: 'unreadable', reasonCode: 'record-unreadable' }
  }

  const calendar: DurableCalendarRecordV1[] = []
  for (const item of value.calendar as unknown[]) {
    const parsed = parseCalendarRecord(item, scope)
    if (parsed === 'calendar-schema-ahead') return { status: 'unreadable', reasonCode: 'calendar-schema-ahead' }
    if (!parsed) return { status: 'unreadable', reasonCode: 'record-unreadable' }
    if (calendar.some((held) => held.block.internalBlockId === parsed.block.internalBlockId)) {
      return { status: 'unreadable', reasonCode: 'record-unreadable' }
    }
    calendar.push(parsed)
  }

  const sessions: StudySessionSnapshot[] = []
  for (const item of value.sessions as unknown[]) {
    const parsed = parseSession(item, scope)
    if (!parsed) return { status: 'unreadable', reasonCode: 'record-unreadable' }
    if (sessions.some((held) => held.scope.sessionRef === parsed.scope.sessionRef)) {
      return { status: 'unreadable', reasonCode: 'record-unreadable' }
    }
    sessions.push(parsed)
  }

  const checkpoints: StudyCheckpoint[] = []
  for (const item of value.checkpoints as unknown[]) {
    const parsed = parseCheckpoint(item, scope)
    if (!parsed) return { status: 'unreadable', reasonCode: 'record-unreadable' }
    if (checkpoints.some((held) => held.sessionRef === parsed.sessionRef)) {
      return { status: 'unreadable', reasonCode: 'record-unreadable' }
    }
    checkpoints.push(parsed)
  }

  const reviews: StudyReviewRecommendation[] = []
  for (const item of value.reviews as unknown[]) {
    const parsed = parseReview(item, scope)
    if (!parsed) return { status: 'unreadable', reasonCode: 'record-unreadable' }
    reviews.push(parsed)
  }

  const events: DurableEventRecordV1[] = []
  for (const item of value.events as unknown[]) {
    const parsed = parseEventRecord(item)
    if (!parsed) return { status: 'unreadable', reasonCode: 'record-unreadable' }
    events.push(parsed)
  }

  const outbox: StudyOutboxProposal[] = []
  for (const item of value.outbox as unknown[]) {
    const parsed = parseOutbox(item)
    if (!parsed) return { status: 'unreadable', reasonCode: 'record-unreadable' }
    outbox.push(parsed)
  }

  return {
    status: 'current',
    document: Object.freeze({
      schemaVersion: FAMILY_PILOT_DURABLE_PORTS_SCHEMA_VERSION,
      updatedAt: value.updatedAt,
      scope: Object.freeze({ householdRef: scope.householdRef, learnerRef: scope.learnerRef }),
      preferences: parsePreferences(value.preferences),
      parentSettings: parseParentSettings(value.parentSettings),
      calendar: Object.freeze(calendar),
      sessions: Object.freeze(sessions),
      checkpoints: Object.freeze(checkpoints),
      reviews: Object.freeze(reviews),
      events: Object.freeze(events),
      outbox: Object.freeze(outbox),
    }),
  }
}

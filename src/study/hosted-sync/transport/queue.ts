import { buildPushRequest } from './contracts'
import { assertStudySyncPayloadPrivate } from './privacy'
import type {
  StudySyncOutcome,
  StudySyncPushInput,
  StudySyncPushResult,
} from './types'

export const STUDY_SYNC_MAX_QUEUE_ATTEMPTS = 8

export type StudySyncQueueState = 'PENDING' | 'RETRY_WAIT' | 'BLOCKED' | 'EXHAUSTED'

export interface StudySyncQueueEntry extends StudySyncPushInput {
  /** Caller-owned monotonic order within a student/document. */
  readonly localSequence: number
  readonly enqueuedAt: string
  readonly attempts: number
  readonly nextAttemptAt: string | null
  readonly state: StudySyncQueueState
}

export type StudySyncQueueAttemptResult =
  | { readonly disposition: 'REMOVE' }
  | { readonly disposition: 'UNCHANGED'; readonly entry: StudySyncQueueEntry }
  | { readonly disposition: 'KEEP'; readonly entry: StudySyncQueueEntry }

function validInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value))
}

function freezeEntry(value: StudySyncQueueEntry): StudySyncQueueEntry {
  assertStudySyncPayloadPrivate(value)
  return Object.freeze(value)
}

/**
 * Creates only transport metadata. Authorization headers and browser session
 * material are intentionally not representable in this queue shape.
 */
export function createStudySyncQueueEntry(input: StudySyncPushInput & {
  readonly localSequence: number
  readonly enqueuedAt: string
}): StudySyncQueueEntry {
  const request = buildPushRequest(input)
  if (!request || request.operation !== 'PUSH' ||
      !Number.isSafeInteger(input.localSequence) || input.localSequence < 0 ||
      !validInstant(input.enqueuedAt)) {
    throw new Error('Invalid Study sync queue operation.')
  }
  return freezeEntry({
    identity: request.identity,
    operationId: request.operationId,
    baseRevision: request.baseRevision,
    document: request.document,
    localSequence: input.localSequence,
    enqueuedAt: input.enqueuedAt,
    attempts: 0,
    nextAttemptAt: null,
    state: 'PENDING',
  })
}

function sameDocument(left: StudySyncQueueEntry, right: StudySyncQueueEntry): boolean {
  return left.identity.householdRef === right.identity.householdRef &&
    left.identity.studentRef === right.identity.studentRef &&
    left.identity.documentRef === right.identity.documentRef
}

/** Returns eligible document heads only; a later operation never passes an earlier operation on the same document. */
export function nextStudySyncQueueEntry(
  entries: readonly StudySyncQueueEntry[],
  at: Date,
): StudySyncQueueEntry | null {
  const heads = entries.filter((candidate) => !entries.some((other) =>
    sameDocument(other, candidate) && (
      other.localSequence < candidate.localSequence ||
      (other.localSequence === candidate.localSequence && (
        other.enqueuedAt < candidate.enqueuedAt ||
        (other.enqueuedAt === candidate.enqueuedAt && other.operationId < candidate.operationId)
      ))
    )))
    .sort((left, right) =>
      left.enqueuedAt.localeCompare(right.enqueuedAt) || left.operationId.localeCompare(right.operationId))
  return heads.find((entry) =>
    entry.state === 'PENDING' ||
    (entry.state === 'RETRY_WAIT' && entry.nextAttemptAt !== null && Date.parse(entry.nextAttemptAt) <= at.getTime())) ?? null
}

/**
 * Pure bookkeeping for one completed call. It never invokes transport and
 * never chooses conflict policy. ABORTED does not consume an attempt.
 */
export function recordStudySyncQueueAttempt(
  entry: StudySyncQueueEntry,
  outcome: StudySyncOutcome<StudySyncPushResult>,
  retryAt?: string,
): StudySyncQueueAttemptResult {
  if (outcome.code === 'SUCCESS') return Object.freeze({ disposition: 'REMOVE' })
  if (outcome.code === 'ABORTED') return Object.freeze({ disposition: 'UNCHANGED', entry })

  const attempts = Math.min(entry.attempts + 1, STUDY_SYNC_MAX_QUEUE_ATTEMPTS)
  if (attempts >= STUDY_SYNC_MAX_QUEUE_ATTEMPTS) {
    return Object.freeze({
      disposition: 'KEEP',
      entry: freezeEntry({ ...entry, attempts, nextAttemptAt: null, state: 'EXHAUSTED' }),
    })
  }

  if (outcome.retry === 'RETRY_WITH_BACKOFF' || outcome.retry === 'RETRY_AFTER_DELAY') {
    if (!validInstant(retryAt)) throw new Error('A bounded retry must supply its next attempt time.')
    return Object.freeze({
      disposition: 'KEEP',
      entry: freezeEntry({ ...entry, attempts, nextAttemptAt: retryAt, state: 'RETRY_WAIT' }),
    })
  }

  return Object.freeze({
    disposition: 'KEEP',
    entry: freezeEntry({ ...entry, attempts, nextAttemptAt: null, state: 'BLOCKED' }),
  })
}

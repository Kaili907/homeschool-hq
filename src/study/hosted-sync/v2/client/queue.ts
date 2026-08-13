import {
  assertHostedSyncPrivate,
  isHostedSyncInstant,
  isHostedSyncOperationId,
  isHostedSyncRevision,
  parseHostedSyncIdentity,
} from './contracts'
import type { HostedSyncIdentity, HostedSyncOutcomeCode } from './types'

export const HOSTED_SYNC_QUEUE_SCHEMA_VERSION = 2 as const
export const HOSTED_SYNC_MAX_QUEUE_LENGTH = 64
export const HOSTED_SYNC_MAX_ATTEMPTS = 8

interface HostedSyncQueueEntryBase {
  readonly identity: HostedSyncIdentity
  readonly operationId: string
  readonly sequence: number
  readonly attempts: number
  readonly nextAttemptAt: string | null
  readonly createdAt: string
}

export interface HostedSyncQueuedFirstLinkImport extends HostedSyncQueueEntryBase {
  readonly kind: 'FIRST_LINK_IMPORT'
  readonly baseRevision: 0
  readonly adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED'
  readonly confirmedAt: string
}

export interface HostedSyncQueuedRevisionedWrite extends HostedSyncQueueEntryBase {
  readonly kind: 'REVISIONED_WRITE'
  /** CAS base is immutable for the lifetime of this queued operation. */
  readonly baseRevision: number
}

export interface HostedSyncQueuedAcknowledgement extends HostedSyncQueueEntryBase {
  readonly kind: 'ACKNOWLEDGEMENT'
  readonly acknowledgedOperationId: string
  readonly serverRevision: number
}

export type HostedSyncQueueEntry =
  | HostedSyncQueuedFirstLinkImport
  | HostedSyncQueuedRevisionedWrite
  | HostedSyncQueuedAcknowledgement

export interface HostedSyncQueueState {
  readonly schemaVersion: typeof HOSTED_SYNC_QUEUE_SCHEMA_VERSION
  readonly revision: number
  readonly nextSequence: number
  readonly entries: readonly HostedSyncQueueEntry[]
}

/** Implement this with IndexedDB; update must commit atomically before resolving. */
export interface HostedSyncDurableQueueStore {
  read(): Promise<HostedSyncQueueState>
  update(
    transform: (current: HostedSyncQueueState) => HostedSyncQueueState,
  ): Promise<HostedSyncQueueState>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && keys.every((key) => expected.includes(key))
}

function sameIdentity(left: HostedSyncIdentity, right: HostedSyncIdentity): boolean {
  return left.householdRef === right.householdRef && left.learnerRef === right.learnerRef &&
    left.documentRef === right.documentRef
}

function freezeEntry<T extends HostedSyncQueueEntry>(entry: T): T {
  return Object.freeze({ ...entry, identity: Object.freeze({ ...entry.identity }) }) as unknown as T
}

function nextState(state: HostedSyncQueueState, entries: readonly HostedSyncQueueEntry[], nextSequence = state.nextSequence) {
  return Object.freeze({
    schemaVersion: HOSTED_SYNC_QUEUE_SCHEMA_VERSION,
    revision: state.revision + 1,
    nextSequence,
    entries: Object.freeze(entries.map((entry) => freezeEntry(entry))),
  })
}

export function emptyHostedSyncQueue(): HostedSyncQueueState {
  return Object.freeze({
    schemaVersion: HOSTED_SYNC_QUEUE_SCHEMA_VERSION,
    revision: 0,
    nextSequence: 0,
    entries: Object.freeze([]),
  })
}

export function parseHostedSyncQueue(value: unknown): HostedSyncQueueState | null {
  if (!isRecord(value) || !exactKeys(value, ['schemaVersion', 'revision', 'nextSequence', 'entries']) ||
      value.schemaVersion !== HOSTED_SYNC_QUEUE_SCHEMA_VERSION || !isHostedSyncRevision(value.revision) ||
      !isHostedSyncRevision(value.nextSequence) || !Array.isArray(value.entries) ||
      value.entries.length > HOSTED_SYNC_MAX_QUEUE_LENGTH) return null
  const entries: HostedSyncQueueEntry[] = []
  for (const raw of value.entries) {
    if (!isRecord(raw) || typeof raw.kind !== 'string') return null
    const identity = parseHostedSyncIdentity(raw.identity)
    if (!identity || !isHostedSyncOperationId(raw.operationId) || !isHostedSyncRevision(raw.sequence) ||
        raw.sequence > value.nextSequence || !isHostedSyncRevision(raw.attempts) ||
        raw.attempts > HOSTED_SYNC_MAX_ATTEMPTS ||
        !(raw.nextAttemptAt === null || isHostedSyncInstant(raw.nextAttemptAt)) ||
        !isHostedSyncInstant(raw.createdAt)) return null
    const common = {
      identity,
      operationId: raw.operationId,
      sequence: raw.sequence,
      attempts: raw.attempts,
      nextAttemptAt: raw.nextAttemptAt as string | null,
      createdAt: raw.createdAt,
    }
    if (raw.kind === 'FIRST_LINK_IMPORT') {
      if (!exactKeys(raw, [
        'kind', 'identity', 'operationId', 'sequence', 'attempts', 'nextAttemptAt', 'createdAt',
        'baseRevision', 'adultConfirmation', 'confirmedAt',
      ]) || raw.baseRevision !== 0 || raw.adultConfirmation !== 'EXPLICIT_ADULT_CONFIRMED' ||
          !isHostedSyncInstant(raw.confirmedAt)) return null
      entries.push(freezeEntry({
        ...common,
        kind: 'FIRST_LINK_IMPORT',
        baseRevision: 0,
        adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED',
        confirmedAt: raw.confirmedAt,
      }))
    } else if (raw.kind === 'REVISIONED_WRITE') {
      if (!exactKeys(raw, [
        'kind', 'identity', 'operationId', 'sequence', 'attempts', 'nextAttemptAt', 'createdAt', 'baseRevision',
      ]) || !isHostedSyncRevision(raw.baseRevision)) return null
      entries.push(freezeEntry({ ...common, kind: 'REVISIONED_WRITE', baseRevision: raw.baseRevision }))
    } else if (raw.kind === 'ACKNOWLEDGEMENT') {
      if (!exactKeys(raw, [
        'kind', 'identity', 'operationId', 'sequence', 'attempts', 'nextAttemptAt', 'createdAt',
        'acknowledgedOperationId', 'serverRevision',
      ]) || !isHostedSyncOperationId(raw.acknowledgedOperationId) ||
          !isHostedSyncRevision(raw.serverRevision)) return null
      entries.push(freezeEntry({
        ...common,
        kind: 'ACKNOWLEDGEMENT',
        acknowledgedOperationId: raw.acknowledgedOperationId,
        serverRevision: raw.serverRevision,
      }))
    } else return null
  }
  if (new Set(entries.map((entry) => entry.operationId)).size !== entries.length ||
      new Set(entries.map((entry) => entry.sequence)).size !== entries.length) return null
  try { assertHostedSyncPrivate(value) } catch { return null }
  return Object.freeze({
    schemaVersion: HOSTED_SYNC_QUEUE_SCHEMA_VERSION,
    revision: value.revision,
    nextSequence: value.nextSequence,
    entries: Object.freeze(entries.sort((left, right) => left.sequence - right.sequence)),
  })
}

function enqueue(
  state: HostedSyncQueueState,
  operationId: string,
  create: (sequence: number) => HostedSyncQueueEntry,
  sameIntent: (existing: HostedSyncQueueEntry) => boolean,
): HostedSyncQueueState {
  if (!parseHostedSyncQueue(state)) throw new Error('Hosted sync queue state is unreadable.')
  if (!isHostedSyncOperationId(operationId)) throw new Error('A stable operation UUID is required.')
  const existing = state.entries.find((entry) => entry.operationId === operationId)
  if (existing) {
    if (!sameIntent(existing)) throw new Error('Hosted sync operation UUID was reused for different intent.')
    return state
  }
  if (state.entries.length >= HOSTED_SYNC_MAX_QUEUE_LENGTH) throw new Error('Hosted sync queue is full.')
  const sequence = state.nextSequence + 1
  const entry = freezeEntry(create(sequence))
  const updated = nextState(state, [...state.entries, entry], sequence)
  if (!parseHostedSyncQueue(updated)) throw new Error('Hosted sync queue entry was refused.')
  return updated
}

export function enqueueFirstLinkImport(
  state: HostedSyncQueueState,
  input: {
    readonly identity: HostedSyncIdentity
    readonly operationId: string
    readonly adultConfirmation: 'EXPLICIT_ADULT_CONFIRMED'
    readonly confirmedAt: string
    readonly createdAt: string
  },
): HostedSyncQueueState {
  return enqueue(state, input.operationId, (sequence) => ({
    kind: 'FIRST_LINK_IMPORT',
    identity: input.identity,
    operationId: input.operationId,
    baseRevision: 0,
    adultConfirmation: input.adultConfirmation,
    confirmedAt: input.confirmedAt,
    sequence,
    attempts: 0,
    nextAttemptAt: null,
    createdAt: input.createdAt,
  }), (existing) => existing.kind === 'FIRST_LINK_IMPORT' && sameIdentity(existing.identity, input.identity) &&
    existing.adultConfirmation === input.adultConfirmation && existing.confirmedAt === input.confirmedAt)
}

export function enqueueRevisionedWrite(
  state: HostedSyncQueueState,
  input: {
    readonly identity: HostedSyncIdentity
    readonly operationId: string
    readonly baseRevision: number
    readonly createdAt: string
  },
): HostedSyncQueueState {
  return enqueue(state, input.operationId, (sequence) => ({
    kind: 'REVISIONED_WRITE',
    identity: input.identity,
    operationId: input.operationId,
    baseRevision: input.baseRevision,
    sequence,
    attempts: 0,
    nextAttemptAt: null,
    createdAt: input.createdAt,
  }), (existing) => existing.kind === 'REVISIONED_WRITE' && sameIdentity(existing.identity, input.identity) &&
    existing.baseRevision === input.baseRevision)
}

export function enqueueAcknowledgement(
  state: HostedSyncQueueState,
  input: {
    readonly identity: HostedSyncIdentity
    readonly operationId: string
    readonly acknowledgedOperationId: string
    readonly serverRevision: number
    readonly createdAt: string
  },
): HostedSyncQueueState {
  return enqueue(state, input.operationId, (sequence) => ({
    kind: 'ACKNOWLEDGEMENT',
    identity: input.identity,
    operationId: input.operationId,
    acknowledgedOperationId: input.acknowledgedOperationId,
    serverRevision: input.serverRevision,
    sequence,
    attempts: 0,
    nextAttemptAt: null,
    createdAt: input.createdAt,
  }), (existing) => existing.kind === 'ACKNOWLEDGEMENT' && sameIdentity(existing.identity, input.identity) &&
    existing.acknowledgedOperationId === input.acknowledgedOperationId &&
    existing.serverRevision === input.serverRevision)
}

export function completeQueuedOperation(state: HostedSyncQueueState, operationId: string): HostedSyncQueueState {
  const entries = state.entries.filter((entry) => entry.operationId !== operationId)
  return entries.length === state.entries.length ? state : nextState(state, entries)
}

export function recordQueuedRetry(
  state: HostedSyncQueueState,
  operationId: string,
  nextAttemptAt: string,
): HostedSyncQueueState {
  if (!isHostedSyncInstant(nextAttemptAt)) throw new Error('A valid retry instant is required.')
  const held = state.entries.find((entry) => entry.operationId === operationId)
  if (!held) return state
  if (held.attempts >= HOSTED_SYNC_MAX_ATTEMPTS) return state
  const entries = state.entries.map((entry) => entry.operationId === operationId
    ? freezeEntry({ ...entry, attempts: entry.attempts + 1, nextAttemptAt })
    : entry)
  return nextState(state, entries)
}

export function nextReadyQueuedOperation(
  state: HostedSyncQueueState,
  now: Date,
): HostedSyncQueueEntry | null {
  return state.entries.find((entry) => entry.attempts < HOSTED_SYNC_MAX_ATTEMPTS &&
    (entry.nextAttemptAt === null || Date.parse(entry.nextAttemptAt) <= now.getTime())) ?? null
}

export function isHostedSyncRetryable(code: HostedSyncOutcomeCode): boolean {
  return code === 'OFFLINE' || code === 'NETWORK_UNAVAILABLE' || code === 'TIMEOUT' ||
    code === 'RATE_LIMITED' || code === 'SERVER_UNAVAILABLE'
}

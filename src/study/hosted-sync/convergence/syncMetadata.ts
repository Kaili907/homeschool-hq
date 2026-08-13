import type { IndexedDbRecordStoreOptions } from '../../family-pilot/durable-indexeddb/indexedDbRecords'
import { openIndexedDbRecordStore } from '../../family-pilot/durable-indexeddb/indexedDbRecords'
import { assertStudySyncPayloadPrivate } from '../transport/privacy'

export const HOSTED_STUDY_LOCAL_SYNC_SCHEMA_VERSION = 1 as const
export const HOSTED_STUDY_SYNC_MAX_QUEUE_LENGTH = 64
export const HOSTED_STUDY_SYNC_MAX_ACKNOWLEDGED_IDS = 256
export const HOSTED_STUDY_SYNC_MAX_ATTEMPTS = 8

export type HostedStudyRpcOperation =
  | 'checkpoint:compare-and-swap'
  | 'safety:stop'
  | 'safety:clear'
  | 'guardian-attestation:attest'

export type HostedStudyRevisionDomain = 'checkpoint' | 'authority'
export type HostedStudyLastSyncOutcome =
  | 'NEVER'
  | 'SUCCESS'
  | 'OFFLINE'
  | 'AUTH_REQUIRED'
  | 'CONFLICT'
  | 'SERVER_UNAVAILABLE'
  | 'PERMANENT_REFUSAL'

export interface HostedStudySyncIdentity {
  readonly householdRef: string
  readonly studentRef: string
  readonly assignmentRef: string
  readonly sessionRef: string
}

/** Payload-free queue record. Canonical state is read from Study storage at send time. */
export interface HostedStudyQueuedOperation {
  readonly operationId: string
  readonly operation: HostedStudyRpcOperation
  readonly revisionDomain: HostedStudyRevisionDomain
  readonly baseRevision: number
  readonly localSequence: number
  readonly attempts: number
  readonly nextAttemptAt: string | null
}

export interface HostedStudyIdentityLinkLedger {
  readonly kind: 'explicit-adult-confirmed-link'
  readonly localHouseholdRef: string
  readonly hostedHouseholdRef: string
  readonly localStudentRef: string
  readonly hostedStudentRef: string
  readonly confirmedAt: string
}

export interface HostedStudyLocalSyncState {
  readonly schemaVersion: typeof HOSTED_STUDY_LOCAL_SYNC_SCHEMA_VERSION
  readonly identity: HostedStudySyncIdentity
  readonly deviceId: string
  readonly serverRevisions: Readonly<Record<HostedStudyRevisionDomain, number>>
  readonly baseRevisions: Readonly<Record<HostedStudyRevisionDomain, number>>
  readonly localSequence: number
  readonly queue: readonly HostedStudyQueuedOperation[]
  readonly acknowledgedOperationIds: readonly string[]
  readonly lastOutcome: HostedStudyLastSyncOutcome
  readonly retryAt: string | null
  readonly link: HostedStudyIdentityLinkLedger | null
}

export interface HostedStudySyncMetadataStore {
  read(): Promise<HostedStudyLocalSyncState>
  write(state: HostedStudyLocalSyncState): Promise<void>
  close(): void
}

const REF = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,511}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validInstant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function validRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0
}

export function emptyHostedStudyLocalSyncState(input: {
  readonly identity: HostedStudySyncIdentity
  readonly deviceId: string
  readonly link?: HostedStudyIdentityLinkLedger | null
}): HostedStudyLocalSyncState {
  if (!Object.values(input.identity).every((value) => REF.test(value)) || !UUID.test(input.deviceId)) {
    throw new Error('A valid hosted Study identity and device UUID are required.')
  }
  return Object.freeze({
    schemaVersion: HOSTED_STUDY_LOCAL_SYNC_SCHEMA_VERSION,
    identity: Object.freeze({ ...input.identity }),
    deviceId: input.deviceId,
    serverRevisions: Object.freeze({ checkpoint: 0, authority: 0 }),
    baseRevisions: Object.freeze({ checkpoint: 0, authority: 0 }),
    localSequence: 0,
    queue: Object.freeze([]),
    acknowledgedOperationIds: Object.freeze([]),
    lastOutcome: 'NEVER',
    retryAt: null,
    link: input.link ?? null,
  })
}

export function parseHostedStudyLocalSyncState(
  value: unknown,
  expectedIdentity: HostedStudySyncIdentity,
): HostedStudyLocalSyncState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const state = value as Partial<HostedStudyLocalSyncState>
  if (Object.keys(value).length !== 11 || ![
    'schemaVersion', 'identity', 'deviceId', 'serverRevisions', 'baseRevisions', 'localSequence',
    'queue', 'acknowledgedOperationIds', 'lastOutcome', 'retryAt', 'link',
  ].every((key) => key in value) ||
      state.schemaVersion !== HOSTED_STUDY_LOCAL_SYNC_SCHEMA_VERSION || !state.identity ||
      Object.keys(state.identity).length !== 4 ||
      Object.values(state.identity).some((entry) => typeof entry !== 'string' || !REF.test(entry)) ||
      Object.keys(expectedIdentity).some((key) => state.identity?.[key as keyof HostedStudySyncIdentity] !== expectedIdentity[key as keyof HostedStudySyncIdentity]) ||
      !UUID.test(state.deviceId ?? '') || !state.serverRevisions || !state.baseRevisions ||
      !validRevision(state.serverRevisions.checkpoint) || !validRevision(state.serverRevisions.authority) ||
      !validRevision(state.baseRevisions.checkpoint) || !validRevision(state.baseRevisions.authority) ||
      state.baseRevisions.checkpoint > state.serverRevisions.checkpoint ||
      state.baseRevisions.authority > state.serverRevisions.authority ||
      !validRevision(state.localSequence) || !Array.isArray(state.queue) ||
      state.queue.length > HOSTED_STUDY_SYNC_MAX_QUEUE_LENGTH ||
      !Array.isArray(state.acknowledgedOperationIds) ||
      state.acknowledgedOperationIds.length > HOSTED_STUDY_SYNC_MAX_ACKNOWLEDGED_IDS ||
      !state.acknowledgedOperationIds.every((id) => UUID.test(id)) ||
      new Set(state.acknowledgedOperationIds).size !== state.acknowledgedOperationIds.length ||
      !['NEVER', 'SUCCESS', 'OFFLINE', 'AUTH_REQUIRED', 'CONFLICT', 'SERVER_UNAVAILABLE', 'PERMANENT_REFUSAL'].includes(state.lastOutcome ?? '') ||
      !(state.retryAt === null || validInstant(state.retryAt))) return null
  const queue: HostedStudyQueuedOperation[] = []
  for (const entry of state.queue) {
    if (!entry || Object.keys(entry).length !== 7 ||
        !['operationId', 'operation', 'revisionDomain', 'baseRevision', 'localSequence', 'attempts', 'nextAttemptAt']
          .every((key) => key in entry) || !UUID.test(entry.operationId) ||
        !['checkpoint:compare-and-swap', 'safety:stop', 'safety:clear', 'guardian-attestation:attest'].includes(entry.operation) ||
        !['checkpoint', 'authority'].includes(entry.revisionDomain) || !validRevision(entry.baseRevision) ||
        !validRevision(entry.localSequence) || entry.localSequence > state.localSequence ||
        !validRevision(entry.attempts) || entry.attempts > HOSTED_STUDY_SYNC_MAX_ATTEMPTS ||
        !(entry.nextAttemptAt === null || validInstant(entry.nextAttemptAt))) return null
    queue.push(Object.freeze({ ...entry }))
  }
  if (new Set(queue.map((entry) => entry.operationId)).size !== queue.length) return null
  const link = state.link ?? null
  if (link && (Object.keys(link).length !== 6 ||
      !['kind', 'localHouseholdRef', 'hostedHouseholdRef', 'localStudentRef', 'hostedStudentRef', 'confirmedAt']
        .every((key) => key in link) || link.kind !== 'explicit-adult-confirmed-link' ||
      !REF.test(link.localHouseholdRef) || !REF.test(link.hostedHouseholdRef) ||
      !REF.test(link.localStudentRef) || !REF.test(link.hostedStudentRef) || !validInstant(link.confirmedAt))) return null
  try { assertStudySyncPayloadPrivate(value) } catch { return null }
  return Object.freeze({
    schemaVersion: HOSTED_STUDY_LOCAL_SYNC_SCHEMA_VERSION,
    identity: Object.freeze({ ...expectedIdentity }),
    deviceId: state.deviceId as string,
    serverRevisions: Object.freeze({ ...state.serverRevisions }) as Readonly<Record<HostedStudyRevisionDomain, number>>,
    baseRevisions: Object.freeze({ ...state.baseRevisions }) as Readonly<Record<HostedStudyRevisionDomain, number>>,
    localSequence: state.localSequence,
    queue: Object.freeze(queue),
    acknowledgedOperationIds: Object.freeze([...state.acknowledgedOperationIds]),
    lastOutcome: state.lastOutcome as HostedStudyLastSyncOutcome,
    retryAt: state.retryAt as string | null,
    link: link ? Object.freeze({ ...link }) : null,
  })
}

export function enqueueHostedStudyOperation(input: {
  readonly state: HostedStudyLocalSyncState
  readonly operationId: string
  readonly operation: HostedStudyRpcOperation
}): HostedStudyLocalSyncState {
  if (!UUID.test(input.operationId)) throw new Error('A stable UUID operation ID is required.')
  if (input.state.acknowledgedOperationIds.includes(input.operationId) ||
      input.state.queue.some((entry) => entry.operationId === input.operationId)) return input.state
  if (input.state.queue.length >= HOSTED_STUDY_SYNC_MAX_QUEUE_LENGTH) throw new Error('Study sync queue is full.')
  const revisionDomain = input.operation === 'checkpoint:compare-and-swap' ? 'checkpoint' : 'authority'
  const localSequence = input.state.localSequence + 1
  return Object.freeze({
    ...input.state,
    localSequence,
    queue: Object.freeze([...input.state.queue, Object.freeze({
      operationId: input.operationId,
      operation: input.operation,
      revisionDomain,
      baseRevision: input.state.serverRevisions[revisionDomain],
      localSequence,
      attempts: 0,
      nextAttemptAt: null,
    })]),
    lastOutcome: 'OFFLINE',
  })
}

/** Persists only an already adult-confirmed stable-ref mapping; it never matches names. */
export function installHostedStudyIdentityLink(input: {
  readonly state: HostedStudyLocalSyncState
  readonly link: HostedStudyIdentityLinkLedger
}): HostedStudyLocalSyncState {
  const { state, link } = input
  if (link.kind !== 'explicit-adult-confirmed-link' || !validInstant(link.confirmedAt) ||
      !REF.test(link.localHouseholdRef) || !REF.test(link.localStudentRef) ||
      link.hostedHouseholdRef !== state.identity.householdRef ||
      link.hostedStudentRef !== state.identity.studentRef) {
    throw new Error('Explicit identity link does not match the hosted Study scope.')
  }
  if (state.link && JSON.stringify(state.link) !== JSON.stringify(link)) {
    throw new Error('An existing identity link cannot be silently replaced.')
  }
  return state.link ? state : Object.freeze({ ...state, link: Object.freeze({ ...link }) })
}

function metadataKey(identity: HostedStudySyncIdentity): string {
  return `manuel-academy.study.hosted-sync.v1:${encodeURIComponent(identity.studentRef)}:${encodeURIComponent(identity.sessionRef)}`
}

export async function openHostedStudySyncMetadataStore(
  input: IndexedDbRecordStoreOptions & {
    readonly identity: HostedStudySyncIdentity
    readonly deviceId: string
    readonly link?: HostedStudyIdentityLinkLedger | null
  },
): Promise<HostedStudySyncMetadataStore> {
  const records = await openIndexedDbRecordStore(input)
  const key = metadataKey(input.identity)
  const initial = emptyHostedStudyLocalSyncState(input)
  let raw = (await records.read([key])).get(key)
  let state = raw === undefined ? initial : parseHostedStudyLocalSyncState(raw, input.identity)
  if (!state) {
    records.close()
    throw new Error('Hosted Study sync metadata is unreadable; local Study state was left untouched.')
  }
  return Object.freeze({
    async read() { return state as HostedStudyLocalSyncState },
    async write(next: HostedStudyLocalSyncState) {
      const parsed = parseHostedStudyLocalSyncState(next, input.identity)
      if (!parsed) throw new Error('Hosted Study sync metadata write was refused.')
      const expected = raw
      await records.write(key, parsed, (current) => JSON.stringify(current) === JSON.stringify(expected))
      raw = parsed
      state = parsed
    },
    close() { records.close() },
  })
}

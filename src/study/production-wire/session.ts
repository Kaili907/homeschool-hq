import {
  exactRecord,
  instant,
  member,
  parseProductionWireInfrastructureFailureV1,
  parseProductionCalendarBlockRefV1,
  parseProductionContentVersionRefV1,
  parseProductionIdempotencyKeyV1,
  parseProductionLessonRefV1,
  parseProductionMutationRefV1,
  parseProductionOperationRefV1,
  parseProductionSessionRefV1,
  revision,
  safely,
  type ProductionCalendarBlockRefV1,
  type ProductionContentVersionRefV1,
  type ProductionIdempotencyKeyV1,
  type ProductionLessonRefV1,
  type ProductionMutationRefV1,
  type ProductionOperationRefV1,
  type ProductionSessionRefV1,
  type ProductionWireInfrastructureFailureV1,
} from './common'

export const PRODUCTION_SESSION_STATUSES = Object.freeze([
  'planned',
  'active',
  'paused',
  'approved_break',
  'student_requested_break',
  'technical_interruption',
  'completed',
  'abandoned',
] as const)

export type ProductionSessionStatusV1 = typeof PRODUCTION_SESSION_STATUSES[number]

/**
 * Server-owned session state plus trusted content binding. There are no
 * household/student authority claims in this DTO. `ready` is a browser view
 * state and `stopped` is a host lifecycle condition, so neither is durable.
 */
export interface ProductionSessionDescriptorV1 {
  readonly schemaVersion: 1
  readonly sessionRef: ProductionSessionRefV1
  readonly calendarBlockRef: ProductionCalendarBlockRefV1
  readonly lessonRef: ProductionLessonRefV1
  readonly contentVersionRef: ProductionContentVersionRefV1
  readonly status: ProductionSessionStatusV1
  readonly revision: number
  /** The server timestamp of the last accepted durable transition. */
  readonly transitionedAt: string
}

export interface ProductionSessionReadRequestV1 {
  readonly schemaVersion: 1
  readonly sessionRef: ProductionSessionRefV1
  readonly operationRef: ProductionOperationRefV1
}

export interface ProductionSessionBeginRequestV1 {
  readonly schemaVersion: 1
  readonly command: 'begin'
  readonly calendarBlockRef: ProductionCalendarBlockRefV1
  readonly mutationRef: ProductionMutationRefV1
  readonly operationRef: ProductionOperationRefV1
}

interface ProductionSessionRevisionCommandV1 {
  readonly schemaVersion: 1
  readonly sessionRef: ProductionSessionRefV1
  readonly expectedRevision: number
  readonly mutationRef: ProductionMutationRefV1
  readonly operationRef: ProductionOperationRefV1
}

export interface ProductionSessionActivateRequestV1 extends ProductionSessionRevisionCommandV1 {
  readonly command: 'activate'
}

export interface ProductionSessionResumeRequestV1 extends ProductionSessionRevisionCommandV1 {
  readonly command: 'resume'
}

export const PRODUCTION_SESSION_PAUSE_KINDS = Object.freeze([
  'standard',
  'approved-break',
  'student-requested-break',
] as const)
export type ProductionSessionPauseKindV1 = typeof PRODUCTION_SESSION_PAUSE_KINDS[number]

export interface ProductionSessionPauseRequestV1 extends ProductionSessionRevisionCommandV1 {
  readonly command: 'pause'
  readonly pauseKind: ProductionSessionPauseKindV1
}

export interface ProductionSessionInterruptRequestV1 extends ProductionSessionRevisionCommandV1 {
  readonly command: 'interrupt'
  readonly interruptionKind: 'technical'
}

export interface ProductionSessionCompleteRequestV1 extends ProductionSessionRevisionCommandV1 {
  readonly command: 'complete'
}

export interface ProductionSessionAbandonRequestV1 extends ProductionSessionRevisionCommandV1 {
  readonly command: 'abandon'
}

export type ProductionSessionCommandRequestV1 =
  | ProductionSessionBeginRequestV1
  | ProductionSessionActivateRequestV1
  | ProductionSessionResumeRequestV1
  | ProductionSessionPauseRequestV1
  | ProductionSessionInterruptRequestV1
  | ProductionSessionCompleteRequestV1
  | ProductionSessionAbandonRequestV1

export type ProductionSessionReadResultV1 =
  | Readonly<{ schemaVersion: 1; status: 'found'; session: ProductionSessionDescriptorV1 }>
  | Readonly<{ schemaVersion: 1; status: 'not-found' }>
  | Readonly<{ schemaVersion: 1; status: 'integrity-failed' }>
  | ProductionWireInfrastructureFailureV1

type SessionStoredResultV1<S extends ProductionSessionStatusV1> =
  | Readonly<{
      schemaVersion: 1
      status: 'stored'
      session: ProductionSessionDescriptorV1 & Readonly<{ status: S }>
    }>
  | Readonly<{
      schemaVersion: 1
      status: 'duplicate-replay'
      session: ProductionSessionDescriptorV1 & Readonly<{ status: S }>
    }>

type SessionMutationFailureV1 =
  | Readonly<{ schemaVersion: 1; status: 'not-found' }>
  | Readonly<{ schemaVersion: 1; status: 'revision-conflict'; currentRevision: number }>
  | Readonly<{ schemaVersion: 1; status: 'idempotency-collision' }>
  | Readonly<{ schemaVersion: 1; status: 'quarantined' }>
  | Readonly<{ schemaVersion: 1; status: 'integrity-failed' }>
  | Readonly<{ schemaVersion: 1; status: 'illegal-transition' }>
  | ProductionWireInfrastructureFailureV1

export type ProductionSessionBeginResultV1 =
  | SessionStoredResultV1<'planned'>
  | Exclude<SessionMutationFailureV1, Readonly<{ schemaVersion: 1; status: 'revision-conflict'; currentRevision: number }>>
export type ProductionSessionActivateResultV1 = SessionStoredResultV1<'active'> | SessionMutationFailureV1
export type ProductionSessionResumeResultV1 = SessionStoredResultV1<'active'> | SessionMutationFailureV1
export type ProductionSessionPauseResultV1 =
  | SessionStoredResultV1<'paused' | 'approved_break' | 'student_requested_break'>
  | SessionMutationFailureV1
export type ProductionSessionInterruptResultV1 = SessionStoredResultV1<'technical_interruption'> | SessionMutationFailureV1
export type ProductionSessionCompleteResultV1 = SessionStoredResultV1<'completed'> | SessionMutationFailureV1
export type ProductionSessionAbandonResultV1 = SessionStoredResultV1<'abandoned'> | SessionMutationFailureV1

const DESCRIPTOR_KEYS = Object.freeze([
  'schemaVersion',
  'sessionRef',
  'calendarBlockRef',
  'lessonRef',
  'contentVersionRef',
  'status',
  'revision',
  'transitionedAt',
] as const)

export function parseProductionSessionDescriptorV1(
  value: unknown,
): ProductionSessionDescriptorV1 | null {
  return safely(() => {
    const record = exactRecord(value, DESCRIPTOR_KEYS)
    if (!record || record.schemaVersion !== 1) return null
    const sessionRef = parseProductionSessionRefV1(record.sessionRef)
    const calendarBlockRef = parseProductionCalendarBlockRefV1(record.calendarBlockRef)
    const lessonRef = parseProductionLessonRefV1(record.lessonRef)
    const contentVersionRef = parseProductionContentVersionRefV1(record.contentVersionRef)
    const status = member(record.status, PRODUCTION_SESSION_STATUSES)
    const sessionRevision = revision(record.revision)
    const transitionedAt = instant(record.transitionedAt)
    if (
      sessionRef === null ||
      calendarBlockRef === null ||
      lessonRef === null ||
      contentVersionRef === null ||
      status === null ||
      sessionRevision === null ||
      transitionedAt === null
    ) return null
    return Object.freeze({
      schemaVersion: 1 as const,
      sessionRef,
      calendarBlockRef,
      lessonRef,
      contentVersionRef,
      status,
      revision: sessionRevision,
      transitionedAt,
    })
  })
}

export function parseProductionSessionReadRequestV1(
  value: unknown,
): ProductionSessionReadRequestV1 | null {
  return safely(() => {
    const record = exactRecord(value, ['schemaVersion', 'sessionRef', 'operationRef'])
    if (!record || record.schemaVersion !== 1) return null
    const sessionRef = parseProductionSessionRefV1(record.sessionRef)
    const operationRef = parseProductionOperationRefV1(record.operationRef)
    return sessionRef === null || operationRef === null
      ? null
      : Object.freeze({ schemaVersion: 1 as const, sessionRef, operationRef })
  })
}

export function parseProductionSessionBeginRequestV1(
  value: unknown,
): ProductionSessionBeginRequestV1 | null {
  return safely(() => {
    const record = exactRecord(value, [
      'schemaVersion',
      'command',
      'calendarBlockRef',
      'mutationRef',
      'operationRef',
    ])
    if (!record || record.schemaVersion !== 1 || record.command !== 'begin') return null
    const calendarBlockRef = parseProductionCalendarBlockRefV1(record.calendarBlockRef)
    const mutationRef = parseProductionMutationRefV1(record.mutationRef)
    const operationRef = parseProductionOperationRefV1(record.operationRef)
    if (calendarBlockRef === null || mutationRef === null || operationRef === null) return null
    return Object.freeze({
      schemaVersion: 1 as const,
      command: 'begin' as const,
      calendarBlockRef,
      mutationRef,
      operationRef,
    })
  })
}

type ParsedRevisionCommand = Readonly<{
  sessionRef: ProductionSessionRefV1
  expectedRevision: number
  mutationRef: ProductionMutationRefV1
  operationRef: ProductionOperationRefV1
}>

function parsedRevisionCommand(
  value: unknown,
  command: string,
  extraKeys: readonly string[] = [],
): { readonly record: Record<string, unknown>; readonly common: ParsedRevisionCommand } | null {
  const record = exactRecord(value, [
    'schemaVersion',
    'command',
    'sessionRef',
    'expectedRevision',
    'mutationRef',
    'operationRef',
    ...extraKeys,
  ])
  if (!record || record.schemaVersion !== 1 || record.command !== command) return null
  const sessionRef = parseProductionSessionRefV1(record.sessionRef)
  const parsedRevision = revision(record.expectedRevision)
  const mutationRef = parseProductionMutationRefV1(record.mutationRef)
  const operationRef = parseProductionOperationRefV1(record.operationRef)
  if (sessionRef === null || parsedRevision === null || mutationRef === null || operationRef === null) return null
  return {
    record,
    common: Object.freeze({
      sessionRef,
      expectedRevision: parsedRevision,
      mutationRef,
      operationRef,
    }),
  }
}

function simpleRevisionCommand<C extends 'activate' | 'resume' | 'complete' | 'abandon'>(
  value: unknown,
  command: C,
): (ProductionSessionRevisionCommandV1 & Readonly<{ command: C }>) | null {
  return safely(() => {
    const parsed = parsedRevisionCommand(value, command)
    return parsed ? Object.freeze({ schemaVersion: 1 as const, command, ...parsed.common }) : null
  })
}

export const parseProductionSessionActivateRequestV1 = (
  value: unknown,
): ProductionSessionActivateRequestV1 | null => simpleRevisionCommand(value, 'activate')

export const parseProductionSessionResumeRequestV1 = (
  value: unknown,
): ProductionSessionResumeRequestV1 | null => simpleRevisionCommand(value, 'resume')

export const parseProductionSessionCompleteRequestV1 = (
  value: unknown,
): ProductionSessionCompleteRequestV1 | null => simpleRevisionCommand(value, 'complete')

export const parseProductionSessionAbandonRequestV1 = (
  value: unknown,
): ProductionSessionAbandonRequestV1 | null => simpleRevisionCommand(value, 'abandon')

export function parseProductionSessionPauseRequestV1(
  value: unknown,
): ProductionSessionPauseRequestV1 | null {
  return safely(() => {
    const parsed = parsedRevisionCommand(value, 'pause', ['pauseKind'])
    if (!parsed) return null
    const pauseKind = member(parsed.record.pauseKind, PRODUCTION_SESSION_PAUSE_KINDS)
    return pauseKind === null ? null : Object.freeze({
      schemaVersion: 1 as const,
      command: 'pause' as const,
      ...parsed.common,
      pauseKind,
    })
  })
}

export function parseProductionSessionInterruptRequestV1(
  value: unknown,
): ProductionSessionInterruptRequestV1 | null {
  return safely(() => {
    const parsed = parsedRevisionCommand(value, 'interrupt', ['interruptionKind'])
    if (!parsed || parsed.record.interruptionKind !== 'technical') return null
    return Object.freeze({
      schemaVersion: 1 as const,
      command: 'interrupt' as const,
      ...parsed.common,
      interruptionKind: 'technical' as const,
    })
  })
}

export function parseProductionSessionCommandRequestV1(
  value: unknown,
): ProductionSessionCommandRequestV1 | null {
  return safely(() => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
    const command = (value as Record<string, unknown>).command
    switch (command) {
      case 'begin': return parseProductionSessionBeginRequestV1(value)
      case 'activate': return parseProductionSessionActivateRequestV1(value)
      case 'resume': return parseProductionSessionResumeRequestV1(value)
      case 'pause': return parseProductionSessionPauseRequestV1(value)
      case 'interrupt': return parseProductionSessionInterruptRequestV1(value)
      case 'complete': return parseProductionSessionCompleteRequestV1(value)
      case 'abandon': return parseProductionSessionAbandonRequestV1(value)
      default: return null
    }
  })
}

export function parseProductionSessionReadResultV1(
  value: unknown,
): ProductionSessionReadResultV1 | null {
  return safely(() => {
    const infrastructure = parseProductionWireInfrastructureFailureV1(value)
    if (infrastructure) return infrastructure
    const short = exactRecord(value, ['schemaVersion', 'status'])
    if (short && short.schemaVersion === 1) {
      if (short.status === 'not-found') return Object.freeze({ schemaVersion: 1 as const, status: 'not-found' as const })
      if (short.status === 'integrity-failed') {
        return Object.freeze({ schemaVersion: 1 as const, status: 'integrity-failed' as const })
      }
    }
    const found = exactRecord(value, ['schemaVersion', 'status', 'session'])
    if (!found || found.schemaVersion !== 1 || found.status !== 'found') return null
    const session = parseProductionSessionDescriptorV1(found.session)
    return session === null
      ? null
      : Object.freeze({ schemaVersion: 1 as const, status: 'found' as const, session })
  })
}

const FAILURE_WITHOUT_REVISION = Object.freeze([
  'not-found',
  'idempotency-collision',
  'quarantined',
  'integrity-failed',
  'illegal-transition',
] as const)

function parseSessionMutationResult<S extends ProductionSessionStatusV1>(
  value: unknown,
  allowedSuccessStatuses: readonly S[],
  allowRevisionConflict: boolean,
): SessionStoredResultV1<S> | SessionMutationFailureV1 | null {
  return safely(() => {
    const infrastructure = parseProductionWireInfrastructureFailureV1(value)
    if (infrastructure) return infrastructure

    const short = exactRecord(value, ['schemaVersion', 'status'])
    if (short && short.schemaVersion === 1) {
      const status = member(short.status, FAILURE_WITHOUT_REVISION)
      if (status) return Object.freeze({ schemaVersion: 1 as const, status })
    }

    const conflict = exactRecord(value, ['schemaVersion', 'status', 'currentRevision'])
    if (allowRevisionConflict && conflict && conflict.schemaVersion === 1 && conflict.status === 'revision-conflict') {
      const currentRevision = revision(conflict.currentRevision)
      return currentRevision === null ? null : Object.freeze({
        schemaVersion: 1 as const,
        status: 'revision-conflict' as const,
        currentRevision,
      })
    }

    const stored = exactRecord(value, ['schemaVersion', 'status', 'session'])
    if (!stored || stored.schemaVersion !== 1 ||
      stored.status !== 'stored' && stored.status !== 'duplicate-replay') return null
    const session = parseProductionSessionDescriptorV1(stored.session)
    if (!session || !(allowedSuccessStatuses as readonly string[]).includes(session.status)) return null
    return Object.freeze({ schemaVersion: 1 as const, status: stored.status, session }) as SessionStoredResultV1<S>
  })
}

export const parseProductionSessionBeginResultV1 = (
  value: unknown,
): ProductionSessionBeginResultV1 | null =>
  parseSessionMutationResult(value, ['planned'], false) as ProductionSessionBeginResultV1 | null

export const parseProductionSessionActivateResultV1 = (
  value: unknown,
): ProductionSessionActivateResultV1 | null => parseSessionMutationResult(value, ['active'], true)

export const parseProductionSessionResumeResultV1 = (
  value: unknown,
): ProductionSessionResumeResultV1 | null => parseSessionMutationResult(value, ['active'], true)

export const parseProductionSessionPauseResultV1 = (
  value: unknown,
): ProductionSessionPauseResultV1 | null =>
  parseSessionMutationResult(value, ['paused', 'approved_break', 'student_requested_break'], true)

export const parseProductionSessionInterruptResultV1 = (
  value: unknown,
): ProductionSessionInterruptResultV1 | null =>
  parseSessionMutationResult(value, ['technical_interruption'], true)

export const parseProductionSessionCompleteResultV1 = (
  value: unknown,
): ProductionSessionCompleteResultV1 | null => parseSessionMutationResult(value, ['completed'], true)

export const parseProductionSessionAbandonResultV1 = (
  value: unknown,
): ProductionSessionAbandonResultV1 | null => parseSessionMutationResult(value, ['abandoned'], true)

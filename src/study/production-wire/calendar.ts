import {
  PRODUCTION_WIRE_MAX_DURATION_MINUTES,
  PRODUCTION_WIRE_MAX_SEGMENTS,
  boundedInteger,
  exactRecord,
  instant,
  localDate,
  member,
  parseProductionWireInfrastructureFailureV1,
  parseProductionCalendarBlockRefV1,
  parseProductionIdempotencyKeyV1,
  parseProductionOperationRefV1,
  parseProductionSegmentRefV1,
  parseProductionSourceRefV1,
  revision,
  safely,
  type ProductionCalendarBlockRefV1,
  type ProductionIdempotencyKeyV1,
  type ProductionOperationRefV1,
  type ProductionSegmentRefV1,
  type ProductionSourceRefV1,
  type ProductionWireInfrastructureFailureV1,
} from './common'

export const PRODUCTION_CALENDAR_BLOCK_TYPES = Object.freeze([
  'lesson',
  'review',
  'resume',
  'break',
  'assessment',
] as const)

/** These are durable production states, not preview presentation labels. */
export const PRODUCTION_CALENDAR_BLOCK_STATUSES = Object.freeze([
  'scheduled',
  'available',
  'in_progress',
  'completed',
  'cancelled',
] as const)

export type ProductionCalendarBlockTypeV1 = typeof PRODUCTION_CALENDAR_BLOCK_TYPES[number]
export type ProductionCalendarBlockStatusV1 = typeof PRODUCTION_CALENDAR_BLOCK_STATUSES[number]

export interface ProductionStudyCalendarEntryV1 {
  readonly schemaVersion: 1
  readonly blockRef: ProductionCalendarBlockRefV1
  readonly blockType: ProductionCalendarBlockTypeV1
  readonly sourceRef: ProductionSourceRefV1
  readonly scheduledStart: string
  readonly intendedLocalDate: string
  readonly durationMinutes: number
  readonly completedSegmentCount: number
  readonly requiredSegmentCount: number
  readonly status: ProductionCalendarBlockStatusV1
  readonly revision: number
  /** The server timestamp of the last accepted durable transition. */
  readonly transitionedAt: string
}

export interface ProductionCalendarBlockReadRequestV1 {
  readonly schemaVersion: 1
  readonly blockRef: ProductionCalendarBlockRefV1
  readonly operationRef: ProductionOperationRefV1
}

interface ProductionCalendarMutationRequestV1 {
  readonly schemaVersion: 1
  readonly blockRef: ProductionCalendarBlockRefV1
  readonly expectedRevision: number
  readonly idempotencyKey: ProductionIdempotencyKeyV1
  readonly operationRef: ProductionOperationRefV1
}

export interface ProductionCalendarStartRequestV1 extends ProductionCalendarMutationRequestV1 {
  readonly command: 'start'
}

export const PRODUCTION_CALENDAR_PAUSE_REASONS = Object.freeze([
  'student-request',
  'adult-directed',
  'scheduled',
  'accessibility-need',
] as const)
export type ProductionCalendarPauseReasonV1 = typeof PRODUCTION_CALENDAR_PAUSE_REASONS[number]

export interface ProductionCalendarPauseRequestV1 extends ProductionCalendarMutationRequestV1 {
  readonly command: 'pause'
  readonly pauseReason: ProductionCalendarPauseReasonV1
}

export interface ProductionCalendarResumeRequestV1 extends ProductionCalendarMutationRequestV1 {
  readonly command: 'resume'
}

export interface ProductionCalendarCompleteBlockRequestV1 extends ProductionCalendarMutationRequestV1 {
  readonly command: 'complete-block'
}

export interface ProductionCalendarCompleteSegmentRequestV1 extends ProductionCalendarMutationRequestV1 {
  readonly command: 'complete-segment'
  readonly segmentRef: ProductionSegmentRefV1
}

export type ProductionCalendarCommandRequestV1 =
  | ProductionCalendarStartRequestV1
  | ProductionCalendarPauseRequestV1
  | ProductionCalendarResumeRequestV1
  | ProductionCalendarCompleteBlockRequestV1
  | ProductionCalendarCompleteSegmentRequestV1

export type ProductionCalendarBlockReadResultV1 =
  | Readonly<{ schemaVersion: 1; status: 'found'; entry: ProductionStudyCalendarEntryV1 }>
  | Readonly<{ schemaVersion: 1; status: 'not-found' }>
  | Readonly<{ schemaVersion: 1; status: 'integrity-failed' }>
  | ProductionWireInfrastructureFailureV1

type CalendarStoredResultV1<S extends ProductionCalendarBlockStatusV1> =
  | Readonly<{
      schemaVersion: 1
      status: 'stored'
      entry: ProductionStudyCalendarEntryV1 & Readonly<{ status: S }>
    }>
  | Readonly<{
      schemaVersion: 1
      status: 'duplicate-replay'
      entry: ProductionStudyCalendarEntryV1 & Readonly<{ status: S }>
    }>

type CalendarMutationFailureV1 =
  | Readonly<{ schemaVersion: 1; status: 'not-found' }>
  | Readonly<{ schemaVersion: 1; status: 'revision-conflict'; currentRevision: number }>
  | Readonly<{ schemaVersion: 1; status: 'idempotency-collision' }>
  | Readonly<{ schemaVersion: 1; status: 'quarantined' }>
  | Readonly<{ schemaVersion: 1; status: 'integrity-failed' }>
  | Readonly<{ schemaVersion: 1; status: 'illegal-transition' }>
  | ProductionWireInfrastructureFailureV1

export type ProductionCalendarStartResultV1 = CalendarStoredResultV1<'in_progress'> | CalendarMutationFailureV1
export type ProductionCalendarPauseResultV1 = CalendarStoredResultV1<'available'> | CalendarMutationFailureV1
export type ProductionCalendarResumeResultV1 = CalendarStoredResultV1<'in_progress'> | CalendarMutationFailureV1
export type ProductionCalendarCompleteBlockResultV1 = CalendarStoredResultV1<'completed'> | CalendarMutationFailureV1
/** A stored segment completion keeps the block in progress; completing the block is a separate command. */
export type ProductionCalendarCompleteSegmentResultV1 = CalendarStoredResultV1<'in_progress'> | CalendarMutationFailureV1

const ENTRY_KEYS = Object.freeze([
  'schemaVersion',
  'blockRef',
  'blockType',
  'sourceRef',
  'scheduledStart',
  'intendedLocalDate',
  'durationMinutes',
  'completedSegmentCount',
  'requiredSegmentCount',
  'status',
  'revision',
  'transitionedAt',
] as const)

export function parseProductionStudyCalendarEntryV1(
  value: unknown,
): ProductionStudyCalendarEntryV1 | null {
  return safely(() => {
    const record = exactRecord(value, ENTRY_KEYS)
    if (!record || record.schemaVersion !== 1) return null
    const blockRef = parseProductionCalendarBlockRefV1(record.blockRef)
    const blockType = member(record.blockType, PRODUCTION_CALENDAR_BLOCK_TYPES)
    const sourceRef = parseProductionSourceRefV1(record.sourceRef)
    const scheduledStart = instant(record.scheduledStart)
    const intendedLocalDate = localDate(record.intendedLocalDate)
    const durationMinutes = boundedInteger(record.durationMinutes, 1, PRODUCTION_WIRE_MAX_DURATION_MINUTES)
    const completedSegmentCount = boundedInteger(record.completedSegmentCount, 0, PRODUCTION_WIRE_MAX_SEGMENTS)
    const requiredSegmentCount = boundedInteger(record.requiredSegmentCount, 1, PRODUCTION_WIRE_MAX_SEGMENTS)
    const status = member(record.status, PRODUCTION_CALENDAR_BLOCK_STATUSES)
    const entryRevision = revision(record.revision)
    const transitionedAt = instant(record.transitionedAt)
    if (
      blockRef === null ||
      blockType === null ||
      sourceRef === null ||
      scheduledStart === null ||
      intendedLocalDate === null ||
      durationMinutes === null ||
      completedSegmentCount === null ||
      requiredSegmentCount === null ||
      completedSegmentCount > requiredSegmentCount ||
      status === null ||
      entryRevision === null ||
      transitionedAt === null
    ) return null
    if (status === 'completed' && completedSegmentCount !== requiredSegmentCount) return null
    return Object.freeze({
      schemaVersion: 1 as const,
      blockRef,
      blockType,
      sourceRef,
      scheduledStart,
      intendedLocalDate,
      durationMinutes,
      completedSegmentCount,
      requiredSegmentCount,
      status,
      revision: entryRevision,
      transitionedAt,
    })
  })
}

export function parseProductionCalendarBlockReadRequestV1(
  value: unknown,
): ProductionCalendarBlockReadRequestV1 | null {
  return safely(() => {
    const record = exactRecord(value, ['schemaVersion', 'blockRef', 'operationRef'])
    if (!record || record.schemaVersion !== 1) return null
    const blockRef = parseProductionCalendarBlockRefV1(record.blockRef)
    const operationRef = parseProductionOperationRefV1(record.operationRef)
    return blockRef === null || operationRef === null
      ? null
      : Object.freeze({ schemaVersion: 1 as const, blockRef, operationRef })
  })
}

type ParsedCalendarMutation = Readonly<{
  record: Record<string, unknown>
  common: Readonly<{
    blockRef: ProductionCalendarBlockRefV1
    expectedRevision: number
    idempotencyKey: ProductionIdempotencyKeyV1
    operationRef: ProductionOperationRefV1
  }>
}>

function parsedCalendarMutation(
  value: unknown,
  command: string,
  extraKeys: readonly string[] = [],
): ParsedCalendarMutation | null {
  const record = exactRecord(value, [
    'schemaVersion',
    'command',
    'blockRef',
    'expectedRevision',
    'idempotencyKey',
    'operationRef',
    ...extraKeys,
  ])
  if (!record || record.schemaVersion !== 1 || record.command !== command) return null
  const blockRef = parseProductionCalendarBlockRefV1(record.blockRef)
  const expectedRevision = revision(record.expectedRevision)
  const idempotencyKey = parseProductionIdempotencyKeyV1(record.idempotencyKey)
  const operationRef = parseProductionOperationRefV1(record.operationRef)
  if (blockRef === null || expectedRevision === null || idempotencyKey === null || operationRef === null) return null
  return Object.freeze({
    record,
    common: Object.freeze({ blockRef, expectedRevision, idempotencyKey, operationRef }),
  })
}

function simpleCalendarCommand<C extends 'start' | 'resume' | 'complete-block'>(
  value: unknown,
  command: C,
): (ProductionCalendarMutationRequestV1 & Readonly<{ command: C }>) | null {
  return safely(() => {
    const parsed = parsedCalendarMutation(value, command)
    return parsed ? Object.freeze({ schemaVersion: 1 as const, command, ...parsed.common }) : null
  })
}

export const parseProductionCalendarStartRequestV1 = (
  value: unknown,
): ProductionCalendarStartRequestV1 | null => simpleCalendarCommand(value, 'start')

export const parseProductionCalendarResumeRequestV1 = (
  value: unknown,
): ProductionCalendarResumeRequestV1 | null => simpleCalendarCommand(value, 'resume')

export const parseProductionCalendarCompleteBlockRequestV1 = (
  value: unknown,
): ProductionCalendarCompleteBlockRequestV1 | null => simpleCalendarCommand(value, 'complete-block')

export function parseProductionCalendarPauseRequestV1(
  value: unknown,
): ProductionCalendarPauseRequestV1 | null {
  return safely(() => {
    const parsed = parsedCalendarMutation(value, 'pause', ['pauseReason'])
    if (!parsed) return null
    const pauseReason = member(parsed.record.pauseReason, PRODUCTION_CALENDAR_PAUSE_REASONS)
    return pauseReason === null ? null : Object.freeze({
      schemaVersion: 1 as const,
      command: 'pause' as const,
      ...parsed.common,
      pauseReason,
    })
  })
}

export function parseProductionCalendarCompleteSegmentRequestV1(
  value: unknown,
): ProductionCalendarCompleteSegmentRequestV1 | null {
  return safely(() => {
    const parsed = parsedCalendarMutation(value, 'complete-segment', ['segmentRef'])
    if (!parsed) return null
    const segmentRef = parseProductionSegmentRefV1(parsed.record.segmentRef)
    return segmentRef === null ? null : Object.freeze({
      schemaVersion: 1 as const,
      command: 'complete-segment' as const,
      ...parsed.common,
      segmentRef,
    })
  })
}

export function parseProductionCalendarCommandRequestV1(
  value: unknown,
): ProductionCalendarCommandRequestV1 | null {
  return safely(() => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
    const command = (value as Record<string, unknown>).command
    switch (command) {
      case 'start': return parseProductionCalendarStartRequestV1(value)
      case 'pause': return parseProductionCalendarPauseRequestV1(value)
      case 'resume': return parseProductionCalendarResumeRequestV1(value)
      case 'complete-block': return parseProductionCalendarCompleteBlockRequestV1(value)
      case 'complete-segment': return parseProductionCalendarCompleteSegmentRequestV1(value)
      default: return null
    }
  })
}

export function parseProductionCalendarBlockReadResultV1(
  value: unknown,
): ProductionCalendarBlockReadResultV1 | null {
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
    const found = exactRecord(value, ['schemaVersion', 'status', 'entry'])
    if (!found || found.schemaVersion !== 1 || found.status !== 'found') return null
    const entry = parseProductionStudyCalendarEntryV1(found.entry)
    return entry === null
      ? null
      : Object.freeze({ schemaVersion: 1 as const, status: 'found' as const, entry })
  })
}

const CALENDAR_FAILURES_WITHOUT_REVISION = Object.freeze([
  'not-found',
  'idempotency-collision',
  'quarantined',
  'integrity-failed',
  'illegal-transition',
] as const)

function parseCalendarMutationResult<S extends ProductionCalendarBlockStatusV1>(
  value: unknown,
  allowedSuccessStatus: S,
): CalendarStoredResultV1<S> | CalendarMutationFailureV1 | null {
  return safely(() => {
    const infrastructure = parseProductionWireInfrastructureFailureV1(value)
    if (infrastructure) return infrastructure
    const short = exactRecord(value, ['schemaVersion', 'status'])
    if (short && short.schemaVersion === 1) {
      const status = member(short.status, CALENDAR_FAILURES_WITHOUT_REVISION)
      if (status) return Object.freeze({ schemaVersion: 1 as const, status })
    }
    const conflict = exactRecord(value, ['schemaVersion', 'status', 'currentRevision'])
    if (conflict && conflict.schemaVersion === 1 && conflict.status === 'revision-conflict') {
      const currentRevision = revision(conflict.currentRevision)
      return currentRevision === null ? null : Object.freeze({
        schemaVersion: 1 as const,
        status: 'revision-conflict' as const,
        currentRevision,
      })
    }
    const stored = exactRecord(value, ['schemaVersion', 'status', 'entry'])
    if (!stored || stored.schemaVersion !== 1 ||
      stored.status !== 'stored' && stored.status !== 'duplicate-replay') return null
    const entry = parseProductionStudyCalendarEntryV1(stored.entry)
    if (!entry || entry.status !== allowedSuccessStatus) return null
    return Object.freeze({ schemaVersion: 1 as const, status: stored.status, entry }) as CalendarStoredResultV1<S>
  })
}

export const parseProductionCalendarStartResultV1 = (
  value: unknown,
): ProductionCalendarStartResultV1 | null => parseCalendarMutationResult(value, 'in_progress')

export const parseProductionCalendarPauseResultV1 = (
  value: unknown,
): ProductionCalendarPauseResultV1 | null => parseCalendarMutationResult(value, 'available')

export const parseProductionCalendarResumeResultV1 = (
  value: unknown,
): ProductionCalendarResumeResultV1 | null => parseCalendarMutationResult(value, 'in_progress')

export const parseProductionCalendarCompleteBlockResultV1 = (
  value: unknown,
): ProductionCalendarCompleteBlockResultV1 | null => parseCalendarMutationResult(value, 'completed')

export const parseProductionCalendarCompleteSegmentResultV1 = (
  value: unknown,
): ProductionCalendarCompleteSegmentResultV1 | null => parseCalendarMutationResult(value, 'in_progress')

import {
  exactRecord,
  instant,
  parseProductionWireInfrastructureFailureV1,
  parseProductionEventIdV1,
  parseProductionEventRefV1,
  parseProductionIdempotencyKeyV1,
  parseProductionOperationRefV1,
  parseProductionSessionRefV1,
  safely,
  type ProductionEventIdV1,
  type ProductionEventRefV1,
  type ProductionIdempotencyKeyV1,
  type ProductionOperationRefV1,
  type ProductionSessionRefV1,
  type ProductionWireInfrastructureFailureV1,
} from './common'

export const PRODUCTION_LEARNER_EVENT_KINDS_V1 = Object.freeze([
  'tutor_event_accepted',
] as const)

/**
 * The generic production append is deliberately not a free-form event bus.
 * Session lifecycle is written by session commands. Checkpoint saves, safety
 * stops, and parent control have their own authority lanes and cannot be named
 * here. There is no payload field in which learner content could be placed.
 */
export interface ProductionLearnerEventAppendRequestV1 {
  readonly schemaVersion: 1
  readonly eventKind: 'tutor_event_accepted'
  readonly sessionRef: ProductionSessionRefV1
  readonly eventId: ProductionEventIdV1
  readonly eventRef: ProductionEventRefV1
  readonly idempotencyKey: ProductionIdempotencyKeyV1
  readonly operationRef: ProductionOperationRefV1
}

export type ProductionLearnerEventAppendResultV1 =
  | Readonly<{
      schemaVersion: 1
      status: 'stored'
      eventId: ProductionEventIdV1
      eventRef: ProductionEventRefV1
      storedAt: string
    }>
  | Readonly<{
      schemaVersion: 1
      status: 'duplicate-replay'
      eventId: ProductionEventIdV1
      eventRef: ProductionEventRefV1
      storedAt: string
    }>
  | Readonly<{ schemaVersion: 1; status: 'not-found' }>
  | Readonly<{ schemaVersion: 1; status: 'idempotency-collision' }>
  | Readonly<{ schemaVersion: 1; status: 'quarantined' }>
  | Readonly<{ schemaVersion: 1; status: 'integrity-failed' }>
  | ProductionWireInfrastructureFailureV1

export function parseProductionLearnerEventAppendRequestV1(
  value: unknown,
): ProductionLearnerEventAppendRequestV1 | null {
  return safely(() => {
    const record = exactRecord(value, [
      'schemaVersion',
      'eventKind',
      'sessionRef',
      'eventId',
      'eventRef',
      'idempotencyKey',
      'operationRef',
    ])
    if (!record || record.schemaVersion !== 1 || record.eventKind !== 'tutor_event_accepted') return null
    const sessionRef = parseProductionSessionRefV1(record.sessionRef)
    const eventId = parseProductionEventIdV1(record.eventId)
    const eventRef = parseProductionEventRefV1(record.eventRef)
    const idempotencyKey = parseProductionIdempotencyKeyV1(record.idempotencyKey)
    const operationRef = parseProductionOperationRefV1(record.operationRef)
    if (
      sessionRef === null ||
      eventId === null ||
      eventRef === null ||
      idempotencyKey === null ||
      operationRef === null
    ) return null
    return Object.freeze({
      schemaVersion: 1 as const,
      eventKind: 'tutor_event_accepted' as const,
      sessionRef,
      eventId,
      eventRef,
      idempotencyKey,
      operationRef,
    })
  })
}

export function parseProductionLearnerEventAppendResultV1(
  value: unknown,
): ProductionLearnerEventAppendResultV1 | null {
  return safely(() => {
    const infrastructure = parseProductionWireInfrastructureFailureV1(value)
    if (infrastructure) return infrastructure
    const short = exactRecord(value, ['schemaVersion', 'status'])
    if (short && short.schemaVersion === 1 && (
      short.status === 'not-found' ||
      short.status === 'idempotency-collision' ||
      short.status === 'quarantined' ||
      short.status === 'integrity-failed'
    )) {
      return Object.freeze({ schemaVersion: 1 as const, status: short.status }) as ProductionLearnerEventAppendResultV1
    }
    const stored = exactRecord(value, [
      'schemaVersion',
      'status',
      'eventId',
      'eventRef',
      'storedAt',
    ])
    if (!stored || stored.schemaVersion !== 1 ||
      stored.status !== 'stored' && stored.status !== 'duplicate-replay') return null
    const eventId = parseProductionEventIdV1(stored.eventId)
    const eventRef = parseProductionEventRefV1(stored.eventRef)
    const storedAt = instant(stored.storedAt)
    if (eventId === null || eventRef === null || storedAt === null) return null
    return Object.freeze({
      schemaVersion: 1 as const,
      status: stored.status,
      eventId,
      eventRef,
      storedAt,
    })
  })
}

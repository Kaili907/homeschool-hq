import {
  PRODUCTION_WIRE_MAX_ACTIVE_SECONDS,
  PRODUCTION_WIRE_MAX_SEGMENTS,
  boundedInteger,
  distinctArray,
  exactRecord,
  expectedRevision,
  instant,
  parseProductionWireInfrastructureFailureV1,
  parseProductionCheckpointRefV1,
  parseProductionEventRefV1,
  parseProductionLessonRefV1,
  parseProductionMutationRefV1,
  parseProductionSegmentRefV1,
  parseProductionSessionRefV1,
  revision,
  safely,
  snapshotDataRecord,
  type ProductionCheckpointRefV1,
  type ProductionEventRefV1,
  type ProductionLessonRefV1,
  type ProductionMutationRefV1,
  type ProductionSegmentRefV1,
  type ProductionSessionRefV1,
  type ProductionWireInfrastructureFailureV1,
} from './common'

export const PRODUCTION_CHECKPOINT_CONTENT_POLICY_V1 = 'learner-content-excluded-v1' as const

/**
 * A production checkpoint is intentionally not the legacy Tutor recovery
 * checkpoint. It contains progress references and bounded counters only. Raw
 * answers, conversation/transcript data, Tutor cursor/state, protected-work
 * references, and diagnostic or personality data have no field in this shape.
 * Session identity and the server revision live in the CAS envelope, not here.
 */
export interface ProductionCheckpointWireV1 {
  readonly schemaVersion: 1
  readonly contentPolicy: typeof PRODUCTION_CHECKPOINT_CONTENT_POLICY_V1
  readonly checkpointRef: ProductionCheckpointRefV1
  readonly lessonRef: ProductionLessonRefV1
  readonly segmentRef: ProductionSegmentRefV1
  readonly completedSegmentRefs: readonly ProductionSegmentRefV1[]
  readonly elapsedActiveSecondsInSegment: number
  readonly lastAcceptedEventRef: ProductionEventRefV1 | null
}

export interface ProductionCheckpointReadRequestV1 {
  readonly schemaVersion: 1
  readonly sessionRef: ProductionSessionRefV1
}

export interface ProductionCheckpointCasRequestV1 {
  readonly schemaVersion: 1
  readonly sessionRef: ProductionSessionRefV1
  readonly expectedRevision: number | null
  readonly mutationRef: ProductionMutationRefV1
  readonly checkpoint: ProductionCheckpointWireV1
}

export type ProductionCheckpointReadResultV1 =
  | Readonly<{
      schemaVersion: 1
      status: 'found'
      sessionRef: ProductionSessionRefV1
      revision: number
      storedAt: string
      checkpoint: ProductionCheckpointWireV1
    }>
  | Readonly<{ schemaVersion: 1; status: 'not-found' }>
  | Readonly<{ schemaVersion: 1; status: 'integrity-failed' }>
  | ProductionWireInfrastructureFailureV1

export type ProductionCheckpointCasResultV1 =
  | Readonly<{ schemaVersion: 1; status: 'stored'; revision: number; storedAt: string }>
  | Readonly<{ schemaVersion: 1; status: 'duplicate-replay'; revision: number; storedAt: string }>
  | Readonly<{ schemaVersion: 1; status: 'not-found' }>
  | Readonly<{ schemaVersion: 1; status: 'revision-conflict'; currentRevision: number }>
  | Readonly<{ schemaVersion: 1; status: 'idempotency-collision' }>
  | Readonly<{ schemaVersion: 1; status: 'quarantined' }>
  | Readonly<{ schemaVersion: 1; status: 'integrity-failed' }>
  | ProductionWireInfrastructureFailureV1

const CHECKPOINT_KEYS = Object.freeze([
  'schemaVersion',
  'contentPolicy',
  'checkpointRef',
  'lessonRef',
  'segmentRef',
  'completedSegmentRefs',
  'elapsedActiveSecondsInSegment',
  'lastAcceptedEventRef',
] as const)

export function parseProductionCheckpointWireV1(value: unknown): ProductionCheckpointWireV1 | null {
  return safely(() => {
    const record = exactRecord(value, CHECKPOINT_KEYS)
    if (
      !record ||
      record.schemaVersion !== 1 ||
      record.contentPolicy !== PRODUCTION_CHECKPOINT_CONTENT_POLICY_V1
    ) return null

    const checkpointRef = parseProductionCheckpointRefV1(record.checkpointRef)
    const lessonRef = parseProductionLessonRefV1(record.lessonRef)
    const segmentRef = parseProductionSegmentRefV1(record.segmentRef)
    const completedSegmentRefs = distinctArray(
      record.completedSegmentRefs,
      PRODUCTION_WIRE_MAX_SEGMENTS,
      parseProductionSegmentRefV1,
    )
    const elapsedActiveSecondsInSegment = boundedInteger(
      record.elapsedActiveSecondsInSegment,
      0,
      PRODUCTION_WIRE_MAX_ACTIVE_SECONDS,
    )
    const lastAcceptedEventRef = record.lastAcceptedEventRef === null
      ? null
      : parseProductionEventRefV1(record.lastAcceptedEventRef)

    if (
      checkpointRef === null ||
      lessonRef === null ||
      segmentRef === null ||
      completedSegmentRefs === null ||
      elapsedActiveSecondsInSegment === null ||
      lastAcceptedEventRef === null && record.lastAcceptedEventRef !== null
    ) return null

    return Object.freeze({
      schemaVersion: 1 as const,
      contentPolicy: PRODUCTION_CHECKPOINT_CONTENT_POLICY_V1,
      checkpointRef,
      lessonRef,
      segmentRef,
      completedSegmentRefs,
      elapsedActiveSecondsInSegment,
      lastAcceptedEventRef,
    })
  })
}

export function parseProductionCheckpointReadRequestV1(
  value: unknown,
): ProductionCheckpointReadRequestV1 | null {
  return safely(() => {
    const record = exactRecord(value, ['schemaVersion', 'sessionRef'])
    if (!record || record.schemaVersion !== 1) return null
    const sessionRef = parseProductionSessionRefV1(record.sessionRef)
    return sessionRef === null ? null : Object.freeze({ schemaVersion: 1 as const, sessionRef })
  })
}

export function parseProductionCheckpointCasRequestV1(
  value: unknown,
): ProductionCheckpointCasRequestV1 | null {
  return safely(() => {
    const record = exactRecord(value, [
      'schemaVersion',
      'sessionRef',
      'expectedRevision',
      'mutationRef',
      'checkpoint',
    ])
    if (!record || record.schemaVersion !== 1) return null
    const sessionRef = parseProductionSessionRefV1(record.sessionRef)
    const parsedExpectedRevision = expectedRevision(record.expectedRevision)
    const mutationRef = parseProductionMutationRefV1(record.mutationRef)
    const checkpoint = parseProductionCheckpointWireV1(record.checkpoint)
    if (
      sessionRef === null ||
      parsedExpectedRevision === undefined ||
      mutationRef === null ||
      checkpoint === null
    ) return null
    return Object.freeze({
      schemaVersion: 1 as const,
      sessionRef,
      expectedRevision: parsedExpectedRevision,
      mutationRef,
      checkpoint,
    })
  })
}

export function parseProductionCheckpointReadResultV1(
  value: unknown,
): ProductionCheckpointReadResultV1 | null {
  return safely(() => {
    const record = snapshotDataRecord(value)
    if (!record) return null
    const infrastructure = parseProductionWireInfrastructureFailureV1(record)
    if (infrastructure) return infrastructure

    const short = exactRecord(record, ['schemaVersion', 'status'])
    if (short && short.schemaVersion === 1) {
      if (short.status === 'not-found') return Object.freeze({ schemaVersion: 1 as const, status: 'not-found' as const })
      if (short.status === 'integrity-failed') {
        return Object.freeze({ schemaVersion: 1 as const, status: 'integrity-failed' as const })
      }
    }

    const found = exactRecord(record, [
      'schemaVersion',
      'status',
      'sessionRef',
      'revision',
      'storedAt',
      'checkpoint',
    ])
    if (!found || found.schemaVersion !== 1 || found.status !== 'found') return null
    const sessionRef = parseProductionSessionRefV1(found.sessionRef)
    const storedRevision = revision(found.revision)
    const storedAt = instant(found.storedAt)
    const checkpoint = parseProductionCheckpointWireV1(found.checkpoint)
    if (sessionRef === null || storedRevision === null || storedAt === null || checkpoint === null) return null
    return Object.freeze({
      schemaVersion: 1 as const,
      status: 'found' as const,
      sessionRef,
      revision: storedRevision,
      storedAt,
      checkpoint,
    })
  })
}

export function parseProductionCheckpointCasResultV1(
  value: unknown,
): ProductionCheckpointCasResultV1 | null {
  return safely(() => {
    const record = snapshotDataRecord(value)
    if (!record) return null
    const infrastructure = parseProductionWireInfrastructureFailureV1(record)
    if (infrastructure) return infrastructure

    const short = exactRecord(record, ['schemaVersion', 'status'])
    if (short && short.schemaVersion === 1) {
      if (short.status === 'not-found' ||
        short.status === 'idempotency-collision' ||
        short.status === 'quarantined' ||
        short.status === 'integrity-failed') {
        return Object.freeze({ schemaVersion: 1 as const, status: short.status }) as ProductionCheckpointCasResultV1
      }
    }

    const conflict = exactRecord(record, ['schemaVersion', 'status', 'currentRevision'])
    if (conflict && conflict.schemaVersion === 1 && conflict.status === 'revision-conflict') {
      const currentRevision = revision(conflict.currentRevision)
      return currentRevision === null ? null : Object.freeze({
        schemaVersion: 1 as const,
        status: 'revision-conflict' as const,
        currentRevision,
      })
    }

    const stored = exactRecord(record, ['schemaVersion', 'status', 'revision', 'storedAt'])
    if (!stored || stored.schemaVersion !== 1 ||
      stored.status !== 'stored' && stored.status !== 'duplicate-replay') return null
    const storedRevision = revision(stored.revision)
    const storedAt = instant(stored.storedAt)
    if (storedRevision === null || storedAt === null) return null
    return Object.freeze({
      schemaVersion: 1 as const,
      status: stored.status,
      revision: storedRevision,
      storedAt,
    })
  })
}

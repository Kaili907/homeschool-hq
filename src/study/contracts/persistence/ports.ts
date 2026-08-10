import type {
  AdultNoteWrite,
  EventAppendResult,
  ProtectedWorkWrite,
  StoredResult,
  StudyCalendarBlockRecord,
  StudyCheckpointRecord,
  StudyParentSettingsRecord,
  StudyReviewRecord,
  StudySessionRecord,
  Uuid,
} from './types'
import type { StudyEffectiveSettingsResult } from '../../effectiveSettings'

export interface StudyPersistencePort {
  createSession(
    session: StudySessionRecord,
    idempotencyKey: string,
  ): Promise<{ status: 'created'; sessionId: string; revision: number } | { status: 'idempotency-collision' }>
  transitionSession(input: {
    sessionId: string
    expectedRevision: number
    state: StudySessionRecord['state']
    completedAt: string | null
    idempotencyKey: string
  }): Promise<StoredResult>
}

export interface StudyCheckpointPort {
  readCheckpoint(sessionId: string): Promise<StudyCheckpointRecord | null>
  compareAndSwapCheckpoint(
    checkpoint: StudyCheckpointRecord,
    expectedRevision: number | null,
  ): Promise<
    | { status: 'stored'; revision: number }
    | { status: 'revision-conflict'; currentRevision: number }
    | { status: 'quarantined'; quarantine: Record<string, unknown> }
  >
}

export interface StudyReviewQueuePort {
  upsertReview(
    review: StudyReviewRecord,
    expectedRevision: number,
    idempotencyKey: string,
  ): Promise<StoredResult>
}

export interface StudyCalendarPort {
  upsertCalendarBlock(
    block: StudyCalendarBlockRecord,
    expectedRevision: number,
    idempotencyKey: string,
  ): Promise<StoredResult>
}

export interface StudyParentSettingsPort {
  upsertParentSettings(
    settings: StudyParentSettingsRecord,
    expectedRevision: number,
    idempotencyKey: string,
  ): Promise<StoredResult>
  effectiveSettings(studentId: Uuid, effectiveDate?: string): Promise<StudyEffectiveSettingsResult>
}

export interface StudyAdultPrivatePort {
  storeProtectedWork(work: ProtectedWorkWrite): Promise<Record<string, unknown>>
  readProtectedWork(
    studentId: Uuid,
    id: string,
    revision: number,
  ): Promise<Record<string, unknown>>
  appendAdultNote(note: AdultNoteWrite): Promise<StoredResult>
  listAdultNoteMetadata(studentId: Uuid): Promise<ReadonlyArray<Record<string, unknown>>>
  readAdultNote(input: {
    studentId: Uuid
    noteId: string
    revision: number
    correlationId: Uuid
  }): Promise<Record<string, unknown>>
}

export interface StudyEventLedgerPort {
  appendAcceptedEvent(
    sessionId: string,
    eventId: string,
    eventVersion: number,
    idempotencyKey: string,
  ): Promise<EventAppendResult>
}

export interface StudyOutboxPort {
  createAdultReviewProposal(
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>>
  enqueue(input: Record<string, unknown>): Promise<Record<string, unknown>>
  transition(input: Record<string, unknown>): Promise<Record<string, unknown>>
  status(outboxId: Uuid): Promise<Record<string, unknown> | null>
}

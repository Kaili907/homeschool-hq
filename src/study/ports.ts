import type {
  StudyAdultAuthorization,
  StudyCalendarDraft,
  StudyCalendarEntry,
  StudyCheckpoint,
  StudyLearnerPreferences,
  StudyLearnerScope,
  StudyOutboxProposal,
  StudyParentControlResult,
  StudyParentPublicCommand,
  StudyParentSettings,
  StudyReviewRecommendation,
  StudySafeEvent,
  StudySafetyRequest,
  StudySafetyResult,
  StudyScope,
  StudySessionSnapshot,
} from './types'

export interface StudyPersistencePort {
  loadSession(scope: StudyScope): Promise<StudySessionSnapshot | null>
  saveSession(snapshot: StudySessionSnapshot): Promise<void>
  loadPreferences(scope: StudyLearnerScope): Promise<StudyLearnerPreferences>
  savePreferences(scope: StudyLearnerScope, preferences: StudyLearnerPreferences): Promise<void>
}

export interface StudyCheckpointPort {
  loadLatest(scope: StudyScope): Promise<StudyCheckpoint | null>
  save(checkpoint: StudyCheckpoint): Promise<'saved' | 'duplicate-ignored'>
}

export interface StudyReviewQueuePort {
  list(scope: StudyLearnerScope): Promise<readonly StudyReviewRecommendation[]>
  enqueue(recommendation: StudyReviewRecommendation): Promise<'enqueued' | 'duplicate-ignored'>
  decide(
    scope: StudyLearnerScope,
    recommendationRef: string,
    decision: 'accepted' | 'rejected',
  ): Promise<void>
}

export interface StudyCalendarPort {
  list(scope: StudyLearnerScope): Promise<readonly StudyCalendarEntry[]>
  create(scope: StudyLearnerScope, draft: StudyCalendarDraft): Promise<StudyCalendarEntry>
  start(scope: StudyLearnerScope, blockRef: string, at: string): Promise<StudyCalendarEntry>
  pause(
    scope: StudyLearnerScope,
    blockRef: string,
    at: string,
    category: 'planned_break' | 'requested_break' | 'outside_interruption' | 'technical_interruption',
  ): Promise<StudyCalendarEntry>
  resume(scope: StudyLearnerScope, blockRef: string, at: string): Promise<StudyCalendarEntry>
  completeCurrentSegment(
    scope: StudyLearnerScope,
    blockRef: string,
    segmentRef: string,
    at: string,
  ): Promise<StudyCalendarEntry>
  createContinuation(
    scope: StudyLearnerScope,
    blockRef: string,
    continuationRef: string,
    continuationKey: string,
    scheduledLocalStart: string,
    scheduledStart: string,
    intendedLocalDate: string,
    at: string,
  ): Promise<{ readonly entry: StudyCalendarEntry; readonly created: boolean }>
}

export interface StudyParentSettingsPort {
  read(scope: StudyLearnerScope): Promise<StudyParentSettings>
  apply(
    scope: StudyLearnerScope,
    authorization: StudyAdultAuthorization,
    command: StudyParentPublicCommand,
    expectedRevision: number,
  ): Promise<StudyParentControlResult>
}

export interface StudyAdultPrivatePort {
  commit(
    scope: StudyLearnerScope,
    authorization: StudyAdultAuthorization,
    note: { readonly noteRef: string; readonly category: string; readonly body: string },
  ): Promise<{ readonly status: 'authorized-and-committed' }>
}

export interface StudyEventLedgerPort {
  append(
    scope: StudyScope,
    event: StudySafeEvent,
  ): Promise<'appended' | 'duplicate-ignored' | 'idempotency-collision'>
}

export interface StudyOutboxPort {
  propose(scope: StudyLearnerScope, proposal: StudyOutboxProposal): Promise<'proposed-not-delivered'>
}

export interface StudySafetyPort {
  readonly mode: 'local-development' | 'production'
  readonly classifierVersion: string
  evaluate(request: StudySafetyRequest): StudySafetyResult
}

export interface StudyPortBundle {
  readonly persistence: StudyPersistencePort
  readonly checkpoint: StudyCheckpointPort
  readonly reviewQueue: StudyReviewQueuePort
  readonly calendar: StudyCalendarPort
  readonly parentSettings: StudyParentSettingsPort
  readonly adultPrivate: StudyAdultPrivatePort
  readonly eventLedger: StudyEventLedgerPort
  readonly outbox: StudyOutboxPort
  readonly safety: StudySafetyPort
}

export function assertCompleteStudyPortBundle(ports: Partial<StudyPortBundle>): asserts ports is StudyPortBundle {
  const required: readonly (keyof StudyPortBundle)[] = [
    'persistence',
    'checkpoint',
    'reviewQueue',
    'calendar',
    'parentSettings',
    'adultPrivate',
    'eventLedger',
    'outbox',
    'safety',
  ]
  const missing = required.filter((key) => !ports[key])
  if (missing.length > 0) throw new Error(`Study integration unavailable: missing ${missing.join(', ')} port.`)
}

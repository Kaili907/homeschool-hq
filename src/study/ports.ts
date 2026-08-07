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
import type { StudyOperationContext } from './lifecycle'

export interface StudyPersistencePort {
  loadSession(scope: StudyScope, operation?: StudyOperationContext): Promise<StudySessionSnapshot | null>
  saveSession(snapshot: StudySessionSnapshot, operation?: StudyOperationContext): Promise<void>
  loadPreferences(scope: StudyLearnerScope, operation?: StudyOperationContext): Promise<StudyLearnerPreferences>
  savePreferences(scope: StudyLearnerScope, preferences: StudyLearnerPreferences, operation?: StudyOperationContext): Promise<void>
}

export interface StudyCheckpointPort {
  loadLatest(scope: StudyScope, operation?: StudyOperationContext): Promise<StudyCheckpoint | null>
  save(checkpoint: StudyCheckpoint, operation?: StudyOperationContext): Promise<'saved' | 'duplicate-ignored'>
}

export interface StudyReviewQueuePort {
  list(scope: StudyLearnerScope, operation?: StudyOperationContext): Promise<readonly StudyReviewRecommendation[]>
  enqueue(recommendation: StudyReviewRecommendation, operation?: StudyOperationContext): Promise<'enqueued' | 'duplicate-ignored'>
  decide(
    scope: StudyLearnerScope,
    recommendationRef: string,
    decision: 'accepted' | 'rejected',
    operation?: StudyOperationContext,
  ): Promise<void>
}

export interface StudyCalendarPort {
  list(scope: StudyLearnerScope, operation?: StudyOperationContext): Promise<readonly StudyCalendarEntry[]>
  create(scope: StudyLearnerScope, draft: StudyCalendarDraft, operation?: StudyOperationContext): Promise<StudyCalendarEntry>
  start(scope: StudyLearnerScope, blockRef: string, at: string, operation?: StudyOperationContext): Promise<StudyCalendarEntry>
  pause(
    scope: StudyLearnerScope,
    blockRef: string,
    at: string,
    category: 'planned_break' | 'requested_break' | 'outside_interruption' | 'technical_interruption',
    operation?: StudyOperationContext,
  ): Promise<StudyCalendarEntry>
  resume(scope: StudyLearnerScope, blockRef: string, at: string, operation?: StudyOperationContext): Promise<StudyCalendarEntry>
  completeCurrentSegment(
    scope: StudyLearnerScope,
    blockRef: string,
    segmentRef: string,
    at: string,
    operation?: StudyOperationContext,
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
    operation?: StudyOperationContext,
  ): Promise<{ readonly entry: StudyCalendarEntry; readonly created: boolean }>
}

export interface StudyParentSettingsPort {
  read(scope: StudyLearnerScope, operation?: StudyOperationContext): Promise<StudyParentSettings>
  apply(
    scope: StudyLearnerScope,
    authorization: StudyAdultAuthorization,
    command: StudyParentPublicCommand,
    expectedRevision: number,
    operation?: StudyOperationContext,
  ): Promise<StudyParentControlResult>
}

export interface StudyAdultPrivatePort {
  commit(
    scope: StudyLearnerScope,
    authorization: StudyAdultAuthorization,
    note: { readonly noteRef: string; readonly category: string; readonly body: string },
    operation?: StudyOperationContext,
  ): Promise<{ readonly status: 'authorized-and-committed' }>
}

export interface StudyEventLedgerPort {
  append(
    scope: StudyScope,
    event: StudySafeEvent,
    operation?: StudyOperationContext,
  ): Promise<'appended' | 'duplicate-ignored' | 'idempotency-collision'>
}

export interface StudyOutboxPort {
  propose(scope: StudyLearnerScope, proposal: StudyOutboxProposal, operation?: StudyOperationContext): Promise<'proposed-not-delivered'>
}

export interface StudySafetyPort {
  readonly mode: 'local-development' | 'production'
  readonly classifierVersion: string
  evaluate(
    request: StudySafetyRequest,
    operation?: StudyOperationContext,
  ): StudySafetyResult | Promise<StudySafetyResult>
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

/**
 * Narrow consumer contracts.
 *
 * Each names exactly the port methods one Study surface genuinely calls, so a
 * host composing that surface need not supply — or fabricate — roles it never
 * exercises. They are derived from the canonical interfaces above with Pick<>,
 * so a signature change there reaches every consumer instead of drifting behind
 * a duplicated copy.
 *
 * StudyPortBundle remains the complete nine-role preview/full-host contract:
 * narrowing what a consumer requires does not narrow what "complete" means, and
 * assertCompleteStudyPortBundle still demands all nine roles.
 */

/**
 * calendar.create is required because the dashboard seeds the local-development
 * preview day through ensureLocalDevelopmentStudyDay. It is a real call on the
 * current component, not an aspirational one.
 */
export interface StudyDashboardPorts {
  readonly calendar: Pick<StudyCalendarPort, 'list' | 'create'>
  readonly reviewQueue: Pick<StudyReviewQueuePort, 'list'>
}

export interface StudySettingsPorts {
  readonly persistence: Pick<StudyPersistencePort, 'loadPreferences' | 'savePreferences'>
}

/**
 * Shared by StudyParentController and the parent panel that drives it. The
 * panel's own reads (parentSettings.read, calendar.list, reviewQueue.list) are a
 * strict subset of the controller's, so a second alias would draw a distinction
 * the source does not support.
 *
 * parentSettings, adultPrivate, and outbox appear whole because the parent
 * control path calls every method those roles declare.
 */
export interface StudyParentControlPorts {
  readonly calendar: Pick<StudyCalendarPort, 'list' | 'pause' | 'createContinuation'>
  readonly reviewQueue: Pick<StudyReviewQueuePort, 'list' | 'decide'>
  readonly parentSettings: StudyParentSettingsPort
  readonly adultPrivate: StudyAdultPrivatePort
  readonly outbox: StudyOutboxPort
}

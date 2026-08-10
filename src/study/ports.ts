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
  /**
   * LEGACY SURFACE, RETAINED — see the production subset at the end of this file.
   *
   * Zero callers outside tests today, and that is not evidence it is dead. It is
   * the read half of the pair `saveSession({ status: 'active' })` writes: the
   * mount always writes a fresh active row rather than reading one back, so the
   * resume path this row exists for has not been built yet. All three adapters
   * implement it and the launch-ordering integration tests assert through it.
   * Deliberately NOT `@deprecated` — deprecating a read whose write is live
   * would say the row is going away, and it is not.
   *
   * It is absent from `ProductionStudyPersistencePort` because the learner
   * session does not call it, which is a different statement from retiring it.
   */
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
  /**
   * @deprecated Browser-side enqueue is not the production producer.
   *
   * Zero non-test callers, and unlike `loadSession` there is no production
   * caller coming: a review recommendation is derived from accepted evidence
   * server-side, and the browser's part is `list` and `decide`, both of which
   * are called. The local-development adapter retains `enqueue`, and focused
   * tests use it to seed recommendations and verify idempotency behavior.
   * Preview-day seeding is unrelated: it uses `calendar.create`.
   *
   * Kept, marked, and out of the production session subset entirely — the
   * learner session has no review-queue role at all.
   */
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

/* -------------------------------------------------------------------------- *
 * STUDY-A1-PROD-PORT-CONTRACT-SPLIT — the production learner-session subset.
 *
 * `StudyPortBundle` is nine roles because it is the *household's* surface: the
 * dashboard, the parent panel and the settings screen are inside it too. The
 * production-port architecture found that no session-route consumer needs all
 * nine. A learner session lists and transitions a calendar block, checkpoints
 * on a break, appends safe events, saves the session row, and asks the safety
 * port about a turn. Five roles. The four it never touches — reviewQueue,
 * parentSettings, adultPrivate, outbox — are not "not used yet"; they are
 * somebody else's screen.
 *
 * Asking for nine to open a session is not a harmless over-ask. It tells a
 * deployment that can run a Study session but cannot yet deliver an adult
 * review that it must hand over an `outbox` anyway, and the only thing it can
 * hand over is a stub whose `propose` resolves `'proposed-not-delivered'` —
 * which is indistinguishable, at the type level and at the assert, from a real
 * one that genuinely did not deliver. The completeness check then passes on a
 * bundle that cannot do what it says.
 *
 * Nothing below is wired. The route stays dark and Study stays unauthorized;
 * this is the contract the production adapters get written against, and every
 * existing preview and local adapter satisfies it unchanged.
 * -------------------------------------------------------------------------- */

/**
 * What a durable write needs the caller to state, and what the preview and
 * local adapters have never had to.
 *
 * The preview adapters are a Map in a closure: last write wins and a replay is
 * harmless. A production adapter is a row carrying a revision and a uniqueness
 * constraint on the mutation id, and it cannot answer "did this store?" without
 * being told which revision the caller believed was current and which write
 * this is.
 *
 * This contract makes CAS and idempotency intent expressible; it does not
 * enforce either one. Existing callers may omit `write`, and existing adapters
 * do. The later production wire/adapter line must supply real
 * `expectedRevision` and `mutationRef` values and enforce them; this contract
 * split must not synthesize either value.
 *
 * `StudyOperationContext.operationRef` looks like it would already do this job,
 * and it is deliberately not reused. It is optional, it identifies a lifecycle
 * operation rather than a write, and one operation can perform two writes — a
 * checkpoint and a session row — which would then collide on a single id.
 */
export interface StudyDurableWriteIntent {
  /** The revision the caller believes is stored. `null` asserts "none yet". */
  readonly expectedRevision: number | null
  /** Stable per-write id. The same id presented twice must store once. */
  readonly mutationRef: string
}

/**
 * Every answer a durable write can honestly give.
 *
 * `'saved' | 'duplicate-ignored'` — today's entire vocabulary — cannot express
 * three of these, and an adapter forced to answer in it must choose a lie for
 * each. A revision conflict reported as `'saved'` tells the caller its write
 * landed when another writer's is the one stored. Reported as
 * `'duplicate-ignored'` it says the caller already wrote this, which is the
 * opposite of what happened and is the reading under which a retry looks
 * unnecessary. Quarantine has no nearest neighbour at all.
 *
 * The statuses line up with `StoredResult` and `EventAppendResult` in
 * ./contracts/persistence/types.ts, so the server-side contract this surface
 * eventually speaks to maps on without inventing a status. Payloads carry only
 * what a caller can act on: the new revision to write against next, and the
 * current revision to re-read from. A quarantine record is diagnostic and stays
 * server-side — the browser's only correct response is to stop and say so.
 */
export type StudyDurableWriteOutcome =
  | { readonly status: 'saved'; readonly revision: number }
  | { readonly status: 'duplicate-ignored' }
  | { readonly status: 'revision-conflict'; readonly currentRevision: number }
  | { readonly status: 'idempotency-collision' }
  | { readonly status: 'quarantined' }

/**
 * The calendar methods a learner session actually calls: `list` to find the
 * block (StudySessionRoute), `start` and `resume` to open it, `pause` for a
 * break, and `completeCurrentSegment` on the way out.
 *
 * Absent on purpose. `create` belongs to StudyDashboard's preview-day seeding,
 * which a session never performs. `createContinuation` is called by
 * `StudyParentController` when an authorized adult reschedules incomplete work.
 * Both remain on `StudyCalendarPort`, but neither belongs to learner-session
 * capability.
 *
 * Derived by `Pick` rather than restated so the shared signatures cannot drift:
 * a change to `pause`'s category union has to reach both sides at once.
 */
export type ProductionStudyCalendarPort = Pick<
  StudyCalendarPort,
  'list' | 'start' | 'pause' | 'resume' | 'completeCurrentSegment'
>

/**
 * Checkpoint reads and writes for a learner session.
 *
 * `save` gains the write intent as a THIRD and OPTIONAL parameter, which is not
 * where it would go if this were being written from scratch. It goes there
 * because both the existing two-parameter adapters and the existing
 * `save(checkpoint)` call sites must keep compiling and keep behaving
 * identically: an implementation may ignore a parameter it never declared, and
 * a caller that omits it gets exactly today's behaviour. Placing it second
 * would put an unrelated type opposite `operation` and make every current
 * adapter unassignable.
 *
 * The legacy string results stay in the return union for the same reason. A
 * production adapter answers in `StudyDurableWriteOutcome`; a preview adapter
 * keeps answering `'saved'`. Neither has to lie, and no current caller — none
 * of them reads this result — changes.
 */
export interface ProductionStudyCheckpointPort {
  loadLatest(scope: StudyScope, operation?: StudyOperationContext): Promise<StudyCheckpoint | null>
  save(
    checkpoint: StudyCheckpoint,
    operation?: StudyOperationContext,
    write?: StudyDurableWriteIntent,
  ): Promise<'saved' | 'duplicate-ignored' | StudyDurableWriteOutcome>
}

/**
 * Session-row writes for a learner session, and nothing else.
 *
 * `loadSession`, `loadPreferences` and `savePreferences` are all on
 * `StudyPersistencePort` and none of them is reached from a session — the
 * preferences pair belongs to StudySettings. See the note on `loadSession`
 * above for why absence here is not deprecation.
 *
 * `Promise<void>` stays in the return union so the current adapters, which
 * resolve nothing, remain assignable while a production adapter reports what
 * its row actually did.
 */
export interface ProductionStudyPersistencePort {
  saveSession(
    snapshot: StudySessionSnapshot,
    operation?: StudyOperationContext,
    write?: StudyDurableWriteIntent,
  ): Promise<void | StudyDurableWriteOutcome>
}

/**
 * The five roles a production learner session needs, and no others.
 *
 * `eventLedger` remains whole because `append` is its sole member. Learner-session
 * code reads `safety.mode` and calls `evaluate`; `classifierVersion` has no direct
 * learner-session consumer. Retaining the canonical `StudySafetyPort` is acceptable
 * because that passive provenance metadata grants no adult capability, and avoids
 * a redundant parallel safety alias.
 * `StudyEventLedgerPort.append` already answers `'idempotency-collision'`,
 * which is why it needed no widening.
 */
export interface ProductionStudySessionPorts {
  readonly calendar: ProductionStudyCalendarPort
  readonly checkpoint: ProductionStudyCheckpointPort
  readonly persistence: ProductionStudyPersistencePort
  readonly eventLedger: StudyEventLedgerPort
  readonly safety: StudySafetyPort
}

/**
 * Fail loudly, and name the role.
 *
 * A missing role must never be defaulted to a stub. The failure a stub produces
 * is a session that opens, runs and writes nothing durable — visible only later,
 * as an absence. Naming the role is the difference between a deployment error
 * that is fixed in a minute and one that is bisected.
 */
export function assertCompleteProductionStudySessionPorts(
  ports: Partial<ProductionStudySessionPorts>,
): asserts ports is ProductionStudySessionPorts {
  const required: readonly (keyof ProductionStudySessionPorts)[] = [
    'calendar',
    'checkpoint',
    'persistence',
    'eventLedger',
    'safety',
  ]
  const missing = required.filter((key) => !ports[key])
  if (missing.length > 0) {
    throw new Error(`Study session unavailable: missing ${missing.join(', ')} port.`)
  }
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

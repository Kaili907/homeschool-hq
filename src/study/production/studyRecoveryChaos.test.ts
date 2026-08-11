import { describe, expect, it, vi } from 'vitest'
import type { AcademyStudyContext } from '../../academy/adapters/studyContextAdapter'
import { createStudyBoundContentClient } from '../client/studyBoundContentClient'
import { StudyIdentityClientError } from '../client/studyIdentityClient'
import { createStudyProductionSessionClient } from '../client/studyProductionSessionClient'
import type { StudyProductionReadinessClient } from '../client/studyProductionReadinessClient'
import type { StudyCheckpointRecord } from '../contracts/persistence/types'
import type {
  StudyProductionSessionProjection,
  StudyProductionSessionState,
  StudyProductionTransitionType,
} from '../contracts/production/session'
import {
  createStudyProductionController,
  type StudyProductionCheckpointDraft,
  type StudyProductionController,
} from './sessionController'
import type {
  VerifiedRuntimeBoundContentInput,
  VerifiedRuntimeExecuteInput,
} from './verifiedRuntimeAdapter'

const academyContext: AcademyStudyContext = Object.freeze({
  adapterVersion: 1,
  releaseVersion: '1.0.0',
  lessonRef: 'grade-5:academy-week-1-day-1',
  skillRefs: Object.freeze(['ma-g5-mathematics-u01-l01']) as string[],
  scopeWeek: 1,
  scopeDay: 1,
})

const beginInput = Object.freeze({
  academyContext,
  subjectId: 'math',
  studyPlanId: null,
  intendedLocalDate: '2026-08-10',
  initialSegmentId: 'segment:guided-practice',
})

const binding = Object.freeze({
  schemaVersion: 1 as const,
  status: 'bound' as const,
  releaseId: '16000000-0000-4000-8000-000000000001',
  packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
  releaseVersion: '1.0.0',
  curriculumManifestSha256: 'a'.repeat(64),
})

const settings = Object.freeze({
  timerMode: 'visible' as const,
  maximumWorkMinutes: 30,
  breakMinimumMinutes: 5,
  breakMaximumMinutes: 15,
  minimumBreakCount: 0,
  requiredBreakIntervalMinutes: 30,
  reducedMotion: false,
  noAudio: false,
  largeText: false,
  readAloud: false,
  speechInputAllowed: false,
})

function checkpoint(revision = 1, sessionId = 'session:chaos-1'): StudyCheckpointRecord {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: 'checkpoint:chaos-a',
    revision,
    createdAt: '2026-08-10T15:01:00.000Z',
    updatedAt: '2026-08-10T15:02:00.000Z',
    sessionId,
    lessonId: academyContext.lessonRef,
    segmentId: 'segment:guided-practice',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 1,
      currentItemId: 'item:learner-safe-a',
      currentItemIndex: 0,
      teachingTurnIndex: revision,
    },
    completedSegmentIds: [],
    perSegmentActiveTime: [{ segmentId: 'segment:guided-practice', activeSeconds: 30 }],
    pausedSeconds: 0,
    breakSeconds: 0,
    protectedDraftRef: null,
    protectedTutorStateRef: 'tutor-state:opaque-a',
    lastAcceptedEventId: null,
    eventVersion: 1,
    tutorInteractionRef: 'interaction:opaque-a',
    technicalInterruption: {
      status: 'none', interruptionId: null, category: 'none', startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

function checkpointDraft(): StudyProductionCheckpointDraft {
  const { sessionId: _sessionId, lessonId: _lessonId, revision: _revision, ...draft } = checkpoint()
  return draft
}

type LifecycleOperation = VerifiedRuntimeExecuteInput['operation']
type Channel = LifecycleOperation | 'bound-content'
type Fault =
  | 'network-before-commit'
  | 'acknowledgement-lost-after-commit'
  | 'malformed-acknowledgement-after-commit'
  | 'timeout-after-commit'
  | 'database-unavailable'
  | 'content-unavailable'
  | 'content-manifest-mismatch'
  | 'content-malformed'

interface ServerSession {
  readonly sessionId: string
  revision: number
  state: StudyProductionSessionState
  currentSegmentId: string | null
  completedAt: string | null
  lastTransition: StudyProductionTransitionType | 'session-started'
}

interface Receipt {
  readonly fingerprint: string
  readonly result: Readonly<Record<string, unknown>>
}

class ChaosStudyRuntime {
  readonly calls: Array<{
    readonly operation: Channel
    readonly request: Readonly<Record<string, unknown>>
  }> = []
  readonly execute = vi.fn(async (input: VerifiedRuntimeExecuteInput): Promise<unknown> => {
    this.calls.push({ operation: input.operation, request: input.request })
    const hold = this.holds.get(input.operation)
    if (hold) {
      this.holds.delete(input.operation)
      await hold
    }
    const fault = this.takeFault(input.operation)
    this.failBeforeCommit(fault)
    if (input.operation === 'session:begin') return this.begin(input.request, fault)
    if (input.operation === 'session:resume') return this.resume(input.request)
    if (input.operation === 'session:transition') return this.transition(input.request, fault)
    if (input.operation === 'checkpoint:read') return this.readCheckpoint()
    return this.saveCheckpoint(input.request, fault)
  })
  readonly readBoundContent = vi.fn(async (
    input: VerifiedRuntimeBoundContentInput,
  ): Promise<unknown> => {
    this.calls.push({ operation: 'bound-content', request: input.request })
    const fault = this.takeFault('bound-content')
    if (fault === 'database-unavailable') {
      throw new Error('select private_authority from learner_records; secret=do-not-expose')
    }
    if (fault === 'network-before-commit') {
      throw new StudyIdentityClientError('service-not-ready')
    }
    if (fault === 'content-unavailable') {
      return {
        schemaVersion: 1,
        status: 'unavailable',
        reasonCode: 'curriculum-content-unavailable',
      }
    }
    const ready = this.learnerContent(input.request)
    if (fault === 'content-manifest-mismatch') {
      return {
        ...ready,
        curriculumBinding: {
          ...ready.curriculumBinding,
          curriculumManifestSha256: 'b'.repeat(64),
        },
      }
    }
    if (fault === 'content-malformed') {
      return { ...ready, privateLearnerContent: { rawAnswer: 'forbidden' } }
    }
    return ready
  })

  activePointerVersion = '1.0.0'
  enrollmentActive = true
  settingsAvailable = true
  legacyAmbiguous = false
  sessionCount = 0
  transitionCount = 0
  checkpointWriteCount = 0
  session: ServerSession | null = null
  storedCheckpoint: StudyCheckpointRecord | null = null

  private readonly faults = new Map<Channel, Fault[]>()
  private readonly holds = new Map<Channel, Promise<void>>()
  private readonly beginReceipts = new Map<string, Receipt>()
  private readonly transitionReceipts = new Map<string, Receipt>()
  private readonly checkpointReceipts = new Map<string, Receipt>()

  inject(channel: Channel, ...faults: Fault[]): void {
    this.faults.set(channel, [...(this.faults.get(channel) ?? []), ...faults])
  }

  holdNext(channel: Channel): () => void {
    let release!: () => void
    this.holds.set(channel, new Promise<void>((resolve) => { release = resolve }))
    return release
  }

  callsFor(operation: Channel) {
    return this.calls.filter((call) => call.operation === operation)
  }

  externallyAcceptTransition(
    type: StudyProductionTransitionType,
    state: StudyProductionSessionState,
    currentSegmentId: string | null,
  ): void {
    if (!this.session) throw new Error('chaos_session_missing')
    this.session.revision += 1
    this.session.state = state
    this.session.currentSegmentId = currentSegmentId
    this.session.lastTransition = type
    if (state === 'completed' || state === 'abandoned') {
      this.session.completedAt = '2026-08-10T15:30:00.000Z'
    }
    this.transitionCount += 1
  }

  private takeFault(channel: Channel): Fault | undefined {
    const queue = this.faults.get(channel)
    const fault = queue?.shift()
    if (queue?.length === 0) this.faults.delete(channel)
    return fault
  }

  private failBeforeCommit(fault: Fault | undefined): void {
    if (fault === 'network-before-commit') {
      throw new StudyIdentityClientError('service-not-ready')
    }
    if (fault === 'database-unavailable') {
      throw new Error('select * from private_authority; password=do-not-expose')
    }
  }

  private finish<T extends object>(
    fault: Fault | undefined,
    result: T,
  ): T | (T & { readonly privatePersistenceRow: object }) {
    if (fault === 'acknowledgement-lost-after-commit') {
      throw new StudyIdentityClientError('service-not-ready')
    }
    if (fault === 'timeout-after-commit') {
      throw new DOMException('The server timed out.', 'TimeoutError')
    }
    if (fault === 'malformed-acknowledgement-after-commit') {
      return { ...result, privatePersistenceRow: { sql: 'select secret from private_authority' } }
    }
    return result
  }

  private begin(
    request: Readonly<Record<string, unknown>>,
    fault: Fault | undefined,
  ): Readonly<Record<string, unknown>> {
    const identity = String(request.idempotencyKey)
    const fingerprint = JSON.stringify(request)
    const receipt = this.beginReceipts.get(identity)
    if (receipt) {
      return receipt.fingerprint === fingerprint
        ? this.finish(fault, receipt.result)
        : { schemaVersion: 2, status: 'idempotency-collision' }
    }
    if (!this.settingsAvailable) {
      return {
        schemaVersion: 2,
        status: 'unavailable',
        reasonCode: 'safety_constraints_unavailable',
      }
    }
    if (!this.enrollmentActive) {
      return {
        schemaVersion: 1,
        status: 'unavailable',
        reasonCode: 'curriculum-release-mismatch',
      }
    }
    this.sessionCount += 1
    this.session = {
      sessionId: `session:chaos-${this.sessionCount}`,
      revision: 1,
      state: 'active',
      currentSegmentId: String(request.initialSegmentId),
      completedAt: null,
      lastTransition: 'session-started',
    }
    const result = this.projection('begun') as unknown as Readonly<Record<string, unknown>>
    this.beginReceipts.set(identity, { fingerprint, result })
    return this.finish(fault, result)
  }

  private resume(request: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    if (this.legacyAmbiguous) {
      return {
        schemaVersion: 1,
        status: 'manual-review',
        reasonCode: 'legacy-curriculum-binding-ambiguous',
      }
    }
    if (!this.session || request.sessionId !== this.session.sessionId) {
      return {
        schemaVersion: 1,
        status: 'unavailable',
        reasonCode: 'study-session-unavailable',
      }
    }
    return {
      ...this.projection(
        this.session.state === 'completed' || this.session.state === 'abandoned'
          ? 'closed'
          : 'resumable',
      ),
      checkpoint: this.storedCheckpoint,
    }
  }

  private transition(
    request: Readonly<Record<string, unknown>>,
    fault: Fault | undefined,
  ): Readonly<Record<string, unknown>> {
    if (!this.session) throw new Error('chaos_session_missing')
    const identity = String(request.idempotencyKey)
    const fingerprint = JSON.stringify(request)
    const receipt = this.transitionReceipts.get(identity)
    if (receipt) {
      return receipt.fingerprint === fingerprint
        ? this.finish(fault, receipt.result)
        : { schemaVersion: 2, status: 'idempotency-collision' }
    }
    if (request.expectedRevision !== this.session.revision) {
      return {
        schemaVersion: 2,
        status: 'revision-conflict',
        currentRevision: this.session.revision,
        currentState: this.session.state,
      }
    }
    const transition = request.transition as {
      readonly type: StudyProductionTransitionType
      readonly segmentId: string | null
    }
    if (this.session.state === 'completed' || this.session.state === 'abandoned') {
      return {
        schemaVersion: 2,
        status: 'invalid-transition',
        currentRevision: this.session.revision,
        currentState: this.session.state,
        transitionType: transition.type,
      }
    }
    this.session.revision += 1
    this.session.lastTransition = transition.type
    if (transition.type === 'segment-completed') this.session.currentSegmentId = null
    if (transition.type === 'pause-started') this.session.state = 'paused'
    if (transition.type === 'session-resumed') this.session.state = 'active'
    if (transition.type === 'session-completed' || transition.type === 'session-abandoned') {
      this.session.state = transition.type === 'session-completed' ? 'completed' : 'abandoned'
      this.session.currentSegmentId = null
      this.session.completedAt = '2026-08-10T15:30:00.000Z'
    }
    this.transitionCount += 1
    const result = this.projection('stored') as unknown as Readonly<Record<string, unknown>>
    this.transitionReceipts.set(identity, { fingerprint, result })
    return this.finish(fault, result)
  }

  private readCheckpoint(): Readonly<Record<string, unknown>> {
    if (!this.session) throw new Error('chaos_session_missing')
    return {
      schemaVersion: 2,
      status: this.storedCheckpoint ? 'found' : 'not-found',
      sessionRevision: this.session.revision,
      currentState: this.session.state,
      curriculumBinding: binding,
      checkpoint: this.storedCheckpoint,
    }
  }

  private saveCheckpoint(
    request: Readonly<Record<string, unknown>>,
    fault: Fault | undefined,
  ): Readonly<Record<string, unknown>> {
    if (!this.session) throw new Error('chaos_session_missing')
    const identity = String(request.mutationId)
    const fingerprint = JSON.stringify(request)
    const receipt = this.checkpointReceipts.get(identity)
    if (receipt) {
      return receipt.fingerprint === fingerprint
        ? this.finish(fault, receipt.result)
        : { schemaVersion: 2, status: 'idempotency-collision' }
    }
    const currentRevision = this.storedCheckpoint?.revision ?? 0
    if (request.expectedRevision !== currentRevision) {
      return {
        schemaVersion: 2,
        status: 'revision-conflict',
        currentCheckpointRevision: currentRevision,
        sessionRevision: this.session.revision,
        currentState: this.session.state,
      }
    }
    this.storedCheckpoint = request.checkpoint as StudyCheckpointRecord
    this.checkpointWriteCount += 1
    const result = {
      schemaVersion: 2,
      status: 'stored',
      checkpointRevision: this.storedCheckpoint.revision,
      sessionRevision: this.session.revision,
      currentState: this.session.state,
      curriculumBinding: binding,
    }
    this.checkpointReceipts.set(identity, { fingerprint, result })
    return this.finish(fault, result)
  }

  private projection(
    status: StudyProductionSessionProjection['status'],
  ): StudyProductionSessionProjection {
    if (!this.session) throw new Error('chaos_session_missing')
    return {
      schemaVersion: 2,
      status,
      sessionId: this.session.sessionId,
      state: this.session.state,
      revision: this.session.revision,
      acceptedAt: '2026-08-10T15:00:00.000Z',
      updatedAt: `2026-08-10T15:${String(this.session.revision).padStart(2, '0')}:00.000Z`,
      lessonId: academyContext.lessonRef,
      subjectId: 'math',
      studyPlanId: null,
      intendedLocalDate: '2026-08-10',
      currentSegmentId: this.session.currentSegmentId,
      completedAt: this.session.completedAt,
      lastTransition: {
        type: this.session.lastTransition,
        acceptedAt: `2026-08-10T15:${String(this.session.revision).padStart(2, '0')}:00.000Z`,
      },
      curriculumBinding: binding,
      effectiveSettings: settings,
    }
  }

  private learnerContent(request: Readonly<Record<string, unknown>>) {
    return {
      schemaVersion: 1,
      status: 'ready',
      reasonCode: 'content-ready',
      sessionRef: request.sessionId,
      lessonRef: request.lessonRef,
      skillRefs: request.skillRefs,
      curriculumBinding: {
        schemaVersion: 1,
        releaseId: binding.releaseId,
        packageId: binding.packageId,
        releaseVersion: binding.releaseVersion,
        curriculumManifestSha256: binding.curriculumManifestSha256,
      },
      lessons: [{
        lessonId: academyContext.skillRefs[0],
        courseId: 'ma-g5-mathematics',
        grade: 5,
        subject: 'mathematics',
        courseDay: 1,
        unitNumber: 1,
        unitTitle: 'Whole-number reasoning',
        dayInUnit: 1,
        title: 'Production-bound lesson',
        standards: ['5.OA.1'],
        schemaVersion: '1.0',
        learningObjectives: ['Represent the idea.'],
        successCriteria: ['Explain the reasoning.'],
        materials: ['notebook'],
        lessonFlow: [{
          segment: 'Guided practice',
          teacherOrTutorAction: 'Present the learner-safe prompt.',
        }],
        formativeCheck: 'Show the reasoning.',
        accommodations: ['Offer an accessible response mode.'],
      }],
    }
  }
}

function controllerFor(server: ChaosStudyRuntime, identityNamespace = 'chaos') {
  const readinessWire = Object.freeze({
    schemaVersion: 1 as const,
    status: 'ready' as const,
    expiresAt: '2099-08-10T15:00:00.000Z',
  })
  const readiness: StudyProductionReadinessClient = {
    read: vi.fn(async () => readinessWire),
    revalidate: vi.fn(async () => readinessWire),
    invalidate: vi.fn(),
  }
  const sessions = createStudyProductionSessionClient({
    runtime: server,
    createAttemptRef: (operation) => `attempt:${operation}`,
  })
  const content = createStudyBoundContentClient({
    runtime: server,
    createAttemptRef: () => 'attempt:bound-content',
  })
  let sequence = 0
  const identities: string[] = []
  const controller = createStudyProductionController({
    readiness,
    sessions,
    content,
    createMutationId: (kind) => {
      const identity = `${identityNamespace}:${kind}:${++sequence}`
      identities.push(identity)
      return identity
    },
  })
  return { controller, sessions, identities }
}

async function beginReady(controller: StudyProductionController) {
  const result = await controller.begin(beginInput)
  expect(result).toMatchObject({ status: 'ready', session: { revision: 1 } })
  return result
}

function expectPrivateDataAbsent(value: unknown) {
  expect(JSON.stringify(value)).not.toMatch(
    /select\s|sql|private.?authority|private.?learner|raw.?answer|transcript|password|secret|credential|stack/i,
  )
}

describe('Study production learner path R4 recovery chaos gate', () => {
  it('1. recovers from network loss before begin commits without a duplicate session', async () => {
    const server = new ChaosStudyRuntime()
    server.inject('session:begin', 'network-before-commit')
    const { controller } = controllerFor(server)
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'network_failure', pendingMutation: 'begin', session: null,
    })
    expect(server.sessionCount).toBe(0)
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'ready', pendingMutation: null,
    })
    expect(server.sessionCount).toBe(1)
    const calls = server.callsFor('session:begin')
    expect(calls[0]?.request.idempotencyKey).toBe(calls[1]?.request.idempotencyKey)
  })

  it('2. replays begin when commit succeeds but the HTTP acknowledgement is lost', async () => {
    const server = new ChaosStudyRuntime()
    server.inject('session:begin', 'acknowledgement-lost-after-commit')
    const { controller } = controllerFor(server)
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'network_failure', pendingMutation: 'begin', session: null,
    })
    expect(server.sessionCount).toBe(1)
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'ready', session: { sessionId: 'session:chaos-1', revision: 1 },
    })
    expect(server.sessionCount).toBe(1)
  })

  it('3. makes a duplicate begin retry return the receipt, not a second session', async () => {
    const server = new ChaosStudyRuntime()
    const { sessions } = controllerFor(server)
    const request = {
      idempotencyKey: 'chaos:duplicate-begin',
      lessonId: academyContext.lessonRef,
      subjectId: 'math',
      studyPlanId: null,
      intendedLocalDate: '2026-08-10',
      initialSegmentId: 'segment:guided-practice',
      curriculumContext: {
        releaseVersion: academyContext.releaseVersion,
        lessonRef: academyContext.lessonRef,
        skillRefs: academyContext.skillRefs,
      },
    }
    const first = await sessions.begin(request)
    const duplicate = await sessions.begin(request)
    expect(duplicate).toEqual(first)
    expect(server.sessionCount).toBe(1)
  })

  it('4. replays a committed transition after acknowledgement loss exactly once', async () => {
    const server = new ChaosStudyRuntime()
    const { controller } = controllerFor(server)
    await beginReady(controller)
    server.inject('session:transition', 'acknowledgement-lost-after-commit')
    const input = { type: 'pause-started' as const, segmentId: 'segment:guided-practice' }
    await expect(controller.transition(input)).resolves.toMatchObject({
      status: 'network_failure', pendingMutation: 'transition', session: { revision: 1 },
    })
    expect(server.session?.revision).toBe(2)
    await expect(controller.transition(input)).resolves.toMatchObject({
      status: 'ready', session: { revision: 2, state: 'paused' },
    })
    expect(server.transitionCount).toBe(1)
    const calls = server.callsFor('session:transition')
    expect(calls[0]?.request).toEqual(calls[1]?.request)
  })

  it('5. recovers a committed checkpoint after acknowledgement loss without losing it', async () => {
    const server = new ChaosStudyRuntime()
    const { controller } = controllerFor(server)
    await beginReady(controller)
    server.inject('checkpoint:compare-and-swap', 'acknowledgement-lost-after-commit')
    const draft = checkpointDraft()
    await expect(controller.saveCheckpoint(draft)).resolves.toMatchObject({
      status: 'network_failure', pendingMutation: 'checkpoint', acceptedCheckpointRevision: 0,
    })
    expect(server.storedCheckpoint?.revision).toBe(1)
    await expect(controller.saveCheckpoint(draft)).resolves.toMatchObject({
      status: 'ready', acceptedCheckpointRevision: 1, checkpoint: { revision: 1 },
    })
    expect(server.checkpointWriteCount).toBe(1)
  })

  it('6. exits loading after network loss during resume and retries authoritatively', async () => {
    const server = new ChaosStudyRuntime()
    const first = controllerFor(server).controller
    const begun = await beginReady(first)
    server.externallyAcceptTransition('pause-started', 'paused', 'segment:guided-practice')
    const recreated = controllerFor(server).controller
    server.inject('session:resume', 'network-before-commit')
    await expect(recreated.resume({
      sessionId: begun.session!.sessionId, academyContext,
    })).resolves.toMatchObject({ status: 'network_failure', pendingMutation: null })
    expect(recreated.snapshot().status).not.toBe('loading')
    await expect(recreated.resume({
      sessionId: begun.session!.sessionId, academyContext,
    })).resolves.toMatchObject({ status: 'ready', session: { revision: 2, state: 'paused' } })
  })

  it('7. preserves the local revision on stale conflict until server-wins resume', async () => {
    const server = new ChaosStudyRuntime()
    const { controller } = controllerFor(server)
    await beginReady(controller)
    server.externallyAcceptTransition('pause-started', 'paused', 'segment:guided-practice')
    await expect(controller.transition({
      type: 'segment-completed', segmentId: 'segment:guided-practice',
    })).resolves.toMatchObject({
      status: 'conflict', session: { revision: 1, state: 'active' },
      recovery: { kind: 'revision_conflict', currentRevision: 2, currentState: 'paused' },
    })
    await expect(controller.resume({
      sessionId: 'session:chaos-1', academyContext,
    })).resolves.toMatchObject({ status: 'ready', session: { revision: 2, state: 'paused' } })
  })

  it('8. retains the committed session when content is unavailable and recovers only by resume', async () => {
    const server = new ChaosStudyRuntime()
    server.inject('bound-content', 'content-unavailable')
    const { controller } = controllerFor(server)
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'unavailable', session: { sessionId: 'session:chaos-1' }, content: null,
      pendingMutation: null,
      recovery: { kind: 'content_unavailable', reasonCode: 'curriculum-content-unavailable' },
    })
    await controller.transition({ type: 'pause-started', segmentId: 'segment:guided-practice' })
    expect(server.callsFor('session:transition')).toHaveLength(0)
    await expect(controller.resume({
      sessionId: 'session:chaos-1', academyContext,
    })).resolves.toMatchObject({ status: 'ready', content: { status: 'ready' } })
    expect(server.sessionCount).toBe(1)
  })

  it('9. fails closed on a post-begin manifest mismatch with no content fallback', async () => {
    const server = new ChaosStudyRuntime()
    server.inject('bound-content', 'content-manifest-mismatch')
    const { controller } = controllerFor(server)
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'unavailable', session: { curriculumBinding: { releaseVersion: '1.0.0' } },
      content: null, recovery: { kind: 'contract_invalid' },
    })
    expect(server.callsFor('bound-content')).toHaveLength(1)
    await expect(controller.resume({
      sessionId: 'session:chaos-1', academyContext,
    })).resolves.toMatchObject({
      status: 'ready', content: { curriculumBinding: { curriculumManifestSha256: 'a'.repeat(64) } },
    })
    expect(server.callsFor('bound-content')).toHaveLength(2)
  })

  it('10. keeps the session on its immutable release after the active pointer changes', async () => {
    const server = new ChaosStudyRuntime()
    const { controller } = controllerFor(server)
    await beginReady(controller)
    server.activePointerVersion = '2.0.0'
    await expect(controller.resume({
      sessionId: 'session:chaos-1', academyContext,
    })).resolves.toMatchObject({
      status: 'ready',
      session: { curriculumBinding: { releaseVersion: '1.0.0' } },
      content: { curriculumBinding: { releaseVersion: '1.0.0' } },
    })
    expect(server.callsFor('session:resume').at(-1)?.request.curriculumReleaseVersion).toBe('1.0.0')
    expect(JSON.stringify(server.callsFor('bound-content'))).not.toMatch(/activePointer|2\.0\.0/)
  })

  it('11. does not alter an active session when enrollment changes mid-session', async () => {
    const server = new ChaosStudyRuntime()
    const active = controllerFor(server).controller
    await beginReady(active)
    server.enrollmentActive = false
    await expect(active.resume({
      sessionId: 'session:chaos-1', academyContext,
    })).resolves.toMatchObject({ status: 'ready', session: { revision: 1 } })
    const next = controllerFor(server, 'next-controller').controller
    await expect(next.begin(beginInput)).resolves.toMatchObject({
      status: 'unavailable', session: null,
      recovery: { kind: 'unavailable', reasonCode: 'curriculum-release-mismatch' },
    })
    expect(server.sessionCount).toBe(1)
  })

  it('12. blocks a new begin when Effective Settings is unavailable, then permits a fresh safe attempt', async () => {
    const server = new ChaosStudyRuntime()
    server.settingsAvailable = false
    const { controller, identities } = controllerFor(server)
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'unavailable', session: null, pendingMutation: null,
      recovery: { kind: 'unavailable', reasonCode: 'safety_constraints_unavailable' },
    })
    expect(server.sessionCount).toBe(0)
    server.settingsAvailable = true
    await expect(controller.begin(beginInput)).resolves.toMatchObject({ status: 'ready' })
    expect(server.sessionCount).toBe(1)
    expect(identities).toEqual(['chaos:begin:1', 'chaos:begin:2'])
  })

  it('13. retains the original identity after a malformed committed acknowledgement', async () => {
    const server = new ChaosStudyRuntime()
    server.inject('session:begin', 'malformed-acknowledgement-after-commit')
    const { controller } = controllerFor(server)
    const failed = await controller.begin(beginInput)
    expect(failed).toMatchObject({
      status: 'unavailable', session: null, pendingMutation: 'begin',
      recovery: { kind: 'contract_invalid' },
    })
    expectPrivateDataAbsent(failed)
    await expect(controller.begin(beginInput)).resolves.toMatchObject({ status: 'ready' })
    const calls = server.callsFor('session:begin')
    expect(calls[0]?.request.idempotencyKey).toBe(calls[1]?.request.idempotencyKey)
    expect(server.sessionCount).toBe(1)

    server.inject('session:transition', 'malformed-acknowledgement-after-commit')
    const transition = { type: 'pause-started' as const, segmentId: 'segment:guided-practice' }
    await expect(controller.transition(transition)).resolves.toMatchObject({
      status: 'unavailable', session: { revision: 1 }, pendingMutation: 'transition',
      recovery: { kind: 'contract_invalid' },
    })
    await expect(controller.transition(transition)).resolves.toMatchObject({
      status: 'ready', session: { revision: 2 }, pendingMutation: null,
    })
    const transitionCalls = server.callsFor('session:transition')
    expect(transitionCalls[0]?.request.idempotencyKey)
      .toBe(transitionCalls[1]?.request.idempotencyKey)
    expect(server.transitionCount).toBe(1)

    server.inject('checkpoint:compare-and-swap', 'malformed-acknowledgement-after-commit')
    const draft = checkpointDraft()
    await expect(controller.saveCheckpoint(draft)).resolves.toMatchObject({
      status: 'unavailable', acceptedCheckpointRevision: 0,
      pendingMutation: 'checkpoint', recovery: { kind: 'contract_invalid' },
    })
    await expect(controller.saveCheckpoint(draft)).resolves.toMatchObject({
      status: 'ready', acceptedCheckpointRevision: 1, pendingMutation: null,
    })
    const checkpointCalls = server.callsFor('checkpoint:compare-and-swap')
    expect(checkpointCalls[0]?.request.mutationId).toBe(checkpointCalls[1]?.request.mutationId)
    expect(server.checkpointWriteCount).toBe(1)
  })

  it('14. treats a server timeout after transition commit as uncertain and replay-safe', async () => {
    const server = new ChaosStudyRuntime()
    const { controller } = controllerFor(server)
    await beginReady(controller)
    server.inject('session:transition', 'timeout-after-commit')
    const input = { type: 'pause-started' as const, segmentId: 'segment:guided-practice' }
    await expect(controller.transition(input)).resolves.toMatchObject({
      status: 'network_failure', pendingMutation: 'transition', session: { revision: 1 },
    })
    await expect(controller.transition(input)).resolves.toMatchObject({
      status: 'ready', session: { revision: 2 },
    })
    expect(server.transitionCount).toBe(1)
  })

  it('15. restores an active browser session and accepted checkpoint after refresh', async () => {
    const server = new ChaosStudyRuntime()
    const beforeRefresh = controllerFor(server).controller
    const begun = await beginReady(beforeRefresh)
    await expect(beforeRefresh.saveCheckpoint(checkpointDraft())).resolves.toMatchObject({
      acceptedCheckpointRevision: 1,
    })
    const afterRefresh = controllerFor(server).controller
    await expect(afterRefresh.resume({
      sessionId: begun.session!.sessionId, academyContext,
    })).resolves.toMatchObject({
      status: 'ready', session: { sessionId: 'session:chaos-1', revision: 1 },
      checkpoint: { revision: 1 }, acceptedCheckpointRevision: 1,
    })
    expect(server.sessionCount).toBe(1)
    expect(server.checkpointWriteCount).toBe(1)
  })

  it('16. lets a recreated controller recover a transition committed by its discarded predecessor', async () => {
    const server = new ChaosStudyRuntime()
    const predecessor = controllerFor(server).controller
    await beginReady(predecessor)
    server.inject('session:transition', 'acknowledgement-lost-after-commit')
    await expect(predecessor.transition({
      type: 'pause-started', segmentId: 'segment:guided-practice',
    })).resolves.toMatchObject({ status: 'network_failure', session: { revision: 1 } })
    const recreated = controllerFor(server).controller
    await expect(recreated.resume({
      sessionId: 'session:chaos-1', academyContext,
    })).resolves.toMatchObject({ status: 'ready', session: { revision: 2, state: 'paused' } })
    expect(server.transitionCount).toBe(1)
  })

  it('17. coalesces repeated user action while uncertain and blocks a different mutation', async () => {
    const server = new ChaosStudyRuntime()
    const { controller } = controllerFor(server)
    await beginReady(controller)
    const release = server.holdNext('session:transition')
    server.inject('session:transition', 'network-before-commit')
    const input = { type: 'pause-started' as const, segmentId: 'segment:guided-practice' }
    const first = controller.transition(input)
    const repeated = controller.transition(input)
    expect(repeated).toBe(first)
    await expect(controller.transition({
      type: 'segment-completed', segmentId: 'segment:guided-practice',
    })).resolves.toMatchObject({
      status: 'resume_required', pendingMutation: 'transition',
      recovery: { kind: 'mutation_pending' },
    })
    expect(server.callsFor('session:transition')).toHaveLength(1)
    release()
    await expect(first).resolves.toMatchObject({
      status: 'network_failure', pendingMutation: 'transition',
    })
    await expect(controller.transition(input)).resolves.toMatchObject({ status: 'ready' })
    const calls = server.callsFor('session:transition')
    expect(calls[0]?.request.idempotencyKey).toBe(calls[1]?.request.idempotencyKey)
  })

  it('18. classifies an ambiguous legacy session without content or preview fallback', async () => {
    const server = new ChaosStudyRuntime()
    server.legacyAmbiguous = true
    const { controller } = controllerFor(server)
    const result = await controller.resume({
      sessionId: 'session:legacy-a', academyContext,
    })
    expect(result).toMatchObject({
      status: 'manual_review', session: null, content: null, pendingMutation: null,
      recovery: {
        kind: 'unavailable', reasonCode: 'legacy-curriculum-binding-ambiguous',
      },
    })
    expect(server.callsFor('bound-content')).toHaveLength(0)
    expect(result.status).not.toBe('loading')
  })

  it('19. resumes a terminal session as terminal and rejects any later transition', async () => {
    const server = new ChaosStudyRuntime()
    const active = controllerFor(server).controller
    await beginReady(active)
    await active.transition({
      type: 'segment-completed', segmentId: 'segment:guided-practice',
    })
    await active.transition({ type: 'session-completed', segmentId: null })
    const terminalRevision = server.session!.revision
    const recreated = controllerFor(server).controller
    await expect(recreated.resume({
      sessionId: 'session:chaos-1', academyContext,
    })).resolves.toMatchObject({
      status: 'ready', session: { state: 'completed', revision: terminalRevision },
    })
    await expect(recreated.transition({
      type: 'session-abandoned', segmentId: null,
    })).resolves.toMatchObject({
      status: 'rejected', session: { state: 'completed', revision: terminalRevision },
      recovery: { kind: 'invalid_transition', currentState: 'completed' },
    })
    expect(server.session).toMatchObject({ state: 'completed', revision: terminalRevision })
  })

  it('20. bounds an unavailable database seam and leaves deterministic retry state', async () => {
    const server = new ChaosStudyRuntime()
    server.inject('session:begin', 'database-unavailable')
    const { controller } = controllerFor(server)
    const failed = await controller.begin(beginInput)
    expect(failed).toMatchObject({
      status: 'network_failure', session: null, pendingMutation: 'begin',
      recovery: { kind: 'network_uncertain' },
    })
    expect(failed.status).not.toBe('loading')
    expectPrivateDataAbsent(failed)
    await expect(controller.begin(beginInput)).resolves.toMatchObject({ status: 'ready' })
    expect(server.sessionCount).toBe(1)
  })
})

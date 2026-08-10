import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import type { AcademyStudyContext } from '../../academy/adapters/studyContextAdapter'
import { StudyIdentityClientError } from '../client/studyIdentityClient'
import type { StudyProductionReadinessClient } from '../client/studyProductionReadinessClient'
import {
  createStudyProductionSessionClient,
  type StudyProductionSessionClient,
} from '../client/studyProductionSessionClient'
import type { StudyCheckpointRecord } from '../contracts/persistence/types'
import type {
  StudyProductionBeginResponse,
  StudyProductionCheckpointReadResponse,
  StudyProductionCheckpointResponse,
  StudyProductionResumeResponse,
  StudyProductionSessionProjection,
  StudyProductionTransitionResponse,
} from '../contracts/production/session'
import {
  createStudyProductionController,
  type StudyProductionBeginInput,
  type StudyProductionCheckpointDraft,
} from './sessionController'

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

function projection(
  status: StudyProductionSessionProjection['status'] = 'begun',
  revision = 1,
  overrides: Partial<StudyProductionSessionProjection> = {},
): StudyProductionSessionProjection {
  const closed = status === 'closed'
  return {
    schemaVersion: 2,
    status,
    sessionId: 'session:server-generated-a',
    state: closed ? 'completed' : 'active',
    revision,
    acceptedAt: '2026-08-10T15:00:00.000Z',
    updatedAt: `2026-08-10T15:0${Math.min(revision, 9)}:00.000Z`,
    lessonId: 'grade-5:academy-week-2-day-3',
    subjectId: 'math',
    studyPlanId: null,
    intendedLocalDate: '2026-08-10',
    currentSegmentId: closed ? null : 'segment-bound-a',
    completedAt: closed ? '2026-08-10T15:05:00.000Z' : null,
    lastTransition: {
      type: closed ? 'session-completed' : 'session-started',
      acceptedAt: closed
        ? '2026-08-10T15:05:00.000Z'
        : '2026-08-10T15:00:00.000Z',
    },
    curriculumBinding: binding,
    effectiveSettings: settings,
    ...overrides,
  }
}

function checkpoint(revision = 1): StudyCheckpointRecord {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: 'checkpoint:server-generated-a',
    revision,
    createdAt: '2026-08-10T15:01:00.000Z',
    updatedAt: '2026-08-10T15:02:00.000Z',
    sessionId: 'session:server-generated-a',
    lessonId: 'grade-5:academy-week-2-day-3',
    segmentId: 'segment-bound-a',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 1,
      currentItemId: 'task-production-a',
      currentItemIndex: 0,
      teachingTurnIndex: revision,
    },
    completedSegmentIds: [],
    perSegmentActiveTime: [{ segmentId: 'segment-bound-a', activeSeconds: 10 }],
    pausedSeconds: 0,
    breakSeconds: 0,
    protectedDraftRef: null,
    protectedTutorStateRef: 'tutor-state:server-generated-a',
    lastAcceptedEventId: null,
    eventVersion: 1,
    tutorInteractionRef: 'interaction-production-a',
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

const academyContext: AcademyStudyContext = Object.freeze({
  adapterVersion: 1,
  releaseVersion: '1.0.0',
  lessonRef: 'grade-5:academy-week-2-day-3',
  skillRefs: Object.freeze(['ma-g5-mathematics-u01-l08', 'ma-g5-science-u01-l03']) as string[],
  scopeWeek: 2,
  scopeDay: 3,
})

const beginInput: StudyProductionBeginInput = Object.freeze({
  academyContext,
  subjectId: 'math',
  studyPlanId: null,
  intendedLocalDate: '2026-08-10',
  initialSegmentId: 'segment-bound-a',
})

function readiness(status: 'ready' | 'not-ready' | 'degraded' = 'ready'):
StudyProductionReadinessClient {
  const result = Object.freeze({
    schemaVersion: 1 as const,
    status,
    expiresAt: '2099-08-10T15:00:00.000Z',
  })
  return {
    read: vi.fn(async () => result),
    revalidate: vi.fn(async () => result),
    invalidate: vi.fn(),
  }
}

function sessionMocks(overrides: Partial<StudyProductionSessionClient> = {}): StudyProductionSessionClient {
  const begun = projection('begun') as StudyProductionBeginResponse
  const resumed = { ...projection('resumable'), checkpoint: null } as StudyProductionResumeResponse
  const transitioned = projection('stored', 2, {
    currentSegmentId: null,
    lastTransition: {
      type: 'segment-completed',
      acceptedAt: '2026-08-10T15:02:00.000Z',
    },
  }) as StudyProductionTransitionResponse
  const checkpointRead: StudyProductionCheckpointReadResponse = {
    schemaVersion: 2,
    status: 'not-found',
    sessionRevision: 1,
    currentState: 'active',
    curriculumBinding: binding,
    checkpoint: null,
  }
  const checkpointStored: StudyProductionCheckpointResponse = {
    schemaVersion: 2,
    status: 'stored',
    checkpointRevision: 1,
    sessionRevision: 1,
    currentState: 'active',
    curriculumBinding: binding,
  }
  return {
    begin: vi.fn(async () => begun),
    resume: vi.fn(async () => resumed),
    transition: vi.fn(async () => transitioned),
    readCheckpoint: vi.fn(async () => checkpointRead),
    saveCheckpoint: vi.fn(async () => checkpointStored),
    ...overrides,
  }
}

function harness(input: {
  readonly sessions?: StudyProductionSessionClient
  readonly readiness?: StudyProductionReadinessClient
} = {}) {
  const sessions = input.sessions ?? sessionMocks()
  const ready = input.readiness ?? readiness()
  let mutationSequence = 0
  const controller = createStudyProductionController({
    sessions,
    readiness: ready,
    createMutationId: (kind) => `mutation:${kind}:${++mutationSequence}`,
  })
  return { controller, sessions, readiness: ready }
}

async function begunController(sessions = sessionMocks()) {
  const result = harness({ sessions })
  await result.controller.begin(beginInput)
  return result
}

describe('Study production controller foundation', () => {
  it('exposes bounded readiness without starting a Study session', async () => {
    const notReady = readiness('degraded')
    const { controller } = harness({ readiness: notReady })
    await expect(controller.checkReadiness()).resolves.toMatchObject({
      status: 'not_ready',
      session: null,
    })
    expect(notReady.revalidate).toHaveBeenCalledOnce()
  })

  it('begins from the Academy advisory handoff and sends no browser authority', async () => {
    const { controller, sessions } = harness()
    const result = await controller.begin(beginInput)
    expect(result).toMatchObject({
      status: 'ready',
      session: { sessionId: 'session:server-generated-a', revision: 1 },
      advisoryLaunch: {
        releaseVersion: '1.0.0',
        lessonRef: 'grade-5:academy-week-2-day-3',
        scopeWeek: 2,
        scopeDay: 3,
      },
    })
    const request = vi.mocked(sessions.begin).mock.calls[0]![0]
    expect(request).toEqual({
      idempotencyKey: 'mutation:begin:1',
      lessonId: 'grade-5:academy-week-2-day-3',
      subjectId: 'math',
      studyPlanId: null,
      intendedLocalDate: '2026-08-10',
      initialSegmentId: 'segment-bound-a',
      curriculumContext: {
        releaseVersion: '1.0.0',
        lessonRef: 'grade-5:academy-week-2-day-3',
        skillRefs: ['ma-g5-mathematics-u01-l08', 'ma-g5-science-u01-l03'],
      },
    })
    expect(JSON.stringify(request)).not.toMatch(/household|learner|student|role|scopeWeek|scopeDay/i)
  })

  it('replays an uncertain begin with the same server idempotency identity', async () => {
    const begin = vi.fn()
      .mockRejectedValueOnce(new StudyIdentityClientError('service-not-ready'))
      .mockResolvedValueOnce(projection('begun'))
    const sessions = sessionMocks({ begin })
    const { controller } = harness({ sessions })
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'network_failure', pendingMutation: 'begin',
    })
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'ready', pendingMutation: null,
    })
    expect(begin).toHaveBeenCalledTimes(2)
    expect(begin.mock.calls[0][0].idempotencyKey).toBe(begin.mock.calls[1][0].idempotencyKey)
  })

  it('fails closed when a secure bounded mutation identity cannot be created', async () => {
    const sessions = sessionMocks()
    const controller = createStudyProductionController({
      sessions,
      readiness: readiness(),
      createMutationId: () => { throw new Error('unavailable random source') },
    })
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'rejected', session: null, pendingMutation: null,
    })
    expect(sessions.begin).not.toHaveBeenCalled()
  })

  it('surfaces begin identity collisions without creating browser session state', async () => {
    const sessions = sessionMocks({
      begin: vi.fn(async (): Promise<StudyProductionBeginResponse> => ({
        schemaVersion: 2,
        status: 'idempotency-collision',
      })),
    })
    const { controller } = harness({ sessions })
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'conflict', session: null,
      recovery: { kind: 'idempotency_collision' },
    })
  })

  it('uses the latest accepted server revision for transition CAS and replaces it on success', async () => {
    const { controller, sessions } = await begunController()
    const result = await controller.transition({
      type: 'segment-completed', segmentId: 'segment-bound-a',
    })
    expect(vi.mocked(sessions.transition).mock.calls[0]![0]).toMatchObject({
      sessionId: 'session:server-generated-a',
      expectedRevision: 1,
      idempotencyKey: 'mutation:transition:2',
    })
    expect(result.session?.revision).toBe(2)
    expect(result.session?.currentSegmentId).toBeNull()
  })

  it('retries a network-uncertain transition with the same identity and expected revision', async () => {
    const transition = vi.fn()
      .mockRejectedValueOnce(new StudyIdentityClientError('service-not-ready'))
      .mockResolvedValueOnce(projection('stored', 2, {
        currentSegmentId: null,
        lastTransition: {
          type: 'segment-completed', acceptedAt: '2026-08-10T15:02:00.000Z',
        },
      }))
    const { controller } = await begunController(sessionMocks({ transition }))
    const input = { type: 'segment-completed' as const, segmentId: 'segment-bound-a' }
    await expect(controller.transition(input)).resolves.toMatchObject({
      status: 'network_failure', pendingMutation: 'transition',
    })
    await expect(controller.transition(input)).resolves.toMatchObject({ status: 'ready' })
    expect(transition).toHaveBeenCalledTimes(2)
    expect(transition.mock.calls[0][0]).toEqual(transition.mock.calls[1][0])
  })

  it('does not guess or auto-increment on a stale transition conflict', async () => {
    const transition = vi.fn(async () => ({
      schemaVersion: 2 as const,
      status: 'revision-conflict' as const,
      currentRevision: 4,
      currentState: 'paused' as const,
    }))
    const { controller } = await begunController(sessionMocks({ transition }))
    const result = await controller.transition({
      type: 'segment-completed', segmentId: 'segment-bound-a',
    })
    expect(result).toMatchObject({
      status: 'conflict',
      session: { revision: 1, state: 'active' },
      recovery: { kind: 'revision_conflict', currentRevision: 4, currentState: 'paused' },
    })
  })

  it('injects checkpoint identity and revision from accepted controller state', async () => {
    const { controller, sessions } = await begunController()
    const result = await controller.saveCheckpoint(checkpointDraft())
    const request = vi.mocked(sessions.saveCheckpoint).mock.calls[0]![0]
    expect(request).toMatchObject({
      sessionId: 'session:server-generated-a',
      expectedRevision: 0,
      mutationId: 'mutation:checkpoint:2',
      checkpoint: {
        sessionId: 'session:server-generated-a',
        lessonId: 'grade-5:academy-week-2-day-3',
        revision: 1,
      },
    })
    expect(result.acceptedCheckpointRevision).toBe(1)
    expect(result.checkpoint).toMatchObject({
      sessionId: 'session:server-generated-a', revision: 1,
      rawAnswerIncluded: false, transcriptIncluded: false,
    })
  })

  it('surfaces checkpoint CAS conflict without adopting its recovery revision', async () => {
    const saveCheckpoint = vi.fn(async () => ({
      schemaVersion: 2 as const,
      status: 'revision-conflict' as const,
      currentCheckpointRevision: 3,
      sessionRevision: 1,
      currentState: 'active' as const,
    }))
    const { controller } = await begunController(sessionMocks({ saveCheckpoint }))
    const result = await controller.saveCheckpoint(checkpointDraft())
    expect(result).toMatchObject({
      status: 'conflict',
      acceptedCheckpointRevision: 0,
      recovery: { kind: 'checkpoint_revision_conflict', currentCheckpointRevision: 3 },
    })
  })

  it('resumes only from a validated authoritative session and checkpoint', async () => {
    const resume = vi.fn(async (): Promise<StudyProductionResumeResponse> => ({
      ...projection('resumable', 5, { currentSegmentId: 'segment-server-resume' }),
      status: 'resumable',
      checkpoint: { ...checkpoint(2), segmentId: 'segment-server-resume' },
    }))
    const { controller } = harness({ sessions: sessionMocks({ resume }) })
    const result = await controller.resume({
      sessionId: 'session:server-generated-a',
      curriculumReleaseVersion: '1.0.0',
    })
    expect(result).toMatchObject({
      status: 'ready',
      session: { revision: 5, currentSegmentId: 'segment-server-resume' },
      checkpoint: { revision: 2, segmentId: 'segment-server-resume' },
      acceptedCheckpointRevision: 2,
      selection: { segmentId: 'segment-server-resume' },
    })
  })

  it('lets the server beat stale local session and UI selection state', async () => {
    const resume = vi.fn(async (): Promise<StudyProductionResumeResponse> => ({
      ...projection('resumable', 7, {
        state: 'paused', currentSegmentId: 'segment-server-authority',
        lastTransition: {
          type: 'pause-started', acceptedAt: '2026-08-10T15:07:00.000Z',
        },
      }),
      status: 'resumable',
      checkpoint: null,
    }))
    const { controller } = await begunController(sessionMocks({ resume }))
    controller.selectSegment('segment-browser-stale')
    const result = await controller.resume({
      sessionId: 'session:server-generated-a', curriculumReleaseVersion: '1.0.0',
    })
    expect(result.session).toMatchObject({ revision: 7, state: 'paused' })
    expect(result.selection.segmentId).toBe('segment-server-authority')
  })

  it('maps invalid transition and manual-review responses to bounded states', async () => {
    const transition = vi.fn(async () => ({
      schemaVersion: 2 as const,
      status: 'invalid-transition' as const,
      currentRevision: 1,
      currentState: 'active' as const,
      transitionType: 'break-ended' as const,
    }))
    const { controller } = await begunController(sessionMocks({ transition }))
    await expect(controller.transition({ type: 'break-ended', segmentId: null }))
      .resolves.toMatchObject({ status: 'rejected', recovery: { kind: 'invalid_transition' } })

    const manual = harness({ sessions: sessionMocks({
      begin: vi.fn(async () => ({
        schemaVersion: 2 as const,
        status: 'manual_review' as const,
        reasonCodes: ['work_duration_conflict'] as const,
        sourceCategories: ['safety'] as const,
      })),
    }) })
    await expect(manual.controller.begin(beginInput)).resolves.toMatchObject({
      status: 'manual_review',
      recovery: { kind: 'manual_review', reasonCodes: ['work_duration_conflict'] },
    })
  })

  it('maps unavailable and invalid learner sessions without exposing backend errors', async () => {
    const unavailable = harness({ sessions: sessionMocks({
      resume: vi.fn(async () => ({
        schemaVersion: 1 as const,
        status: 'unavailable' as const,
        reasonCode: 'study-session-unavailable' as const,
      })),
    }) })
    await expect(unavailable.controller.resume({
      sessionId: 'session:server-generated-a', curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      status: 'unavailable', recovery: { reasonCode: 'study-session-unavailable' },
    })

    const unauthorized = harness({ sessions: sessionMocks({
      resume: vi.fn(async () => {
        throw new StudyIdentityClientError('student-session-invalid')
      }),
    }) })
    const result = await unauthorized.controller.resume({
      sessionId: 'session:server-generated-a', curriculumReleaseVersion: '1.0.0',
    })
    expect(result).toMatchObject({
      status: 'resume_required', recovery: { kind: 'student_session_invalid' },
    })
    expect(JSON.stringify(result)).not.toMatch(/database|stack|token|credential/i)
  })

  it('turns malformed or unknown-key wire data into a bounded unavailable state', async () => {
    const sessionClient = createStudyProductionSessionClient({
      runtime: {
        execute: vi.fn(async () => ({ ...projection('begun'), privatePersistenceRow: {} })),
      },
      createAttemptRef: () => 'attempt:malformed',
    })
    const { controller } = harness({ sessions: sessionClient })
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'unavailable', session: null,
      recovery: { kind: 'contract_invalid' },
    })
  })

  it('never imports or invokes a preview fallback from the production foundation', async () => {
    const sources = [
      readFileSync(new URL('./sessionController.ts', import.meta.url), 'utf8'),
      readFileSync(new URL('../client/studyProductionSessionClient.ts', import.meta.url), 'utf8'),
    ].join('\n')
    expect(sources).not.toMatch(/localDevelopmentPorts|mountedPorts|StudySessionRoute/)

    const begin = vi.fn(async () => {
      throw new StudyIdentityClientError('service-not-ready')
    })
    const { controller } = harness({ sessions: sessionMocks({ begin }) })
    const result = await controller.begin(beginInput)
    expect(result.status).toBe('network_failure')
    expect(begin).toHaveBeenCalledOnce()
  })

  it('coalesces concurrent duplicate mutations into one server call', async () => {
    let resolve!: (value: StudyProductionBeginResponse) => void
    const pending = new Promise<StudyProductionBeginResponse>((done) => { resolve = done })
    const begin = vi.fn(() => pending)
    const { controller } = harness({ sessions: sessionMocks({ begin }) })
    const first = controller.begin(beginInput)
    const second = controller.begin(beginInput)
    expect(begin).toHaveBeenCalledOnce()
    expect(first).toBe(second)
    resolve(projection('begun') as StudyProductionBeginResponse)
    await expect(first).resolves.toMatchObject({ status: 'ready' })
  })

  it('serializes recovery reads behind an in-flight mutation', async () => {
    let resolve!: (value: StudyProductionTransitionResponse) => void
    const transitionResult = new Promise<StudyProductionTransitionResponse>((done) => { resolve = done })
    const transition = vi.fn(() => transitionResult)
    const resume = vi.fn(async (): Promise<StudyProductionResumeResponse> => ({
      ...projection('resumable', 2),
      status: 'resumable',
      checkpoint: null,
    }))
    const { controller } = await begunController(sessionMocks({ transition, resume }))
    const mutation = controller.transition({
      type: 'segment-completed', segmentId: 'segment-bound-a',
    })
    await expect(controller.resume({
      sessionId: 'session:server-generated-a', curriculumReleaseVersion: '1.0.0',
    })).resolves.toMatchObject({
      status: 'resume_required', recovery: { kind: 'mutation_pending' },
    })
    expect(resume).not.toHaveBeenCalled()
    resolve(projection('stored', 2, {
      currentSegmentId: null,
      lastTransition: {
        type: 'segment-completed', acceptedAt: '2026-08-10T15:02:00.000Z',
      },
    }) as StudyProductionTransitionResponse)
    await expect(mutation).resolves.toMatchObject({ status: 'ready', session: { revision: 2 } })
  })

  it('coalesces duplicate authoritative resume reads', async () => {
    let resolve!: (value: StudyProductionResumeResponse) => void
    const resumed = new Promise<StudyProductionResumeResponse>((done) => { resolve = done })
    const resume = vi.fn(() => resumed)
    const { controller } = harness({ sessions: sessionMocks({ resume }) })
    const request = {
      sessionId: 'session:server-generated-a', curriculumReleaseVersion: '1.0.0',
    }
    const first = controller.resume(request)
    const second = controller.resume(request)
    expect(resume).toHaveBeenCalledOnce()
    resolve({
      ...projection('resumable', 3),
      status: 'resumable',
      checkpoint: null,
    })
    await expect(first).resolves.toMatchObject({ status: 'ready', session: { revision: 3 } })
    await expect(second).resolves.toMatchObject({ status: 'ready', session: { revision: 3 } })
  })

  it('blocks a different mutation while a prior network result is uncertain', async () => {
    const begin = vi.fn(async () => {
      throw new StudyIdentityClientError('service-not-ready')
    })
    const { controller } = harness({ sessions: sessionMocks({ begin }) })
    await controller.begin(beginInput)
    const different = await controller.begin({
      ...beginInput,
      initialSegmentId: 'segment-different-logical-operation',
    })
    expect(different).toMatchObject({
      status: 'resume_required', pendingMutation: 'begin',
      recovery: { kind: 'mutation_pending' },
    })
    expect(begin).toHaveBeenCalledOnce()
  })

  it('keeps snapshots privacy-safe and omits mutation identities', async () => {
    const { controller } = harness()
    const result = await controller.begin(beginInput)
    const serialized = JSON.stringify(result)
    expect(serialized).not.toMatch(
      /mutation:begin|household|studentId|learnerRef|private.?note|raw.?safety|raw.?answer|transcript|diagnostic|emotional|personality|secret|credential/i,
    )
    expect(serialized).toContain('session:server-generated-a')
  })

  it('exposes a stable future UI interface with loading notifications and local selection', async () => {
    const { controller } = harness()
    const statuses: string[] = []
    const unsubscribe = controller.subscribe((value) => statuses.push(value.status))
    await controller.begin(beginInput)
    expect(statuses).toEqual(['loading', 'ready'])
    expect(controller.selectSegment('segment-ui-choice').selection.segmentId)
      .toBe('segment-ui-choice')
    unsubscribe()
    await controller.readCheckpoint()
    expect(statuses).toEqual(['loading', 'ready'])
    expect(Object.isFrozen(controller.snapshot())).toBe(true)
  })

  it('requires resume when checkpoint reads reveal newer server session state', async () => {
    const readCheckpoint = vi.fn(async (): Promise<StudyProductionCheckpointReadResponse> => ({
      schemaVersion: 2,
      status: 'found',
      sessionRevision: 4,
      currentState: 'paused',
      curriculumBinding: binding,
      checkpoint: checkpoint(2),
    }))
    const { controller } = await begunController(sessionMocks({ readCheckpoint }))
    const result = await controller.readCheckpoint()
    expect(result).toMatchObject({
      status: 'resume_required',
      session: { revision: 1, state: 'active' },
      acceptedCheckpointRevision: 0,
      recovery: { kind: 'revision_conflict', currentRevision: 4 },
    })
  })
})

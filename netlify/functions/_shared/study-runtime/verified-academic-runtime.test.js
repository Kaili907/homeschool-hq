import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { createStudyAcademicRuntimeHandler } from '../../study-academic-runtime.js'
import { createVerifiedAcademicRuntimeGateway } from './verified-academic-runtime.js'

const reference = `aca_stu_v1_${'A'.repeat(43)}`
const binding = {
  schemaVersion: 1,
  status: 'bound',
  releaseId: '16000000-0000-4000-8000-000000000001',
  packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
  releaseVersion: '1.0.0',
  curriculumManifestSha256: 'a'.repeat(64),
}
const settings = {
  timerMode: 'visible', maximumWorkMinutes: 30,
  breakMinimumMinutes: 5, breakMaximumMinutes: 15,
  minimumBreakCount: 0, requiredBreakIntervalMinutes: 30,
  reducedMotion: false, noAudio: false, largeText: false,
  readAloud: false, speechInputAllowed: false,
}

function begunBody(overrides = {}) {
  return {
    schemaVersion: 2,
    status: 'begun',
    sessionId: 'session:server-generated-a',
    state: 'active',
    revision: 1,
    acceptedAt: '2026-08-10T15:00:00.000Z',
    updatedAt: '2026-08-10T15:00:00.000Z',
    lessonId: 'lesson-bound-a',
    subjectId: 'math',
    studyPlanId: null,
    intendedLocalDate: '2026-08-10',
    currentSegmentId: 'segment-bound-a',
    completedAt: null,
    lastTransition: {
      type: 'session-started', acceptedAt: '2026-08-10T15:00:00.000Z',
    },
    curriculumBinding: binding,
    effectiveSettings: settings,
    ...overrides,
  }
}

function beginRequest(overrides = {}) {
  return {
    idempotencyKey: 'session-bound-a-create',
    lessonId: 'lesson-bound-a',
    subjectId: 'math',
    studyPlanId: null,
    intendedLocalDate: '2026-08-10',
    initialSegmentId: 'segment-bound-a',
    curriculumContext: {
      releaseVersion: '1.0.0',
      lessonRef: 'lesson-bound-a',
      skillRefs: ['skill-bound-a'],
    },
    ...overrides,
  }
}

describe('verified academic runtime gateway', () => {
  it('passes only a digest and capability into one transactional RPC', async () => {
    const call = vi.fn(async () => ({
      schemaVersion: 1,
      status: 'ok',
      operation: 'calendar:read',
      body: { blocks: [] },
    }))
    const gateway = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call },
    })
    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'calendar:read',
      request: { cursor: null },
    })).resolves.toEqual({
      schemaVersion: 1,
      status: 'ok',
      operation: 'calendar:read',
      body: { blocks: [] },
    })
    expect(call).toHaveBeenCalledWith('academy_study_execute_verified_runtime_v1', {
      p_token_digest: createHash('sha256').update(reference, 'ascii').digest('hex'),
      p_required_capability: 'student:assignments:read',
      p_operation: 'calendar:read',
      p_request: { cursor: null },
    })
  })

  it('passes bounded Academy curriculum context only as an advisory proposal', async () => {
    const body = begunBody()
    const call = vi.fn(async () => ({
      schemaVersion: 1,
      status: 'ok',
      operation: 'session:begin',
      body,
    }))
    const request = beginRequest()
    const gateway = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call },
    })

    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'session:begin',
      request,
    })).resolves.toMatchObject({ body })
    expect(call).toHaveBeenCalledWith('academy_study_execute_session_lifecycle_v2', {
      p_token_digest: createHash('sha256').update(reference, 'ascii').digest('hex'),
      p_required_capability: 'student:attempts:create',
      p_operation: 'session:begin',
      p_request: request,
    })
    expect(call.mock.calls[0][1].p_request).toEqual(request)
    expect(JSON.stringify(call.mock.calls[0][1])).not.toMatch(/studentId|householdId/)
  })

  it('allows canonical checkpoint transport fields without opening authority or raw content', async () => {
    const call = vi.fn(async () => ({
      schemaVersion: 1,
      status: 'ok',
      operation: 'checkpoint:compare-and-swap',
      body: {
        schemaVersion: 2,
        status: 'stored',
        checkpointRevision: 1,
        sessionRevision: 3,
        currentState: 'active',
        curriculumBinding: binding,
      },
    }))
    const gateway = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call },
    })
    const checkpoint = {
      contract: 'study-core-bridge.recovery-checkpoint.v1',
      contractVersion: 1,
      checkpointId: 'checkpoint-server-generated-a',
      revision: 1,
      createdAt: '2026-08-10T15:01:00.000Z',
      updatedAt: '2026-08-10T15:02:00.000Z',
      sessionId: 'session:server-generated-a',
      lessonId: 'lesson-bound-a',
      segmentId: 'segment-bound-a',
      safeInstructionalCursor: {
        tutorPhase: 'guided-practice', cycleNumber: 1,
        currentItemId: 'task-bound-a', currentItemIndex: 0, teachingTurnIndex: 1,
      },
      completedSegmentIds: [],
      perSegmentActiveTime: [],
      pausedSeconds: 0,
      breakSeconds: 0,
      protectedDraftRef: null,
      protectedTutorStateRef: 'tutor-state:server-generated-a',
      lastAcceptedEventId: null,
      eventVersion: 1,
      tutorInteractionRef: 'interaction-bound-a',
      technicalInterruption: {
        status: 'none', interruptionId: null, category: 'none', startedAt: null,
      },
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }

    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'checkpoint:compare-and-swap',
      request: {
        sessionId: 'session:server-generated-a',
        expectedRevision: 0,
        mutationId: 'checkpoint-mutation-a',
        checkpoint,
        curriculumReleaseVersion: '1.0.0',
      },
    })).resolves.toMatchObject({ body: { status: 'stored', checkpointRevision: 1 } })
    expect(call).toHaveBeenCalledTimes(1)

    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'checkpoint:compare-and-swap',
      request: {
        sessionId: 'session:server-generated-a',
        expectedRevision: 0,
        mutationId: 'checkpoint-mutation-forged',
        checkpoint: { ...checkpoint, startedAt: '1999-01-01T00:00:00.000Z' },
        curriculumReleaseVersion: '1.0.0',
      },
    })).rejects.toThrow('runtime_authority_boundary')
    expect(call).toHaveBeenCalledTimes(1)

    call.mockResolvedValueOnce({
      schemaVersion: 1,
      status: 'ok',
      operation: 'session:resume',
      body: begunBody({ status: 'resumable', checkpoint }),
    })
    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'session:resume',
      request: {
        sessionId: 'session:server-generated-a',
        curriculumReleaseVersion: '1.0.0',
      },
    })).resolves.toMatchObject({
      body: {
        status: 'resumable',
        checkpoint: { rawAnswerIncluded: false, transcriptIncluded: false },
      },
    })
  })

  it('rejects caller-authored begin authority and exact-response additions', async () => {
    const gateway = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call: vi.fn() },
    })
    for (const tamper of [
      { studentId: '22222222-2222-4222-8222-222222222222' },
      { role: 'guardian' },
      { revision: 99 },
      { acceptedAt: '1999-01-01T00:00:00.000Z' },
    ]) {
      await expect(gateway.execute({
        sessionReference: reference,
        operation: 'session:begin',
        request: beginRequest(tamper),
      })).rejects.toThrow()
    }

    const resumeRequest = {
      sessionId: 'session:server-generated-a',
      curriculumReleaseVersion: '1.0.0',
    }
    const resumed = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call: vi.fn(async () => ({
        schemaVersion: 1,
        status: 'ok',
        operation: 'session:resume',
        body: begunBody({ status: 'resumable', checkpoint: null }),
      })) },
    })
    await expect(resumed.execute({
      sessionReference: reference,
      operation: 'session:resume',
      request: resumeRequest,
    })).resolves.toMatchObject({ body: { status: 'resumable', checkpoint: null } })

    const leaking = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call: vi.fn(async () => ({
        schemaVersion: 1,
        status: 'ok',
        operation: 'session:resume',
        body: begunBody({
          status: 'resumable', checkpoint: null, privateNotes: ['forbidden'],
        }),
      })) },
    })
    await expect(leaking.execute({
      sessionReference: reference,
      operation: 'session:resume',
      request: resumeRequest,
    })).rejects.toThrow(/contract/i)
  })

  it('rejects caller identity, sentinels, and protected response payloads', async () => {
    const gateway = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call: vi.fn() },
    })
    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'session:begin',
      request: { studentId: '22222222-2222-4222-8222-222222222222' },
    })).rejects.toThrow(/authority/i)
    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'session:begin',
      request: { learnerRef: '22222222-2222-4222-8222-222222222222' },
    })).rejects.toThrow(/authority/i)
    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'session:begin',
      request: { blockRef: 'learner:local-release-candidate' },
    })).rejects.toThrow(/sentinel/i)
    await expect(gateway.execute({
      sessionReference: reference,
      operation: 'session:begin',
      request: {
        idempotencyKey: 'session-a-create',
        lessonId: 'lesson-a', subjectId: 'math', studyPlanId: null,
        intendedLocalDate: '2026-08-10', initialSegmentId: 'segment-a',
        curriculumContext: {
          releaseVersion: '1.0.0', lessonRef: 'lesson-a', skillRefs: [],
          releaseId: 'browser-must-not-author-release-id',
          manifestHash: 'a'.repeat(64),
          publishedState: 'published',
          activePointer: { environment: 'production', revision: 999 },
        },
      },
    })).rejects.toThrow(/invalid/i)

    const leaking = createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call: vi.fn(async () => ({
        schemaVersion: 1,
        status: 'ok',
        operation: 'dashboard:read',
        body: { rawAnswer: 'not allowed' },
      })) },
    })
    await expect(leaking.execute({
      sessionReference: reference,
      operation: 'dashboard:read',
      request: {},
    })).rejects.toThrow(/authority/i)
  })

  it('keeps the HTTP response minimized and fails closed', async () => {
    const execute = vi.fn(async () => ({
      schemaVersion: 1,
      status: 'ok',
      operation: 'dashboard:read',
      body: { assignments: [] },
    }))
    const handler = createStudyAcademicRuntimeHandler({
      gateway: { isReady: () => true, execute },
    })
    const response = await handler({
      httpMethod: 'POST',
      path: '/api/study/academic-runtime',
      headers: {
        authorization: `Bearer ${reference}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ schemaVersion: 1, operation: 'dashboard:read', request: {} }),
    })
    expect(response.statusCode).toBe(200)
    expect(response.body).not.toMatch(/student|household|grant|token|credential/i)
    expect((await handler({ httpMethod: 'POST', path: '/api/study/academic-runtime', headers: {} })).statusCode).toBe(401)
  })
})

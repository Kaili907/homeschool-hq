import { describe, expect, it, vi } from 'vitest'
import { createStudyAcademicRuntimeHandler } from '../../study-academic-runtime.js'
import { createVerifiedAcademicRuntimeGateway } from './verified-academic-runtime.js'

const REFERENCE = `aca_stu_v1_${'A'.repeat(43)}`
const RELEASE_ID = '16000000-0000-4000-8000-000000000001'
const ENV = Object.freeze({ ACADEMY_STUDY_ENABLED: 'true' })

const binding = Object.freeze({
  schemaVersion: 1,
  status: 'bound',
  releaseId: RELEASE_ID,
  packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
  releaseVersion: '1.0.0',
  curriculumManifestSha256: 'a'.repeat(64),
})

const settings = Object.freeze({
  timerMode: 'visible', maximumWorkMinutes: 30,
  breakMinimumMinutes: 5, breakMaximumMinutes: 15,
  minimumBreakCount: 0, requiredBreakIntervalMinutes: 30,
  reducedMotion: false, noAudio: false, largeText: false,
  readAloud: false, speechInputAllowed: false,
})

function sessionBody(overrides = {}) {
  return {
    schemaVersion: 2,
    status: 'begun',
    sessionId: 'session:server-generated-security-a',
    state: 'active',
    revision: 1,
    acceptedAt: '2026-08-10T15:00:00.000Z',
    updatedAt: '2026-08-10T15:00:00.000Z',
    lessonId: 'lesson-security-a',
    subjectId: 'math',
    studyPlanId: null,
    intendedLocalDate: '2026-08-10',
    currentSegmentId: 'segment-security-a',
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
    idempotencyKey: 'begin-security-a',
    lessonId: 'lesson-security-a',
    subjectId: 'math',
    studyPlanId: null,
    intendedLocalDate: '2026-08-10',
    initialSegmentId: 'segment-security-a',
    curriculumContext: {
      releaseVersion: '1.0.0',
      lessonRef: 'lesson-security-a',
      skillRefs: ['skill-security-a'],
    },
    ...overrides,
  }
}

function checkpoint(overrides = {}) {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: 'checkpoint-security-a',
    revision: 1,
    createdAt: '2026-08-10T15:01:00.000Z',
    updatedAt: '2026-08-10T15:02:00.000Z',
    sessionId: 'session:server-generated-security-a',
    lessonId: 'lesson-security-a',
    segmentId: 'segment-security-a',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice', cycleNumber: 1,
      currentItemId: 'task-security-a', currentItemIndex: 0,
      teachingTurnIndex: 1,
    },
    completedSegmentIds: [],
    perSegmentActiveTime: [{ segmentId: 'segment-security-a', activeSeconds: 10 }],
    pausedSeconds: 0,
    breakSeconds: 0,
    protectedDraftRef: null,
    protectedTutorStateRef: 'tutor-state:security-a',
    lastAcceptedEventId: null,
    eventVersion: 1,
    tutorInteractionRef: 'interaction-security-a',
    technicalInterruption: {
      status: 'none', interruptionId: null, category: 'none', startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
    ...overrides,
  }
}

function gatewayFor(operation, body, wrapper = {}) {
  const call = vi.fn(async () => ({
    schemaVersion: 1,
    status: 'ok',
    operation,
    body,
    ...wrapper,
  }))
  return {
    call,
    gateway: createVerifiedAcademicRuntimeGateway({
      rpc: { isConfigured: () => true, call },
    }),
  }
}

describe('Study production runtime adversarial DTO boundary', () => {
  it.each([
    ['forged learner identity', { studentId: '00000000-0000-4000-8000-000000000001' }],
    ['forged household identity', { householdId: '00000000-0000-4000-8000-000000000002' }],
    ['forged role', { role: 'guardian' }],
    ['forged capability', { capability: 'student:attempts:create' }],
    ['forged accepted timestamp', { acceptedAt: '1999-01-01T00:00:00.000Z' }],
    ['forged revision', { revision: 99 }],
  ])('rejects %s before calling authority', async (_label, tamper) => {
    const { gateway, call } = gatewayFor('session:begin', sessionBody())
    await expect(gateway.execute({
      sessionReference: REFERENCE,
      operation: 'session:begin',
      request: beginRequest(tamper),
    })).rejects.toThrow()
    expect(call).not.toHaveBeenCalled()
  })

  it('rejects browser-authored release, package, digest, and activation authority', async () => {
    const { gateway, call } = gatewayFor('session:begin', sessionBody())
    const forgedContext = {
      ...beginRequest().curriculumContext,
      releaseId: RELEASE_ID,
      packageId: 'forged-package',
      curriculumManifestSha256: 'b'.repeat(64),
      status: 'published',
      activePointer: { environment: 'production', revision: 999 },
    }
    await expect(gateway.execute({
      sessionReference: REFERENCE,
      operation: 'session:begin',
      request: beginRequest({ curriculumContext: forgedContext }),
    })).rejects.toThrow(/invalid/i)
    expect(call).not.toHaveBeenCalled()
  })

  it.each(['2026-02-30', '2026-13-01', 'not-a-date'])
    ('rejects malformed intended date %s before authority', async (intendedLocalDate) => {
      const { gateway, call } = gatewayFor('session:begin', sessionBody())
      await expect(gateway.execute({
        sessionReference: REFERENCE,
        operation: 'session:begin',
        request: beginRequest({ intendedLocalDate }),
      })).rejects.toThrow(/invalid/i)
      expect(call).not.toHaveBeenCalled()
    })

  it('aligns the identifier boundary with the 160-character database contract', async () => {
    const { gateway, call } = gatewayFor('session:begin', sessionBody())
    const boundary = `x${'a'.repeat(159)}`
    await expect(gateway.execute({
      sessionReference: REFERENCE,
      operation: 'session:begin',
      request: beginRequest({ idempotencyKey: boundary }),
    })).resolves.toMatchObject({ body: { status: 'begun' } })
    expect(call).toHaveBeenCalledTimes(1)

    await expect(gateway.execute({
      sessionReference: REFERENCE,
      operation: 'session:begin',
      request: beginRequest({ idempotencyKey: `${boundary}a` }),
    })).rejects.toThrow(/invalid/i)
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed and unknown nested checkpoint fields before authority', async () => {
    const { gateway, call } = gatewayFor('checkpoint:compare-and-swap', {
      schemaVersion: 2, status: 'stored', checkpointRevision: 1,
      sessionRevision: 1, currentState: 'active', curriculumBinding: binding,
    })
    const malformed = checkpoint({
      safeInstructionalCursor: {
        ...checkpoint().safeInstructionalCursor,
        learnerAnswers: ['must-not-cross-boundary'],
      },
    })
    await expect(gateway.execute({
      sessionReference: REFERENCE,
      operation: 'checkpoint:compare-and-swap',
      request: {
        sessionId: malformed.sessionId,
        expectedRevision: 0,
        mutationId: 'checkpoint-security-a-write',
        checkpoint: malformed,
        curriculumReleaseVersion: '1.0.0',
      },
    })).rejects.toThrow()
    expect(call).not.toHaveBeenCalled()
  })

  it.each([
    ['dashboard:read', { sessions: [], unexpected: true }, {}],
    ['calendar:read', { blocks: [{
      blockId: 'block-security-a', blockType: 'lesson',
      sourceReference: 'lesson-security-a', scheduledStart: '2026-08-10T15:00:00.000Z',
      intendedLocalDate: '2026-08-10', state: 'scheduled', revision: 1,
      unexpected: true,
    }] }, { cursor: null }],
  ])('rejects unknown %s response keys', async (operation, body, request) => {
    const { gateway } = gatewayFor(operation, body)
    await expect(gateway.execute({
      sessionReference: REFERENCE, operation, request,
    })).rejects.toThrow(/contract/i)
  })

  it('accepts only the exact bounded dashboard and calendar response contracts', async () => {
    const dashboard = gatewayFor('dashboard:read', {
      sessions: [{
        sessionId: 'session:security-a', state: 'active',
        lessonId: 'lesson-security-a', revision: 1,
        updatedAt: '2026-08-10T15:00:00.000Z',
      }],
    }).gateway
    await expect(dashboard.execute({
      sessionReference: REFERENCE, operation: 'dashboard:read', request: {},
    })).resolves.toMatchObject({ body: { sessions: [{ revision: 1 }] } })

    const calendar = gatewayFor('calendar:read', {
      blocks: [{
        blockId: 'block-security-a', blockType: 'lesson',
        sourceReference: 'lesson-security-a',
        scheduledStart: '2026-08-10T15:00:00.000Z',
        intendedLocalDate: '2026-08-10', state: 'scheduled', revision: 1,
      }],
    }).gateway
    await expect(calendar.execute({
      sessionReference: REFERENCE, operation: 'calendar:read', request: { cursor: null },
    })).resolves.toMatchObject({ body: { blocks: [{ state: 'scheduled' }] } })
  })

  it('rejects unknown trusted RPC envelope keys even when the body is valid', async () => {
    const { gateway } = gatewayFor('session:begin', sessionBody(), { debug: true })
    await expect(gateway.execute({
      sessionReference: REFERENCE,
      operation: 'session:begin',
      request: beginRequest(),
    })).rejects.toThrow(/contract/i)
  })

  it.each([
    ['forged release UUID', { curriculumBinding: { ...binding, releaseId: 'not-a-uuid' } }],
    ['forged manifest digest', { curriculumBinding: { ...binding, curriculumManifestSha256: 'A'.repeat(64) } }],
    ['forged settings snapshot', { effectiveSettings: { ...settings, maximumWorkMinutes: 0 } }],
    ['malformed accepted instant', { acceptedAt: '2026-99-99T25:61:00Z' }],
    ['unknown projection key', { unknownAuthority: true }],
  ])('rejects %s in lifecycle responses', async (_label, tamper) => {
    const { gateway } = gatewayFor('session:begin', sessionBody(tamper))
    await expect(gateway.execute({
      sessionReference: REFERENCE,
      operation: 'session:begin',
      request: beginRequest(),
    })).rejects.toThrow(/contract/i)
  })

  it('rejects nested checkpoint privacy content in a resume response', async () => {
    const leakingCheckpoint = checkpoint({
      safeInstructionalCursor: {
        ...checkpoint().safeInstructionalCursor,
        learnerAnswers: ['private learner answer'],
      },
    })
    const { gateway } = gatewayFor('session:resume', sessionBody({
      status: 'resumable', checkpoint: leakingCheckpoint,
    }))
    await expect(gateway.execute({
      sessionReference: REFERENCE,
      operation: 'session:resume',
      request: {
        sessionId: 'session:server-generated-security-a',
        curriculumReleaseVersion: '1.0.0',
      },
    })).rejects.toThrow()
  })

  it.each([
    'privateNotes', 'rawSafetyText', 'learnerAnswers', 'tutorConversations',
    'assessmentResponses', 'emotionalLabels', 'personalityLabels',
    'diagnosticInference', 'serviceRoleCredentials', 'rawDatabaseError',
    'sql', 'rawProviderObject',
  ])('never serializes protected response field %s', async (protectedKey) => {
    const { gateway } = gatewayFor('dashboard:read', {
      sessions: [], [protectedKey]: 'sensitive-value',
    })
    await expect(gateway.execute({
      sessionReference: REFERENCE,
      operation: 'dashboard:read',
      request: {},
    })).rejects.toThrow()
  })
})

describe('Study academic runtime adversarial HTTP boundary', () => {
  function event(body, headers = {}) {
    return {
      httpMethod: 'POST',
      path: '/api/study/academic-runtime',
      headers: {
        authorization: `Bearer ${REFERENCE}`,
        'content-type': 'application/json',
        ...headers,
      },
      body,
    }
  }

  it('rejects unknown envelope keys and oversized payloads before execution', async () => {
    const execute = vi.fn()
    const handler = createStudyAcademicRuntimeHandler({
      env: ENV, gateway: { isReady: () => true, execute },
    })
    const unknown = await handler(event(JSON.stringify({
      schemaVersion: 1, operation: 'dashboard:read', request: {}, role: 'admin',
    })))
    expect(unknown.statusCode).toBe(400)

    const oversized = await handler(event(JSON.stringify({
      schemaVersion: 1, operation: 'dashboard:read',
      request: { padding: 'x'.repeat(16_384) },
    })))
    expect(oversized.statusCode).toBe(413)
    expect(execute).not.toHaveBeenCalled()
  })

  it('returns only a bounded error and does not log raw authority failures', async () => {
    const rawFailure = new Error('select * from private_notes; service-role-secret; learner answer')
    const handler = createStudyAcademicRuntimeHandler({
      env: ENV,
      gateway: { isReady: () => true, execute: vi.fn(async () => { throw rawFailure }) },
    })
    const logSpies = ['error', 'warn', 'log'].map((method) =>
      vi.spyOn(console, method).mockImplementation(() => {}))
    try {
      const response = await handler(event(JSON.stringify({
        schemaVersion: 1, operation: 'dashboard:read', request: {},
      })))
      expect(response.statusCode).toBe(500)
      expect(JSON.parse(response.body)).toEqual({ error: { code: 'internal_error' } })
      expect(response.body).not.toMatch(/select|private|secret|learner answer/i)
      for (const spy of logSpies) expect(spy).not.toHaveBeenCalled()
    } finally {
      for (const spy of logSpies) spy.mockRestore()
    }
  })
})

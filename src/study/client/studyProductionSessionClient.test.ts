import { describe, expect, it, vi } from 'vitest'
import type { StudyCheckpointRecord } from '../contracts/persistence/types'
import {
  createStudyProductionSessionClient,
  StudyProductionSessionContractError,
} from './studyProductionSessionClient'

const binding = Object.freeze({
  schemaVersion: 1,
  status: 'bound',
  releaseId: '16000000-0000-4000-8000-000000000001',
  packageId: 'manuel-academy-grades-5-7-8-curriculum-v1',
  releaseVersion: '1.0.0',
  curriculumManifestSha256: 'a'.repeat(64),
})

const settings = Object.freeze({
  timerMode: 'visible',
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

function session(status: 'begun' | 'resumable' | 'closed' | 'stored' = 'begun') {
  return {
    schemaVersion: 2,
    status,
    sessionId: 'session:server-generated-a',
    state: status === 'closed' ? 'completed' : 'active',
    revision: status === 'begun' ? 1 : 2,
    acceptedAt: '2026-08-10T15:00:00.000Z',
    updatedAt: '2026-08-10T15:02:00.000Z',
    lessonId: 'lesson-bound-a',
    subjectId: 'math',
    studyPlanId: null,
    intendedLocalDate: '2026-08-10',
    currentSegmentId: status === 'closed' ? null : 'segment-bound-a',
    completedAt: status === 'closed' ? '2026-08-10T15:02:00.000Z' : null,
    lastTransition: {
      type: status === 'closed' ? 'session-completed' : 'session-started',
      acceptedAt: status === 'closed'
        ? '2026-08-10T15:02:00.000Z'
        : '2026-08-10T15:00:00.000Z',
    },
    curriculumBinding: binding,
    effectiveSettings: settings,
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
    lessonId: 'lesson-bound-a',
    segmentId: 'segment-bound-a',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 1,
      currentItemId: 'task-production-a',
      currentItemIndex: 0,
      teachingTurnIndex: 1,
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
      status: 'none',
      interruptionId: null,
      category: 'none',
      startedAt: null,
    },
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  }
}

const beginRequest = Object.freeze({
  idempotencyKey: 'begin-production-a',
  lessonId: 'lesson-bound-a',
  subjectId: 'math',
  studyPlanId: null,
  intendedLocalDate: '2026-08-10',
  initialSegmentId: 'segment-bound-a',
  curriculumContext: Object.freeze({
    releaseVersion: '1.0.0',
    lessonRef: 'lesson-bound-a',
    skillRefs: Object.freeze(['skill-bound-a']),
  }),
})

const resumeRequest = Object.freeze({
  sessionId: 'session:server-generated-a',
  curriculumReleaseVersion: '1.0.0',
})

function clientFor(body: unknown) {
  const execute = vi.fn(async () => body)
  return {
    client: createStudyProductionSessionClient({
      runtime: { execute },
      createAttemptRef: (operation) => `attempt:${operation}`,
    }),
    execute,
  }
}

describe('Study production session API DTO boundary', () => {
  it('routes each actual lifecycle operation through the verified runtime', async () => {
    const responses = [
      session('begun'),
      { ...session('resumable'), checkpoint: checkpoint() },
      session('stored'),
      {
        schemaVersion: 2,
        status: 'found',
        sessionRevision: 2,
        currentState: 'active',
        curriculumBinding: binding,
        checkpoint: checkpoint(),
      },
      {
        schemaVersion: 2,
        status: 'stored',
        checkpointRevision: 2,
        sessionRevision: 2,
        currentState: 'active',
        curriculumBinding: binding,
      },
    ]
    const execute = vi.fn(async (input: {
      readonly operation: string
      readonly operationRef: string
    }) => {
      void input
      return responses.shift()
    })
    const client = createStudyProductionSessionClient({
      runtime: { execute },
      createAttemptRef: (operation) => `attempt:${operation}`,
    })
    await client.begin(beginRequest)
    await client.resume(resumeRequest)
    await client.transition({
      ...resumeRequest,
      expectedRevision: 1,
      idempotencyKey: 'transition-a',
      transition: { type: 'segment-completed', segmentId: 'segment-bound-a' },
    })
    await client.readCheckpoint(resumeRequest)
    await client.saveCheckpoint({
      ...resumeRequest,
      expectedRevision: 1,
      mutationId: 'checkpoint-a',
      checkpoint: checkpoint(2),
    })

    expect(execute.mock.calls.map(([value]) => value.operation)).toEqual([
      'session:begin', 'session:resume', 'session:transition',
      'checkpoint:read', 'checkpoint:compare-and-swap',
    ])
    expect(execute.mock.calls.map(([value]) => value.operationRef)).toEqual([
      'attempt:session:begin', 'attempt:session:resume', 'attempt:session:transition',
      'attempt:checkpoint:read', 'attempt:checkpoint:compare-and-swap',
    ])
  })

  it('rebuilds and freezes an exact session instead of returning raw backend JSON', async () => {
    const raw = session('begun')
    const { client } = clientFor(raw)
    const result = await client.begin(beginRequest)
    expect(result).toEqual(raw)
    expect(result).not.toBe(raw)
    expect(Object.isFrozen(result)).toBe(true)
    raw.revision = 99
    expect(result.status === 'begun' && result.revision).toBe(1)
  })

  it.each([
    ['begin injected key', { ...session('begun'), privateNotes: ['forbidden'] }, 'begin'],
    ['begin malformed revision', { ...session('begun'), revision: 1.5 }, 'begin'],
    ['begin malformed state', { ...session('begun'), state: 'browser-completed' }, 'begin'],
    ['begin settings addition', {
      ...session('begun'), effectiveSettings: { ...settings, serverPolicy: 'private' },
    }, 'begin'],
    ['resume private checkpoint field', {
      ...session('resumable'), checkpoint: { ...checkpoint(), transcript: 'forbidden' },
    }, 'resume'],
    ['transition injected binding field', {
      ...session('stored'), curriculumBinding: { ...binding, releaseRow: {} },
    }, 'transition'],
    ['checkpoint read unknown key', {
      schemaVersion: 2, status: 'not-found', sessionRevision: 2,
      currentState: 'active', curriculumBinding: binding, checkpoint: null,
      databaseError: 'forbidden',
    }, 'readCheckpoint'],
    ['checkpoint result malformed revision', {
      schemaVersion: 2, status: 'stored', checkpointRevision: -1,
      sessionRevision: 2, currentState: 'active', curriculumBinding: binding,
    }, 'saveCheckpoint'],
  ])('rejects %s', async (_label, body, operation) => {
    const { client } = clientFor(body)
    const call = operation === 'begin'
      ? client.begin(beginRequest)
      : operation === 'resume'
        ? client.resume(resumeRequest)
        : operation === 'transition'
          ? client.transition({
              ...resumeRequest,
              expectedRevision: 1,
              idempotencyKey: 'transition-a',
              transition: { type: 'segment-completed', segmentId: 'segment-bound-a' },
            })
          : operation === 'readCheckpoint'
            ? client.readCheckpoint(resumeRequest)
            : client.saveCheckpoint({
                ...resumeRequest,
                expectedRevision: 0,
                mutationId: 'checkpoint-a',
                checkpoint: checkpoint(),
              })
    await expect(call).rejects.toBeInstanceOf(StudyProductionSessionContractError)
  })

  it('accepts only bounded server failure DTOs', async () => {
    const { client: manual } = clientFor({
      schemaVersion: 2,
      status: 'manual_review',
      reasonCodes: ['work_duration_conflict'],
      sourceCategories: ['guardian', 'safety'],
    })
    await expect(manual.begin(beginRequest)).resolves.toEqual({
      schemaVersion: 2,
      status: 'manual_review',
      reasonCodes: ['work_duration_conflict'],
      sourceCategories: ['guardian', 'safety'],
    })

    const { client: unbounded } = clientFor({
      schemaVersion: 2,
      status: 'unavailable',
      reasonCode: 'raw database timeout from private host',
    })
    await expect(unbounded.begin(beginRequest)).rejects.toBeInstanceOf(
      StudyProductionSessionContractError,
    )
  })
})

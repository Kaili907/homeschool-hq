import { describe, expect, it, vi } from 'vitest'
import type { AcademyStudyContext } from '../../academy/adapters/studyContextAdapter'
import { createStudyBoundContentClient } from '../client/studyBoundContentClient'
import { StudyIdentityClientError } from '../client/studyIdentityClient'
import { createStudyProductionSessionClient } from '../client/studyProductionSessionClient'
import type { StudyProductionReadinessClient } from '../client/studyProductionReadinessClient'
import type { StudyCheckpointRecord } from '../contracts/persistence/types'
import type { StudyProductionSessionProjection } from '../contracts/production/session'
import {
  createStudyProductionController,
  type StudyProductionCheckpointDraft,
} from './sessionController'
import type { VerifiedRuntimeExecuteInput } from './verifiedRuntimeAdapter'

const academyContext: AcademyStudyContext = Object.freeze({
  adapterVersion: 1,
  releaseVersion: '1.0.0',
  lessonRef: 'grade-5:academy-week-1-day-1',
  skillRefs: Object.freeze(['ma-g5-mathematics-u01-l01']) as string[],
  scopeWeek: 1,
  scopeDay: 1,
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

function sessionProjection(
  status: StudyProductionSessionProjection['status'],
  revision: number,
  state: StudyProductionSessionProjection['state'],
): StudyProductionSessionProjection {
  return {
    schemaVersion: 2,
    status,
    sessionId: 'session:production-path-a',
    state,
    revision,
    acceptedAt: '2026-08-10T15:00:00.000Z',
    updatedAt: `2026-08-10T15:${String(revision).padStart(2, '0')}:00.000Z`,
    lessonId: academyContext.lessonRef,
    subjectId: 'math',
    studyPlanId: null,
    intendedLocalDate: '2026-08-10',
    currentSegmentId: 'segment:guided-practice',
    completedAt: null,
    lastTransition: {
      type: revision === 1 ? 'session-started' : 'pause-started',
      acceptedAt: `2026-08-10T15:${String(revision).padStart(2, '0')}:00.000Z`,
    },
    curriculumBinding: binding,
    effectiveSettings: settings,
  }
}

function checkpoint(revision = 1): StudyCheckpointRecord {
  return {
    contract: 'study-core-bridge.recovery-checkpoint.v1',
    contractVersion: 1,
    checkpointId: 'checkpoint:production-path-a',
    revision,
    createdAt: '2026-08-10T15:03:00.000Z',
    updatedAt: '2026-08-10T15:03:00.000Z',
    sessionId: 'session:production-path-a',
    lessonId: academyContext.lessonRef,
    segmentId: 'segment:guided-practice',
    safeInstructionalCursor: {
      tutorPhase: 'guided-practice',
      cycleNumber: 1,
      currentItemId: 'item:learner-safe-a',
      currentItemIndex: 0,
      teachingTurnIndex: 1,
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

function learnerContent() {
  return {
    schemaVersion: 1,
    status: 'ready',
    reasonCode: 'content-ready',
    sessionRef: 'session:production-path-a',
    lessonRef: academyContext.lessonRef,
    skillRefs: [...academyContext.skillRefs],
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

describe('integrated Study learner production path R4', () => {
  it('runs readiness, replay-safe begin, bound content, transition, checkpoint, and server-wins resume', async () => {
    let serverRevision = 0
    let serverState: StudyProductionSessionProjection['state'] = 'active'
    let storedCheckpoint: StudyCheckpointRecord | null = null
    const beginRequests: Array<Readonly<Record<string, unknown>>> = []
    const runtime = {
      execute: vi.fn(async ({ operation, request }: VerifiedRuntimeExecuteInput) => {
        if (operation === 'session:begin') {
          beginRequests.push(request)
          serverRevision = 1
          serverState = 'active'
          return sessionProjection('begun', serverRevision, serverState)
        }
        if (operation === 'session:transition') {
          if (request.expectedRevision !== serverRevision) {
            return {
              schemaVersion: 2,
              status: 'revision-conflict',
              currentRevision: serverRevision,
              currentState: serverState,
            }
          }
          serverRevision += 1
          serverState = 'paused'
          return sessionProjection('stored', serverRevision, serverState)
        }
        if (operation === 'checkpoint:compare-and-swap') {
          const candidate = request.checkpoint as StudyCheckpointRecord
          storedCheckpoint = candidate
          return {
            schemaVersion: 2,
            status: 'stored',
            checkpointRevision: candidate.revision,
            sessionRevision: serverRevision,
            currentState: serverState,
            curriculumBinding: binding,
          }
        }
        if (operation === 'session:resume') {
          return {
            ...sessionProjection('resumable', serverRevision, serverState),
            status: 'resumable',
            checkpoint: storedCheckpoint,
          }
        }
        throw new Error(`unexpected operation: ${operation}`)
      }),
    }
    const sessions = createStudyProductionSessionClient({
      runtime,
      createAttemptRef: (operation) => `attempt:${operation}`,
    })

    const activePointer = { releaseVersion: '1.0.0' }
    let contentUncertain = true
    const readBoundContent = vi.fn(async () => {
      if (contentUncertain) {
        contentUncertain = false
        throw new StudyIdentityClientError('service-not-ready')
      }
      const response = learnerContent()
      if (activePointer.releaseVersion === '2.0.0') {
        expect(response.curriculumBinding.releaseVersion).toBe('1.0.0')
      }
      return response
    })
    const content = createStudyBoundContentClient({
      runtime: { readBoundContent },
      createAttemptRef: () => 'attempt:bound-content',
    })
    const readyWire = Object.freeze({
      schemaVersion: 1 as const,
      status: 'ready' as const,
      expiresAt: '2099-08-10T15:00:00.000Z',
    })
    const readiness: StudyProductionReadinessClient = {
      read: vi.fn(async () => readyWire),
      revalidate: vi.fn(async () => readyWire),
      invalidate: vi.fn(),
    }
    let mutationSequence = 0
    const controller = createStudyProductionController({
      readiness,
      sessions,
      content,
      createMutationId: (kind) => `mutation:${kind}:${++mutationSequence}`,
    })

    await expect(controller.checkReadiness()).resolves.toMatchObject({ status: 'ready' })
    const beginInput = {
      academyContext,
      subjectId: 'math',
      studyPlanId: null,
      intendedLocalDate: '2026-08-10',
      initialSegmentId: 'segment:guided-practice',
    }
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'network_failure',
      session: { revision: 1, curriculumBinding: { releaseVersion: '1.0.0' } },
      content: null,
      pendingMutation: 'begin',
    })
    await expect(controller.begin(beginInput)).resolves.toMatchObject({
      status: 'ready',
      session: { revision: 1 },
      content: { status: 'ready', skillRefs: academyContext.skillRefs },
      pendingMutation: null,
    })
    expect(beginRequests).toHaveLength(2)
    expect(beginRequests[0]!.idempotencyKey).toBe(beginRequests[1]!.idempotencyKey)

    await expect(controller.transition({
      type: 'pause-started', segmentId: 'segment:guided-practice',
    })).resolves.toMatchObject({ status: 'ready', session: { revision: 2, state: 'paused' } })
    await expect(controller.saveCheckpoint(checkpointDraft())).resolves.toMatchObject({
      status: 'ready', acceptedCheckpointRevision: 1,
    })

    activePointer.releaseVersion = '2.0.0'
    controller.selectSegment('segment:stale-browser-selection')
    await expect(controller.resume({
      sessionId: 'session:production-path-a', academyContext,
    })).resolves.toMatchObject({
      status: 'ready',
      session: { revision: 2, state: 'paused', curriculumBinding: { releaseVersion: '1.0.0' } },
      content: { curriculumBinding: { releaseVersion: '1.0.0' } },
      checkpoint: { revision: 1, rawAnswerIncluded: false, transcriptIncluded: false },
      selection: { segmentId: 'segment:guided-practice' },
    })

    serverRevision = 3
    await expect(controller.transition({
      type: 'session-resumed', segmentId: 'segment:guided-practice',
    })).resolves.toMatchObject({
      status: 'conflict',
      session: { revision: 2 },
      recovery: { kind: 'revision_conflict', currentRevision: 3 },
    })
    await expect(controller.resume({
      sessionId: 'session:production-path-a', academyContext,
    })).resolves.toMatchObject({ status: 'ready', session: { revision: 3 } })

    const serialized = JSON.stringify(controller.snapshot())
    expect(serialized).not.toMatch(
      /serverAuthority|sourceRoot|scoringGuidance|masteryRule|adaptiveTutorRoutes|safetyAndPrivacy|parentVisibility|rawAnswer\":true|transcriptIncluded\":true|secret|credential/i,
    )
    expect(JSON.stringify(readBoundContent.mock.calls)).not.toMatch(/preview|demo|latest/i)
  })
})

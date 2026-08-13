import {
  completeCurrentSegment,
  createCalendarBlock,
  startCalendarBlock,
  type CalendarBlock,
} from '../../../../adaptive-tutor/study-engine/runtime/src/calendar'
import type { StudyLearnerPreferences, StudyParentSettings } from '../../types'
import type { FamilyPilotAssignmentRecordV1 } from '../../family-pilot/core'
import type { FinalFamilyPilotAttestationRecord } from '../../family-pilot/final-composition'
import type { FinalFamilyPilotSourceAttachment } from '../../family-pilot/final-app/state'
import type { SafetyHoldV1 } from '../../family-pilot/safety'
import type {
  ReconciliableStudyState,
  StudyAuthorityActor,
  StudyAuthorityStamp,
  StudyDocumentIdentity,
  StudyFieldAuthority,
  StudySyncMetadata,
  StudySyncOperationMetadata,
  StudySyncReplica,
} from './types'

export const TEST_NOW = '2026-08-13T16:00:00.000Z'
export const TEST_IDENTITY: StudyDocumentIdentity = Object.freeze({
  householdRef: 'household:one',
  learnerRef: 'student:a',
  studentRef: 'student:a',
  assignmentRef: 'assignment:a',
  lessonRef: 'lesson:a',
  blockRef: 'block:a',
  sessionRef: 'session:a',
  lineageRootRef: 'block:a',
  lineageKey: 'root',
})

const SEGMENTS = Object.freeze(['segment:one', 'segment:two', 'segment:three'])

export function authorityStamp(
  revision: number,
  actor: StudyAuthorityActor = 'SERVER',
  operationId = `authority:${actor.toLowerCase()}:${revision}`,
): StudyAuthorityStamp {
  return Object.freeze({ revision, actor, operationId })
}

export function initialAuthority(): StudyFieldAuthority {
  return Object.freeze({
    assignment: authorityStamp(0, 'SERVER', 'initial:assignment'),
    calendar: authorityStamp(0, 'SERVER', 'initial:calendar'),
    requirements: authorityStamp(0, 'SERVER', 'initial:requirements'),
    preferences: authorityStamp(0, 'SYSTEM', 'initial:preferences'),
    parentSettings: authorityStamp(0, 'SERVER', 'initial:parent-settings'),
    sourceAttachment: authorityStamp(0, 'SYSTEM', 'initial:source'),
    attestation: authorityStamp(0, 'SYSTEM', 'initial:attestation'),
    safetyHolds: Object.freeze({}),
  })
}

export function testPreferences(hidden = false): StudyLearnerPreferences {
  return Object.freeze({
    accessibility: Object.freeze({
      largeText: false,
      reducedMotion: false,
      noAudio: true,
      captions: true,
      transientTranscript: false,
      highContrast: false,
      oneTaskAtATime: true,
    }),
    timerPreference: Object.freeze({ visibility: hidden ? 'hidden' : 'shown', milestonesOnly: true }),
  })
}

export function testParentSettings(revision: number): StudyParentSettings {
  return Object.freeze({
    maximumWorkMinutes: 30,
    breakMinutes: 5,
    timerHidden: false,
    accommodations: Object.freeze([]),
    recommendationDecisions: Object.freeze([]),
    interruptions: Object.freeze([]),
    reschedules: Object.freeze([]),
    adultReviewRequests: Object.freeze([]),
    revision,
  })
}

export function testSource(identity = TEST_IDENTITY, sourceRef = 'source:one'): FinalFamilyPilotSourceAttachment {
  return Object.freeze({
    studentRef: identity.studentRef,
    assignmentRef: identity.assignmentRef,
    lessonRef: identity.lessonRef,
    sourceRef,
    title: 'Reviewed source',
    publisher: 'Synthetic publisher',
    publishedAt: '2026-08-01T00:00:00.000Z',
    attachedAt: TEST_NOW,
    status: 'ATTACHED_SATISFIED',
  })
}

export function testAttestation(
  status: FinalFamilyPilotAttestationRecord['status'],
  identity = TEST_IDENTITY,
): FinalFamilyPilotAttestationRecord {
  return Object.freeze({
    studentRef: identity.studentRef,
    assignmentRef: identity.assignmentRef,
    lessonRef: identity.lessonRef,
    sessionRef: identity.sessionRef,
    authority: 'GUARDIAN_ATTESTATION_REQUIRED',
    status,
    learnerAssertedAt: TEST_NOW,
    attestedAt: status === 'CERTIFIED' ? '2026-08-13T16:05:00.000Z' : null,
    attestedByRef: status === 'CERTIFIED' ? 'adult:one' : null,
    evidenceMode: status === 'CERTIFIED' ? 'adult-observed' : null,
  })
}

export function testHold(
  status: SafetyHoldV1['status'] = 'open',
  identity = TEST_IDENTITY,
): SafetyHoldV1 {
  return Object.freeze({
    schemaVersion: 1,
    holdRef: 'hold:one',
    studentRef: identity.studentRef,
    sessionRef: identity.sessionRef,
    createdAt: TEST_NOW,
    status,
    reasonCode: 'parent-review-requested',
    source: 'parent',
    dedupeKey: `${identity.studentRef}\u001f${identity.sessionRef}\u001fparent-review-requested`,
    ...(status === 'cleared' ? { clearedAt: TEST_NOW, clearedBy: 'adult:one' } : {}),
  })
}

interface ReplicaOptions {
  readonly identity?: StudyDocumentIdentity
  readonly completedCount?: number
  readonly timestamp?: string
  readonly deviceId?: string
  readonly serverRevision?: number
  readonly baseServerRevision?: number
  readonly localRevision?: number
  readonly blockRevision?: number
  readonly checkpointRevision?: number | null
  readonly checkpointRef?: string
  readonly responseDraftRef?: string | null
  readonly assignmentState?: FamilyPilotAssignmentRecordV1['state']
  readonly sessionStatus?: ReconciliableStudyState['session']['status']
  readonly dynamicSourceRequired?: boolean
  readonly subject?: 'mathematics' | 'social-studies'
  readonly completionRequirement?: ReconciliableStudyState['readiness']['completionRequirement']
  readonly sourceAttachment?: FinalFamilyPilotSourceAttachment | null
  readonly attestation?: FinalFamilyPilotAttestationRecord | null
  readonly safetyHolds?: readonly SafetyHoldV1[]
  readonly preferences?: StudyLearnerPreferences | null
  readonly parentSettings?: StudyParentSettings | null
  readonly authority?: StudyFieldAuthority
  readonly pendingOperations?: readonly StudySyncOperationMetadata[]
  readonly appliedOperationIds?: readonly string[]
}

function testBlock(
  identity: StudyDocumentIdentity,
  completedCount: number,
  timestamp: string,
  revision: number,
  subject: 'math' | 'other',
): CalendarBlock {
  let block = createCalendarBlock({
    internalBlockId: identity.blockRef,
    learnerRef: identity.learnerRef,
    sourceIdentity: { source: 'manuel_academy', externalItemId: identity.assignmentRef },
    title: 'Synthetic lesson',
    subject,
    blockType: 'independent_practice',
    householdTimeZone: 'America/Detroit',
    scheduledLocalStart: '2026-08-13T12:00',
    scheduledStart: '2026-08-13T12:00:00-04:00',
    intendedLocalDate: '2026-08-13',
    timerVisibility: 'shown',
    segments: SEGMENTS.map((segmentId, index) => ({
      segmentId,
      title: `Segment ${index + 1}`,
      canonicalTaskType: 'independent-practice',
      estimatedMinutes: 5,
      required: true,
    })),
    createdAt: timestamp,
  })
  block = startCalendarBlock(block, timestamp, 'student')
  for (const segmentId of SEGMENTS.slice(0, completedCount)) {
    block = completeCurrentSegment(block, { segmentId, at: timestamp, actor: 'student' })
  }
  return revision === block.revision ? block : Object.freeze({ ...block, revision })
}

export function makeReplica(options: ReplicaOptions = {}): StudySyncReplica {
  const identity = options.identity ?? TEST_IDENTITY
  const completedCount = options.completedCount ?? 0
  const timestamp = options.timestamp ?? TEST_NOW
  const completionRequirement = options.completionRequirement ?? 'STANDARD'
  const dynamicSourceRequired = options.dynamicSourceRequired === true
  const assignmentSubject = options.subject ?? (dynamicSourceRequired ? 'social-studies' : 'mathematics')
  const studySubject = assignmentSubject === 'social-studies' ? 'other' : 'math'
  const attestation = options.attestation ?? null
  const runtimeCompleted = completedCount === SEGMENTS.length
  const certified = attestation?.status === 'CERTIFIED'
  const assignmentState = options.assignmentState ??
    (runtimeCompleted && (completionRequirement === 'STANDARD' || certified) ? 'completed' : 'active')
  const sessionStatus = options.sessionStatus ??
    (runtimeCompleted && (completionRequirement === 'STANDARD' || certified) ? 'completed' : 'active')
  const blockRevision = options.blockRevision ?? completedCount + 1
  const checkpointRevision = options.checkpointRevision === undefined ? null : options.checkpointRevision
  const currentSegment = SEGMENTS[Math.min(completedCount, SEGMENTS.length - 1)]
  const authority = options.authority ?? initialAuthority()
  const assignment: FamilyPilotAssignmentRecordV1 = Object.freeze({
    assignmentRef: identity.assignmentRef,
    lessonRef: identity.lessonRef,
    subject: assignmentSubject,
    title: 'Synthetic lesson',
    state: assignmentState,
    sessionRef: assignmentState === 'completed' || assignmentState === 'abandoned' ? null : identity.sessionRef,
    progress: Object.freeze({
      completedSegmentRefs: Object.freeze(SEGMENTS.slice(0, completedCount)),
      totalSegments: SEGMENTS.length,
      lastSegmentRef: completedCount > 0 ? SEGMENTS[completedCount - 1] : null,
      activeSeconds: completedCount * 30,
    }),
    pause: Object.freeze({
      pausedAt: null,
      resumedAt: null,
      pausedSeconds: 0,
      resumeSegmentRef: null,
    }),
    completedAt: assignmentState === 'completed' ? timestamp : null,
    createdAt: TEST_NOW,
    updatedAt: timestamp,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
  const state: ReconciliableStudyState = Object.freeze({
    assignment,
    readiness: Object.freeze({
      assignmentRef: identity.assignmentRef,
      lessonRef: identity.lessonRef,
      requiredProductionMaterialRefs: Object.freeze(['material:one']),
      dynamicSourceRequirement: dynamicSourceRequired ? 'SOCIAL_STUDIES_SOURCE_ATTACHMENT' : 'NONE',
      completionRequirement,
    }),
    savedSession: Object.freeze({
      studentRef: identity.studentRef,
      assignmentRef: identity.assignmentRef,
      session: Object.freeze({
        householdRef: identity.householdRef,
        learnerRef: identity.learnerRef,
        blockRef: identity.blockRef,
        sessionRef: identity.sessionRef,
      }),
    }),
    calendar: Object.freeze({
      block: testBlock(identity, completedCount, timestamp, blockRevision, studySubject),
      plan: Object.freeze({
        lessonRef: identity.lessonRef,
        title: 'Synthetic lesson',
        subject: studySubject,
        skillRefs: Object.freeze(['skill:one']),
        segments: Object.freeze(SEGMENTS.map((segmentRef, index) => Object.freeze({
          segmentRef,
          title: `Segment ${index + 1}`,
          taskType: 'independent-practice' as const,
          estimatedMinutes: 5,
          required: true,
        }))),
        masteryAuthority: 'completion-only',
        source: 'manuel-academy',
      }),
    }),
    session: Object.freeze({
      scope: Object.freeze({
        householdRef: identity.householdRef,
        learnerRef: identity.learnerRef,
        sessionRef: identity.sessionRef,
      }),
      lessonRef: identity.lessonRef,
      segmentRef: currentSegment,
      status: sessionStatus,
      updatedAt: timestamp,
      lastAcceptedEventRef: null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }),
    checkpoint: checkpointRevision === null ? null : Object.freeze({
      checkpointRef: options.checkpointRef ?? `checkpoint:${checkpointRevision}`,
      householdRef: identity.householdRef,
      learnerRef: identity.learnerRef,
      sessionRef: identity.sessionRef,
      lessonRef: identity.lessonRef,
      segmentRef: currentSegment,
      revision: checkpointRevision,
      capturedAt: timestamp,
      completedSegmentRefs: Object.freeze(SEGMENTS.slice(0, completedCount)),
      elapsedActiveSecondsInSegment: 0,
      responseDraftRef: options.responseDraftRef ?? null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }),
    events: Object.freeze([]),
    preferences: options.preferences ?? null,
    parentSettings: options.parentSettings ?? null,
    sourceAttachment: options.sourceAttachment ?? null,
    attestation,
    safetyHolds: options.safetyHolds ?? Object.freeze([]),
  })
  const metadata: StudySyncMetadata = Object.freeze({
    serverRevision: options.serverRevision ?? 0,
    baseServerRevision: options.baseServerRevision ?? options.serverRevision ?? 0,
    localRevision: options.localRevision ?? 0,
    deviceId: options.deviceId ?? 'device:a',
    pendingOperations: options.pendingOperations ?? Object.freeze([]),
    appliedOperationIds: options.appliedOperationIds ?? Object.freeze([]),
    authority,
  })
  return Object.freeze({ identity, state, metadata })
}

export function replaceReplica(
  replica: StudySyncReplica,
  input: {
    readonly identity?: StudyDocumentIdentity
    readonly state?: Partial<ReconciliableStudyState>
    readonly metadata?: Partial<StudySyncMetadata>
  },
): StudySyncReplica {
  return Object.freeze({
    identity: input.identity ?? replica.identity,
    state: Object.freeze({ ...replica.state, ...input.state }),
    metadata: Object.freeze({ ...replica.metadata, ...input.metadata }),
  })
}

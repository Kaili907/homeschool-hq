import { describe, expect, it } from 'vitest'
import type { FamilyPilotAssignmentRecordV1, FamilyPilotStateV1 } from '../../../family-pilot/core/schema'
import type { DurableCalendarRecordV1, DurableStudyDocumentV1 } from '../../../family-pilot/durable-ports/schema'
import type { FinalFamilyPilotAppStateV1 } from '../../../family-pilot/final-app/state'
import {
  exportLocalBundleToHostedSyncStateR2,
  importHostedSyncStateToLocalBundleR2,
  HOSTED_SYNC_STATE_OPERATION_KINDS,
  parseHostedSyncStateSnapshotR2,
  serializeHostedSyncStateSnapshotR2,
  type HostedSyncAuthorityRevisionsR2,
  type HostedSyncLocalBundleR2,
  type HostedSyncStateIdentityR2,
  type HostedSyncStateMetadataR2,
} from '.'

const NOW = '2026-08-13T16:00:00.000Z'
const IDENTITY: HostedSyncStateIdentityR2 = Object.freeze({
  householdRef: 'household:family-pilot',
  studentRef: 'student:ada',
  learnerRef: 'student:ada',
})
const SYNC: HostedSyncStateMetadataR2 = Object.freeze({
  serverRevision: 18,
  baseRevision: 18,
  operationId: '11111111-1111-4111-8111-111111111111',
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  operationKind: 'FULL_STATE_REPLACEMENT',
  deviceRef: 'device:family-laptop',
  localSequence: 19,
  createdAt: NOW,
})

type AssignmentFixture = {
  readonly assignmentRef: string
  readonly lessonRef: string
  readonly state: FamilyPilotAssignmentRecordV1['state']
  readonly completed: readonly string[]
  readonly current: string | null
  readonly checkpointRevision: number
  readonly completedAt: string | null
}

const FIXTURES: readonly AssignmentFixture[] = Object.freeze([
  { assignmentRef: 'assignment:math-progress', lessonRef: 'lesson:math-progress', state: 'active', completed: ['lesson:math-progress:segment:1'], current: 'lesson:math-progress:segment:2', checkpointRevision: 4, completedAt: null },
  { assignmentRef: 'assignment:math-complete', lessonRef: 'lesson:math-complete', state: 'completed', completed: ['lesson:math-complete:segment:1', 'lesson:math-complete:segment:2'], current: null, checkpointRevision: 2, completedAt: NOW },
  { assignmentRef: 'assignment:rfl-pending', lessonRef: 'lesson:rfl-pending', state: 'active', completed: ['lesson:rfl-pending:segment:1', 'lesson:rfl-pending:segment:2'], current: null, checkpointRevision: 1, completedAt: null },
  { assignmentRef: 'assignment:rfl-certified', lessonRef: 'lesson:rfl-certified', state: 'completed', completed: ['lesson:rfl-certified:segment:1', 'lesson:rfl-certified:segment:2'], current: null, checkpointRevision: 1, completedAt: NOW },
  { assignmentRef: 'assignment:social-source', lessonRef: 'lesson:social-source', state: 'active', completed: [], current: 'lesson:social-source:segment:1', checkpointRevision: 0, completedAt: null },
])

function assignment(fixture: AssignmentFixture): FamilyPilotAssignmentRecordV1 {
  return Object.freeze({
    assignmentRef: fixture.assignmentRef,
    lessonRef: fixture.lessonRef,
    subject: fixture.lessonRef.includes('rfl') ? 'ready-for-life' : fixture.lessonRef.includes('social') ? 'social-studies' : 'mathematics',
    title: fixture.lessonRef,
    state: fixture.state,
    sessionRef: fixture.state === 'completed' ? null : `session:${fixture.assignmentRef}`,
    progress: Object.freeze({
      completedSegmentRefs: Object.freeze([...fixture.completed]),
      totalSegments: 2,
      lastSegmentRef: fixture.current ?? fixture.completed.at(-1) ?? null,
      activeSeconds: fixture.completed.length * 90,
    }),
    pause: Object.freeze({ pausedAt: null, resumedAt: null, pausedSeconds: 0, resumeSegmentRef: fixture.current }),
    completedAt: fixture.completedAt,
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: NOW,
    rawAnswerIncluded: false,
    transcriptIncluded: false,
  })
}

function calendar(fixture: AssignmentFixture): DurableCalendarRecordV1 {
  const segmentRefs = [`${fixture.lessonRef}:segment:1`, `${fixture.lessonRef}:segment:2`]
  return Object.freeze({
    block: Object.freeze({
      schemaVersion: 'calendar-parent-runtime.v1',
      internalBlockId: `block:${fixture.assignmentRef}`,
      learnerRef: IDENTITY.learnerRef,
      sourceIdentity: Object.freeze({ source: 'manuel_academy', externalItemId: `host:${fixture.assignmentRef}` }),
      lineage: Object.freeze({
        rootInternalBlockId: `block:${fixture.assignmentRef}`,
        continuationKey: 'root',
        completedBeforeOccurrence: Object.freeze([]),
      }),
      title: fixture.lessonRef,
      blockType: 'new_instruction',
      canonicalTask: 'learn_new',
      householdTimeZone: 'America/Detroit',
      scheduledLocalStart: '2026-08-13T12:00',
      scheduledStartInstant: NOW,
      intendedLocalDate: '2026-08-13',
      placementSource: 'explicit-offset',
      estimatedDurationMinutes: 20,
      actualDurationSeconds: fixture.completed.length * 90,
      timerVisibility: 'shown',
      state: fixture.state === 'completed' || fixture.current === null ? 'completed' : 'active',
      segments: Object.freeze(segmentRefs.map((segmentId, index) => Object.freeze({
        segmentId,
        planOrdinal: index + 1,
        title: `Segment ${index + 1}`,
        canonicalTaskType: 'learn_new',
        estimatedMinutes: 10,
        required: true,
        actualActiveSeconds: fixture.completed.includes(segmentId) ? 90 : 0,
        elapsedActiveSecondsBeforeBlock: 0,
        ...(fixture.completed.includes(segmentId) ? { completedAt: NOW } : {}),
      }))),
      ...(fixture.current ? { resumePoint: Object.freeze({
        segmentId: fixture.current,
        segmentOrdinal: segmentRefs.indexOf(fixture.current) + 1,
        elapsedActiveSecondsInSegment: 37,
        completedSegmentIds: Object.freeze([...fixture.completed]),
        remainingSegmentIds: Object.freeze(segmentRefs.filter((item) => !fixture.completed.includes(item))),
        capturedAt: NOW,
      }) } : {}),
      interruptionHistory: Object.freeze([]),
      revision: fixture.checkpointRevision + 2,
      lastEventAt: NOW,
      events: Object.freeze([]),
    }) as unknown as DurableCalendarRecordV1['block'],
    plan: Object.freeze({
      lessonRef: fixture.lessonRef,
      title: fixture.lessonRef,
      subject: fixture.lessonRef.includes('math') ? 'math' : 'other',
      skillRefs: Object.freeze([`${fixture.lessonRef}:skill`]),
      segments: Object.freeze(segmentRefs.map((segmentRef, index) => Object.freeze({
        segmentRef,
        title: `Segment ${index + 1}`,
        taskType: 'retrieval-practice',
        estimatedMinutes: 10,
        required: true,
      }))),
      masteryAuthority: 'completion-only',
      source: 'manuel-academy',
    }),
  }) as unknown as DurableCalendarRecordV1
}

function localFixture(): HostedSyncLocalBundleR2 {
  const records = FIXTURES.map(assignment)
  const core: FamilyPilotStateV1 = Object.freeze({
    schemaVersion: 1,
    updatedAt: NOW,
    activeStudentRef: IDENTITY.studentRef,
    students: Object.freeze([Object.freeze({
      studentRef: IDENTITY.studentRef,
      displayName: 'Ada',
      createdAt: '2026-08-01T12:00:00.000Z',
      updatedAt: NOW,
      activeAssignmentRef: 'assignment:math-progress',
      assignments: Object.freeze(records),
    })]),
  })
  const indexedDb: DurableStudyDocumentV1 = Object.freeze({
    schemaVersion: 1,
    updatedAt: NOW,
    scope: Object.freeze({ householdRef: IDENTITY.householdRef, learnerRef: IDENTITY.learnerRef }),
    preferences: null,
    parentSettings: null,
    calendar: Object.freeze(FIXTURES.map(calendar)),
    sessions: Object.freeze(FIXTURES.map((fixture) => Object.freeze({
      scope: Object.freeze({ ...IDENTITY, sessionRef: `session:${fixture.assignmentRef}` }),
      lessonRef: fixture.lessonRef,
      segmentRef: fixture.current ?? fixture.completed.at(-1)!,
      status: fixture.state === 'completed' || fixture.current === null ? 'completed' : 'active',
      updatedAt: NOW,
      lastAcceptedEventRef: null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }))),
    checkpoints: Object.freeze(FIXTURES.filter((fixture) => fixture.checkpointRevision > 0).map((fixture) => Object.freeze({
      checkpointRef: `checkpoint:${fixture.assignmentRef}:${fixture.checkpointRevision}`,
      householdRef: IDENTITY.householdRef,
      learnerRef: IDENTITY.learnerRef,
      sessionRef: `session:${fixture.assignmentRef}`,
      lessonRef: fixture.lessonRef,
      segmentRef: fixture.current ?? fixture.completed.at(-1)!,
      revision: fixture.checkpointRevision,
      capturedAt: NOW,
      completedSegmentRefs: Object.freeze([...fixture.completed]),
      elapsedActiveSecondsInSegment: fixture.current ? 37 : 0,
      responseDraftRef: null,
      rawAnswerIncluded: false,
      transcriptIncluded: false,
    }))),
    reviews: Object.freeze([]),
    events: Object.freeze([]),
    outbox: Object.freeze([]),
  })
  const sessions = FIXTURES.map((fixture) => Object.freeze({
    studentRef: IDENTITY.studentRef,
    assignmentRef: fixture.assignmentRef,
    session: Object.freeze({
      householdRef: IDENTITY.householdRef,
      learnerRef: IDENTITY.learnerRef,
      blockRef: `block:${fixture.assignmentRef}`,
      sessionRef: `session:${fixture.assignmentRef}`,
    }),
  }))
  const app = Object.freeze({
    schemaVersion: 1,
    householdRef: IDENTITY.householdRef,
    updatedAt: NOW,
    setup: Object.freeze({
      completedAt: NOW,
      students: Object.freeze([Object.freeze({
        studentRef: IDENTITY.studentRef,
        displayName: 'Ada',
        nominalGrade: '5',
        workingGradeBySubject: Object.freeze({ mathematics: '5', 'ready-for-life': '5', 'social-studies': '5' }),
        enabledSubjects: Object.freeze(['mathematics', 'ready-for-life', 'social-studies']),
        pinRequired: true,
        createdAt: '2026-08-01T12:00:00.000Z',
        updatedAt: NOW,
      })]),
    }),
    activeStudentRef: IDENTITY.studentRef,
    sessions: Object.freeze(sessions),
    sourceAttachments: Object.freeze([Object.freeze({
      studentRef: IDENTITY.studentRef,
      assignmentRef: 'assignment:social-source',
      lessonRef: 'lesson:social-source',
      sourceRef: 'source:detroit-history',
      title: 'Detroit history archive',
      publisher: 'Detroit Historical Society',
      publishedAt: '2024-02-01T00:00:00.000Z',
      attachedAt: NOW,
      status: 'ATTACHED_SATISFIED',
    })]),
    assessmentAssignments: Object.freeze([
      Object.freeze({
        assignmentRef: 'assessment:pending', assessmentRef: 'assessment:math', studentRef: IDENTITY.studentRef,
        courseRef: 'course:math-5', subject: 'mathematics', grade: 5, title: 'Math assessment',
        authorityClass: 'AUTO_SCOREABLE', status: 'PENDING_ASSESSMENT', createdAt: NOW, updatedAt: NOW, completedAt: null,
      }),
      Object.freeze({
        assignmentRef: 'assessment:review', assessmentRef: 'assessment:writing', studentRef: IDENTITY.studentRef,
        courseRef: 'course:ela-5', subject: 'english-language-arts', grade: 5, title: 'Writing assessment',
        authorityClass: 'RUBRIC_REQUIRED', status: 'ADULT_REVIEW_REQUIRED', createdAt: NOW, updatedAt: NOW, completedAt: null,
      }),
    ]),
    attestations: Object.freeze([
      Object.freeze({
        studentRef: IDENTITY.studentRef, assignmentRef: 'assignment:rfl-pending', lessonRef: 'lesson:rfl-pending',
        sessionRef: 'session:assignment:rfl-pending', authority: 'GUARDIAN_ATTESTATION_REQUIRED',
        status: 'PENDING_GUARDIAN_ATTESTATION', learnerAssertedAt: NOW, attestedAt: null, attestedByRef: null, evidenceMode: null,
      }),
      Object.freeze({
        studentRef: IDENTITY.studentRef, assignmentRef: 'assignment:rfl-certified', lessonRef: 'lesson:rfl-certified',
        sessionRef: 'session:assignment:rfl-certified', authority: 'GUARDIAN_ATTESTATION_REQUIRED',
        status: 'CERTIFIED', learnerAssertedAt: '2026-08-13T15:00:00.000Z', attestedAt: NOW,
        attestedByRef: 'guardian:manuel', evidenceMode: 'adult-observed',
      }),
    ]),
    safety: Object.freeze({
      schemaVersion: 1,
      holds: Object.freeze([
        Object.freeze({
          schemaVersion: 1, holdRef: 'hold:open', studentRef: IDENTITY.studentRef,
          sessionRef: 'session:assignment:math-progress', createdAt: NOW, status: 'open',
          reasonCode: 'parent-review-requested', source: 'parent', dedupeKey: 'open-dedupe',
        }),
        Object.freeze({
          schemaVersion: 1, holdRef: 'hold:cleared', studentRef: IDENTITY.studentRef,
          sessionRef: 'session:assignment:math-complete', createdAt: '2026-08-13T14:00:00.000Z', status: 'cleared',
          reasonCode: 'study-safety-uncertain', source: 'study-safety', dedupeKey: 'cleared-dedupe',
          acknowledgedAt: '2026-08-13T14:30:00.000Z', clearedAt: NOW, clearedBy: 'guardian:manuel',
        }),
      ]),
    }),
    pinDigests: Object.freeze({ [IDENTITY.studentRef]: 'deadbeef' }),
  }) as unknown as FinalFamilyPilotAppStateV1
  return Object.freeze({ core, app, indexedDb })
}

const REVISIONS: HostedSyncAuthorityRevisionsR2 = Object.freeze({
  assignments: Object.freeze(Object.fromEntries(FIXTURES.map((item, index) => [item.assignmentRef, index + 1]))),
  assessments: Object.freeze({ 'assessment:pending': 3, 'assessment:review': 4 }),
  rfl: Object.freeze({ 'assignment:rfl-pending': 2, 'assignment:rfl-certified': 3 }),
  socialSources: Object.freeze({ 'source:detroit-history': 5 }),
  safetyHolds: Object.freeze({ 'hold:open': 1, 'hold:cleared': 3 }),
})

function emptyTarget(local: HostedSyncLocalBundleR2): HostedSyncLocalBundleR2 {
  return Object.freeze({
    core: Object.freeze({ schemaVersion: 1, updatedAt: NOW, activeStudentRef: null, students: Object.freeze([]) }),
    app: Object.freeze({
      ...local.app,
      setup: Object.freeze({ students: Object.freeze([]), completedAt: null }),
      activeStudentRef: null,
      sessions: Object.freeze([]), sourceAttachments: Object.freeze([]), assessmentAssignments: Object.freeze([]),
      attestations: Object.freeze([]), safety: Object.freeze({ schemaVersion: 1, holds: Object.freeze([]) }), pinDigests: Object.freeze({}),
    }),
    indexedDb: Object.freeze({ ...local.indexedDb, calendar: Object.freeze([]), sessions: Object.freeze([]), checkpoints: Object.freeze([]) }),
  })
}

describe('Hosted sync lossless state contract R2', () => {
  it('round-trips every required Family Pilot continuation state through an empty receiving device', () => {
    const local = localFixture()
    const exported = exportLocalBundleToHostedSyncStateR2({ identity: IDENTITY, sync: SYNC, local, authorityRevisions: REVISIONS })
    const imported = importHostedSyncStateToLocalBundleR2({ snapshot: exported, target: emptyTarget(local), expectedIdentity: IDENTITY })
    const reExported = exportLocalBundleToHostedSyncStateR2({ identity: IDENTITY, sync: SYNC, local: imported, authorityRevisions: REVISIONS })

    expect(reExported).toEqual(exported)
    expect(imported.indexedDb).toEqual(local.indexedDb)
    expect(exported.assignments.find((item) => item.record.assignmentRef === 'assignment:math-progress')).toMatchObject({
      record: { progress: { completedSegmentRefs: ['lesson:math-progress:segment:1'] } },
      sessionIdentity: { sessionRef: 'session:assignment:math-progress' },
    })
    expect(exported.assignments.find((item) => item.record.assignmentRef === 'assignment:math-complete')?.completion.kind).toBe('NORMAL_CERTIFIED')
    expect(exported.assessmentStates.map((item) => item.status)).toEqual(['PENDING_ASSESSMENT', 'ADULT_REVIEW_REQUIRED'])
    expect(exported.rflStates.map((item) => item.guardianState)).toEqual(['PENDING', 'CERTIFIED'])
    expect(exported.socialSources[0]).toMatchObject({ readiness: 'ATTACHED_SATISFIED', sourceRevision: 5 })
    expect(exported.safetyHolds.map((item) => item.status)).toEqual(['OPEN', 'CLEARED'])
    expect(imported.app.pinDigests).toEqual({})
  })

  it('supports a scored assessment outcome without learner response content', () => {
    const original = structuredClone(exportLocalBundleToHostedSyncStateR2({ identity: IDENTITY, sync: SYNC, local: localFixture(), authorityRevisions: REVISIONS }))
    const snapshot = {
      ...original,
      assessmentStates: [{
      ...original.assessmentStates[0]!,
      status: 'SCORING_COMPLETE',
      outcome: {
        assessmentRecordRef: 'assessment-record:math-1',
        decision: 'PARTIAL',
        assessedAt: NOW,
        assessorRef: 'assessor:trusted-math',
      },
    }, ...original.assessmentStates.slice(1)],
    }
    expect(parseHostedSyncStateSnapshotR2(snapshot, IDENTITY)).toMatchObject({ status: 'ready' })
    expect(JSON.stringify(snapshot)).not.toContain('learner response')
  })

  it('fails closed on version, identity, cross-student, revisions, and dangerous authority fields', () => {
    const snapshot = exportLocalBundleToHostedSyncStateR2({ identity: IDENTITY, sync: SYNC, local: localFixture(), authorityRevisions: REVISIONS })
    expect(parseHostedSyncStateSnapshotR2({ ...snapshot, contractVersion: 'hosted-study-sync-state.r3' }, IDENTITY))
      .toEqual({ status: 'refused', reason: 'UNKNOWN_VERSION' })
    expect(parseHostedSyncStateSnapshotR2(snapshot, { ...IDENTITY, studentRef: 'student:bea' }))
      .toEqual({ status: 'refused', reason: 'IDENTITY_MISMATCH' })
    expect(parseHostedSyncStateSnapshotR2({
      ...snapshot,
      assessmentStates: [{ ...snapshot.assessmentStates[0]!, studentRef: 'student:bea' }],
    }, IDENTITY)).toEqual({ status: 'refused', reason: 'CROSS_STUDENT_STATE' })
    expect(parseHostedSyncStateSnapshotR2({ ...snapshot, sync: { ...snapshot.sync, baseRevision: -1 } }, IDENTITY))
      .toEqual({ status: 'refused', reason: 'MALFORMED_REVISION' })
    expect(parseHostedSyncStateSnapshotR2({ ...snapshot, sync: { ...snapshot.sync, idempotencyKey: '22222222-2222-4222-8222-222222222222' } }, IDENTITY))
      .toEqual({ status: 'refused', reason: 'MALFORMED_STATE' })
    expect(parseHostedSyncStateSnapshotR2({
      ...snapshot,
      indexedDbDocument: {
        ...snapshot.indexedDbDocument,
        checkpoints: [{ ...snapshot.indexedDbDocument.checkpoints[0]!, revision: -1 }],
      },
    }, IDENTITY)).toEqual({ status: 'refused', reason: 'MALFORMED_REVISION' })
    expect(parseHostedSyncStateSnapshotR2({ ...snapshot, role: 'guardian' }, IDENTITY))
      .toEqual({ status: 'refused', reason: 'DANGEROUS_AUTHORITY_FIELD' })
    expect(parseHostedSyncStateSnapshotR2({
      ...snapshot,
      indexedDbDocument: {
        ...snapshot.indexedDbDocument,
        checkpoints: [{ ...snapshot.indexedDbDocument.checkpoints[0]!, adultAuthorized: true }],
      },
    }, IDENTITY)).toEqual({ status: 'refused', reason: 'DANGEROUS_AUTHORITY_FIELD' })
    expect(HOSTED_SYNC_STATE_OPERATION_KINDS).toEqual(expect.arrayContaining([
      'FIRST_LINK_IMPORT', 'UPSERT_ASSIGNMENT_SESSION', 'NORMAL_COMPLETION', 'CHECKPOINT',
    ]))
  })

  it('rejects privacy canaries and never serializes current local PIN-derived material', () => {
    const snapshot = exportLocalBundleToHostedSyncStateR2({ identity: IDENTITY, sync: SYNC, local: localFixture(), authorityRevisions: REVISIONS })
    const serialized = serializeHostedSyncStateSnapshotR2(snapshot)
    expect(serialized).not.toContain('deadbeef')
    for (const canary of [
      { pin: '1234' },
      { bearer: 'secret-token' },
      { rawTutorConversation: 'private conversation' },
      { rawAudio: 'audio-bytes' },
      { personalityInference: 'diagnosis' },
      { adultAnswerAuthority: 'restricted:key' },
      { answerKey: '42' },
      { scoringGuide: 'private rubric' },
      { rawLearnerResponse: 'my full response' },
    ]) {
      expect(parseHostedSyncStateSnapshotR2({ ...snapshot, ...canary }, IDENTITY))
        .toEqual({ status: 'refused', reason: 'PRIVACY_VIOLATION' })
    }
  })
})

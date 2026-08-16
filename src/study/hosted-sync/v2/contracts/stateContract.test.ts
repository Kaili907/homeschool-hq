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
  type HostedSyncStateSnapshotR2,
} from '.'
import {
  authorityCheckpointFromHydrateR1,
  AuthorityCheckpointPreNetworkGateR1,
  authorityCheckpointWritePayloadR1,
  createHostedSyncRpcAdapter,
  parseFamilyPlanCheckpointR1,
  parseFamilyResponseCheckpointR1,
  serializeAuthorityCheckpointPrivacyGateR1,
  withAuthorityCheckpointR1,
} from '../client'
import {
  HostedFamilyCloudLocalDataPortR1,
  type FamilyCloudLocalLearnerStateR1,
} from '../../../family-pilot/cloud-auth/hostedLocalDataPort'
import { createLocalDbRpcEmulator } from '../client/testing/localDbRpcEmulator'
import { HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF, hostedSyncDynamicSourceMetadataFixture } from '../testing/dynamicSourceFixture'

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
  { assignmentRef: 'assignment:social-source', lessonRef: HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF, state: 'active', completed: [], current: `${HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF}:segment:1`, checkpointRevision: 0, completedAt: null },
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
      canonicalTask: Object.freeze({ taskType: 'direct-instruction' }),
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
        canonicalTaskType: 'retrieval-practice',
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
      scope: Object.freeze({ householdRef: IDENTITY.householdRef, learnerRef: IDENTITY.learnerRef,
        sessionRef: `session:${fixture.assignmentRef}` }),
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
      lessonRef: HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF,
      sourceRef: 'source:detroit-history',
      title: 'Detroit history archive',
      publisher: 'Detroit Historical Society',
      publishedAt: '2024-02-01T00:00:00.000Z',
      metadata: hostedSyncDynamicSourceMetadataFixture(),
      adultAttestedAt: NOW,
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
    studentAccessVerifiers: Object.freeze({ [IDENTITY.studentRef]: 'deadbeef' }),
    parentAccessVerifier: null,
  }) as unknown as FinalFamilyPilotAppStateV1
  const plannerDocument = Object.freeze({
    schemaVersion: 1 as const,
    scope: Object.freeze({ householdRef: IDENTITY.householdRef, learnerRef: IDENTITY.learnerRef }),
    revision: 4,
    updatedAt: NOW,
    schoolPlan: Object.freeze({
      schemaVersion: 1 as const,
      householdTimeZone: 'America/Detroit',
      schoolYearStart: '2026-08-01',
      schoolYearEnd: '2027-06-30',
      schoolWeekdays: Object.freeze([1, 2, 3, 4, 5] as const),
      nonSchoolDates: Object.freeze(['2026-11-26']),
      addedSchoolDates: Object.freeze([]),
      allowWorkAhead: true,
      subjects: Object.freeze([Object.freeze({
        subject: 'mathematics' as const, order: 0, paused: false,
        schoolWeekdays: Object.freeze([1, 3, 5] as const),
        courseRef: 'course:math-5', lessonsPerDay: 1, startLocalTime: '09:00',
      })]),
      configuredAt: '2026-08-01T12:00:00.000Z',
      updatedAt: NOW,
    }),
    materializations: Object.freeze([Object.freeze({
      materializationRef: 'work-ahead:mathematics:math-progress',
      kind: 'LESSON' as const,
      localDate: '2026-08-13',
      subject: 'mathematics' as const,
      workingGrade: '5' as const,
      courseRef: 'course:math-5',
      unitRef: 'unit:math-progress',
      itemRef: 'lesson:math-progress',
      assignmentRef: 'assignment:math-progress',
      title: 'Math progress',
      createdAt: '2026-08-13T12:00:00.000Z',
      provenance: 'LEARNER_WORK_AHEAD' as const,
    })]),
  })
  const learnerResponses = Object.freeze([Object.freeze({
    schemaVersion: 1 as const,
    lessonRef: 'lesson:math-progress',
    studentRef: IDENTITY.studentRef,
    assignmentRef: 'assignment:math-progress',
    attemptRef: 'attempt:math-progress:1',
    sectionRef: 'section:math-progress:practice',
    itemRef: 'item:math-progress:2',
    segmentRef: 'lesson:math-progress:segment:2',
    responseType: 'NUMERIC' as const,
    evidenceMode: 'SUPPORTED' as const,
    response: Object.freeze({ kind: 'NUMERIC' as const, text: '17' }),
    status: 'PENDING_ASSESSMENT' as const,
    savedAt: NOW,
    assessment: null,
  })])
  return Object.freeze({ core, app, indexedDb, plannerDocument, learnerResponses })
}

const REVISIONS: HostedSyncAuthorityRevisionsR2 = Object.freeze({
  assignments: Object.freeze(Object.fromEntries(FIXTURES.map((item, index) => [item.assignmentRef, index + 1]))),
  assessments: Object.freeze({ 'assessment:pending': 3, 'assessment:review': 4 }),
  rfl: Object.freeze({ 'assignment:rfl-pending': 2, 'assignment:rfl-certified': 3 }),
  socialSources: Object.freeze({ 'source:detroit-history': 5 }),
  safetyHolds: Object.freeze({ 'hold:open': 1, 'hold:cleared': 3 }),
})

function cloudLearnerState(
  snapshot: HostedSyncStateSnapshotR2,
  linked: FamilyCloudLocalLearnerStateR1['linked'] = null,
): FamilyCloudLocalLearnerStateR1 {
  const input = snapshot.instructionalInputs[0]!
  const response = parseFamilyResponseCheckpointR1({
    contract: 'family-pilot.learner-response-checkpoint.r1', contractVersion: 1,
    identity: {
      ...snapshot.identity,
      assignmentRef: input.assignmentRef,
      sessionRef: `session:${input.assignmentRef}`,
    },
    attempt: { attemptRef: input.attemptRef, lessonRef: input.lessonRef },
    sync: { baseRevision: 0, revision: 0, operationId: snapshot.sync.operationId, savedAt: input.savedAt },
    responses: [{
      itemRef: input.itemRef, sectionRef: input.sectionRef, segmentRef: input.segmentRef,
      responseType: input.input.kind, evidenceMode: input.evidenceMode,
      response: input.input.kind === 'CHOICE'
        ? { kind: 'CHOICE', choiceRef: input.input.choiceRef }
        : { kind: input.input.kind, text: input.input.text },
      status: input.assessmentState, savedAt: input.savedAt,
      assessment: input.trustedReceipt,
    }],
  })
  const plan = parseFamilyPlanCheckpointR1({
    contract: 'family-pilot.family-plan-checkpoint.r1', contractVersion: 1,
    identity: snapshot.identity,
    sync: { baseRevision: 0, revision: 0, operationId: snapshot.sync.operationId, savedAt: snapshot.plannerDocument.updatedAt },
    planner: snapshot.plannerDocument,
  })
  if (!response || !plan) throw new Error('Cloud checkpoint fixture refused.')
  return Object.freeze({
    learnerRef: snapshot.identity.learnerRef,
    firstLinkBase: Object.freeze({
      localScope: {
        householdRef: snapshot.identity.householdRef,
        studentRef: snapshot.identity.studentRef,
        assignmentRef: input.assignmentRef,
        sessionRef: `session:${input.assignmentRef}`,
      },
      session: {
        lessonRef: input.lessonRef, subjectRef: 'mathematics', state: 'active',
        startedAt: NOW, completedAt: null, intendedLocalDate: NOW.slice(0, 10),
      },
      checkpoint: null, socialSource: null, guardianAttestation: null,
      safetyState: { schemaVersion: 1 as const, holds: [] }, assessment: null,
    }),
    authorityCheckpoint: snapshot,
    learnerResponseCheckpoint: response,
    familyPlanCheckpoint: plan,
    courseEnrollments: Object.freeze([]),
    linked,
  })
}

function emptyTarget(local: HostedSyncLocalBundleR2): HostedSyncLocalBundleR2 {
  return Object.freeze({
    core: Object.freeze({ schemaVersion: 1, updatedAt: NOW, activeStudentRef: null, students: Object.freeze([]) }),
    app: Object.freeze({
      ...local.app,
      setup: Object.freeze({ students: Object.freeze([]), completedAt: null }),
      activeStudentRef: null,
      sessions: Object.freeze([]), sourceAttachments: Object.freeze([]), assessmentAssignments: Object.freeze([]),
      attestations: Object.freeze([]), safety: Object.freeze({ schemaVersion: 1, holds: Object.freeze([]) }),
      studentAccessVerifiers: Object.freeze({}), parentAccessVerifier: null,
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
    expect(imported.plannerDocument).toEqual(local.plannerDocument)
    expect(imported.learnerResponses).toEqual(local.learnerResponses)
    expect(exported.instructionalInputs[0]).toMatchObject({
      assignmentRef: 'assignment:math-progress',
      segmentRef: 'lesson:math-progress:segment:2',
      input: { kind: 'NUMERIC', text: '17' },
    })
    expect(imported.app.studentAccessVerifiers).toEqual({})
  })

  it('hydrates one learner without deleting a sibling already present on the receiving device', () => {
    const local = localFixture()
    const snapshot = exportLocalBundleToHostedSyncStateR2({ identity: IDENTITY, sync: SYNC, local, authorityRevisions: REVISIONS })
    const target = emptyTarget(local)
    const sibling = Object.freeze({
      studentRef: 'student:bea', displayName: 'Bea', createdAt: NOW, updatedAt: NOW,
      activeAssignmentRef: null, assignments: Object.freeze([]),
    })
    const siblingProfile = Object.freeze({
      studentRef: 'student:bea', displayName: 'Bea', nominalGrade: '3' as const,
      workingGradeBySubject: Object.freeze({ mathematics: '3' as const }),
      enabledSubjects: Object.freeze(['mathematics' as const]), pinRequired: false,
      createdAt: NOW, updatedAt: NOW,
    })
    const withSibling: HostedSyncLocalBundleR2 = Object.freeze({
      ...target,
      core: Object.freeze({ ...target.core, students: Object.freeze([sibling]) }),
      app: Object.freeze({ ...target.app, setup: Object.freeze({ completedAt: NOW, students: Object.freeze([siblingProfile]) }) }),
    })
    const hydrated = importHostedSyncStateToLocalBundleR2({ snapshot, target: withSibling, expectedIdentity: IDENTITY })
    expect(hydrated.core.students.map((item) => item.studentRef).sort()).toEqual(['student:ada', 'student:bea'])
    expect(hydrated.app.setup.students.map((item) => item.studentRef).sort()).toEqual(['student:ada', 'student:bea'])
  })

  it('round-trips A→RPC checkpoint→empty B and B progress→RPC checkpoint→A without invention', async () => {
    const localA = localFixture()
    const snapshotA = exportLocalBundleToHostedSyncStateR2({
      identity: IDENTITY, sync: SYNC, local: localA, authorityRevisions: REVISIONS,
    })
    const provider = createLocalDbRpcEmulator({ now: () => new Date(NOW) })
    provider.setRole('a'.repeat(64), 'guardian')
    const authorization = { acquire: async () => ({ status: 'AUTHORIZED' as const, lease: {
      clientKind: 'AUTHENTICATED_USER' as const, expiresAt: '2027-08-13T00:00:00.000Z', provider,
    } }) }
    const deviceA = createHostedSyncRpcAdapter({ authorization, now: () => new Date(NOW) })
    let deviceBOnline = true
    const deviceB = createHostedSyncRpcAdapter({ authorization, now: () => new Date(NOW), isOnline: () => deviceBOnline })
    const firstAssignment = snapshotA.assignments[0]!
    const sessionIdentity = firstAssignment.sessionIdentity!
    const legacyImport = {
      localScope: { householdRef: IDENTITY.householdRef, studentRef: IDENTITY.studentRef,
        assignmentRef: firstAssignment.record.assignmentRef, sessionRef: sessionIdentity.sessionRef },
      hostedScope: { assignmentRef: 'hosted:assignment:math', sessionRef: 'hosted:session:math' },
      session: { lessonRef: firstAssignment.record.lessonRef, subjectRef: 'mathematics', state: 'active',
        startedAt: NOW, completedAt: null, intendedLocalDate: '2026-08-13' },
      checkpoint: null, socialSource: null, guardianAttestation: null,
      safetyState: { schemaVersion: 1 as const, holds: [] }, assessment: null,
    }
    const first = await deviceA.firstLink({ tokenDigest: 'a'.repeat(64),
      studentId: '00000000-0000-4000-8000-000000000101', clientOperationId: SYNC.operationId,
      import: withAuthorityCheckpointR1(legacyImport, snapshotA) })
    expect(first).toMatchObject({ code: 'SUCCESS', value: { revisions: { authorityCheckpoint: 18 } } })
    const hydratedB = await deviceB.hydrate({ tokenDigest: 'a'.repeat(64),
      studentId: '00000000-0000-4000-8000-000000000101',
      assignmentRef: 'hosted:assignment:math', sessionId: 'hosted:session:math' })
    if (hydratedB.code !== 'SUCCESS') throw new Error('Device B hydrate failed.')
    const receivedA = authorityCheckpointFromHydrateR1(hydratedB.value, IDENTITY)
    expect(receivedA).toEqual(snapshotA)
    const localB = importHostedSyncStateToLocalBundleR2({ snapshot: receivedA,
      target: emptyTarget(localA), expectedIdentity: IDENTITY })
    expect(exportLocalBundleToHostedSyncStateR2({ identity: IDENTITY, sync: SYNC,
      local: localB, authorityRevisions: REVISIONS })).toEqual(snapshotA)

    const writeId = '22222222-2222-4222-8222-222222222222'
    const advanced = structuredClone(snapshotA) as any
    advanced.sync = { ...advanced.sync, serverRevision: 19, baseRevision: 18,
      operationId: writeId, idempotencyKey: writeId, operationKind: 'CHECKPOINT',
      localSequence: 20, createdAt: '2026-08-13T16:01:00.000Z' }
    const record = { ...advanced.student.assignments[0],
      progress: { ...advanced.student.assignments[0].progress,
        activeSeconds: advanced.student.assignments[0].progress.activeSeconds + 14 },
      updatedAt: '2026-08-13T16:01:00.000Z' }
    advanced.student = { ...advanced.student, updatedAt: '2026-08-13T16:01:00.000Z',
      assignments: [record, ...advanced.student.assignments.slice(1)] }
    advanced.assignments = [{ ...advanced.assignments[0], record }, ...advanced.assignments.slice(1)]
    advanced.appUpdatedAt = '2026-08-13T16:01:00.000Z'
    const checkpoint = advanced.indexedDbDocument.checkpoints[0]
    advanced.indexedDbDocument = { ...advanced.indexedDbDocument,
      updatedAt: '2026-08-13T16:01:00.000Z', checkpoints: [{ ...checkpoint,
        revision: checkpoint.revision + 1,
        elapsedActiveSecondsInSegment: checkpoint.elapsedActiveSecondsInSegment + 14,
        capturedAt: '2026-08-13T16:01:00.000Z' }, ...advanced.indexedDbDocument.checkpoints.slice(1)] }
    advanced.instructionalInputs = [{ ...advanced.instructionalInputs[0],
      input: { ...advanced.instructionalInputs[0].input, text: '19' },
      savedAt: '2026-08-13T16:01:00.000Z' }]
    const parsedAdvanced = parseHostedSyncStateSnapshotR2(advanced, IDENTITY)
    expect(parsedAdvanced.status).toBe('ready')
    if (parsedAdvanced.status !== 'ready') throw new Error(parsedAdvanced.reason)
    const writeInput = { tokenDigest: 'a'.repeat(64),
      studentId: '00000000-0000-4000-8000-000000000101',
      assignmentRef: 'hosted:assignment:math', sessionId: 'hosted:session:math', expectedRevision: 18,
      clientOperationId: writeId, operation: 'authority-checkpoint:compare-and-swap',
      payload: authorityCheckpointWritePayloadR1({ checkpoint: parsedAdvanced.snapshot,
        expectedRevision: 18, clientOperationId: writeId }) } as const
    deviceBOnline = false
    const offline = await deviceB.write(writeInput)
    expect(offline).toMatchObject({ code: 'OFFLINE' })
    expect(parsedAdvanced.snapshot.instructionalInputs[0]?.input).toMatchObject({ text: '19' })
    deviceBOnline = true
    const stored = await deviceB.write(writeInput)
    expect(stored).toMatchObject({ code: 'SUCCESS', value: { serverRevision: 19 } })

    const staleId = '33333333-3333-4333-8333-333333333333'
    const stale = structuredClone(snapshotA) as any
    stale.sync = { ...stale.sync, serverRevision: 19, baseRevision: 18,
      operationId: staleId, idempotencyKey: staleId, operationKind: 'CHECKPOINT', localSequence: 20,
      createdAt: '2026-08-13T16:02:00.000Z' }
    stale.instructionalInputs = [{ ...stale.instructionalInputs[0],
      input: { ...stale.instructionalInputs[0].input, text: '23' },
      savedAt: '2026-08-13T16:02:00.000Z' }]
    const parsedStale = parseHostedSyncStateSnapshotR2(stale, IDENTITY)
    if (parsedStale.status !== 'ready') throw new Error(parsedStale.reason)
    const conflict = await deviceA.write({ tokenDigest: 'a'.repeat(64),
      studentId: '00000000-0000-4000-8000-000000000101',
      assignmentRef: 'hosted:assignment:math', sessionId: 'hosted:session:math', expectedRevision: 18,
      clientOperationId: staleId, operation: 'authority-checkpoint:compare-and-swap',
      payload: authorityCheckpointWritePayloadR1({ checkpoint: parsedStale.snapshot,
        expectedRevision: 18, clientOperationId: staleId }) })
    expect(conflict).toMatchObject({ code: 'SUCCESS', value: {
      status: 'revision-conflict', serverRevision: 19,
    } })
    expect(parsedStale.snapshot.instructionalInputs[0]?.input).toMatchObject({ text: '23' })
    const hydratedA = await deviceA.hydrate({ tokenDigest: 'a'.repeat(64),
      studentId: '00000000-0000-4000-8000-000000000101',
      assignmentRef: 'hosted:assignment:math', sessionId: 'hosted:session:math' })
    if (hydratedA.code !== 'SUCCESS') throw new Error('Device A hydrate failed.')
    const reconciledA = authorityCheckpointFromHydrateR1(hydratedA.value, IDENTITY)
    expect(reconciledA).toEqual(parsedAdvanced.snapshot)
    expect(reconciledA.instructionalInputs[0]?.input).toMatchObject({ text: '19' })
  })

  it('uses the converged FamilyCloudLocalDataPort for first link, fresh hydrate, CAS, conflict, and offline retention', async () => {
    const initial = cloudLearnerState(exportLocalBundleToHostedSyncStateR2({
      identity: IDENTITY, sync: SYNC, local: localFixture(), authorityRevisions: REVISIONS,
    }))
    const provider = createLocalDbRpcEmulator({ now: () => new Date(NOW) })
    provider.setRole('a'.repeat(64), 'guardian')
    let onlineA = true
    const authorizationLease = { acquire: async () => ({ status: 'AUTHORIZED' as const, lease: {
      clientKind: 'AUTHENTICATED_USER' as const, expiresAt: '2027-08-13T00:00:00.000Z', provider,
    } }) }
    const clientA = createHostedSyncRpcAdapter({ authorization: authorizationLease, now: () => new Date(NOW), isOnline: () => onlineA })
    const clientB = createHostedSyncRpcAdapter({ authorization: authorizationLease, now: () => new Date(NOW) })
    const remoteLearner = Object.freeze({
      learnerRef: IDENTITY.learnerRef,
      hostedStudentId: '00000000-0000-4000-8000-000000000101',
      tokenDigest: 'a'.repeat(64),
      hostedScope: { assignmentRef: 'hosted:assignment:math', sessionRef: 'hosted:session:math' },
    })
    const directory = { resolve: async () => ({ status: 'READY' as const, learners: [remoteLearner] }) }
    const conflictsA: unknown[] = []
    const conflictsB: unknown[] = []
    function repository(initialLearners: readonly FamilyCloudLocalLearnerStateR1[], conflicts: unknown[]) {
      let held = structuredClone(initialLearners) as FamilyCloudLocalLearnerStateR1[]
      return {
        get held() { return held },
        replace(next: readonly FamilyCloudLocalLearnerStateR1[]) { held = structuredClone(next) as FamilyCloudLocalLearnerStateR1[] },
        hasHousehold: () => held.length > 0,
        readHousehold: async () => structuredClone(held),
        commitVerifiedHydration: async ({ learners, expectedLocal }: {
          learners: readonly FamilyCloudLocalLearnerStateR1[]
          expectedLocal: readonly FamilyCloudLocalLearnerStateR1[]
        }) => {
          if (JSON.stringify(held) !== JSON.stringify(expectedLocal)) return false
          held = structuredClone(learners) as FamilyCloudLocalLearnerStateR1[]
          return JSON.stringify(held) === JSON.stringify(learners)
        },
        retainConflict: async (conflict: unknown) => { conflicts.push(structuredClone(conflict)) },
      }
    }
    const repoA = repository([initial], conflictsA)
    const repoB = repository([], conflictsB)
    const operationIdsA = [
      '11111111-1111-4111-8111-111111111111',
      '22222222-2222-4222-8222-222222222222',
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555555',
    ]
    const operationIdsB = [
      '33333333-3333-4333-8333-333333333333',
    ]
    const portA = new HostedFamilyCloudLocalDataPortR1({
      directory, repository: repoA, client: clientA, deviceRef: 'device:a',
      now: () => new Date(NOW), newOperationId: () => operationIdsA.shift()!,
    })
    const portB = new HostedFamilyCloudLocalDataPortR1({
      directory, repository: repoB, client: clientB, deviceRef: 'device:b',
      now: () => new Date(NOW), newOperationId: () => operationIdsB.shift()!,
    })
    const authorization = {
      kind: 'supabase-access-token' as const, verifiedAt: Date.parse(NOW),
      user: { id: '00000000-0000-4000-8000-000000000201', email: 'parent@example.test' },
      accessToken: 'header.payload.signature',
    }
    const establish = { householdRef: IDENTITY.householdRef, authorization }

    await expect(portA.establish(establish)).resolves.toBe('READY')
    expect(repoA.held[0]?.linked).toMatchObject({
      authorityRevision: 18, learnerResponseRevision: 0, familyPlanRevision: 0,
    })

    const changedA = structuredClone(repoA.held[0]!)
    ;(changedA.learnerResponseCheckpoint.responses[0]!.response as { text: string }).text = '19'
    repoA.replace([changedA])
    const firstReconcile = await portA.reconcile(establish)
    expect({ firstReconcile, conflictDomains: conflictsA.map((item: any) => item.domain) })
      .toEqual({ firstReconcile: 'UP_TO_DATE', conflictDomains: [] })
    expect(repoA.held[0]?.learnerResponseCheckpoint).toMatchObject({
      sync: { revision: 1 }, responses: [{ response: { text: '19' } }],
    })

    await expect(portB.establish(establish)).resolves.toBe('READY')
    expect(repoB.held[0]?.learnerResponseCheckpoint).toMatchObject({
      sync: { revision: 1 }, responses: [{ response: { text: '19' } }],
    })

    const changedB = structuredClone(repoB.held[0]!)
    ;(changedB.learnerResponseCheckpoint.responses[0]!.response as { text: string }).text = '23'
    repoB.replace([changedB])
    await expect(portB.reconcile(establish)).resolves.toBe('UP_TO_DATE')

    const staleA = structuredClone(repoA.held[0]!)
    ;(staleA.learnerResponseCheckpoint.responses[0]!.response as { text: string }).text = '29'
    repoA.replace([staleA])
    await expect(portA.reconcile(establish)).resolves.toBe('CONFLICT')
    expect(conflictsA).toHaveLength(1)
    expect(repoA.held[0]?.learnerResponseCheckpoint.responses[0]?.response).toMatchObject({ text: '29' })

    onlineA = false
    await expect(portA.reconcile(establish)).resolves.toBe('OFFLINE')
    expect(repoA.held[0]?.learnerResponseCheckpoint.responses[0]?.response).toMatchObject({ text: '29' })
    expect(conflictsB).toHaveLength(0)
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

  it('passes only sealed, allowlisted authority bytes through the strict pre-network privacy semantics', async () => {
    const snapshot = exportLocalBundleToHostedSyncStateR2({ identity: IDENTITY, sync: SYNC,
      local: localFixture(), authorityRevisions: REVISIONS })
    const bodies: string[] = []
    const gate = new AuthorityCheckpointPreNetworkGateR1({ send: async (request) => {
      bodies.push(request.body)
      return request.schemaId
    } })
    const serialized = serializeAuthorityCheckpointPrivacyGateR1(snapshot)
    await expect(gate.send(serialized)).resolves.toBe('hosted-study-sync-authority-checkpoint.r1')
    expect(JSON.parse(bodies[0]!)).toEqual(snapshot)
    expect(bodies[0]).not.toContain('deadbeef')
    expect(() => gate.send({ schemaId: serialized.schemaId, byteLength: serialized.byteLength } as any))
      .toThrow('UNSERIALIZED_PAYLOAD')
    expect(() => serializeAuthorityCheckpointPrivacyGateR1({
      ...snapshot, indexedDbDocument: { ...snapshot.indexedDbDocument,
        checkpoints: [{ ...snapshot.indexedDbDocument.checkpoints[0]!, unknownAuthority: true }] },
    })).toThrow('UNALLOWLISTED_FIELD')
    expect(() => serializeAuthorityCheckpointPrivacyGateR1({ ...snapshot, pinDigest: 'forbidden' }))
      .toThrow('FORBIDDEN_FIELD')
  })
})

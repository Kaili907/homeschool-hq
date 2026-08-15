import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { assignmentFactsFromFamilyPilotCore } from '../../../family-pilot/auto-planner/existingArchitecture'
import { computeFamilyAutoPlanner, emptyFamilyAutoPlannerDocument } from '../../../family-pilot/auto-planner/plan'
import type { FamilyAutoPlannerDocumentV1, FamilyAutoPlannerSchoolPlanV1 } from '../../../family-pilot/auto-planner/types'
import { emptyDurableStudyDocument } from '../../../family-pilot/durable-ports/schema'
import { emptyFinalFamilyPilotAppState } from '../../../family-pilot/final-app/state'
import { finalAssignmentRef } from '../../../family-pilot/final-app/controller'
import type { HostedSyncLocalBundleR2, HostedSyncStateIdentityR2, HostedSyncStateMetadataR2 } from '../contracts'
import { parseHostedSyncStateSnapshotR2 } from '../contracts'
import {
  exportCurrentFamilyPilotHostedStateR1,
  hydrateCurrentFamilyPilotHostedStateR1,
  projectTrustedScoringReceiptForHostedSyncR1,
} from './convergence'
import type { LearnerResponseRecord } from '../../../family-pilot/final-app/learner-response'
import { FAMILY_HOSTED_SYNC_CONVERGENCE_R1 } from './policy'
import { ParentSyncStatusR1, currentParentSyncStatusR1, parentSyncStatusLabelR1 } from './status'

const NOW = '2026-08-14T13:00:00.000Z'
const IDENTITY: HostedSyncStateIdentityR2 = Object.freeze({
  householdRef: 'household:manuel',
  studentRef: 'student:ada',
  learnerRef: 'student:ada',
})
const SYNC: HostedSyncStateMetadataR2 = Object.freeze({
  serverRevision: 0,
  baseRevision: 0,
  operationId: '10000000-0000-4000-8000-000000000001',
  idempotencyKey: '10000000-0000-4000-8000-000000000001',
  operationKind: 'FIRST_LINK_IMPORT',
  deviceRef: 'device:a',
  localSequence: 1,
  createdAt: NOW,
})
const LESSON_REF = 'lesson:financial-literacy:12:budgeting'
const ASSIGNMENT_REF = finalAssignmentRef(IDENTITY.studentRef, LESSON_REF)
const ASSESSMENT_ASSIGNMENT_REF = 'assessment-assignment:financial-literacy:budgeting'
const ASSESSMENT_REF = 'assessment:financial-literacy:budgeting'

function localBundle(): HostedSyncLocalBundleR2 {
  const assignment = Object.freeze({
    assignmentRef: ASSIGNMENT_REF,
    lessonRef: LESSON_REF,
    subject: 'financial-literacy',
    title: 'Build a household budget',
    state: 'planned' as const,
    sessionRef: null,
    progress: Object.freeze({ completedSegmentRefs: Object.freeze([]), totalSegments: 3, lastSegmentRef: null, activeSeconds: 0 }),
    pause: Object.freeze({ pausedAt: null, resumedAt: null, pausedSeconds: 0, resumeSegmentRef: null }),
    completedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    rawAnswerIncluded: false as const,
    transcriptIncluded: false as const,
  })
  const app = emptyFinalFamilyPilotAppState(NOW, IDENTITY.householdRef)
  return Object.freeze({
    core: Object.freeze({
      schemaVersion: 1 as const,
      updatedAt: NOW,
      activeStudentRef: IDENTITY.studentRef,
      students: Object.freeze([Object.freeze({
        studentRef: IDENTITY.studentRef,
        displayName: 'Ada',
        createdAt: NOW,
        updatedAt: NOW,
        activeAssignmentRef: null,
        assignments: Object.freeze([assignment]),
      })]),
    }),
    app: Object.freeze({
      ...app,
      setup: Object.freeze({
        completedAt: NOW,
        students: Object.freeze([Object.freeze({
          studentRef: IDENTITY.studentRef,
          displayName: 'Ada',
          nominalGrade: '12' as const,
          workingGradeBySubject: Object.freeze({ 'financial-literacy': '12' as const }),
          enabledSubjects: Object.freeze(['financial-literacy' as const]),
          pinRequired: true,
          createdAt: NOW,
          updatedAt: NOW,
        })]),
      }),
      activeStudentRef: IDENTITY.studentRef,
      assessmentAssignments: Object.freeze([Object.freeze({
        assignmentRef: ASSESSMENT_ASSIGNMENT_REF,
        assessmentRef: ASSESSMENT_REF,
        studentRef: IDENTITY.studentRef,
        courseRef: 'course:financial-literacy:12',
        subject: 'financial-literacy' as const,
        grade: 12,
        title: 'Budgeting assessment',
        authorityClass: 'AUTO_SCOREABLE' as const,
        status: 'PENDING_ASSESSMENT' as const,
        createdAt: NOW,
        updatedAt: NOW,
        completedAt: null,
      })]),
      // Local access material is present to prove the converter omits it.
      studentAccessVerifiers: Object.freeze({ [IDENTITY.studentRef]: 'deadbeef' }),
      parentAccessVerifier: 'feedface',
    }),
    indexedDb: emptyDurableStudyDocument({
      householdRef: IDENTITY.householdRef,
      learnerRef: IDENTITY.learnerRef,
    }, NOW),
  })
}

function schoolPlan(): FamilyAutoPlannerSchoolPlanV1 {
  return Object.freeze({
    schemaVersion: 1,
    householdTimeZone: 'America/Detroit',
    schoolYearStart: '2026-08-01',
    schoolYearEnd: '2027-06-30',
    schoolWeekdays: Object.freeze([1, 2, 3, 4, 5] as const),
    nonSchoolDates: Object.freeze([]),
    addedSchoolDates: Object.freeze([]),
    subjects: Object.freeze([Object.freeze({
      subject: 'financial-literacy' as const,
      order: 0,
      paused: false,
      courseRef: 'course:financial-literacy:12',
      lessonsPerDay: 1,
      startLocalTime: '09:00',
    })]),
    configuredAt: NOW,
    updatedAt: NOW,
  })
}

function planner(withMaterialization: boolean): FamilyAutoPlannerDocumentV1 {
  const base = emptyFamilyAutoPlannerDocument({
    householdRef: IDENTITY.householdRef,
    learnerRef: IDENTITY.learnerRef,
  }, NOW)
  return Object.freeze({
    ...base,
    revision: 1,
    schoolPlan: schoolPlan(),
    materializations: withMaterialization ? Object.freeze([Object.freeze({
      materializationRef: 'auto:2026-08-14:financial-literacy:budgeting',
      kind: 'LESSON' as const,
      localDate: '2026-08-14',
      subject: 'financial-literacy' as const,
      workingGrade: '12' as const,
      courseRef: 'course:financial-literacy:12',
      unitRef: 'unit:budgeting',
      itemRef: LESSON_REF,
      assignmentRef: ASSIGNMENT_REF,
      title: 'Build a household budget',
      createdAt: NOW,
    })]) : Object.freeze([]),
  })
}

function emptyTarget(): HostedSyncLocalBundleR2 {
  return Object.freeze({
    core: Object.freeze({ schemaVersion: 1 as const, updatedAt: NOW, activeStudentRef: null, students: Object.freeze([]) }),
    app: emptyFinalFamilyPilotAppState(NOW, IDENTITY.householdRef),
    indexedDb: emptyDurableStudyDocument({ householdRef: IDENTITY.householdRef, learnerRef: IDENTITY.learnerRef }, NOW),
  })
}

describe('current Family Pilot + Hosted Sync R2 convergence', () => {
  it('keeps hosted sync mechanically off and local IndexedDB sufficient', () => {
    expect(FAMILY_HOSTED_SYNC_CONVERGENCE_R1).toEqual({
      enabled: false,
      localFirst: true,
      plannerPersistence: 'DEVICE_LOCAL_INDEXED_DB',
      hostedContract: 'hosted-study-sync-state.r2.v1',
    })
    expect(currentParentSyncStatusR1()).toBe('LOCAL_ONLY')
  })

  it('round-trips current Grade 12 working level and assignment authority through the strict R2 allowlist', () => {
    const local = localBundle()
    const localPlanner = planner(true)
    const exported = exportCurrentFamilyPilotHostedStateR1({ identity: IDENTITY, sync: SYNC, local, planner: localPlanner })
    expect(exported.attention).toEqual([])
    expect(exported.retainedLocalPlanner).toBe(localPlanner)
    expect(exported.snapshot.studentProfile.workingGradeBySubject).toEqual({ 'financial-literacy': '12' })
    expect(parseHostedSyncStateSnapshotR2(exported.snapshot, IDENTITY)).toMatchObject({ status: 'ready' })

    const serialized = JSON.stringify(exported.snapshot)
    expect(serialized).not.toMatch(/schoolPlan|materializations|deadbeef|feedface/i)
    expect(exported.snapshot.privacy).toEqual({
      pinIncluded: false,
      bearerIncluded: false,
      rawLearnerResponseIncluded: false,
      rawTutorConversationIncluded: false,
      rawAudioIncluded: false,
      inferenceIncluded: false,
      adultAnswerAuthorityIncluded: false,
      answerMaterialIncluded: false,
    })
    expect(serialized).not.toMatch(/pinDigest|secret-token|private conversation|full learner response|personality judgment|emotional label/i)

    const hydrated = hydrateCurrentFamilyPilotHostedStateR1({
      snapshot: exported.snapshot,
      target: emptyTarget(),
      planner: localPlanner,
      expectedIdentity: IDENTITY,
    })
    expect(hydrated.status).toBe('UP_TO_DATE')
    expect(hydrated.retainedLocalPlanner).toBe(localPlanner)
    expect(hydrated.local.core.students[0]?.assignments).toEqual(local.core.students[0]?.assignments)
    expect(hydrated.local.indexedDb).toEqual(local.indexedDb)
    expect(hydrated.local.app.studentAccessVerifiers).toEqual({})
    expect(hydrated.local.app.parentAccessVerifier).toBeNull()
  })

  it('round-trips an allowlisted trusted receipt without learner response or answer authority', () => {
    const assessedResponse: LearnerResponseRecord = Object.freeze({
      schemaVersion: 1,
      lessonRef: LESSON_REF,
      studentRef: IDENTITY.studentRef,
      assignmentRef: ASSESSMENT_ASSIGNMENT_REF,
      attemptRef: 'attempt:budgeting:1',
      sectionRef: 'section:budgeting:1',
      itemRef: 'item:budgeting:1',
      segmentRef: 'segment:budgeting:1',
      responseType: 'TEXT',
      evidenceMode: 'MASTERY',
      response: Object.freeze({ kind: 'TEXT', text: 'private learner response' }),
      status: 'ASSESSED',
      savedAt: NOW,
      assessment: Object.freeze({
        assessmentRef: 'pai:receipt:budgeting:1',
        decision: 'CORRECT',
        assessedAt: '2026-08-14T13:01:00.000Z',
        assessorRef: 'trusted:production-item:r1',
      }),
    })
    const receipt = projectTrustedScoringReceiptForHostedSyncR1(assessedResponse, ASSESSMENT_REF)
    const first = exportCurrentFamilyPilotHostedStateR1({
      identity: IDENTITY,
      sync: SYNC,
      local: localBundle(),
      planner: planner(true),
      scoringReceipts: [receipt],
    })
    expect(first.scoringReceipts).toEqual([receipt])
    expect(first.snapshot.assessmentStates[0]).toMatchObject({
      status: 'SCORING_COMPLETE',
      outcome: {
        assessmentRecordRef: receipt.assessmentRecordRef,
        decision: 'CORRECT',
        assessorRef: 'trusted:production-item:r1',
      },
    })
    expect(JSON.stringify(first.snapshot)).not.toMatch(/private learner response|answerKey|correctAnswer|workedSolution/i)

    const deviceB = hydrateCurrentFamilyPilotHostedStateR1({
      snapshot: first.snapshot,
      target: emptyTarget(),
      planner: planner(true),
      expectedIdentity: IDENTITY,
    })
    expect(deviceB.scoringReceipts).toEqual([receipt])
    const second = exportCurrentFamilyPilotHostedStateR1({
      identity: IDENTITY,
      sync: SYNC,
      local: deviceB.local,
      planner: deviceB.retainedLocalPlanner,
      scoringReceipts: deviceB.scoringReceipts,
    })
    expect(second.snapshot.assessmentStates[0]?.outcome).toEqual(first.snapshot.assessmentStates[0]?.outcome)
  })

  it('rejects a scorer-shaped object that attempts to add answer authority', () => {
    const unsafe = Object.freeze({
      studentRef: IDENTITY.studentRef,
      assignmentRef: ASSESSMENT_ASSIGNMENT_REF,
      assessmentRef: ASSESSMENT_REF,
      assessmentRecordRef: 'pai:receipt:budgeting:unsafe',
      decision: 'CORRECT' as const,
      assessedAt: '2026-08-14T13:01:00.000Z',
      assessorRef: 'trusted:production-item:r1',
      answerKey: 'forbidden',
    })
    expect(() => exportCurrentFamilyPilotHostedStateR1({
      identity: IDENTITY,
      sync: SYNC,
      local: localBundle(),
      planner: planner(true),
      scoringReceipts: [unsafe],
    })).toThrow('outside the Hosted Sync assessment allowlist')
  })

  it('does not duplicate a synchronized assignment when Device B has the same school plan but no local provenance row', () => {
    const exported = exportCurrentFamilyPilotHostedStateR1({
      identity: IDENTITY,
      sync: SYNC,
      local: localBundle(),
      planner: planner(true),
    })
    const deviceBPlanner = planner(false)
    const deviceB = hydrateCurrentFamilyPilotHostedStateR1({
      snapshot: exported.snapshot,
      target: emptyTarget(),
      planner: deviceBPlanner,
      expectedIdentity: IDENTITY,
    })
    const facts = assignmentFactsFromFamilyPilotCore(deviceB.local.core, IDENTITY.learnerRef)
    const computed = computeFamilyAutoPlanner({
      scope: deviceBPlanner.scope,
      instant: new Date(NOW),
      document: deviceBPlanner,
      learner: Object.freeze({
        learnerRef: IDENTITY.learnerRef,
        displayName: 'Ada',
        nominalGrade: '12',
        workingGradeBySubject: Object.freeze({ 'financial-literacy': '12' }),
        enabledSubjects: Object.freeze(['financial-literacy'] as const),
        assignedCourseRefs: Object.freeze(['course:financial-literacy:12']),
      }),
      assignments: facts,
      assessments: Object.freeze([]),
      holds: Object.freeze([]),
      catalog: Object.freeze([]),
    })

    expect(facts).toHaveLength(1)
    expect(computed.plan.items).toHaveLength(1)
    expect(computed.plan.items[0]).toMatchObject({ assignmentRef: ASSIGNMENT_REF, origin: 'MANUAL_OVERRIDE' })
    expect(computed.intents).toEqual([])
    expect(finalAssignmentRef(IDENTITY.studentRef, LESSON_REF)).toBe(ASSIGNMENT_REF)
  })

  it('preserves planner data and reports attention instead of deleting or duplicating around a mismatch', () => {
    const mismatched = Object.freeze({
      ...planner(true),
      materializations: Object.freeze([Object.freeze({
        ...planner(true).materializations[0]!,
        assignmentRef: 'assignment:legacy:other',
      })]),
    })
    const exported = exportCurrentFamilyPilotHostedStateR1({
      identity: IDENTITY,
      sync: SYNC,
      local: localBundle(),
      planner: mismatched,
    })
    expect(exported.attention).toContain('PLANNER_MATERIALIZATION_MISSING_ASSIGNMENT')
    expect(exported.retainedLocalPlanner).toBe(mismatched)
  })

  it('uses only the five Parent-facing status labels and defaults the Parent Hub to Local only', () => {
    expect([
      'LOCAL_ONLY', 'SYNC_READY', 'SYNCING', 'UP_TO_DATE', 'NEEDS_ATTENTION',
    ].map((status) => parentSyncStatusLabelR1(status as never))).toEqual([
      'Local only', 'Sync ready', 'Syncing', 'Up to date', 'Needs attention',
    ])
    const html = renderToStaticMarkup(<ParentSyncStatusR1 />)
    expect(html).toContain('Family data status')
    expect(html).toContain('Local only')
    expect(html).not.toMatch(/rpc|supabase|token|revision|network error/i)
  })
})

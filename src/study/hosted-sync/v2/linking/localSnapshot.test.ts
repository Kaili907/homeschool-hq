import { describe, expect, it } from 'vitest'
import type { FamilyPilotStateV1 } from '../../../family-pilot/core'
import type { DurableStudyDocumentV1 } from '../../../family-pilot/durable-ports'
import type { FinalFamilyPilotAppStateV1 } from '../../../family-pilot/final-app/state'
import { extractLocalFamilyPilotHousehold } from './localSnapshot'
import { HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF, hostedSyncDynamicSourceMetadataFixture } from '../testing/dynamicSourceFixture'

const UPDATED = '2026-08-02T00:00:00.000Z'

const core: FamilyPilotStateV1 = {
  schemaVersion: 1, updatedAt: UPDATED, activeStudentRef: 'student:local',
  students: [{
    studentRef: 'student:local', displayName: 'Ada', createdAt: UPDATED, updatedAt: UPDATED,
    activeAssignmentRef: 'assignment:local', assignments: [{
      assignmentRef: 'assignment:local', lessonRef: HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF, subject: 'Math', title: 'Math', state: 'active',
      sessionRef: 'block:local',
      progress: { completedSegmentRefs: ['segment:1'], totalSegments: 2, lastSegmentRef: 'segment:2', activeSeconds: 50 },
      pause: { pausedAt: null, resumedAt: null, pausedSeconds: 0, resumeSegmentRef: null },
      completedAt: null, createdAt: UPDATED, updatedAt: UPDATED,
      rawAnswerIncluded: false, transcriptIncluded: false,
    }],
  }],
}

const app: FinalFamilyPilotAppStateV1 = {
  schemaVersion: 1, householdRef: 'household:local', updatedAt: UPDATED,
  setup: {
    completedAt: UPDATED,
    students: [{
      studentRef: 'student:local', displayName: 'Ada', nominalGrade: '5',
      workingGradeBySubject: {}, enabledSubjects: ['mathematics'], pinRequired: true,
      createdAt: UPDATED, updatedAt: UPDATED,
    }],
  },
  activeStudentRef: 'student:local',
  sessions: [{
    studentRef: 'student:local', assignmentRef: 'assignment:local',
    session: {
      householdRef: 'household:local', learnerRef: 'student:local', blockRef: 'block:local', sessionRef: 'session:local',
    },
  }],
  sourceAttachments: [{
    studentRef: 'student:local', assignmentRef: 'assignment:local', lessonRef: HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF,
    sourceRef: 'source:local', title: 'Source', publisher: 'Publisher', publishedAt: UPDATED,
    metadata: hostedSyncDynamicSourceMetadataFixture(), adultAttestedAt: UPDATED,
    attachedAt: UPDATED, status: 'ATTACHED_SATISFIED',
  }],
  assessmentAssignments: [],
  attestations: [{
    studentRef: 'student:local', assignmentRef: 'assignment:local', lessonRef: HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF, sessionRef: 'session:local',
    authority: 'GUARDIAN_ATTESTATION_REQUIRED', status: 'CERTIFIED', learnerAssertedAt: UPDATED,
    attestedAt: UPDATED, attestedByRef: 'adult:local', evidenceMode: 'adult-observed',
  }],
  safety: {
    schemaVersion: 1, holds: [{
      schemaVersion: 1, holdRef: 'hold:local', studentRef: 'student:local', sessionRef: 'session:local',
      createdAt: UPDATED, status: 'cleared', reasonCode: 'parent-review-requested', source: 'parent',
      dedupeKey: 'private-dedupe-key', clearedAt: UPDATED, clearedBy: 'adult:local',
    }],
  },
  studentAccessVerifiers: { 'student:local': 'deadbeef' },
  parentAccessVerifier: null,
}

const document: DurableStudyDocumentV1 = {
  schemaVersion: 1, updatedAt: UPDATED,
  scope: { householdRef: 'household:local', learnerRef: 'student:local' },
  preferences: null, parentSettings: null, calendar: [],
  sessions: [{
    scope: { householdRef: 'household:local', learnerRef: 'student:local', sessionRef: 'session:local' },
    lessonRef: HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF, segmentRef: 'segment:2', status: 'active', updatedAt: UPDATED,
    lastAcceptedEventRef: 'event:local', rawAnswerIncluded: false, transcriptIncluded: false,
  }],
  checkpoints: [{
    checkpointRef: 'checkpoint:local', householdRef: 'household:local', learnerRef: 'student:local',
    sessionRef: 'session:local', lessonRef: HOSTED_SYNC_DYNAMIC_SOURCE_LESSON_REF, segmentRef: 'segment:2', revision: 3,
    capturedAt: UPDATED, completedSegmentRefs: ['segment:1'], elapsedActiveSecondsInSegment: 12,
    responseDraftRef: 'opaque:draft-ref', rawAnswerIncluded: false, transcriptIncluded: false,
  }],
  reviews: [], events: [], outbox: [],
}

describe('local Family Pilot first-link extraction', () => {
  it('preserves minimized progress, identity, source, attestation, safety, and checkpoint state', () => {
    const snapshot = extractLocalFamilyPilotHousehold({ core, app, studyDocuments: [document] })
    expect(snapshot.students[0]).toMatchObject({
      localStudentRef: 'student:local',
      identity: { kind: 'legacy-profile-id', value: 'student:local' },
      assignments: [{
        localAssignmentRef: 'assignment:local',
        progress: { completedSegmentRefs: ['segment:1'], lastSegmentRef: 'segment:2', activeSeconds: 50 },
      }],
      studyDocument: { sessions: [{ localSessionRef: 'session:local', checkpoint: { revision: 3 } }] },
      sources: [{ localSourceRef: 'source:local' }],
      attestations: [{ status: 'CERTIFIED' }],
      safetyHolds: [{ localHoldRef: 'hold:local', status: 'cleared' }],
    })
    const bytes = JSON.stringify(snapshot)
    expect(bytes).not.toContain('deadbeef')
    expect(bytes).not.toContain('studentAccessVerifiers')
    expect(bytes).not.toContain('adult:local')
    expect(bytes).not.toContain('private-dedupe-key')
    expect(bytes).not.toContain('opaque:draft-ref')
    expect(bytes).not.toContain('responseDraftRef')
  })

  it('refuses a cross-household Study document instead of moving it', () => {
    expect(() => extractLocalFamilyPilotHousehold({
      core, app,
      studyDocuments: [{ ...document, scope: { householdRef: 'household:other', learnerRef: 'student:local' } }],
    })).toThrow(/different local household/)
  })

  it('refuses mismatched app/core student sets instead of dropping a student', () => {
    expect(() => extractLocalFamilyPilotHousehold({
      core: { ...core, students: [] }, app, studyDocuments: [],
    })).toThrow(/student identities do not match exactly/)
  })
})

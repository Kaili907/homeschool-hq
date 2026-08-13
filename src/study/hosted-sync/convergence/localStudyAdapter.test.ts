import { describe, expect, it } from 'vitest'
import type { DurableStudyDocumentV1 } from '../../family-pilot/durable-ports'
import { makeReplica } from '../reconciliation/testFixtures'
import type { StudyDocumentIdentity } from '../reconciliation/types'
import { applyHostedHydrateToDurableStudyDocument } from './localStudyAdapter'
import type { HostedStudyRpcHydrateDocument } from './rpcTypes'

const identity: StudyDocumentIdentity = {
  householdRef: 'household:one',
  learnerRef: '11111111-2222-4333-8444-555555555555',
  studentRef: '11111111-2222-4333-8444-555555555555',
  assignmentRef: 'assignment:one', lessonRef: 'lesson:one', blockRef: 'block:one',
  sessionRef: 'session:one', lineageRootRef: 'block:one', lineageKey: 'root',
}

function local(completedCount = 0): DurableStudyDocumentV1 {
  const replica = makeReplica({ identity, completedCount, checkpointRevision: 0 })
  return {
    schemaVersion: 1, updatedAt: '2026-08-13T12:00:00.000Z',
    scope: { householdRef: identity.householdRef, learnerRef: identity.learnerRef },
    preferences: null, parentSettings: null,
    calendar: [replica.state.calendar], sessions: [replica.state.session],
    checkpoints: replica.state.checkpoint ? [replica.state.checkpoint] : [],
    reviews: [], events: [], outbox: [],
  }
}

function remote(completed: readonly string[], completionState: HostedStudyRpcHydrateDocument['completionState'] = 'active'): HostedStudyRpcHydrateDocument {
  return {
    studentRef: identity.studentRef, assignmentRef: identity.assignmentRef,
    lessonRef: identity.lessonRef, studySessionId: identity.sessionRef, completionState,
    revisions: { authority: 2, session: 2, checkpoint: completed.length },
    progress: {
      currentSegmentRef: completionState === 'completed' ? null : `segment:${completed.length === 0 ? 'one' : completed.length === 1 ? 'two' : 'three'}`,
      completedSegmentRefs: completed, safeInstructionalCursor: null,
      checkpointUpdatedAt: '2026-08-13T13:00:00.000Z',
    },
    safety: { state: 'clear', stoppedAt: null, clearedAt: null },
    guardianAttestation: { state: 'pending', attestedAt: null },
    dynamicSourceReadiness: { state: 'ready', curriculumReleaseVersion: 'release:one' },
    syncMetadata: { lastAuthorityClientOperationId: null, serverAcceptedAt: '2026-08-13T13:00:00.000Z' },
  }
}

const scope = {
  householdRef: identity.householdRef,
  studentRef: identity.studentRef,
  assignmentRef: identity.assignmentRef,
  sessionRef: identity.sessionRef,
}

describe('hosted hydrate into canonical local Study document', () => {
  it('writes exact monotonic progress into the existing Study schema', () => {
    const outcome = applyHostedHydrateToDurableStudyDocument({ scope, local: local(), remote: remote(['segment:one']) })
    expect(outcome.status).toBe('ready')
    if (outcome.status !== 'ready') throw new Error(outcome.reason)
    expect(outcome.document.checkpoints[0]?.completedSegmentRefs).toEqual(['segment:one'])
    expect(outcome.document.sessions[0]?.segmentRef).toBe('segment:two')
  })

  it('refuses incompatible progress, wrong student, and completion regression', () => {
    expect(applyHostedHydrateToDurableStudyDocument({
      scope, local: local(), remote: remote(['segment:two']),
    })).toMatchObject({ status: 'conflict', reason: 'REMOTE_PROGRESS_NOT_IN_PLAN' })
    expect(applyHostedHydrateToDurableStudyDocument({
      scope, local: local(), remote: { ...remote([]), studentRef: '22222222-2222-4222-8222-222222222222' },
    })).toMatchObject({ status: 'conflict', reason: 'IDENTITY_MISMATCH' })
    expect(applyHostedHydrateToDurableStudyDocument({
      scope, local: local(3), remote: remote(['segment:one'], 'active'),
    })).toMatchObject({ status: 'conflict', reason: 'COMPLETION_REGRESSION_REFUSED' })
  })
})

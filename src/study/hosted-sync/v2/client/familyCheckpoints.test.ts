import { describe, expect, it } from 'vitest'
import {
  buildWriteArgs,
  parseHydrateResult,
  parseWriteResult,
} from './contracts'
import {
  parseFamilyPlanCheckpointR1,
  parseFamilyResponseCheckpointR1,
  restampFamilyPlanCheckpointR1,
  restampFamilyResponseCheckpointR1,
} from './familyCheckpoints'
import type { HostedSyncMapping, HostedSyncWriteInput } from './types'

const NOW = '2026-08-15T14:00:00.000Z'
const OP = '10000000-0000-4000-8000-000000000001'
const NEXT_OP = '10000000-0000-4000-8000-000000000002'
const STUDENT_ID = '00000000-0000-4000-8000-000000000101'
const IDENTITY = Object.freeze({
  householdRef: 'household:alpha', studentRef: 'student:ada', learnerRef: 'student:ada',
})

function responseCheckpoint(revision = 0, baseRevision = revision, operationId = OP) {
  return {
    contract: 'family-pilot.learner-response-checkpoint.r1',
    contractVersion: 1,
    identity: { ...IDENTITY, assignmentRef: 'assignment:math', sessionRef: 'session:math' },
    attempt: { attemptRef: 'attempt:math', lessonRef: 'lesson:math' },
    sync: { baseRevision, revision, operationId, savedAt: NOW },
    responses: [{
      itemRef: 'item:reflection', sectionRef: 'section:practice', segmentRef: 'segment:2',
      responseType: 'TEXT', evidenceMode: 'INDEPENDENT',
      response: { kind: 'TEXT', text: 'I compared both quantities.' },
      status: 'PENDING_ASSESSMENT', savedAt: NOW, assessment: null,
    }],
  }
}

function planCheckpoint(revision = 0, baseRevision = revision, operationId = OP) {
  return {
    contract: 'family-pilot.family-plan-checkpoint.r1',
    contractVersion: 1,
    identity: IDENTITY,
    sync: { baseRevision, revision, operationId, savedAt: NOW },
    planner: {
      schemaVersion: 1,
      scope: { householdRef: IDENTITY.householdRef, learnerRef: IDENTITY.learnerRef },
      revision: 0, updatedAt: NOW, schoolPlan: null, materializations: [],
    },
  }
}

const mapping: HostedSyncMapping = Object.freeze({
  localHouseholdRef: IDENTITY.householdRef,
  localStudentRef: IDENTITY.studentRef,
  localAssignmentRef: 'assignment:math',
  localSessionRef: 'session:math',
  hostedHouseholdId: '00000000-0000-4000-8000-000000000011',
  hostedStudentId: STUDENT_ID,
  hostedAssignmentRef: 'hosted:assignment:math',
  hostedSessionRef: 'hosted:session:math',
})

describe('converged Family Cloud checkpoint client contracts', () => {
  it('parses only exact privacy-minimized response and Family Plan documents', () => {
    expect(parseFamilyResponseCheckpointR1(responseCheckpoint())).not.toBeNull()
    const publishedRefCheckpoint = structuredClone(responseCheckpoint())
    publishedRefCheckpoint.responses[0]!.itemRef = 'ma-g5-mathematics-u01-l01#ip-01'
    publishedRefCheckpoint.responses[0]!.sectionRef = 'ma-g5-mathematics-u01-l01#ip'
    expect(parseFamilyResponseCheckpointR1(publishedRefCheckpoint)).not.toBeNull()
    expect(parseFamilyPlanCheckpointR1(planCheckpoint())).not.toBeNull()
    expect(parseFamilyResponseCheckpointR1({ ...responseCheckpoint(), answerKey: '42' })).toBeNull()
    expect(parseFamilyPlanCheckpointR1({ ...planCheckpoint(), password: 'secret' })).toBeNull()
  })

  it('builds the two separate CAS operations through the existing write RPC', () => {
    const response = parseFamilyResponseCheckpointR1(responseCheckpoint())!
    const responseCandidate = restampFamilyResponseCheckpointR1(response, 0, NEXT_OP, NOW)
    const responseInput: HostedSyncWriteInput = {
      tokenDigest: 'a'.repeat(64), studentId: STUDENT_ID,
      assignmentRef: 'assignment:math', sessionId: 'session:math',
      expectedRevision: 0, clientOperationId: NEXT_OP,
      operation: 'learner-response-checkpoint:compare-and-swap',
      payload: { learnerResponseCheckpoint: responseCandidate },
    }
    expect(buildWriteArgs(responseInput)).toMatchObject({
      p_operation: 'learner-response-checkpoint:compare-and-swap',
      p_payload: { learnerResponseCheckpoint: { contract: 'family-pilot.learner-response-checkpoint.r1' } },
    })

    const plan = parseFamilyPlanCheckpointR1(planCheckpoint())!
    const planCandidate = restampFamilyPlanCheckpointR1(plan, 0, NEXT_OP, NOW)
    const planInput: HostedSyncWriteInput = {
      ...responseInput,
      operation: 'family-plan-checkpoint:compare-and-swap',
      payload: { familyPlanCheckpoint: planCandidate },
    }
    expect(buildWriteArgs(planInput)).toMatchObject({ p_operation: 'family-plan-checkpoint:compare-and-swap' })
    expect(buildWriteArgs({ ...responseInput, payload: {
      learnerResponseCheckpoint: { ...responseCandidate, tutorTranscript: 'forbidden' },
    } })).toBeNull()
  })

  it('parses hydrate and conflict envelopes with independent revisions', () => {
    const hydrated = parseHydrateResult({
      schemaVersion: 2, status: 'ready', mapping, document: {},
      learnerResponseCheckpoint: responseCheckpoint(), learnerResponseCheckpointRevision: 0,
      familyPlanCheckpoint: planCheckpoint(), familyPlanCheckpointRevision: 0,
      courseEnrollments: [],
    })
    expect(hydrated).toMatchObject({
      status: 'ready', learnerResponseCheckpointRevision: 0, familyPlanCheckpointRevision: 0,
    })
    const input: HostedSyncWriteInput = {
      tokenDigest: 'a'.repeat(64), studentId: STUDENT_ID,
      assignmentRef: 'assignment:math', sessionId: 'session:math', expectedRevision: 0,
      clientOperationId: NEXT_OP, operation: 'family-plan-checkpoint:compare-and-swap',
      payload: { familyPlanCheckpoint: restampFamilyPlanCheckpointR1(parseFamilyPlanCheckpointR1(planCheckpoint())!, 0, NEXT_OP, NOW) },
    }
    expect(parseWriteResult({
      schemaVersion: 2, status: 'revision-conflict', operation: input.operation,
      revisionDomain: 'family-plan-checkpoint', serverRevision: 1,
    }, input)).toMatchObject({ status: 'revision-conflict', serverRevision: 1 })
    expect(parseWriteResult({
      schemaVersion: 2, status: 'revision-conflict', operation: input.operation,
      revisionDomain: 'authority-checkpoint', serverRevision: 1,
    }, input)).toBeNull()
  })
})

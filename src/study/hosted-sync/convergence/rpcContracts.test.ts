import { describe, expect, it, vi } from 'vitest'
import type { StudyCheckpointRecord } from '../../contracts/persistence/types'
import { buildHostedStudyHydrateArgs, buildHostedStudyWriteArgs, parseHostedStudyHydrateResult } from './rpcContracts'
import { ACADEMY_STUDY_SYNC_HYDRATE_RPC, ACADEMY_STUDY_SYNC_WRITE_RPC, createHostedStudyRpcClient } from './rpcClient'

const scope = {
  householdRef: 'household:one',
  studentRef: '11111111-2222-4333-8444-555555555555',
  assignmentRef: 'assignment:one',
  sessionRef: 'session:one',
}

const checkpoint: StudyCheckpointRecord = {
  contract: 'study-core-bridge.recovery-checkpoint.v1', contractVersion: 1,
  checkpointId: 'checkpoint:one', revision: 1,
  createdAt: '2026-08-13T12:00:00.000Z', updatedAt: '2026-08-13T12:01:00.000Z',
  sessionId: scope.sessionRef, lessonId: 'lesson:one', segmentId: 'segment:one',
  safeInstructionalCursor: { tutorPhase: 'guided-practice', cycleNumber: 1, currentItemId: null, currentItemIndex: 0, teachingTurnIndex: 1 },
  completedSegmentIds: [], perSegmentActiveTime: [{ segmentId: 'segment:one', activeSeconds: 12 }],
  pausedSeconds: 0, breakSeconds: 0, protectedDraftRef: null,
  protectedTutorStateRef: 'tutor-state:one', lastAcceptedEventId: null,
  eventVersion: 1, tutorInteractionRef: 'interaction:one',
  technicalInterruption: { status: 'none', interruptionId: null, category: 'none', startedAt: null },
  rawAnswerIncluded: false, transcriptIncluded: false,
}

function hydrateBody() {
  return {
    schemaVersion: 1, status: 'ready', document: {
      studentRef: scope.studentRef, assignmentRef: scope.assignmentRef, lessonRef: 'lesson:one',
      studySessionId: scope.sessionRef, completionState: 'active',
      revisions: { authority: 1, session: 1, checkpoint: 0 },
      progress: { currentSegmentRef: 'segment:one', completedSegmentRefs: [], safeInstructionalCursor: null, checkpointUpdatedAt: null },
      safety: { state: 'clear', stoppedAt: null, clearedAt: null },
      guardianAttestation: { state: 'pending', attestedAt: null },
      dynamicSourceReadiness: { state: 'ready', curriculumReleaseVersion: 'release:one' },
      syncMetadata: { lastAuthorityClientOperationId: null, serverAcceptedAt: '2026-08-13T12:01:00.000Z' },
    },
  }
}

describe('hosted Study finalized DB RPC contract', () => {
  it('builds exact hydrate/write argument names and refuses private payload fields', () => {
    expect(buildHostedStudyHydrateArgs(scope)).toEqual({
      p_student_id: scope.studentRef,
      p_assignment_ref: scope.assignmentRef,
      p_session_id: scope.sessionRef,
    })
    const args = buildHostedStudyWriteArgs({
      scope, expectedRevision: 0,
      clientOperationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      operation: 'checkpoint:compare-and-swap', checkpoint,
    }, 'a'.repeat(64))
    expect(Object.keys(args ?? {})).toEqual([
      'p_token_digest', 'p_student_id', 'p_assignment_ref', 'p_session_id',
      'p_expected_revision', 'p_client_operation_id', 'p_operation', 'p_payload',
    ])
    expect(() => buildHostedStudyWriteArgs({
      scope, expectedRevision: 0,
      clientOperationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      operation: 'checkpoint:compare-and-swap', checkpoint: { ...checkpoint, pin: '2468' } as StudyCheckpointRecord,
    }, 'a'.repeat(64))).not.toThrow()
    expect(buildHostedStudyWriteArgs({
      scope, expectedRevision: 0,
      clientOperationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      operation: 'checkpoint:compare-and-swap', checkpoint: { ...checkpoint, pin: '2468' } as StudyCheckpointRecord,
    }, 'a'.repeat(64))).toBeNull()
  })

  it('binds hydrate responses to exact student/assignment/session identity', () => {
    expect(parseHostedStudyHydrateResult(hydrateBody(), scope)?.status).toBe('ready')
    expect(parseHostedStudyHydrateResult({
      ...hydrateBody(), document: { ...hydrateBody().document, studentRef: '22222222-2222-4222-8222-222222222222' },
    }, scope)).toBeNull()
  })

  it('calls only the two approved RPC names and never persists or places the grant in the body', async () => {
    const bodies: string[] = []
    const urls: string[] = []
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      urls.push(String(url)); bodies.push(String(init?.body))
      const body = String(url).endsWith(ACADEMY_STUDY_SYNC_HYDRATE_RPC)
        ? hydrateBody()
        : { schemaVersion: 1, status: 'stored', operation: 'safety:stop', serverRevision: 2, safetyState: 'stopped', guardianAttestationState: 'pending' }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    })
    const client = createHostedStudyRpcClient({
      rpcBaseUrl: 'https://example.supabase.co/rest/v1/rpc', publicClientKey: 'sb_publishable_example',
      authorization: { authorize: async () => ({ status: 'authorized', headers: { Authorization: 'Bearer adult-ephemeral', 'x-study-session': 'aca_stu_v1_ephemeral' }, studySessionReference: 'aca_stu_v1_ephemeral' }) },
      digestSessionReference: async () => 'b'.repeat(64), fetchImpl: fetchImpl as typeof fetch,
    })
    expect((await client.hydrate(scope)).code).toBe('SUCCESS')
    expect((await client.write({
      scope, expectedRevision: 1, clientOperationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', operation: 'safety:stop',
    })).code).toBe('SUCCESS')
    expect(urls).toEqual([
      `https://example.supabase.co/rest/v1/rpc/${ACADEMY_STUDY_SYNC_HYDRATE_RPC}`,
      `https://example.supabase.co/rest/v1/rpc/${ACADEMY_STUDY_SYNC_WRITE_RPC}`,
    ])
    expect(bodies.join('|')).not.toContain('aca_stu_v1_ephemeral')
    expect(bodies.join('|')).not.toContain('adult-ephemeral')
    expect(bodies[1]).toContain('"p_token_digest":"' + 'b'.repeat(64) + '"')
  })

  it('refuses service-role-shaped browser configuration at the client boundary', () => {
    expect(() => createHostedStudyRpcClient({
      rpcBaseUrl: '/rest/v1/rpc', publicClientKey: 'service_role_secret',
      authorization: { authorize: async () => ({ status: 'interrupted' }) },
    })).toThrow('browser-safe public client key')
  })
})

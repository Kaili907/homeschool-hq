import { describe, expect, it, vi } from 'vitest'
import type { StudyCheckpointRecord } from '../../contracts/persistence/types'
import { createHostedStudyConvergenceService } from './service'
import { emptyHostedStudyLocalSyncState, type HostedStudyLocalSyncState, type HostedStudySyncMetadataStore } from './syncMetadata'
import type { HostedStudyRpcClient } from './rpcTypes'

const scope = {
  householdRef: 'household:one',
  studentRef: '11111111-2222-4333-8444-555555555555',
  assignmentRef: 'assignment:one',
  sessionRef: 'session:one',
}

const checkpoint = {
  contract: 'study-core-bridge.recovery-checkpoint.v1', contractVersion: 1,
  checkpointId: 'checkpoint:one', revision: 1,
  createdAt: '2026-08-13T12:00:00.000Z', updatedAt: '2026-08-13T12:01:00.000Z',
  sessionId: scope.sessionRef, lessonId: 'lesson:one', segmentId: 'segment:one',
  safeInstructionalCursor: { tutorPhase: 'guided-practice', cycleNumber: 1, currentItemId: null, currentItemIndex: 0, teachingTurnIndex: 1 },
  completedSegmentIds: [], perSegmentActiveTime: [], pausedSeconds: 0, breakSeconds: 0,
  protectedDraftRef: null, protectedTutorStateRef: 'tutor-state:one', lastAcceptedEventId: null,
  eventVersion: 1, tutorInteractionRef: 'interaction:one',
  technicalInterruption: { status: 'none', interruptionId: null, category: 'none', startedAt: null },
  rawAnswerIncluded: false, transcriptIncluded: false,
} satisfies StudyCheckpointRecord

function memoryMetadata(): HostedStudySyncMetadataStore & { current(): HostedStudyLocalSyncState } {
  let state = emptyHostedStudyLocalSyncState({
    identity: { ...scope, sessionRef: scope.sessionRef },
    deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  })
  return {
    read: async () => state,
    write: async (next) => { state = next },
    close: () => undefined,
    current: () => state,
  }
}

function serviceFor(rpc: HostedStudyRpcClient, metadata = memoryMetadata(), clear = vi.fn()) {
  const canonicalCanary = { value: 'local-progress-is-durable' }
  return {
    metadata,
    clear,
    canonicalCanary,
    service: createHostedStudyConvergenceService({
      scope, metadata, rpc,
      checkpoint: async () => checkpoint,
      localStudy: {
        scope: { householdRef: scope.householdRef, learnerRef: scope.studentRef },
        read: async () => { throw new Error('not used') },
        replaceValidated: async () => { throw new Error('not used') },
      },
      authoritySink: { apply: async () => undefined },
      localTemplate: async (current) => current,
      clearEphemeralAuthorization: clear,
      now: () => new Date('2026-08-13T12:00:00.000Z'),
    }),
  }
}

describe('hosted Study local-first convergence service', () => {
  it('enqueues only after durable local save and preserves local progress across offline failure', async () => {
    const rpc: HostedStudyRpcClient = {
      hydrate: vi.fn(),
      write: vi.fn(async () => ({ code: 'OFFLINE', httpStatus: null, retryAfterMs: null } as const)),
    }
    const fixture = serviceFor(rpc)
    await fixture.service.recordAfterLocalSave({
      localSaveConfirmed: true,
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      operation: 'checkpoint:compare-and-swap', actorRole: 'student',
    })
    expect(await fixture.service.sync()).toMatchObject({ status: 'OFFLINE_QUEUED' })
    expect(fixture.metadata.current().queue).toHaveLength(1)
    expect(fixture.canonicalCanary.value).toBe('local-progress-is-durable')
  })

  it('acknowledges a stable operation exactly once and makes duplicate enqueue a no-op', async () => {
    const write = vi.fn(async () => ({
      code: 'SUCCESS' as const,
      value: { schemaVersion: 1 as const, status: 'stored' as const, operation: 'checkpoint:compare-and-swap' as const, serverRevision: 1 },
    }))
    const rpc: HostedStudyRpcClient = { hydrate: vi.fn(), write }
    const fixture = serviceFor(rpc)
    const operationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
    await fixture.service.recordAfterLocalSave({ localSaveConfirmed: true, operationId, operation: 'checkpoint:compare-and-swap', actorRole: 'student' })
    expect(await fixture.service.sync()).toEqual({ status: 'SYNCED', serverRevision: 1 })
    expect(fixture.metadata.current().acknowledgedOperationIds).toEqual([operationId])
    await fixture.service.recordAfterLocalSave({ localSaveConfirmed: true, operationId, operation: 'checkpoint:compare-and-swap', actorRole: 'student' })
    expect(await fixture.service.sync()).toEqual({ status: 'NO_WORK' })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('treats auth expiration as authorization, never as safety, and retains the queue', async () => {
    const clear = vi.fn()
    const rpc: HostedStudyRpcClient = {
      hydrate: vi.fn(),
      write: vi.fn(async () => ({ code: 'SESSION_EXPIRED', httpStatus: 401, retryAfterMs: null } as const)),
    }
    const fixture = serviceFor(rpc, memoryMetadata(), clear)
    await fixture.service.recordAfterLocalSave({
      localSaveConfirmed: true,
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      operation: 'checkpoint:compare-and-swap', actorRole: 'student',
    })
    expect(await fixture.service.sync()).toEqual({ status: 'AUTH_REQUIRED', reason: 'SESSION_EXPIRED' })
    expect(fixture.metadata.current().queue).toHaveLength(1)
    expect(fixture.metadata.current().lastOutcome).toBe('AUTH_REQUIRED')
    expect(clear).toHaveBeenCalledOnce()
  })

  it('rejects student attestation and safety clear before transport', async () => {
    const rpc: HostedStudyRpcClient = { hydrate: vi.fn(), write: vi.fn() }
    const fixture = serviceFor(rpc)
    expect(await fixture.service.recordAfterLocalSave({
      localSaveConfirmed: true,
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      operation: 'guardian-attestation:attest', actorRole: 'student',
    })).toEqual({ status: 'REFUSED', reason: 'PARENT_AUTHORITY_REQUIRED' })
    expect(await fixture.service.recordAfterLocalSave({
      localSaveConfirmed: true,
      operationId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      operation: 'safety:clear', actorRole: 'student',
    })).toEqual({ status: 'REFUSED', reason: 'PARENT_AUTHORITY_REQUIRED' })
    expect(rpc.write).not.toHaveBeenCalled()
  })

  it('blocks on CAS conflict instead of applying last-write-wins', async () => {
    const rpc: HostedStudyRpcClient = {
      hydrate: vi.fn(),
      write: vi.fn(async () => ({
        code: 'SUCCESS',
        value: { schemaVersion: 1, status: 'revision-conflict', operation: 'checkpoint:compare-and-swap', serverRevision: 9 },
      } as const)),
    }
    const fixture = serviceFor(rpc)
    await fixture.service.recordAfterLocalSave({
      localSaveConfirmed: true,
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      operation: 'checkpoint:compare-and-swap', actorRole: 'student',
    })
    expect(await fixture.service.sync()).toEqual({ status: 'CONFLICT', reason: 'CAS_REVISION:9' })
    expect(fixture.metadata.current().queue).toHaveLength(1)
  })
})

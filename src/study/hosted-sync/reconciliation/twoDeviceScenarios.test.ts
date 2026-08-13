import { describe, expect, it } from 'vitest'
import { evaluateOfflineStudyPolicy } from './offlinePolicy'
import { reconcileStudyState } from './reconciliation'
import { buildSyncResolution, finalizeSyncResolution } from './syncResolution'
import {
  authorityStamp,
  initialAuthority,
  makeReplica,
  testAttestation,
  testHold,
  testSource,
} from './testFixtures'
import type { StudyFieldAuthority, StudySyncOperationMetadata } from './types'

const AVAILABLE = Object.freeze({
  durableStorageAvailable: true,
  assignmentAvailable: true,
  productionMaterialAvailable: true,
  safetyStateAvailable: true,
})

function progressOperation(deviceId: string, operationId: string, localRevision: number): StudySyncOperationMetadata {
  return Object.freeze({ operationId, deviceId, localRevision, kind: 'PROGRESS', actor: 'STUDENT' })
}

describe('Study cross-device reconciliation scenarios', () => {
  it('A works, syncs, and B hydrates the exact acknowledged state', () => {
    const operation = progressOperation('device:a', 'operation:a:segment-one', 1)
    const a = makeReplica({
      deviceId: 'device:a',
      completedCount: 1,
      localRevision: 1,
      pendingOperations: [operation],
    })
    const server = makeReplica({ deviceId: 'device:server' })
    const upload = reconcileStudyState({ local: a, remote: server, baseRevision: 0 })
    expect(upload.result).toBe('ACCEPT_LOCAL')
    const request = buildSyncResolution(upload)
    expect(request.method).toBe('PUT_WITH_CAS')
    if (request.method !== 'PUT_WITH_CAS') return
    const acknowledged = finalizeSyncResolution({
      resolution: request,
      acknowledgedServerRevision: 1,
      deviceId: 'device:a',
    })
    expect(acknowledged.metadata).toMatchObject({ serverRevision: 1, baseServerRevision: 1 })
    expect(acknowledged.metadata.pendingOperations).toEqual([])
    expect(acknowledged.metadata.appliedOperationIds).toContain(operation.operationId)

    const b = makeReplica({ deviceId: 'device:b' })
    const hydration = reconcileStudyState({ local: b, remote: acknowledged, baseRevision: 1 })
    expect(hydration.result).toBe('ACCEPT_REMOTE')
    const hydrate = buildSyncResolution(hydration)
    expect(hydrate.method).toBe('HYDRATE_REMOTE')
    if (hydrate.method !== 'HYDRATE_REMOTE') return
    const bHydrated = finalizeSyncResolution({
      resolution: hydrate,
      acknowledgedServerRevision: 1,
      deviceId: 'device:b',
    })
    expect(bHydrated.state).toEqual(acknowledged.state)
    expect(bHydrated.metadata.deviceId).toBe('device:b')
  })

  it('converges deterministically when A and B both open the same lesson', () => {
    const a = makeReplica({ deviceId: 'device:a', timestamp: '2036-01-01T00:00:00.000Z' })
    const b = makeReplica({ deviceId: 'device:b', timestamp: '2016-01-01T00:00:00.000Z' })
    const forward = reconcileStudyState({ local: a, remote: b, baseRevision: 0 })
    const reverse = reconcileStudyState({ local: b, remote: a, baseRevision: 0 })
    expect(forward.result).not.toBe('MANUAL_OR_CONSERVATIVE_CONFLICT')
    expect(reverse.result).not.toBe('MANUAL_OR_CONSERVATIVE_CONFLICT')
    if (!('state' in forward) || !('state' in reverse)) return
    expect(forward.state).toEqual(reverse.state)
    expect(forward.state.session.updatedAt).toBe(a.state.session.updatedAt)
  })

  it('preserves A advancing a segment while B is stale', () => {
    const a = makeReplica({ deviceId: 'device:a', completedCount: 1, localRevision: 1 })
    const b = makeReplica({ deviceId: 'device:b', completedCount: 0 })
    const outcome = reconcileStudyState({ local: a, remote: b, baseRevision: 0 })
    expect(outcome.result).toBe('ACCEPT_LOCAL')
    if (!('state' in outcome)) return
    expect(outcome.state.assignment.progress.completedSegmentRefs).toEqual(['segment:one'])
  })

  it('preserves the compatible monotonic superset when both devices advance', () => {
    const a = makeReplica({ deviceId: 'device:a', completedCount: 1, localRevision: 1 })
    const b = makeReplica({ deviceId: 'device:b', completedCount: 2, localRevision: 2 })
    const outcome = reconcileStudyState({ local: a, remote: b, baseRevision: 0 })
    expect(outcome.result).toBe('ACCEPT_REMOTE')
    if (!('state' in outcome)) return
    expect(outcome.state.assignment.progress.completedSegmentRefs).toEqual(['segment:one', 'segment:two'])
  })

  it('returns an explicit conflict for an incompatible current checkpoint', () => {
    const a = makeReplica({
      deviceId: 'device:a', completedCount: 1, checkpointRevision: 2,
      checkpointRef: 'checkpoint:a', responseDraftRef: 'draft:a',
    })
    const b = makeReplica({
      deviceId: 'device:b', completedCount: 1, checkpointRevision: 2,
      checkpointRef: 'checkpoint:b', responseDraftRef: 'draft:b',
    })
    const outcome = reconcileStudyState({ local: a, remote: b, baseRevision: 0 })
    expect(outcome.result).toBe('MANUAL_OR_CONSERVATIVE_CONFLICT')
    expect(outcome.conflictCodes).toContain('CHECKPOINT_REVISION_COLLISION')
  })

  it('never lets a stale replica un-complete a lesson', () => {
    const complete = makeReplica({ deviceId: 'device:a', completedCount: 3, localRevision: 3 })
    const stale = makeReplica({ deviceId: 'device:b', completedCount: 1, localRevision: 1 })
    const outcome = reconcileStudyState({ local: stale, remote: complete, baseRevision: 0 })
    expect(outcome.result).toBe('ACCEPT_REMOTE')
    if (!('state' in outcome)) return
    expect(outcome.state.assignment.state).toBe('completed')
    expect(outcome.state.session.status).toBe('completed')
  })

  it('preserves guardian certification over a stale pending attestation', () => {
    const pendingAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      attestation: authorityStamp(1, 'STUDENT', 'operation:learner-complete'),
    })
    const certifiedAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      attestation: authorityStamp(2, 'PARENT', 'operation:guardian-attest'),
    })
    const pending = makeReplica({
      deviceId: 'device:a', completedCount: 3, completionRequirement: 'GUARDIAN_ATTESTATION',
      attestation: testAttestation('PENDING_GUARDIAN_ATTESTATION'), authority: pendingAuthority,
    })
    const certified = makeReplica({
      deviceId: 'device:b', completedCount: 3, completionRequirement: 'GUARDIAN_ATTESTATION',
      attestation: testAttestation('CERTIFIED'), authority: certifiedAuthority,
    })
    const outcome = reconcileStudyState({ local: pending, remote: certified, baseRevision: 0 })
    expect(outcome.result).toBe('ACCEPT_REMOTE')
    if (!('state' in outcome)) return
    expect(outcome.state.attestation?.status).toBe('CERTIFIED')
    expect(outcome.state.assignment.state).toBe('completed')
  })

  it('imports a safety hold created while the other device was offline and blocks local continuation', () => {
    const hold = testHold()
    const heldAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      safetyHolds: Object.freeze({ [hold.holdRef]: authorityStamp(1, 'SYSTEM', 'operation:safety-hold') }),
    })
    const offline = makeReplica({ deviceId: 'device:a' })
    const held = makeReplica({ deviceId: 'device:b', safetyHolds: [hold], authority: heldAuthority })
    const outcome = reconcileStudyState({ local: offline, remote: held, baseRevision: 0 })
    expect(outcome.result).toBe('ACCEPT_REMOTE')
    if (!('state' in outcome)) return
    const reconciled = makeReplica({
      deviceId: 'device:a',
      safetyHolds: outcome.state.safetyHolds,
      authority: outcome.authority,
    })
    expect(evaluateOfflineStudyPolicy({ replica: reconciled, capabilities: AVAILABLE })).toEqual({
      status: 'BLOCKED', mayRecordProgress: false, mayCertifyCompletion: false, reasonCode: 'SAFETY_HOLD',
    })
  })

  it('preserves an attached dynamic source when the other device is stale', () => {
    const sourceAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      sourceAttachment: authorityStamp(1, 'STUDENT', 'operation:attach-source'),
    })
    const stale = makeReplica({ deviceId: 'device:a', dynamicSourceRequired: true })
    const attached = makeReplica({
      deviceId: 'device:b', dynamicSourceRequired: true,
      sourceAttachment: testSource(), authority: sourceAuthority,
    })
    const outcome = reconcileStudyState({ local: stale, remote: attached, baseRevision: 0 })
    expect(outcome.result).toBe('ACCEPT_REMOTE')
    if (!('state' in outcome)) return
    expect(outcome.state.sourceAttachment?.status).toBe('ATTACHED_SATISFIED')
  })

  it('does not guess when an assignment was abandoned on one device and progressed on another', () => {
    const abandonedAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      assignment: authorityStamp(1, 'PARENT', 'operation:abandon-assignment'),
    })
    const abandoned = makeReplica({
      deviceId: 'device:a', assignmentState: 'abandoned', authority: abandonedAuthority,
    })
    const progressed = makeReplica({ deviceId: 'device:b', completedCount: 1, localRevision: 1 })
    const outcome = reconcileStudyState({ local: progressed, remote: abandoned, baseRevision: 0 })
    expect(outcome.result).toBe('MANUAL_OR_CONSERVATIVE_CONFLICT')
    expect(outcome.conflictCodes).toContain('ASSIGNMENT_ABANDONED_CONFLICT')
  })

  it('deduplicates an already-applied queued operation instead of applying it twice', () => {
    const operation = progressOperation('device:a', 'operation:deduplicated', 1)
    const local = makeReplica({
      deviceId: 'device:a', completedCount: 1, localRevision: 1,
      pendingOperations: [operation], baseServerRevision: 0, serverRevision: 0,
    })
    const remote = makeReplica({
      deviceId: 'device:server', completedCount: 1, localRevision: 1,
      serverRevision: 1, baseServerRevision: 1, appliedOperationIds: [operation.operationId],
    })
    const outcome = reconcileStudyState({ local, remote, baseRevision: 1 })
    expect(outcome.result).toBe('ACCEPT_REMOTE')
    const resolution = buildSyncResolution(outcome)
    expect(resolution.method).toBe('HYDRATE_REMOTE')
    if (resolution.method !== 'HYDRATE_REMOTE') return
    expect(resolution.operations).toEqual([])
    expect(resolution.appliedOperationIds).toContain(operation.operationId)
  })

  it('uses progress revisions, not device clock order', () => {
    const futureButStale = makeReplica({
      deviceId: 'device:a', completedCount: 1, timestamp: '2099-01-01T00:00:00.000Z',
    })
    const pastButAdvanced = makeReplica({
      deviceId: 'device:b', completedCount: 2, timestamp: '2001-01-01T00:00:00.000Z',
    })
    const outcome = reconcileStudyState({ local: futureButStale, remote: pastButAdvanced, baseRevision: 0 })
    expect(outcome.result).toBe('ACCEPT_REMOTE')
    if (!('state' in outcome)) return
    expect(outcome.state.assignment.progress.completedSegmentRefs).toHaveLength(2)
  })

  it('does not break a same-timestamp checkpoint collision by arbitrary side order', () => {
    const a = makeReplica({
      deviceId: 'device:a', completedCount: 1, timestamp: TEST_TIMESTAMP,
      checkpointRevision: 4, checkpointRef: 'checkpoint:a', responseDraftRef: 'draft:a',
    })
    const b = makeReplica({
      deviceId: 'device:b', completedCount: 1, timestamp: TEST_TIMESTAMP,
      checkpointRevision: 4, checkpointRef: 'checkpoint:b', responseDraftRef: 'draft:b',
    })
    const outcome = reconcileStudyState({ local: a, remote: b, baseRevision: 0 })
    expect(outcome.result).toBe('MANUAL_OR_CONSERVATIVE_CONFLICT')
    expect(outcome.conflictCodes).toContain('CHECKPOINT_REVISION_COLLISION')
  })
})

const TEST_TIMESTAMP = '2026-08-13T16:00:00.000Z'

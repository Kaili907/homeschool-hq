import { describe, expect, it } from 'vitest'
import { classifyConflict, reconcileStudyState } from './reconciliation'
import { buildSyncResolution } from './syncResolution'
import {
  authorityStamp,
  initialAuthority,
  makeReplica,
  testAttestation,
  testHold,
} from './testFixtures'
import type { StudyFieldAuthority, StudySyncOperationMetadata, StudySyncReplica } from './types'

/** Deliberately unsafe mutants. Each assertion below is a mutation-killing control. */
function timestampOnly(left: StudySyncReplica, right: StudySyncReplica): StudySyncReplica {
  return Date.parse(left.state.session.updatedAt) >= Date.parse(right.state.session.updatedAt) ? left : right
}

function lastArgumentWins(_left: StudySyncReplica, right: StudySyncReplica): StudySyncReplica {
  return right
}

describe('reconciliation policy negative controls', () => {
  it('kills last-write/timestamp-wins when a newer clock is stale against certified completion', () => {
    const stale = makeReplica({
      deviceId: 'device:a', completedCount: 1, timestamp: '2099-01-01T00:00:00.000Z',
      completionRequirement: 'GUARDIAN_ATTESTATION',
    })
    const attestationAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      attestation: authorityStamp(1, 'PARENT', 'operation:certify'),
    })
    const certified = makeReplica({
      deviceId: 'device:b', completedCount: 3, timestamp: '2000-01-01T00:00:00.000Z',
      completionRequirement: 'GUARDIAN_ATTESTATION',
      attestation: testAttestation('CERTIFIED'),
      authority: attestationAuthority,
    })
    expect(timestampOnly(stale, certified)).toBe(stale)
    const outcome = reconcileStudyState({ local: stale, remote: certified, baseRevision: 0 })
    expect(outcome.result).toBe('ACCEPT_REMOTE')
    if (!('state' in outcome)) return
    expect(outcome.state.attestation?.status).toBe('CERTIFIED')
    expect(outcome.state.assignment.state).toBe('completed')
  })

  it('kills timestamp-only tie breaking for a same-instant checkpoint collision', () => {
    const left = makeReplica({
      deviceId: 'device:a', completedCount: 1, checkpointRevision: 1,
      checkpointRef: 'checkpoint:left', responseDraftRef: 'draft:left',
    })
    const right = makeReplica({
      deviceId: 'device:b', completedCount: 1, checkpointRevision: 1,
      checkpointRef: 'checkpoint:right', responseDraftRef: 'draft:right',
    })
    expect(timestampOnly(left, right)).toBe(left)
    expect(reconcileStudyState({ local: left, remote: right, baseRevision: 0 })).toMatchObject({
      result: 'MANUAL_OR_CONSERVATIVE_CONFLICT',
      conflictCodes: ['CHECKPOINT_REVISION_COLLISION'],
    })
  })

  it('kills a mutant that lets a student clear a safety hold', () => {
    const cleared = testHold('cleared')
    const studentClearAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      safetyHolds: Object.freeze({ [cleared.holdRef]: authorityStamp(2, 'STUDENT', 'operation:student-clear') }),
    })
    const forged = makeReplica({ safetyHolds: [cleared], authority: studentClearAuthority })
    // The unsafe mutant would simply filter this record because status=cleared.
    expect(forged.state.safetyHolds.filter((hold) => hold.status !== 'cleared')).toEqual([])
    const classification = classifyConflict({ local: forged, remote: forged })
    expect(classification.status).toBe('CONFLICT')
    expect(classification.codes).toContain('SAFETY_CLEAR_UNAUTHORIZED')
  })

  it('kills a stale-state mutant that removes completion', () => {
    const complete = makeReplica({ completedCount: 3, deviceId: 'device:a' })
    const stale = makeReplica({ completedCount: 1, deviceId: 'device:b' })
    expect(lastArgumentWins(complete, stale).state.assignment.state).toBe('active')
    const outcome = reconcileStudyState({ local: complete, remote: stale, baseRevision: 0 })
    expect('state' in outcome && outcome.state.assignment.state).toBe('completed')
  })

  it('kills a stale-state mutant that removes guardian attestation', () => {
    const authority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      attestation: authorityStamp(1, 'PARENT', 'operation:guardian-certification'),
    })
    const certified = makeReplica({
      completedCount: 3,
      completionRequirement: 'GUARDIAN_ATTESTATION',
      attestation: testAttestation('CERTIFIED'),
      authority,
    })
    const stale = makeReplica({ completionRequirement: 'GUARDIAN_ATTESTATION', deviceId: 'device:b' })
    expect(lastArgumentWins(certified, stale).state.attestation).toBeNull()
    const outcome = reconcileStudyState({ local: certified, remote: stale, baseRevision: 0 })
    expect('state' in outcome && outcome.state.attestation?.status).toBe('CERTIFIED')
  })

  it('kills mutants that accept a sibling or a different lesson/session lineage', () => {
    const local = makeReplica()
    const siblingIdentity = { ...local.identity, learnerRef: 'student:b', studentRef: 'student:b' }
    const lessonIdentity = {
      ...local.identity,
      assignmentRef: 'assignment:b',
      lessonRef: 'lesson:b',
      blockRef: 'block:b',
      sessionRef: 'session:b',
      lineageRootRef: 'block:b',
    }
    for (const unsafeRemote of [
      makeReplica({ identity: siblingIdentity, deviceId: 'device:b' }),
      makeReplica({ identity: lessonIdentity, deviceId: 'device:b' }),
    ]) {
      expect(lastArgumentWins(local, unsafeRemote)).toBe(unsafeRemote)
      const outcome = reconcileStudyState({ local, remote: unsafeRemote, baseRevision: 0 })
      expect(outcome.result).toBe('REFUSE_IDENTITY_MISMATCH')
      expect(outcome.conflictCodes).toContain('DOCUMENT_IDENTITY_MISMATCH')
    }
  })

  it('kills a queue-concatenation mutant that double-applies one operation ID', () => {
    const operation: StudySyncOperationMetadata = Object.freeze({
      operationId: 'operation:duplicate', deviceId: 'device:a', localRevision: 1,
      kind: 'PROGRESS', actor: 'STUDENT',
    })
    const local = makeReplica({
      deviceId: 'device:a', completedCount: 1, localRevision: 1, pendingOperations: [operation],
    })
    const remote = makeReplica({
      deviceId: 'device:server', completedCount: 1, localRevision: 1,
      serverRevision: 1, baseServerRevision: 1, appliedOperationIds: [operation.operationId],
    })
    const concatenationMutant = [...local.metadata.pendingOperations, ...remote.metadata.pendingOperations]
    expect(concatenationMutant).toHaveLength(1)
    const resolution = buildSyncResolution(reconcileStudyState({ local, remote, baseRevision: 1 }))
    expect(resolution.method).toBe('HYDRATE_REMOTE')
    if (resolution.method !== 'HYDRATE_REMOTE') return
    expect(resolution.operations).toEqual([])
  })
})

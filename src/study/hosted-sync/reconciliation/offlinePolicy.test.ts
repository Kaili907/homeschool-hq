import { describe, expect, it } from 'vitest'
import { evaluateOfflineStudyPolicy } from './offlinePolicy'
import {
  authorityStamp,
  initialAuthority,
  makeReplica,
  testAttestation,
  testHold,
  testSource,
} from './testFixtures'
import type { OfflineStudyCapabilities, StudyFieldAuthority } from './types'

const AVAILABLE: OfflineStudyCapabilities = Object.freeze({
  durableStorageAvailable: true,
  assignmentAvailable: true,
  productionMaterialAvailable: true,
  safetyStateAvailable: true,
})

describe('offline Study policy', () => {
  it('allows local-first progress with no network when every local guard is available', () => {
    expect(evaluateOfflineStudyPolicy({ replica: makeReplica(), capabilities: AVAILABLE })).toEqual({
      status: 'ALLOW_LOCAL_PROGRESS',
      mayRecordProgress: true,
      mayCertifyCompletion: true,
      reasonCode: null,
    })
  })

  it.each([
    ['durableStorageAvailable', 'DURABLE_STORAGE_UNAVAILABLE'],
    ['assignmentAvailable', 'ASSIGNMENT_UNAVAILABLE'],
    ['productionMaterialAvailable', 'PRODUCTION_MATERIAL_UNAVAILABLE'],
    ['safetyStateAvailable', 'SAFETY_STATE_UNAVAILABLE'],
  ] as const)('fails closed when local %s is unavailable', (capability, reasonCode) => {
    expect(evaluateOfflineStudyPolicy({
      replica: makeReplica(),
      capabilities: { ...AVAILABLE, [capability]: false },
    })).toMatchObject({ status: 'BLOCKED', mayRecordProgress: false, reasonCode })
  })

  it('does not bypass a dynamic-source requirement', () => {
    const blocked = makeReplica({ dynamicSourceRequired: true })
    expect(evaluateOfflineStudyPolicy({ replica: blocked, capabilities: AVAILABLE })).toMatchObject({
      status: 'BLOCKED', reasonCode: 'DYNAMIC_SOURCE_REQUIRED',
    })
    const authority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      sourceAttachment: authorityStamp(1, 'STUDENT', 'operation:source'),
    })
    const ready = makeReplica({
      dynamicSourceRequired: true,
      sourceAttachment: testSource(),
      authority,
    })
    expect(evaluateOfflineStudyPolicy({ replica: ready, capabilities: AVAILABLE }).status)
      .toBe('ALLOW_LOCAL_PROGRESS')
  })

  it('does not allow local certification for guardian-attested work', () => {
    const inProgress = makeReplica({ completionRequirement: 'GUARDIAN_ATTESTATION' })
    expect(evaluateOfflineStudyPolicy({ replica: inProgress, capabilities: AVAILABLE })).toMatchObject({
      status: 'ALLOW_LOCAL_PROGRESS', mayRecordProgress: true, mayCertifyCompletion: false,
    })

    const authority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      attestation: authorityStamp(1, 'STUDENT', 'operation:learner-complete'),
    })
    const waiting = makeReplica({
      completedCount: 3,
      completionRequirement: 'GUARDIAN_ATTESTATION',
      attestation: testAttestation('PENDING_GUARDIAN_ATTESTATION'),
      authority,
    })
    // Exact final-composition contract: calendar work is complete, but the
    // Study session remains active until the guardian certifies it.
    expect(waiting.state.calendar.block.state).toBe('completed')
    expect(waiting.state.session.status).toBe('active')
    expect(evaluateOfflineStudyPolicy({ replica: waiting, capabilities: AVAILABLE })).toEqual({
      status: 'WAITING_FOR_GUARDIAN',
      mayRecordProgress: false,
      mayCertifyCompletion: false,
      reasonCode: 'GUARDIAN_ATTESTATION_REQUIRED',
    })
  })

  it('blocks an open hold and accepts only an adult-authorized persisted clear', () => {
    const open = testHold('open')
    const openAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      safetyHolds: Object.freeze({ [open.holdRef]: authorityStamp(1, 'SYSTEM', 'operation:hold') }),
    })
    expect(evaluateOfflineStudyPolicy({
      replica: makeReplica({ safetyHolds: [open], authority: openAuthority }),
      capabilities: AVAILABLE,
    })).toMatchObject({ status: 'BLOCKED', reasonCode: 'SAFETY_HOLD' })

    const cleared = testHold('cleared')
    const clearedAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      safetyHolds: Object.freeze({ [cleared.holdRef]: authorityStamp(2, 'PARENT', 'operation:clear') }),
    })
    expect(evaluateOfflineStudyPolicy({
      replica: makeReplica({ safetyHolds: [cleared], authority: clearedAuthority }),
      capabilities: AVAILABLE,
    }).status).toBe('ALLOW_LOCAL_PROGRESS')
  })

  it('blocks stopped, abandoned, and already-complete assignments', () => {
    expect(evaluateOfflineStudyPolicy({
      replica: makeReplica({ sessionStatus: 'stopped' }), capabilities: AVAILABLE,
    })).toMatchObject({ reasonCode: 'SESSION_STOPPED' })
    expect(evaluateOfflineStudyPolicy({
      replica: makeReplica({ assignmentState: 'abandoned' }), capabilities: AVAILABLE,
    })).toMatchObject({ reasonCode: 'ASSIGNMENT_ABANDONED' })
    expect(evaluateOfflineStudyPolicy({
      replica: makeReplica({ completedCount: 3 }), capabilities: AVAILABLE,
    })).toMatchObject({ reasonCode: 'ASSIGNMENT_COMPLETE' })
  })
})

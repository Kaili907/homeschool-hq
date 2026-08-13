import { describe, expect, it } from 'vitest'
import { classifyConflict, reconcileStudyState } from './reconciliation'
import {
  authorityStamp,
  initialAuthority,
  makeReplica,
  replaceReplica,
  testParentSettings,
  testPreferences,
  testHold,
  testSource,
} from './testFixtures'
import type { StudyDocumentIdentity, StudyFieldAuthority } from './types'

describe('authority-sensitive reconciliation rules', () => {
  it('merges newer parent settings with compatible local learner progress', () => {
    const local = makeReplica({ deviceId: 'device:a', completedCount: 2, localRevision: 2 })
    const parentAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      parentSettings: authorityStamp(1, 'PARENT', 'operation:parent-settings'),
    })
    const remote = makeReplica({
      deviceId: 'device:b',
      parentSettings: Object.freeze({ ...testParentSettings(1), timerHidden: true }),
      authority: parentAuthority,
    })
    const outcome = reconcileStudyState({ local, remote, baseRevision: 0 })
    expect(outcome.result).toBe('MERGED')
    if (!('state' in outcome)) return
    expect(outcome.state.assignment.progress.completedSegmentRefs).toHaveLength(2)
    expect(outcome.state.parentSettings?.timerHidden).toBe(true)
    expect(outcome.authority.parentSettings.operationId).toBe('operation:parent-settings')
  })

  it('returns a conflict for two different parent events at one authority revision', () => {
    const leftAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      parentSettings: authorityStamp(1, 'PARENT', 'operation:parent-left'),
    })
    const rightAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      parentSettings: authorityStamp(1, 'PARENT', 'operation:parent-right'),
    })
    const left = makeReplica({
      deviceId: 'device:a', parentSettings: testParentSettings(1), authority: leftAuthority,
    })
    const right = makeReplica({
      deviceId: 'device:b',
      parentSettings: Object.freeze({ ...testParentSettings(1), maximumWorkMinutes: 45 }),
      authority: rightAuthority,
    })
    const outcome = reconcileStudyState({ local: left, remote: right, baseRevision: 0 })
    expect(outcome.result).toBe('MANUAL_OR_CONSERVATIVE_CONFLICT')
    expect(outcome.conflictCodes).toContain('PARENT_AUTHORITY_COLLISION')
  })

  it('uses logical preference revision and conflicts on a same-revision edit', () => {
    const revisionOne: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      preferences: authorityStamp(1, 'STUDENT', 'operation:preference-one'),
    })
    const revisionTwo: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      preferences: authorityStamp(2, 'STUDENT', 'operation:preference-two'),
    })
    const older = makeReplica({ preferences: testPreferences(false), authority: revisionOne })
    const newer = makeReplica({ deviceId: 'device:b', preferences: testPreferences(true), authority: revisionTwo })
    const accepted = reconcileStudyState({ local: older, remote: newer, baseRevision: 0 })
    expect(accepted.result).toBe('ACCEPT_REMOTE')

    const collisionAuthority: StudyFieldAuthority = Object.freeze({
      ...revisionOne,
      preferences: authorityStamp(1, 'STUDENT', 'operation:preference-other'),
    })
    const collision = reconcileStudyState({
      local: older,
      remote: makeReplica({ deviceId: 'device:b', preferences: testPreferences(true), authority: collisionAuthority }),
      baseRevision: 0,
    })
    expect(collision.result).toBe('MANUAL_OR_CONSERVATIVE_CONFLICT')
    expect(collision.conflictCodes).toContain('PREFERENCE_REVISION_COLLISION')
  })

  it('does not let a stale requirement revision remove dynamic-source or guardian requirements', () => {
    const strongerAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      requirements: authorityStamp(2, 'SERVER', 'operation:requirements-stronger'),
    })
    const staleAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      requirements: authorityStamp(1, 'SERVER', 'operation:requirements-stale'),
    })
    const stronger = makeReplica({
      dynamicSourceRequired: true,
      completionRequirement: 'GUARDIAN_ATTESTATION',
      authority: strongerAuthority,
    })
    const stale = makeReplica({ deviceId: 'device:b', subject: 'social-studies', authority: staleAuthority })
    const outcome = reconcileStudyState({ local: stronger, remote: stale, baseRevision: 0 })
    expect(outcome.result).toBe('ACCEPT_LOCAL')
    if (!('state' in outcome)) return
    expect(outcome.state.readiness.dynamicSourceRequirement).toBe('SOCIAL_STUDIES_SOURCE_ATTACHMENT')
    expect(outcome.state.readiness.completionRequirement).toBe('GUARDIAN_ATTESTATION')
  })

  it('conflicts on two distinct source attachments at one logical revision', () => {
    const leftAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      sourceAttachment: authorityStamp(1, 'STUDENT', 'operation:source-left'),
    })
    const rightAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      sourceAttachment: authorityStamp(1, 'STUDENT', 'operation:source-right'),
    })
    const outcome = reconcileStudyState({
      local: makeReplica({ sourceAttachment: testSource(undefined, 'source:left'), authority: leftAuthority }),
      remote: makeReplica({
        deviceId: 'device:b', sourceAttachment: testSource(undefined, 'source:right'), authority: rightAuthority,
      }),
      baseRevision: 0,
    })
    expect(outcome.result).toBe('MANUAL_OR_CONSERVATIVE_CONFLICT')
    expect(outcome.conflictCodes).toContain('SOURCE_ATTACHMENT_CONFLICT')
  })

  it('uses safety authority revision, never timestamp, for hold versus clear', () => {
    const open = testHold('open')
    const cleared = testHold('cleared')
    const newerHoldAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      safetyHolds: Object.freeze({ [open.holdRef]: authorityStamp(3, 'SYSTEM', 'operation:new-hold') }),
    })
    const staleClearAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      safetyHolds: Object.freeze({ [cleared.holdRef]: authorityStamp(2, 'PARENT', 'operation:stale-clear') }),
    })
    const held = reconcileStudyState({
      local: makeReplica({ safetyHolds: [cleared], authority: staleClearAuthority }),
      remote: makeReplica({ deviceId: 'device:b', safetyHolds: [open], authority: newerHoldAuthority }),
      baseRevision: 0,
    })
    expect('state' in held && held.state.safetyHolds[0].status).toBe('open')

    const newerClearAuthority: StudyFieldAuthority = Object.freeze({
      ...initialAuthority(),
      safetyHolds: Object.freeze({ [cleared.holdRef]: authorityStamp(4, 'PARENT', 'operation:new-clear') }),
    })
    const clearedOutcome = reconcileStudyState({
      local: makeReplica({ safetyHolds: [open], authority: newerHoldAuthority }),
      remote: makeReplica({ deviceId: 'device:b', safetyHolds: [cleared], authority: newerClearAuthority }),
      baseRevision: 0,
    })
    expect('state' in clearedOutcome && clearedOutcome.state.safetyHolds[0].status).toBe('cleared')
  })

  it('requires a refetch when the fetched CAS revision moved or regressed', () => {
    const local = makeReplica({ serverRevision: 2, baseServerRevision: 2 })
    const remote = makeReplica({ deviceId: 'device:b', serverRevision: 3, baseServerRevision: 3 })
    expect(reconcileStudyState({ local, remote, baseRevision: 2 })).toMatchObject({
      result: 'RETRY_WITH_REVISION', conflictCodes: ['REMOTE_REVISION_MOVED'],
    })
    const behind = makeReplica({ deviceId: 'device:b', serverRevision: 1, baseServerRevision: 1 })
    expect(reconcileStudyState({ local, remote: behind, baseRevision: 1 })).toMatchObject({
      result: 'RETRY_WITH_REVISION', conflictCodes: ['REMOTE_REVISION_BEHIND'],
    })
  })

  it('refuses sibling, lesson, session, and household identity mismatches', () => {
    const local = makeReplica()
    const variants: StudyDocumentIdentity[] = [
      { ...local.identity, studentRef: 'student:b', learnerRef: 'student:b' },
      { ...local.identity, lessonRef: 'lesson:b' },
      { ...local.identity, sessionRef: 'session:b' },
      { ...local.identity, householdRef: 'household:two' },
    ]
    for (const identity of variants) {
      const remote = makeReplica({ identity, deviceId: 'device:b' })
      const outcome = reconcileStudyState({ local, remote, baseRevision: 0 })
      expect(outcome.result).toBe('REFUSE_IDENTITY_MISMATCH')
      expect(outcome.conflictCodes).toContain('DOCUMENT_IDENTITY_MISMATCH')
    }
  })

  it('never includes rejected learner/Tutor content in conflict diagnostics', () => {
    const valid = makeReplica()
    const unsafe = replaceReplica(valid, {
      state: {
        checkpoint: {
          checkpointRef: 'checkpoint:unsafe',
          householdRef: valid.identity.householdRef,
          learnerRef: valid.identity.learnerRef,
          sessionRef: valid.identity.sessionRef,
          lessonRef: valid.identity.lessonRef,
          segmentRef: 'segment:one',
          revision: 1,
          capturedAt: '2026-08-13T16:00:00.000Z',
          completedSegmentRefs: [],
          elapsedActiveSecondsInSegment: 0,
          responseDraftRef: null,
          rawAnswerIncluded: true,
          transcriptIncluded: false,
          rawAnswer: 'private learner answer',
          tutorText: 'private Tutor transcript',
        } as never,
      },
    })
    const classification = classifyConflict({ local: unsafe, remote: unsafe })
    expect(classification.status).toBe('CONFLICT')
    expect(classification.codes).toContain('PRIVACY_MINIMIZATION_FAILED')
    const serialized = JSON.stringify(classification.diagnostic)
    expect(serialized).not.toContain('private learner answer')
    expect(serialized).not.toContain('private Tutor transcript')
    expect(Object.keys(classification.diagnostic).sort()).toEqual([
      'codes', 'documentId', 'localRevision', 'localServerRevision', 'remoteLocalRevision', 'remoteServerRevision',
    ])
  })
})

import { describe, expect, it } from 'vitest'
import { reconcileStudyState } from './reconciliation'
import { enqueueOfflineStudyMutation } from './syncResolution'
import {
  initialAuthority,
  makeReplica,
  replaceReplica,
} from './testFixtures'
import { STUDY_FIELD_CLASSIFICATION } from './types'
import type { DurableEventRecordV1 } from '../../family-pilot/durable-ports'

function completedCount(state: { readonly assignment: { readonly progress: { readonly completedSegmentRefs: readonly string[] } } }): number {
  return state.assignment.progress.completedSegmentRefs.length
}

function safeEvent(eventRef: string, occurredAt: string): DurableEventRecordV1 {
  return Object.freeze({
    sessionRef: 'session:a',
    eventRef,
    semanticKey: 'session:a|checkpoint-saved|checkpoint:shared',
    event: Object.freeze({
      eventRef,
      occurredAt,
      type: 'checkpoint-saved',
      payload: Object.freeze({ checkpointRef: 'checkpoint:shared', revision: 1 }),
    }),
  })
}

describe('deterministic reconciliation properties', () => {
  it('is commutative and never regresses prefix progress across all fixture progress pairs', () => {
    for (let leftCount = 0; leftCount <= 3; leftCount += 1) {
      for (let rightCount = 0; rightCount <= 3; rightCount += 1) {
        const left = makeReplica({
          deviceId: 'device:a',
          completedCount: leftCount,
          timestamp: '2099-01-01T00:00:00.000Z',
          localRevision: leftCount,
        })
        const right = makeReplica({
          deviceId: 'device:b',
          completedCount: rightCount,
          timestamp: '2000-01-01T00:00:00.000Z',
          localRevision: rightCount,
        })
        const forward = reconcileStudyState({ local: left, remote: right, baseRevision: 0 })
        const reverse = reconcileStudyState({ local: right, remote: left, baseRevision: 0 })
        expect('state' in forward).toBe(true)
        expect('state' in reverse).toBe(true)
        if (!('state' in forward) || !('state' in reverse)) continue
        expect(forward.state).toEqual(reverse.state)
        expect(completedCount(forward.state)).toBe(Math.max(leftCount, rightCount))
      }
    }
  })

  it('is idempotent for an already-converged replica', () => {
    for (let count = 0; count <= 3; count += 1) {
      const replica = makeReplica({ completedCount: count, localRevision: count })
      const outcome = reconcileStudyState({ local: replica, remote: replica, baseRevision: 0 })
      expect(outcome.result).toBe('ACCEPT_REMOTE')
      if (!('state' in outcome)) continue
      expect(outcome.state).toEqual(replica.state)
      expect(outcome.authority).toEqual(replica.metadata.authority)
    }
  })

  it('deduplicates semantically identical safe events independent of timestamp and input order', () => {
    const leftEvent = safeEvent('event:a', '2099-01-01T00:00:00.000Z')
    const rightEvent = safeEvent('event:b', '2000-01-01T00:00:00.000Z')
    const leftBase = makeReplica({ deviceId: 'device:a' })
    const rightBase = makeReplica({ deviceId: 'device:b' })
    const left = replaceReplica(leftBase, { state: { events: [leftEvent] } })
    const right = replaceReplica(rightBase, { state: { events: [rightEvent] } })
    const forward = reconcileStudyState({ local: left, remote: right, baseRevision: 0 })
    const reverse = reconcileStudyState({ local: right, remote: left, baseRevision: 0 })
    expect('state' in forward).toBe(true)
    expect('state' in reverse).toBe(true)
    if (!('state' in forward) || !('state' in reverse)) return
    expect(forward.state.events).toHaveLength(1)
    expect(forward.state.events[0].eventRef).toBe('event:a')
    expect(reverse.state.events).toEqual(forward.state.events)
  })

  it('makes a duplicate offline operation an exact no-op, including supplied state', () => {
    const base = makeReplica()
    const progressed = makeReplica({ completedCount: 1 }).state
    const once = enqueueOfflineStudyMutation({
      replica: base,
      state: progressed,
      authority: initialAuthority(),
      operationId: 'operation:once',
      kind: 'PROGRESS',
      actor: 'STUDENT',
    })
    const duplicateWithDifferentState = enqueueOfflineStudyMutation({
      replica: once,
      state: makeReplica({ completedCount: 2 }).state,
      authority: initialAuthority(),
      operationId: 'operation:once',
      kind: 'PROGRESS',
      actor: 'STUDENT',
    })
    expect(duplicateWithDifferentState).toBe(once)
    expect(completedCount(duplicateWithDifferentState.state)).toBe(1)
    expect(duplicateWithDifferentState.metadata.localRevision).toBe(1)
    expect(duplicateWithDifferentState.metadata.pendingOperations).toHaveLength(1)
    expect(Object.keys(duplicateWithDifferentState.metadata.pendingOperations[0]).sort()).toEqual([
      'actor', 'deviceId', 'kind', 'localRevision', 'operationId',
    ])
  })

  it('publishes a closed classification for every actual state field family', () => {
    expect(Object.keys(STUDY_FIELD_CLASSIFICATION).sort()).toEqual([
      'AUTHORITY_SENSITIVE',
      'IDENTITY_IMMUTABLE',
      'LOCAL_PREFERENCE',
      'MONOTONIC_PROGRESS',
      'SERVER_OR_PARENT_AUTHORITY',
    ])
    expect(STUDY_FIELD_CLASSIFICATION.MONOTONIC_PROGRESS).toContain('checkpoint.revision/completedSegmentRefs')
    expect(STUDY_FIELD_CLASSIFICATION.SERVER_OR_PARENT_AUTHORITY).toContain('parentSettings')
  })
})

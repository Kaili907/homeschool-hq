import { describe, expect, it } from 'vitest'
import {
  HOSTED_STUDY_SYNC_MAX_QUEUE_LENGTH,
  emptyHostedStudyLocalSyncState,
  enqueueHostedStudyOperation,
  installHostedStudyIdentityLink,
  parseHostedStudyLocalSyncState,
} from './syncMetadata'

const identity = {
  householdRef: 'household:one',
  studentRef: '11111111-2222-4333-8444-555555555555',
  assignmentRef: 'assignment:one',
  sessionRef: 'session:one',
}

describe('hosted Study local sync metadata', () => {
  it('stores only bounded operation/revision/link metadata and deduplicates stable UUIDs', () => {
    const initial = emptyHostedStudyLocalSyncState({
      identity, deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    const queued = enqueueHostedStudyOperation({
      state: initial,
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      operation: 'checkpoint:compare-and-swap',
    })
    expect(enqueueHostedStudyOperation({
      state: queued,
      operationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      operation: 'checkpoint:compare-and-swap',
    })).toBe(queued)
    expect(JSON.stringify(queued)).not.toMatch(/rawAnswer|Tutor|transcript|pin|bearer/i)
    expect(parseHostedStudyLocalSyncState(queued, identity)).not.toBeNull()
  })

  it('refuses sensitive extras and a queue beyond the hard bound', () => {
    const initial = emptyHostedStudyLocalSyncState({
      identity, deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    expect(parseHostedStudyLocalSyncState({ ...initial, pin: '2468' }, identity)).toBeNull()
    let state = initial
    for (let index = 0; index < HOSTED_STUDY_SYNC_MAX_QUEUE_LENGTH; index += 1) {
      state = enqueueHostedStudyOperation({
        state,
        operationId: `10000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
        operation: 'checkpoint:compare-and-swap',
      })
    }
    expect(() => enqueueHostedStudyOperation({
      state,
      operationId: '20000000-0000-4000-8000-000000000000',
      operation: 'checkpoint:compare-and-swap',
    })).toThrow('queue is full')
  })

  it('persists only an adult-confirmed exact mapping and never replaces it implicitly', () => {
    const initial = emptyHostedStudyLocalSyncState({
      identity, deviceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    })
    const link = {
      kind: 'explicit-adult-confirmed-link' as const,
      localHouseholdRef: 'household:legacy', hostedHouseholdRef: identity.householdRef,
      localStudentRef: 'student:legacy', hostedStudentRef: identity.studentRef,
      confirmedAt: '2026-08-13T12:00:00.000Z',
    }
    const linked = installHostedStudyIdentityLink({ state: initial, link })
    expect(linked.link).toEqual(link)
    expect(() => installHostedStudyIdentityLink({
      state: linked,
      link: { ...link, localStudentRef: 'student:other' },
    })).toThrow('cannot be silently replaced')
    expect(() => installHostedStudyIdentityLink({
      state: initial,
      link: { ...link, hostedStudentRef: '22222222-2222-4222-8222-222222222222' },
    })).toThrow('does not match')
  })
})

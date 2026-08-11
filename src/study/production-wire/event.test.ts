import { describe, expect, it } from 'vitest'
import {
  parseProductionLearnerEventAppendRequestV1,
  parseProductionLearnerEventAppendResultV1,
} from './index'

const storedAt = '2026-08-11T18:30:00Z'

function appendRequest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    eventKind: 'tutor_event_accepted',
    sessionRef: 'session:one',
    eventId: 'ledger-event:one',
    eventRef: 'tutor-event:accepted-one',
    idempotencyKey: 'idempotency:tutor-event-one',
    operationRef: 'operation:tutor-event-one',
    ...overrides,
  }
}

describe('production learner event append request', () => {
  it('admits only the minimized tutor_event_accepted shape', () => {
    const source = appendRequest()
    const parsed = parseProductionLearnerEventAppendRequestV1(source)
    expect(parsed).toEqual(source)
    expect(parsed).not.toBe(source)
    expect(Object.isFrozen(parsed)).toBe(true)
    expect(Object.keys(parsed!).sort()).toEqual([
      'eventId',
      'eventKind',
      'eventRef',
      'idempotencyKey',
      'operationRef',
      'schemaVersion',
      'sessionRef',
    ])
  })

  it.each([
    'checkpoint_saved',
    'checkpoint-saved',
    'safety_stop',
    'safety-stop',
    'parent_control',
    'parent-control',
    'session_started',
    'session_completed',
    'segment_completed',
    'tutor_event_rejected',
  ])('rejects event kind %s', (eventKind) => {
    expect(parseProductionLearnerEventAppendRequestV1(appendRequest({ eventKind }))).toBeNull()
  })

  it.each([
    ['raw learner answer', { rawAnswer: '42' }],
    ['generic payload', { payload: { answer: '42' } }],
    ['Tutor transcript', { transcript: 'secret' }],
    ['Tutor conversation', { tutorConversation: ['secret'] }],
    ['Tutor cursor', { tutorCursor: 3 }],
    ['protected work', { protectedWorkRef: 'protected:one' }],
    ['diagnostic data', { diagnostic: { mastery: 0.2 } }],
    ['emotional data', { emotionalState: 'sad' }],
    ['personality data', { personality: 'reflective' }],
    ['browser household claim', { householdRef: 'household:claimed' }],
    ['browser student claim', { studentId: 'student:claimed' }],
  ])('rejects %s as an unknown event property', (_label, extra) => {
    expect(parseProductionLearnerEventAppendRequestV1(appendRequest(extra))).toBeNull()
  })

  it('rejects malformed or oversized identities without confusing their fields', () => {
    for (const key of ['sessionRef', 'eventId', 'eventRef', 'idempotencyKey', 'operationRef']) {
      expect(parseProductionLearnerEventAppendRequestV1(appendRequest({ [key]: `x${'y'.repeat(160)}` })), key).toBeNull()
      expect(parseProductionLearnerEventAppendRequestV1(appendRequest({ [key]: 'has spaces' })), key).toBeNull()
    }
  })

  it('does not accept client-owned occurrence or transition timestamps', () => {
    expect(parseProductionLearnerEventAppendRequestV1({ ...appendRequest(), occurredAt: storedAt })).toBeNull()
    expect(parseProductionLearnerEventAppendRequestV1({ ...appendRequest(), storedAt })).toBeNull()
  })
})

describe('production learner event append result', () => {
  it('parses stored and duplicate replay with server-owned time', () => {
    for (const status of ['stored', 'duplicate-replay'] as const) {
      const result = {
        schemaVersion: 1,
        status,
        eventId: 'ledger-event:one',
        eventRef: 'tutor-event:accepted-one',
        storedAt,
      }
      expect(parseProductionLearnerEventAppendResultV1(result)).toEqual(result)
      expect(parseProductionLearnerEventAppendResultV1({ ...result, storedAt: 'today' })).toBeNull()
      expect(parseProductionLearnerEventAppendResultV1({ ...result, eventId: `e${'x'.repeat(160)}` })).toBeNull()
    }
  })

  it.each([
    'not-found',
    'idempotency-collision',
    'quarantined',
    'integrity-failed',
    'auth-refused',
    'auth-infrastructure-unavailable',
    'rate-limited',
    'server-unavailable',
  ])('admits safe event outcome %s with no response prose', (status) => {
    expect(parseProductionLearnerEventAppendResultV1({ schemaVersion: 1, status })?.status).toBe(status)
    expect(parseProductionLearnerEventAppendResultV1({ schemaVersion: 1, status, message: 'details' })).toBeNull()
  })

  it('does not make checkpoint or transition outcomes legal for event append', () => {
    expect(parseProductionLearnerEventAppendResultV1({ schemaVersion: 1, status: 'revision-conflict', currentRevision: 2 }))
      .toBeNull()
    expect(parseProductionLearnerEventAppendResultV1({ schemaVersion: 1, status: 'illegal-transition' })).toBeNull()
    expect(parseProductionLearnerEventAppendResultV1({ schemaVersion: 1, status: 'found' })).toBeNull()
  })
})

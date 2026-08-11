import { describe, expect, it } from 'vitest'
import {
  PRODUCTION_SESSION_STATUSES,
  parseProductionSessionAbandonRequestV1,
  parseProductionSessionAbandonResultV1,
  parseProductionSessionActivateResultV1,
  parseProductionSessionBeginRequestV1,
  parseProductionSessionBeginResultV1,
  parseProductionSessionCommandRequestV1,
  parseProductionSessionCompleteResultV1,
  parseProductionSessionDescriptorV1,
  parseProductionSessionInterruptResultV1,
  parseProductionSessionPauseResultV1,
  parseProductionSessionReadRequestV1,
  parseProductionSessionReadResultV1,
  parseProductionSessionResumeResultV1,
} from './index'

const transitionedAt = '2026-08-11T16:00:00Z'

function descriptor(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    sessionRef: 'session:one',
    calendarBlockRef: 'block:one',
    lessonRef: 'lesson:fractions',
    contentVersionRef: 'content:math-r1.12',
    status: 'active',
    revision: 3,
    transitionedAt,
    ...overrides,
  }
}

function revisionCommand(command: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    command,
    sessionRef: 'session:one',
    expectedRevision: 3,
    mutationRef: `mutation:${command}-4`,
    operationRef: `operation:${command}-4`,
    ...overrides,
  }
}

function stored(status: string, state: string): Record<string, unknown> {
  return { schemaVersion: 1, status, session: descriptor({ status: state }) }
}

describe('ProductionSessionDescriptorV1', () => {
  it.each([...PRODUCTION_SESSION_STATUSES])('admits durable server status %s', (status) => {
    expect(parseProductionSessionDescriptorV1(descriptor({ status }))?.status).toBe(status)
  })

  it.each(['ready', 'stopped', 'resting', 'in_progress'])('rejects non-durable or illegal status %s', (status) => {
    expect(parseProductionSessionDescriptorV1(descriptor({ status }))).toBeNull()
  })

  it('carries trusted content binding but no browser authority claims', () => {
    const parsed = parseProductionSessionDescriptorV1(descriptor())!
    expect(parsed).toMatchObject({
      calendarBlockRef: 'block:one',
      lessonRef: 'lesson:fractions',
      contentVersionRef: 'content:math-r1.12',
    })
    expect(Object.keys(parsed).sort()).toEqual([
      'calendarBlockRef',
      'contentVersionRef',
      'lessonRef',
      'revision',
      'schemaVersion',
      'sessionRef',
      'status',
      'transitionedAt',
    ])
  })

  it.each([
    ['household authority', { householdRef: 'household:claimed' }],
    ['student authority', { studentId: 'student:claimed' }],
    ['learner authority', { learnerRef: 'learner:claimed' }],
    ['raw answer', { rawAnswer: '3/4' }],
    ['Tutor transcript', { tutorTranscript: 'secret' }],
    ['protected work', { protectedWorkRef: 'protected:one' }],
    ['diagnostic data', { diagnostic: { score: 4 } }],
    ['emotional data', { emotionalState: 'upset' }],
    ['personality data', { personality: 'careful' }],
  ])('rejects %s as an unknown property', (_label, extra) => {
    expect(parseProductionSessionDescriptorV1(descriptor(extra))).toBeNull()
  })

  it('requires a positive safe revision and a server timestamp', () => {
    for (const invalid of [0, -1, 1.2, '3', Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseProductionSessionDescriptorV1(descriptor({ revision: invalid }))).toBeNull()
    }
    for (const invalid of ['2026-08-11', '2026-02-31T12:00:00Z', 'soon', 1_786_000_000_000, null]) {
      expect(parseProductionSessionDescriptorV1(descriptor({ transitionedAt: invalid }))).toBeNull()
    }
  })
})

describe('explicit production session commands', () => {
  it('begins from a block reference without accepting household/student authority', () => {
    const request = {
      schemaVersion: 1,
      command: 'begin',
      calendarBlockRef: 'block:one',
      mutationRef: 'mutation:begin-1',
      operationRef: 'operation:begin-1',
    }
    expect(parseProductionSessionBeginRequestV1(request)).toEqual(request)
    expect(parseProductionSessionBeginRequestV1({ ...request, householdRef: 'household:claim' })).toBeNull()
    expect(parseProductionSessionBeginRequestV1({ ...request, studentId: 'student:claim' })).toBeNull()
    expect(parseProductionSessionBeginRequestV1({ ...request, status: 'active' })).toBeNull()
  })

  it.each([
    revisionCommand('activate'),
    revisionCommand('resume'),
    { ...revisionCommand('pause'), pauseKind: 'student-requested-break' },
    { ...revisionCommand('interrupt'), interruptionKind: 'technical' },
    revisionCommand('complete'),
    revisionCommand('abandon'),
  ])('parses explicit command $command', (command) => {
    expect(parseProductionSessionCommandRequestV1(command)?.command).toBe(command.command)
  })

  it('rejects broad snapshot/status commands and guessed stopped state', () => {
    expect(parseProductionSessionCommandRequestV1(revisionCommand('save-snapshot', { status: 'active' }))).toBeNull()
    expect(parseProductionSessionCommandRequestV1(revisionCommand('stop', { status: 'stopped' }))).toBeNull()
    expect(parseProductionSessionCommandRequestV1(revisionCommand('pause', { pauseKind: 'technical' }))).toBeNull()
    expect(parseProductionSessionCommandRequestV1(revisionCommand('interrupt', { interruptionKind: 'safety' }))).toBeNull()
  })

  it('rejects malformed revisions, unknown keys, and oversized refs', () => {
    for (const invalid of [0, -1, 1.5, '3', null, Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseProductionSessionAbandonRequestV1(revisionCommand('abandon', { expectedRevision: invalid }))).toBeNull()
    }
    expect(parseProductionSessionAbandonRequestV1({ ...revisionCommand('abandon'), completedAt: transitionedAt })).toBeNull()
    expect(parseProductionSessionAbandonRequestV1(revisionCommand('abandon', { sessionRef: `s${'x'.repeat(160)}` }))).toBeNull()
  })

  it('keeps all server transition timestamps out of command requests', () => {
    for (const key of ['startedAt', 'pausedAt', 'interruptedAt', 'completedAt', 'transitionedAt']) {
      expect(parseProductionSessionCommandRequestV1({ ...revisionCommand('complete'), [key]: transitionedAt }), key).toBeNull()
    }
  })

  it('defines an exact session read request', () => {
    const request = { schemaVersion: 1, sessionRef: 'session:one', operationRef: 'operation:read-1' }
    expect(parseProductionSessionReadRequestV1(request)).toEqual(request)
    expect(parseProductionSessionReadRequestV1({ ...request, learnerRef: 'learner:claim' })).toBeNull()
    expect(parseProductionSessionReadRequestV1({ schemaVersion: 1, sessionRef: 'session:one' })).toBeNull()
  })
})

describe('operation-specific session results', () => {
  it('defines the exact found/not-found/integrity session-read vocabulary', () => {
    expect(parseProductionSessionReadResultV1({ schemaVersion: 1, status: 'found', session: descriptor() })?.status)
      .toBe('found')
    expect(parseProductionSessionReadResultV1({ schemaVersion: 1, status: 'not-found' })?.status).toBe('not-found')
    expect(parseProductionSessionReadResultV1({ schemaVersion: 1, status: 'integrity-failed' })?.status).toBe('integrity-failed')
    expect(parseProductionSessionReadResultV1(stored('stored', 'active'))).toBeNull()
    expect(parseProductionSessionReadResultV1({ schemaVersion: 1, status: 'illegal-transition' })).toBeNull()
  })

  it('requires each successful command to return its exact durable state', () => {
    expect(parseProductionSessionBeginResultV1(stored('stored', 'planned'))?.status).toBe('stored')
    expect(parseProductionSessionActivateResultV1(stored('stored', 'active'))?.status).toBe('stored')
    expect(parseProductionSessionResumeResultV1(stored('duplicate-replay', 'active'))?.status).toBe('duplicate-replay')
    expect(parseProductionSessionPauseResultV1(stored('stored', 'approved_break'))?.status).toBe('stored')
    expect(parseProductionSessionInterruptResultV1(stored('stored', 'technical_interruption'))?.status).toBe('stored')
    expect(parseProductionSessionCompleteResultV1(stored('stored', 'completed'))?.status).toBe('stored')
    expect(parseProductionSessionAbandonResultV1(stored('stored', 'abandoned'))?.status).toBe('stored')
  })

  it('refuses a success state belonging to a different operation', () => {
    expect(parseProductionSessionActivateResultV1(stored('stored', 'paused'))).toBeNull()
    expect(parseProductionSessionCompleteResultV1(stored('stored', 'active'))).toBeNull()
    expect(parseProductionSessionPauseResultV1(stored('stored', 'technical_interruption'))).toBeNull()
  })

  it('does not make revision-conflict legal on begin, but permits it on CAS transitions', () => {
    const conflict = { schemaVersion: 1, status: 'revision-conflict', currentRevision: 7 }
    expect(parseProductionSessionBeginResultV1(conflict)).toBeNull()
    expect(parseProductionSessionActivateResultV1(conflict)).toEqual(conflict)
    expect(parseProductionSessionActivateResultV1({ ...conflict, currentRevision: 0 })).toBeNull()
  })

  it.each([
    'not-found',
    'idempotency-collision',
    'quarantined',
    'integrity-failed',
    'illegal-transition',
    'auth-refused',
    'auth-infrastructure-unavailable',
    'rate-limited',
    'server-unavailable',
  ])('admits safe transition outcome %s and rejects response prose', (status) => {
    expect(parseProductionSessionActivateResultV1({ schemaVersion: 1, status })?.status).toBe(status)
    expect(parseProductionSessionActivateResultV1({ schemaVersion: 1, status, message: 'unsafe details' })).toBeNull()
  })
})

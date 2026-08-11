import { describe, expect, it } from 'vitest'
import {
  PRODUCTION_WIRE_MAX_DURATION_MINUTES,
  PRODUCTION_WIRE_MAX_SEGMENTS,
  parseProductionCalendarBlockReadRequestV1,
  parseProductionCalendarBlockReadResultV1,
  parseProductionCalendarCommandRequestV1,
  parseProductionCalendarCompleteBlockRequestV1,
  parseProductionCalendarCompleteBlockResultV1,
  parseProductionCalendarCompleteSegmentRequestV1,
  parseProductionCalendarCompleteSegmentResultV1,
  parseProductionCalendarPauseResultV1,
  parseProductionCalendarResumeResultV1,
  parseProductionCalendarStartResultV1,
  parseProductionStudyCalendarEntryV1,
} from './index'

const transitionedAt = '2026-08-11T17:00:00-04:00'

function entry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    blockRef: 'block:math-1',
    blockType: 'lesson',
    sourceRef: 'lesson:fractions',
    scheduledStart: '2026-08-12T09:00:00-04:00',
    intendedLocalDate: '2026-08-12',
    durationMinutes: 30,
    completedSegmentCount: 1,
    requiredSegmentCount: 4,
    status: 'in_progress',
    revision: 3,
    transitionedAt,
    ...overrides,
  }
}

function command(kind: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 1,
    command: kind,
    blockRef: 'block:math-1',
    expectedRevision: 3,
    idempotencyKey: `idempotency:${kind}-4`,
    operationRef: `operation:${kind}-4`,
    ...overrides,
  }
}

function result(state: string, status = 'stored'): Record<string, unknown> {
  return {
    schemaVersion: 1,
    status,
    entry: entry({
      status: state,
      ...(state === 'completed' ? { completedSegmentCount: 4 } : {}),
    }),
  }
}

describe('ProductionStudyCalendarEntryV1', () => {
  it('parses an exact narrow block read model and rebuilds it', () => {
    const source = entry()
    const parsed = parseProductionStudyCalendarEntryV1(source)
    expect(parsed).toEqual(source)
    expect(parsed).not.toBe(source)
    expect(Object.isFrozen(parsed)).toBe(true)
  })

  it.each([
    ['raw answer', { answer: '42' }],
    ['Tutor transcript', { transcript: 'secret' }],
    ['Tutor cursor', { tutorCursor: 9 }],
    ['protected work', { protectedWork: { body: 'draft' } }],
    ['diagnostic data', { diagnostic: { fluency: 0.2 } }],
    ['emotional data', { emotion: 'anxious' }],
    ['personality data', { personality: 'visual' }],
    ['browser household claim', { householdRef: 'household:claimed' }],
    ['browser student claim', { studentId: 'student:claimed' }],
  ])('rejects %s as an unknown entry property', (_label, extra) => {
    expect(parseProductionStudyCalendarEntryV1(entry(extra))).toBeNull()
  })

  it('bounds durations and segment counts and preserves their distinction', () => {
    expect(parseProductionStudyCalendarEntryV1(entry({
      durationMinutes: PRODUCTION_WIRE_MAX_DURATION_MINUTES,
      completedSegmentCount: PRODUCTION_WIRE_MAX_SEGMENTS,
      requiredSegmentCount: PRODUCTION_WIRE_MAX_SEGMENTS,
    }))).not.toBeNull()
    for (const overrides of [
      { durationMinutes: 0 },
      { durationMinutes: PRODUCTION_WIRE_MAX_DURATION_MINUTES + 1 },
      { completedSegmentCount: -1 },
      { requiredSegmentCount: PRODUCTION_WIRE_MAX_SEGMENTS + 1 },
      { completedSegmentCount: 5, requiredSegmentCount: 4 },
      { completedSegmentCount: 1.5 },
    ]) {
      expect(parseProductionStudyCalendarEntryV1(entry(overrides)), JSON.stringify(overrides)).toBeNull()
    }
  })

  it('requires completed blocks to have all segments complete but not the reverse', () => {
    expect(parseProductionStudyCalendarEntryV1(entry({
      status: 'completed', completedSegmentCount: 3, requiredSegmentCount: 4,
    }))).toBeNull()
    expect(parseProductionStudyCalendarEntryV1(entry({
      status: 'in_progress', completedSegmentCount: 4, requiredSegmentCount: 4,
    }))).not.toBeNull()
  })

  it('rejects invalid enums, revisions, dates, timestamps and unknown keys', () => {
    for (const invalid of [
      { status: 'paused' },
      { blockType: 'homework' },
      { revision: 0 },
      { revision: 1.5 },
      { intendedLocalDate: '2026-02-31' },
      { scheduledStart: '2026-08-12' },
      { transitionedAt: 'just now' },
      { title: 'Browser title' },
    ]) {
      expect(parseProductionStudyCalendarEntryV1(entry(invalid)), JSON.stringify(invalid)).toBeNull()
    }
  })
})

describe('calendar read and explicit commands', () => {
  it('defines an exact single-block read', () => {
    const request = { schemaVersion: 1, blockRef: 'block:math-1', operationRef: 'operation:block-read' }
    expect(parseProductionCalendarBlockReadRequestV1(request)).toEqual(request)
    expect(parseProductionCalendarBlockReadRequestV1({ ...request, cursor: null })).toBeNull()
    expect(parseProductionCalendarBlockReadRequestV1({ ...request, learnerRef: 'learner:claim' })).toBeNull()
  })

  it.each([
    command('start'),
    { ...command('pause'), pauseReason: 'student-request' },
    command('resume'),
    command('complete-block'),
    { ...command('complete-segment'), segmentRef: 'segment:guided-practice' },
  ])('parses explicit operation $command', (request) => {
    expect(parseProductionCalendarCommandRequestV1(request)?.command).toBe(request.command)
  })

  it('keeps complete-block and complete-segment separate in both directions', () => {
    const completeBlock = command('complete-block')
    const completeSegment = { ...command('complete-segment'), segmentRef: 'segment:one' }
    expect(parseProductionCalendarCompleteBlockRequestV1(completeBlock)).not.toBeNull()
    expect(parseProductionCalendarCompleteSegmentRequestV1(completeSegment)).not.toBeNull()
    expect(parseProductionCalendarCompleteBlockRequestV1(completeSegment)).toBeNull()
    expect(parseProductionCalendarCompleteSegmentRequestV1(completeBlock)).toBeNull()
    expect(parseProductionCalendarCompleteBlockRequestV1({ ...completeBlock, segmentRef: 'segment:one' })).toBeNull()
  })

  it('rejects target-state writes and server transition timestamps', () => {
    for (const extra of [
      { status: 'completed' },
      { state: 'completed' },
      { completionUnits: 4 },
      { transitionedAt },
      { completedAt: transitionedAt },
    ]) {
      expect(parseProductionCalendarCommandRequestV1({ ...command('complete-block'), ...extra })).toBeNull()
    }
  })

  it('rejects invalid revisions, pause reasons, and oversized references', () => {
    for (const expectedRevision of [0, -1, 1.5, '3', null, Number.MAX_SAFE_INTEGER + 1]) {
      expect(parseProductionCalendarCommandRequestV1(command('start', { expectedRevision }))).toBeNull()
    }
    expect(parseProductionCalendarCommandRequestV1({ ...command('pause'), pauseReason: 'invented' })).toBeNull()
    expect(parseProductionCalendarCommandRequestV1(command('start', { blockRef: `b${'x'.repeat(160)}` }))).toBeNull()
  })
})

describe('calendar operation-specific result vocabulary', () => {
  it('parses exact read outcomes but no mutation outcomes', () => {
    expect(parseProductionCalendarBlockReadResultV1({ schemaVersion: 1, status: 'found', entry: entry() })?.status)
      .toBe('found')
    expect(parseProductionCalendarBlockReadResultV1({ schemaVersion: 1, status: 'not-found' })?.status).toBe('not-found')
    expect(parseProductionCalendarBlockReadResultV1({ schemaVersion: 1, status: 'integrity-failed' })?.status)
      .toBe('integrity-failed')
    expect(parseProductionCalendarBlockReadResultV1(result('in_progress'))).toBeNull()
    expect(parseProductionCalendarBlockReadResultV1({ schemaVersion: 1, status: 'revision-conflict', currentRevision: 3 })).toBeNull()
  })

  it('requires each successful operation to return the state it owns', () => {
    expect(parseProductionCalendarStartResultV1(result('in_progress'))?.status).toBe('stored')
    expect(parseProductionCalendarPauseResultV1(result('available'))?.status).toBe('stored')
    expect(parseProductionCalendarResumeResultV1(result('in_progress', 'duplicate-replay'))?.status).toBe('duplicate-replay')
    expect(parseProductionCalendarCompleteBlockResultV1(result('completed'))?.status).toBe('stored')
  })

  it('proves segment completion never implies block completion', () => {
    expect(parseProductionCalendarCompleteSegmentResultV1(result('in_progress'))?.status).toBe('stored')
    expect(parseProductionCalendarCompleteSegmentResultV1(result('completed'))).toBeNull()
    expect(parseProductionCalendarCompleteBlockResultV1(result('in_progress'))).toBeNull()
  })

  it.each([
    { schemaVersion: 1, status: 'revision-conflict', currentRevision: 4 },
    { schemaVersion: 1, status: 'idempotency-collision' },
    { schemaVersion: 1, status: 'not-found' },
    { schemaVersion: 1, status: 'illegal-transition' },
    { schemaVersion: 1, status: 'quarantined' },
    { schemaVersion: 1, status: 'integrity-failed' },
    { schemaVersion: 1, status: 'auth-refused' },
    { schemaVersion: 1, status: 'auth-infrastructure-unavailable' },
    { schemaVersion: 1, status: 'rate-limited' },
    { schemaVersion: 1, status: 'server-unavailable' },
  ])('admits exact calendar mutation outcome $status', (outcome) => {
    expect(parseProductionCalendarCompleteSegmentResultV1(outcome)?.status).toBe(outcome.status)
    expect(parseProductionCalendarCompleteSegmentResultV1({ ...outcome, details: 'no' })).toBeNull()
  })
})

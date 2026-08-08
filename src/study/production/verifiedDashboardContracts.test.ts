import { describe, expect, it } from 'vitest'
import {
  parseVerifiedStudyCalendar,
  parseVerifiedStudyDashboard,
  VERIFIED_CALENDAR_BLOCK_KEYS,
  VERIFIED_CALENDAR_BLOCK_LIMIT,
  VERIFIED_DASHBOARD_SESSION_KEYS,
  VERIFIED_DASHBOARD_SESSION_LIMIT,
  VerifiedStudyContractError,
} from './verifiedDashboardContracts'

// STUDY-A1-PROD-DASH-1 Phase 3 — reject, don't invent.
//
// The production learner surface has exactly two server reads and no fallback
// data source. Every case below is a body the server could never have produced;
// the only safe answer to each is a refusal, because the alternative is a
// learner acting on a plan the household never scheduled.

function session(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: 'study-session-01',
    state: 'active',
    lessonId: 'math.g5.u2.l3',
    revision: 4,
    updatedAt: '2026-08-07T13:05:00+00:00',
    ...overrides,
  }
}

function block(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    blockId: 'calendar-block-01',
    blockType: 'lesson',
    sourceReference: 'math.g5.u2.l3',
    scheduledStart: '2026-08-07T13:00:00+00:00',
    intendedLocalDate: '2026-08-07',
    state: 'scheduled',
    revision: 1,
    ...overrides,
  }
}

function omit(row: Record<string, unknown>, key: string): Record<string, unknown> {
  const copy = { ...row }
  delete copy[key]
  return copy
}

const refusedDashboard = (body: unknown) => expect(() => parseVerifiedStudyDashboard(body))
const refusedCalendar = (body: unknown) => expect(() => parseVerifiedStudyCalendar(body))

describe('verified dashboard:read contract', () => {
  it('returns exactly the fields the server sent', () => {
    const parsed = parseVerifiedStudyDashboard({ sessions: [session()] })
    expect(parsed.sessions).toHaveLength(1)
    expect(parsed.sessions[0]).toEqual({
      sessionId: 'study-session-01',
      state: 'active',
      lessonId: 'math.g5.u2.l3',
      revision: 4,
      updatedAt: '2026-08-07T13:05:00+00:00',
    })
  })

  it('accepts an empty session list without inventing a placeholder session', () => {
    expect(parseVerifiedStudyDashboard({ sessions: [] }).sessions).toEqual([])
  })

  it('never synthesises a title, subject, segments, resume point or completion', () => {
    const parsed = parseVerifiedStudyDashboard({ sessions: [session()] })
    expect(Object.keys(parsed.sessions[0]!).sort())
      .toEqual([...VERIFIED_DASHBOARD_SESSION_KEYS].sort())
    expect(Object.keys(parsed).sort()).toEqual(['sessions'])
  })

  it(`does not hand back the caller's object`, () => {
    const row = session()
    const body = { sessions: [row] }
    const parsed = parseVerifiedStudyDashboard(body)
    expect(parsed.sessions[0]).not.toBe(row)
    expect(parsed.sessions).not.toBe(body.sessions)
    expect(Object.isFrozen(parsed.sessions[0])).toBe(true)
    expect(Object.isFrozen(parsed)).toBe(true)
  })

  it('refuses a session missing state', () => {
    refusedDashboard({ sessions: [omit(session(), 'state')] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([...VERIFIED_DASHBOARD_SESSION_KEYS])('refuses a session missing %s', (key) => {
    refusedDashboard({ sessions: [omit(session(), key)] }).toThrow(VerifiedStudyContractError)
  })

  it('refuses an unknown extra field rather than ignoring it', () => {
    refusedDashboard({ sessions: [session({ completionPercent: 40 })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['householdId', { householdId: 'household-1' }],
    ['studentId', { studentId: 'student-1' }],
    ['grant', { grant: 'opaque' }],
    ['rawAnswer', { rawAnswer: '42' }],
    ['transcript', { transcript: 'hello' }],
  ])('refuses a protected field %s in a session', (_name, extra) => {
    refusedDashboard({ sessions: [session(extra)] }).toThrow(VerifiedStudyContractError)
  })

  it('refuses an unknown session state', () => {
    refusedDashboard({ sessions: [session({ state: 'resting' })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['a string revision', '4'],
    ['zero', 0],
    ['a negative revision', -1],
    ['a fractional revision', 1.5],
    ['NaN', Number.NaN],
    ['an unsafe integer', Number.MAX_SAFE_INTEGER + 2],
    ['null', null],
  ])('refuses %s as a revision', (_name, value) => {
    refusedDashboard({ sessions: [session({ revision: value })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['an unparseable string', 'yesterday'],
    ['a date without a time', '2026-08-07'],
    ['an instant with no offset', '2026-08-07T13:05:00'],
    ['an impossible month', '2026-13-07T13:05:00+00:00'],
    ['a number', 1_754_579_100_000],
    ['null', null],
  ])('refuses %s as updatedAt', (_name, value) => {
    refusedDashboard({ sessions: [session({ updatedAt: value })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['an empty identifier', ''],
    ['a leading separator', '.math.g5'],
    ['a space', 'math g5'],
    ['an identifier over 160 characters', `a${'b'.repeat(160)}`],
    ['a number', 7],
  ])('refuses %s as lessonId', (_name, value) => {
    refusedDashboard({ sessions: [session({ lessonId: value })] })
      .toThrow(VerifiedStudyContractError)
  })

  it('refuses more sessions than the server can return', () => {
    const rows = Array.from({ length: VERIFIED_DASHBOARD_SESSION_LIMIT + 1 }, (_value, index) =>
      session({ sessionId: `study-session-${index}` }))
    refusedDashboard({ sessions: rows }).toThrow(VerifiedStudyContractError)
    expect(() => parseVerifiedStudyDashboard({ sessions: rows.slice(0, -1) })).not.toThrow()
  })

  it.each([
    ['null', null],
    ['an array', []],
    ['a string', 'sessions'],
    ['a body with no sessions key', {}],
    ['a body with an extra key', { sessions: [], blocks: [] }],
    ['sessions as an object', { sessions: {} }],
  ])('refuses %s as a dashboard body', (_name, body) => {
    refusedDashboard(body).toThrow(VerifiedStudyContractError)
  })
})

describe('verified calendar:read contract', () => {
  it('returns exactly the fields the server sent', () => {
    const parsed = parseVerifiedStudyCalendar({ blocks: [block()] })
    expect(parsed.blocks[0]).toEqual({
      blockId: 'calendar-block-01',
      blockType: 'lesson',
      sourceReference: 'math.g5.u2.l3',
      scheduledStart: '2026-08-07T13:00:00+00:00',
      intendedLocalDate: '2026-08-07',
      state: 'scheduled',
      revision: 1,
    })
    expect(Object.keys(parsed.blocks[0]!).sort())
      .toEqual([...VERIFIED_CALENDAR_BLOCK_KEYS].sort())
  })

  it('accepts an empty block list without inventing a day', () => {
    expect(parseVerifiedStudyCalendar({ blocks: [] }).blocks).toEqual([])
  })

  it(`does not hand back the caller's object`, () => {
    const row = block()
    const parsed = parseVerifiedStudyCalendar({ blocks: [row] })
    expect(parsed.blocks[0]).not.toBe(row)
    expect(Object.isFrozen(parsed.blocks[0])).toBe(true)
  })

  it.each([...VERIFIED_CALENDAR_BLOCK_KEYS])('refuses a block missing %s', (key) => {
    refusedCalendar({ blocks: [omit(block(), key)] }).toThrow(VerifiedStudyContractError)
  })

  it('refuses an unknown extra field rather than ignoring it', () => {
    refusedCalendar({ blocks: [block({ title: 'Fractions' })] })
      .toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['householdId', { householdId: 'household-1' }],
    ['learnerRef', { learnerRef: 'learner-1' }],
    ['sessionEpoch', { sessionEpoch: 3 }],
    ['transcript', { transcript: 'hello' }],
  ])('refuses a protected field %s in a block', (_name, extra) => {
    refusedCalendar({ blocks: [block(extra)] }).toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['blockType', 'homework'],
    ['state', 'skipped'],
  ])('refuses an unknown %s value', (key, value) => {
    refusedCalendar({ blocks: [block({ [key]: value })] }).toThrow(VerifiedStudyContractError)
  })

  it.each([
    ['a timestamp', '2026-08-07T00:00:00+00:00'],
    ['an impossible day', '2026-02-31'],
    ['a two digit year', '26-08-07'],
    ['a slash date', '2026/08/07'],
    ['null', null],
  ])('refuses %s as intendedLocalDate', (_name, value) => {
    refusedCalendar({ blocks: [block({ intendedLocalDate: value })] })
      .toThrow(VerifiedStudyContractError)
  })

  it('accepts a real leap day', () => {
    expect(() => parseVerifiedStudyCalendar({ blocks: [block({ intendedLocalDate: '2028-02-29' })] }))
      .not.toThrow()
  })

  it.each([
    ['an unparseable string', 'soon'],
    ['a bare date', '2026-08-07'],
    ['an instant with no offset', '2026-08-07T13:00:00'],
    ['a number', 0],
  ])('refuses %s as scheduledStart', (_name, value) => {
    refusedCalendar({ blocks: [block({ scheduledStart: value })] })
      .toThrow(VerifiedStudyContractError)
  })

  it('accepts the offset and fractional forms Postgres emits', () => {
    for (const value of [
      '2026-08-07T13:00:00+00:00',
      '2026-08-07T13:00:00.123456+00:00',
      '2026-08-07T13:00:00-04:00',
      '2026-08-07T13:00:00Z',
    ]) {
      expect(() => parseVerifiedStudyCalendar({ blocks: [block({ scheduledStart: value })] }))
        .not.toThrow()
    }
  })

  it('refuses more blocks than the server can return', () => {
    const rows = Array.from({ length: VERIFIED_CALENDAR_BLOCK_LIMIT + 1 }, (_value, index) =>
      block({ blockId: `calendar-block-${index}` }))
    refusedCalendar({ blocks: rows }).toThrow(VerifiedStudyContractError)
    expect(() => parseVerifiedStudyCalendar({ blocks: rows.slice(0, -1) })).not.toThrow()
  })

  it.each([
    ['null', null],
    ['a body with no blocks key', {}],
    ['a body carrying a review queue', { blocks: [], reviewQueue: [] }],
    ['blocks as an object', { blocks: {} }],
  ])('refuses %s as a calendar body', (_name, body) => {
    refusedCalendar(body).toThrow(VerifiedStudyContractError)
  })

  it('names the operation that failed and nothing else', () => {
    try {
      parseVerifiedStudyCalendar({ blocks: [block({ sourceReference: 'secret answer' })] })
      expect.unreachable('the malformed block should have been refused')
    } catch (error) {
      expect(error).toBeInstanceOf(VerifiedStudyContractError)
      expect((error as VerifiedStudyContractError).code).toBe('calendar-body-invalid')
      // No server value may travel out inside the refusal.
      expect((error as Error).message).not.toContain('secret')
    }
  })
})
